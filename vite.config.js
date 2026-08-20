import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
// Vite 配置：React + TS + Tailwind
// 构建产物直接可部署至任意静态托管（Nginx / Vercel / Netlify / GitHub Pages / OSS）
var __dirname = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
    plugins: [react()],
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
});
