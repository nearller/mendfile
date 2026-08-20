import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="card p-10 text-center">
      <div className="text-6xl mb-3">🧭</div>
      <h1 className="text-3xl font-bold text-slate-800 mb-2">404，页面走丢了</h1>
      <p className="text-slate-500 mb-6">您访问的页面不存在或已下线，请返回首页继续体验工具。</p>
      <div className="flex items-center justify-center gap-3">
        <Link to="/" className="btn-primary">返回首页</Link>
        <Link to="/tools/pdf-to-word" className="btn-secondary">试试 PDF 转 Word</Link>
      </div>
    </section>
  );
}
