# MendFile 全能办公工具 一期完整版 部署说明

> 项目：MendFile 全能办公工具（一期 PDF 全品类 + 预留二维码/图片工具扩展位）
> 技术栈：Vite + React 18 + TypeScript + TailwindCSS + react-router-dom + react-helmet-async
> 核心库：pdf-lib、pdfjs-dist、jszip、file-saver
> 核心特性：**100% 纯前端本地处理，零后端、零上传、零登录、零数据库**

---

## 一、目录结构

```
mendfile/
├─ index.html                首页 HTML（含品牌 SEO 元信息 / manifest / favicon）
├─ public/                   静态资源（favicon、robots、manifest、部署后直接复制）
│  ├─ favicon.svg
│  ├─ manifest.json          移动端“添加到桌面”PWA 配置
│  └─ robots.txt
├─ src/
│  ├─ main.tsx               入口（BrowserRouter + HelmetProvider）
│  ├─ App.tsx                路由总表
│  ├─ index.css              Tailwind + 全局自定义样式
│  ├─ layouts/
│  │  └─ MainLayout.tsx      全局布局（Header + 安全横幅 + 主区+侧边广告 + 移动端广告 + Footer）
│  ├─ components/
│  │  ├─ SiteHeader.tsx      顶部导航（收藏/快捷方式引导提示）
│  │  ├─ SiteFooter.tsx      页脚（分类链接、合规页、官方域名、ICP占位）
│  │  ├─ SecurityBanner.tsx  全站固定安全说明横幅
│  │  └─ AdSlot.tsx         模块化广告位（footer / sidebar-top / sidebar-mid / in-feed-mobile / in-article）
│  ├─ pages/
│  │  ├─ HomePage.tsx        首页（工具聚合 + 预留二维码工具/图片工具入口）
│  │  ├─ ToolPageTemplate.tsx 所有 13 个工具统一落地页（上传/参数/进度/下载/预览）
│  │  ├─ DisclaimerPage.tsx  免责声明
│  │  ├─ PrivacyPage.tsx     隐私说明
│  │  └─ NotFoundPage.tsx    404
│  ├─ config/
│  │  └─ tools.ts            ★ 工具中心：路由、SEO、功能边界、默认参数、处理器映射
│  └─ core/                  纯前端处理核心（业务无侵入，方便后续增加工具）
│     ├─ types.ts            ProcessFn 输入输出类型
│     ├─ utils.ts            文件读取/下载/缩略图/大小格式化等
│     ├─ pdfjs.ts            pdfjs-dist worker 初始化（离线本地 worker）
│     └─ processors.ts       ★ 全部 13 个工具处理器（纯前端本地实现）
├─ package.json
├─ tsconfig.json / tsconfig.node.json
├─ vite.config.ts
├─ tailwind.config.js / postcss.config.js
└─ DEPLOY.md                 本文件
```

---

## 二、本地开发

```bash
# 1. 安装依赖（建议使用 Node.js >= 18）
npm install
# 或 pnpm install / yarn

# 2. 本地开发（默认 http://localhost:5173）
npm run dev

# 3. 打包生产构建
npm run build
# 产物输出到 dist/，直接上传任意静态托管即可

# 4. 本地预览生产构建
npm run preview
```

> 推荐使用 Node.js 18 LTS 或更高版本。本项目所有功能均不依赖后端，`npm run dev` 即可完整体验。

---

## 三、一键上线（静态托管）

项目完全不需要后端配套，**任何静态托管都能直接部署**。`dist/` 目录即完整可交付物。

### 方式 1：Nginx（推荐自托管）

