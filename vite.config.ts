import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Vite 配置：React + TS + Tailwind
// 构建产物直接可部署至任意静态托管（Nginx / Vercel / Netlify / GitHub Pages / OSS）
const __dirname = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // 关键：@excalidraw/excalidraw（CJS 构建）会访问 process.env.NODE_ENV / process.env.IS_PREACT
  // Vite 本身只做字面量替换，不会创建全局 process；这里提前替换为字符串常量 + 与 index.html 的 window.process 兜底一起，
  // 保证 "process is not defined" 的 ReferenceError 不再发生。
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.IS_PREACT': JSON.stringify('false'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 核心库按功能拆分包，加速首屏加载
        manualChunks: {
          pdf: ['pdf-lib', 'pdfjs-dist'],
          excalidraw: ['@excalidraw/excalidraw'],
          utils: ['jszip', 'file-saver'],
          router: ['react-router-dom', 'react-helmet-async'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
}));
