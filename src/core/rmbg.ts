/**
 * RMBG-2.0 (BiRefNet) 高精度前端 AI 抠图模块
 * ------------------------------------------------
 * 纯前端本地推理，图片数据永远不出设备：
 *   - 推理引擎：ONNX Runtime Web（WebGPU 优先 → WebGL → WASM 自动降级）
 *   - 模型来源：HuggingFace CDN，使用 IndexedDB 永久缓存，无需二次下载
 *   - 模型规格：RMBG-2.0 onnx / briaai/RMBG-2.0（输入 1x3x1024x1024，输出 1x1x1024x1024 浮点 mask）
 *
 * 外部唯一入口：
 *   `removeBackground(file, opts, onProgress)` → 返回 { file, canvas, mask, dataUrl, blob }
 *
 * 注意：若运行环境无网络下载模型或 IndexedDB 失败，则抛出可读错误，调用方可
 *       切回纯 Flood Fill 容差法作为兜底，保证工具在任何环境都可用。
 */
import * as ort from 'onnxruntime-web';

export type RmbgProgress = (ratio: number, message: string) => void;

export interface RmbgResult {
  /** 原文件名 */
  name: string;
  /** 原图信息 */
  original: { width: number; height: number };
  /** 推理尺寸（通常 1024） */
  inferenceSize: number;
  /** 输出结果：带 Alpha 通道的原图尺寸 Canvas（透明=抠完未叠底，可直接叠底渲染） */
  cutoutCanvas: HTMLCanvasElement;
}

// =========================================================
//  常量
// =========================================================
const MODEL_URL =
  'https://huggingface.co/briaai/RMBG-2.0/resolve/main/onnx/model.onnx?download=true';
const MODEL_SIZE_HINT = '约 176 MB';
const INFER_SIZE = 1024;
const DB_NAME = 'mendfile_ai_cache';
const DB_VERSION = 1;
const STORE_NAME = 'models';
const MODEL_KEY = 'rmbg_2_0_onnx_v1';

// 全局惰性 session，页面多次调用复用
let sessionPromise: Promise<ort.InferenceSession> | null = null;
let lastEp: string | null = null;

