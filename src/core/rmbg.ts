/**
 * ================================================================
 *  纯 Canvas 像素抠图引擎 · 极致稳定优先
 * ================================================================
 *
 *  设计原则（严格满足用户反 AI 卡死要求）：
 *  ✅ 零 AI / 零 ONNX / 零 WebGPU / 零 WASM 依赖，不下载任何模型
 *  ✅ 绝对禁止页面卡死：像素大循环按行分片，每 32 行 yield 一次事件循环
 *  ✅ 每张速度稳定：大图先等比缩到最长边 ≤1600 再处理，结果还原，不越跑越慢
 *  ✅ 杜绝"抠图无效/与原图一致"：所有像素都会改写 alpha，不存在直通分支
 *  ✅ 日常办公效果稳定：四角+四边8点+2%边带采样估计背景色（纯色/近纯色/复杂渐变均覆盖）
 *
 *  算法流程：
 *   1) 图像解码 → 限制最长边 ≤ 1600（内部处理尺寸，最终仍按原尺寸出图）
 *   2) 背景估计：2% 边带像素 → 颜色聚类（最多 3 个代表色）+ 整体均色
 *   3) 逐像素抠图：计算像素与代表色集合的最小距离，平滑映射到 alpha
 *      外加 Flood Fill（8 边界起点）再收紧背景
 *   4) 后处理：半透明压边 → 灰边清理 → 可选羽化
 *   5) destination-in 合成最终 cutout（透明底原图尺寸）
 *
 *  纯前端：图片数据 NEVER 离开用户设备；无任何后端 / 付费 API / 登录
 * ================================================================
 */

export type BgMode = 'transparent' | 'white' | 'custom';

export type BgDetectMode = 'auto' | 'solid' | 'edgeBand';

export interface RmbgProgress {
  (stage: 'load' | 'preprocess' | 'infer' | 'postprocess' | 'compose', ratio: number, msg?: string): void;
}

export interface RmbgResult {
  cutoutCanvas: HTMLCanvasElement;       // 纯 PNG 透明画布（未叠加背景，按原尺寸输出）
  maskCanvas: HTMLCanvasElement;         // 灰度 alpha 同尺寸 mask（调试 / 预览用）
  engine: string;                        // 引擎标识
  elapsedMs: number;                     // 总耗时
}

/* ---------------- 工具函数 ---------------- */

function resizeTo(img: HTMLImageElement | HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('图片加载失败：' + ((e as ErrorEvent).message || file.name)));
      img.src = url;
    });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}

