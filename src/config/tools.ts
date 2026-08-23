/**
 * 工具配置中心：全站所有工具路由、SEO 元信息、功能分类、输入/输出类型、
 * 功能边界提示、默认参数等均在此集中维护。后续新增工具只需在此增加一条配置并
 * 在 processors 中注册对应处理器即可完成接入。
 */
import type { ProcessFn } from '@/core/types';
import * as P from '@/core/processors';

export type ToolCategory =
  | 'convert' // 转换类
  | 'organize' // 整理编辑
  | 'watermark' // 水印安全
  | 'optimize' // 轻量化优化
  | 'qr' // 二维码工具
  | 'image' // 图片工具全集
  | 'media' // 多媒体轻量工具（二期新增）
  | 'office' // 办公小工具合集（二期新增）
  | 'diagram'; // 在线设计：流程图 / 平面图 / 时序图

export interface ToolConfig {
  key: string;
  path: string;
  name: string;
  shortDesc: string;
  category: ToolCategory;
  icon: string; // emoji 占位，轻量无需引入图标库
  /** SEO */
  title: string;
  description: string;
  keywords: string[];
  /** 能力描述 */
  features: string[];
  /** 功能边界/不适用场景，页面固定展示合规提示 */
  boundaries: string[];
  /** 输入输出 */
  accept: string; // input accept
  multiple: boolean; // 是否允许多文件
  outputExt: string; // 输出文件拓展名
  outputFileName: string; // 默认输出文件名（不含拓展名）
  /** 默认参数 */
  defaultOptions: Record<string, any>;
  /** 处理器 */
  processor: ProcessFn<any, any>;
  /** 页面是否需要预览区（除纯文本等） */
  showPreview: boolean;
  /** 工具是否需要上传文件（默认 true）：false 时隐藏上传区+文件列表，直接显示参数面板+结果区 */
  fileRequired?: boolean;
  /** 边界提示卡片样式：'amber'(默认黄) / 'red'(红警告，用于合规高风险类如AI抠图/证件照) */
  boundaryCardStyle?: 'amber' | 'red';
}

export const CATEGORY_META: Record<ToolCategory, { name: string; desc: string; color: string }> = {
  convert: { name: '核心转换类', desc: 'PDF与Word/图片/TXT的互相转换，主打引流', color: 'from-sky-500 to-blue-600' },
  organize: { name: 'PDF整理编辑', desc: '合并、拆分、旋转、裁剪、调序', color: 'from-violet-500 to-indigo-600' },
  watermark: { name: '水印与安全', desc: '去水印、加水印、加密解密', color: 'from-rose-500 to-pink-600' },
  optimize: { name: '轻量化优化', desc: '压缩、加页码、元数据修改', color: 'from-emerald-500 to-teal-600' },
  qr: { name: '二维码工具', desc: '二维码生成、美化、批量解析、批量生成打包', color: 'from-amber-500 to-orange-600' },
  image: { name: '图片长图工具', desc: '图片压缩、格式互转、证件照、拼接、抠图、加水印', color: 'from-fuchsia-500 to-purple-600' },
  media: { name: '多媒体轻量工具', desc: '视频压缩裁剪格式转换、音频压缩裁剪格式转换', color: 'from-cyan-500 to-blue-500' },
  office: { name: '办公小工具合集', desc: '文本批量处理、工时/时间戳/密码生成/单位换算', color: 'from-lime-500 to-green-600' },
  diagram: { name: '在线设计', desc: '在线流程图、平面图、时序图设计，支持保存/导入/导出PDF/JPG/PNG', color: 'from-indigo-500 to-purple-600' },
};

