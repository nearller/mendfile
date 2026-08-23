/**
 * 流程图 / 平面图 / 时序图 · 核心导入导出工具
 * 基于 @excalidraw/excalidraw 统一封装，纯前端本地处理，不依赖任何云端服务。
 *
 * 能力：
 *   - saveDiagramJson / loadDiagramJson：本地保存工程 JSON / 从 JSON 文件导入
 *   - exportToPng / exportToJpg / exportToSvg：导出图片格式
 *   - exportToPdf：将画布导出为 PDF（canvas 渲染 -> PDF 嵌入图片，保证所见即所得）
 */
import {
  exportToBlob as excalidrawExportToBlob,
  exportToSvg as excalidrawExportToSvg,
  serializeAsJSON as excalidrawSerializeAsJSON,
  restore as excalidrawRestore,
} from '@excalidraw/excalidraw';
import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from '@excalidraw/excalidraw/types/element/types';
import type { AppState as ExcalidrawAppState, BinaryFiles } from '@excalidraw/excalidraw/types/types';
import { downloadBlob, readAsText } from './utils';
import { PDFDocument, StandardFonts, PageSizes, rgb } from 'pdf-lib';

/** 组件 ref 的最小接口（不引用 excalidraw 内部导出） */
export interface ExcalidrawRefAPI {
  getSceneElements: () => readonly ExcalidrawElement[];
  getAppState: () => Partial<ExcalidrawAppState>;
  getFiles?: () => BinaryFiles | null | undefined;
  updateScene: (opts: any) => void;
  resetScene: (opts?: any) => void;
  setActiveTool: (tool: any) => void;
  clearSelection: () => void;
}

export type DiagramScene = {
  elements: NonDeletedExcalidrawElement[];
  appState: Partial<ExcalidrawAppState>;
  files: BinaryFiles;
};

/** 草稿本地存储 key：按工具 key 区分，不互串 */
const DRAFT_KEY = (toolKey: string) => `mendfile_diagram_${toolKey}_draft_v1`;

/**
 * 将当前 Excalidraw 组件实例保存为 JSON 文件下载
 */