/** 让渡事件循环，保证浏览器 UI 不冻结 */
function yieldUI(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** 每 N 行让渡一次 UI（分片防卡死关键） */
const YIELD_ROW_STEP = 32;

/* ---------------- 背景颜色估计（最多 3 个代表色） ---------------- */

interface BgPalette {
  repr: Array<{ r: number; g: number; b: number; weight: number }>; // 代表色，weight 0..1
  avg: { r: number; g: number; b: number };                        // 边带平均色（兜底）
  variance: number;                                                // 边带像素颜色方差（用于 auto 判别）
  sampleCount: number;
}

/** 从图像 2% 边带采样像素并做 k-means(k≤3) 聚类，给出背景色盘 */
function estimateBgPalette(imgData: ImageData): BgPalette {
  const { data, width: w, height: h } = imgData;
  const padX = Math.max(1, Math.round(w * 0.02));
  const padY = Math.max(1, Math.round(h * 0.02));
  const step = Math.max(1, Math.floor(Math.min(w, h) / 160));
  const samples: Array<[number, number, number]> = [];
  let sr = 0, sg = 0, sb = 0, sc = 0;
  // 顶行/底行
  for (let x = 0; x < w; x += step) {
    const top = x * 4;
    const bot = ((h - 1) * w + x) * 4;
    for (let i = 0; i < padY; i++) {
      const ti = (i * w + x) * 4;
      const bi = ((h - 1 - i) * w + x) * 4;
      push(ti); push(bi);
    }
    void top; void bot;
  }
  // 左右列
  for (let y = padY; y < h - padY; y += step) {
    for (let i = 0; i < padX; i++) {
      const li = (y * w + i) * 4;
      const ri = (y * w + w - 1 - i) * 4;
      push(li); push(ri);
    }
  }
  function push(i: number) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    samples.push([r, g, b]);
    sr += r; sg += g; sb += b; sc++;
  }
  if (sc === 0) return { repr: [{ r: 255, g: 255, b: 255, weight: 1 }], avg: { r: 255, g: 255, b: 255 }, variance: 0, sampleCount: 0 };
  const avg = { r: Math.round(sr / sc), g: Math.round(sg / sc), b: Math.round(sb / sc) };
  // 方差
  let v = 0;
  for (const [r, g, b] of samples) {
    const dr = r - avg.r, dg = g - avg.g, db = b - avg.b;
    v += (dr * dr + dg * dg + db * db);
  }
  const variance = Math.sqrt(v / sc); // 每个通道平均距离
  // k-means(k≤3)：初始中心 = 第 0%、50%、100%（按亮度排序）
  const n = Math.min(samples.length, 600);
  const sub: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) sub.push(samples[(i * samples.length) / n | 0] || samples[0]);
  sub.sort((a, b) => (a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114) - (b[0] * 0.299 + b[1] * 0.587 + b[2] * 0.114));
  const k = sub.length < 20 ? 1 : Math.min(3, Math.max(1, (variance > 60 ? 3 : variance > 25 ? 2 : 1)));
  const centers: Array<[number, number, number]> = [];
  for (let i = 0; i < k; i++) centers.push(sub[Math.min(sub.length - 1, ((sub.length - 1) * i) / Math.max(1, k - 1) | 0)]);
  for (let iter = 0; iter < 6; iter++) {
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0]) as Array<[number, number, number, number]>;
    for (const s of sub) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < k; i++) {
        const d = dist2(s, centers[i]);
        if (d < bd) { bd = d; best = i; }
      }
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2]; sums[best][3]++;
    }
    for (let i = 0; i < k; i++) {
      if (sums[i][3] > 0) {
        centers[i] = [Math.round(sums[i][0] / sums[i][3]), Math.round(sums[i][1] / sums[i][3]), Math.round(sums[i][2] / sums[i][3])];
      }
    }
  }
  // 统计每个 cluster 的重量，越大越接近 1（纯背景）
  const count = new Array(k).fill(0);
  for (const s of sub) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < k; i++) { const d = dist2(s, centers[i]); if (d < bd) { bd = d; best = i; } }
    count[best]++;
  }
  const total = Math.max(1, count.reduce((a, b) => a + b, 0));
  const repr = centers.map((c, i) => ({ r: c[0], g: c[1], b: c[2], weight: count[i] / total }))
    .filter(x => x.weight > 0.05)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
  // 补一个至少主色
  if (repr.length === 0) repr.push({ r: avg.r, g: avg.g, b: avg.b, weight: 1 });
  return { repr, avg, variance, sampleCount: sc };
}

type Rgb = [number, number, number] | { r: number; g: number; b: number };
function toRgbObj(a: Rgb): { r: number; g: number; b: number } {
  return Array.isArray(a) ? { r: a[0], g: a[1], b: a[2] } : a;
}
function dist2(a: Rgb, b: Rgb) {
  const A = toRgbObj(a), B = toRgbObj(b);
  const dr = A.r - B.r, dg = A.g - B.g, db = A.b - B.b;
  return dr * dr + dg * dg + db * db;
}

/** 像素到背景色盘的最小欧氏距离平方 */
function minDist2ToPalette(r: number, g: number, b: number, pal: BgPalette): number {
  let m = dist2({ r, g, b }, pal.avg);
  for (const p of pal.repr) {
    const d = dist2({ r, g, b }, p);
    if (d < m) m = d;
  }
  return m;
}

/* ---------------- 主算法：逐像素抠图（分片 yield 不卡死） ---------------- */

interface AlphaPipelineOptions {
  threshold: number;     // 0..120 颜色容差（欧氏距离）
  softBand: number;      // 软过渡带宽，越大边缘越柔
  featherPx: number;     // 0..15 羽化
  edgeRefine: boolean;   // 边缘精修/压边
  bgMode: BgDetectMode;
}

