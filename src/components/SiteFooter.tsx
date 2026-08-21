import { Link } from 'react-router-dom';
import AdSlot from './AdSlot';
import { CATEGORY_META, TOOLS_CONFIG } from '@/config/tools';

export default function SiteFooter() {
  const grouped = Object.keys(CATEGORY_META).map((c) => ({
    key: c,
    name: CATEGORY_META[c as keyof typeof CATEGORY_META].name,
    tools: Object.values(TOOLS_CONFIG).filter((t) => t.category === c),
  }));

  return (
    <footer className="mt-10 border-t border-slate-100 bg-white">
      {/* 底部广告位 */}
      <div className="max-w-7xl mx-auto page-padding py-4">
        <AdSlot position="footer" className="min-h-[100px]" />
      </div>

      <div className="max-w-7xl mx-auto page-padding pb-8 pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 text-sm">
        <div className="col-span-2 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white grid place-items-center font-extrabold">M</div>
            <div>
              <div className="font-bold text-slate-800">MendFile 全能办公工具</div>
              <div className="text-xs text-slate-500">mendfile.com · mendfile.cn</div>
            </div>
          </div>
          <p className="mt-3 text-slate-500 leading-relaxed text-xs sm:text-sm">
            一款无需登录、即开即用、全程本地处理、绝不上传用户文件的免费在线全能办公工具平台，
            支持 PDF 全品类工具，并持续迭代二维码、长图处理、图片编辑等办公工具。
          </p>
        </div>

        {grouped.slice(0, 4).map((g) => (
          <div key={g.key}>
            <div className="font-semibold text-slate-700 mb-2 text-sm">{g.name}</div>
            <ul className="space-y-1.5 text-slate-500">
              {g.tools.length ? (
                g.tools.map((t) => (
                  <li key={t.key}>
                    <Link to={t.path} className="hover:text-brand-600">
                      {t.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li className="text-slate-400">敬请期待…</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100">
        <div className="max-w-7xl mx-auto page-padding py-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between text-xs text-slate-500">
          <div>
            © {new Date().getFullYear()} MendFile 全能办公工具 ·
            <a className="mx-1" href="https://mendfile.com" target="_blank" rel="noreferrer noopener">mendfile.com</a>
            /
            <a className="mx-1" href="https://mendfile.cn" target="_blank" rel="noreferrer noopener">mendfile.cn</a>
            · 保留所有权利
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/disclaimer">免责声明</Link>
            <Link to="/privacy">隐私说明</Link>
            <a href="mailto:contact@mendfile.com">联系我们</a>
            <a
              href="https://beian.miit.gov.cn/"
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-brand-600"
              title="点击前往工信部 ICP/IP 地址/域名信息备案管理系统查询"
            >
              鄂ICP备2026045053号-1
            </a>
            {/* 不蒜子极简访问量计数器（纯前端、无Cookie，DOM id 与官方脚本约定一致） */}
            <span className="hidden sm:inline-flex items-center gap-2 text-slate-500 text-xs" aria-label="访问量统计">
              <span className="chip !py-0.5">
                👁️ 总访问量&nbsp;
                <span id="busuanzi_value_site_pv">加载中…</span>
              </span>
              <span className="chip !py-0.5">
                🔥 今日访问&nbsp;
                <span id="busuanzi_value_site_uv">加载中…</span>
              </span>
              <span
                id="busuanzi_container_site_pv"
                className="text-[10px] text-slate-400"
                title="匿名统计，不记录任何个人信息，纯前端实现"
              >
                数据来自「不蒜子」
              </span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