```nginx
server {
  listen 80;
  server_name mendfile.com mendfile.cn www.mendfile.com www.mendfile.cn;

  root /var/www/mendfile/dist;
  index index.html;

  # 全站 gzip 压缩
  gzip on;
  gzip_comp_level 6;
  gzip_min_length 1k;
  gzip_types text/plain text/css text/xml application/javascript application/json application/xml application/rss+xml image/svg+xml application/pdf application/wasm font/ttf font/otf font/woff font/woff2;

  # 静态资源强缓存
  location ~* \.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|gif|svg|ico|wasm)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
    try_files $uri =404;
  }

  # 单页应用 history 回退
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### 方式 2：Vercel / Netlify

```bash
# 直接一键部署
1. 将项目 push 到 GitHub
2. Vercel / Netlify 中 Import 仓库
3. Build Command: npm run build
4. Output Directory: dist
5. 绑定自定义域名 mendfile.com / mendfile.cn
完成！无需任何其他配置。
```

### 方式 3：阿里云 OSS + CDN / 腾讯云 COS + CDN

1. 创建静态网站托管 Bucket
2. 将 `dist/` 下所有文件上传到 Bucket 根目录
3. 默认首页：`index.html`；默认 404 页也设置为 `index.html`（SPA 回退）
4. 绑定 CDN 加速域名 mendfile.com / mendfile.cn
5. 对 js/css/图片资源设置 30 天缓存，index.html 不缓存

### 方式 4：GitHub Pages

```bash
npm run build
# 将 dist/ 内容推送到 gh-pages 分支即可；
# 如需项目子路径部署，请在 vite.config.ts 添加 base: '/your-repo/'。
```

---

## 四、流量监测与数据统计（必做，纯前端零后端）

> 严格契合本站「安全无隐私收集」理念：**零 Cookie、零后端、零数据库、不抓取访客信息、不弹窗授权**。
> 全部脚本均为延迟加载（`requestIdleCallback` + `defer`），不阻塞首屏渲染。
> 代码集中注入点：`index.html` `<body>` 末段 `<script>(function(){ … })()</script>`。

### 4.0 部署节奏（按第六章要求，重点）

| 统计工具 | 现阶段状态 | 启用方式 | 说明 |
| --- | --- | --- | --- |
| **Microsoft Clarity** | ✅ **正常接入启用**（备案期间兜底） | 填入 Project ID 即生效 | 代码已就绪，非备案阻塞，仅缺凭证 |
| **不蒜子 Busuanzi** | ✅ **已启用**（前台计数器） | 无需配置，默认加载 | 页脚 Chip 已渲染，脚本已自动加载 |
| **Cloudflare Web Analytics** | ⏸ **备案期间暂不接入** | 备案通过后替换 `CF_TOKEN` 即一键启用 | 代码位 + 变量已完整预留，备案完成无需二次改代码 |

> 现阶段（域名备案中）：Clarity + 不蒜子作为兜底统计，可正常记录用户行为、页面访问量、访客数据，保障上线初期有完整数据支撑。Cloudflare 待域名备案审核通过、完成 Cloudflare 域名托管后，仅需替换 `CF_TOKEN` 即启用匿名合规统计（无 Cookie、可精准统计 UV/PV、访问来源、设备、地域）。

---

### 4.1 接入组合（3 套，全部免费永久）

| 工具 | 作用 | 核心指标 | 是否隐私友好 |
| --- | --- | --- | --- |
| **Cloudflare Web Analytics** | 核心流量大盘 | 日 UV、日 PV、访问来源、热门页、设备、地域 | ✅ 无 Cookie、匿名统计，完全免费不限量 |
| **Microsoft Clarity** | 行为热力图 + 留存复盘 | 点击热图、会话回放、跳出率、停留时长、页面流失点 | ✅ 免费无广告，合规不抓取敏感信息 |
| **不蒜子 Busuanzi** | 前台极简计数器（页脚展示） | 总访问量 / 今日访问量（页脚小 Chip，增强信任感） | ✅ 纯前端 JS，无数据库依赖 |

---

### 4.2 绑定教程

#### Step 1 — Microsoft Clarity（现阶段启用，备案期间兜底统计）
1. 打开 [clarity.microsoft.com](https://clarity.microsoft.com/) → 用微软账号免费登录
2. 点击 **+ New project**：
   - Name：`MendFile 全能办公工具`
   - Website：`https://mendfile.com`（填你实际的上线域名）
   - Industry：`Productivity / Business Tools`
