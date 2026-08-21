# MendFile 二期开发 任务清单 (tasks.md)

- **Spec 文件**: ./spec.md
- **创建日期**: 2026-08-22
- **执行约束**: 严格按批次 1→2→3→4→5→6 顺序；批次内任务完成后才能进入批次验收任务；验收通过才能进入下一批次

---

## Phase 0 · 全局基础设施（横跨所有批次，优先于批次 1 完成）

### Task P0-1：ToolConfig 类型扩展 + ToolCategory 枚举新增
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G1 / B4-1 / B5-2 / B5-1
- **改动文件**:
  - `src/config/tools.ts`：`ToolCategory` 新增 `'media'` | `'office'`；`CATEGORY_META` 对应新增 media（配色 `from-cyan-500 to-blue-500`）、office（配色 `from-lime-500 to-green-600`）；`ToolConfig` interface 新增可选字段 `fileRequired?: boolean`（默认 true）
  - `src/core/types.ts`：无变更（ProcessFn 签名继续复用）
- **TR (rule)**: `type ToolCategory` union 中检查到包含 `'qr'|'image'|'media'|'office'` 4 个非 PDF 分类；`interface ToolConfig` 编译时支持 `fileRequired?: boolean` 可选字段
- **Depends On**: 无（起始任务）

### Task P0-2：ToolPageTemplate 支持 fileRequired=false
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B5-2
- **改动文件**: `src/pages/ToolPageTemplate.tsx` 的 ToolWorker 组件
  - 当 `config.fileRequired === false` 时：跳过 DropZone、FileList 渲染；start 按钮文案改为「开始计算/生成」；无需 files.length 校验即可点击开始；进度条/结果区逻辑继续复用
- **TR (rule)**: 构造一个 `fileRequired:false` 的测试工具，其落地页 DOM 中不存在 `<input type="file">`；点击按钮时不触发「请先选择至少一个文件」错误
- **Depends On**: P0-1

### Task P0-3：繁简字库 + 工具通用 helper 准备
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B5-3
- **改动文件**: 新建 `src/vendor/trad-simp.ts`：
  - 导出 3500+ 常用字 `Map<string, string>`：S→T 和 T→S 双向
  - 导出 `toTraditional(text)`, `toSimplified(text)` 纯函数
- **TR (rule)**: 单元断言 `toSimplified('後') === '后'` 且 `toTraditional('后') === '後'`（通过 browser_evaluate 执行函数调用验证）
- **Depends On**: P0-1（同批，可并行）

---

## 批次 1 · 图片工具全集（v1.1.0）→ 对应 AC: B1-1~B1-4

### Task 1.1：tools.ts 新增 3 个图片工具 SEO+功能 配置
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B1-1 / B1-2 / B1-3 / G3 / B1-4
- **改动文件**: `src/config/tools.ts` → `TOOLS_CONFIG` 新增 3 条：
  1. `'image-compress'` (category: image)：title「图片压缩在线 批量JPG/PNG/WebP - MendFile 全能办公工具」；keywords 含「图片压缩在线、图片批量压缩、jpg压缩、png压缩、webp压缩」；boundaries ≥2：含「已压缩过的图片收益有限」「GIF动图暂不支持」；defaultOptions `{ level: 'normal' }`
  2. `'image-convert'` (category: image)：title「图片格式互转 JPG转PNG转WebP - MendFile 全能办公工具」；keywords 含「图片格式转换、jpg转png、jpg转webp、png转jpg、批量图片格式转换」；boundaries ≥2；defaultOptions `{ format: 'same', quality: 85, fillColor: '#ffffff' }`
  3. `'id-photo'` (category: image)：title「智能证件照 换底色 一寸二寸模板 - MendFile 全能办公工具」；keywords 含「证件照换底色、一寸证件照、二寸证件照、证件照制作、护照签证照片」；boundaries ≥4（⚠️红色合规卡片）：必须含「普通颜色阈值换底非AI人像分割」「复杂背景卷发边缘可能残留」「正式证件建议专业照相馆」「不提供人脸识别」
- **TR (rule)**: `Object.keys(TOOLS_CONFIG).filter(k => TOOLS_CONFIG[k].category === 'image').length === 3`（浏览器 evaluate 断言）；每个 image 类工具 title 含「MendFile 全能办公工具」
- **Depends On**: P0-1

