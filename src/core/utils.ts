/**
 * 通用工具函数：文件读取、大小格式化、文件名处理、canvas辅助、sleep
 */

export function formatBytes(bytes: number, decimals = 2): string {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function readAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error || new Error('文件读取失败'));
    fr.readAsArrayBuffer(file);
  });
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error || new Error('文件读取失败'));
    fr.readAsDataURL(file);
  });
}

export function readAsText(file: Blob, encoding = 'utf-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error || new Error('文件读取失败'));
    fr.readAsText(file, encoding);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 把文件名中的扩展名去掉 */
export function stripExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.substring(0, idx) : name;
}

/** 生成一个安全的输出文件名（去除特殊字符） */
export function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'output';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/** 加载图片到 HTMLImageElement */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}

/** Canvas -> Blob */
export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('canvas 转 blob 失败'));
      },
      type,
      quality
    );
  });
}

/**
 * 生成指定页的缩略图（基于 pdfjs）
 * 不放到每个处理器内部，避免重复代码
 */
export async function generatePdfThumbnail(
  pdfDoc: any,
  pageIndex = 0,
  maxSize = 220
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(maxSize / viewport.width, maxSize / viewport.height, 1.5);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = vp.width * ratio;
    canvas.height = vp.height * ratio;
    canvas.style.width = vp.width + 'px';
    canvas.style.height = vp.height + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (e) {
    // 缩略图生成失败不阻塞主流程
    return '';
  }
}