// =========================================================
//  IndexedDB 模型缓存（避免每次打开都从 HuggingFace 重下 176MB）
// =========================================================
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME); // keyPath 不固定，用 put(blob, key)
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    } catch (e) {
      reject(e);
    }
  });
}
async function readCache(): Promise<ArrayBuffer | null> {
  try {
    const db = await openIDB();
    return await new Promise<ArrayBuffer | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(MODEL_KEY);
      req.onsuccess = () => {
        const v = req.result as ArrayBuffer | Blob | undefined;
        if (!v) resolve(null);
        else if (v instanceof ArrayBuffer) resolve(v);
        else if (v instanceof Blob) {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result as ArrayBuffer);
          fr.onerror = () => reject(fr.error);
          fr.readAsArrayBuffer(v);
        } else resolve(null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
async function writeCache(buf: ArrayBuffer, onProgress?: RmbgProgress): Promise<void> {
  try {
    const db = await openIDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(buf, MODEL_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    onProgress?.(0.55, '模型已缓存到本地，下次打开秒级加载');
  } catch {
    // 缓存写入失败（隐身模式等）不阻塞主流程
    onProgress?.(0.55, '模型缓存被浏览器限制（可能隐身模式），不影响本次使用');
  }
}

// =========================================================
//  模型下载（带进度）+ 缓存回读
// =========================================================
async function downloadModel(onProgress?: RmbgProgress): Promise<ArrayBuffer> {
  // 1. 先尝试读 IndexedDB 缓存
  onProgress?.(0.05, '检查本地模型缓存…');
  const cached = await readCache();
  if (cached && cached.byteLength > 10 * 1024 * 1024) {
    onProgress?.(0.5, `从本地 IndexedDB 读取模型成功（${(cached.byteLength / 1024 / 1024).toFixed(1)} MB）`);
    return cached;
  }

  // 2. 无缓存则从 HuggingFace 流式下载，带进度
  onProgress?.(0.1, `正在下载 RMBG-2.0 高精度抠图模型（${MODEL_SIZE_HINT}），仅首次需要…`);
  const res = await fetch(MODEL_URL, { mode: 'cors' });
  if (!res.ok || !res.body) throw new Error(`模型下载失败：HTTP ${res.status}（请检查网络或放开 HuggingFace CDN）`);

  const totalHint = Number(res.headers.get('content-length') || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value!);
    received += value!.length;
    const r = totalHint
      ? 0.1 + 0.4 * Math.min(1, received / totalHint)
      : 0.1 + 0.4 * Math.min(1, received / 180_000_000);
    onProgress?.(r, `下载模型：${(received / 1024 / 1024).toFixed(1)} / ${totalHint ? (totalHint / 1024 / 1024).toFixed(1) + ' MB' : '约 ' + MODEL_SIZE_HINT}`);
  }
  const ab = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { ab.set(c, off); off += c.length; }
  const finalBuf = ab.buffer.slice(ab.byteOffset, ab.byteOffset + ab.byteLength) as ArrayBuffer;

  // 3. 写回缓存（异步，不阻塞返回）
  void writeCache(finalBuf, onProgress);
  return finalBuf;
}

// =========================================================
//  ONNX Runtime 执行提供器优先级：WebGPU > WebGL > WASM
//  自动降级：逐个尝试 create。
// =========================================================
async function createSession(model: ArrayBuffer, onProgress?: RmbgProgress): Promise<ort.InferenceSession> {
  const eps: { name: string; label: string }[] = [
    { name: 'webgpu', label: 'WebGPU（加速）' },
    { name: 'webgl', label: 'WebGL（兼容）' },
    { name: 'wasm', label: 'WASM（兜底）' },
  ];

  // ort 全局配置：WASM 使用 CDN 资源，避免本地打包路径
  try {
    (ort.env as any).wasm = (ort.env as any).wasm || {};
    (ort.env as any).wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/';
    (ort.env as any).wasm.numThreads = Math.min(4, (navigator as any).hardwareConcurrency || 1);
    (ort.env as any).wasm.simd = true;
    (ort.env as any).logLevel = 'warning';
  } catch { /* ignore */ }

  for (const ep of eps) {
    try {
      onProgress?.(0.62, `加载推理引擎 ${ep.label}…`);
      const session = await ort.InferenceSession.create(model, {
        executionProviders: [ep.name as any],
        graphOptimizationLevel: 'all',
      } as ort.InferenceSession.SessionOptions);
      lastEp = ep.label;
      onProgress?.(0.7, `✅ 模型加载完成：推理引擎 = ${ep.label}`);
      return session;
    } catch (err) {
      onProgress?.(0.62, `⚠️ ${ep.label} 不可用，尝试下一个：${(err as Error).message.slice(0, 60)}`);
    }
  }
  throw new Error('ONNX Runtime 初始化失败：WebGPU / WebGL / WASM 均不可用');
}

async function getSession(onProgress?: RmbgProgress): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const buf = await downloadModel(onProgress);
      return createSession(buf, onProgress);
    })();
  }
  return sessionPromise.catch((err) => {
    sessionPromise = null; // 允许重试
    throw err;
  });
}
export function resetSessionForTest() {
  sessionPromise = null;
  lastEp = null;
}
export function getLastEp() { return lastEp; }

// =========================================================
//  前处理：原始图像 → 1x3x1024x1024 Float32 归一化
// =========================================================
interface PrepOut {
  tensor: ort.Tensor;
  origW: number;
  origH: number;
  scaleCanvas: HTMLCanvasElement; // 1024x1024（等比缩放 + 0.5 灰边填充）
  padL: number; padT: number; sw: number; sh: number; // 真实内容位置（用于后处理裁剪回原比例）
}
function preprocess(img: HTMLImageElement): PrepOut {
  // 等比缩放到 1024，空白处填 128 灰（BiRefNet/RMBG 通常以 1024 输入为准）
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.min(INFER_SIZE / iw, INFER_SIZE / ih);
  const sw = Math.max(1, Math.round(iw * scale));
  const sh = Math.max(1, Math.round(ih * scale));
  const padL = Math.floor((INFER_SIZE - sw) / 2);
  const padT = Math.floor((INFER_SIZE - sh) / 2);

  const c = document.createElement('canvas');
  c.width = INFER_SIZE; c.height = INFER_SIZE;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, INFER_SIZE, INFER_SIZE);
  ctx.drawImage(img, padL, padT, sw, sh);

  const imgData = ctx.getImageData(0, 0, INFER_SIZE, INFER_SIZE);
  const d = imgData.data;
  const out = new Float32Array(INFER_SIZE * INFER_SIZE * 3);
  // BiRefNet / RMBG 预处理：pixel/255，mean=[0.485,0.456,0.406]，std=[0.229,0.224,0.225]，RGB 顺序 NCHW
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  for (let y = 0; y < INFER_SIZE; y++) {
    for (let x = 0; x < INFER_SIZE; x++) {
      const i = (y * INFER_SIZE + x) * 4;
      const r = d[i] / 255;
      const g = d[i + 1] / 255;
      const b = d[i + 2] / 255;
      const ohw = y * INFER_SIZE + x;
      out[0 * INFER_SIZE * INFER_SIZE + ohw] = (r - mean[0]) / std[0];
      out[1 * INFER_SIZE * INFER_SIZE + ohw] = (g - mean[1]) / std[1];
      out[2 * INFER_SIZE * INFER_SIZE + ohw] = (b - mean[2]) / std[2];
    }
  }
  const tensor = new ort.Tensor('float32', out, [1, 3, INFER_SIZE, INFER_SIZE]);
  return { tensor, origW: iw, origH: ih, scaleCanvas: c, padL, padT, sw, sh };
}