### Task 1.2：processors.ts 新增 3 个图片工具处理器（纯 Canvas）
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B1-1 / B1-2 / B1-3
- **改动文件**: `src/core/processors.ts` 新增 3 个导出 ProcessFn：
  1. **imageCompress**: 遍历 files → 每张图 loadImage → drawImage 到 canvas（根据 level 选 quality：轻度 0.85/标准 0.70/极致 0.45；极致还做 longest<=1920px 缩放）→ canvasToBlob → 多文件 ZIP；preview.stats 输出每张前后大小 + 总压缩率
  2. **imageConvert**: 遍历 files → drawImage（PNG→JPG 时先 fillRect 底色）→ 根据 format 和 quality canvasToBlob → ZIP；fillColor 参数生效
  3. **idPhoto**: 单文件 → drawImage（按模板比例居中裁剪）→ 换底（计算每个像素与原底色色差是否 < 阈值，<阈值则替换为新底色并羽化边缘 2px）→ 输出单张 + 6张排版 ZIP 可选
- **通用 helper 建议复用**：`loadImage` / `canvasToBlob`（utils.ts 已存在）
- **TR (rule)**: 3 个处理器名称在 processors.ts 中使用 `export const imageCompress/imageConvert/idPhoto: ProcessFn` 声明；processor 代码 0 命中 fetch/XHR（grep 验证）
- **Depends On**: Task 1.1

### Task 1.3：ToolPageTemplate OptionsPanel 新增 3 个图片工具参数面板
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B1-1 / B1-2 / B1-3
- **改动文件**: `src/pages/ToolPageTemplate.tsx` 的 `panels` 对象新增 3 条 key：
  - `'image-compress'`：3 档单选（轻度/标准/极致）+ 文案提示「标准压缩推荐，体积↓30~50%」
  - `'image-convert'`：输出格式下拉（same/jpg/png/webp/bmp）+ 质量滑块（仅 jpg/webp 生效）+ 透明填充色颜色选择器（格式转 jpg/bmp 时生效）
  - `'id-photo'`：尺寸模板预设下拉（6项+自定义宽高）+ 换底色单选（保留/白/蓝/红/渐变蓝/自定义颜色）+ 输出模式（单张/6张拼版/两者打包ZIP）
- **TR (rule)**: 进入 3 个工具页（SPA 路由）→ 参数面板区出现对应控件（下拉/颜色选择器/单选）个数≥配置
- **Depends On**: Task 1.2

### Task 1.4：首页 image 分类板块由 ReservedCard → 真实卡片联动
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B1-4
- **改动文件**: `src/pages/HomePage.tsx`（不改动，因为自动按 category 读取 TOOLS_CONFIG）→ 实际联动由 Task 1.1 自动生效；如 HomePage.isReserved 判断逻辑有问题需微调
- **TR (rule)**: 首页 snapshot → `cat-image` 板块下方 4 个卡片中至少 3 个出现「立即使用 →」按钮而非「敬请期待 即将上线」chip
- **Depends On**: Task 1.1（完成后自动生效，单独 TR 验证）

### Task 1.5：批次 1 验收 Build + Tag v1.1.0 + Push + 浏览器冒烟
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G6 / B1-1 / B1-2 / B1-3 / B1-4
- **执行步骤**:
  1. 若 node/npm 可用：`npm install` → `npm run build`；若不可用，先 `brew install node`
  2. git commit（规范 message：`v1.1.0 图片工具全集上线｜图片压缩/格式互转/证件照制作 3 工具齐备，SEO 图片赛道入口打通`）
  3. `git tag -a v1.1.0 -m "v1.1.0 批次1图片工具全集"` → `git push origin main` → `git push origin v1.1.0`
  4. 浏览器自动化：从首页点击 3 个 image 工具卡片 → 每页检查标题/面包屑/上传区/参数面板控件/边界提示；检查 SEO 长文；Console 无错误
- **Completion Evidence**: 浏览器测试报告截图文字结果；git tag ls-remote 显示 v1.1.0；dist/ 有新构建产物
- **Depends On**: Task 1.3 + Task 1.4

