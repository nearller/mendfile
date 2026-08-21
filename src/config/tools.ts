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
  | 'office'; // 办公小工具合集（二期新增）

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
};

export const TOOL_ROUTES = Object.values(TOOLS_CONFIG).map((t) => ({ key: t.key, path: t.path }));