// =========================================================
//  推理
// =========================================================
async function infer(session: ort.InferenceSession, tensor: ort.Tensor, onProgress?: RmbgProgress): Promise<Float32Array> {
  onProgress?.(0.75, 'AI 模型推理中…');
  const inputName = Object.keys(session.inputNames)[0];
  const out: ort.InferenceSession.OnnxValueMapType = await session.run({ [inputName]: tensor });
  const keys = Object.keys(out);
  let maskTensor: ort.Tensor | undefined;
  for (const k of keys) {
    const t = out[k] as ort.Tensor;
    if (t && t.dims && (t.dims.length === 3 || t.dims.length === 4)) { maskTensor = t; break; }
  }
  if (!maskTensor) throw new Error('模型输出格式异常：未找到 mask 张量');
  const data = maskTensor.data as Float32Array;
  // 无论 CHW 或 1CHW，都压成 [H*W]
  return new Float32Array(data);
}

// =========================================================
//  后处理：1024 mask → 原图尺寸 Alpha，合成原始尺寸 cutout（透明）
// =========================================================
function postprocess(mask1024: Float32Array, prep: PrepOut, extraSmooth = true): HTMLCanvasElement {
  const { origW, origH, padL, padT, sw, sh } = prep;
  // 1. 把 mask 放到 1024 Canvas，便于缩放到原尺寸
  const mc = document.createElement('canvas');
  mc.width = INFER_SIZE; mc.height = INFER_SIZE;
  const mctx = mc.getContext('2d')!;
  const mImg = mctx.createImageData(INFER_SIZE, INFER_SIZE);
  const md = mImg.data;
  for (let i = 0; i < INFER_SIZE * INFER_SIZE; i++) {
    const raw = mask1024[i];
    // sigmoid
    const v = 1 / (1 + Math.exp(-raw));
    const a = Math.max(0, Math.min(1, v));
    md[i * 4] = 255;
    md[i * 4 + 1] = 255;
    md[i * 4 + 2] = 255;
    md[i * 4 + 3] = Math.round(a * 255);
  }
  mctx.putImageData(mImg, 0, 0);

  // 2. 缩放到原图尺寸（仅裁剪原 pad 区域）
  const oc = document.createElement('canvas');
  oc.width = origW; oc.height = origH;
  const octx = oc.getContext('2d')!;
  if (extraSmooth) octx.imageSmoothingEnabled = true;
  // 裁剪掉填充部分
  octx.drawImage(mc, padL, padT, sw, sh, 0, 0, origW, origH);

  // 3. 读取 alpha，与原图合成 → 结果为 cutout（透明 PNG）
  const alphaData = octx.getImageData(0, 0, origW, origH);

  const origCanvas = document.createElement('canvas');
  origCanvas.width = origW; origCanvas.height = origH;
  const octx2 = origCanvas.getContext('2d')!;
  // 为了避免外部依赖，这里构造一个临时 img 不太方便，
  // 直接在 prep.scaleCanvas 上把原图再重新绘制到 origCanvas 尺寸会更简单：
  // 我们在 removeBackground 里已经有原图，稍后在那里重绘。这里我们先仅返回 alpha 到单独结构不合适。
  // 更清晰的做法：postprocess 返回 alpha mask（Uint8ClampedArray）+ 尺寸。
  void alphaData;
  void origCanvas;
  void octx2;

  // 简化：直接返回只含 alpha 的 mask canvas（已缩放到原尺寸）
  return oc;
}

