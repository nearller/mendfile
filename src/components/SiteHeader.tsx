import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { CATEGORY_META, TOOLS_CONFIG } from '@/config/tools';

/**
 * 全站统一顶部：品牌 Logo + 主导航（首页 / PDF工具分类 / 合规）
 * 移动端：折叠菜单
 */
export default function SiteHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [showInstallTip, setShowInstallTip] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    // 首次进入，提示添加到收藏/桌面快捷方式（仅一次，使用 sessionStorage，不持久化打扰用户）
    if (!sessionStorage.getItem('mf_install_tip_seen')) {
      const t = setTimeout(() => setShowInstallTip(true), 3500);
      return () => clearTimeout(t);
    }
  }, []);

  const links = [
    { label: '首页', to: '/' },
    { label: 'PDF工具分类', submenu: true },
    { label: '免责声明', to: '/disclaimer' },
    { label: '隐私说明', to: '/privacy' },
  ];

  const pdfList = Object.values(TOOLS_CONFIG).filter((t) => t.category !== 'qr' && t.category !== 'image');

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-7xl mx-auto page-padding flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-extrabold shadow-card">
            M
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-800 text-lg group-hover:text-brand-700 transition">
              MendFile
            </div>
            <div className="text-[10px] sm:text-xs text-slate-500">全能办公工具 · 本地安全处理</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
          {links.map((l) =>
            l.submenu ? (
              <div key="menu-pdf" className="relative group/pdf">
                <button className="hover:text-brand-600 inline-flex items-center gap-1 py-2">
                  PDF工具
                  <span className="text-xs">▾</span>
                </button>
                <div className="absolute right-0 top-full pt-2 opacity-0 invisible group-hover/pdf:opacity-100 group-hover/pdf:visible transition-all duration-200 w-[720px] max-w-[90vw]">
                  <div className="card p-5 grid grid-cols-3 gap-4">
                    {(Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[])
                      .filter((c) => c !== 'qr' && c !== 'image')
                      .map((c) => (
                        <div key={c}>
                          <div className={`text-xs px-2 py-1 rounded-full inline-block text-white bg-gradient-to-r ${CATEGORY_META[c].color}`}>
                            {CATEGORY_META[c].name}
                          </div>
                          <div className="mt-2 space-y-1.5">
                            {pdfList
                              .filter((t) => t.category === c)
                              .map((t) => (
                                <Link
                                  key={t.key}
                                  to={t.path}
                                  className="block text-sm text-slate-700 hover:text-brand-600 hover:bg-slate-50 rounded px-2 py-1"
                                >
                                  <span className="mr-1">{t.icon}</span>
                                  {t.name}
                                </Link>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <Link key={l.to} to={l.to!} className="hover:text-brand-600 py-2">
                {l.label}
              </Link>
            )
          )}
          <a
            href="https://mendfile.com"
            className="hidden lg:inline-flex btn-secondary !py-1.5"
            target="_blank"
            rel="noreferrer noopener"
          >
            官方域名 mendfile.com
          </a>
        </nav>

        <button
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600"
          onClick={() => setOpen((o) => !o)}
          aria-label="菜单"
        >
          {open ? '✕' : '☰'}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-slate-100 bg-white">
          <div className="px-4 py-3 space-y-2 text-sm">
            {links
              .filter((l) => !l.submenu)
              .map((l) => (
                <Link key={l.to} to={l.to!} className="block py-2 text-slate-700">
                  {l.label}
                </Link>
              ))}
            <div className="pt-2 border-t border-slate-100 text-slate-500 text-xs">PDF 工具</div>
            {pdfList.map((t) => (
              <Link key={t.key} to={t.path} className="block py-1.5 text-slate-700">
                <span className="mr-1">{t.icon}</span>
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {showInstallTip && (
        <div className="bg-amber-50 border-b border-amber-100 text-amber-900 text-xs sm:text-sm px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex-1">
            🌟 收藏本站，下次办公更高效！按{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-amber-200">Ctrl/⌘ + D</kbd> 添加到收藏夹；
            移动端可选择「添加到主屏幕」创建桌面快捷方式。
          </div>
          <button
            className="shrink-0 text-amber-700 hover:text-amber-900"
            onClick={() => {
              setShowInstallTip(false);
              try { sessionStorage.setItem('mf_install_tip_seen', '1'); } catch { /* ignore */ }
            }}
          >
            知道了
          </button>
        </div>
      )}
    </header>
  );
}