export const TOOLS_CONFIG: Record<string, ToolConfig> = {
  'pdf-to-word': {
    key: 'pdf-to-word',
    path: '/tools/pdf-to-word',
    name: 'PDF转Word',
    shortDesc: '文本型PDF精准转换，保留排版、字体与段落格式',
    category: 'convert',
    icon: '📄',
    title: 'PDF转Word 免费在线无需登录 - MendFile 全能办公工具',
    description: 'MendFile 提供免费PDF转Word在线工具，纯前端本地处理文件不上传，支持单页或批量转换，最大程度保留原文档排版、字体和段落格式。扫描版PDF无法精准转为可编辑文字，请知悉。',
    keywords: ['pdf转word', 'pdf转word免费无需登录', '在线pdf转word可编辑', 'pdf转docx本地处理'],
    features: [
      '文本型 PDF 精准转换，保留排版、字体、段落格式',
      '支持单页/多页指定转换，批量文件处理',
      '生成标准 .docx 文件，Microsoft Word / WPS 可直接打开',
      '全程浏览器本地解析，文件不离开您的设备',
    ],
    boundaries: [
      '扫描版 PDF、图片型 PDF 无法精准转为可编辑文字（请使用 OCR 方案）',
      '极其复杂的排版、公式、表格可能出现格式差异，建议转换后人工复核',
      '加密 PDF 请先使用本站 PDF 解密工具解除保护后再转换',
    ],
    accept: '.pdf',
    multiple: true,
    outputExt: 'docx',
    outputFileName: 'MendFile_PDF转Word结果',
    defaultOptions: { mode: 'layout' },
    processor: P.pdfToWord,
    showPreview: false,
  },
  'pdf-to-image': {
    key: 'pdf-to-image',
    path: '/tools/pdf-to-image',
    name: 'PDF转图片',
    shortDesc: '高清无压缩导出PNG/JPG，支持单页/整页/批量',
    category: 'convert',
    icon: '🖼️',
    title: 'PDF转图片 高清PNG/JPG免费在线 - MendFile 全能办公工具',
    description: 'MendFile PDF转图片工具支持将PDF按页导出为高清PNG或JPG图片，本地渲染无损质量，可单页或批量一键打包ZIP下载。',
    keywords: ['pdf转图片', 'pdf转png', 'pdf转jpg', 'pdf转图片高清', 'pdf导出图片'],
    features: [
      '支持 PNG / JPG 两种格式，PNG 为无损高清',
      '支持单页、指定页范围、整页导出',
      '多页自动打包 ZIP 下载，单个文件直接下载',
      '渲染分辨率可调（默认 150 DPI，最高 300 DPI）',
    ],
    boundaries: [
      '超大文件（>200MB）在低配置设备上可能需要较长时间',
      '加密 PDF 请先解密再转换',
    ],
    accept: '.pdf',
    multiple: false,
    outputExt: 'zip',
    outputFileName: 'MendFile_PDF转图片结果',
    defaultOptions: { format: 'png', dpi: 150 },
    processor: P.pdfToImage,
    showPreview: true,
  },
  'image-to-pdf': {
    key: 'image-to-pdf',
    path: '/tools/image-to-pdf',
    name: '图片转PDF',
    shortDesc: '多图合成，支持拖拽排序、自定义页面尺寸与边距',
    category: 'convert',
    icon: '🏞️',
    title: '图片转PDF 多张图片合成PDF 免费在线 - MendFile 全能办公工具',
    description: 'MendFile 图片转PDF支持JPG/PNG/WEBP/BMP多张图片批量合成为一个PDF，可拖拽排序、自定义页面尺寸与边距，浏览器本地生成无泄露。',
    keywords: ['图片转pdf', 'jpg转pdf', 'png转pdf', '多张图片合成pdf', '图片合并为pdf'],
    features: [
      '支持 JPG / PNG / WEBP / BMP 等主流图片格式',
      '拖拽排序，批量上传，数量无限制',
      '自定义页面尺寸（A4/原图/自定义宽高）与内边距',
      '可选图片自适应页面或保留原图尺寸',
    ],
    boundaries: [
      '超大分辨率单张图片在部分移动设备上可能出现加载慢',
      'SVG 等矢量图需先转为位图再上传',
    ],
    accept: 'image/jpeg,image/png,image/webp,image/bmp',
    multiple: true,
    outputExt: 'pdf',
    outputFileName: 'MendFile_图片转PDF结果',
    defaultOptions: { pageSize: 'a4', margin: 20, fit: 'contain' },
    processor: P.imageToPdf,
    showPreview: true,
  },
  'pdf-to-txt': {
    key: 'pdf-to-txt',
    path: '/tools/pdf-to-txt',
    name: 'PDF转TXT',
    shortDesc: '一键提取纯文本，支持在线复制、TXT下载',
    category: 'convert',
    icon: '📝',
    title: 'PDF转TXT 提取纯文本 免费在线 - MendFile 全能办公工具',
    description: 'MendFile PDF转TXT一键提取PDF中文本内容，支持在线预览复制、批量TXT下载，纯前端本地处理无登录无广告。',
    keywords: ['pdf转txt', 'pdf提取文字', 'pdf文本提取', 'pdf转纯文本'],
    features: [
      '文本型 PDF 一键提取纯文本，在线预览复制',
      '批量文件自动打包 ZIP 下载',
      '保留基础换行结构，支持按页导出',
      '全本地处理，零上传零泄露',
    ],
    boundaries: [
      '扫描版/图片型 PDF 无法提取文字',
      '艺术字、特殊符号可能出现乱码，请人工复核',
    ],
    accept: '.pdf',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_PDF转TXT结果',
    defaultOptions: { lineBreak: 'crlf' },
    processor: P.pdfToTxt,
    showPreview: true,
  },
  'pdf-merge': {
    key: 'pdf-merge',
    path: '/tools/pdf-merge',
    name: 'PDF合并',
    shortDesc: '多文件上传、拖拽排序、页面预览，一键合并下载',
    category: 'organize',
    icon: '🔗',
    title: 'PDF合并 在线合并多个PDF文件 - MendFile 全能办公工具',
    description: 'MendFile 在线PDF合并工具支持多文件拖拽排序、无数量限制一键合并下载，全程纯前端本地处理安全无泄露。',
    keywords: ['pdf合并', '在线pdf合并', 'pdf文件合并', '合并多个pdf'],
    features: [
      '支持任意数量 PDF 合并，无文件数量限制',
      '拖拽排序，支持单文件预览页面数与大小',
      '保留原文件书签（基于 pdf-lib 支持范围内）',
      '极速合并，大文件友好',
    ],
    boundaries: ['加密 PDF 请先解密后再合并', '表单域与复杂签名可能在合并后失效'],
    accept: '.pdf',
    multiple: true,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF合并结果',
    defaultOptions: {},
    processor: P.pdfMerge,
    showPreview: true,
  },
  'pdf-split': {
    key: 'pdf-split',
    path: '/tools/pdf-split',
    name: 'PDF拆分',
    shortDesc: '按页码范围/均等拆分/提取指定页，ZIP打包下载',
    category: 'organize',
    icon: '✂️',
    title: 'PDF拆分 按页拆分PDF文件 免费在线 - MendFile 全能办公工具',
    description: 'MendFile PDF拆分工具支持按页码范围拆分、均等拆分、提取指定页面三种模式，拆分结果自动打包ZIP下载，本地处理无广告。',
    keywords: ['pdf拆分', '在线pdf拆分', 'pdf按页拆分', '提取pdf页面'],
    features: [
      '按页面范围拆分（如 1-3,5,8-10）',
      '均等拆分（按每 N 页切分）',
      '提取指定页面，生成单个 PDF',
      '拆分结果自动打包 ZIP 下载',
    ],
    boundaries: ['加密 PDF 请先解密后再拆分'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'zip',
    outputFileName: 'MendFile_PDF拆分结果',
    defaultOptions: { mode: 'ranges', ranges: '', every: 2, pages: '' },
    processor: P.pdfSplit,
    showPreview: true,
  },
  'pdf-pages': {
    key: 'pdf-pages',
    path: '/tools/pdf-pages',
    name: '页面编辑',
    shortDesc: '页面旋转90°/180°、删除冗余页、拖拽排序、边距裁剪',
    category: 'organize',
    icon: '📐',
    title: 'PDF页面编辑 旋转 删除 排序 裁剪 - MendFile 全能办公工具',
    description: 'MendFile PDF页面编辑支持单页90°/180°旋转、删除冗余页、拖拽调整页面顺序、页面边距裁剪，所见即所得配置一键生成。',
    keywords: ['pdf页面旋转', 'pdf删除页面', 'pdf页面排序', 'pdf裁剪边距', 'pdf页面编辑'],
    features: [
      '页面 90° 顺时针/逆时针、180° 旋转',
      '勾选冗余页面一键删除',
      '拖拽调整页面顺序',
      '上下左右裁剪边距，可单独或统一设置',
    ],
    boundaries: ['裁剪会改变页面尺寸，不支持矢量路径级精确删除'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF页面编辑结果',
    defaultOptions: { rotations: {} as Record<number, number>, remove: [] as number[], order: [] as number[], crop: { top: 0, bottom: 0, left: 0, right: 0 } },
    processor: P.pdfPagesEdit,
    showPreview: true,
  },
  'pdf-remove-watermark': {
    key: 'pdf-remove-watermark',
    path: '/tools/pdf-remove-watermark',
    name: 'PDF去水印',
    shortDesc: '智能去除常规文字水印、半透明办公水印',
    category: 'watermark',
    icon: '🧹',
    title: 'PDF去水印 在线本地去除文字水印 - MendFile 全能办公工具',
    description: 'MendFile PDF去水印工具支持纯前端智能去除常规文字水印与半透明办公水印。复杂图片水印、背景水印无法完全去除，请知悉功能边界。',
    keywords: ['pdf去水印', '在线pdf去水印', 'pdf去除水印', 'pdf文字水印去除'],
    features: [
      '自动识别并移除页面中的常规文字水印对象',
      '半透明叠加型办公水印高命中率清理',
      '保留正文内容与矢量图形，不破坏排版',
      '本地处理，文件不上传',
    ],
    boundaries: [
      '⚠️ 复杂图片水印、背景底纹、整页扫描背景无法完全去除',
      '⚠️ 已渲染为位图像素的水印仅能使用图片编辑方式处理（后续上线）',
      '⚠️ 对于特殊字体或转曲的艺术水印，可能需要手动二次处理',
    ],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF去水印结果',
    defaultOptions: { aggressive: true },
    processor: P.pdfRemoveWatermark,
    showPreview: true,
  },
  'pdf-add-watermark': {
    key: 'pdf-add-watermark',
    path: '/tools/pdf-add-watermark',
    name: 'PDF添加水印',
    shortDesc: '自定义文字/图片水印，可调透明度、角度、位置、密度',
    category: 'watermark',
    icon: '💧',
    title: 'PDF添加水印 自定义文字图片水印 - MendFile 全能办公工具',
    description: 'MendFile PDF添加水印支持自定义文字或图片水印，可调整透明度、旋转角度、位置、密度，批量全页一键添加，全程本地。',
    keywords: ['pdf加水印', 'pdf添加文字水印', 'pdf添加图片水印', 'pdf批量水印'],
    features: [
      '支持文字水印与图片水印两种模式',
      '透明度、旋转角度、字号、颜色任意调整',
      '支持居中/四角/平铺（密集平铺水印）位置',
      '批量全页或指定页范围添加',
    ],
    boundaries: ['图片水印超过原图分辨率会被自动缩放'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF加水印结果',
    defaultOptions: {
      mode: 'text',
      text: 'MendFile.com',
      fontSize: 36,
      color: '#94a3b8',
      opacity: 0.3,
      rotation: -30,
      layout: 'tile', // center / corners / tile
      image: '', // base64 data url
    },
    processor: P.pdfAddWatermark,
    showPreview: true,
  },
  'pdf-encrypt': {
    key: 'pdf-encrypt',
    path: '/tools/pdf-encrypt',
    name: 'PDF加密解密',
    shortDesc: '本地设置密码加密PDF / 解除已知密码保护',
    category: 'watermark',
    icon: '🔐',
    title: 'PDF加密解密 本地设置密码保护 - MendFile 全能办公工具',
    description: 'MendFile PDF加密解密工具可本地设置用户/所有者密码加密PDF，或输入已知密码解除保护，全程本地操作，无密码泄露风险。',
    keywords: ['pdf加密', 'pdf解密', 'pdf密码保护', 'pdf去除密码', 'pdf加密解密'],
    features: [
      '设置打开密码（user password）加密 PDF',
      '设置权限密码（owner password）控制打印/复制/编辑',
      '输入已知密码一键解除保护',
      '密码仅存于内存，处理完即刻释放',
    ],
    boundaries: ['忘记密码的加密 PDF 无法解除，请勿用于非法用途'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF加密解密结果',
    defaultOptions: { mode: 'encrypt', userPassword: '', ownerPassword: '', permissions: { print: true, copy: true, modify: true }, inputPassword: '' },
    processor: P.pdfEncrypt,
    showPreview: false,
  },
  'pdf-compress': {
    key: 'pdf-compress',
    path: '/tools/pdf-compress',
    name: 'PDF压缩',
    shortDesc: '普通压缩 / 极致压缩双模式，大幅缩减体积',
    category: 'optimize',
    icon: '📦',
    title: 'PDF压缩 免费无广告大幅减小文件体积 - MendFile 全能办公工具',
    description: 'MendFile PDF压缩工具提供普通压缩与极致压缩双模式，通过重采样图片、优化对象与字体大幅缩减文件体积，高清无损可选。',
    keywords: ['pdf压缩', '在线pdf压缩', 'pdf减小体积', 'pdf压缩高清', '无广告pdf压缩工具'],
    features: [
      '普通压缩：在清晰度与体积之间平衡',
      '极致压缩：最大程度压缩，体积最小',
      '可选仅压缩图片 / 仅移除无用对象',
      '实时显示压缩率与前后大小对比',
    ],
    boundaries: ['纯矢量/文本型 PDF 压缩率有限，属正常现象'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF压缩结果',
    defaultOptions: { level: 'normal' as 'normal' | 'extreme' },
    processor: P.pdfCompress,
    showPreview: false,
  },
  'pdf-page-number': {
    key: 'pdf-page-number',
    path: '/tools/pdf-page-number',
    name: 'PDF添加页码',
    shortDesc: '自定义页码样式、位置、起始页数，批量一键添加',
    category: 'optimize',
    icon: '🔢',
    title: 'PDF添加页码 自定义样式位置 免费在线 - MendFile 全能办公工具',
    description: 'MendFile PDF添加页码支持自定义页码样式（罗马数字/阿拉伯数字）、位置（页脚页眉8点）、起始页数、字体颜色，全本地一键添加。',
    keywords: ['pdf添加页码', 'pdf页码', 'pdf插入页码', 'pdf自动页码'],
    features: [
      '8 个位置可选：左上/中上/右上、左下/中下/右下、内/外侧（对开）',
      '阿拉伯数字 / 罗马数字 / 中文数字多种样式',
      '自定义起始页码、字号、颜色与边距',
      '批量添加，支持指定页面范围',
    ],
    boundaries: ['不会自动覆盖原页码，如需替换请先删除原页码'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF添加页码结果',
    defaultOptions: { position: 'bottom-center', style: '1,2,3', start: 1, fontSize: 12, color: '#334155', margin: 20 },
    processor: P.pdfPageNumber,
    showPreview: true,
  },
  'pdf-metadata': {
    key: 'pdf-metadata',
    path: '/tools/pdf-metadata',
    name: 'PDF元数据修改',
    shortDesc: '本地修改作者/标题/创建时间等隐藏元数据，保护隐私',
    category: 'optimize',
    icon: '🏷️',
    title: 'PDF元数据修改 修改作者标题隐私信息 - MendFile 全能办公工具',
    description: 'MendFile PDF元数据修改工具可本地修改PDF的作者、标题、主题、关键词、创建时间等隐藏元数据，保护敏感隐私信息不泄露。',
    keywords: ['pdf元数据修改', 'pdf修改作者', 'pdf修改标题', 'pdf隐私保护'],
    features: [
      '修改 title / author / subject / keywords',
      '修改创建时间与修改时间',
      '一键清空敏感元数据',
      '生成全新 PDF 拷贝，不修改用户原文件',
    ],
    boundaries: ['XMP 元数据部分由生产者写入，本工具优先处理 Info 字典'],
    accept: '.pdf',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_PDF元数据修改结果',
    defaultOptions: { title: '', author: '', subject: '', keywords: '', creator: 'MendFile.com', clear: false },
    processor: P.pdfMetadata,
    showPreview: false,
  },

  /* =====================================
   *  二期 · 批次 1 · 图片工具全集
   * ===================================== */
  'image-compress': {
    key: 'image-compress',
    path: '/tools/image-compress',
    name: '图片批量压缩',
    shortDesc: '三档压缩（轻度/标准/极致），批量处理 JPG/PNG/WebP，体积最大减少 80%',
    category: 'image',
    icon: '🗜️',
    title: '图片压缩在线 批量JPG PNG WebP - MendFile 全能办公工具',
    description: 'MendFile 图片压缩在线工具支持 JPG、PNG、WebP 三种格式批量压缩，三档模式任选（轻度/标准/极致），纯前端浏览器本地处理，文件不上传服务器，单张输出或批量打包 ZIP 下载。',
    keywords: ['图片压缩在线', '图片批量压缩', 'jpg压缩', 'png压缩', 'webp压缩', '免费图片压缩', '图片压缩不改变尺寸', '手机图片压缩'],
    features: [
      '三档压缩模式：轻度（85%视觉无损）/ 标准（70%推荐，体积↓30~50%）/ 极致（45%+最长边1920px缩放，体积↓60~80%）',
      '支持 JPG / PNG / WebP 全覆盖，批量上传多文件一键处理',
      '实时显示每张压缩前后大小与总压缩率，一目了然',
      '全程浏览器本地运行，您的照片绝不上传任何服务器',
    ],
    boundaries: [
      '已经压缩过的图片再次压缩收益有限，不建议重复操作',
      'GIF 动图、SVG 矢量图、ICO 图标格式暂不支持（未来将在独立 GIF 工具上线）',
      '超过 4K 分辨率的超大单张图片在低端手机上可能需要较长时间',
    ],
    accept: 'image/jpeg,image/png,image/webp',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_图片压缩结果',
    defaultOptions: { level: 'normal' }, // light | normal | extreme
    processor: P.imageCompress,
    showPreview: true,
  },
  'image-convert': {
    key: 'image-convert',
    path: '/tools/image-convert',
    name: '图片格式互转',
    shortDesc: 'JPG / PNG / WebP / BMP 批量互转，透明通道 PNG 转 JPG 自动填充底色',
    category: 'image',
    icon: '🔄',
    title: '图片格式互转 JPG转PNG转WebP - MendFile 全能办公工具',
    description: 'MendFile 图片格式互转工具支持 JPG、PNG、WebP、BMP 四种位图格式批量转换，PNG 透明图转 JPG 可自定义底色，质量参数可调，纯前端本地转换无泄露。',
    keywords: ['图片格式转换', 'jpg转png', 'jpg转webp', 'png转jpg', '批量图片格式转换', 'png转webp', 'webp转jpg', 'bmp转jpg'],
    features: [
      '支持 JPG / PNG / WebP / BMP 四种常见位图格式互转，默认保持原格式',
      'JPG 与 WebP 提供质量滑块 10~100 自定义压缩比',
      'PNG 转 JPG/BMP 透明通道自动填充背景色（可自定义填充颜色，默认纯白）',
      '多文件打包 ZIP 下载，单文件直接输出；全程本地不联网',
    ],
    boundaries: [
      'SVG 矢量图、GIF 动图、ICO、AVIF 等非位图格式暂不支持',
      '带透明通道 PNG 转无透明格式时，透明区域会被填充底色，这是格式特性',
    ],
    accept: 'image/jpeg,image/png,image/webp,image/bmp',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_图片格式转换结果',
    defaultOptions: { format: 'same', quality: 85, fillColor: '#ffffff' },
    processor: P.imageConvert,
    showPreview: true,
  },
  'id-photo': {
    key: 'id-photo',
    path: '/tools/id-photo',
    name: '智能证件照工具',
    shortDesc: '一寸二寸等 6 种模板一键裁切，支持白/蓝/红/渐变/自定义 5 种换底，附 6 张拼版',
    category: 'image',
    icon: '🪪',
    title: '智能证件照 换底色 一寸二寸模板 - MendFile 全能办公工具',
    description: 'MendFile 智能证件照工具提供一寸、二寸、小一寸、小二寸、大一寸、护照签证等 6 种标准尺寸模板，支持一键更换背景色（白/蓝/红/渐变蓝/自定义），纯前端 Canvas 颜色阈值换底不上传，附带 6 张可打印拼版。',
    keywords: ['证件照换底色', '一寸证件照', '二寸证件照', '证件照制作', '护照签证照片', '证件照蓝色背景', '证件照红色背景', '证件照电子版制作'],
    features: [
      '6 套标准尺寸模板一键切换 + 自定义宽高像素级精准控制',
      '5 种换底模式：保留原色 / 白色 / 蓝色 (#438EDB) / 红色 (#D9383E) / 渐变蓝 / 自定义颜色',
      '自动按模板比例居中裁剪，边缘羽化 2px 避免硬边',
      '3 种输出模式：单张 JPG / 6 张 2×3 拼版 JPG / 两者打包 ZIP 直接打印',
    ],
    boundaries: [
      '⚠️ 本工具为普通颜色阈值换底算法（基于 Canvas 色差替换），并非 AI 人像分割；与专业 AI 抠图服务存在精度差异',
      '⚠️ 对于复杂背景（非纯色墙面）、卷发边缘、透明/纱质衣物、前景色与底色相近的照片，可能出现边缘残留或误替换',
      '⚠️ 身份证、护照、签证、考试报名等正式证件请务必使用专业照相馆拍摄，本工具仅适合临时日常场景、简历、打印小样等非正式用途',
      '⚠️ 本工具不提供人脸识别、人像提取、自动对齐肩线等高级能力，请自行保证人像位置与构图符合证件规范',
    ],
    boundaryCardStyle: 'red',
    accept: 'image/jpeg,image/png,image/webp',
    multiple: false,
    outputExt: 'jpg',
    outputFileName: 'MendFile_证件照结果',
    defaultOptions: {
      template: '1inch',
      customW: 295,
      customH: 413,
      bgMode: 'keep', // keep | white | blue | red | gradient | custom
      customColor: '#ffffff',
      output: 'single', // single | layout | both
    },
    processor: P.idPhoto,
    showPreview: true,
  },

  // =======================================================
  // 批次 2 · 二维码工具全集（留存主力）
  // =======================================================
  'qr-generate': {
    key: 'qr-generate',
    path: '/tools/qr-generate',
    name: '美化二维码生成器',
    shortDesc: '免费在线一键生成高辨识度美化二维码，6 套主题模板，支持 Logo 叠加、PNG/SVG 矢量输出',
    category: 'qr',
    icon: '🎨',
    title: '美化二维码生成器 免费在线 Logo嵌入 - MendFile 全能办公工具',
    description: 'MendFile 免费在线美化二维码生成器，支持商务蓝、樱花粉、渐变金等 6 套一键主题模板，自定义前背景色、圆角点样式、Logo 图片叠加，PNG/SVG 双格式高清输出，纯前端本地生成，内容不上传服务器。',
    keywords: ['美化二维码生成器', '免费在线二维码生成', 'Logo嵌入二维码', '商务二维码', 'SVG矢量二维码', '樱花粉二维码', '二维码自定义颜色'],
    features: [
      '6 套一键主题模板：商务蓝 / 极简黑 / 樱花粉 / 渐变金 / 科技青 / 复古棕，切换即应用配色与圆角样式',
      '4 级容错（L/M/Q/H，H 支持 30% 面积 Logo 覆盖），尺寸 128~2000px 自由调节',
      '前背景色自由组合，点样式支持方形 / 圆角 / 圆点 3 种视觉效果',
      '支持 Logo 图片叠加（居中自动缩放至容错安全区 20%），输出 PNG 位图 或 SVG 矢量',
    ],
    boundaries: [
      '⚠️ 纯前端本地生成，所有内容与图案均在您浏览器内计算完成，绝不上传服务器，不保存任何二维码图案',
      '⚠️ 链接类二维码生成后请务必使用手机扫码验证；超长文本请选择 Q/H 级容错以保证识别率',
      '⚠️ Logo 叠加占用部分数据模块面积，若叠加后识别失败请尝试去除 Logo 或提高容错等级',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: false,
    fileRequired: false,
    outputExt: 'png',
    outputFileName: 'MendFile_美化二维码',
    defaultOptions: {
      content: 'https://mendfile.com',
      ecLevel: 'M', // L/M/Q/H
      size: 512,
      template: 'default', // default/business/sakura/gold/tech/vintage
      fgColor: '#111827',
      bgColor: '#ffffff',
      dotStyle: 'square', // square/rounded/dot
      // logoFile 作为 options.logoDataURL 直接写入（上传后转 base64）
      logoDataURL: '',
      outputFormat: 'png', // png / svg
    },
    processor: P.qrGenerate,
    showPreview: true,
  },

  'qr-batch': {
    key: 'qr-batch',
    path: '/tools/qr-batch',
    name: '批量二维码生成器',
    shortDesc: '批量粘贴文本一键生成大量二维码图片，自动命名 ZIP 打包下载，附数据清单 CSV',
    category: 'qr',
    icon: '🧾',
    title: '批量二维码生成器 批量生成打包下载 - MendFile 全能办公工具',
    description: 'MendFile 批量二维码生成器，支持粘贴多行内容（每行一条，最多 10000 条），统一定制尺寸、容错、前背景色、圆角点样式，自动按序命名并 ZIP 打包下载，附带 CSV 清单便于核对，纯前端本地处理零上传。',
    keywords: ['批量二维码生成', '批量生成二维码打包下载', 'Excel批量二维码', '批量二维码生成器免费', 'URL批量二维码', '批量二维码命名'],
    features: [
      '粘贴多行内容（每行一条，最多 10000 条），一键生成全部二维码',
      '统一样式：尺寸 128~2000px、4 级容错、前背景色、方形/圆角/圆点 3 种点样式',
      '自动命名（前缀 + 序号）并 ZIP 打包，附带 manifest.csv 清单（序号/文件名/原始内容）',
      '支持 PNG / JPG 两种格式，JPG 可调节质量参数，适合批量打印与分发',
    ],
    boundaries: [
      '⚠️ 纯前端本地生成，所有内容与二维码不会离开您的浏览器；批量生成会占用本机内存，请合理分批',
      '⚠️ 大数据量（≥1000 条）或大尺寸（≥1500px）生成耗时较长，请耐心等待进度条并及时下载结果',
      '⚠️ 内容中含有特殊字符或 emoji 时，请在下载后抽查前/中/后各若干张验证扫码正确性',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    multiple: false,
    fileRequired: false,
    outputExt: 'zip',
    outputFileName: 'MendFile_批量二维码',
    defaultOptions: {
      lines: 'https://mendfile.com\nhttps://example.com\n联系电话：400-000-0000',
      ecLevel: 'M',
      size: 512,
      fgColor: '#111827',
      bgColor: '#ffffff',
      dotStyle: 'square',
      fileNamePrefix: 'qrcode',
      format: 'png', // png / jpg
      quality: 92,
    },
    processor: P.qrBatch,
    showPreview: true,
  },

  'qr-parse': {
    key: 'qr-parse',
    path: '/tools/qr-parse',
    name: '二维码图片批量解析',
    shortDesc: '批量上传二维码图片本地识别内容，结果一键复制或导出 TXT/CSV，支持多图识别',
    category: 'qr',
    icon: '🔍',
    title: '二维码批量解析识别 上传图片识别内容 - MendFile 全能办公工具',
    description: 'MendFile 二维码批量解析器，支持上传多张 QR Code 图片本地识别内容，无需联网不泄露数据，识别结果可逐条查看、一键复制全部或导出 TXT/CSV 清单，纯前端零上传零记录。',
    keywords: ['二维码批量解析', '二维码识别在线', '图片扫二维码内容提取', '微信二维码解析', '批量识别二维码图片', '二维码解码工具'],
    features: [
      '批量上传 50 张以内 QR Code 图片（JPG/PNG/WebP/BMP/GIF 全兼容），逐张识别列出结果',
      '纯前端浏览器本地解析，所有图片与识别内容不上传服务器、不写入任何存储',
      '识别结果列表：文件名 / 识别内容 / 状态，支持一键复制全部结果、或导出 TXT/CSV 两种格式',
      '同一张图片含多个二维码时将全部识别并展开，无法识别的图片会明确标记原因',
    ],
    boundaries: [
      '⚠️ 纯前端本地解析，所有图片与识别内容绝不会离开您的浏览器或被任何第三方获取',
      '⚠️ 目前仅支持标准 QR Code，暂不支持 Aztec / DataMatrix / Code128 / EAN13 等其他条码类型',
      '⚠️ 过低分辨率、严重模糊、强烈反光或严重倾斜的图片可能识别失败，建议图像≥200×200 像素',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'txt',
    outputFileName: 'MendFile_二维码识别结果',
    defaultOptions: {
      exportFormat: 'txt', // txt / csv（processor 里用）
    },
    processor: P.qrParse,
    showPreview: true,
  },

  // =======================================================
  // 批次 3 · 图片剩余功能补齐（image 分类扩展至 8 工具）
  // =======================================================
  'image-watermark': {
    key: 'image-watermark',
    path: '/tools/image-watermark',
    name: '图片批量加水印',
    shortDesc: '批量为图片添加文字/图片水印，支持平铺密集防盗、四角+居中、透明度/旋转/颜色自由调节',
    category: 'image',
    icon: '💧',
    title: '图片批量加水印 免费在线文字图片水印 - MendFile 全能办公工具',
    description: 'MendFile 免费在线图片批量加水印工具，纯前端本地处理，支持平铺密集防盗水印、四角+居中、单图+图片 Logo 叠加两种水印方式，透明度、旋转角度、字体、大小、颜色自由调节，批量处理 ZIP 打包下载，文件不上传服务器。',
    keywords: ['图片批量加水印', '在线加水印免费', '平铺防盗水印', '批量图片Logo加水印', '透明水印生成', '图片水印工具'],
    features: [
      '批量上传图片，一次处理最多 200 张，自动 ZIP 打包下载，文件名带 _wmark 后缀',
      '文字水印：自定义内容、字体大小、颜色、透明度、旋转角度，支持多行输入',
      '图片水印：上传 Logo/印章，支持保持宽高比、自定义宽度、居中缩放',
      '3 大布局：平铺密集（防盗）/ 居中单张 / 四角+中央 5 处水印，满足不同使用场景',
    ],
    boundaries: [
      '⚠️ 纯前端本地处理，所有图片与水印内容均在浏览器完成，绝不上传服务器或第三方服务',
      '⚠️ 单张过大图片（≥50MB）建议分批压缩后再加水印，以避免浏览器内存占用过高',
      '⚠️ 请勿对他人图像添加恶意水印，使用者须自负版权相关法律责任',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_批量加水印结果',
    defaultOptions: {
      mode: 'text', // text | image
      text: '© MendFile.com',
      fontSize: 32,
      color: '#111827',
      opacity: 0.28,
      rotation: -30,
      layout: 'tile', // tile | center | corners
      padding: 60, // 水印与边缘距离/平铺间距
      fontFamily: 'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
      imageDataURL: '', // 图片水印 dataUrl
      imageWidthRatio: 0.18, // 图片水印相对图片宽度比例
      outputFormat: 'same', // same | jpg | png
      quality: 92,
    },
    processor: P.imageWatermark,
    showPreview: true,
  },
  'image-stitch': {
    key: 'image-stitch',
    path: '/tools/image-stitch',
    name: '长图拼接工具',
    shortDesc: '多张图片一键拼接成长图，支持纵向、横向、2 列网格、自定义间距、背景色',
    category: 'image',
    icon: '🧵',
    title: '长图拼接 多图合一 纵向横向网格 - MendFile 全能办公工具',
    description: 'MendFile 免费在线长图拼接工具，纯前端本地处理，支持纵向拼接（聊天记录/长截图）、横向拼接（对比图）、2 列网格拼图（九宫格等），自定义间距像素与背景色，自动等宽或等高对齐。',
    keywords: ['长图拼接在线', '多图合成长图', '图片拼接工具', '九宫格拼图', '聊天记录拼接', '截图拼接工具'],
    features: [
      '纵向 / 横向 / 2 列网格 3 种模式，满足聊天记录、产品对比、朋友圈九宫格等常见场景',
      '自定义拼接间距（0~200px）、背景色（白/透明/自选色），圆角间距更美观',
      '纵向模式自动等宽、横向模式自动等高，无需手动调整尺寸',
      '批量 100 张以内一次性拼接完成，输出 PNG / JPG，JPG 可调质量',
    ],
    boundaries: [
      '⚠️ 纯前端本地拼接，所有图片在浏览器内存中合成，不经过任何服务器',
      '⚠️ 大量大图拼接时输出文件尺寸可能很大，请控制图片数量与分辨率',
      '⚠️ 纵向模式下若图片宽度差异巨大（如手机截图 vs 摄影图）建议先统一调整宽度再拼接',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'jpg',
    outputFileName: 'MendFile_长图拼接结果',
    defaultOptions: {
      direction: 'vertical', // vertical | horizontal | grid2
      gap: 8, // 0~200 px
      bgColor: '#ffffff',
      bgTransparent: false,
      outputFormat: 'jpg',
      quality: 92,
    },
    processor: P.imageStitch,
    showPreview: true,
  },
  'image-split': {
    key: 'image-split',
    path: '/tools/image-split',
    name: '图片分割工具',
    shortDesc: '一键按网格/行/列等分图片，支持自定义行列数、重叠像素，ZIP 打包输出',
    category: 'image',
    icon: '✂️',
    title: '图片分割 网格等分 行列自定义 九宫格切图 - MendFile 全能办公工具',
    description: 'MendFile 免费在线图片分割工具，纯前端本地处理，支持按网格（九宫格等）、仅横向等分、仅纵向等分三种方式，自定义行列数（2~12）、重叠像素（避免地图/全景图边缘接缝），ZIP 打包输出所有切片。',
    keywords: ['图片分割在线', '九宫格切图', '图片等分切割', '长图分段切割', '朋友圈九宫格切片', '网格等分图片'],
    features: [
      '网格 / 仅横向等分（rows）/ 仅纵向等分（cols）3 种模式',
      '行列支持 2~12 自由配置，支持重叠像素（0~80px）消除地图、漫画、全景拼接间隙',
      '保持原格式或统一输出 PNG / JPG，单张图片分割后自动 ZIP 打包',
      '批量多图分割自动命名（前缀_r1c1、_r1c2…），批量处理每图一份 ZIP',
    ],
    boundaries: [
      '⚠️ 纯前端本地分割，原图与切片均不离开浏览器；批量大图建议分批',
      '⚠️ 行列数越大单个切片越小，若原图像素过低，切出后可能模糊',
      '⚠️ 长图等分前建议先压缩到 30MB 以内，以获得更流畅的体验',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_图片分割结果',
    defaultOptions: {
      mode: 'grid', // grid | rows | cols
      rows: 3,
      cols: 3,
      overlap: 0, // 0~80 px
      outputFormat: 'same', // same | png | jpg
      quality: 92,
    },
    processor: P.imageSplit,
    showPreview: true,
  },
  'image-edit': {
    key: 'image-edit',
    path: '/tools/image-edit',
    name: '图片旋转裁剪',
    shortDesc: '批量图片旋转、左右上下镜像翻转、自定义四边像素/百分比裁剪、统一输出',
    category: 'image',
    icon: '🔄',
    title: '图片旋转裁剪 批量镜像翻转 自定义四边裁剪 - MendFile 全能办公工具',
    description: 'MendFile 免费在线图片旋转裁剪工具，纯前端本地处理，支持 90°/180°/270°/自定义任意角度旋转、左右/上下镜像翻转、自定义四边像素裁剪（或百分比裁剪），批量多图处理 ZIP 打包。',
    keywords: ['图片旋转在线', '批量裁剪图片', '图片镜像翻转', '自定义四边裁剪', '照片翻转工具', 'JPG 旋转 EXIF'],
    features: [
      '旋转：90° 顺时针 / 180° / 逆时针 90° / 自定义角度（-180°~180°），自动扩充画布避免裁切',
      '翻转：支持水平镜像、垂直镜像、同时翻转',
      '裁剪：按像素值或百分比独立设置上/下/左/右四边裁剪，可组合使用',
      '批量多张同时处理，保持原格式或统一 PNG/JPG 输出，ZIP 下载',
    ],
    boundaries: [
      '⚠️ 纯前端本地编辑，批量大尺寸图建议分批操作避免卡顿',
      '⚠️ 自定义大角度斜切旋转后，四周自动填充白色/透明背景，画面可能出现空白边',
      '⚠️ 本工具不做 EXIF 旋转矫正处理（Canvas 解码时浏览器通常已自动应用），若有旋转异常请先确认原图',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_图片旋转裁剪结果',
    defaultOptions: {
      rotate: 0, // 0, 90, 180, 270, 或任意角度
      flipH: false,
      flipV: false,
      cropUnit: 'pixel', // pixel | percent
      cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0,
      outputFormat: 'same', // same | jpg | png
      quality: 92,
    },
    processor: P.imageEdit,
    showPreview: true,
  },
  'image-removebg': {
    key: 'image-removebg',
    path: '/tools/image-removebg',
    name: '抠图工具',
    shortDesc: '上传即抠，自动去背景，白底 / 透明 / 自定义颜色实时预览，智能压缩输出，单张 PNG / 多张 ZIP，全程浏览器本地处理、图片不离开您的设备',
    category: 'image',
    icon: '🪄',
    title: '抠图工具 在线一键去背景变透明 - MendFile 全能办公工具',
    description: 'MendFile 免费在线抠图工具，打开即用，无需安装、无需付费，无需任何 AI 模型或插件下载。支持人像 / 证件照 / 电商白底图 / 服装 / 静物等常见场景的背景去除：上传图片瞬间自动抠图，完成后预览卡片自动出成品；白底、透明底、自定义纯色三种背景模式一键切换，预览同步实时重绘。智能轻量化压缩：自动优化最长边与输出格式（PNG / JPG / WebP 按背景择优），单张直接下载成品，多张自动打包 ZIP。设置持久化：背景选择、颜色、压缩偏好自动保存到本地，下次打开直接复用。全程 100% 在您的浏览器里本地处理，图片数据不离开您的设备、不上传服务器、无需注册登录，无使用次数限制。',
    keywords: ['在线抠图', '去背景变透明', '快速抠图', '人像抠图', '商品抠图', '证件照换底', '白底图', '纯前端抠图', '本地抠图', '无后端抠图', '不卡死抠图'],
    features: [
      '【稳定流畅】打开即用，不下载任何插件或模型；处理过程流畅，不占用超高资源，每张速度稳定',
      '【日常办公适用】人像、证件照、电商白底图、服装、商品、静物、PPT 海报等主流场景一键抠除背景',
      '【上传即抠】选择图片后自动开始抠图，无需点击按钮，完成后预览卡片自动出成品',
      '【实时预览】白底 / 透明底 / 自定义纯色 三种背景模式一键切换，预览图同步实时重绘，所见即所得',
      '【设置持久化】背景模式、自定义颜色、容差、羽化、压缩偏好自动保存到本地，下次进入自动复用',
      '【智能压缩输出】自动优化最长边与体积；单张直接下载 PNG（根据背景自动选择更小格式）；多张批量自动打包 ZIP',
      '【极端容错】异常时也会输出原图压缩结果，工具始终可用；不会冻结整页',
      '【隐私安全】全程浏览器本地处理，您的图片 100% 不离开设备，不上传服务器、无登录、无次数限制、不付费',
    ],
    boundaries: [
      '✅ 擅长：白底证件照、电商白底图、人像纯色背景、普通商品 / 服装 / 一般静物、PPT / 海报 / 打印日常办公场景',
      '⚠️ 仍有难度：多层重叠遮挡 + 前景与背景颜色极接近、超低分辨率 / 严重模糊图像、精细半透明物体（薄纱 / 玻璃 / 烟雾 / 液态）、极其复杂混乱背景等，可能存在边界误差',
      '❌ 正式用途提醒：身份证、护照、签证、考试报名等合规证件照，请务必以专业照相馆或官方指定工具出图为准',
      'ℹ️ 速度说明：常规图几百毫秒级；4K+ 超大图也流畅稳定',
      'ℹ️ 全程本地处理：不存储、不上传您任何图片数据；打开即用',
    ],
    boundaryCardStyle: 'amber',
    accept: 'image/*',
    multiple: true,
    outputExt: 'png',
    outputFileName: 'MendFile_抠图结果',
    defaultOptions: {
      threshold: 35, // 8~160 颜色容差：越大抠除越多
      softBand: 18,  // 6~160 边缘软过渡带宽：越大越柔和，渐变背景建议更大
      feather: 1.2,  // 0~15 像素边缘羽化
      bgMode: 'white', // transparent | white | custom
      customBgColor: '#ffffff',
      edgeRefine: true, // 边缘精修
      autoCompress: true, // 自动压缩
    },
    processor: P.imageRemoveBg,
    showPreview: true,
  },

  // =======================================================
  // 批次 4 · 多媒体轻量工具（media 分类 · 6 工具）
  // 纯前端本地：音视频全部走 MediaRecorder / WebAudio / Canvas
  // 不引入 ffmpeg.wasm（避免 ~30MB 依赖）；边界提示明确浏览器 codec 支持范围
  // =======================================================
  'video-compress': {
    key: 'video-compress',
    path: '/tools/video-compress',
    name: '视频压缩工具',
    shortDesc: '纯浏览器本地批量压缩 MP4/WebM，可调质量、分辨率缩放、音视频同步输出',
    category: 'media',
    icon: '🎬',
    title: '视频压缩 在线批量减小视频体积 - MendFile 全能办公工具',
    description: 'MendFile 免费在线视频压缩工具，100% 纯前端本地处理，调用浏览器原生 MediaRecorder + Canvas 实时重编码。支持 MP4/WebM 批量压缩，三档质量 + 可选 50%/75%/100% 分辨率缩放，音频自动压缩同步输出。无需安装任何软件、无视频上传服务器。',
    keywords: ['在线视频压缩', 'MP4压缩免费', '视频变小不发糊', '批量压缩视频', '网页视频压缩工具', '压缩视频发邮件'],
    features: [
      '三档压缩质量：清晰（≈10Mbps）/ 均衡（≈5Mbps）/ 极致（≈2.5Mbps），按场景任选',
      '可选分辨率缩放：原始 / 75% / 50%，大幅减小体积适合微信/邮件发送',
      '多文件批量处理，自动 ZIP 打包，单文件直接输出，文件名带 _compressed 后缀',
      '音视频同步输出，AAC 或 Opus 自动匹配浏览器支持最佳格式',
    ],
    boundaries: [
      '⚠️ 纯浏览器本地处理，视频不会上传任何服务器；但处理过程中会占用较高 CPU/GPU',
      '⚠️ 采用「原生 MediaRecorder 实时重编码」技术，输出时长 ≈ 视频时长（10 分钟视频需约 10 分钟处理），不支持 GPU 硬件加速',
      '⚠️ 不同浏览器编码格式不同：Chrome/Edge 输出 MP4(H.264) 或 WebM(VP9)；Safari 仅支持 MP4(H.264)；Firefox 优先 WebM(VP8)',
      '⚠️ 大于 2GB 的视频文件建议在桌面端使用 HandBrake 等专业软件，浏览器内存处理能力有限',
      '⚠️ 版权提示：请确保您拥有被处理视频的合法权利，禁止对他人版权视频二次传播',
    ],
    boundaryCardStyle: 'amber',
    accept: 'video/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_视频压缩结果',
    defaultOptions: {
      level: 'balanced', // crisp | balanced | extreme
      scale: '100', // '100' | '75' | '50'  (string for radios)
      audioBitrate: '128', // '256' | '128' | '96' | '64'  kbps
      outputFormat: 'auto', // 'auto' | 'mp4' | 'webm'
    },
    processor: P.videoCompress,
    showPreview: true,
  },
  'video-crop': {
    key: 'video-crop',
    path: '/tools/video-crop',
    name: '视频裁剪截取',
    shortDesc: '本地批量按秒/百分比裁剪视频片段，自定义起点终点，无损截断或重编码截取',
    category: 'media',
    icon: '✂️',
    title: '视频裁剪截取 按秒按时间段剪切 - MendFile 全能办公工具',
    description: 'MendFile 免费在线视频裁剪截取工具，纯前端本地处理，支持按秒精确裁剪与按百分比粗略裁剪两种模式，批量多文件统一时间段截取，截取后自动重编码保持兼容性。大文件大视频同样支持，无需上传视频到服务器。',
    keywords: ['视频裁剪在线', '截取视频片段', '按秒剪切MP4', '批量裁剪视频', '视频开头结尾去掉', '网页截取短视频'],
    features: [
      '裁剪模式：按精确秒数（支持小数点后两位）或按整段百分比（如 10%~80%）',
      '批量多文件统一时间段一次输出，自动 ZIP 打包下载',
      '输出格式自适应浏览器最佳支持（MP4 优先），H5/PPT/微信均可直接播放',
      '提供总时长预估预览提示，避免剪错区间',
    ],
    boundaries: [
      '⚠️ 纯前端本地处理，视频不会上传任何服务器；长视频处理时间 ≈ 截取区间长度',
      '⚠️ 裁剪不是流级别无损截断（避免复杂 demux），统一重编码输出；画质随压缩档位略有降低',
      '⚠️ 输入视频损坏 / DRM 加密 / 浏览器不支持解码的编码（如 HEVC/H.265）可能无法处理',
      '⚠️ 起始时间必须小于结束时间；起始时间为 0 或结束时间 = 总时长则表示保留对应端',
    ],
    boundaryCardStyle: 'amber',
    accept: 'video/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_视频裁剪结果',
    defaultOptions: {
      mode: 'seconds', // 'seconds' | 'percent'
      startSec: 0,
      endSec: 0, // 0 = 到末尾
      startPercent: 0,
      endPercent: 100,
      quality: 'balanced', // crisp | balanced | extreme
      outputFormat: 'auto',
    },
    processor: P.videoCrop,
    showPreview: true,
  },
  'video-convert': {
    key: 'video-convert',
    path: '/tools/video-convert',
    name: '视频格式转换',
    shortDesc: '批量视频格式互转 MP4/WebM，浏览器原生编码，同步保留音轨',
    category: 'media',
    icon: '🔁',
    title: '视频格式转换 在线 MP4 转 WebM 互转 - MendFile 全能办公工具',
    description: 'MendFile 免费在线视频格式转换工具，纯前端本地处理，支持常用视频批量转为 MP4 或 WebM 格式。调用浏览器原生 MediaRecorder 编码，不安装插件、不下载软件、不上传原文件。',
    keywords: ['MP4转WebM在线', 'WebM转MP4', '视频格式批量转换', 'MOV转MP4浏览器', '本地视频转码'],
    features: [
      '一键批量将任意浏览器可解码的视频（含 MP4/MOV/WebM/AVI 部分）转为 MP4 或 WebM',
      '三档码率可选：高清 / 标准 / 省流量，满足清晰度与体积平衡',
      '自动保留音轨，音视频同步输出；无音频视频自动降级为无声输出',
      '所有转码在您的浏览器内完成，原视频永远不会离开本机',
    ],
    boundaries: [
      '⚠️ 本工具仅支持浏览器原生能解码的输入格式；MKV / HEVC(H.265) / ProRes / RMVB 等非标准格式请先转为 MP4(H.264) 后使用',
      '⚠️ 「请求格式」不等于实际输出：不同浏览器 MediaRecorder 能力不同，若目标格式不支持会自动降级为兼容格式，并在结果中说明',
      '⚠️ 不同浏览器支持范围：Safari 仅 MP4(H.264)；Chrome 推荐 MP4 或 WebM；Firefox 推荐 WebM',
      '⚠️ 纯浏览器重编码时长 ≈ 视频实际时长；长视频请耐心等待并保持标签页前台运行',
    ],
    boundaryCardStyle: 'amber',
    accept: 'video/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_视频格式转换结果',
    defaultOptions: {
      format: 'mp4', // 'mp4' | 'webm'
      quality: 'balanced',
      audioBitrate: '128',
    },
    processor: P.videoConvert,
    showPreview: true,
  },
  'audio-compress': {
    key: 'audio-compress',
    path: '/tools/audio-compress',
    name: '音频压缩工具',
    shortDesc: '纯前端本地批量压缩 MP3/WAV/M4A/OGG，码率/采样率自由设定',
    category: 'media',
    icon: '🎵',
    title: '音频压缩 在线 MP3 码率压缩减小体积 - MendFile 全能办公工具',
    description: 'MendFile 免费在线音频压缩工具，纯前端本地处理，基于 Web Audio API + MediaRecorder 实现批量音频压缩，支持 32~320kbps 多档码率，可选采样率 48k/44.1k/22.05k，批量 ZIP 打包输出，文件不上传。',
    keywords: ['音频压缩在线', 'MP3减小体积', 'WAV转MP3压缩', '批量压缩音频', '语音压缩发微信'],
    features: [
      '支持输入：MP3 / WAV / M4A(AAC) / OGG(Opus/Vorbis) / FLAC(浏览器可解码部分) / WEBA',
      '码率档位：320kbps 高品质 / 192kbps 标准 / 128kbps 通用 / 64kbps 语音 / 32kbps 极致',
      '可选采样率：48kHz（原声） / 44.1kHz（CD 级） / 22.05kHz（语音级） / 16kHz（电话级）',
      '批量处理，自动 ZIP 打包，单文件直接下载，浏览器原生解码 0 插件',
    ],
    boundaries: [
      '⚠️ 纯浏览器本地处理，音频不上传；但解码会占用一定内存，建议 ≤ 500MB / 单文件',
      '⚠️ 输出格式为 WebM(Opus) / MP4(AAC) / WAV(PCM) 取决于浏览器；非 MP3。如需 MP3 请先确认目标场景支持 WebM/MP4',
      '⚠️ 「码率」为目标码率，浏览器 MediaRecorder 可能轻微浮动，不作字节级精确保证',
      '⚠️ 版权提示：请确保您拥有被处理音频的合法权利',
    ],
    boundaryCardStyle: 'amber',
    accept: 'audio/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_音频压缩结果',
    defaultOptions: {
      bitrate: '128', // '320' | '192' | '128' | '96' | '64' | '32'
      sampleRate: '44100', // '48000' | '44100' | '22050' | '16000'
      outputFormat: 'auto', // 'auto' | 'webm' | 'mp4' | 'wav'
    },
    processor: P.audioCompress,
    showPreview: true,
  },
  'audio-crop': {
    key: 'audio-crop',
    path: '/tools/audio-crop',
    name: '音频裁剪截取',
    shortDesc: '批量按秒裁剪音频，自定义起点终点，可选淡入淡出，保留原音质',
    category: 'media',
    icon: '🎚️',
    title: '音频裁剪截取 按秒剪切铃声语音 - MendFile 全能办公工具',
    description: 'MendFile 免费在线音频裁剪截取工具，纯前端本地处理，支持精确到 0.01 秒的时间区间截取。可选淡入淡出效果避免突然开关，批量多文件一次性截取 ZIP 下载，全程浏览器内完成。',
    keywords: ['音频裁剪在线', 'MP3剪切工具', '制作手机铃声', '批量截取音频片段', '语音开头结尾去掉'],
    features: [
      '按精确秒数设置起止时间（0.01 秒精度），或用百分比模式粗略裁剪',
      '可选淡入 0~3 秒、淡出 0~3 秒，铃声级体验无爆音',
      '输出可选 WebM(Opus) / MP4(AAC) / 无损 WAV 16-bit PCM',
      '批量处理 50+ 文件，自动命名（_clip 后缀），自动 ZIP 打包',
    ],
    boundaries: [
      '⚠️ 纯前端本地处理，音频不上传服务器；长录音建议分批处理',
      '⚠️ 起止时间必须在音频时长范围内；结束时间留 0 表示截取到末尾',
      '⚠️ 输入 DRM 加密或浏览器不支持解码的格式（如 .aac 裸流）可能无法处理',
    ],
    boundaryCardStyle: 'amber',
    accept: 'audio/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_音频裁剪结果',
    defaultOptions: {
      mode: 'seconds', // 'seconds' | 'percent'
      startSec: 0,
      endSec: 0, // 0 表示到末尾
      startPercent: 0,
      endPercent: 100,
      fadeIn: 0, // 0~3 seconds
      fadeOut: 0,
      outputFormat: 'auto', // 'auto' | 'wav' | 'webm' | 'mp4'
      outputBitrate: '192', // 仅 webm/mp4 生效
    },
    processor: P.audioCrop,
    showPreview: true,
  },
  'audio-convert': {
    key: 'audio-convert',
    path: '/tools/audio-convert',
    name: '音频格式转换',
    shortDesc: '批量音频格式互转 WAV/MP4(AAC)/WebM(Opus)，纯 Web Audio 解码重编码',
    category: 'media',
    icon: '🔀',
    title: '音频格式转换 在线 WAV 转 M4A 互转 - MendFile 全能办公工具',
    description: 'MendFile 免费在线音频格式转换工具，纯前端本地处理，支持 MP3/WAV/M4A/OGG/FLAC 等浏览器可解码格式批量转为无损 WAV(16-bit PCM)、MP4(AAC)、WebM(Opus) 三种通用格式，全流程在浏览器中完成。',
    keywords: ['音频格式转换在线', 'WAV转M4A', 'MP3转WAV', 'OGG转AAC', '批量音频转格式'],
    features: [
      '输入支持：MP3 / WAV / M4A(AAC) / OGG / FLAC / WEBA / AAC（浏览器解码能力为准）',
      '输出 3 种通用格式：① WAV 16-bit PCM（无损，兼容所有系统）；② MP4(AAC)（Apple/微信生态最佳）；③ WebM(Opus)（同等码率下音质最高）',
      '码率（非 WAV 模式）可选：64 / 96 / 128 / 192 / 256 / 320 kbps',
      '批量多文件转换，自动 ZIP 打包；0 插件、0 上传、0 安装',
    ],
    boundaries: [
      '⚠️ 输出格式不包含 MP3（浏览器 MediaRecorder 不原生支持 MP3 编码）；如需 MP3 请使用 LAME.js 或专业软件（本工具为轻量零依赖）',
      '⚠️ 编码支持因浏览器而异：Safari 不支持 WebM(Opus)，自动降级为 MP4(AAC)；WAV 所有浏览器 100% 支持',
      '⚠️ 输入 DRM 加密 / 损坏文件 / 非标准容器将直接报错并跳过；单文件建议 ≤ 1 小时时长',
    ],
    boundaryCardStyle: 'amber',
    accept: 'audio/*',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_音频格式转换结果',
    defaultOptions: {
      format: 'wav', // 'wav' | 'mp4' | 'webm'
      bitrate: '192', // '64' | '96' | '128' | '192' | '256' | '320'
      sampleRate: '44100',
    },
    processor: P.audioConvert,
    showPreview: true,
  },
  // =======================================================
  // 批次 5 · 办公小工具合集（office 分类 · 5 工具）
  // fileRequired=false 表示不需要上传文件，直接配置参数即可生成
  // =======================================================
  'text-process': {
    key: 'text-process',
    path: '/tools/text-process',
    name: '文本批量处理',
    shortDesc: '批量 TXT 处理：去空格、脱敏（手机号/邮箱/身份证）、繁简互转、差异对比',
    category: 'office',
    icon: '📝',
    title: '文本批量处理 去空格脱敏繁简转换差异对比 - MendFile 全能办公工具',
    description: 'MendFile 免费在线文本批量处理工具，纯前端本地处理，支持 TXT/CSV/JSON 等文本文件批量操作：去首尾空格/全角空格/空行、手机号邮箱身份证号正则脱敏打码、繁简字双向转换、双文件差异对比。文件不上传、无次数限制。',
    keywords: ['文本去空格', '手机号脱敏', '繁简转换在线', '文本差异对比', '批量TXT处理', '邮箱打码工具'],
    features: [
      '清洗类：去首尾空格 / 去所有空格 / 去除空行 / 全角转半角 / Tab 转空格',
      '脱敏类：手机号(11位)、邮箱(@)、身份证号(18/15位)自动打码为 138****1234 形式',
      '字库类：2000+ 常用字繁简双向映射（简→繁、繁→简），生僻字保留原样',
      '对比类：双文件逐行差异对比输出差异报告（支持两个文本文件输入）',
    ],
    boundaries: [
      '⚠️ 纯前端本地处理，文本内容不会上传任何服务器；浏览器单次处理建议单文件 ≤ 50MB',
      '⚠️ 脱敏基于正则匹配，非常规格式手机号/邮箱（如带国家码、带中文名备注）可能漏匹配，建议复核关键数据',
      '⚠️ 繁简转换基于静态 2000+ 常用字库，古文、异体字、多对多映射（如「头发/出发」的「发」）可能存在歧义',
      '⚠️ 差异对比基于 LCS 算法，超 10 万行文本建议本地桌面工具',
    ],
    boundaryCardStyle: 'amber',
    accept: '.txt,.csv,.json,.md,.log,.srt',
    multiple: true,
    outputExt: 'zip',
    outputFileName: 'MendFile_文本处理结果',
    defaultOptions: {
      mode: 'clean', // 'clean' | 'mask' | 'trad' | 'diff'
      // clean
      trimEach: true,
      removeBlankLines: true,
      fullwidthToHalf: false,
      removeAllSpaces: false,
      // mask
      maskPhone: true,
      maskEmail: true,
      maskIdCard: true,
      maskBank: false,
      // trad
      tradDirection: 's2t', // 's2t' | 't2s'
      // diff
      diffMode: 'unified', // 'unified' | 'side'
    },
    processor: P.textProcess,
    showPreview: true,
  },
  'work-hours': {
    key: 'work-hours',
    path: '/tools/work-hours',
    name: '工时计算与薪资',
    shortDesc: '上下班打卡工时结算：自定义上班/下班时间、午休扣除、加班倍率、工资日结月结',
    category: 'office',
    icon: '⏰',
    title: '工时计算 工资结算加班统计 自定义打卡 - MendFile 全能办公工具',
    description: 'MendFile 免费在线工时计算工具，纯前端本地运算，支持自定义上班/下班/午休时间、工作日历、加班倍率（1.5x/2x/3x）、月薪/时薪自动换算，一键导出 CSV 供 Excel 导入。无需上传打卡记录，所有运算浏览器内完成。',
    keywords: ['工时计算器', '日结工资计算', '加班小时统计', '打卡工时结算', '时薪月薪换算', '上下班打卡计算'],
    features: [
      '单日工时：上班时间 / 下班时间 / 午休扣除精确到分钟，自动计算有效工时',
      '批量多日：粘贴 30 天打卡记录（CSV 格式：日期,上班,下班），一次性批量结算',
      '薪资模式：月薪→时薪反推；或输入时薪+加班倍率自动算日结/月结',
      '一键导出 CSV / TXT 报告，直接复制到 Excel 或发送 HR',
    ],
    boundaries: [
      '⚠️ 纯前端计算，所有数据仅保存在您当前页面，刷新即清空；敏感薪资请自行截图保存或导出文件备份',
      '⚠️ 工资计算不含个税、社保公积金扣除；若需精确报税请使用专业 HR 系统',
      '⚠️ 法定节假日加班工资规则按中国劳动法通用倍率默认，各地细则有差异请人工核对',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    fileRequired: false,
    multiple: false,
    outputExt: 'txt',
    outputFileName: 'MendFile_工时计算报告',
    defaultOptions: {
      mode: 'single', // 'single' | 'batch'
      workStart: '09:00',
      workEnd: '18:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      salaryMode: 'hourly', // 'hourly' | 'monthly'
      hourlyRate: 30,
      monthlyRate: 8000,
      workDaysPerMonth: 22,
      overtime15: true, // 工作日加班 1.5x
      overtime20: false, // 周末 2x
      overtime30: false, // 法定假日 3x
      batchData: '', // CSV 格式多行文本
    },
    processor: P.workHours,
    showPreview: true,
  },
  'timestamp': {
    key: 'timestamp',
    path: '/tools/timestamp',
    name: '时间戳转换',
    shortDesc: 'Unix 时间戳 ↔ 日期时间 双向互转，秒级毫秒级自动识别，多时区批量',
    category: 'office',
    icon: '🕒',
    title: '时间戳转换 Unix时间戳日期双向转换 批量 - MendFile 全能办公工具',
    description: 'MendFile 免费在线时间戳转换工具，纯前端本地处理。支持 10 位（秒）/13 位（毫秒）时间戳自动识别，日期→时间戳正反向转换，批量多行一次处理，自动显示 UTC/北京时区结果，支持复制。',
    keywords: ['时间戳转换', 'Unix时间戳', '10位13位时间戳', '日期转时间戳', '时间戳转日期', '批量时间转换'],
    features: [
      '自动识别：10 位秒级 / 13 位毫秒级，输入即解析无需手动切换',
      '双向转换：时间戳 → 多种格式日期；日期字符串 → 秒/毫秒时间戳',
      '批量多行：粘贴 100 行时间戳或日期一次性全部转换',
      '时区提示：同时展示 UTC / 北京时间 / 本地时区',
    ],
    boundaries: [
      '⚠️ 所有时间计算基于浏览器本地时区；跨时区开发请手动核对 UTC 偏移',
      '⚠️ 1970 年以前（负时间戳）及 2038 年以后（32位溢出）的日期，不同语言解析结果不同，建议人工校验',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    fileRequired: false,
    multiple: false,
    outputExt: 'txt',
    outputFileName: 'MendFile_时间戳转换结果',
    defaultOptions: {
      mode: 'ts2date', // 'ts2date' | 'date2ts' | 'batch'
      timestamp: Math.floor(Date.now() / 1000).toString(),
      dateTime: new Date().toISOString().slice(0, 19).replace('T', ' '),
      batchInput: '',
    },
    processor: P.timestampConvert,
    showPreview: true,
  },
  'password-generator': {
    key: 'password-generator',
    path: '/tools/password-generator',
    name: '密码生成器',
    shortDesc: '高安全随机密码批量生成：大小写数字符号、排除易混字符、自定义规则、直接下载',
    category: 'office',
    icon: '🔐',
    title: '密码生成器 在线高安全随机密码批量生成 - MendFile 全能办公工具',
    description: 'MendFile 免费在线密码生成器，纯前端本地 crypto 级随机数生成（window.crypto.getRandomValues），支持大小写字母、数字、特殊符号自由组合，排除易混字符 I/l/1/O/0，可批量生成 1~1000 条直接下载 TXT。所有密码在您的浏览器生成从不联网。',
    keywords: ['随机密码生成', '强密码在线生成', '批量密码生成器', 'WiFi密码生成', '密码自定义规则'],
    features: [
      'window.crypto 加密级随机数（非 Math.random），符合安全标准',
      '长度 4~128 位；大小写 / 数字 / 符号 四类字符可自由勾选',
      '排除易混字符（I、l、1、|、O、0、o）避免手写识别错误',
      '批量 1~1000 条一次生成，直接复制或一键下载 TXT',
    ],
    boundaries: [
      '⚠️ 纯前端生成，密码不经过任何服务器；但生成后请妥善保存，请勿贴到公共论坛或聊天记录',
      '⚠️ 「至少包含每类各一个」模式下，若总长度小于类别数会自动延长到最小长度',
      '⚠️ 本工具不提供密码存储功能（不建后端），请使用专业密码管理器（Bitwarden/1Password）保存',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    fileRequired: false,
    multiple: false,
    outputExt: 'txt',
    outputFileName: 'MendFile_生成密码',
    defaultOptions: {
      length: 16,
      count: 5,
      includeUpper: true,
      includeLower: true,
      includeNumber: true,
      includeSymbol: true,
      excludeAmbiguous: true,
      requireEachType: true,
      customSymbols: '!@#$%^&*()-_=+[]{};:,.<>?',
    },
    processor: P.passwordGenerate,
    showPreview: true,
  },
  'unit-convert': {
    key: 'unit-convert',
    path: '/tools/unit-convert',
    name: '单位换算器',
    shortDesc: '长度重量体积温度面积时间数据存储货币 8 大类常用单位互转，批量表格',
    category: 'office',
    icon: '📐',
    title: '单位换算器 长度重量温度面积存储批量换算 - MendFile 全能办公工具',
    description: 'MendFile 免费在线单位换算工具，纯前端本地计算。覆盖 8 大类常用单位：长度（米/英寸/英尺/公里/里）、重量（千克/磅/斤/盎司）、体积（升/加仑/立方米）、温度（℃/℉/K）、面积（㎡/亩/公顷/平方英尺）、时间（秒/分/时/天/周）、数据存储（B/KB/MB/GB/TB）、能量（卡路里/焦耳）。批量输入一次换算。',
    keywords: ['单位换算器', '米转英寸', '公斤转磅', '摄氏度华氏度转换', 'GB MB换算', '亩平方米换算'],
    features: [
      '8 大类 80+ 常用单位：长度 / 重量 / 体积 / 温度 / 面积 / 时间 / 存储 / 能量',
      '每类一键切换目标单位，实时双向换算，输入即出结果',
      '批量模式：粘贴 100 行数值一次完成换算，导出 TXT/CSV',
      '高精度 12 位小数，四舍五入可自定义',
    ],
    boundaries: [
      '⚠️ 所有换算基于国际标准定义；英制与公制换算中，部分国家地区有细微差异（如美制加仑 vs 英制加仑）已在选项中标注',
      '⚠️ 货币汇率仅提供静态示例（为了零后端），实时汇率请使用专业财经工具',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    fileRequired: false,
    multiple: false,
    outputExt: 'txt',
    outputFileName: 'MendFile_单位换算结果',
    defaultOptions: {
      category: 'length', // length | weight | volume | temp | area | time | storage | energy
      fromUnit: 'm',
      toUnit: 'inch',
      value: '1',
      precision: 4,
      batchMode: false,
      batchInput: '',
    },
    processor: P.unitConvert,
    showPreview: true,
  },

  'flowchart-designer': {
    key: 'flowchart-designer',
    path: '/tools/flowchart-designer',
    name: '流程图设计',
    shortDesc: '在线绘制流程/决策/逻辑图，支持开始/结束、步骤、判断、输入输出、箭头连接；JSON 工程本地保存，一键导出 PNG / JPG / PDF / SVG',
    category: 'diagram',
    icon: '📐',
    title: '在线流程图设计 免费绘制导出PDF/JPG - MendFile 全能办公工具',
    description: 'MendFile 在线流程图设计工具，无需注册登录、打开即用。支持标准流程图元素：圆角矩形（开始/结束）、矩形（步骤）、菱形（判断/分支）、平行四边形（输入/输出）、箭头/虚线连接、自由文本标签。拖拽绘制、批量移动，Ctrl/Cmd+Z 撤销；支持多人传阅工程文件、支持草稿自动保存（本地浏览器，误关页不丢失）、支持保存工程 JSON 到本地 / 导入 JSON 继续编辑；一键导出 PNG（高清2x）、JPG（白底）、PDF（嵌入高清渲染，适合存档传阅）、SVG（矢量，无损放大二次编辑）。全程 100% 本地浏览器画布，不上传任何内容。',
    keywords: ['在线流程图', '流程图设计', '流程图画图', '流程图导出PDF', '可视化流程图', '逻辑流程图', '决策流程图', '纯前端流程图'],
    features: [
      '标准元素齐全：开始/结束、步骤、判断/分支、输入/输出、子流程、箭头连接、文本注释',
      '拖拽绘制，多选批量移动/调整大小，Shift 画正方形/水平垂直线，Ctrl/Cmd+Z/Y 撤销重做',
      'JSON 工程本地保存 / 导入：多人传阅或下次继续编辑无缝衔接；草稿自动按工具分别存储，误关页不丢',
      '一键导出：PNG（高清 2x 透明）、JPG（白底适合打印）、SVG（矢量无损放大）、PDF（存档/分享）',
      '支持图片粘贴/插入：可把流程截图、UI、素材贴到画布上混合绘图',
      '100% 纯前端本地：您的设计图数据不离开浏览器设备，无后端、无上传、无登录',
    ],
    boundaries: [
      '适合：业务流程、审批流程、产品逻辑、算法流程图、决策树、泳道图等标准办公绘图',
      '复杂协作绘图（多用户实时协同）、专业 BPMN 2.0/EA/Visio 高级宏指令暂不支持',
      'PDF 为高清图片嵌入的单页 PDF，保证所见即所得；如需矢量 PDF 请使用 SVG 再用外部工具转',
    ],
    boundaryCardStyle: 'amber',
    accept: '', // 设计类工具不需要先上传文件
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_流程图',
    defaultOptions: {},
    processor: P.diagramNoop,
    showPreview: false,
    fileRequired: false,
  },

  'floorplan-designer': {
    key: 'floorplan-designer',
    path: '/tools/floorplan-designer',
    name: '平面图设计',
    shortDesc: '在线绘制房屋平面布局图、办公室/店铺/仓库布局、水电走位示意；JSON 工程保存，导出 PNG / JPG / PDF / SVG',
    category: 'diagram',
    icon: '🏠',
    title: '在线平面图设计 免费绘制布局图导出PDF - MendFile 全能办公工具',
    description: 'MendFile 在线平面图设计工具，纯前端浏览器本地画布，打开即用。使用矩形、直线画墙体和房间轮廓，Shift 正交锁定画水平/垂直线，文本标注尺寸与房间名称；工具栏「图片」按钮可插入家具/卫浴/门窗/家电等素材图组合出完整室内布局。草稿自动保存，支持保存 JSON / 导入 JSON 继续编辑；一键导出 PNG（高清2x）、JPG（白底打印）、PDF（图纸存档）、SVG（矢量，CAD/PPT 二次编辑）。全程无需上传任何文件。',
    keywords: ['在线平面图', '平面布局图', '房屋平面图', '店铺设计', '办公布局图', '水电走位示意', '户型图绘制', '装修布局'],
    features: [
      '矩形/直线画墙体，Shift 正交锁定保证线条水平垂直；多选批量对齐/移动',
      '文本 + 尺寸标注（手动输入），支持网格显示便于参照比例',
      '插入本地图片：家具/卫浴/门窗/家电等素材图直接拖入或插入',
      'JSON 工程保存 / 导入，草稿自动存储（不串工具、不丢失）',
      '一键导出高清 PNG / JPG / PDF / SVG 四种格式：打印/传阅/存档/二次编辑全覆盖',
      '100% 纯前端本地：绘制过程全程在您的浏览器内，不离开设备，不上传',
    ],
    boundaries: [
      '适合：房屋/店铺/办公室/仓库的布局示意、水电走位草图、摆位方案等一般办公绘图',
      '不替代 AutoCAD / 专业建筑设计：精确施工尺寸、结构设计请以专业 CAD 软件出具的图纸为准',
      '未内置图块库（家具/门窗图标需用户自行插入图片），后续版本根据反馈扩展图库',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_平面图',
    defaultOptions: {},
    processor: P.diagramNoop,
    showPreview: false,
    fileRequired: false,
  },

  'sequence-designer': {
    key: 'sequence-designer',
    path: '/tools/sequence-designer',
    name: '时序图设计',
    shortDesc: '在线绘制接口时序图/系统调用链，参与者生命线+调用/返回消息+激活条；JSON 工程持久化，导出 PNG/JPG/PDF/SVG',
    category: 'diagram',
    icon: '🔀',
    title: '在线时序图设计 接口调用链可视化导出PDF - MendFile 全能办公工具',
    description: 'MendFile 在线时序图设计工具，浏览器本地打开即用，适合快速绘制前后端接口时序、微服务调用链、消息队列事务流程等。参与者框 + 生命线 + 调用箭头（实线）/ 返回箭头（虚线）/ 自调用 / 注释说明，自由拖拽调整布局，Ctrl/Cmd+Z 撤销；草稿自动保存，JSON 工程保存 / 导入；一键导出 PNG（高清2x）、JPG（白底）、PDF（嵌入高清图，方便技术评审分享）、SVG（矢量放大插入文档/PPT）。全程纯前端、无上传、无注册登录。',
    keywords: ['在线时序图', '时序图绘制', '接口时序', '调用链图', '系统时序图', '消息时序图', 'UML时序图', 'UML 序列图'],
    features: [
      '文本框列参与者（从左到右），细直线画生命线，箭头工具画调用/返回消息',
      '激活条 / 自调用 / 回调用虚线 / 注释说明全部支持，自由调节每条间距',
      '多人传阅：保存 JSON 工程文件；同事接收后「导入 JSON」继续编辑 / 评审',
      '草稿自动保存（按时序图工具独立存储，不与其它设计互串）、支持清空重画',
      '一键导出 PNG/JPG/PDF/SVG：技术评审、文档插图、PPT/Word 报告一站式搞定',
      '100% 纯前端本地处理，您的设计数据不上传服务器',
    ],
    boundaries: [
      '适合：接口调用时序、交易流程、微服务链路、业务时序说明等一般技术文档绘图',
      '非严格 PlantUML / Mermaid 文本 DSL 语法图（属于通用拖拽画布）；如需文本转图可使用 mermaid 等工具',
      '自动布局（参与者自动排列间距）不强制提供，用户可自由拖拽调整最符合展示需求',
    ],
    boundaryCardStyle: 'amber',
    accept: '',
    multiple: false,
    outputExt: 'pdf',
    outputFileName: 'MendFile_时序图',
    defaultOptions: {},
    processor: P.diagramNoop,
    showPreview: false,
    fileRequired: false,
  },
};

export const TOOL_ROUTES = Object.values(TOOLS_CONFIG).map((t) => ({ key: t.key, path: t.path }));
