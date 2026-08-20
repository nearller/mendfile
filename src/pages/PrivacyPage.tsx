import { Helmet } from 'react-helmet-async';

const layout = 'max-w-4xl mx-auto card p-6 sm:p-10 space-y-5 text-slate-700 leading-7 text-sm sm:text-base';

export default function PrivacyPage() {
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>隐私说明 - MendFile 全能办公工具</title>
        <meta name="description" content="MendFile 全能办公工具隐私说明：透明告知本站如何（不）收集、使用、存储您的数据，承诺全程本地处理用户文件。" />
        <meta name="keywords" content="MendFile,隐私政策,隐私说明,本地处理,文件不上传,办公工具隐私" />
        <link rel="canonical" href="https://mendfile.com/privacy" />
      </Helmet>

      <article className={layout}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">隐私说明</h1>
        <p className="text-sm text-slate-500">最近更新：{new Date().toISOString().slice(0, 10)}</p>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">一、我们的核心承诺</h2>
          <p>
            <strong>MendFile 从设计之初就是「零上传、零留存」的纯前端办公工具</strong>：您在本站上传的 PDF、图片、文档等任何文件，都会在您自己的浏览器中被解析和处理，
            完整内容绝不会通过网络上传到任何服务器，处理结束后也不会被任何中间设备存储。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">二、我们（不）收集哪些信息</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>我们<strong>不要求注册 / 登录</strong>，因此不会收集账号、手机号、邮箱等个人信息。</li>
            <li>我们<strong>不请求上传用户文件</strong>，所有处理均在浏览器本地完成。</li>
            <li>我们<strong>不部署用户数据库</strong>，不存在文件内容集中存储的风险。</li>
            <li>纯前端工具本身会使用您的设备资源（CPU / 内存 / 磁盘临时缓存），关闭页面后浏览器将自动释放。</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">三、日志与统计</h2>
          <p>
            为排查故障与持续优化体验，您在访问本站时，静态页面托管服务商（例如 Vercel / Netlify / 自建 Nginx 等）可能会记录普通访问日志，
            包括访问时间、IP 地址、请求 URL、User-Agent 等常见 HTTP 信息。这些日志仅用于流量分析与异常监测，
            它们<strong>不包含您上传的任何文件内容或处理结果</strong>，且通常会在短周期内自动删除。
          </p>
          <p>
            若后续接入合规静态广告（百度联盟 / Google AdSense 等），相关第三方广告网络可能使用 Cookie 或匿名标识符进行个性化投放，
            具体请参考对应第三方的隐私政策。您可以通过浏览器设置禁用第三方 Cookie。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">四、密码与加密信息</h2>
          <p>
            当您使用「PDF 加密 / 解密」等工具时输入的密码，仅在当前页面内存中用于调用加密算法，处理完成即被释放。
            <strong>本站不会以任何形式上传、记录或保存您输入的密码。</strong>
            请务必妥善保管您自己的密码，遗忘密码的文件本站也无法帮助恢复。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">五、本地存储（LocalStorage / SessionStorage）</h2>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>本站可能使用 SessionStorage 记录极少量 UI 状态（例如「添加收藏提示是否已读」），会话关闭后自动失效。</li>
            <li>本站默认<strong>不</strong>把用户文件、参数密码、输出结果等写入 LocalStorage / IndexedDB。</li>
            <li>若未来上线「草稿/最近处理」功能，会在对应功能页明确告知并提供一键清空入口。</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">六、外链与第三方内容</h2>
          <p>
            页脚或其它位置出现的外链、广告位、官方域名跳转等第三方内容，均不在本隐私说明约束范围内，
            请您在访问相关第三方网站时自行阅读其隐私与服务条款。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">七、儿童隐私</h2>
          <p>
            本站不刻意面向 14 周岁以下儿童，若您为监护人并发现儿童在未经同意的情况下提供个人信息，
            请通过页脚邮箱联系我们删除对应数据（如存在）。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">八、政策变更</h2>
          <p>
            我们会根据产品迭代或法规变化更新本隐私说明，任何重大变更都会在首页显著位置提前说明。继续使用本站即视为您同意本隐私说明。
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-slate-800">九、联系我们</h2>
          <p>
            关于隐私问题的咨询、投诉、权利请求（访问 / 删除 / 撤回同意等），可发送邮件至
            <a href="mailto:privacy@mendfile.com"> privacy@mendfile.com </a>，我们会在合理期限内响应。
          </p>
        </section>
      </article>
    </>
  );
}