3. 创建完成后，复制页面里那段 Clarity Script 中的 **Project ID**，形如 `x1abc2def3`（通常是 10 位字母数字混合）
4. 打开本项目 `index.html`，找到这一行：
   ```
   var CLARITY_ID = 'MENDFILE_CLARITY_ID';
   ```
   替换为：
   ```
   var CLARITY_ID = 'x1abc2def3';
   ```
5. 重新 `npm run build` → 上线。**一般 1~2 小时后可在 Clarity 后台看到点击热力图、会话回放。**

> 🔒 官方文档：[Clarity Setup Overview](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-setup)

---

#### Step 2 — 不蒜子极简计数器（前台展示，默认已启用）
1. **无需配置**：页脚 `src/components/SiteFooter.tsx` 已经内置好两个官方 DOM id：
   - `busuanzi_value_site_pv` → 总访问量
   - `busuanzi_value_site_uv` → 今日访问量
   - `busuanzi_container_site_pv` → 容器（脚本加载完成后自动显示）
2. `index.html` 注入逻辑已自动识别并加载 `https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js`。
3. **如需关闭不蒜子**：
   - 在 `SiteFooter.tsx` 把 `不蒜子极简访问量计数器` 整块 `<span>` 注释掉即可；
   - `index.html` 会因为找不到 DOM 而自动跳过加载，不会产生 404。

