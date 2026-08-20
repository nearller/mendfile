/**
 * pdfjs-dist 初始化：为了本地离线可跑，这里使用官方推荐的标准 worker 内联构建方式，
 * 避免 3.x 版本使用过程中需要手动部署 worker 文件
 */
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore: rollup/vite 自动通过 worker entry 打包
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';

(pdfjsLib as any).GlobalWorkerOptions.workerSrc = PdfWorker;

export { pdfjsLib };
