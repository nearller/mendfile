/**
 * 核心处理层通用类型定义
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ProgressFn = (ratio: number, message?: string) => void;

export interface ProcessInput {
  /** 上传文件列表（单个工具通常为 0..n） */
  files: File[];
  /** 用户在表单中设置的自定义参数 */
  options: Record<string, any>;
  /** 用于展示的辅助数据（如排序、旋转信息），由页面层传入 */
  extras?: Record<string, any>;
}

export interface ProcessOutput {
  /** 输出 blob，多文件时输出 ZIP */
  blob: Blob;
  /** 输出文件拓展名（不含点） */
  ext: string;
  /** 建议文件名（不含拓展名） */
  fileName: string;
  /** 可选：输出给页面的预览信息（文本、页面数、缩略图等） */
  preview?: {
    text?: string;
    pageCount?: number;
    thumbnails?: string[]; // dataUrl
    stats?: Record<string, any>;
  };
}

export type ProcessFn<
  TInput extends ProcessInput = ProcessInput,
  TOutput extends ProcessOutput = ProcessOutput
> = (input: TInput, onProgress: ProgressFn, abortSignal?: AbortSignal) => Promise<TOutput>;