export async function saveDiagramJson(
  toolKey: string,
  api: ExcalidrawRefAPI,
  suggestedName = 'MendFile_设计图工程',
): Promise<void> {
  const elements = Array.from(api.getSceneElements()) as NonDeletedExcalidrawElement[];
  const appState = api.getAppState() || {};
  const files = (api.getFiles?.() ?? {}) as BinaryFiles;
  const json = excalidrawSerializeAsJSON(
    elements as readonly ExcalidrawElement[],
    appState as Partial<ExcalidrawAppState>,
    (files || {}) as BinaryFiles,
    'local',
  );
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${suggestedName || toolKey}.json`);
}

/**
 * 读取用户上传的 .json 文件并恢复到 Excalidraw 组件
 */
export async function loadDiagramJson(file: File): Promise<DiagramScene> {
  const text = await readAsText(file);
  try {
    const data = JSON.parse(text);
    const restored = await excalidrawRestore(
      data,
      null,
      null,
      { repairBindings: true, refreshDimensions: true },
    );
    return {
      elements: Array.from(restored.elements || []) as NonDeletedExcalidrawElement[],
      appState: (restored.appState || {}) as Partial<ExcalidrawAppState>,
      files: (restored.files || {}) as BinaryFiles,
    };
  } catch (err) {
    throw new Error(`不是合法的工程文件：${(err as Error).message}`);
  }
}

/**
 * 草稿：写入 localStorage（供用户误关页后自动恢复）
 */
export function saveDiagramDraft(toolKey: string, api: ExcalidrawRefAPI): void {
  try {
    const elements = Array.from(api.getSceneElements()) as NonDeletedExcalidrawElement[];
    const appState = api.getAppState() || {};
    const files = (api.getFiles?.() ?? {}) as BinaryFiles;
    const json = excalidrawSerializeAsJSON(
      elements as readonly ExcalidrawElement[],
      appState as Partial<ExcalidrawAppState>,
      (files || {}) as BinaryFiles,
      'local',
    );
    localStorage.setItem(DRAFT_KEY(toolKey), json);
  } catch {
    /* localStorage 写满或禁用时静默失败 */
  }
}

/**
 * 草稿：从 localStorage 读取
 */
export async function loadDiagramDraft(toolKey: string): Promise<DiagramScene | null> {
  const raw = localStorage.getItem(DRAFT_KEY(toolKey));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const restored = await excalidrawRestore(
      data,
      null,
      null,
      { repairBindings: true, refreshDimensions: true },
    );
    return {
      elements: Array.from(restored.elements || []) as NonDeletedExcalidrawElement[],
      appState: (restored.appState || {}) as Partial<ExcalidrawAppState>,
      files: (restored.files || {}) as BinaryFiles,
    };
  } catch {
    localStorage.removeItem(DRAFT_KEY(toolKey));
    return null;
  }
}

export function clearDiagramDraft(toolKey: string): void {
  localStorage.removeItem(DRAFT_KEY(toolKey));
}

/** 导出 PNG/JPG（直接下载） */
export async function exportDiagramImage(
  format: 'png' | 'jpeg' | 'jpg',
  api: ExcalidrawRefAPI,
  suggestedName = 'MendFile_设计图',
  scale = 2,
  quality = 0.92,
): Promise<void> {
  const elements = Array.from(api.getSceneElements()) as NonDeletedExcalidrawElement[];
  const appState = api.getAppState() || {};
  const files = ((api.getFiles?.() ?? {}) || null) as BinaryFiles | null;
  const ext = format === 'jpg' ? 'jpg' : format;
  const mimeType: 'image/png' | 'image/jpeg' = ext === 'png' ? 'image/png' : 'image/jpeg';
  const blob = await excalidrawExportToBlob({
    elements,
    appState,
    files,
    mimeType,
    quality: mimeType === 'image/jpeg' ? quality : undefined,
    scale,
    exportPadding: 24,
  } as any);
  downloadBlob(blob, `${suggestedName}.${ext}`);
}

/** 导出 SVG（直接下载） */
export async function exportDiagramSvg(
  api: ExcalidrawRefAPI,
  suggestedName = 'MendFile_设计图',
): Promise<void> {
  const elements = Array.from(api.getSceneElements()) as NonDeletedExcalidrawElement[];
  const appState = api.getAppState() || {};
  const files = ((api.getFiles?.() ?? {}) || null) as BinaryFiles | null;
  const svg = await excalidrawExportToSvg({
    elements,
    appState,
    files,
    exportPadding: 20,
  } as any);
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob(
    [`<?xml version="1.0" encoding="UTF-8"?>\n${xml}`],
    { type: 'image/svg+xml;charset=utf-8' },
  );
  downloadBlob(blob, `${suggestedName}.svg`);
}

/**
 * 导出 PDF：
 *  1) Excalidraw exportToBlob 导出高清 PNG（scale=2）
 *  2) pdf-lib 新建按图尺寸匹配的单页 PDF，嵌入 PNG
 */
export async function exportDiagramPdf(
  api: ExcalidrawRefAPI,
  suggestedName = 'MendFile_设计图',
): Promise<void> {
  const elements = Array.from(api.getSceneElements()) as NonDeletedExcalidrawElement[];
  const appState = api.getAppState() || {};
  const files = ((api.getFiles?.() ?? {}) || null) as BinaryFiles | null;
  const pngBlob = await excalidrawExportToBlob({
    elements,
    appState,
    files,
    mimeType: 'image/png',
    scale: 2,
    exportPadding: 24,
  } as any);
  const pngBuffer = await pngBlob.arrayBuffer();
  const pngU8 = new Uint8Array(pngBuffer);

  // 计算图片像素尺寸，PDF 按 72dpi 匹配
  const imgEl = new Image();
  imgEl.src = URL.createObjectURL(pngBlob);
  await new Promise<void>((resolve, reject) => {
    imgEl.onload = () => resolve();
    imgEl.onerror = () => reject(new Error('图像解码失败'));
  });
  const width = imgEl.naturalWidth;
  const height = imgEl.naturalHeight;
  URL.revokeObjectURL(imgEl.src);

  const maxPageW = PageSizes.A4[0]; // 595 pt
  const pageScale = Math.min(1, maxPageW / width);
  const pageW = Math.max(36, Math.round(width * pageScale));
  const pageH = Math.max(36, Math.round(height * pageScale));

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([pageW, pageH]);
  const pngImage = await pdfDoc.embedPng(pngU8);
  page.drawImage(pngImage, {
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
  });

  // 页脚小字（可选）：注明来自 MendFile
  try {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    page.drawText('MendFile · mendfile.com / mendfile.cn · 全程本地处理，文件不离开您的设备', {
      x: 12,
      y: 8,
      font,
      size: 8,
      color: rgb(120 / 255, 120 / 255, 120 / 255),
    });
  } catch {
    /* 字体嵌入失败静默跳过，不影响主 PDF */
  }

  const pdfBytes = await pdfDoc.save();
  // pdf-lib 返回 Uint8Array 实际基于普通 ArrayBuffer；`as any` 绕开 TS 对 SharedArrayBuffer 的严格检查
  const pdfBlob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  downloadBlob(pdfBlob, `${suggestedName}.pdf`);
}
