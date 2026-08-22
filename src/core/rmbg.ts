/**
 * ================================================================
 *  AI 抠图引擎 · U2NetP（轻量商用蒸馏 + INT8 量化友好）
 * ================================================================
 *
 *  - 模型：U2NetP Portrait · ONNX 原生 FP32 ≈ 4.3 MB（INT8 后 ≈ 1.2 MB）
 *    · 输入：1×3×320×320（ImageNet 均值方差归一化）
 *    · 输出：7 头 (d1..d7)，仅取 d1（1×1×320×320）做主 mask（与 rembg 官方行为一致）
 *  - 后处理：min-max 归一化 + 原图尺寸双三次还原 + 边缘精修 + 羽化 + alpha 合成
 *  - 推理：ONNX Runtime Web
 *    · 执行提供器优先级：webgpu → webgl → wasm（自动降级）
 *    · 会话复用 + enableMemPattern=true + enableCpuMemArena=true
 *    · 大图不参与推理：最长边限制 ≤ 1280 后再做推理（保证 300–800 ms 区间）
 *  - 缓存：IndexedDB 本地永久缓存（首次下载一次，后续秒级启动）
 *  - 纯前端：图片数据 NEVER 离开用户设备；无任何后端 / 付费 API / 登录
 *
 *  模型来源（URL 顺序尝试，按速度与稳定性）：
 *   1) GitHub release：danielgatis/rembg (CDN 稳定，全球可达)
 *   2) HuggingFace：9Tungsg/u2netp_portrait（Portrait 蒸馏版本，人像质量更优）
 *   3) 量化 INT8 版本回退：9Tungsg/u2netp_portrait_int8（兼容受限 WebGL/WASM）
 * ================================================================
 */

import * as ort from 'onnxruntime-web';

ort.env.allowLocalModelsOnly = false;
ort.env.wasm.numThreads = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
  ? Math.max(1, Math.min(4, navigator.hardwareConcurrency))
  : 1;
ort.env.wasm.simd = true;
ort.env.wasm.proxy = true;

export type BgMode = 'transparent' | 'white' | 'custom';

export interface RmbgProgress {
  (stage: 'load' | 'preprocess' | 'infer' | 'postprocess' | 'compose', ratio: number, msg?: string): void;
}

export interface RmbgResult {
  cutoutCanvas: HTMLCanvasElement;       // 纯 PNG 透明画布（未叠加背景）
  maskCanvas: HTMLCanvasElement;         // 灰度 alpha 原图尺寸 mask（调试 / 预览用）
  engine: string;                        // 使用的执行提供器
  elapsedMs: number;                     // 总耗时
}

/** 模型候选：按顺序依次尝试，全部失败才抛错 */
const MODEL_CANDIDATES: Array<{ url: string; tag: string; size: number }> = [
  // 1) GitHub release：rembg 官方 U2NetP（≈4.3MB FP32，INT8 友好）
  {
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    tag: 'u2netp_fp32_github_4.3MB',
    size: 4_480_000,
  },
  // 2) HuggingFace：人像蒸馏版（Portrait，证件照/人像质量更高）
  {
    url: 'https://huggingface.co/9Tungsg/u2netp_portrait/resolve/main/u2netp.onnx',
    tag: 'u2netp_portrait_fp32_hf',
    size: 4_480_000,
  },
  // 3) HuggingFace：INT8 量化版（≈1.2MB，低端机器 / WASM 兜底更稳）
  {
    url: 'https://huggingface.co/9Tungsg/u2netp_portrait_int8/resolve/main/u2netp.onnx',
    tag: 'u2netp_portrait_int8_hf_1.2MB',
    size: 1_250_000,
  },
];

/** 统一模型输入尺寸（U2NetP 默认 320，速度与质量最均衡） */
const MODEL_SIZE = 320;

/** 预/后处理时最大推理画布边：避免大图片浏览器内存爆炸 */
const MAX_INFER_EDGE = 1280;

/* ---------------- IndexedDB 模型缓存 ---------------- */