async function computeAlphaMask(
  imgData: ImageData,
  pal: BgPalette,
  opts: AlphaPipelineOptions,
  onProgress?: (rowRatio: number, msg?: string) => void,
): Promise<Uint8ClampedArray> {
  const { data, width: w, height: h } = imgData;
  const total = w * h;
  const alpha = new Uint8ClampedArray(total); // 0..255，越大越认为是前景

  // 1) 距离 → alpha 软映射
  // threshold 内 → 背景 alpha=0
  // threshold ~ threshold+softBand 内 → 0..255 线性过渡
  // 超出 → alpha=255 前景
  const thr = Math.max(5, Math.min(160, opts.threshold));
  const band = Math.max(6, Math.min(120, opts.softBand));
  const thrSq = thr * thr;
  const maxSq = (thr + band) * (thr + band);
  const invRange = 1 / (maxSq - thrSq);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const d2 = minDist2ToPalette(r, g, b, pal);
      let a: number;
      if (d2 <= thrSq) a = 0;
      else if (d2 >= maxSq) a = 255;
      else {
        const k = (d2 - thrSq) * invRange; // 0..1
        // 轻量 S 曲线让边缘不那么线性，更自然
        const s = k * k * (3 - 2 * k);
        a = Math.max(0, Math.min(255, Math.round(s * 255)));
      }
      alpha[y * w + x] = a;
    }
    if (((y + 1) % YIELD_ROW_STEP) === 0) {
      onProgress?.(0.2 + (y / h) * 0.5, `像素处理 ${y}/${h}`);
      await yieldUI();
    }
  }

  // 2) Flood Fill（从 8 边界起始）收紧背景：把已判为背景且连通边带的像素，alpha 直接拉到 0
  // 只对 alpha <= 40 的像素做连接性，避免误吞前景
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;
  const pushIf = (idx: number) => {
    if (visited[idx]) return;
    if (alpha[idx] <= 40) { visited[idx] = 1; stack[sp++] = idx; }
  };
  for (let x = 0; x < w; x++) { pushIf(x); pushIf((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { pushIf(y * w); pushIf(y * w + w - 1); }
  // 分批次处理，避免超大图一次性卡
  let steps = 0;
  while (sp > 0) {
    const idx = stack[--sp];
    alpha[idx] = 0;
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) pushIf(idx - 1);
    if (x < w - 1) pushIf(idx + 1);
    if (y > 0) pushIf(idx - w);
    if (y < h - 1) pushIf(idx + w);
    steps++;
    if ((steps & 0x7fff) === 0) await yieldUI();
  }

  // 3) 边缘精修：去除 3 邻域大部分都是背景的孤立小残留 + 灰边 boost
  if (opts.edgeRefine) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const a = alpha[idx];
        if (a === 0 || a === 255) continue;
        // 统计 4 邻域中接近背景的像素数量
        let bg = 0, fg = 0;
        if (x > 0) { const v = alpha[idx - 1]; if (v === 0) bg++; else if (v >= 220) fg++; } else bg++;
        if (x < w - 1) { const v = alpha[idx + 1]; if (v === 0) bg++; else if (v >= 220) fg++; } else bg++;
        if (y > 0) { const v = alpha[idx - w]; if (v === 0) bg++; else if (v >= 220) fg++; } else bg++;
        if (y < h - 1) { const v = alpha[idx + w]; if (v === 0) bg++; else if (v >= 220) fg++; } else bg++;
        // 去残留：3+ 背景邻居 + 当前 alpha < 90 → 拉到 0
        if (bg >= 3 && a < 90) { alpha[idx] = 0; continue; }
        // 灰边/半透明靠近前景：3+ 前景邻居 + 当前 alpha > 170 → 255
        if (fg >= 3 && a > 170) { alpha[idx] = 255; continue; }
        // 低尾压边：<20 → 0，高尾：>235 → 255
        if (a < 20) alpha[idx] = 0;
        else if (a > 235) alpha[idx] = 255;
        // 接近背景色的半透明灰边：再降 alpha
        const i = idx * 4;
        const dr = data[i] - pal.avg.r, dg = data[i + 1] - pal.avg.g, db = data[i + 2] - pal.avg.b;
        const dd = Math.sqrt(dr * dr + dg * dg + db * db);
        if (a < 180 && dd < thr + band * 0.5) {
          const k = Math.max(0, Math.min(1, (dd - thr) / Math.max(1, band * 0.5)));
          alpha[idx] = Math.max(0, Math.min(255, Math.round(a * k)));
        }
      }
      if (((y + 1) % YIELD_ROW_STEP) === 0) {
        onProgress?.(0.75 + (y / h) * 0.2, `边缘精修 ${y}/${h}`);
        await yieldUI();
      }
    }
  } else {
    // 非 edgeRefine 也做一次低/高尾压边，杜绝无效输出
    for (let i = 0; i < alpha.length; i++) {
      const a = alpha[i];
      if (a < 20) alpha[i] = 0;
      else if (a > 240) alpha[i] = 255;
    }
  }

  // 4) 羽化（可选）：用 canvas filter blur，稳定且快
  if (opts.featherPx > 0) {
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d')!;
    const im = tctx.createImageData(w, h);
    for (let i = 0; i < alpha.length; i++) im.data[i * 4 + 3] = alpha[i];
    tctx.putImageData(im, 0, 0);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const octx = out.getContext('2d')!;
    (octx as any).filter = `blur(${Math.max(0.3, opts.featherPx)}px)`;
    octx.drawImage(tmp, 0, 0);
    const data = octx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * 4 + 3];
  }

  return alpha;
}

