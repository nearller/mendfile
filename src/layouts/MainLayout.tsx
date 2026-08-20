import { Outlet } from 'react-router-dom';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import SecurityBanner from '@/components/SecurityBanner';
import AdSlot from '@/components/AdSlot';

/**
 * 全站主布局：头部 -> 安全说明横幅 -> 主内容 -> 侧边/底部广告位 -> 页脚
 * 所有广告位均使用 <AdSlot position="xxx"/> 模块化预留，后期只需要在 AdSlot 组件内
 * 接入百度联盟/Google AdSense 代码即可，无需改动业务页面。
 */
export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <SecurityBanner />
      <main className="flex-1 page-padding max-w-7xl mx-auto w-full py-6 lg:py-8 grid grid-cols-12 gap-6">
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