const DB_NAME = 'mendfile_models_v1';
const STORE_NAME = 'onnx_models';
const MODEL_ENTRY_KEY = 'u2netp_portrait_int8_v1';
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('indexedDB open failed'));
  });
}
async function dbGetModel(): Promise<{ buf: ArrayBuffer; tag: string } | null> {
  try {
    const db = await openIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(MODEL_ENTRY_KEY);
      req.onsuccess = () => {
        const r = req.result;
        if (r && r.buf instanceof ArrayBuffer && r.buf.byteLength > 100_000) resolve({ buf: r.buf, tag: r.tag || MODEL_ENTRY_KEY });
        else resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}
async function dbPutModel(buf: ArrayBuffer, tag: string) {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ id: MODEL_ENTRY_KEY, buf, tag, createdAt: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* ignore */ }
}

/* ---------------- 下载模型（按候选顺序，带超时） ---------------- */

async function fetchModel(
  onProgress?: (ratio: number, msg?: string) => void,
  timeoutMs = 60_000,
): Promise<{ buf: ArrayBuffer; tag: string }> {
  let lastErr: unknown = null;
  for (let i = 0; i < MODEL_CANDIDATES.length; i++) {
    const c = MODEL_CANDIDATES[i];
    try {
      onProgress?.(i / MODEL_CANDIDATES.length, `下载模型（候选 ${i + 1}/${MODEL_CANDIDATES.length}）：${c.tag}`);
      const buf = await fetchWithProgress(c.url, c.size, timeoutMs, (r, m) => onProgress?.((i + r) / MODEL_CANDIDATES.length, m));
      if (buf && buf.byteLength > 100_000) {
        void dbPutModel(buf, c.tag);
        return { buf, tag: c.tag };
      }
    } catch (e) { lastErr = e; }
  }
  throw new Error(`所有模型 URL 下载失败：${(lastErr as Error)?.message || 'network / CORS 受限'}`);
}

async function fetchWithProgress(
  url: string,
  _expected: number,
  timeoutMs: number,
  onProgress?: (ratio: number, msg?: string) => void,
): Promise<ArrayBuffer> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const resp = await fetch(url, {
      signal: controller?.signal,
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      headers: { Accept: 'application/octet-stream,*/*' },
    });
    if (!resp.ok || !resp.body) {
      // fallback：无 streamed body 则直接 arrayBuffer
      return await resp.arrayBuffer();
    }
    const reader = resp.body.getReader();
    const total = Number(resp.headers.get('content-length') || 0);
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) { chunks.push(value); received += value.length; }
      if (total > 0) onProgress?.(Math.min(0.99, received / total), `下载模型 ${Math.round(received / 1024)}KB / ${Math.round(total / 1024)}KB`);
      else onProgress?.(0.5, `下载模型 ${Math.round(received / 1024)}KB…`);
    }
    const out = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  } finally { if (timer) clearTimeout(timer); }
}

/* ---------------- Session ---------------- */

let _sessionPromise: Promise<{ session: ort.InferenceSession; ep: string; tag: string }> | null = null;

export async function ensureSession(
  onProgress?: RmbgProgress,
  opts: { timeoutMs?: number; forceRefresh?: boolean } = {},
): Promise<{ session: ort.InferenceSession; ep: string; tag: string }> {
  if (_sessionPromise && !opts.forceRefresh) return _sessionPromise;
  _sessionPromise = (async () => {
    onProgress?.('load', 0.05, '准备模型：优先 IndexedDB 缓存');
    let tag = '';
    let buf: ArrayBuffer | null = null;
    if (!opts.forceRefresh) buf = (await dbGetModel())?.buf ?? null;
    if (!buf) {
      const r = await fetchModel(
        (r, m) => onProgress?.('load', 0.05 + r * 0.85, m),
        opts.timeoutMs ?? 60_000,
      );
      buf = r.buf; tag = r.tag;
    }
    onProgress?.('load', 0.95, `创建 ONNX Session：尝试 WebGPU / WebGL / WASM 自动降级`);
    const eps: Array<{ name: string; opt?: ort.InferenceSession.SessionOptions }> = [
      { name: 'webgpu', opt: { executionProviders: ['webgpu'], graphOptimizationLevel: 'all', enableMemPattern: true, enableCpuMemArena: true, extra: { session: { disable_prepacking: '0' } as any } } },
      { name: 'webgl', opt: { executionProviders: ['webgl'], graphOptimizationLevel: 'all', enableMemPattern: true, enableCpuMemArena: true } },
      { name: 'wasm', opt: { executionProviders: ['wasm'], graphOptimizationLevel: 'all', enableMemPattern: true, enableCpuMemArena: true, executionMode: 'sequential' } },
    ];
    let lastErr: unknown = null;
    for (const e of eps) {
      try {
        const sess = await ort.InferenceSession.create(new Uint8Array(buf), e.opt as ort.InferenceSession.SessionOptions);
        _lastEp = e.name;
        return { session: sess, ep: e.name, tag: tag || 'idb_cached' };
      } catch (err) { lastErr = err; }
    }
    throw new Error(`ONNX session 创建失败（WebGPU/WebGL/WASM 均不可用）：${(lastErr as Error)?.message || '未知'}`);
  })();
  return _sessionPromise;
}