---

## 批次 2 · 二维码全套工具（v1.2.0）→ 对应 AC: B2-1~B2-5

### Task 2.1：安装二维码依赖包 jsqr + qrcode
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B2-1 / B2-2 / B2-3
- **改动文件**: `package.json` + `npm install`
  - `dependencies` 新增：`"jsqr": "^1.4.0"`（二维码解析）、`"qrcode": "^1.5.3"`（二维码生成，支持 SVG/PNG）
  - 对应 @types 包如存在则安装（`@types/qrcode`、jsqr 自带 types）
  - 若 npm 不可用：下载两个库 ESM 版本到 `src/vendor/`，手动导入
- **TR (rule)**: `package.json dependencies` 中存在 jsqr 与 qrcode 两条；构建后不产生类型错误（TSC build 通过）
- **Depends On**: 批次 1 验收通过（Task 1.5 completed）

### Task 2.2：tools.ts 新增 3 个二维码工具配置
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B2-1 / B2-2 / B2-3 / B2-5 / G3
- **改动文件**: `src/config/tools.ts` → `TOOLS_CONFIG` 新增 3 条（category: qr）：
  1. `'qr-generate'`：title「二维码生成 美化自定义 Logo SVG PNG - MendFile 全能办公工具」；keywords「二维码生成、二维码美化、二维码Logo、二维码SVG、免费二维码生成」；accept: ''（实际只接受文本+Logo上传，files 用于 Logo，multiple: false）；defaultOptions 含 content/text/ecl/size/margin/dotStyle/finderStyle/fgColor/bgColor/logoDataUrl/template
  2. `'qr-parse'`：title「二维码批量解析识别 图片扫码提取内容 - MendFile 全能办公工具」；keywords「二维码识别、二维码解析、批量扫码提取、图片读二维码」；accept: image/*, multiple: true；outputExt: zip；boundaries 含「严重模糊/倾斜无法识别」
  3. `'qr-batch-generate'`：title「批量二维码生成 打包ZIP下载 - MendFile 全能办公工具」；keywords「批量二维码、二维码批量生成、二维码打包下载、批量TXT生成二维码」；accept: .txt,.csv（可选），multiple: false；fileRequired: false（主输入是文本框）；defaultOptions: { lines: '', prefix: 'qrcode', ecl: 'M', pixelSize: 10, fg: '#000000', bg: '#ffffff' }
- **TR (rule)**: qr 类工具总数 === 3；每个 title 含品牌名
- **Depends On**: Task 2.1（依赖库先就位）

### Task 2.3：processors.ts 新增 3 个二维码处理器
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B2-1 / B2-2 / B2-3
- **改动文件**: `src/core/processors.ts` 新增：
  1. **qrGenerate**：使用 `qrcode.toBuffer()` / `toDataURL()` 生成 PNG 或 SVG；容错级别映射；Logo 模式：绘制二维码到 canvas → 中央放 Logo 图（缩放至 15% 宽度）→ canvasToBlob
  2. **qrParse**：逐张 file → loadImage → drawImage offscreen canvas → getImageData → jsQR → 收集结果 → 失败项标「无法识别」 → 输出 TXT + JSON 打包 ZIP
  3. **qrBatchGenerate**：解析 `options.lines` 按行 split（空行跳过）→ 每行 qrcode 生成 PNG → JSZip.file(`prefix_0001.png`) → 打包 ZIP，进度按行
- **TR (rule)**: 3 个处理器名称按规范导出；代码中 0 命中 fetch/XHR
- **Depends On**: Task 2.2

### Task 2.4：qr-generate 参数面板 + 6 套美化模板预设（B2-4）
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B2-4 / B2-1
- **改动文件**: `src/pages/ToolPageTemplate.tsx` 的 panels 新增：
  - `'qr-generate'`：① 文本框（content）② 容错等级 4 选 1 ③ 尺寸 4~20px ④ 边距 0~20px ⑤ 前景色/背景色颜色选择器 ⑥ 点阵样式 3 选（方/圆/圆角）⑦ 定位角样式 3 选 ⑧ Logo 上传预览 ⑨ **模板库 6 按钮组**：经典黑白 / 商务蓝 / 活力橙红 / 紫粉渐变 / 科技青绿 / 极简灰 → 每按钮 onClick 一键 setOptions 所有颜色参数
  - `'qr-parse'`：提示信息「可批量上传二维码图片，支持 JPG/PNG/WebP/BMP」
  - `'qr-batch-generate'`：① 多行文本框（每行一条）② 上传 TXT/CSV 按钮（读取后写入 lines 文本框）③ 前缀输入框 ④ 尺寸/容错/颜色通用参数
- **TR (rule)**: qr-generate 页 DOM 检查到「模板库」标题 + ≥6 个模板按钮；点击任一模板后 colors 参数变更（browser_evaluate 验证 React state 或 inputs 值）
- **Depends On**: Task 2.3

### Task 2.5：首页 qr 分类 ReservedCard → 真实卡片联动
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B2-5
- **改动文件**: 无需改代码（Task 2.2 后自动生效）；仅做快照验证
- **TR (rule)**: 首页 cat-qr 板块 4 个卡片中 ≥3 个显示「立即使用 →」
- **Depends On**: Task 2.2

### Task 2.6：批次 2 验收 Build + Tag v1.2.0 + Push + 冒烟
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G6 / B2-1~B2-5
- **步骤同 Task 1.5（规范版本 message + tag v1.2.0 + push + 浏览器 4 页验证）**
- **浏览器测试要点**: qr-generate 输入 URL → 开始生成 → 下载后反向用 qr-parse 解析出相同内容（端到端闭环）；批量生成 10 条 ZIP 解压检查；模板按钮点 2 个验证颜色切换
- **Depends On**: Task 2.4 + Task 2.5

---

## 批次 3 · 图片剩余功能补齐（v1.3.0）→ AC: B3-1~B3-6

### Task 3.1：安装 AI 抠图依赖（可选，失败则降级）
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B3-5 / B3-6
- **改动文件**: `package.json` → 新增 `"@imgly/background-removal": "^1.5.0"`；vite.config.ts 配置 chunk split，wasm 走 lazy import；若 npm 不可用或构建 >50MB 超限，**跳过依赖 + 降级为手动抠图（只保留纯色背景替换）并在 boundaries 标注「AI 模型因环境限制暂未启用，后续上线」**
- **TR (rule)**: package.json 中出现依赖名；或（降级时）tools.ts AI 抠图工具 boundaries 明确写明「AI 未启用」
- **Depends On**: 批次 2 验收（Task 2.6 completed）

### Task 3.2：tools.ts 新增 5 个 image 类工具配置
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B3-1~B3-5 / G3
- **新增 key**: `'image-watermark'`（批量加水印）、`'image-stitch'`（长图拼接）、`'image-split'`（图片分割）、`'image-rotate'`（旋转裁剪）、`'image-remove-bg'`（AI 抠图）
- SEO title/keywords 覆盖：图片加水印、长图拼接、图片切割切片、图片旋转裁剪、AI 抠图在线、背景去除
- 抠图工具 boundaries ≥4 条红色卡片：纯前端本地/发丝不准/首载30-50MB/不上传原图（或降级「AI未启用」）
- **TR (rule)**: image 类工具总数 === 3（批1）+ 5（批3）= 8
- **Depends On**: Task 3.1

### Task 3.3：processors.ts 新增 5 个图片处理器
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B3-1~B3-5 / B3-6
- **实现要点**:
  - imageWatermark: drawText/drawImage 水印 + 透明度 + 平铺/9 宫格
  - imageStitch: 纵向/横向/网格 计算总 canvas → 按序 drawImage；间距填充矩形
  - imageSplit: 按行列或固定大小切片 → 每个 clip → toBlob → ZIP
  - imageRotate: ctx.translate/rotate/drawImage → 四边裁剪像素值 / 比例裁剪
  - imageRemoveBg: `import('@imgly/background-removal')` 动态懒加载 → `removeBackground(image)` → 得到 blob → 叠加自定义背景色或背景图（或降级纯颜色阈值）
- **TR (rule)**: 5 个 ProcessFn 导出；0 fetch/XHR；@imgly 使用 dynamic import() 语法（懒加载 chunk）
- **Depends On**: Task 3.2

### Task 3.4：ToolPageTemplate 新增 5 个参数面板
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B3-1~B3-5
- **panels** 新增 5 条 key 对应控件：水印(文字/图片+位置+透明度)、拼接(方向/间距/对齐/颜色)、分割(行列/固定尺寸)、旋转(角度/翻转/裁剪/比例预设)、抠图(输出模式：透明/纯色/自定义图)
- **TR (rule)**: 5 个工具页打开，参数面板区非空；抠图页合规红色卡片含 4 个关键词
- **Depends On**: Task 3.3

### Task 3.5：批次 3 验收 Build + Tag v1.3.0 + Push + 冒烟
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G6 / B3-1~B3-6
- 同 Task 1.5 规范；tag v1.3.0；浏览器重点验证：长图拼接 3×100×100 → 输出尺寸（TR B3-2）；分割 2×2 → 4 文件（B3-3）；抠图合规卡片样式（B3-5 红色 card 类 `border-red-200 bg-red-50/30`）
- **Depends On**: Task 3.4

---

## 批次 4 · 多媒体轻量工具（v1.4.0）→ AC: B4-1~B4-6

### Task 4.1：tools.ts media 分类 + 6 个工具配置
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B4-1 / B4-2~B4-5 / G3
- **ToolCategory** 新增 media 已在 P0-1 就位
- **工具 key**: `'video-compress'`、`'video-cut'`、`'video-convert'`、`'audio-compress'`、`'audio-cut'`、`'audio-convert'`
- SEO keywords 覆盖：视频压缩、视频裁剪、视频格式转换、GIF动图提取、音频压缩、音频裁剪、MP3格式转换
- 所有多媒体工具 boundaries 必须含：MKV/AVI 不支持；大文件建议桌面端；WebCodecs 不支持时降级精度±0.5s
- **TR (rule)**: media 类 === 6 个；每个 title 带品牌名
- **Depends On**: 批次 3 验收（Task 3.5 completed）+ P0-1 完成

### Task 4.2：processors.ts 新增 6 个多媒体处理器
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B4-2~B4-5
- **技术方案要点**（全部纯前端浏览器 API）：
  - 视频组：`<video>` + `requestVideoFrameCallback` 逐帧绘制到 OffscreenCanvas → WebCodecs VideoEncoder（H264/VP9）→ `MediaStream` + `MediaRecorder` 输出 Blob；降级方案：`<video>.play()` 静音 + `canvas.captureStream()` + MediaRecorder
  - GIF 转换：逐帧 drawImage → `gif.js` 类库 或 canvas → 连续帧 → 自制小 GIF（如无库跳过 GIF 模式，boundaries 说明）
  - 音频组：WebAudio `decodeAudioData` → `AudioBufferSourceNode` + `OfflineAudioContext` 重采样 → `MediaRecorder`(mimeType: audio/webm → 转 MP3/WAV)；裁剪使用 slice 方式
- **TR (rule)**: 6 个 ProcessFn 导出；纯浏览器 API；0 云端调用
- **Depends On**: Task 4.1

### Task 4.3：ToolPageTemplate 新增 6 个参数面板
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B4-2~B4-5
- 视频压缩：分辨率(360/480/720/1080) + 码率(1-12 Mbps)滑块 + 压缩等级
- 视频裁剪：开始秒 / 结束秒输入 + 预览播放器（<video controls）
- 视频格式转换：输出格式(MP4/WebM/GIF/音频) + GIF 帧率+最长边
- 音频压缩：比特率(32~320) + 采样率下拉 + 声道数
- 音频裁剪：波形(可选简易绘制)+ 起止秒
- 音频格式转换：输出格式(MP3/WAV/OGG)
- **TR (rule)**: 6 面板控件全部渲染；首页 media 板块出现 6 卡片（B4-6）
- **Depends On**: Task 4.2

### Task 4.4：首页 media 分类板块渲染验证 + 验收
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B4-6
- 浏览器 snapshot：`cat-media` 板块标题含「多媒体轻量工具」+ 6 个卡片含「立即使用」
- **Depends On**: Task 4.1 + Task 4.3

### Task 4.5：批次 4 验收 Build + Tag v1.4.0 + Push + 冒烟
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G6 / B4-1~B4-6
- 同规范流程；tag v1.4.0；浏览器验证 6 个 media 工具页可进入（SPA 路由）、页面标题/面包屑正确、边界提示有 MKV/AVI 不支持字样
- **Depends On**: Task 4.3 + Task 4.4

---

## 批次 5 · 办公小工具合集（v1.5.0）→ AC: B5-1~B5-6

### Task 5.1：tools.ts office 分类 + 5 个工具配置（fileRequired=false）
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B5-1 / B5-2 / G3
- **工具 key**:
  - `'text-tools'`（文本批量处理，fileRequired=false，可选 .txt 上传）
  - `'work-hours'`（工时计算，fileRequired=false）
  - `'timestamp'`（时间戳转换，fileRequired=false）
  - `'password-gen'`（密码生成，fileRequired=false）
  - `'unit-convert'`（单位换算，fileRequired=false）
- SEO keywords：文本去空格、手机脱敏、繁简转换、文本对比、工时计算器、时间戳转换、Unix时间戳、密码生成、单位换算、数据大小换算
- **TR (rule)**: office 类 === 5；4 个 fileRequired=false（除 text-tools 可选上传）；P0-2 的隐藏上传区机制生效
- **Depends On**: 批次 4 验收（Task 4.5 completed）+ P0-1/P0-2

### Task 5.2：processors.ts 新增 5 个办公处理器 + utils helper
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B5-3 / B5-4 / B5-5
- 要点：
  - textTools: 组合执行去空格/脱敏正则(/^1[3-9]\d/打星) /繁简转换(Task P0-3 字典)/简易 LCS diff
  - workHours: 纯数学计算（Date 差值），返回文本结果 preview
  - timestamp: Date.parse + new Date(x*1000) 双向转换，返回对象 stats
  - passwordGen: crypto.getRandomValues 生成安全随机字符数组（非 Math.random）
  - unitConvert: 静态 8 分类 conversion table → 输入值 × 系数矩阵
- 由于 4 个工具无文件输入，processor 直接从 options 读取输入（不读 files[]）
- **TR (rule)**: 5 个 ProcessFn 导出；passwordGen 使用 `crypto.getRandomValues` 非 `Math.random`（代码 grep 验证）
- **Depends On**: Task 5.1

### Task 5.3：ToolPageTemplate 新增 5 个参数面板 + 结果展示增强
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B5-2 / B5-3 / B5-4 / B5-5
- **panels** 各 key 对应 UI：
  - text-tools：左右双文本框（支持 diff 对比模式）+ 6 个多选框（去空格/去空行/去重/脱敏/繁→简/简→繁）+ diff checkbox
  - work-hours：3 模式 tab（打卡差/累计/工资估算）+ 对应 inputs
  - timestamp：当前实时戳显示 + 戳→日期 + 日期→戳 双列
  - password-gen：长度滑块(4-128) + 4 字符类 checkbox + 易混排除 checkbox + 批量 1-50
  - unit-convert：分类 tab(8 个) + 每类 N 个 input 联动（任一输入其他项自动更新）
- 由于 fileRequired=false，ResultCard preview.text 显示区在这些工具页用于展示计算结果（TXT 下载由 processor 返回 Blob）
- **TR (rule)**: SPA 进入 4 个 fileRequired=false 页 → DOM 无 `<input type=file>`（B5-2 rule）；密码页含「完全本地生成」安全提示；单位换算页 ≥8 分类 tab
- **Depends On**: Task 5.2

### Task 5.4：首页 office 分类验证
- **Status**: pending
- **Priority**: medium
- **覆盖 AC**: B5-6
- 浏览器 snapshot：`cat-office` 板块标题+5 卡片+立即使用
- **Depends On**: Task 5.1

### Task 5.5：批次 5 验收 Build + Tag v1.5.0 + Push + 冒烟
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: G6 / B5-1~B5-6
- 规范流程；tag v1.5.0；浏览器重点端到端验证：密码生成(128长度,50条,排除易混) → 输出结果长度合规；时间戳 1700000000 → 转为正确北京时间；繁简「後→后」转换成功
- **Depends On**: Task 5.3 + Task 5.4

---

## 批次 6 · 云端增强架构预留（v1.6.0）→ AC: B6-1~B6-6

### Task 6.1：新建 useMode Hook
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B6-1
- 新建 `src/core/mode.ts`：
  ```ts
  import { useState, useEffect } from 'react';
  const KEY = 'mf_mode_cloud';
  export function useMode() {
    const [v, setV] = useState(() => sessionStorage.getItem(KEY) === '1');
    useEffect(() => { try { sessionStorage.setItem(KEY, v ? '1' : '0'); } catch {} }, [v]);
    return { isCloudEnhanced: v, toggle: () => setV(x => !x) };
  }
  ```
- 不得出现任何 fetch；仅 sessionStorage 布尔读写
- **TR (rule)**: grep mode.ts 0 命中 fetch/XHR/sendBeacon/WebSocket；返回类型正确
- **Depends On**: 批次 5 验收（Task 5.5 completed）

### Task 6.2：新建 CloudEnhanceModal 组件（纯 UI + 勾选，无任何网络代码）
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B6-2 / B6-3
- 新建 `src/components/CloudEnhanceModal.tsx`：
  - 接收 onClose / open props
  - 标题「⚡ 云端增强模式（未来功能，敬请期待）」
  - 3 段文案占位（严格按 spec 6.3 内容）
  - 3 个 checkbox（授权 A/B/C 勾选项，默认全 false）
  - 「确认开启」按钮 disabled={true}（永远不可点），title="敬请期待"
  - 「继续使用纯本地模式」按钮 onClick={onClose}
  - 样式：复用一期 modal 风格（如果一期没通用 modal，则用 div fixed inset-0 backdrop-blur + card 样式）
- **严格红线检查**：文件内不得出现任何网络请求关键字
- **TR (rule, B6-3)**: `grep -E "fetch|XMLHttpRequest|WebSocket|sendBeacon" CloudEnhanceModal.tsx` → 0 命中
- **Depends On**: Task 6.1

### Task 6.3：SiteHeader 接入云端模式按钮 + SecurityBanner 条件行
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B6-4 / B6-5
- `src/components/SiteHeader.tsx`：
  - import CloudEnhanceModal + useMode（不使用 toggle 状态，仅 useState 控制 modal 打开）
  - 导航栏右侧在「官方域名 mendfile.com」旁加小按钮 `⚡ 云端模式`（opacity-75 + chip 样式）
  - onClick → setModalOpen(true)
- `src/layouts/MainLayout.tsx` + `SecurityBanner.tsx`：
  - SecurityBanner 下方新增条件渲染行（默认 false，不显示）：
  ```tsx
  const { isCloudEnhanced } = useMode();
  {isCloudEnhanced && (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 ...">
      💡 当前处于云端增强模式，部分工具使用云端算力加速；点击顶部可随时切回纯本地模式
    </div>
  )}
  ```
- **TR (rule)**: SiteHeader 快照含「⚡ 云端模式」按钮；SecurityBanner 下方行 DOM 存在但 class 有条件（默认不渲染可见内容）
- **Depends On**: Task 6.2

### Task 6.4：批次 6 最终验收 Build + Tag v1.6.0 + Push + 冒烟 + 全局 AC 检查
- **Status**: pending
- **Priority**: high
- **覆盖 AC**: B6-6 / G1~G7（全局最终 AC 一次检查）
- 步骤：
  1. Build（node 可用时）
  2. Git commit message 严格包含：「架构预留｜不包含任何云端功能代码｜仅埋入入口和授权结构」（B6-6 rule）
  3. Tag v1.6.0 → push origin main + tag
  4. 浏览器全局冒烟：
     - 总工具卡片数 = 13(PDF)+8(image)+3(qr)+6(media)+5(office) = 35 个（QR+图片原ReservedCard 4×2=8 个槽位实际填 8 个 → 35+ 符合 G1）
     - SecurityBanner 所有非云端页面正常显示（G4）
     - 云端模式按钮 → modal 打开：3 勾选框存在，确认开启 disabled，关闭按钮可用
     - Console 0 错误，Network 无 beacon.min.js(未填 Token)/无 Cloudflare fetch
  5. 全局 grep：processors.ts + components 新增代码 0 命中 fetch/XHR/sendBeacon/WebSocket（G2 红线）
- **Completion Evidence**: 浏览器全局报告；git tag 6 个(v1.1.0~v1.6.0) ls-remote 全在；G1-G7 AC 检查表每条通过记录
- **Depends On**: Task 6.3

---

## 全局任务依赖图（简述）

```
P0-1 → P0-2 → Batch 1 (Task 1.1-1.5) → Batch 2 (2.1-2.6) → Batch 3 (3.1-3.5) → Batch 4 (4.1-4.5) → Batch 5 (5.1-5.5) → Batch 6 (6.1-6.4) → Review Final
P0-3 与 P0-1/P0-2 并行（无依赖）
```

---

## 任务状态总览（初始）

| ID | 标题 | 批次 | Status | 优先级 |
|----|------|------|--------|-------|
| P0-1 | ToolConfig 扩展 + ToolCategory 枚举新增 | 基础设施 | pending | high |
| P0-2 | ToolPageTemplate 支持 fileRequired=false | 基础设施 | pending | high |
| P0-3 | 繁简字库准备 | 基础设施 | pending | medium |
| 1.1 | tools.ts 新增 3 个图片工具配置 | 1 | pending | high |
| 1.2 | processors.ts 新增 3 个图片处理器 | 1 | pending | high |
| 1.3 | OptionsPanel 新增 3 图片参数面板 | 1 | pending | high |
| 1.4 | 首页 image 分类联动验证 | 1 | pending | medium |
| 1.5 | **批次 1 验收 (v1.1.0)** | 1 | pending | high |
| 2.1 | 安装 jsqr + qrcode 依赖 | 2 | pending | high |
| 2.2 | tools.ts 新增 3 二维码工具配置 | 2 | pending | high |
| 2.3 | processors.ts 新增 3 二维码处理器 | 2 | pending | high |
| 2.4 | qr-generate 参数面板 + 6 模板 | 2 | pending | high |
| 2.5 | 首页 qr 分类联动验证 | 2 | pending | medium |
| 2.6 | **批次 2 验收 (v1.2.0)** | 2 | pending | high |
| 3.1 | 安装 AI 抠图依赖 @imgly | 3 | pending | medium |
| 3.2 | tools.ts 新增 5 图片补齐工具 | 3 | pending | high |
| 3.3 | processors.ts 新增 5 图片处理器 | 3 | pending | high |
| 3.4 | OptionsPanel 新增 5 面板 | 3 | pending | high |
| 3.5 | **批次 3 验收 (v1.3.0)** | 3 | pending | high |
| 4.1 | tools.ts media 分类 + 6 工具配置 | 4 | pending | high |
| 4.2 | processors.ts 新增 6 多媒体处理器 | 4 | pending | high |
| 4.3 | OptionsPanel 新增 6 媒体参数面板 | 4 | pending | high |
| 4.4 | 首页 media 分类验证 | 4 | pending | medium |
| 4.5 | **批次 4 验收 (v1.4.0)** | 4 | pending | high |
| 5.1 | tools.ts office 分类 + 5 工具 (4×fileRequired=false) | 5 | pending | high |
| 5.2 | processors.ts 新增 5 办公处理器 | 5 | pending | high |
| 5.3 | OptionsPanel 新增 5 办公参数面板 + 结果增强 | 5 | pending | high |
| 5.4 | 首页 office 分类验证 | 5 | pending | medium |
| 5.5 | **批次 5 验收 (v1.5.0)** | 5 | pending | high |
| 6.1 | useMode Hook (纯布尔开关 + sessionStorage) | 6 | pending | high |
| 6.2 | CloudEnhanceModal (纯 UI + 3 勾选，disabled) | 6 | pending | high |
| 6.3 | SiteHeader 云端按钮 + SecurityBanner 条件行 | 6 | pending | high |
| 6.4 | **批次 6 最终验收 (v1.6.0) + 全局 AC 检查** | 6 | pending | high |

---

> 本 tasks.md 在用户批准 spec.md 后开始执行，按批次严格顺序，严格遵守『完成一批 → 验收一批 → 打 tag → 推送 → 下一批』的交付节奏。
