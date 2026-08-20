import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';
import HomePage from '@/pages/HomePage';
import ToolPageTemplate from '@/pages/ToolPageTemplate';
import DisclaimerPage from '@/pages/DisclaimerPage';
import PrivacyPage from '@/pages/PrivacyPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { TOOL_ROUTES, TOOLS_CONFIG } from '@/config/tools';

/**
 * 全站路由：所有功能落地页使用统一 ToolPageTemplate + 独立 ToolKey 配置实现，
 * 方便后续任意拓展二维码、长图、图片编辑等工具。
 */
export default function App() {
  return (
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
  );
}