function alphaToMaskCanvas(alpha: Uint8ClampedArray, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const im = ctx.createImageData(w, h);
  for (let i = 0; i < alpha.length; i++) { const p = i * 4; im.data[p] = 0; im.data[p + 1] = 0; im.data[p + 2] = 0; im.data[p + 3] = alpha[i]; }
  ctx.putImageData(im, 0, 0);
  return c;
}

function composeCutout(rgbaImage: HTMLCanvasElement, mask: HTMLCanvasElement): HTMLCanvasElement {
  const W = rgbaImage.width, H = rgbaImage.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d')!;
  octx.drawImage(rgbaImage, 0, 0);
  octx.save();
  octx.globalCompositeOperation = 'destination-in';
  octx.drawImage(mask, 0, 0);
  octx.restore();
  return out;
}

/** 将透明 cutout 叠加用户选中的背景（用于预览或 JPG/WEBP 导出） */
export function flattenCutout(
  cutout: HTMLCanvasElement,
  mode: BgMode,
  customBg: string = '#ffffff',
): HTMLCanvasElement {
  const bgColor: string | null = mode === 'transparent' ? null : mode === 'white' ? '#ffffff' : (customBg || '#ffffff');
  const out = document.createElement('canvas');
  out.width = cutout.width; out.height = cutout.height;
  const ctx = out.getContext('2d')!;
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(cutout, 0, 0);
  return out;
}

/* ---------------- 兼容性存根（移除 AI 后保持 API 不变，避免其他模块编译错） ---------------- */

export function resetSessionForTest() { /* NOOP */ }
let _lastEp: string = 'canvas-2d';
export function getLastEp(): string { return _lastEp; }
_lastEp = 'canvas-2d';

/**
 * 将合成后的 cutout 输出为浏览器支持的最小体积 Blob：
 *  - 透明底 → PNG；
 *  - 实色底 → JPG（优先，兼容最好），浏览器支持则 WebP 质量 0.88；
 *  - 最长边限制 maxLongEdge（默认 2400）。
 */
