import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import HomePage from '@/pages/HomePage';
import ToolPageTemplate from '@/pages/ToolPageTemplate';
import DisclaimerPage from '@/pages/DisclaimerPage';
import PrivacyPage from '@/pages/PrivacyPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { TOOL_ROUTES, TOOLS_CONFIG } from '@/config/tools';
// 批次 6 · 云端增强双模式 Provider + 全局弹窗（架构预留，不启用真实云端逻辑）
import { CloudModeProvider, CloudReserveModal } from '@/components/CloudReserve';

/**
 * 全站路由：所有功能落地页使用统一 ToolPageTemplate + 独立 ToolKey 配置实现，
 * 方便后续任意拓展二维码、长图、图片编辑等工具。
 * 云端增强模式为架构预留，仅包含弹窗/授权勾选/页面提示结构，未开发任何云端或付费功能。
 */
export default function App() {
  return (
    <CloudModeProvider>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          {TOOL_ROUTES.map((r) => (
            <Route
              key={r.key}
              path={r.path}
              element={<ToolPageTemplate toolKey={r.key} config={TOOLS_CONFIG[r.key]} />}
            />
          ))}
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Route>
      </Routes>
      {/* 全局云端授权弹窗（默认关闭，由入口 Banner/按钮触发打开）—— 批次 6 架构预留 */}
      <CloudReserveModal />
    </CloudModeProvider>
  );
}