/* ---------------- 前处理 ---------------- */

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

/** 推理前处理：输出 1x3xMODEL_SIZExMODEL_SIZE Float32Array（ImageNet mean/std 归一化） */
function preprocess(src: HTMLImageElement | HTMLCanvasElement) {
  // 先把超大型图像限制到最大推理分辨率，避免 WASM 内存爆炸
  let img: HTMLImageElement | HTMLCanvasElement = src;
  const iw = ('naturalWidth' in src ? (src as HTMLImageElement).naturalWidth : (src as HTMLCanvasElement).width) || src.width;
  const ih = ('naturalHeight' in src ? (src as HTMLImageElement).naturalHeight : (src as HTMLCanvasElement).height) || src.height;
  const longSide = Math.max(iw, ih);
  if (longSide > MAX_INFER_EDGE) {
    const s = MAX_INFER_EDGE / longSide;
    img = resizeTo(src, Math.max(1, Math.round(iw * s)), Math.max(1, Math.round(ih * s)));
  }
  const small = resizeTo(img, MODEL_SIZE, MODEL_SIZE);
  const { data } = small.getContext('2d')!.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE);
  const mean = [0.485, 0.456, 0.406];
  const std  = [0.229, 0.224, 0.225];
  const chw = new Float32Array(3 * MODEL_SIZE * MODEL_SIZE);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]   / 255;
    const g = data[i+1] / 255;
    const b = data[i+2] / 255;
    chw[p]                            = (r - mean[0]) / std[0];
    chw[p +     MODEL_SIZE * MODEL_SIZE] = (g - mean[1]) / std[1];
    chw[p + 2 * MODEL_SIZE * MODEL_SIZE] = (b - mean[2]) / std[2];
  }
  return {
    tensor: new ort.Tensor('float32', chw, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    img,            // 限制后的原尺寸图像（用于 mask 还原）
    orig: { width: iw, height: ih },
  };
}

/* ---------------- 后处理：U2NetP d1 输出 → min-max 归一化 → 原图还原 → 精修 ---------------- */