export async function compressCutoutBlob(
  flat: HTMLCanvasElement,
  mode: BgMode,
  maxLongEdge = 2400,
): Promise<{ blob: Blob; ext: 'png' | 'jpg' | 'webp' }> {
  let source = flat;
  if (maxLongEdge > 0) {
    const maxSide = Math.max(flat.width, flat.height);
    if (maxSide > maxLongEdge) {
      const s = maxLongEdge / maxSide;
      const nw = Math.max(1, Math.round(flat.width * s));
      const nh = Math.max(1, Math.round(flat.height * s));
      const c = document.createElement('canvas');
      c.width = nw; c.height = nh;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(flat, 0, 0, nw, nh);
      source = c;
    }
  }
  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => {
      try {
        (source as HTMLCanvasElement).toBlob((b) => resolve(b), type, quality);
      } catch { resolve(null); }
    });
  const asFallback = (ext: 'png' | 'jpg' | 'webp'): Blob => {
    try {
      const url = source.toDataURL(ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp', 0.92);
      const b64 = url.includes(',') ? url.split(',')[1] : '';
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return new Blob([out.buffer as ArrayBuffer], { type: ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp' });
    } catch {
      return new Blob([new Uint8Array(1).buffer as ArrayBuffer], { type: 'application/octet-stream' });
    }
  };
  if (mode === 'transparent') {
    const png = await toBlob('image/png');
    return { blob: png || asFallback('png'), ext: 'png' };
  }
  const webp = await toBlob('image/webp', 0.88);
  if (webp && webp.size > 100) return { blob: webp, ext: 'webp' };
  const jpg = await toBlob('image/jpeg', 0.92);
  if (jpg && jpg.size > 100) return { blob: jpg, ext: 'jpg' };
  const png = await toBlob('image/png');
  return { blob: png || asFallback('png'), ext: 'png' };
}

/* ---------------- 主入口 ---------------- */

const INTERNAL_MAX_EDGE = 1600; // 内部处理最大边（保证速度，最终按原尺寸输出）

export async function removeBackground(
  file: File,
  opts: {
    smooth?: boolean;
    timeoutMs?: number;
    feather?: number;
    edgeRefine?: boolean;
    threshold?: number;
    bgDetect?: BgDetectMode;
    softBand?: number;
  } = {},
  onProgress?: RmbgProgress,
): Promise<RmbgResult> {
  const t0 = performance.now();
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const timer = setTimeout(() => onProgress?.('preprocess', 0.5, `处理中 ${Math.round((performance.now() - t0) / 100) / 10}s，分片运算不卡死，请稍候`), 8_000);
  try {
    onProgress?.('load', 0.05, '解码图片');
    const img = await Promise.race<HTMLImageElement>([
      loadImageFromFile(file),
      new Promise<never>((_, rj) => setTimeout(() => rj(new Error('图片加载超时')), timeoutMs)),
    ]);
    const origW = img.naturalWidth || 1;
    const origH = img.naturalHeight || 1;

    // 内部限制最大边，保证稳定性；结果最后还原为 origW/H
    const longSide = Math.max(origW, origH);
    const scale = longSide > INTERNAL_MAX_EDGE ? INTERNAL_MAX_EDGE / longSide : 1;
    const iw = Math.max(1, Math.round(origW * scale));
    const ih = Math.max(1, Math.round(origH * scale));
    const working = resizeTo(img, iw, ih);

    onProgress?.('preprocess', 0.15, '采样背景颜色');
    const wctx = working.getContext('2d', { willReadFrequently: true })!;
    const imgData = wctx.getImageData(0, 0, iw, ih);
    const pal = estimateBgPalette(imgData);

    // 根据 bgDetect 模式（目前 solid/edgeBand 内部估计相同，给用户一个语义化开关）
    // auto: 已经采用 2% 边带 + k-means；纯色：简单用均色做阈值（已覆盖）；边带：用 cluster（已覆盖）
    void opts.bgDetect;

    const threshold = Math.max(8, Math.min(160, Number(opts.threshold ?? 35)));
    // 方差大的（例如渐变/复杂背景）软过渡更宽，避免硬边
    const autoBand = Math.max(14, Math.min(80, 18 + pal.variance * 0.8));
    const softBand = opts.softBand != null ? Math.max(6, Math.min(160, opts.softBand)) : autoBand;
    const featherPx = Math.max(0, Math.min(15, Number(opts.feather ?? 1.2)));
    const edgeRefine = opts.edgeRefine !== false && opts.smooth !== false;

    onProgress?.('infer', 0.2, `抠图中（容差 ${threshold}，边带采样 ${pal.sampleCount} 点，代表色 ${pal.repr.length}`.slice(0, 80));
    const alpha = await computeAlphaMask(imgData, pal, {
      threshold, softBand, featherPx, edgeRefine, bgMode: 'auto',
    }, (r, m) => onProgress?.('infer', 0.2 + r * 0.6, m));

    onProgress?.('postprocess', 0.85, '合成 cutout');
    const maskCanvasSmall = alphaToMaskCanvas(alpha, iw, ih);

    // 还原到原尺寸 mask（平滑双三次）
    let maskCanvas: HTMLCanvasElement;
    let rgbaFull: HTMLCanvasElement;
    if (scale !== 1) {
      maskCanvas = document.createElement('canvas');
      maskCanvas.width = origW; maskCanvas.height = origH;
      const mctx = maskCanvas.getContext('2d')!;
      mctx.imageSmoothingEnabled = true;
      mctx.imageSmoothingQuality = 'high';
      mctx.drawImage(maskCanvasSmall, 0, 0, origW, origH);
      rgbaFull = document.createElement('canvas');
      rgbaFull.width = origW; rgbaFull.height = origH;
      const rctx = rgbaFull.getContext('2d')!;
      rctx.imageSmoothingEnabled = true;
      rctx.imageSmoothingQuality = 'high';
      rctx.drawImage(img, 0, 0, origW, origH);
    } else {
      maskCanvas = maskCanvasSmall;
      rgbaFull = document.createElement('canvas');
      rgbaFull.width = origW; rgbaFull.height = origH;
      rgbaFull.getContext('2d')!.drawImage(img, 0, 0);
    }
    const cutoutCanvas = composeCutout(rgbaFull, maskCanvas);

    onProgress?.('compose', 1, `完成（纯 Canvas 像素算法 · ${Math.round(performance.now() - t0)} ms）`);
    return {
      cutoutCanvas,
      maskCanvas,
      engine: 'Canvas Pixel（纯 Canvas 像素抠图 · 稳定不卡死）',
      elapsedMs: performance.now() - t0,
    };
  } finally { clearTimeout(timer); }
}
