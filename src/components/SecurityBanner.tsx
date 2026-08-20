/**
 * 全站固定展示的安全说明横幅：符合需求中「每个页面固定展示全程本地处理，文件不上传不泄露」要求
 */
export default function SecurityBanner() {
  return (
    <div className="bg-gradient-to-r from-emerald-50 via-brand-50 to-sky-50 border-b border-emerald-100 text-emerald-800">
      <div className="max-w-7xl mx-auto page-padding py-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm">
        <div className="inline-flex items-center gap-1.5 font-semibold">
          <span className="inline-flex h-5 w-5 rounded-full bg-emerald-500 text-white grid place-items-center text-[10px]">✓</span>
          全程本地处理，文件不上传不泄露，安全无留存
        </div>
        <div className="flex-1 text-emerald-900/80">
          所有 PDF 解析、转换、压缩、水印、加密解密操作均在您的浏览器中完成，MendFile 不搭建任何文件上传服务、不部署数据库、不保留任何用户文件内容。
        </div>
        <span className="chip !text-emerald-700 !bg-emerald-50 !border-emerald-200">🔒 零上传 · 零留存</span>
        <span className="chip !text-brand-700 !bg-brand-50 !border-brand-200">🆓 免费 · 无需登录</span>
        <span className="chip !text-slate-700">🚫 无弹窗广告</span>
      </div>
    </div>
  );
}