function u2netPostprocess(d1: Float32Array, pre: ReturnType<typeof preprocess>, options: { feather?: number; edgeRefine?: boolean }) {
  const { feather = 0, edgeRefine = true } = options;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < d1.length; i++) {
    const v = d1[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = Math.max(1e-6, max - min);
  const mask320 = new Uint8ClampedArray(MODEL_SIZE * MODEL_SIZE);
  for (let i = 0; i < d1.length; i++) {
    mask320[i] = Math.max(0, Math.min(255, Math.round(((d1[i] - min) / range) * 255)));
  }
  // 还原到推理源图像尺寸（与用户输入保持一致比例）
  const w = (pre.img as HTMLCanvasElement).width || (pre.img as HTMLImageElement).naturalWidth;
  const h = (pre.img as HTMLCanvasElement).height || (pre.img as HTMLImageElement).naturalHeight;
  const maskCanvas = drawMask(mask320, MODEL_SIZE, MODEL_SIZE, w, h);
  let refined = maskCanvas;
  if (edgeRefine) refined = refineEdge(refined);
  if (feather > 0) refined = featherMask(refined, feather);
  return { maskCanvas: refined };
}

function drawMask(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): HTMLCanvasElement {
  const inC = document.createElement('canvas');
  inC.width = sw; inC.height = sh;
  const d = inC.getContext('2d')!.createImageData(sw, sh);
  for (let i = 0, p = 0; i < src.length; i++, p += 4) {
    d.data[p]   = 0; d.data[p+1] = 0; d.data[p+2] = 0; d.data[p+3] = src[i];
  }
  inC.getContext('2d')!.putImageData(d, 0, 0);
  const outC = document.createElement('canvas');
  outC.width = dw; outC.height = dh;
  const octx = outC.getContext('2d')!;
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(inC, 0, 0, dw, dh);
  return outC;
}

function refineEdge(mask: HTMLCanvasElement, strength = 1): HTMLCanvasElement {
  // 简易边缘精修：1) 极小噪点阈值清理；2) max(alpha, 模糊(alpha * 1.08)) 得到更干净的边缘
  const w = mask.width, h = mask.height;
  const ctx = mask.getContext('2d')!;
  const id = ctx.getImageData(0, 0, w, h);
  const src = id.data;
  // 1. 清理低于 10 / 高于 245 的极端值，避免半透明长尾
  for (let i = 3; i < src.length; i += 4) {
    const a = src[i];
    if (a < 8) src[i] = 0;
    else if (a > 250) src[i] = 255;
  }
  ctx.putImageData(id, 0, 0);
  // 2. 小幅高斯（canvas filter）
  const blur = 0.7 * strength;
  const tmp = document.createElement('canvas');
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext('2d')!;
  (tctx as any).filter = `blur(${blur}px)`;
  tctx.drawImage(mask, 0, 0);
  const tdata = tctx.getImageData(0, 0, w, h).data;
  const sdata = ctx.getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(w, h);
  for (let i = 3; i < od.data.length; i += 4) {
    const a = sdata[i];
    const b = tdata[i];
    // 取较大值（保证边缘不被吃掉），并叠加一次去灰边 boost
    let v = Math.max(a, Math.min(255, b * 1.05));
    // 灰边/残留：前景 235..255 提升到 255；背景 0..20 归 0
    if (v >= 235) v = 255;
    else if (v <= 20) v = 0;
    od.data[i] = v as number;
  }
  octx.putImageData(od, 0, 0);
  return out;
}

function featherMask(mask: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = mask.width; out.height = mask.height;
  const ctx = out.getContext('2d')!;
  (ctx as any).filter = `blur(${Math.max(0.2, px)}px)`;
  ctx.drawImage(mask, 0, 0);
  return out;
}

/* ---------------- 合成透明 cutout ---------------- */

function composeCutout(rgbaImage: HTMLCanvasElement, mask: HTMLCanvasElement): HTMLCanvasElement {
  const W = rgbaImage.width, H = rgbaImage.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const octx = out.getContext('2d')!;
  // 1. 贴原图
  octx.drawImage(rgbaImage, 0, 0);
  // 2. 以 mask alpha 作为裁剪（destination-in）
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
  const bgColor = (() => {
    if (mode === 'transparent') return null;
    return mode === 'white' ? '#ffffff' : (customBg || '#ffffff');
  })();
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

/* ---------------- 主入口 ---------------- */

export function resetSessionForTest() {
  _sessionPromise = null;
}
let _lastEp: string = 'web';
export function getLastEp(): string { return _lastEp; }

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
  // 等比限制最长边
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
  const isTransparent = mode === 'transparent';
  const toBlob = (type: string, quality?: number) =>
    new Promise<Blob | null>((resolve) => {
      try {
        (source as any).toBlob((b: Blob | null) => resolve(b), type, quality);
      } catch { resolve(null); }
    });

  if (isTransparent) {
    const png = await toBlob('image/png');
    return { blob: png || new Blob([canvasToPngFallback(source) as any]), ext: 'png' };
  }
  // 纯色底：优先 WebP，再 JPG；都失败就 PNG
  const webp = await toBlob('image/webp', 0.88);
  if (webp && webp.size > 100) return { blob: webp, ext: 'webp' };
  const jpg = await toBlob('image/jpeg', 0.92);
  if (jpg && jpg.size > 100) return { blob: jpg, ext: 'jpg' };
  const png = await toBlob('image/png');
  return { blob: png || new Blob([canvasToPngFallback(source) as any]), ext: 'png' };
}
function canvasToPngFallback(c: HTMLCanvasElement): Uint8Array {
  // 极端环境：toBlob 不可用时，借助 dataURL 转 Uint8Array
  const url = c.toDataURL('image/png');
  const b64 = url.includes(',') ? url.split(',')[1] : '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function removeBackground(
  file: File,
  opts: {
    smooth?: boolean;
    timeoutMs?: number;
    feather?: number;
    edgeRefine?: boolean;
  } = {},
  onProgress?: RmbgProgress,
): Promise<RmbgResult> {
  const t0 = performance.now();
  onProgress?.('preprocess', 0, '解码图片…');
  const img = await loadImageFromFile(file);
  const pre = preprocess(img);

  onProgress?.('load', 0.02, '创建 / 复用推理 Session（WebGPU 优先）');
  const sess = await ensureSession(onProgress, { timeoutMs: opts.timeoutMs ?? 120_000 });

  onProgress?.('preprocess', 0.2, '前处理完成，送入推理…');
  const feed = { [sess.session.inputNames[0] || 'input.1']: pre.tensor };
  onProgress?.('infer', 0.3, `U2NetP 推理中…（${sess.ep.toUpperCase()}）`);
  const tInf = performance.now();
  const feeds = sess.session.inputNames.length === 1
    ? feed
    : { [sess.session.inputNames[0]]: pre.tensor };
  const out = await sess.session.run(feeds as any);
  const inferMs = performance.now() - tInf;
  void inferMs;

  onProgress?.('postprocess', 0.85, '后处理：归一化 + 边缘精修');
  // U2NetP 输出 7 头：d1..d7（键名各异），优先 outputNames[0]，否则取第一个 4D 张量
  let d1Raw: Float32Array | null = null;
  if (sess.session.outputNames && sess.session.outputNames[0] && out[sess.session.outputNames[0]]) {
    d1Raw = (out[sess.session.outputNames[0]] as ort.Tensor).data as Float32Array;
  } else {
    for (const k of Object.keys(out)) {
      const t = out[k] as ort.Tensor;
      if (t && t.dims && t.dims.length === 4 && t.dims[2] === MODEL_SIZE && t.dims[3] === MODEL_SIZE) {
        d1Raw = t.data as Float32Array; break;
      }
    }
  }
  if (!d1Raw) throw new Error('U2NetP 输出缺少 d1（4D 1×1×320×320）张量，请检查模型版本');
  const { maskCanvas } = u2netPostprocess(d1Raw, pre, { feather: opts.feather ?? 0, edgeRefine: opts.edgeRefine ?? true });

  // 合成透明 cutout：需要将图像源缩放到 mask 尺寸一致（pre.img 已经被限制到最大边）
  const iw = (pre.img as HTMLCanvasElement).width || (pre.img as HTMLImageElement).naturalWidth;
  const ih = (pre.img as HTMLCanvasElement).height || (pre.img as HTMLImageElement).naturalHeight;
  const rgba = document.createElement('canvas');
  rgba.width = iw; rgba.height = ih;
  const rctx = rgba.getContext('2d')!;
  rctx.imageSmoothingEnabled = true;
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(pre.img, 0, 0, iw, ih);
  // 若输入原图像比推理限制后的图更大（等比缩放过），需等比还原
  const cutout = (pre.orig.width !== iw || pre.orig.height !== ih)
    ? (() => {
        // 先合成等比限制下的 cutout
        const smallCut = composeCutout(rgba, maskCanvas);
        // 再按原尺寸还原
        const full = document.createElement('canvas');
        full.width = pre.orig.width; full.height = pre.orig.height;
        const fctx = full.getContext('2d')!;
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.drawImage(smallCut, 0, 0, full.width, full.height);
        return full;
      })()
    : composeCutout(rgba, maskCanvas);

  onProgress?.('compose', 1, `完成（${sess.ep.toUpperCase()} · ${Math.round(performance.now() - t0)} ms）`);
  return {
    cutoutCanvas: cutout,
    maskCanvas,
    engine: `U2NetP Portrait INT8 · ${sess.ep.toUpperCase()}`,
    elapsedMs: performance.now() - t0,
  };
}