// =========================================================
//  公开 API：单张图片 → 抠完透明 Canvas
// =========================================================
export async function removeBackground(
  file: File,
  opts: { smooth?: boolean; timeoutMs?: number } = {},
  onProgress?: RmbgProgress
): Promise<RmbgResult> {
  onProgress?.(0.01, '加载图像…');
  // 0. 读取图像
  const fr = new FileReader();
  const dataUrl: string = await new Promise((resolve, reject) => {
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error || new Error('图像读取失败'));
    fr.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('图像解码失败'));
    img.src = dataUrl;
  });

  // 1. 获取 ONNX session（首次加载模型，IndexedDB 缓存）
  onProgress?.(0.03, '初始化 AI 模型…');
  const session = await getSession(onProgress);

  // 2. 前处理
  onProgress?.(0.72, '图像预处理…');
  const prep = preprocess(img);

  // 3. 推理
  const mask1024 = await infer(session, prep.tensor, onProgress);

  // 4. 后处理：mask → 原尺寸 alpha canvas
  onProgress?.(0.92, '精细后处理：边缘平滑 + 合成原图尺寸');
  const maskCanvas = postprocess(mask1024, prep, opts.smooth !== false);

  // 5. 合成最终 cutout：原图 + alpha（globalCompositeOperation = 'destination-in' 最直接）
  const final = document.createElement('canvas');
  final.width = prep.origW;
  final.height = prep.origH;
  const fctx = final.getContext('2d')!;
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(img, 0, 0, prep.origW, prep.origH);
  // 用 destination-in：保留已有像素，被 mask alpha 相乘（反过来写 alpha）
  fctx.globalCompositeOperation = 'destination-in';
  fctx.drawImage(maskCanvas, 0, 0);
  fctx.globalCompositeOperation = 'source-over';

  onProgress?.(0.99, '抠图完成');

  return {
    name: file.name,
    original: { width: prep.origW, height: prep.origH },
    inferenceSize: INFER_SIZE,
    cutoutCanvas: final,
  };
}

/** 在 cutout（透明）Canvas 上叠加指定背景色（或透明），返回新 Canvas */
export function flattenCutout(cutout: HTMLCanvasElement, bgMode: 'transparent' | 'white' | 'custom', custom = '#ffffff'): HTMLCanvasElement {
  const { width, height } = cutout;
  const out = document.createElement('canvas');
  out.width = width; out.height = height;
  const c = out.getContext('2d')!;
  if (bgMode !== 'transparent') {
    c.fillStyle = bgMode === 'white' ? '#ffffff' : custom;
    c.fillRect(0, 0, width, height);
  }
  c.drawImage(cutout, 0, 0);
  return out;
}

/** Canvas → 智能压缩 Blob（根据背景模式选择最优格式） */
export async function compressCutoutBlob(flat: HTMLCanvasElement, bgMode: 'transparent' | 'white' | 'custom', maxLongEdge = 2400): Promise<{ blob: Blob; ext: 'png' | 'jpg' | 'webp' }> {
  const { width, height } = flat;
  // 超大型图：先等比缩到 maxLong 以内，平衡画质与体积
  let src = flat;
  let resizeTmp: HTMLCanvasElement | null = null;
  if (Math.max(width, height) > maxLongEdge) {
    const s = maxLongEdge / Math.max(width, height);
    const w = Math.round(width * s);
    const h = Math.round(height * s);
    resizeTmp = document.createElement('canvas');
    resizeTmp.width = w; resizeTmp.height = h;
    const rctx = resizeTmp.getContext('2d')!;
    rctx.imageSmoothingEnabled = true;
    rctx.imageSmoothingQuality = 'high';
    rctx.drawImage(flat, 0, 0, w, h);
    src = resizeTmp;
  }

  const isOpaque = bgMode !== 'transparent';
  let blob: Blob;
  let ext: 'png' | 'jpg' | 'webp' = 'png';

  if (isOpaque) {
    // 有底色优先 JPG（文件更小）
    blob = await new Promise<Blob>((resolve, reject) =>
      src.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('JPG 编码失败'))),
        'image/jpeg',
        0.92
      )
    );
    ext = 'jpg';
    // 若 JPG 异常偏大（罕见），退回 PNG
    const pngBlob = await new Promise<Blob>((resolve, reject) =>
      src.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png')
    );
    if (pngBlob.size * 0.9 < blob.size) { blob = pngBlob; ext = 'png'; }
  } else {
    // 透明图：先尝试 WebP 无损
    blob = await new Promise<Blob>((resolve, reject) =>
      src.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 编码失败'))), 'image/png')
    );
    try {
      const webp = await new Promise<Blob | null>((resolve) =>
        src.toBlob((b) => resolve(b), 'image/webp', 1.0)
      );
      if (webp && webp.size < blob.size * 0.75) { blob = webp; ext = 'webp'; }
    } catch { /* ignore */ }
  }
  return { blob, ext };
}
