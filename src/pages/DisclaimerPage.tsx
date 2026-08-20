import { Helmet } from 'react-helmet-async';

const layout = 'max-w-4xl mx-auto card p-6 sm:p-10 space-y-5 text-slate-700 leading-7 text-sm sm:text-base';

export default function DisclaimerPage() {
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>免责声明 - MendFile 全能办公工具</title>
        <meta name="description" content="MendFile 全能办公工具免责声明页：明确功能边界、使用限制、知识产权与法律合规范围，让您在使用前充分了解本平台的适用场景。" />
        <meta name="keywords" content="MendFile,免责声明,办公工具免责,pdf工具边界,合规说明" />
        <link rel="canonical" href="https://mendfile.com/disclaimer" />
      </Helmet>

      <article className={layout}>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">免责声明</h1>
        <p className="text-sm text-slate-500">最近更新：{new Date().toISOString().slice(0, 10)}</p>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            <strong>服务性质</strong>：MendFile（以下简称「本站」，官方域名 mendfile.com / mendfile.cn）提供的全部在线工具均为纯前端本地处理，结果仅供参考，不构成任何专业或法律意见。
          </li>
          <li>
            <strong>功能边界</strong>：本站各工具页面已明确标注功能边界与不适用场景（如扫描版 PDF 无法精准转为可编辑文字、复杂图片/背景水印无法完全去除等），请在使用前充分知晓并自行评估。
          </li>
          <li>
            <strong>结果核验</strong>：涉及合同、报告、法律文书、学术资料、资质文件、财务报表等重要内容的处理，请务必在下载后人工复核排版、文字、页码与完整性，本站不承担因处理结果偏差导致的任何损失。
          </li>
          <li>
            <strong>用户文件与隐私</strong>：本站坚持 100% 纯前端处理，不上传、不留存、不转发任何用户文件内容。但因用户设备、浏览器扩展、网络代理等第三方因素导致的信息泄露，本站不承担责任。
          </li>
          <li>
            <strong>合规使用</strong>：您承诺使用本站工具仅用于合法合规的用途，不得对加密但未获得授权的 PDF、受版权保护的材料、个人敏感信息等进行破解、提取、传播或其他违反法律法规及公序良俗的操作。
          </li>
          <li>
            <strong>知识产权</strong>：本站自身版权、商标、专利、LOGO 及 UI 设计等归 MendFile 所有。您通过本站处理的原始文件与处理结果之权利归属，仍依其原始法律状态确定。
          </li>
          <li>
            <strong>第三方</strong>：本站页面中预留的广告位、外链（如有）、推荐内容由第三方提供，其内容真实性、产品质量与本站无关，请您自行判断。
          </li>
          <li>
            <strong>不可抗力</strong>：因地震、火灾、战争、网络故障、政策调整、浏览器厂商变更规范等不可抗力或非本站可控原因导致服务中断，本站不承担赔偿责任。
          </li>
          <li>
            <strong>变更与终止</strong>：本站有权在不提前通知的情况下调整、新增、下线工具功能，或调整本声明。调整后的声明一经发布即生效。
          </li>
          <li>
            <strong>适用法律</strong>：因使用本站产生的一切争议，在法律允许范围内，以本站运营者所在地法院为管辖法院。
          </li>
        </ol>
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
          若您对本声明有任何疑问或建议，可通过页脚联系邮箱与我们取得联系。
        </p>
      </article>
    </>
  );
}