> ℹ️ 不蒜子是社区成熟的纯前端统计方案，若你的部署环境在境外访问不稳定，可把它替换为 [51.la 免费无 Cookie 统计](https://www.51.la/)，逻辑不变。

---

#### Step 3 — Cloudflare Web Analytics（备案通过后启用，核心流量大盘）
> ⏸ **现阶段域名备案中，暂不接入埋点**。代码位与变量 `CF_TOKEN` 已完整预留于 `index.html`，备案审核通过、完成 Cloudflare 域名托管后，仅需按以下步骤填入 Token 即一键启用，无需二次改代码、无需重构页面。

1. 登录 Cloudflare → 左侧 **Analytics & Logs** → **Web Analytics**（免费功能，无需把域名迁到 CF DNS）
2. 点击 **Add a site**（输入 `mendfile.com` 或你实际部署域名）
3. 点 **Get token**，复制到一段形如 `abcdef1234567890abcdef1234567890` 的 32 位 **token**（不是 Site ID）
4. 打开本项目 `index.html`，找到这一行：
   ```
   var CF_TOKEN = 'MENDFILE_CF_BEACON_TOKEN';
   ```
   替换为：
   ```
   var CF_TOKEN = 'abcdef1234567890abcdef1234567890';
   ```
5. 重新 `npm run build` → 上线。**通常 5 分钟后 Cloudflare 后台即可看到实时 UV/PV。**

> 🔒 官方文档：[Cloudflare Web Analytics · Getting started](https://developers.cloudflare.com/analytics/web-analytics/getting-started/)

---

### 4.3 常见可观测指标清单（上线后 3~7 天必看）

| 维度 | 看哪里 | 目标（3000~5000 日 UV 阶段） |
| --- | --- | --- |
| 日 UV / 日 PV 趋势 | Cloudflare Web Analytics → Overview（备案后启用） / Clarity → Dashboard（现阶段可用） | PV/UV 比值 ≥ 1.6（说明用户有二次点击） |
| 热门工具页 Top 5 | Clarity → **Top pages**（现阶段可用） / Cloudflare → **Pages**（备案后） | 用于加量该工具的 SEO、落地页介绍 |
| 访问来源（免费流量） | Cloudflare → **Referrers**（备案后） | 自然搜索占比 ≥ 50%、直访 ≥ 25% |
| 设备/分辨率占比 | Clarity → **Device**（现阶段可用） / Cloudflare → **Devices**（备案后） | 移动端占比通常 ≥ 60%，优化移动端 UX |
| 页面跳出率/停留时长 | Microsoft Clarity → **Dashboard**（现阶段可用） | 首页跳出率 ≤ 70%、工具落地页 ≥ 90s |
| 用户点击热力图 | Microsoft Clarity → **Heatmaps**（现阶段可用） | 找出「开始处理」按钮是否好点 |
| 流失节点 | Microsoft Clarity → **Recordings**（现阶段可用） | 看用户是不是卡在上传/处理环节 |
| 前台信任感（总访问量） | 页脚 Chip 展示（不蒜子，现阶段已启用） | 配合 SEO 起量，数据自然增长 |

---

### 4.4 如何确认脚本生效（自检 3 步）

1. **浏览器开发者工具 → Network**：
   - 不蒜子（现阶段）：出现 `busuanzi.pure.mini.js` 200，且 `busuanzi_value_site_pv` 从「加载中…」变成数字
   - Clarity（填入 ID 后）：出现 `https://www.clarity.ms/tag/xxxxxxxx` 200
   - Cloudflare（备案后填 Token）：出现 `static.cloudflareinsights.com/beacon.min.js` 200，且 `data-cf-beacon` 属性里 token 不是占位字符
2. **Console**：不应出现任何脚本加载错误（Clarity 偶尔有 `clarity not loaded yet` 延迟提示，属正常）
3. **后台实时数据**：
   - Clarity：填 ID 上线后 1~2 小时 Dashboard 从 0 变有数值
   - 不蒜子：页脚 Chip 即时显示总访问/今日访问
   - Cloudflare：备案后部署 5~10 分钟出现 `Real-time: 1 visitor`（你自己的访问）

---

## 五、接入广告（无需改动业务代码）

所有广告位集中在 `src/components/AdSlot.tsx` 一个组件里，按位置分发：

| 位置 position       | 出现地点                          | 建议尺寸          |
| ------------------- | --------------------------------- | ----------------- |
| `footer`            | 页脚上方通栏                      | 728×90 / 通栏      |
| `sidebar-top`       | 桌面端右侧栏上部                  | 300×250            |
| `sidebar-mid`       | 桌面端右侧栏下部                  | 300×600            |
| `in-feed-mobile`    | 移动端正文下方信息流              | 自适应（320~414宽）|
| `in-article`        | 首页/工具落地页文章中间位         | 通栏 970×90        |

后期接入百度联盟 / Google AdSense：

1. 在 `AdSlot.tsx` 顶部引入对应 js（或通过 GTM 注入）
2. 在 `if (position === 'xxx')` 处替换内部 JSX 为广告代码即可
3. 所有业务页面无需修改，立即全量生效

**全站承诺**：不使用弹窗、不使用悬浮窗、不使用自动播放有声广告，严格遵守需求中的广告合规要求。

---

## 六、SEO 信息说明

- 每个功能落地页都在 `src/config/tools.ts` 中单独配置了独立的 `title / description / keywords`，并在 `ToolPageTemplate.tsx` 内通过 `react-helmet-async` 写入 `<head>`。
- 所有页面标题统一携带品牌名：**MendFile 全能办公工具**。
- 关键词覆盖：免费在线办公工具、pdf转word免费无需登录、在线pdf合并拆分、pdf去水印本地处理、无广告pdf压缩工具、纯前端办公工具等。
- canonical 统一写入官方域名 `https://mendfile.com{path}`。
- `public/robots.txt` 已允许全量抓取，并指向 `sitemap.xml`（上线后建议用脚本根据 `tools.ts` 自动生成 sitemap）。

> 建议上线后：
> 1) 申请百度 / Google 站长平台；
> 2) 基于 `src/config/tools.ts` 的路径生成 sitemap.xml；
> 3) 配置 301 重定向 mendfile.cn -> mendfile.com 或反之，避免重复收录。

---

## 七、功能自测清单

