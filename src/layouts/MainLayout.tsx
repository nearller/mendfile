import { Outlet } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import SecurityBanner from '@/components/SecurityBanner';
import AdSlot from '@/components/AdSlot';
// 批次 6 · 云端增强双模式入口横幅（架构预留）
import { CloudBannerEntry } from '@/components/CloudReserve';

/**
 * 全站主布局：头部 -> 安全说明横幅 -> 主内容 -> 侧边/底部广告位 -> 页脚
 * 所有广告位均使用 <AdSlot position="xxx"/> 模块化预留，后期只需要在 AdSlot 组件内
 * 接入百度联盟/Google AdSense 代码即可，无需改动业务页面。
 * 
 * 批次 6：在安全横幅下方统一追加「云端增强模式（架构预留）」入口横幅，
 * 供用户预约/授权未来云端能力，当前不开发任何云端后台/付费功能。
 */
export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <SecurityBanner />
      {/* 批次 6 · 云端增强双模式入口（仅 UI 预留，不启用任何云端功能） */}
      <div className="page-padding max-w-7xl mx-auto w-full -mt-2 mb-4">
        <CloudBannerEntry />
      </div>
      <main className="flex-1 page-padding max-w-7xl mx-auto w-full py-4 lg:py-6 grid grid-cols-12 gap-6">
        <section className="col-span-12 lg:col-span-9 order-1 min-w-0">
          <Outlet />
        </section>
        {/* 侧边广告位：桌面端显示 */}
        <aside className="col-span-12 lg:col-span-3 order-2 space-y-6 hidden lg:block">
          <AdSlot position="sidebar-top" className="min-h-[240px]" />
          <AdSlot position="sidebar-mid" className="min-h-[280px]" />
        </aside>
      </main>
      {/* 移动端底部横幅广告 */}
      <div className="px-4 pb-4 lg:hidden">
        <AdSlot position="in-feed-mobile" className="min-h-[90px]" />
      </div>
      <SiteFooter />
    </div>
  );
}
