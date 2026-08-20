import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import AdSlot from '@/components/AdSlot';
import { CATEGORY_META, TOOLS_CONFIG, type ToolCategory } from '@/config/tools';

/**
 * 首页：工具聚合页。
 * 设计原则：
 *  - 极简清爽，分类展示 PDF 工具板块
 *  - 明确预留【二维码工具】【图片长图工具】两大分类入口（"敬请期待"占位），方便后期无缝拓展
 *  - Hero + 工具区 + SEO 段落 + 为什么选择我们
 */
export default function HomePage() {
  const order: ToolCategory[] = ['convert', 'organize', 'watermark', 'optimize', 'qr', 'image'];

  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>MendFile 全能办公工具 - 免费在线PDF转换、合并、拆分、去水印 纯前端本地处理</title>
        <meta name="description" content="MendFile 全能办公工具是一款完全免费、无需登录、纯前端本地处理的在线办公平台，支持PDF转Word、PDF转图片、PDF合并拆分、PDF去水印、PDF加密解密、图片转PDF、PDF压缩等全品类PDF工具，文件不上传不泄露，手机电脑即用即走。官方域名：mendfile.com / mendfile.cn" />
        <meta name="keywords" content="免费在线办公工具,pdf转word免费无需登录,在线pdf合并拆分,pdf去水印本地处理,无广告pdf压缩工具,纯前端办公工具,pdf转图片,图片转pdf,pdf加密解密,MendFile,全能办公工具" />
        <link rel="canonical" href="https://mendfile.com/" />
        <meta property="og:title" content="MendFile 全能办公工具" />
        <meta property="og:description" content="免费无广告、纯前端本地处理的在线全能办公工具平台，支持PDF全品类工具，持续拓展二维码、长图等。" />
      </Helmet>

      <div className="space-y-10">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-brand-50 via-white to-sky-50 p-6 sm:p-10 shadow-card">
          <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" aria-hidden />
          <div className="relative max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/80 backdrop-blur px-3 py-1 text-xs border border-brand-100 text-brand-700 shadow-sm">
              ✨ 100% 纯前端本地处理 · 无登录 · 无广告
            </span>
            <h1 className="mt-4 text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-800 leading-tight">
              全能办公工具，<span className="text-brand-600">免费即开即用</span>
              <br />
              文件不上传，安全不泄露
            </h1>
            <p className="mt-4 text-slate-600 text-sm sm:text-lg leading-relaxed">
              MendFile 提供 PDF 转 Word / 图片 / TXT、PDF 合并拆分、旋转裁剪、去水印、加水印、加密解密、
              压缩、加页码、改元数据等全套办公能力，后续将上线二维码生成、长图拼接、图片编辑、格式互转等全品类工具。
              全程浏览器本地执行，您的文件永远不会离开您的设备。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tools/pdf-to-word" className="btn-primary !py-3 !px-5">
                ⚡ PDF 转 Word（马上试试）
              </Link>
              <Link to="/tools/pdf-merge" className="btn-secondary !py-3 !px-5">
                🔗 在线合并 PDF
              </Link>
              <Link to="/tools/pdf-remove-watermark" className="btn-secondary !py-3 !px-5">
                🧹 PDF 去水印
              </Link>
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[
                ['🔒', '全程本地处理', '零上传 零泄露'],
                ['🆓', '完全免费', '无次数/积分限制'],
                ['📱', '响应式适配', '电脑手机都流畅'],
                ['🚫', '干净无打扰', '无弹窗 无悬浮广告'],
              ].map(([i, t, d]) => (
                <div key={t} className="rounded-xl bg-white/70 backdrop-blur border border-white p-3 shadow-sm">
                  <div className="text-2xl">{i}</div>
                  <div className="mt-1 font-semibold text-slate-800">{t}</div>
                  <div className="text-[11px] text-slate-500">{d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 工具分类板块 */}
        {order.map((catKey) => {
          const catMeta = CATEGORY_META[catKey];
          const list = Object.values(TOOLS_CONFIG).filter((t) => t.category === catKey);
          const isReserved = catKey === 'qr' || catKey === 'image';
          return (
            <section key={catKey} id={`cat-${catKey}`}>
              <div className="flex items-end justify-between mb-4 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-8 w-1.5 rounded-full bg-gradient-to-b ${catMeta.color}`} />
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{catMeta.name}</h2>
                    {isReserved && <span className="chip">敬请期待</span>}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">{catMeta.desc}</div>
                </div>
                {!isReserved && (
                  <span className="text-xs text-slate-400">共 {list.length} 个工具</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {isReserved ? (
                  <>
                    <ReservedCard
                      emoji={catKey === 'qr' ? '📱' : '🧩'}
                      title={catKey === 'qr' ? '二维码生成与解码' : '图片长图拼接'}
                      desc={catKey === 'qr' ? '批量生成、Logo嵌入、矢量导出、扫码解析' : '批量拼接、加水印、分辨率调整、格式互转'}
                    />
                    <ReservedCard
                      emoji={catKey === 'qr' ? '🧾' : '🎨'}
                      title={catKey === 'qr' ? '二维码批量生成器' : '在线图片编辑器'}
                      desc={catKey === 'qr' ? '从 Excel/CSV 批量生成二维码并打包下载' : '裁剪、调色、磨皮、加框、加水印等一站式修图'}
                    />
                    <ReservedCard
                      emoji={catKey === 'qr' ? '🎨' : '🗜️'}
                      title={catKey === 'qr' ? '艺术二维码' : '图片压缩'}
                      desc={catKey === 'qr' ? '自定义配色+背景+Logo，可商用美术二维码' : 'JPG/PNG/WEBP 批量压缩，支持 kb 级别目标大小'}
                    />
                    <ReservedCard
                      emoji={catKey === 'qr' ? '🏷️' : '🔄'}
                      title={catKey === 'qr' ? '条形码生成' : '图片格式互转'}
                      desc={catKey === 'qr' ? 'EAN13 / Code128 / UPC / ITF 等常用条码' : 'JPG / PNG / WEBP / BMP / ICO 一键互转'}
                    />
                  </>
                ) : (
                  list.map((t) => (
                    <Link
                      key={t.key}
                      to={t.path}
                      className="group card p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-11 w-11 shrink-0 rounded-xl grid place-items-center text-xl text-white bg-gradient-to-br ${catMeta.color} shadow-sm`}>
                          {t.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 group-hover:text-brand-600 transition">
                            {t.name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 line-clamp-2">{t.shortDesc}</div>
                        </div>
                      </div>
                      <div className="mt-3 text-[11px] text-brand-600/90 inline-flex items-center gap-1">
                        立即使用 →
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          );
        })}

        {/* 文章广告 */}
        <AdSlot position="in-article" className="min-h-[110px]" />

        {/* 为什么选我们 + SEO 长文 */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="card p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-800">为什么选择 MendFile 全能办公工具？</h3>
            <ul className="space-y-2 text-sm text-slate-600 leading-7">
              <li>✦ <strong>纯前端本地处理</strong>：文件解析、转换、压缩、加密解密等全部在浏览器中完成，绝不上传服务器、不部署数据库，配合全程 HTTPS，最大化保护您的隐私。</li>
              <li>✦ <strong>免费无套路</strong>：无注册、无登录、无会员、无积分、无使用次数限制，所有核心工具永久免费开放。</li>
              <li>✦ <strong>干净无广告打扰</strong>：全站仅预留合规的页面底部与侧边静态广告位，<strong>无弹窗、无悬浮、无自动播放</strong>，真正为办公人群设计。</li>
              <li>✦ <strong>响应式多端适配</strong>：电脑、平板、手机均可流畅使用，低配置设备也能快速加载，出门在外也能用手机应急办公。</li>
              <li>✦ <strong>开放架构，持续迭代</strong>：第一期以 PDF 工具为核心，后续将无缝拓展二维码、长图处理、图片编辑、格式互转等全品类办公工具，一站式解决办公需求。</li>
            </ul>
          </div>
          <div className="card p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-800">常见使用场景</h3>
            <ul className="space-y-2 text-sm text-slate-600 leading-7">
              <li>🪄 <strong>职场办公</strong>：收到一份扫描+文本混杂的 PDF，先用本站 <Link to="/tools/pdf-to-word">PDF 转 Word</Link>、<Link to="/tools/pdf-to-txt">PDF 转 TXT</Link> 快速提取内容。</li>
              <li>🪄 <strong>合同与材料整理</strong>：用 <Link to="/tools/pdf-merge">PDF 合并</Link> 把多份附件拼成一份，用 <Link to="/tools/pdf-pages">页面编辑</Link> 删除空白页，用 <Link to="/tools/pdf-encrypt">加密</Link> 后再外发。</li>
              <li>🪄 <strong>标书/报告水印</strong>：使用 <Link to="/tools/pdf-add-watermark">PDF 添加水印</Link> 批量平铺密集防盗水印，保障文档产权。</li>
              <li>🪄 <strong>大文件传输前瘦身</strong>：<Link to="/tools/pdf-compress">PDF 压缩</Link> 支持极致压缩，让几十 MB 的 PDF 快速变成小体积文件。</li>
              <li>🪄 <strong>隐私保护</strong>：对外发文件前使用 <Link to="/tools/pdf-metadata">PDF 元数据修改</Link> 清空原作者、创建时间等敏感信息。</li>
            </ul>
          </div>
        </section>

        <section className="card p-6 sm:p-8 text-sm text-slate-600 leading-7 space-y-3">
          <h3 className="text-xl font-bold text-slate-800">关于 MendFile 全能办公工具的更多介绍</h3>
          <p>
            <strong>MendFile 全能办公工具（官方域名：mendfile.com / mendfile.cn）</strong>
            是一个专为办公人群打造的 <em>免费在线办公工具聚合平台</em>，坚持「无需登录、即开即用、
            全程本地、安全无泄露」的产品理念。无论是 <em>pdf转word免费无需登录</em>、
            <em>在线pdf合并拆分</em>、<em>pdf去水印本地处理</em>，还是想要一款
            <em>无广告pdf压缩工具</em>，MendFile 都是您值得收藏的一站式选择。
          </p>
          <p>
            本站所有工具均为 <em>纯前端办公工具</em>，没有任何后端接口去保存、解析或转发您的文件。
            这意味着，只要您打开页面，就算后续断网，大部分工具依然可以离线继续工作。
            如果您经常在电脑端使用，推荐按 <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-xs">Ctrl/⌘ + D</kbd>
            收藏；移动端用户可通过浏览器「添加到主屏幕」，获得近似 App 般的启动体验。
          </p>
        </section>
      </div>
    </>
  );
}

function ReservedCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="card p-4 sm:p-5 border-dashed opacity-85 hover:opacity-100 transition">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl grid place-items-center text-xl text-white bg-gradient-to-br from-slate-300 to-slate-500">
          {emoji}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-slate-700 inline-flex items-center gap-2">
            {title}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">即将上线</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{desc}</div>
        </div>
      </div>
      <div className="mt-3 text-[11px] text-slate-400">后续版本中开放，可在首页顶部「添加收藏」持续关注</div>
    </div>
  );
}