一期已内置以下 13 个 PDF 工具，每个工具均可独立进入并执行：

### 核心转换类
- [x] PDF 转 Word（文本型，输出 docx，多文件打包 ZIP）
- [x] PDF 转图片（PNG/JPG，DPI 可选，多页 ZIP）
- [x] 图片转 PDF（多图合成，自定义页面尺寸 / 边距 / 适配 / 排序）
- [x] PDF 转 TXT（纯文本提取，多文件打包 ZIP，支持预览复制）

### PDF 整理编辑
- [x] PDF 合并（多文件、排序、无数量限制）
- [x] PDF 拆分（按范围 / 均等拆分 / 提取指定页，ZIP 下载）
- [x] 页面编辑（90/180 旋转、删除页、统一裁剪边距）

### 水印与安全
- [x] PDF 去水印（扫描注解 + 低透明度整段文本 + 关键字三重策略）
- [x] PDF 添加水印（文字 / 图片，透明度角度位置密度可调，平铺/居中/四角）
- [x] PDF 加密解密（AES-128，User/Owner 密码 + 权限控制）

### 轻量化优化
- [x] PDF 压缩（普通 / 极致双模式，重建 + 图片重采样）
- [x] PDF 添加页码（8 点位 + 阿拉伯/罗马/中文 + 起始页 + 字号颜色）
- [x] PDF 元数据修改（title/author/subject/keywords/时间 + 一键清空）

其他：
- [x] 首页工具聚合 + 二维码工具/图片工具「敬请期待」预留卡片
- [x] 全站固定安全横幅（本地处理、不上传、不泄露）
- [x] 网站收藏 / 添加到桌面快捷方式引导（SessionStorage 控制只出现一次）
- [x] 免责声明页、隐私说明页、404 页
- [x] 响应式：桌面 12 栏 / 平板 3 栏 / 手机 1 栏，移动端隐藏侧边栏广告改底部
- [x] 所有工具统一拖拽 + 点击上传、实时进度条、错误提示、一键下载、结果预览

---

## 八、后续扩展指南（新增一个工具只需 3 步）

一期已经搭好「可无限拓展的全能办公工具平台架构」，新增工具（例如二维码生成 / 长图拼接）：

1. 在 `src/config/tools.ts` 的 `TOOLS_CONFIG` 增加一条配置：
   ```ts
   'qr-generate': {
     key: 'qr-generate', path: '/tools/qr-generate', name: '二维码生成', ...
     processor: P.qrGenerate, defaultOptions: { size: 256, ... }
   }
   ```
2. 在 `src/core/processors.ts` 中新增 `export const qrGenerate: ProcessFn = ...` 的纯前端处理器。
3. 若需要在通用参数面板中渲染对应表单，在 `src/pages/ToolPageTemplate.tsx` 的 `OptionsPanel.panels` 中加一条 `'qr-generate': ...`；若表单完全自定义，可以单独新建 `QrPage.tsx` 并在 `App.tsx` 路由中覆盖对应 path。

即可完成接入，首页会自动根据 `category` 出现在对应的分类板块中，无需修改其他代码。

---

## 九、常见问题

| 问题 | 解决 |
| --- | --- |
| PDF 打不开 / 报错 "加密文件" | 先使用「PDF 加密解密」工具选择解密，输入密码解除后再处理 |
| 扫描版 PDF 转 Word 后没文字 | 正常。扫描版是图片，必须走 OCR（请参考工具页功能边界提示） |
| 去水印后仍有残留 | 复杂图片水印 / 整页扫描背景水印无法完全去除，属功能边界；后续会上线图片编辑工具单独处理 |
| 压缩后体积变小不明显 | 纯文字 / 矢量 PDF 本身已高度压缩，压缩率有限属正常 |
| 大文件处理卡顿 | 浏览器内存有限，建议 1GB 以下文件；移动端处理超大型 PDF 建议桌面端 |

---

© MendFile 全能办公工具 · 官方域名：mendfile.com / mendfile.cn
