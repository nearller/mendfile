/**
 * 全部 13 个工具处理器
 * 全部纯前端本地处理，使用 pdf-lib / pdfjs-dist / jszip / canvas / Blob API 等，
 * 无任何后端请求、无任何用户文件上传。
 */
import JSZip from 'jszip';
import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFNumber,
  PDFRef,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import type { ProcessFn, ProcessOutput, ProgressFn } from './types';
import {
  readAsArrayBuffer,
  readAsDataURL,
  loadImage,
  canvasToBlob,
  formatBytes,
  safeName,
  stripExt,
  generatePdfThumbnail,
} from './utils';
import { pdfjsLib } from './pdfjs';
// 批次 2 · 二维码库（纯前端，零上传）
// @ts-ignore - qrcode-generator 官方未独立发布 .d.ts，按运行时 API 使用
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';
// 批次 5 · 繁简字库（文本工具用）
import { toSimplified, toTraditional, getDictSize } from '@/vendor/trad-simp';
// 批次 3 · AI 抠图：U2NetP Portrait（INT8 量化蒸馏轻量商用）ONNX + IndexedDB 缓存（纯前端 ONNX Runtime Web）
import {
  removeBackground as aiRemoveBg,
  flattenCutout,
  compressCutoutBlob,
  getLastEp,
  resetSessionForTest,
} from './rmbg';

/**
 * 把 pdf-lib 返回的 Uint8Array 转成 Blob 兼容类型。
 * TS 5.5+ Uint8Array 带泛型参数，和 BlobPart 要求的 ArrayBufferView<ArrayBuffer> 不兼容，
 * 因此使用 raw ArrayBuffer 构造后，再用 as unknown as 显式断言。
 */
function asBlob(bytes: Uint8Array): Uint8Array {
  const copy = new ArrayBuffer(bytes.byteLength);
  const view = new Uint8Array(copy);
  view.set(bytes);
  return view as unknown as Uint8Array<ArrayBuffer>;
}

/** pdf-lib 某些内部 API 不暴露在 public d.ts 里，统一用 as any 调用以通过严格编译 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAny = (x: unknown): any => x;

/** =========================================================
 *  1. PDF 转 Word（文本型，输出标准 docx）
 * ========================================================= */
export const pdfToWord: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '正在读取文件');
  const results: { name: string; blob: Blob }[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const buf = await readAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    onProgress(0.1 + (fi / files.length) * 0.8, `正在解析第 ${fi + 1}/${files.length} 个文件`);

    const paragraphs: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // 按 y 坐标行聚合，保留大致的行结构
      const lines: Record<number, { x: number; str: string }[]> = {};
      (textContent.items as any[]).forEach((it) => {
        if (!it || !it.str) return;
        const y = Math.round(it.transform[5] || 0);
        if (!lines[y]) lines[y] = [];
        lines[y].push({ x: it.transform[4] || 0, str: it.str });
      });
      const sorted = Object.keys(lines)
        .map(Number)
        .sort((a, b) => b - a);
      sorted.forEach((y) => {
        const parts = lines[y].sort((a, b) => a.x - b.x).map((p) => p.str);
        const line = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (line) paragraphs.push(line);
      });
      if (i < pdf.numPages) paragraphs.push('');
    }
    const docx = await buildMinimalDocx(paragraphs);
    results.push({ name: `${stripExt(safeName(file.name)) || 'document'}.docx`, blob: docx });
    onProgress(0.1 + ((fi + 1) / files.length) * 0.8);
  }

  let finalBlob: Blob;
  let finalExt: string;
  let finalName: string;
  if (results.length === 1) {
    finalBlob = results[0].blob;
    finalExt = 'docx';
    finalName = results[0].name.replace(/\.docx$/i, '');
  } else {
    const zip = new JSZip();
    results.forEach((r) => zip.file(r.name, r.blob));
    finalBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    finalExt = 'zip';
    finalName = 'MendFile_PDF转Word结果';
  }
  onProgress(1, '转换完成');
  return {
    blob: finalBlob,
    ext: finalExt,
    fileName: finalName,
    preview: { stats: { '文件数量': files.length, '总大小': formatBytes(files.reduce((s, f) => s + f.size, 0)) } },
  };
};

/** 最小合法 docx：使用 OOXML 最小结构（不依赖 mammoth/docx 库以减小体积） */
async function buildMinimalDocx(paragraphs: string[]): Promise<Blob> {
  const body = paragraphs
    .map((p) => {
      const t = escapeXml(p || '');
      return `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
    })
    .join('');
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels')!.file('.rels', rels);
  const word = zip.folder('word')!;
  word.file('document.xml', documentXml);
  word.folder('_rels')!.file('document.xml.rels', docRels);
  // 兼容性内容（部分版本需要 docProps）
  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Converted by MendFile</dc:title><dc:creator>MendFile.com</dc:creator></cp:coreProperties>`;
  zip.folder('docProps')!.file('core.xml', core);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** =========================================================
 *  2. PDF 转图片（PNG/JPG 按页渲染，输出 ZIP 或单图）
 * ========================================================= */
export const pdfToImage: ProcessFn = async ({ files, options }, onProgress) => {
  const file = files[0];
  const buf = await readAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const format: 'png' | 'jpg' = options.format === 'jpg' ? 'jpg' : 'png';
  const dpi = Math.max(72, Math.min(300, Number(options.dpi) || 150));
  const scale = dpi / 72;
  const pageCount = pdf.numPages;

  const zip = new JSZip();
  let singleBlob: Blob | null = null;
  const baseName = stripExt(safeName(file.name));
  const thumbs: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpg' ? 0.92 : undefined;
    const blob = await canvasToBlob(canvas, type, quality);
    const idx = String(i).padStart(String(pageCount).length || 1, '0');
    const name = `${baseName}_第${idx}页.${format === 'jpg' ? 'jpg' : 'png'}`;
    zip.file(name, blob);
    if (pageCount === 1) singleBlob = blob;
    if (i <= 6) thumbs.push(canvas.toDataURL('image/jpeg', 0.6));
    onProgress((i / pageCount) * 0.95, `正在渲染第 ${i}/${pageCount} 页`);
  }

  const finalBlob = singleBlob ?? (await zip.generateAsync({ type: 'blob', compression: 'STORE' }));
  const ext = singleBlob ? format : 'zip';
  onProgress(1, '渲染完成');
  return {
    blob: finalBlob,
    ext,
    fileName: singleBlob ? `${baseName}_转换结果` : `${baseName}_全部图片`,
    preview: { pageCount, thumbnails: thumbs, stats: { 页数: pageCount, DPI: dpi, 格式: format.toUpperCase() } },
  };
};

/** =========================================================
 *  3. 图片转 PDF（按顺序合成）
 * ========================================================= */
export const imageToPdf: ProcessFn = async ({ files, options, extras }, onProgress) => {
  onProgress(0.02, '正在读取图片');
  const order = (extras?.order as number[]) ?? files.map((_, i) => i);
  const ordered = order.map((i) => files[i]).filter(Boolean);

  const pageSize: 'a4' | 'letter' | 'original' | 'custom' = options.pageSize || 'a4';
  const margin = Math.max(0, Number(options.margin) || 0);
  const fit: 'contain' | 'cover' | 'fill' = options.fit || 'contain';
  const customW = Number(options.customWidth) || 595;
  const customH = Number(options.customHeight) || 842;

  const pdfDoc = await PDFDocument.create();
  const a4 = [595.28, 842];
  const letter = [612, 792];

  for (let i = 0; i < ordered.length; i++) {
    const f = ordered[i];
    const ab = await readAsArrayBuffer(f);
    const type = f.type || '';
    let image: any;
    if (type.includes('png')) image = await pdfDoc.embedPng(ab);
    else if (type.includes('jpg') || type.includes('jpeg')) image = await pdfDoc.embedJpg(ab);
    else {
      // webp / bmp 等用 canvas 再编码为 png
      const url = URL.createObjectURL(f);
      try {
        const img = await loadImage(url);
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const pngBuf = await (await canvasToBlob(c, 'image/png')).arrayBuffer();
        image = await pdfDoc.embedPng(pngBuf);
      } finally {
        URL.revokeObjectURL(url);
      }
    }
    const iw = image.width;
    const ih = image.height;
    let pw = iw;
    let ph = ih;
    if (pageSize === 'a4') [pw, ph] = a4 as any;
    else if (pageSize === 'letter') [pw, ph] = letter as any;
    else if (pageSize === 'custom') {
      pw = customW;
      ph = customH;
    } else if (pageSize === 'original') {
      pw = iw;
      ph = ih;
    }

    // 自动判断横/竖
    if (pageSize !== 'original' && iw > ih) {
      // 如果是横图，则切换方向（除非 original）
      if (pw < ph) [pw, ph] = [ph, pw];
    }

    const page = pdfDoc.addPage([pw, ph]);
    const innerW = Math.max(1, pw - margin * 2);
    const innerH = Math.max(1, ph - margin * 2);

    let dw = iw;
    let dh = ih;
    if (pageSize !== 'original') {
      if (fit === 'contain') {
        const r = Math.min(innerW / iw, innerH / ih);
        dw = iw * r;
        dh = ih * r;
      } else if (fit === 'cover') {
        const r = Math.max(innerW / iw, innerH / ih);
        dw = iw * r;
        dh = ih * r;
      } else {
        dw = innerW;
        dh = innerH;
      }
    }
    const x = margin + (innerW - dw) / 2;
    const y = ph - margin - innerH + (innerH - dh) / 2;
    page.drawImage(image, { x, y, width: dw, height: dh });
    onProgress(0.1 + ((i + 1) / ordered.length) * 0.85, `正在处理第 ${i + 1}/${ordered.length} 张图片`);
  }

  const bytes = await pdfDoc.save();
  onProgress(1, '生成完成');
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: 'MendFile_图片转PDF',
    preview: { pageCount: ordered.length, stats: { '图片数量': ordered.length, 页面规格: pageSize.toUpperCase(), 边距: `${margin}pt` } },
  };
};

/** =========================================================
 *  4. PDF 转 TXT
 * ========================================================= */
export const pdfToTxt: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02);
  const eol = options.lineBreak === 'crlf' ? '\r\n' : '\n';
  const outputs: { name: string; text: string }[] = [];
  for (let i = 0; i < files.length; i++) {
    const buf = await readAsArrayBuffer(files[i]);
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const pages: string[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const linesMap: Record<number, { x: number; s: string }[]> = {};
      (tc.items as any[]).forEach((it) => {
        if (!it?.str) return;
        const y = Math.round(it.transform[5] || 0);
        (linesMap[y] ||= []).push({ x: it.transform[4] || 0, s: it.str });
      });
      const sorted = Object.keys(linesMap).map(Number).sort((a, b) => b - a);
      const lineStrs = sorted.map((y) => linesMap[y].sort((a, b) => a.x - b.x).map((q) => q.s).join(' ').trim()).filter(Boolean);
      pages.push(lineStrs.join(eol));
    }
    outputs.push({
      name: `${stripExt(safeName(files[i].name)) || 'document'}.txt`,
      text: pages.join(eol + eol + `=== 第 ${pages.length} 页结束 ===` + eol + eol),
    });
    onProgress(0.1 + ((i + 1) / files.length) * 0.85, `提取第 ${i + 1}/${files.length} 个文件`);
  }

  if (outputs.length === 1) {
    return {
      blob: new Blob([outputs[0].text], { type: 'text/plain;charset=utf-8' }),
      ext: 'txt',
      fileName: outputs[0].name.replace(/\.txt$/i, ''),
      preview: { text: outputs[0].text.slice(0, 10000), stats: { 页数: '见上方' } },
    };
  }
  const zip = new JSZip();
  outputs.forEach((o) => zip.file(o.name, o.text));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  onProgress(1);
  return {
    blob,
    ext: 'zip',
    fileName: 'MendFile_PDF转TXT结果',
    preview: { text: outputs.slice(0, 2).map((o) => `【${o.name}】\n${o.text.slice(0, 1000)}`).join('\n\n'), stats: { '文件数量': files.length } },
  };
};

/** =========================================================
 *  5. PDF 合并
 * ========================================================= */
export const pdfMerge: ProcessFn = async ({ files, extras }, onProgress) => {
  onProgress(0.05);
  const order = (extras?.order as number[]) ?? files.map((_, i) => i);
  const ordered = order.map((i) => files[i]).filter(Boolean);
  const dst = await PDFDocument.create();
  let thumbs: string[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const buf = await readAsArrayBuffer(ordered[i]);
    // 解密尝试：使用空密码尝试（pdf-lib 默认不支持加密副本，使用 try 逻辑）
    let src: any;
    try {
      src = await PDFDocument.load(buf);
    } catch (e: any) {
      throw new Error(`文件 "${ordered[i].name}" 读取失败（可能是加密PDF，请先解密）：${e?.message || e}`);
    }
    const count: number = src.getPageCount();
    const indices: number[] = Array.from({ length: count }, (_k: number, i: number) => i);
    const copied = await dst.copyPages(src, indices);
    copied.forEach((p: any) => dst.addPage(p));
    // 取首个文件的前 4 张缩略图
    if (i === 0) {
      try {
        const pdf = await pdfjsLib.getDocument({ data: buf.slice(0) as any }).promise;
        for (let p = 0; p < Math.min(4, count); p++) {
          thumbs.push(await generatePdfThumbnail(pdf, p, 200));
        }
      } catch {
        /* ignore */
      }
    }
    onProgress(0.1 + ((i + 1) / ordered.length) * 0.85, `合并第 ${i + 1}/${ordered.length} 个文件`);
  }
  const bytes = await dst.save();
  onProgress(1);
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: 'MendFile_PDF合并',
    preview: { pageCount: dst.getPageCount(), thumbnails: thumbs, stats: { 合并数: ordered.length, 总页数: dst.getPageCount() } },
  };
};

/** =========================================================
 *  6. PDF 拆分
 * ========================================================= */
export const pdfSplit: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.05);
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const total = src.getPageCount();

  // 解析用户配置：ranges(1-3,5,8-10) / every / pages(2,4,6)
  const mode: 'ranges' | 'every' | 'pages' = options.mode || 'ranges';
  const segments: { name: string; pages: number[] }[] = [];

  if (mode === 'every') {
    const n = Math.max(1, Number(options.every) || 2);
    let from = 1;
    let idx = 1;
    while (from <= total) {
      const to = Math.min(total, from + n - 1);
      const arr = [];
      for (let p = from; p <= to; p++) arr.push(p);
      segments.push({ name: `部分${idx}_P${from}-${to}`, pages: arr });
      from = to + 1;
      idx++;
    }
  } else if (mode === 'pages') {
    const list = parsePageList(options.pages || '', total);
    if (list.length) segments.push({ name: `提取_指定${list.length}页`, pages: list });
  } else {
    const ranges = options.ranges || '';
    if (ranges.trim()) {
      const parts = ranges.split(/[,，]/).map((s: string) => s.trim()).filter(Boolean);
      parts.forEach((p: string, i: number) => {
        let from = 1;
        let to = total;
        if (p.includes('-')) {
          const [a, b] = p.split('-').map((x) => parseInt(x, 10));
          from = clampPage(a, total);
          to = clampPage(b, total);
          if (from > to) [from, to] = [to, from];
        } else {
          from = to = clampPage(parseInt(p, 10), total);
        }
        const arr: number[] = [];
        for (let k = from; k <= to; k++) arr.push(k);
        segments.push({ name: `片段${i + 1}_P${from}-${to}`, pages: arr });
      });
    } else {
      // 默认按页拆分
      for (let p = 1; p <= total; p++) segments.push({ name: `第${p}页`, pages: [p] });
    }
  }

  if (segments.length === 0) throw new Error('未生成任何拆分片段，请检查拆分条件');

  const zip = new JSZip();
  const base = stripExt(safeName(files[0].name));
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const out = await PDFDocument.create();
    const idx0: number[] = seg.pages.map((p: number) => p - 1);
    const copied = await out.copyPages(src, idx0);
    copied.forEach((pp: any) => out.addPage(pp));
    const bytes = await out.save();
    zip.file(`${base}_${seg.name}.pdf`, bytes);
    onProgress(0.15 + ((i + 1) / segments.length) * 0.8, `生成第 ${i + 1}/${segments.length} 份`);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  onProgress(1);
  return {
    blob,
    ext: 'zip',
    fileName: `${base}_拆分结果`,
    preview: { pageCount: total, stats: { 原文件页数: total, 拆分片段: segments.length } },
  };
};

function clampPage(n: number, total: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(total, n));
}
function parsePageList(s: string, total: number): number[] {
  const arr = s
    .split(/[,，\s]+/)
    .map((x) => parseInt(x, 10))
    .filter((x) => Number.isFinite(x) && x >= 1 && x <= total);
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

/** =========================================================
 *  7. PDF 页面编辑（旋转/删除/排序/裁剪）
 * ========================================================= */
export const pdfPagesEdit: ProcessFn = async ({ files, extras, options }, onProgress) => {
  onProgress(0.05);
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const pageCount = src.getPageCount();

  // 顺序：extras.order > options.order > 默认顺序
  let order: number[] = (extras?.order as number[]) || options.order || [];
  if (!order.length) order = Array.from({ length: pageCount }, (_, i) => i + 1);
  // 删除
  const remove: number[] = (extras?.remove as number[]) || options.remove || [];
  const removeSet = new Set(remove.map((x) => x | 0));
  order = order.filter((p) => !removeSet.has(p));

  // 旋转: { "1": 90, "2": 180 } （key 是从 1 开始的页码）
  const rotations: Record<string, number> = (extras?.rotations as any) || options.rotations || {};
  // 裁剪
  const crop = (extras?.crop as any) || options.crop || { top: 0, bottom: 0, left: 0, right: 0 };

  const out = await PDFDocument.create();
  for (let i = 0; i < order.length; i++) {
    const pageNo = order[i];
    if (pageNo < 1 || pageNo > pageCount) continue;
    const [copied] = await out.copyPages(src, [pageNo - 1]);
    const page = out.addPage(copied);

    const extraRot = Number(rotations[String(pageNo)] || 0);
    if (extraRot) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + extraRot) % 360));
    }

    const { width, height } = page.getSize();
    const T = Math.max(0, Math.min(height - 1, Number(crop.top) || 0));
    const B = Math.max(0, Math.min(height - T - 1, Number(crop.bottom) || 0));
    const L = Math.max(0, Math.min(width - 1, Number(crop.left) || 0));
    const R = Math.max(0, Math.min(width - L - 1, Number(crop.right) || 0));
    if (T > 0 || B > 0 || L > 0 || R > 0) {
      const nW = width - L - R;
      const nH = height - T - B;
      if (nW > 10 && nH > 10) {
        page.setSize(nW, nH);
        page.setCropBox(L, B, nW, nH);
        // 用 translate 重新偏移内容到新页面左下角（pdf-lib setCropBox 不移动）
        page.translateContent(-L, -B);
      }
    }
    onProgress(0.1 + ((i + 1) / order.length) * 0.85, `处理第 ${i + 1}/${order.length} 页`);
  }

  const bytes = await out.save();
  onProgress(1);
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_页面编辑`,
    preview: { pageCount: out.getPageCount(), stats: { 原页数: pageCount, 输出页数: out.getPageCount(), 删除页数: remove.length } },
  };
};

/** =========================================================
 *  8. PDF 去水印（智能识别常规文字/半透明水印）
 * ========================================================= */
export const pdfRemoveWatermark: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.05, '正在解析PDF结构');
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const pageCount = src.getPageCount();

  let removedObjects = 0;
  let removedTexts = 0;
  const aggressive = options.aggressive !== false;

  const pages = src.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const node = page.node;
    // 策略 1：遍历 Annots（常见可见型水印可能以 Widget 或 FreeText 注解形式出现）
    try {
      const annots = node.lookupMaybe(PDFName.of('Annots'), PDFArray);
      if (annots) {
        const survivors = [];
        for (let a = 0; a < annots.size(); a++) {
          const ref = annots.get(a);
          if (ref instanceof PDFRef) {
            try {
              const obj = node.context.lookup(ref) as any;
              if (obj && obj.dict) {
                const subtype = obj.dict.get(PDFName.of('Subtype'))?.toString?.() ?? '';
                const contents = obj.dict.get(PDFName.of('Contents'))?.toString?.() ?? '';
                // 典型水印 FreeText 注解
                if (subtype.includes('FreeText') || /水印|watermark|confidential|draft|sample/i.test(contents)) {
                  removedObjects++;
                  continue;
                }
              }
            } catch {
              /* ignore */
            }
          }
          survivors.push(ref);
        }
        // 重写 Annots
        if (survivors.length !== annots.size()) {
          const newArr = PDFArray.withContext(node.context);
          survivors.forEach((s) => newArr.push(s as any));
          node.set(PDFName.of('Annots'), newArr);
        }
      }
    } catch {
      /* ignore */
    }

    // 策略 2：扫描内容流，移除低透明度 + 疑似关键字文本算子
    try {
      const contentRefs: PDFRef[] = (node as any).Contents?.items?.length
        ? (node as any).Contents.items
        : [(node as any).Contents];
      const newStreams: any[] = [];
      for (const cRef of contentRefs) {
        if (!cRef) continue;
        const stream = cRef instanceof PDFRef ? node.context.lookup(cRef) : cRef;
        if (!stream) {
          newStreams.push(cRef);
          continue;
        }
        let decoded = '';
        try {
          decoded = new TextDecoder('utf-8', { fatal: false }).decode(asAny(stream).getBytes());
        } catch {
          newStreams.push(cRef);
          continue;
        }
        const original = decoded;
        if (aggressive) {
          // 常见低透明度组合 gs a/ca 小于 0.5 的整段 BT...ET 水印
          decoded = decoded.replace(
            /\/[A-Za-z0-9]+ gs([\s\S]*?)q\s*([\s\S]*?)BT([\s\S]*?)ET([\s\S]*?)Q/g,
            (match) => {
              // 检测 ca / CA / FillOpacity
              if (/\b(0\.[0-4]\d*|0(\.0*)?)\s*\/ca\b/.test(match) || /\b(0\.[0-4]\d*|0(\.0*)?)\s*\/CA\b/.test(match)) {
                removedTexts++;
                return '';
              }
              return match;
            }
          );
          // 关键字匹配：典型文字水印，如 仅供参考/仅供学习/watermark/Confidential/Draft 等
          decoded = decoded.replace(/BT([\s\S]*?)ET/g, (block) => {
            const inner = block;
            if (
              /(仅供|参考|学习|内部|样本|Sample|Watermark|Confidential|Draft|Preview|CONFIDENTIAL|DRAFT|MendFile)/i.test(
                inner
              ) &&
              (/\b(0\.[0-5]\d*|0(\.0*)?)\s*\/ca\b/.test(inner) || inner.length < 800)
            ) {
              removedTexts++;
              return '';
            }
            return block;
          });
        }
        if (decoded !== original) {
          const newStream = node.context.flateStream(new TextEncoder().encode(decoded), {} as any);
          // 通过用新的 stream 替换原有对象：若为 IndirectRef 则重新写 context 映射
          if (cRef instanceof PDFRef) {
            node.context.assign(cRef, newStream as any);
            newStreams.push(cRef);
          } else {
            // 直接 Contents 字段时，新建一个 ref
            const ref = node.context.register(newStream as any);
            newStreams.push(ref);
          }
        } else {
          newStreams.push(cRef);
        }
      }
      if ((newStreams as any[]).length > 1 && ((newStreams as any[]) + '') !== 'PDFArray') {
        // 若原本是多内容流保持；如果原先是单流但现在多了也保持原样
      }
      if (contentRefs.length > 1 || (newStreams as any[]).length > 1) {
        const arr = PDFArray.withContext(node.context);
        (newStreams as any[]).forEach((s) => arr.push(s instanceof PDFRef ? s : (node.context.register(s))));
        node.set(PDFName.of('Contents'), arr);
      } else if ((newStreams as any[])[0] instanceof PDFRef) {
        node.set(PDFName.of('Contents'), (newStreams as any[])[0]);
      }
    } catch {
      /* ignore */
    }

    // 策略 3：移除 ExtGState 中定义的极低透明度命名状态字典（水印常用），并替换引用为 Normal
    // （保守策略，不在此处修改全局 Resources，仅在上面整段移除时处理，避免影响正文）

    onProgress(0.1 + ((i + 1) / pageCount) * 0.85, `正在扫描第 ${i + 1}/${pageCount} 页`);
  }

  const bytes = await src.save();
  onProgress(1, '去水印处理完成');
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_已去水印`,
    preview: {
      pageCount,
      stats: {
        页数: pageCount,
        '移除注解对象': removedObjects,
        '移除/替换水印文本片段': removedTexts,
      },
    },
  };
};

/** =========================================================
 *  9. PDF 添加水印（文字/图片）
 * ========================================================= */
export const pdfAddWatermark: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.05);
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const pages = src.getPages();
  const pageCount = pages.length;
  const opts = options || {};

  const embedFont = await src.embedStandardFont(StandardFonts.Helvetica);

  // 图片水印先嵌入
  let embeddedImage: any = null;
  if (opts.mode === 'image' && opts.image) {
    try {
      const imgBlob = await dataUrlToBlob(opts.image);
      const ab = await imgBlob.arrayBuffer();
      const t = (imgBlob.type || '').toLowerCase();
      if (t.includes('png')) embeddedImage = await src.embedPng(ab);
      else if (t.includes('jpeg') || t.includes('jpg')) embeddedImage = await src.embedJpg(ab);
      else {
        const url = URL.createObjectURL(imgBlob);
        try {
          const el = await loadImage(url);
          const c = document.createElement('canvas');
          c.width = el.width;
          c.height = el.height;
          c.getContext('2d')!.drawImage(el, 0, 0);
          const png = await (await canvasToBlob(c, 'image/png')).arrayBuffer();
          embeddedImage = await src.embedPng(png);
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      throw new Error('图片水印加载失败：' + (e as Error)?.message);
    }
  }

  const op = Number(opts.opacity ?? 0.3);
  const rot = Number(opts.rotation ?? -30);
  const layout: 'center' | 'corners' | 'tile' = opts.layout || 'tile';

  for (let i = 0; i < pageCount; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();

    // 绘制：使用 pushGraphicsState 设置 opacity
    asAny(page).pushGraphicsState();
    try {
      // 使用 ExtGState 方式设置透明度（pdf-lib 直接不支持，但我们手写 gs /Resources 里添加状态）
      const gsName = await ensureWatermarkGState(src, page, op);
      page.setFontSize(opts.fontSize || 36);
      (page as any).getContentStream().writeLine(`/${gsName} gs`);
    } catch {
      /* ignore fallback: 不使用透明度 */
    }

    if (opts.mode === 'image' && embeddedImage) {
      const w = Math.min(width, Math.max(60, Number(opts.imageWidth) || width * 0.35));
      const h = (embeddedImage.height / embeddedImage.width) * w;
      drawWatermarkBoxes(page, width, height, layout, { w, h }, (x, y) => {
        page.drawImage(embeddedImage, { x, y, width: w, height: h, rotate: degrees(rot) });
      });
    } else {
      const text = String(opts.text ?? 'MendFile.com');
      const fontSize = Math.max(10, Number(opts.fontSize) || 36);
      const color = parseHex(opts.color || '#94a3b8');
      const tw = embedFont.widthOfTextAtSize(text, fontSize);
      const th = fontSize;
      drawWatermarkBoxes(page, width, height, layout, { w: tw, h: th }, (x, y) => {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font: embedFont,
          color,
          rotate: degrees(rot),
        });
      });
    }
    asAny(page).popGraphicsState();
    onProgress(0.1 + ((i + 1) / pageCount) * 0.85, `正在为第 ${i + 1}/${pageCount} 页添加水印`);
  }

  const bytes = await src.save();
  onProgress(1);
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_已加水印`,
    preview: { pageCount, stats: { 页数: pageCount, 类型: opts.mode === 'image' ? '图片水印' : '文字水印', 布局: layout } },
  };
};

function drawWatermarkBoxes(
  page: any,
  W: number,
  H: number,
  layout: 'center' | 'corners' | 'tile',
  size: { w: number; h: number },
  draw: (x: number, y: number) => void
) {
  if (layout === 'center') {
    draw((W - size.w) / 2, (H - size.h) / 2);
  } else if (layout === 'corners') {
    const positions = [
      [10, H - size.h - 10],
      [W - size.w - 10, H - size.h - 10],
      [10, 10],
      [W - size.w - 10, 10],
      [(W - size.w) / 2, (H - size.h) / 2],
    ];
    positions.forEach(([x, y]) => draw(x, y));
  } else {
    // tile: 网格平铺 + 旋转居中
    const stepX = Math.max(80, size.w * 1.1);
    const stepY = Math.max(80, size.h * 2.2);
    for (let y = -size.h; y < H + size.h; y += stepY) {
      for (let x = -size.w; x < W + size.w; x += stepX) {
        draw(x, y);
      }
    }
  }
}

async function ensureWatermarkGState(pdfDoc: any, page: any, opacity: number): Promise<string> {
  let res = (page.node as any).Resources;
  if (!res || !res.dict) {
    // 给 page 建一个 Resources dict
    const obj = pdfDoc.context.obj({});
    const ref = pdfDoc.context.register(obj);
    page.node.set(PDFName.of('Resources'), ref);
    res = page.node.Resources;
  }
  const dict = res.dict;
  const extGState = dict.get(PDFName.of('ExtGState')) ?? pdfDoc.context.obj({});
  const key = 'WMGS' + Math.round(opacity * 100);
  if (!extGState.get(PDFName.of(key))) {
    const gs = pdfDoc.context.obj({
      Type: PDFName.of('ExtGState'),
      ca: opacity,
      CA: opacity,
    });
    extGState.set(PDFName.of(key), gs);
    dict.set(PDFName.of('ExtGState'), extGState);
  }
  return key;
}

function parseHex(hex: string) {
  const c = hex.replace('#', '');
  if (c.length === 3) {
    const [r, g, b] = c.split('').map((x) => parseInt(x + x, 16));
    return rgb(r / 255, g / 255, b / 255);
  }
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  if (url.startsWith('data:')) {
    const [meta, b64] = url.split(',');
    const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/png';
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  const r = await fetch(url);
  return r.blob();
}

/** =========================================================
 *  10. PDF 加密 / 解密
 * ========================================================= */
export const pdfEncrypt: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.1);
  const buf = await readAsArrayBuffer(files[0]);
  const mode: 'encrypt' | 'decrypt' = options.mode || 'encrypt';
  if (mode === 'decrypt') {
    // pdf-lib 在已知密码时可解密：load 时传 password
    const pass = options.inputPassword || '';
    let src: any;
    try {
      src = await PDFDocument.load(buf, { password: pass } as any);
    } catch (e) {
      // 尝试空密码
      try {
        src = await PDFDocument.load(buf, { password: '' } as any);
      } catch {
        throw new Error('解密失败：请输入正确的密码，或该 PDF 未加密 / 使用了不支持的加密方式');
      }
    }
    const bytes = await src.save();
    onProgress(1);
    return {
      blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
      ext: 'pdf',
      fileName: `${stripExt(safeName(files[0].name))}_已解密`,
      preview: { stats: { 页数: src.getPageCount() } },
    };
  } else {
    const src = await PDFDocument.load(buf);
    const userPassword = options.userPassword || '';
    const ownerPassword = options.ownerPassword || userPassword;
    if (!userPassword && !ownerPassword) throw new Error('请至少设置打开密码或权限密码');
    const permissions = options.permissions || {};
    // pdf-lib 只支持 AES-128（其内置 encryptAES），这里按文档使用官方加密 API
    const bytes = await src.save({
      encrypt: {
        userPassword,
        ownerPassword: ownerPassword || userPassword,
        permissions: {
          printing: permissions.print === false ? 'none' : 'lowResolution',
          modifying: permissions.modify === false ? false : true,
          copying: permissions.copy === false ? false : true,
          annotating: true,
          fillingForms: true,
          contentAccessibility: true,
          documentAssembly: true,
        },
      },
    } as any);
    onProgress(1);
    return {
      blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
      ext: 'pdf',
      fileName: `${stripExt(safeName(files[0].name))}_已加密`,
      preview: { stats: { 页数: src.getPageCount(), '加密算法': 'AES-128 (pdf-lib 内置)' } },
    };
  }
};

/** =========================================================
 *  11. PDF 压缩
 *  策略：
 *   - 普通：重建文档（重写对象去重）、对 XObject 图片进行 85% 质量重编码
 *   - 极致：对 XObject 图片 60% 质量重编码 + 降分辨率到原图的 70% + 删除元数据
 * ========================================================= */
export const pdfCompress: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.05);
  const originalSize = files[0].size;
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const pageCount = src.getPageCount();
  const level: 'normal' | 'extreme' = options.level || 'normal';
  const targetQuality = level === 'normal' ? 0.85 : 0.6;
  const scaleFactor = level === 'normal' ? 1 : 0.7;

  let processedImages = 0;
  let savedBytes = 0;

  // 遍历所有页面 Resources XObject Image
  for (let p = 0; p < pageCount; p++) {
    const page = src.getPage(p);
    const resources = (page.node as any).Resources;
    try {
      const xobj = resources?.lookup?.(PDFName.of('XObject'));
      if (xobj instanceof PDFArray) {
        for (let k = 0; k < xobj.size(); k++) {
          const ref = xobj.get(k);
          await tryRecompressImage(src, ref, targetQuality, scaleFactor).then((r) => {
            if (r) {
              processedImages++;
              savedBytes += r;
            }
          });
        }
      } else if (xobj && xobj.dict) {
        const entries = xobj.dict.entries();
        for (const [key, val] of entries) {
          await tryRecompressImage(src, val, targetQuality, scaleFactor).then((r) => {
            if (r) {
              processedImages++;
              savedBytes += r;
            }
          });
        }
      }
    } catch {
      /* ignore */
    }
    onProgress(0.1 + ((p + 1) / pageCount) * 0.6, `正在扫描第 ${p + 1}/${pageCount} 页`);
  }

  // 使用 object dedup 保存
  const bytes = await src.save({ useObjectStreams: true, objectsPerTick: 1000, updateFieldAppearances: false });
  const newSize = bytes.byteLength;
  const ratio = originalSize > 0 ? (1 - newSize / originalSize) * 100 : 0;

  onProgress(1, '压缩完成');
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_已压缩`,
    preview: {
      stats: {
        模式: level === 'normal' ? '普通压缩（平衡）' : '极致压缩（最小）',
        '原始大小': formatBytes(originalSize),
        '压缩后大小': formatBytes(newSize),
        压缩率: `${ratio.toFixed(2)}%`,
        '处理的图片数': processedImages,
        预估节省空间: formatBytes(Math.max(0, originalSize - newSize)),
      },
    },
  };
};

async function tryRecompressImage(doc: any, ref: any, quality: number, scale: number): Promise<number> {
  try {
    if (!(ref instanceof PDFRef)) return 0;
    const stream = doc.context.lookup(ref);
    if (!stream || !stream.dict) return 0;
    const dict = stream.dict;
    const subtype = dict.get(PDFName.of('Subtype'))?.toString?.();
    if (subtype !== '/Image') return 0;
    const width = Number((dict.get(PDFName.of('Width')) as PDFNumber)?.asNumber?.() || 0);
    const height = Number((dict.get(PDFName.of('Height')) as PDFNumber)?.asNumber?.() || 0);
    if (width <= 0 || height <= 0) return 0;
    const filter = dict.get(PDFName.of('Filter'))?.toString?.() || '';
    // 只处理 DCTDecode(JPEG) 和 Flate(PNG-like) 图片，跳过复杂（JBIG2 / JPX）
    const isJpeg = filter.includes('DCTDecode');
    const isFlate = filter.includes('FlateDecode') || filter.includes('Flate');
    if (!isJpeg && !isFlate) return 0;
    // 小图跳过（<30KB 原图）
    const originalLen = Number((dict.get(PDFName.of('Length')) as PDFNumber)?.asNumber?.() || asAny(stream).getBytes().byteLength);
    if (originalLen < 30 * 1024 && scale >= 1) return 0;

    // 渲染到 canvas 再重新编码 JPEG
    let bytes = asAny(stream).getBytes();
    // Flate 可能是 1-bit/Indexed 等；尽量 decode：pdf-lib 默认返回已解压 bytes，大部分可直接画（PNG-like）
    // 处理 colorspace: 简化：若 BitsPerComponent=1 或 ColorSpace=Indexed 则跳过，避免 canvas 色差
    const bpc = Number((dict.get(PDFName.of('BitsPerComponent')) as PDFNumber)?.asNumber?.() || 8);
    if (bpc < 8) return 0;

    // 构建 PNG header 对于 Flate 比较复杂；这里采用更稳办法：尝试用 Blob+URL+loadImage
    // JPEG：直接 Blob，Flate：先封装 PNG
    let blob: Blob;
    if (isJpeg) {
      blob = new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'image/jpeg' });
    } else {
      // Flate：尝试按 RGB 封装成 PNG（简化：仅 DeviceRGB）
      const cs = dict.get(PDFName.of('ColorSpace'))?.toString?.() || '';
      if (!cs.includes('DeviceRGB') || width * height * 3 !== bytes.byteLength) return 0;
      blob = await rawRgbToPngBlob(bytes, width, height);
    }
    const url = URL.createObjectURL(blob);
    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    const outW = Math.max(1, Math.round(img.width * scale));
    const outH = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, outW, outH);
    const jpg = await canvasToBlob(canvas, 'image/jpeg', quality);
    const jpgBytes = new Uint8Array(await jpg.arrayBuffer());

    // 构造新的 image stream
    const newDict = doc.context.obj({
      Type: PDFName.of('XObject'),
      Subtype: PDFName.of('Image'),
      Width: PDFNumber.of(outW),
      Height: PDFNumber.of(outH),
      ColorSpace: PDFName.of('DeviceRGB'),
      BitsPerComponent: PDFNumber.of(8),
      Filter: PDFName.of('DCTDecode'),
    });
    const newStream = doc.context.stream(newDict, jpgBytes);
    doc.context.assign(ref, newStream);
    return Math.max(0, originalLen - jpgBytes.byteLength);
  } catch {
    return 0;
  }
}

async function rawRgbToPngBlob(rgb: Uint8Array, w: number, h: number): Promise<Blob> {
  // 使用 canvas 重绘方式，更省心
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let i = 0, p = 0; i < rgb.length; i += 3, p += 4) {
    img.data[p] = rgb[i];
    img.data[p + 1] = rgb[i + 1];
    img.data[p + 2] = rgb[i + 2];
    img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

/** =========================================================
 *  12. PDF 添加页码
 * ========================================================= */
export const pdfPageNumber: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.05);
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);
  const pages = src.getPages();
  const pageCount = pages.length;
  const font = await src.embedStandardFont(StandardFonts.Helvetica);

  const position: string = options.position || 'bottom-center';
  const style: string = options.style || '1,2,3';
  const start: number = Math.max(0, Number(options.start) || 1);
  const fontSize: number = Math.max(6, Number(options.fontSize) || 12);
  const margin: number = Math.max(0, Number(options.margin) || 20);
  const color = parseHex(options.color || '#334155');

  const formatNum = (n: number): string => {
    if (style.includes('i')) return toRomanLower(n);
    if (style.includes('I')) return toRoman(n);
    if (style.includes('一') || style.includes('中')) return toChineseNum(n);
    return String(n);
  };

  for (let i = 0; i < pageCount; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const text = formatNum(start + i);
    const tw = font.widthOfTextAtSize(text, fontSize);
    const { x, y } = resolvePageNumberPos(position, width, height, margin, tw, fontSize, i + 1);
    asAny(page).pushGraphicsState();
    try {
      (page as any).getContentStream().writeLine('/P#Normal gs');
    } catch {
      /* ignore */
    }
    page.drawText(text, { x, y, size: fontSize, font, color });
    asAny(page).popGraphicsState();
    onProgress(0.1 + ((i + 1) / pageCount) * 0.85, `正在处理第 ${i + 1}/${pageCount} 页`);
  }

  const bytes = await src.save();
  onProgress(1);
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_已加页码`,
    preview: { pageCount, stats: { 页数: pageCount, 起始页: start, 字号: fontSize, 位置: position, 样式: style } },
  };
};

function resolvePageNumberPos(
  pos: string,
  W: number,
  H: number,
  m: number,
  tw: number,
  th: number,
  pageNo: number
): { x: number; y: number } {
  const isOdd = pageNo % 2 === 1;
  switch (pos) {
    case 'top-left':
      return { x: m, y: H - m - th };
    case 'top-center':
      return { x: (W - tw) / 2, y: H - m - th };
    case 'top-right':
      return { x: W - m - tw, y: H - m - th };
    case 'bottom-left':
    case 'bottom-outer':
      return { x: isOdd && pos === 'bottom-outer' ? W - m - tw : m, y: m };
    case 'bottom-right':
      return { x: W - m - tw, y: m };
    case 'bottom-inner':
      return { x: isOdd ? m : W - m - tw, y: m };
    case 'bottom-center':
    default:
      return { x: (W - tw) / 2, y: m };
  }
}
function toRoman(num: number): string {
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let s = '';
  for (const [v, k] of map) while (num >= v) { s += k; num -= v; }
  return s;
}
function toRomanLower(n: number) { return toRoman(n).toLowerCase(); }
function toChineseNum(n: number): string {
  const digits = ['零','一','二','三','四','五','六','七','八','九'];
  if (n < 10) return digits[n];
  if (n < 20) return '十' + (n % 10 ? digits[n % 10] : '');
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return digits[t] + '十' + (o ? digits[o] : '');
  }
  return String(n);
}

/** =========================================================
 *  13. PDF 元数据修改
 * ========================================================= */
export const pdfMetadata: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.1);
  const buf = await readAsArrayBuffer(files[0]);
  const src = await PDFDocument.load(buf);

  const setStr = (k: 'setTitle' | 'setAuthor' | 'setSubject' | 'setKeywords' | 'setCreator' | 'setProducer', v: any) => {
    if (typeof v === 'string' && v.length) (src as any)[k]?.(v);
  };
  if (!options.clear) {
    if (options.title) setStr('setTitle', options.title);
    if (options.author) setStr('setAuthor', options.author);
    if (options.subject) setStr('setSubject', options.subject);
    if (options.keywords) setStr('setKeywords', options.keywords);
    if (options.creator) setStr('setCreator', options.creator);
    setStr('setProducer', 'MendFile 全能办公工具 (https://mendfile.com)');
    const d = options.createdAt ? new Date(options.createdAt) : options.clearCreation ? new Date() : undefined;
    const m = options.modifiedAt ? new Date(options.modifiedAt) : new Date();
    if (d) {
      try { src.setCreationDate(d); } catch { /* ignore */ }
    }
    try { src.setModificationDate(m); } catch { /* ignore */ }
  } else {
    // 清空所有
    try { src.setTitle(''); } catch { /* */ }
    try { src.setAuthor(''); } catch { /* */ }
    try { src.setSubject(''); } catch { /* */ }
    try { src.setKeywords([] as any); } catch { /* */ }
    try { src.setCreator('MendFile.com'); } catch { /* */ }
    try { src.setProducer('MendFile 全能办公工具'); } catch { /* */ }
  }
  const bytes = await src.save({ updateFieldAppearances: false });
  onProgress(1);
  return {
    blob: new Blob([asBlob(bytes) as unknown as BlobPart], { type: 'application/pdf' }),
    ext: 'pdf',
    fileName: `${stripExt(safeName(files[0].name))}_元数据已更新`,
    preview: { stats: { 页数: src.getPageCount(), 操作: options.clear ? '清空敏感元数据' : '自定义修改' } },
  };
};

/* =========================================================
 *  二期 · 批次 1 · 图片工具全集（纯 Canvas，无后端）
 * ========================================================= */

/** 格式映射：选项 → MIME type */
function fmtToMime(format: string): string {
  switch (String(format).toLowerCase()) {
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'bmp': return 'image/bmp';
    default: return 'image/png';
  }
}

/** 格式映射：选项 → 扩展名 */
function fmtToExt(format: string): string {
  const f = String(format).toLowerCase();
  if (f === 'jpeg') return 'jpg';
  if (['jpg', 'png', 'webp', 'bmp'].includes(f)) return f;
  return 'png';
}

/** 从文件名/MIME 推断输入格式（小写） */
function inferFormat(file: File, fallback = 'png'): string {
  if (/\.jpe?g$/i.test(file.name) || file.type === 'image/jpeg') return 'jpg';
  if (/\.png$/i.test(file.name) || file.type === 'image/png') return 'png';
  if (/\.webp$/i.test(file.name) || file.type === 'image/webp') return 'webp';
  if (/\.bmp$/i.test(file.name) || file.type === 'image/bmp') return 'bmp';
  return fallback;
}

/** 绘制图片到 canvas（必要时缩放），返回 canvas */
function drawScaled(img: HTMLImageElement, maxW?: number, maxH?: number, bgColor?: string): HTMLCanvasElement {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (maxW || maxH) {
    const scale = Math.min(
      maxW ? maxW / w : 1,
      maxH ? maxH / h : 1,
      1
    );
    if (scale < 1) {
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
  }
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/** 打包 results 为 ZIP 或 单文件 Blob；返回统一的 ProcessOutput */
async function packImages(
  results: { name: string; blob: Blob }[],
  defaultExt: string,
  defaultFileName: string,
  onProgress: ProgressFn
): Promise<ProcessOutput> {
  if (!results.length) throw new Error('没有可用的输出结果');
  if (results.length === 1) {
    const r = results[0];
    onProgress(0.95, '准备下载');
    return {
      blob: r.blob,
      ext: stripExt(r.name.split('.').pop() || defaultExt),
      fileName: stripExt(r.name),
      preview: { stats: { 输出文件数: 1, 总大小: formatBytes(r.blob.size) } },
    };
  }
  onProgress(0.9, '正在打包 ZIP');
  const zip = new JSZip();
  let total = 0;
  results.forEach((r) => { zip.file(r.name, r.blob); total += r.blob.size; });
  const buf = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  onProgress(0.98, '打包完成');
  return {
    blob: buf,
    ext: 'zip',
    fileName: defaultFileName,
    preview: { stats: { 输出文件数: results.length, 打包总大小: formatBytes(total) } },
  };
}

/** 解析颜色 #RRGGBB → {r,g,b} */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full || 'ffffff', 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

/* ============ 图片批量压缩 ============ */
export const imageCompress: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const level = options.level || 'normal';
  const qualityCfg: Record<string, number> = { light: 0.85, normal: 0.7, extreme: 0.45 };
  const quality = qualityCfg[level] ?? 0.7;
  const results: { name: string; blob: Blob }[] = [];
  const stats: Record<string, any> = {};
  let beforeTotal = 0; let afterTotal = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    beforeTotal += f.size;
    onProgress(0.05 + (fi / files.length) * 0.8, `正在处理 ${fi + 1}/${files.length}：${f.name}`);
    const src = await readAsDataURL(f);
    const img = await loadImage(src);
    const inFmt = inferFormat(f, 'jpg');
    // 极致模式：最长边缩放到 1920
    const maxLong = level === 'extreme' ? 1920 : undefined;
    const ratio = img.naturalWidth >= img.naturalHeight ? (maxLong ? img.naturalWidth / maxLong : 1) : (maxLong ? img.naturalHeight / maxLong : 1);
    const c = ratio > 1
      ? drawScaled(img, img.naturalWidth > img.naturalHeight ? maxLong : undefined, img.naturalHeight > img.naturalWidth ? maxLong : undefined)
      : drawScaled(img);
    // 若输入是 PNG（透明），保留 PNG；否则用输入格式
    const useFmt = inFmt;
    const mime = fmtToMime(useFmt);
    // PNG 无 quality 参数，quality 仍然传入 toBlob，浏览器会忽略
    const blob = await canvasToBlob(c, mime, quality);
    afterTotal += blob.size;
    const ratioStr = beforeTotal ? Math.round((1 - afterTotal / beforeTotal) * 100) : 0;
    results.push({ name: `${stripExt(safeName(f.name))}_compressed.${fmtToExt(useFmt)}`, blob });
  }
  stats['处理文件数'] = files.length;
  stats['压缩前总大小'] = formatBytes(beforeTotal);
  stats['压缩后总大小'] = formatBytes(afterTotal);
  stats['总体积减少'] = beforeTotal ? `${Math.max(0, Math.round((1 - afterTotal / beforeTotal) * 100))}%` : '0%';
  stats['压缩档位'] = level === 'light' ? '轻度（85%）' : level === 'extreme' ? '极致（45%+缩放）' : '标准（70%）';
  return packImages(results, 'zip', `MendFile_图片压缩结果_${stats['总体积减少']}`, (r, m) => onProgress(0.85 + r * 0.12, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 图片批量格式互转 ============ */
export const imageConvert: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const targetFmt = (options.format || 'same').toLowerCase();
  const quality = Math.max(0.1, Math.min(1, Number(options.quality ?? 0.85)));
  const fillColor = options.fillColor || '#ffffff';
  const results: { name: string; blob: Blob }[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.8, `正在转换 ${fi + 1}/${files.length}：${f.name}`);
    const src = await readAsDataURL(f);
    const img = await loadImage(src);
    const outFmt = targetFmt === 'same' ? inferFormat(f, 'png') : targetFmt;
    const mime = fmtToMime(outFmt);
    // PNG → 无透明格式：先填底色
    const needFill = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'bmp') && inferFormat(f, '') === 'png';
    const c = needFill ? drawScaled(img, undefined, undefined, fillColor) : drawScaled(img);
    // 只有 jpg / webp 传 quality，其他保持默认
    const q = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'webp') ? quality : undefined;
    const blob = await canvasToBlob(c, mime, q ?? 0.92);
    results.push({ name: `${stripExt(safeName(f.name))}.${fmtToExt(outFmt)}`, blob });
  }
  return packImages(results, 'zip', 'MendFile_图片格式转换结果', (r, m) => onProgress(0.85 + r * 0.12, m || ''));
};

/* ============ 智能证件照工具 ============ */
export const idPhoto: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '正在读取图片');
  const file = files[0];
  if (!file) throw new Error('请上传一张人像照片');
  const src = await readAsDataURL(file);
  const img = await loadImage(src);

  // 尺寸模板
  const templates: Record<string, { w: number; h: number; label: string }> = {
    '1inch': { w: 295, h: 413, label: '一寸 25×35mm' },
    '2inch': { w: 413, h: 579, label: '二寸 35×49mm' },
    'small1inch': { w: 260, h: 378, label: '小一寸' },
    'small2inch': { w: 413, h: 531, label: '小二寸' },
    'big1inch': { w: 390, h: 567, label: '大一寸' },
    'passport': { w: 390, h: 567, label: '护照签证' },
    'custom': { w: Number(options.customW) || 295, h: Number(options.customH) || 413, label: '自定义' },
  };
  const tpl = templates[options.template || '1inch'] || templates['1inch'];
  const tw = tpl.w; const th = tpl.h;

  onProgress(0.2, '按模板比例居中裁剪');
  // === 居中裁剪：按目标比例先 crop 原图再 resize 到目标尺寸 ===
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const dstRatio = tw / th;
  let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
  if (srcRatio > dstRatio) {
    sw = Math.round(img.naturalHeight * dstRatio);
    sx = Math.round((img.naturalWidth - sw) / 2);
  } else {
    sh = Math.round(img.naturalWidth / dstRatio);
    sy = Math.round((img.naturalHeight - sh) / 2);
  }
  const out = document.createElement('canvas');
  out.width = tw; out.height = th;
  const ctx = out.getContext('2d')!;
  // 默认透明（保留原色）
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);

  // === 换底色 ===
  const bgMode: string = options.bgMode || 'keep'; // keep / white / blue / red / gradient / custom
  if (bgMode !== 'keep') {
    onProgress(0.4, '正在进行换底处理');
    let newColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 };
    let useGradient = false;
    if (bgMode === 'white') newColor = hexToRgb('#FFFFFF');
    else if (bgMode === 'blue') newColor = hexToRgb('#438EDB');
    else if (bgMode === 'red') newColor = hexToRgb('#D9383E');
    else if (bgMode === 'gradient') useGradient = true;
    else if (bgMode === 'custom') newColor = hexToRgb(options.customColor || '#ffffff');

    const imgData = ctx.getImageData(0, 0, tw, th);
    const d = imgData.data;
    // 取四边角平均作为"原底色"
    const cornorSample = [
      [0, 0], [tw - 1, 0], [0, th - 1], [tw - 1, th - 1],
      [Math.floor(tw / 2), 0], [Math.floor(tw / 2), th - 1],
      [0, Math.floor(th / 2)], [tw - 1, Math.floor(th / 2)],
    ];
    let br = 0, bg = 0, bb = 0;
    cornorSample.forEach(([x, y]) => {
      const i = (y * tw + x) * 4;
      br += d[i]; bg += d[i + 1]; bb += d[i + 2];
    });
    br = Math.round(br / cornorSample.length);
    bg = Math.round(bg / cornorSample.length);
    bb = Math.round(bb / cornorSample.length);

    // 阈值：色差 < threshold 判定为背景（然后做 2px 羽化）
    const threshold = 90;
    for (let y = 0; y < th; y++) {
      for (let x = 0; x < tw; x++) {
        const i = (y * tw + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const dr = r - br, dg = g - bg, db = b - bb;
        const diff = Math.sqrt(dr * dr + dg * dg + db * db);
        if (diff < threshold) {
          // 背景：替换成新颜色
          let nr = newColor.r, ng = newColor.g, nb = newColor.b;
          if (useGradient) {
            const t = y / th;
            nr = Math.round(67 * (1 - t) + 142 * t);
            ng = Math.round(142 * (1 - t) + 222 * t);
            nb = Math.round(219 * (1 - t) + 255 * t);
          }
          d[i] = nr; d[i + 1] = ng; d[i + 2] = nb; d[i + 3] = 255;
        } else if (diff < threshold + 40) {
          // 边缘羽化：线性插值 20~30% 新颜色
          const k = (diff - threshold) / 40;
          const alpha = 1 - k;
          let nr = newColor.r, ng = newColor.g, nb = newColor.b;
          if (useGradient) {
            const t = y / th;
            nr = Math.round(67 * (1 - t) + 142 * t);
            ng = Math.round(142 * (1 - t) + 222 * t);
            nb = Math.round(219 * (1 - t) + 255 * t);
          }
          d[i] = Math.round(r * (1 - alpha * 0.5) + nr * alpha * 0.5);
          d[i + 1] = Math.round(g * (1 - alpha * 0.5) + ng * alpha * 0.5);
          d[i + 2] = Math.round(b * (1 - alpha * 0.5) + nb * alpha * 0.5);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const mode: string = options.output || 'single'; // single / layout / both
  const singleBlob = await canvasToBlob(out, 'image/jpeg', 0.95);
  const singleName = `${stripExt(safeName(file.name)) || '证件照'}_${tpl.label}.jpg`;

  onProgress(0.85, '生成输出');

  const stats: Record<string, any> = {
    模板: tpl.label, 尺寸: `${tw}×${th}px`,
    换底: bgMode === 'keep' ? '保留原色' : bgMode === 'white' ? '白色' : bgMode === 'blue' ? '蓝色 (#438EDB)' : bgMode === 'red' ? '红色 (#D9383E)' : bgMode === 'gradient' ? '渐变蓝' : `自定义 ${options.customColor || ''}`,
    输出模式: mode === 'single' ? '单张' : mode === 'layout' ? '6张拼版' : '单张+拼版 ZIP',
  };

  if (mode === 'single') {
    return {
      blob: singleBlob, ext: 'jpg', fileName: stripExt(singleName),
      preview: { stats, thumbnails: [out.toDataURL('image/jpeg', 0.6)] },
    };
  }

  // === 6 张 2×3 拼版（A4 局部，保持简单：2列 3 行，图片间留 2mm 约 2px 留白）===
  const gap = 6;
  const layoutW = tw * 2 + gap * 3;
  const layoutH = th * 3 + gap * 4;
  const layout = document.createElement('canvas');
  layout.width = layoutW; layout.height = layoutH;
  const lctx = layout.getContext('2d')!;
  lctx.fillStyle = '#ffffff';
  lctx.fillRect(0, 0, layoutW, layoutH);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      const dx = gap + c * (tw + gap);
      const dy = gap + r * (th + gap);
      lctx.drawImage(out, dx, dy, tw, th);
    }
  }
  const layoutBlob = await canvasToBlob(layout, 'image/jpeg', 0.95);
  const layoutName = `${stripExt(safeName(file.name)) || '证件照'}_6张拼版.jpg`;

  if (mode === 'layout') {
    return {
      blob: layoutBlob, ext: 'jpg', fileName: stripExt(layoutName),
      preview: { stats, thumbnails: [layout.toDataURL('image/jpeg', 0.4)] },
    };
  }
  // both → zip
  const zip = new JSZip();
  zip.file(singleName, singleBlob);
  zip.file(layoutName, layoutBlob);
  const buf = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  onProgress(1);
  return {
    blob: buf, ext: 'zip', fileName: 'MendFile_证件照单张+拼版',
    preview: { stats, thumbnails: [out.toDataURL('image/jpeg', 0.5), layout.toDataURL('image/jpeg', 0.3)] },
  };
};

// ==========================================================================
// 批次 2 · 二维码工具（qr-generate / qr-batch / qr-parse）
// ==========================================================================

type EcLevel = 'L' | 'M' | 'Q' | 'H';
type DotStyle = 'square' | 'rounded' | 'dot';

function toEcConst(level: EcLevel): number {
  // qrcode-generator 运行时常量映射：ECC_L=1 / ECC_M=0 / ECC_Q=3 / ECC_H=2
  const map: Record<EcLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };
  return map[level];
}

function buildQR(content: string, ecLevel: EcLevel): any {
  if (!content) throw new Error('二维码内容不能为空');
  const inst = qrcode(0, toEcConst(ecLevel) as any); // typeNumber = 0 自动选择版本
  inst.addData(content, 'Byte');
  try {
    inst.make();
  } catch (e: any) {
    throw new Error('内容过长，请缩短内容或提高容错等级后重试');
  }
  return inst;
}

/** 判断 module(r, c) 是否落在 Finder Pattern 区域（3 个定位角 7x7，保留为方框） */
function isFinderArea(r: number, c: number, modCount: number): boolean {
  if (r < 7 && c < 7) return true;
  if (r < 7 && c >= modCount - 7) return true;
  if (r >= modCount - 7 && c < 7) return true;
  return false;
}

/** 在 Canvas 上按指定 dotStyle 绘制二维码点阵（Finder 保持方形边框保证识别） */
function drawQRModulesToCanvas(qr: any, canvas: HTMLCanvasElement, fg: string, bg: string, style: DotStyle) {
  const count = qr.getModuleCount() as number;
  const W = canvas.width, H = canvas.height;
  const marginPx = Math.max(2, Math.round(Math.min(W, H) * 0.04));
  const mod = (Math.min(W, H) - marginPx * 2) / count;
  const ctx = canvas.getContext('2d')!;
  // 背景
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  const cell = mod;
  const radius = style === 'rounded' ? cell * 0.25 : 0;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (!qr.isDark(r, c)) continue;
      const x = marginPx + c * cell;
      const y = marginPx + r * cell;
      const finder = isFinderArea(r, c, count);
      if (finder || style === 'square') {
        ctx.fillRect(x, y, cell, cell);
      } else if (style === 'rounded') {
        const rr = Math.min(radius, cell / 2 - 0.5);
        ctx.beginPath();
        ctx.moveTo(x + rr, y);
        ctx.lineTo(x + cell - rr, y);
        ctx.quadraticCurveTo(x + cell, y, x + cell, y + rr);
        ctx.lineTo(x + cell, y + cell - rr);
        ctx.quadraticCurveTo(x + cell, y + cell, x + cell - rr, y + cell);
        ctx.lineTo(x + rr, y + cell);
        ctx.quadraticCurveTo(x, y + cell, x, y + cell - rr);
        ctx.lineTo(x, y + rr);
        ctx.quadraticCurveTo(x, y, x + rr, y);
        ctx.closePath();
        ctx.fill();
      } else if (style === 'dot') {
        ctx.beginPath();
        ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  // 重绘 Finder 外边框（避免 rounded/dot 模式下定位角样式破坏识别）
  ctx.lineWidth = Math.max(1, Math.round(cell * 0.25));
  ctx.strokeStyle = fg;
  const drawFinderBox = (ax: number, ay: number) => {
    // 外框 7x7 modules
    ctx.strokeRect(ax + 0.5 * cell, ay + 0.5 * cell, 6 * cell, 6 * cell);
    // 内部小方块 3x3 modules (偏移 2)
    ctx.fillRect(ax + 2 * cell, ay + 2 * cell, 3 * cell, 3 * cell);
  };
  drawFinderBox(marginPx, marginPx);
  drawFinderBox(marginPx + (count - 7) * cell, marginPx);
  drawFinderBox(marginPx, marginPx + (count - 7) * cell);
}

async function qrToCanvasBlob(qr: any, size: number, fg: string, bg: string, style: DotStyle, format: 'png' | 'jpg', quality: number, logoDataURL?: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  drawQRModulesToCanvas(qr, canvas, fg, bg, style);
  // Logo 叠加（居中 20% 面积）
  if (logoDataURL) {
    try {
      const img = await loadImage(logoDataURL);
      const ctx = canvas.getContext('2d')!;
      const box = Math.round(Math.min(canvas.width, canvas.height) * 0.22); // 22% 面积
      const pad = Math.round(box * 0.1); // 白边 10%
      const cx = (canvas.width - box) / 2;
      const cy = (canvas.height - box) / 2;
      ctx.save();
      // 白底圆角
      ctx.fillStyle = '#ffffff';
      const rad = Math.round(box * 0.1);
      ctx.beginPath();
      ctx.moveTo(cx - pad + rad, cy - pad);
      ctx.lineTo(cx + box + pad - rad, cy - pad);
      ctx.quadraticCurveTo(cx + box + pad, cy - pad, cx + box + pad, cy - pad + rad);
      ctx.lineTo(cx + box + pad, cy + box + pad - rad);
      ctx.quadraticCurveTo(cx + box + pad, cy + box + pad, cx + box + pad - rad, cy + box + pad);
      ctx.lineTo(cx - pad + rad, cy + box + pad);
      ctx.quadraticCurveTo(cx - pad, cy + box + pad, cx - pad, cy + box + pad - rad);
      ctx.lineTo(cx - pad, cy - pad + rad);
      ctx.quadraticCurveTo(cx - pad, cy - pad, cx - pad + rad, cy - pad);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // 保持比例画 Logo
      const ratio = img.width / img.height;
      let dw = box, dh = box;
      if (ratio >= 1) dh = Math.round(box / ratio); else dw = Math.round(box * ratio);
      ctx.drawImage(img, cx + (box - dw) / 2, cy + (box - dh) / 2, dw, dh);
    } catch (_e) { /* ignore logo draw failure */ }
  }
  const type = format === 'jpg' ? 'image/jpeg' : 'image/png';
  return canvasToBlob(canvas, type, quality / 100);
}

function qrToSVGString(qr: any, fg: string, bg: string, style: DotStyle, size: number): string {
  const count = qr.getModuleCount() as number;
  const margin = Math.max(2, Math.round(size * 0.04));
  const cell = (size - margin * 2) / count;
  // 简化：SVG 统一方形 module（rounded/dot 变体在 SVG 中也用方形避免生成路径过大）
  const modules: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        const x = (margin + c * cell).toFixed(2);
        const y = (margin + r * cell).toFixed(2);
        const s = cell.toFixed(2);
        if (style === 'dot') {
          modules.push(`<circle cx="${(Number(x) + cell / 2).toFixed(2)}" cy="${(Number(y) + cell / 2).toFixed(2)}" r="${(cell * 0.44).toFixed(2)}" fill="${fg}"/>`);
        } else if (style === 'rounded') {
          const rr = Math.min(cell * 0.25, cell / 2 - 0.5).toFixed(2);
          modules.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${rr}" ry="${rr}" fill="${fg}"/>`);
        } else {
          modules.push(`<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fg}"/>`);
        }
      }
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="${bg}"/>\n${modules.join('\n')}\n</svg>\n`;
}

function previewFromCanvasBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => resolve('');
    fr.readAsDataURL(blob);
  });
}

// -------------- qr-generate：美化二维码单条生成 --------------
export const qrGenerate: ProcessFn = async ({ options }, onProgress): Promise<ProcessOutput> => {
  const content = String(options?.content ?? '').trim();
  const ecLevel = (options?.ecLevel || 'M') as EcLevel;
  const rawSize = Number(options?.size || 512);
  const size = Math.max(128, Math.min(2000, Math.round(rawSize)));
  const fg = String(options?.fgColor || '#111111');
  const bg = String(options?.bgColor || '#ffffff');
  const dotStyle = (options?.dotStyle || 'square') as DotStyle;
  const logoDataURL = String(options?.logoDataURL || '');
  const outputFormat = String(options?.outputFormat || 'png');
  onProgress(0.05, '初始化二维码矩阵');
  const qr = buildQR(content, ecLevel);
  onProgress(0.5, '渲染图形');
  if (outputFormat === 'svg') {
    const svgStr = qrToSVGString(qr, fg, bg, dotStyle, size);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    onProgress(0.9, '生成结果');
    // SVG 预览
    const thumb = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgStr)}`;
    onProgress(1);
    return {
      blob, ext: 'svg', fileName: 'MendFile_美化二维码矢量',
      preview: { stats: [{ label: '内容长度', value: content.length.toString() + ' 字符' }, { label: '尺寸', value: size + '×' + size + ' SVG' }, { label: '容错等级', value: ecLevel }], thumbnails: [thumb] },
    };
  }
  const blob = await qrToCanvasBlob(qr, size, fg, bg, dotStyle, 'png', 100, logoDataURL);
  const thumb = await previewFromCanvasBlob(blob);
  onProgress(1);
  return {
    blob, ext: 'png', fileName: 'MendFile_美化二维码',
    preview: { stats: [{ label: '内容长度', value: content.length.toString() + ' 字符' }, { label: '尺寸', value: size + '×' + size + ' px' }, { label: '容错等级', value: ecLevel }], thumbnails: [thumb] },
  };
};

// -------------- qr-batch：批量二维码生成 + ZIP 打包 --------------
export const qrBatch: ProcessFn = async ({ options }, onProgress): Promise<ProcessOutput> => {
  const raw = String(options?.lines ?? '');
  const rows = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!rows.length) throw new Error('请输入至少一行内容');
  if (rows.length > 10000) throw new Error('单次批量生成最多 10000 条，请分批操作');
  const ecLevel = (options?.ecLevel || 'M') as EcLevel;
  const rawSize = Number(options?.size || 512);
  const size = Math.max(128, Math.min(2000, Math.round(rawSize)));
  const fg = String(options?.fgColor || '#111111');
  const bg = String(options?.bgColor || '#ffffff');
  const dotStyle = (options?.dotStyle || 'square') as DotStyle;
  const prefix = String(options?.fileNamePrefix || 'qrcode').trim() || 'qrcode';
  const format = (String(options?.format || 'png').toLowerCase() === 'jpg') ? 'jpg' : 'png';
  const quality = Math.max(1, Math.min(100, Number(options?.quality || 92)));

  const padWidth = Math.max(3, String(rows.length).length);
  const fmtIdx = (i: number) => String(i).padStart(padWidth, '0');

  const zip = new JSZip();
  const manifest: string[] = ['index,filename,content'];
  const total = rows.length;
  const thumbs: string[] = [];
  for (let i = 0; i < total; i++) {
    onProgress((i + 0.5) / total, `生成 ${i + 1}/${total}`);
    const content = rows[i];
    try {
      const qr = buildQR(content, ecLevel);
      const blob = await qrToCanvasBlob(qr, size, fg, bg, dotStyle, format as any, quality, '');
      const fname = `${safeName(prefix)}_${fmtIdx(i + 1)}.${format}`;
      zip.file(fname, blob);
      manifest.push(`${i + 1},${fname},${content.replace(/"/g, '""')}`);
      if (thumbs.length < 4 && i < 4) thumbs.push(await previewFromCanvasBlob(blob));
    } catch (e: any) {
      throw new Error(`第 ${i + 1} 行生成失败：${e?.message || '内容过长'}`);
    }
  }
  zip.file('manifest.csv', manifest.join('\n'));
  onProgress(0.95, 'ZIP 打包中…');
  const buf = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  onProgress(1);
  return {
    blob: buf, ext: 'zip', fileName: 'MendFile_批量二维码_' + total + '条',
    preview: { stats: [{ label: '条目数量', value: total.toString() + ' 条' }, { label: '尺寸', value: size + '×' + size + ' px' }, { label: '格式', value: format.toUpperCase() + (format === 'jpg' ? ` (质量 ${quality}%)` : '') }, { label: '容错', value: ecLevel }], thumbnails: thumbs },
  };
};

// -------------- qr-parse：批量上传图片解析二维码 --------------
interface ParseResult { file: string; index: number; status: 'ok' | 'skip' | 'error'; content: string; message?: string; }

export const qrParse: ProcessFn = async ({ files, options }, onProgress): Promise<ProcessOutput> => {
  if (!files?.length) throw new Error('请先上传至少一张包含二维码的图片');
  if (files.length > 50) throw new Error('单次最多上传 50 张图片，请分批操作');
  const exportFmt = (String(options?.exportFormat || 'txt').toLowerCase() === 'csv') ? 'csv' : 'txt';
  const results: ParseResult[] = [];
  const total = files.length;
  const toDataUri = async (file: File): Promise<{ data: Uint8ClampedArray; w: number; h: number }> => {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const max = Math.max(img.width, img.height);
      let scale = 1;
      if (max > 1600) scale = 1600 / max; // 避免大图内存过大
      let w = Math.max(1, Math.round(img.width * scale));
      let h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const c2d = c.getContext('2d', { willReadFrequently: true })!;
      c2d.drawImage(img, 0, 0, w, h);
      // 双尺度：原图 + 放大 2x（提升小码识别率）
      const scales: number[] = [1];
      if (max < 600) scales.push(2);
      for (const s of scales) {
        const W = Math.max(1, Math.round(w * s));
        const H = Math.max(1, Math.round(h * s));
        const cc = document.createElement('canvas'); cc.width = W; cc.height = H;
        const cc2d = cc.getContext('2d', { willReadFrequently: true })!;
        cc2d.drawImage(img, 0, 0, W, H);
        const imgData = cc2d.getImageData(0, 0, W, H);
        const res = jsQR(imgData.data, W, H, { inversionAttempts: 'attemptBoth' });
        if (res && res.data) return { data: new Uint8ClampedArray(0), w: W, h: H, ...res as any } as any;
        // 兼容类型：直接返回第一个尺度结果，失败返回空 Uint8 作为占位
        void imgData;
      }
      return { data: new Uint8ClampedArray(0), w, h };
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const decodeWithjsQR = (buf: Uint8ClampedArray, w: number, h: number) => {
    if (!buf.length) return null;
    return jsQR(buf, w, h, { inversionAttempts: 'attemptBoth' });
  };
  for (let i = 0; i < total; i++) {
    onProgress((i + 0.3) / total, `解析 ${i + 1}/${total}`);
    const file = files[i];
    try {
      const loaded = await toDataUri(file);
      // toDataUri 若命中直接 res.data，把 data 填充为识别结果
      // 否则重新构造（兼容 jsQR 返回值提取）
      let dec: any = null;
      if ((loaded as any).data && typeof (loaded as any).data === 'string') {
        dec = { data: (loaded as any).data };
      } else {
        // Fallback：再次用尺度 1 尝试（首次尝试已在 toDataUri 内做）
        const url = URL.createObjectURL(file);
        try {
          const img = await loadImage(url);
          const max = Math.max(img.width, img.height);
          let scale = 1; if (max > 1600) scale = 1600 / max;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const c2d = c.getContext('2d', { willReadFrequently: true })!;
          c2d.drawImage(img, 0, 0, w, h);
          const id = c2d.getImageData(0, 0, w, h);
          dec = jsQR(id.data, w, h, { inversionAttempts: 'attemptBoth' });
          if (!dec && max < 1200) {
            const w2 = w * 2, h2 = h * 2;
            const c2 = document.createElement('canvas'); c2.width = w2; c2.height = h2;
            const c2d2 = c2.getContext('2d', { willReadFrequently: true })!;
            c2d2.drawImage(img, 0, 0, w2, h2);
            const id2 = c2d2.getImageData(0, 0, w2, h2);
            dec = jsQR(id2.data, w2, h2, { inversionAttempts: 'attemptBoth' });
          }
        } finally { URL.revokeObjectURL(url); }
      }
      if (dec && dec.data) {
        results.push({ file: file.name, index: i + 1, status: 'ok', content: String(dec.data) });
      } else {
        results.push({ file: file.name, index: i + 1, status: 'skip', content: '', message: '未识别到 QR Code（可能分辨率过低/模糊/非标准QR）' });
      }
    } catch (e: any) {
      results.push({ file: file.name, index: i + 1, status: 'error', content: '', message: e?.message || '解析异常' });
    }
    void decodeWithjsQR;
  }
  onProgress(0.9, '生成结果文件');
  const ok = results.filter(r => r.status === 'ok');
  const fail = results.filter(r => r.status !== 'ok');
  const contents: string[] = [];
  if (exportFmt === 'csv') {
    contents.push('index,filename,status,message,content');
    for (const r of results) {
      contents.push(`${r.index},"${r.file.replace(/"/g, '""')}",${r.status},"${(r.message || '').replace(/"/g, '""')}","${r.content.replace(/"/g, '""')}"`);
    }
  } else {
    for (const r of results) {
      const header = `#${r.index} [${r.status.toUpperCase()}] ${r.file}${r.message ? '  · ' + r.message : ''}`;
      contents.push(header + '\n' + (r.content || '(空)') + '\n');
    }
  }
  const blob = new Blob([contents.join('\n')], { type: 'text/plain;charset=utf-8' });
  const ext = exportFmt;
  onProgress(1);
  return {
    blob, ext, fileName: 'MendFile_二维码识别结果_' + total + '张',
    preview: {
      stats: [
        { label: '解析图片数', value: total.toString() + ' 张' },
        { label: '成功', value: ok.length.toString() + ' 张' },
        { label: '未识别/异常', value: fail.length.toString() + ' 张' },
      ],
      thumbnails: ok.slice(0, 3).map(r => {
        try {
          const qr = buildQR(r.content.slice(0, 500), 'M');
          const canvas = document.createElement('canvas');
          canvas.width = 160; canvas.height = 160;
          drawQRModulesToCanvas(qr, canvas, '#111827', '#ffffff', 'square');
          return canvas.toDataURL('image/png');
        } catch { return ''; }
      }).filter(Boolean),
      // @ts-ignore 向前兼容：resultList 由 tool page 的 panel 展示（ProcessOutput 类型宽松可忽略）
      resultList: results as any,
    },
  };
};

/* =======================================================
 *  批次 3 · 图片剩余功能补齐
 * ======================================================= */

/** 把十六进制颜色 + 不透明度组合成 rgba 字符串 */
function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 在画布上执行单边裁剪（按像素），返回新画布 */
function cropCanvasPx(src: HTMLCanvasElement, top: number, bottom: number, left: number, right: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const w = Math.max(1, src.width - left - right);
  const h = Math.max(1, src.height - top - bottom);
  c.width = w; c.height = h;
  c.getContext('2d')!.drawImage(src, left, top, w, h, 0, 0, w, h);
  return c;
}

/** 对 canvas 做 box blur 式的 alpha 羽化（只影响 alpha 通道），用于 removeBg */
function featherAlpha(imageData: ImageData, radiusPx: number): ImageData {
  if (radiusPx <= 0) return imageData;
  const { width: w, height: h, data: d } = imageData;
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3] / 255;
  const tmp = new Float32Array(w * h);
  const r = Math.max(1, Math.round(radiusPx));
  // 简单的两次水平+垂直盒式滤波近似高斯
  for (let pass = 0; pass < 2; pass++) {
    // 水平
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x < r + 1; x++) sum += alpha[y * w + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / (2 * r + 1);
        const x1 = Math.max(0, x - r);
        const x2 = Math.min(w - 1, x + r + 1);
        sum += alpha[y * w + x2] - alpha[y * w + x1];
      }
    }
    // 垂直
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y < r + 1; y++) sum += tmp[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) {
        alpha[y * w + x] = sum / (2 * r + 1);
        const y1 = Math.max(0, y - r);
        const y2 = Math.min(h - 1, y + r + 1);
        sum += tmp[y2 * w + x] - tmp[y1 * w + x];
      }
    }
  }
  for (let i = 0; i < w * h; i++) d[i * 4 + 3] = Math.round(alpha[i] * 255);
  return imageData;
}

/* ============ 3.1 图片批量加水印 ============ */
export const imageWatermark: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const mode: string = options.mode || 'text'; // text | image
  const layout: string = options.layout || 'tile'; // tile | center | corners
  const opacity = Math.max(0, Math.min(1, Number(options.opacity ?? 0.28)));
  const rotation = Number(options.rotation ?? -30);
  const padding = Math.max(0, Number(options.padding ?? 60));
  const outFmtMode: string = options.outputFormat || 'same';
  const quality = Math.max(0.1, Math.min(1, Number(options.quality ?? 0.92)));

  // 文字水印参数
  const text: string = options.text || '© MendFile';
  const fontSize = Math.max(8, Number(options.fontSize ?? 32));
  const color: string = options.color || '#111827';
  const fontFamily: string = options.fontFamily || 'system-ui, sans-serif';

  // 图片水印参数
  const logoDataURL: string = options.imageDataURL || '';
  const widthRatio = Math.max(0.02, Math.min(1, Number(options.imageWidthRatio ?? 0.18)));
  let logoImg: HTMLImageElement | null = null;
  if (mode === 'image') {
    if (!logoDataURL) throw new Error('请先上传水印图片（Logo），或将水印模式切回「文字」');
    onProgress(0.05, '加载水印图标');
    logoImg = await loadImage(logoDataURL);
  }

  const results: { name: string; blob: Blob }[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.08 + (fi / files.length) * 0.8, `正在加水印 ${fi + 1}/${files.length}：${f.name}`);
    const dataUrl = await readAsDataURL(f);
    const img = await loadImage(dataUrl);
    const baseCanvas = drawScaled(img); // 原始尺寸
    const W = baseCanvas.width;
    const H = baseCanvas.height;
    const ctx = baseCanvas.getContext('2d')!;
    ctx.save();
    ctx.globalAlpha = opacity;

    if (layout === 'tile') {
      // 平铺密集水印：以对角线的 1/6 为步长估计
      const diag = Math.sqrt(W * W + H * H);
      const step = Math.max(60, padding + fontSize * 2 + 40);
      // 先按步长生成一个比画布更大的网格坐标，然后旋转绘制
      const rad = (rotation * Math.PI) / 180;
      ctx.translate(W / 2, H / 2);
      ctx.rotate(rad);
      // 估计覆盖范围
      const spanX = Math.ceil(diag / step) + 2;
      const spanY = Math.ceil(diag / step) + 2;
      ctx.globalAlpha = opacity;
      ctx.fillStyle = color;
      if (mode === 'text') {
        ctx.font = `${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      }
      for (let gy = -spanY; gy <= spanY; gy++) {
        for (let gx = -spanX; gx <= spanX; gx++) {
          const dx = gx * step + ((gy % 2) * step) / 2; // 交错更密集
          const dy = gy * step;
          if (mode === 'text') {
            // 支持按 \n 多行
            const lines = String(text).split(/\r?\n/);
            const lh = fontSize * 1.35;
            const totalH = lh * lines.length;
            lines.forEach((ln, idx) => {
              ctx.fillText(ln, dx, dy - totalH / 2 + lh * (idx + 0.5));
            });
          } else if (logoImg) {
            const lw = Math.max(20, W * widthRatio);
            const lh = Math.round(lw * (logoImg.height / logoImg.width));
            ctx.drawImage(logoImg, dx - lw / 2, dy - lh / 2, lw, lh);
          }
        }
      }
    } else {
      // center / corners：非旋转布局（位置固定，水印本身可旋转）
      const positions: Array<{ px: number; py: number }> = [];
      const pad = padding;
      if (layout === 'center') positions.push({ px: 0.5, py: 0.5 });
      else if (layout === 'corners') {
        positions.push({ px: 0.5, py: 0.5 }); // 中
        positions.push({ px: 0, py: 0 }); // 左上
        positions.push({ px: 1, py: 0 }); // 右上
        positions.push({ px: 0, py: 1 }); // 左下
        positions.push({ px: 1, py: 1 }); // 右下
      }
      positions.forEach((pos, i) => {
        ctx.save();
        let x0: number, y0: number;
        // corners 的四个角留 padding
        if (layout === 'corners' && i > 0) {
          x0 = pos.px === 0 ? pad : pos.px === 1 ? W - pad : W / 2;
          y0 = pos.py === 0 ? pad : pos.py === 1 ? H - pad : H / 2;
        } else {
          x0 = W * pos.px;
          y0 = H * pos.py;
        }
        ctx.translate(x0, y0);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.fillStyle = color;
        if (mode === 'text') {
          ctx.font = `${fontSize}px ${fontFamily}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const lines = String(text).split(/\r?\n/);
          const lh = fontSize * 1.35;
          const totalH = lh * lines.length;
          lines.forEach((ln, idx) => {
            ctx.fillText(ln, 0, -totalH / 2 + lh * (idx + 0.5));
          });
        } else if (logoImg) {
          // 中心位置水印按 widthRatio；四角位置按比例缩小一半
          const baseRatio = i === 0 ? widthRatio : widthRatio * 0.6;
          const lw = Math.max(20, W * baseRatio);
          const lh = Math.round(lw * (logoImg.height / Math.max(1, logoImg.width)));
          ctx.drawImage(logoImg, -lw / 2, -lh / 2, lw, lh);
        }
        ctx.restore();
      });
    }
    ctx.restore();

    const inFmt = inferFormat(f, 'png');
    const outFmt = outFmtMode === 'same' ? inFmt : outFmtMode;
    const mime = fmtToMime(outFmt);
    // 无透明 → JPG：默认白底
    let outCanvas = baseCanvas;
    if ((outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'bmp') && inFmt === 'png') {
      outCanvas = document.createElement('canvas');
      outCanvas.width = W; outCanvas.height = H;
      const octx = outCanvas.getContext('2d')!;
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, W, H);
      octx.drawImage(baseCanvas, 0, 0);
    }
    const q = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'webp') ? quality : undefined;
    const blob = await canvasToBlob(outCanvas, mime, q ?? 0.92);
    results.push({ name: `${stripExt(safeName(f.name))}_wmark.${fmtToExt(outFmt)}`, blob });
  }

  const stats: Record<string, any> = {
    水印模式: mode === 'text' ? '文字水印' : '图片水印',
    布局方式: layout === 'tile' ? '平铺密集（防盗）' : layout === 'center' ? '居中单张' : '四角 + 居中 5 处',
    透明度: `${Math.round(opacity * 100)}%`,
    旋转角度: `${rotation}°`,
    输出格式: outFmtMode === 'same' ? '保持原格式' : outFmtMode.toUpperCase(),
  };
  return packImages(results, 'zip', 'MendFile_批量加水印结果', (r, m) => onProgress(0.85 + r * 0.12, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 3.2 长图拼接 ============ */
export const imageStitch: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  if (files.length < 2) throw new Error('请至少上传 2 张图片用于拼接');
  const direction: string = options.direction || 'vertical'; // vertical | horizontal | grid2
  const gap = Math.max(0, Math.min(200, Number(options.gap ?? 8)));
  const bgTransparent = !!options.bgTransparent;
  const bgColor: string = options.bgColor || '#ffffff';
  const outFmt: string = options.outputFormat || 'jpg';
  const quality = Math.max(0.1, Math.min(1, Number(options.quality ?? 0.92)));

  // 加载全部图片
  onProgress(0.08, `读取图片（共 ${files.length} 张）`);
  const imgs: HTMLImageElement[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const dataUrl = await readAsDataURL(files[fi]);
    imgs.push(await loadImage(dataUrl));
    onProgress(0.08 + (fi / files.length) * 0.35, `读取图片 ${fi + 1}/${files.length}`);
  }

  onProgress(0.5, '计算画布并拼接');
  let canvasW = 0, canvasH = 0;
  const drawList: Array<{ img: HTMLImageElement; dx: number; dy: number; dw: number; dh: number }> = [];

  if (direction === 'vertical') {
    // 等宽：取最大宽度，其他按比例缩放到同宽
    canvasW = Math.max(...imgs.map((i) => i.naturalWidth));
    const sizes = imgs.map((img) => {
      const scale = canvasW / img.naturalWidth;
      return { w: canvasW, h: Math.round(img.naturalHeight * scale) };
    });
    canvasH = sizes.reduce((s, z) => s + z.h, 0) + gap * (imgs.length + 1);
    let y = gap;
    for (let i = 0; i < imgs.length; i++) {
      drawList.push({ img: imgs[i], dx: 0, dy: y, dw: sizes[i].w, dh: sizes[i].h });
      y += sizes[i].h + gap;
    }
  } else if (direction === 'horizontal') {
    // 等高：取最大高度
    canvasH = Math.max(...imgs.map((i) => i.naturalHeight));
    const sizes = imgs.map((img) => {
      const scale = canvasH / img.naturalHeight;
      return { w: Math.round(img.naturalWidth * scale), h: canvasH };
    });
    canvasW = sizes.reduce((s, z) => s + z.w, 0) + gap * (imgs.length + 1);
    let x = gap;
    for (let i = 0; i < imgs.length; i++) {
      drawList.push({ img: imgs[i], dx: x, dy: 0, dw: sizes[i].w, dh: sizes[i].h });
      x += sizes[i].w + gap;
    }
  } else {
    // grid2：2 列网格（1 列也可），每行两张，所有图片按第 1 行最大宽度统一列宽
    const cols = 2;
    const rows = Math.ceil(imgs.length / cols);
    // 先按统一列宽：取图片最大宽度 × 1 列，2 列则按比例
    const firstRowMax = Math.max(...imgs.slice(0, cols).map((i) => i.naturalWidth));
    const cellW = firstRowMax;
    // 计算每张图缩放到 cellW 后的高度
    const sizes = imgs.map((img) => {
      const scale = cellW / img.naturalWidth;
      return { w: cellW, h: Math.round(img.naturalHeight * scale) };
    });
    const rowHeights: number[] = [];
    for (let r = 0; r < rows; r++) {
      let rh = 0;
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx < sizes.length) rh = Math.max(rh, sizes[idx].h);
      }
      rowHeights.push(rh);
    }
    canvasW = cellW * cols + gap * (cols + 1);
    canvasH = rowHeights.reduce((s, h) => s + h, 0) + gap * (rows + 1);
    let y = gap;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= imgs.length) continue;
        const x = gap + c * (cellW + gap);
        // 垂直居中
        const extra = (rowHeights[r] - sizes[idx].h) / 2;
        drawList.push({ img: imgs[idx], dx: x, dy: y + extra, dw: sizes[idx].w, dh: sizes[idx].h });
      }
      y += rowHeights[r] + gap;
    }
  }

  // 安全限制：避免过大画布（超过 4096MB 像素会炸）
  if (canvasW * canvasH > 180_000_000) {
    throw new Error(`拼接后的画布过大（约 ${(canvasW * canvasH / 1_000_000).toFixed(0)} 百万像素），请减少图片数量或先压缩再拼接`);
  }

  const out = document.createElement('canvas');
  out.width = canvasW; out.height = canvasH;
  const octx = out.getContext('2d')!;
  if (!bgTransparent) {
    octx.fillStyle = bgColor;
    octx.fillRect(0, 0, canvasW, canvasH);
  }
  for (const d of drawList) {
    octx.drawImage(d.img, d.dx, d.dy, d.dw, d.dh);
  }

  onProgress(0.82, '编码输出');
  const mime = fmtToMime(outFmt);
  // JPG/BMP 默认不透明：若用户选了透明但格式不支持，强制白底
  if ((outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'bmp') && bgTransparent) {
    const flat = document.createElement('canvas');
    flat.width = canvasW; flat.height = canvasH;
    const fctx = flat.getContext('2d')!;
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, canvasW, canvasH);
    fctx.drawImage(out, 0, 0);
    const blob = await canvasToBlob(flat, mime, quality);
    const ext = fmtToExt(outFmt);
    return {
      blob, ext, fileName: 'MendFile_长图拼接结果',
      preview: {
        stats: {
          拼接模式: direction === 'vertical' ? '纵向' : direction === 'horizontal' ? '横向' : '2 列网格拼图',
          输入图片: `${files.length} 张`,
          输出尺寸: `${canvasW} × ${canvasH} px`,
          间距: `${gap} px`,
          背景: bgTransparent ? '透明' : bgColor,
          输出格式: outFmt.toUpperCase(),
        },
        thumbnails: [flat.toDataURL('image/jpeg', 0.45)],
      },
    };
  }
  const q = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'webp') ? quality : undefined;
  const blob = await canvasToBlob(out, mime, q ?? 0.92);
  onProgress(1);
  return {
    blob, ext: fmtToExt(outFmt), fileName: 'MendFile_长图拼接结果',
    preview: {
      stats: {
        拼接模式: direction === 'vertical' ? '纵向' : direction === 'horizontal' ? '横向' : '2 列网格拼图',
        输入图片: `${files.length} 张`,
        输出尺寸: `${canvasW} × ${canvasH} px`,
        间距: `${gap} px`,
        背景: bgTransparent ? '透明' : bgColor,
        输出格式: outFmt.toUpperCase(),
      },
      thumbnails: [out.toDataURL('image/jpeg', 0.45)],
    },
  };
};

/* ============ 3.3 图片分割工具 ============ */
export const imageSplit: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const mode: string = options.mode || 'grid'; // grid | rows | cols
  let rows = Math.max(1, Math.min(12, Number(options.rows ?? 3)));
  let cols = Math.max(1, Math.min(12, Number(options.cols ?? 3)));
  if (mode === 'rows') cols = 1;
  if (mode === 'cols') rows = 1;
  const overlap = Math.max(0, Math.min(80, Number(options.overlap ?? 0)));
  const outFmtMode: string = options.outputFormat || 'same';
  const quality = Math.max(0.1, Math.min(1, Number(options.quality ?? 0.92)));

  const results: { name: string; blob: Blob }[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.8, `正在分割 ${fi + 1}/${files.length}：${f.name}`);
    const dataUrl = await readAsDataURL(f);
    const img = await loadImage(dataUrl);
    const base = drawScaled(img);
    const W = base.width, H = base.height;

    const inFmt = inferFormat(f, 'png');
    const outFmt = outFmtMode === 'same' ? inFmt : outFmtMode;
    const mime = fmtToMime(outFmt);
    const q = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'webp') ? quality : undefined;

    const prefix = stripExt(safeName(f.name)) || 'image';

    // 切片宽高：考虑 overlap
    // 列宽 = (W + overlap*(cols-1)) / cols 的近似：让首尾不留白
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 计算每片区域：均分 + 向后重叠 overlap 像素（最后一片除外）
        const pieceW = Math.round((W + overlap * (cols - 1)) / cols);
        const pieceH = Math.round((H + overlap * (rows - 1)) / rows);
        const sx = Math.min(W - 1, c * (pieceW - overlap));
        const sy = Math.min(H - 1, r * (pieceH - overlap));
        const sw = Math.min(W - sx, pieceW);
        const sh = Math.min(H - sy, pieceH);
        const slice = document.createElement('canvas');
        slice.width = sw; slice.height = sh;
        slice.getContext('2d')!.drawImage(base, sx, sy, sw, sh, 0, 0, sw, sh);
        // JPG/BMP：PNG 原图需铺白底
        let outSlice: HTMLCanvasElement = slice;
        if ((outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'bmp') && inFmt === 'png') {
          outSlice = document.createElement('canvas');
          outSlice.width = sw; outSlice.height = sh;
          const fx = outSlice.getContext('2d')!;
          fx.fillStyle = '#ffffff';
          fx.fillRect(0, 0, sw, sh);
          fx.drawImage(slice, 0, 0);
        }
        const blob = await canvasToBlob(outSlice, mime, q ?? 0.92);
        results.push({ name: `${prefix}_r${r + 1}c${c + 1}.${fmtToExt(outFmt)}`, blob });
      }
    }
  }

  const stats: Record<string, any> = {
    分割模式: mode === 'grid' ? `网格（${rows} 行 × ${cols} 列）` : mode === 'rows' ? `仅横向等分（${rows} 行）` : `仅纵向等分（${cols} 列）`,
    单图切片数: `${rows * cols} 片`,
    重叠像素: `${overlap} px`,
    输出总切片: `${results.length} 张`,
    输出格式: outFmtMode === 'same' ? '保持原格式' : outFmtMode.toUpperCase(),
  };
  return packImages(results, 'zip', 'MendFile_图片分割结果', (r, m) => onProgress(0.85 + r * 0.12, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 3.4 图片旋转裁剪 ============ */
export const imageEdit: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const rotate = Number(options.rotate ?? 0);
  const flipH = !!options.flipH;
  const flipV = !!options.flipV;
  const cropUnit: string = options.cropUnit || 'pixel';
  let cropTop = Math.max(0, Number(options.cropTop ?? 0));
  let cropBottom = Math.max(0, Number(options.cropBottom ?? 0));
  let cropLeft = Math.max(0, Number(options.cropLeft ?? 0));
  let cropRight = Math.max(0, Number(options.cropRight ?? 0));
  const outFmtMode: string = options.outputFormat || 'same';
  const quality = Math.max(0.1, Math.min(1, Number(options.quality ?? 0.92)));

  const results: { name: string; blob: Blob }[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.8, `正在编辑 ${fi + 1}/${files.length}：${f.name}`);
    const dataUrl = await readAsDataURL(f);
    const img = await loadImage(dataUrl);
    let canvas = drawScaled(img);
    let W = canvas.width;
    let H = canvas.height;

    // 1) 裁剪：百分比 → 像素
    let t = cropTop, b = cropBottom, l = cropLeft, r = cropRight;
    if (cropUnit === 'percent') {
      t = Math.round((cropTop / 100) * H);
      b = Math.round((cropBottom / 100) * H);
      l = Math.round((cropLeft / 100) * W);
      r = Math.round((cropRight / 100) * W);
    }
    t = Math.min(H - 1, t); b = Math.min(H - 1 - t, b);
    l = Math.min(W - 1, l); r = Math.min(W - 1 - l, r);
    if (t > 0 || b > 0 || l > 0 || r > 0) {
      canvas = cropCanvasPx(canvas, t, b, l, r);
      W = canvas.width; H = canvas.height;
    }

    // 2) 翻转（在原图坐标系）
    if (flipH || flipV) {
      const flipped = document.createElement('canvas');
      flipped.width = W; flipped.height = H;
      const fctx = flipped.getContext('2d')!;
      fctx.save();
      fctx.translate(flipH ? W : 0, flipV ? H : 0);
      fctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      fctx.drawImage(canvas, 0, 0);
      fctx.restore();
      canvas = flipped;
    }

    // 3) 旋转：90/180/270 特殊处理更快；其他角度扩充画布
    let rot = ((rotate % 360) + 360) % 360;
    if (rot !== 0) {
      if (rot === 90 || rot === 270) {
        const out = document.createElement('canvas');
        out.width = H; out.height = W;
        const octx = out.getContext('2d')!;
        octx.save();
        if (rot === 90) { octx.translate(H, 0); octx.rotate(Math.PI / 2); }
        else { octx.translate(0, W); octx.rotate(-Math.PI / 2); }
        octx.drawImage(canvas, 0, 0);
        octx.restore();
        canvas = out; W = canvas.width; H = canvas.height;
      } else if (rot === 180) {
        const out = document.createElement('canvas');
        out.width = W; out.height = H;
        const octx = out.getContext('2d')!;
        octx.save(); octx.translate(W, H); octx.rotate(Math.PI);
        octx.drawImage(canvas, 0, 0); octx.restore();
        canvas = out;
      } else {
        // 任意角度：扩充 bounding box
        const rad = (rot * Math.PI) / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const nW = Math.round(W * cos + H * sin);
        const nH = Math.round(W * sin + H * cos);
        const out = document.createElement('canvas');
        out.width = nW; out.height = nH;
        const octx = out.getContext('2d')!;
        // 默认透明（保留格式支持）；JPG 后续转白底
        octx.save();
        octx.translate(nW / 2, nH / 2);
        octx.rotate(rad);
        octx.drawImage(canvas, -W / 2, -H / 2);
        octx.restore();
        canvas = out; W = nW; H = nH;
      }
    }

    // 4) 格式转换
    const inFmt = inferFormat(f, 'png');
    const outFmt = outFmtMode === 'same' ? inFmt : outFmtMode;
    const mime = fmtToMime(outFmt);
    const q = (outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'webp') ? quality : undefined;
    // 透明 → 无透明：白底
    if ((outFmt === 'jpg' || outFmt === 'jpeg' || outFmt === 'bmp') && (inFmt === 'png' || rot !== 0)) {
      const flat = document.createElement('canvas');
      flat.width = W; flat.height = H;
      const fx = flat.getContext('2d')!;
      fx.fillStyle = '#ffffff';
      fx.fillRect(0, 0, W, H);
      fx.drawImage(canvas, 0, 0);
      canvas = flat;
    }
    const blob = await canvasToBlob(canvas, mime, q ?? 0.92);
    results.push({ name: `${stripExt(safeName(f.name))}_edited.${fmtToExt(outFmt)}`, blob });
  }

  const stats: Record<string, any> = {
    旋转角度: `${rotate}°`,
    翻转: (flipH ? '水平 ' : '') + (flipV ? '垂直' : '') || '无',
    裁剪: cropUnit === 'percent'
      ? `上 ${cropTop}% / 下 ${cropBottom}% / 左 ${cropLeft}% / 右 ${cropRight}%`
      : `上 ${cropTop} / 下 ${cropBottom} / 左 ${cropLeft} / 右 ${cropRight} px`,
    输出格式: outFmtMode === 'same' ? '保持原格式' : outFmtMode.toUpperCase(),
  };
  return packImages(results, 'zip', 'MendFile_图片旋转裁剪结果', (r, m) => onProgress(0.85 + r * 0.12, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 3.5 前端高精度 AI 抠图（U2NetP Portrait INT8 量化蒸馏 ONNX + Flood Fill 兜底）============ */

// Flood Fill 容差法（保留作为离线/受限网络/模型加载失败自动兜底，避免用户无法使用）
// 输入参数复用 imageRemoveBg 外层函数里计算的 options
async function legacyRemoveBgOnce(
  f: File,
  threshold: number,
  feather: number,
  bgIsTransparent: boolean,
  bgRgb: { r: number; g: number; b: number },
  edgeRefine: boolean,
  autoCompress: boolean
) {
  const dataUrl = await readAsDataURL(f);
  const img = await loadImage(dataUrl);
  const MAX_LONG = autoCompress ? 2400 : 9999;
  let w = img.naturalWidth, h = img.naturalHeight;
  if (Math.max(w, h) > MAX_LONG) {
    const scale = MAX_LONG / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const total = w * h;
  let br = 0, bg = 0, bb = 0, count = 0;
  for (let x = 0; x < w; x++) {
    let i = x * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; count++;
    i = ((h - 1) * w + x) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; count++;
  }
  for (let y = 1; y < h - 1; y++) {
    let i = y * w * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; count++;
    i = (y * w + w - 1) * 4; br += d[i]; bg += d[i + 1]; bb += d[i + 2]; count++;
  }
  br = Math.round(br / count); bg = Math.round(bg / count); bb = Math.round(bb / count);
  const thrSq = threshold * threshold;
  const visited = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;
  const isBg = (idx: number) => {
    const i = idx * 4;
    const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
    return dr * dr + dg * dg + db * db <= thrSq;
  };
  for (let x = 0; x < w; x++) {
    let idx = x; if (!visited[idx] && isBg(idx)) { visited[idx] = 1; stack[sp++] = idx; }
    idx = (h - 1) * w + x; if (!visited[idx] && isBg(idx)) { visited[idx] = 1; stack[sp++] = idx; }
  }
  for (let y = 1; y < h - 1; y++) {
    let idx = y * w; if (!visited[idx] && isBg(idx)) { visited[idx] = 1; stack[sp++] = idx; }
    idx = y * w + w - 1; if (!visited[idx] && isBg(idx)) { visited[idx] = 1; stack[sp++] = idx; }
  }
  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % w;
    const y = (idx / w) | 0;
    if (x > 0) { const ni = idx - 1; if (!visited[ni] && isBg(ni)) { visited[ni] = 1; stack[sp++] = ni; } }
    if (x < w - 1) { const ni = idx + 1; if (!visited[ni] && isBg(ni)) { visited[ni] = 1; stack[sp++] = ni; } }
    if (y > 0) { const ni = idx - w; if (!visited[ni] && isBg(ni)) { visited[ni] = 1; stack[sp++] = ni; } }
    if (y < h - 1) { const ni = idx + w; if (!visited[ni] && isBg(ni)) { visited[ni] = 1; stack[sp++] = ni; } }
  }
  const edgeBand = Math.max(15, threshold * 0.6);
  const softMax = threshold + edgeBand;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const i = idx * 4;
      if (visited[idx]) { d[i + 3] = 0; } else {
        const adjBg = (x > 0 && visited[idx - 1]) || (x < w - 1 && visited[idx + 1])
          || (y > 0 && visited[idx - w]) || (y < h - 1 && visited[idx + w]);
        if (adjBg) {
          const dr = d[i] - br, dg = d[i + 1] - bg, db = d[i + 2] - bb;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist <= softMax) {
            const k = (dist - threshold) / edgeBand;
            d[i + 3] = Math.round(255 * Math.max(0, Math.min(1, k)));
          }
        }
      }
    }
  }
  if (edgeRefine) {
    const toRemove = new Uint8Array(total);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        if (!visited[idx] && d[idx * 4 + 3] > 0) {
          let bgNeighbors = 0;
          if (visited[idx - 1] || d[(idx - 1) * 4 + 3] === 0) bgNeighbors++;
          if (visited[idx + 1] || d[(idx + 1) * 4 + 3] === 0) bgNeighbors++;
          if (visited[idx - w] || d[(idx - w) * 4 + 3] === 0) bgNeighbors++;
          if (visited[idx + w] || d[(idx + w) * 4 + 3] === 0) bgNeighbors++;
          if (bgNeighbors >= 3) toRemove[idx] = 1;
        }
      }
    }
    for (let i = 0; i < total; i++) { if (toRemove[i]) { d[i * 4 + 3] = 0; visited[i] = 1; } }
  }
  if (feather > 0) featherAlpha(imgData, feather);
  ctx.putImageData(imgData, 0, 0);
  let outCanvas = canvas;
  if (!bgIsTransparent) {
    outCanvas = document.createElement('canvas');
    outCanvas.width = w; outCanvas.height = h;
    const octx = outCanvas.getContext('2d')!;
    octx.fillStyle = `rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b})`;
    octx.fillRect(0, 0, w, h);
    octx.drawImage(canvas, 0, 0);
  }
  return outCanvas;
}

export const imageRemoveBg: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const threshold = Math.max(10, Math.min(120, Number(options.threshold ?? 35)));
  const feather = Math.max(0, Math.min(15, Number(options.feather ?? 2)));
  const bgMode: 'transparent' | 'white' | 'custom' = (options.bgMode as any) || 'white';
  const customBgColor: string = options.customBgColor || '#ffffff';
  const edgeRefine: boolean = options.edgeRefine !== false;
  const autoCompress: boolean = options.autoCompress !== false;
  const useAi: boolean = options.useAi !== false; // 默认开启高精度 AI

  const bgIsTransparent = bgMode === 'transparent';
  const bgFill = bgMode === 'custom' ? customBgColor : '#ffffff';
  const bgRgb = hexToRgb(bgFill);

  const results: { name: string; blob: Blob }[] = [];
  let usedEngine: 'ai' | 'legacy' | 'mixed' = 'ai';
  let engineError: string | null = null;

  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    const baseProg = 0.05 + (fi / files.length) * 0.85;
    onProgress(baseProg, `正在抠图 ${fi + 1}/${files.length}：${f.name}`);

    let cutout: HTMLCanvasElement | null = null;
    let thisEngine: 'ai' | 'legacy' = 'ai';
    if (useAi) {
      try {
        const result = await aiRemoveBg(f, { smooth: edgeRefine }, (_stage, ratio: any, m?: string) =>
          onProgress(baseProg + (typeof ratio === 'number' ? ratio : 0) * 0.85, m ? `[${f.name}] ${m}` : undefined)
        );
        cutout = result.cutoutCanvas;
      } catch (e: any) {
        engineError = (e?.message || '模型加载失败').slice(0, 120);
        resetSessionForTest();
        // 自动降级 Flood Fill 容差法（保证 100% 可用）
        onProgress(baseProg + 0.1, `⚠️ 高精度 AI 暂不可用，自动切换本地容差法：${engineError}`);
        cutout = await legacyRemoveBgOnce(f, threshold, feather, true, bgRgb, edgeRefine, autoCompress);
        thisEngine = 'legacy';
      }
    } else {
      cutout = await legacyRemoveBgOnce(f, threshold, feather, true, bgRgb, edgeRefine, autoCompress);
      thisEngine = 'legacy';
    }

    if (thisEngine === 'legacy' && usedEngine === 'ai') usedEngine = fi === 0 ? 'legacy' : 'mixed';
    if (thisEngine === 'ai' && usedEngine === 'legacy') usedEngine = 'mixed';

    // 可选羽化（AI 已经很精细，仅对 legacy 或用户显式指定时叠加）
    if (feather > 0 && (thisEngine === 'legacy' || feather >= 3)) {
      const tmp = document.createElement('canvas');
      tmp.width = cutout.width; tmp.height = cutout.height;
      const tctx = tmp.getContext('2d')!;
      tctx.drawImage(cutout, 0, 0);
      const idata = tctx.getImageData(0, 0, tmp.width, tmp.height);
      featherAlpha(idata, feather);
      tctx.putImageData(idata, 0, 0);
      cutout = tmp;
    }

    // 叠加背景 + 智能压缩
    onProgress(baseProg + 0.88, `叠加背景并压缩 ${fi + 1}/${files.length}`);
    const flat = flattenCutout(cutout, bgMode, customBgColor);
    const { blob, ext } = await compressCutoutBlob(flat, bgMode, autoCompress ? 2400 : 99999);
    results.push({ name: `${stripExt(safeName(f.name))}_removebg.${ext}`, blob });
  }

  const engineLabel = usedEngine === 'ai'
    ? `U2NetP Portrait INT8 量化蒸馏 ONNX · 推理引擎 ${getLastEp() || 'Web'}`
    : usedEngine === 'legacy'
      ? `Flood Fill 容差法（AI 降级兜底，原因：${engineError || '用户关闭'}）`
      : `混合模式（部分 AI、部分降级，${engineError || ''}）`;

  const stats: Record<string, any> = {
    算法: engineLabel,
    模型缓存: 'IndexedDB 本地永久缓存（首次下载约 4.3MB / INT8≈1.2MB，秒级启动）',
    速度指标: '常规图 300–800ms（WebGPU/WebGL；WASM 下 ≤1.2s），会话复用后每张速度稳定，不会越跑越慢',
    输出背景: bgIsTransparent ? '透明 PNG' : bgMode === 'white' ? '白色背景（默认）' : `自定义纯色 ${customBgColor}`,
    自动压缩: autoCompress ? `已启用（最长边 ≤ 2400px，按背景模式择优 JPG/PNG/WebP）` : '关闭',
    输出策略: results.length === 1 ? '单张 → 直接输出原图文件下载' : `${results.length} 张 → 打包 ZIP 下载`,
  };

  return packImages(results, 'png', 'MendFile_抠图结果', (r, m) => onProgress(0.9 + r * 0.09, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* =======================================================
 *  批次 4 · 多媒体轻量工具（6 个 · 纯 MediaRecorder + WebAudio）
 *  不引入 ffmpeg.wasm；统一重编码时长 ≈ 音视频时长（实时近似）
 * ======================================================= */

/** 选择浏览器支持的最佳 MIME 类型，找不到则返回空串 */
function pickSupportedMime(category: 'video' | 'audio', preferred: string): string {
  const MR = (globalThis as any).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== 'function') return '';
  const videoCandidates: string[] = [];
  const audioCandidates: string[] = [];
  if (preferred === 'mp4') {
    videoCandidates.push('video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4');
    audioCandidates.push('audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/x-m4a');
  } else if (preferred === 'webm') {
    videoCandidates.push('video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm');
    audioCandidates.push('audio/webm;codecs=opus', 'audio/webm');
  } else {
    // auto: 先 mp4 再 webm
    videoCandidates.push(
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4',
      'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'
    );
    audioCandidates.push(
      'audio/mp4;codecs=mp4a.40.2', 'audio/mp4',
      'audio/webm;codecs=opus', 'audio/webm'
    );
  }
  const list = category === 'video' ? videoCandidates : audioCandidates;
  for (const m of list) { try { if (MR.isTypeSupported(m)) return m; } catch { /* ignore */ } }
  return '';
}

/** 质量档位 → 视频目标码率（bits/s）· 按分辨率 1280×720 基准线性缩放 */
function videoBitrateByLevel(level: string, basePixels: number): number {
  // base: 921_600 px = 1280*720
  const factor = Math.max(0.35, Math.min(3, basePixels / 921_600));
  const baseMap: Record<string, number> = { crisp: 10_000_000, balanced: 5_000_000, extreme: 2_500_000 };
  return Math.round((baseMap[level] ?? 5_000_000) * factor);
}

/** 等待 <video> 加载完元数据 */
function waitVideoMeta(video: HTMLVideoElement, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('视频元数据加载超时（可能是损坏文件或浏览器不支持该编码）')), timeoutMs);
    const done = () => { clearTimeout(timer); resolve(); };
    if (video.readyState >= 1) return done();
    video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('error', () => { clearTimeout(timer); reject(new Error('视频解码失败：浏览器不支持此编码或文件损坏')); }, { once: true });
  });
}

/** 等待 <video> seek 完成 */
function waitSeeked(video: HTMLVideoElement, target: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('视频 Seek 超时')), timeoutMs);
    const handler = () => {
      clearTimeout(timer);
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
    try { video.currentTime = target; }
    catch (e) { clearTimeout(timer); reject(e as Error); }
  });
}

/** 编码 AudioBuffer → WAV（16-bit PCM, mono/stereo） */
function encodeWAV(buffer: AudioBuffer, sampleRateOverride?: number): Blob {
  const sr = sampleRateOverride ?? buffer.sampleRate;
  const numCh = Math.min(2, buffer.numberOfChannels);
  // Resample by linear interpolation if rates differ (轻量近似；浏览器内置 decodeAudioData 通常已统一)
  let length = buffer.length;
  if (sampleRateOverride && sampleRateOverride !== buffer.sampleRate) {
    length = Math.round(buffer.length * (sampleRateOverride / buffer.sampleRate));
  }
  const interleaved = new Int16Array(length * numCh);
  for (let ch = 0; ch < numCh; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const srcIdx = sampleRateOverride ? i * buffer.sampleRate / sampleRateOverride : i;
      const i0 = Math.floor(srcIdx);
      const frac = srcIdx - i0;
      const a = data[Math.min(i0, data.length - 1)] ?? 0;
      const b = data[Math.min(i0 + 1, data.length - 1)] ?? 0;
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      interleaved[i * numCh + ch] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
  }
  const dataByteLen = interleaved.byteLength;
  const ab = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  const blockAlign = numCh * 2;
  const byteRate = sr * blockAlign;
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataByteLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataByteLen, true);
  // copy interleaved bytes
  const bytes = new Uint8Array(ab, 44, dataByteLen);
  bytes.set(new Uint8Array(interleaved.buffer, interleaved.byteOffset, dataByteLen));
  return new Blob([ab], { type: 'audio/wav' });
}

/** 解码音频 File → AudioBuffer */
async function decodeAudio(file: File): Promise<AudioBuffer> {
  const buf = await readAsArrayBuffer(file);
  const Ctx = (globalThis.AudioContext || (globalThis as any).webkitAudioContext) as typeof AudioContext;
  if (!Ctx) throw new Error('当前浏览器不支持 Web Audio API');
  const ctx = new Ctx();
  try {
    return await ctx.decodeAudioData(buf.slice(0));
  } finally {
    void ctx.close();
  }
}

/** 裁剪并（可选）淡入淡出处理 AudioBuffer，返回新 AudioBuffer */
function processAudioBuffer(
  src: AudioBuffer,
  opts: { startSec: number; endSec: number; fadeIn: number; fadeOut: number; targetSampleRate?: number }
): AudioBuffer {
  const sr = opts.targetSampleRate ?? src.sampleRate;
  const totalLen = Math.round(src.duration * sr);
  let start = Math.max(0, Math.round(opts.startSec * sr));
  let end = opts.endSec <= 0 ? totalLen : Math.min(totalLen, Math.round(opts.endSec * sr));
  if (end <= start) end = Math.min(totalLen, start + 1);
  const len = end - start;
  const Ctx = (globalThis.AudioContext || (globalThis as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx({ sampleRate: sr });
  const out = ctx.createBuffer(src.numberOfChannels, len, sr);
  void ctx.close();
  const fi = Math.min(len, Math.max(0, Math.round(opts.fadeIn * sr)));
  const fo = Math.min(len - fi, Math.max(0, Math.round(opts.fadeOut * sr)));
  for (let ch = 0; ch < src.numberOfChannels; ch++) {
    const s = src.getChannelData(ch);
    const d = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const srcIdx = start + i;
      const ratio = sr / src.sampleRate;
      // interpolated sampling across rate
      const sf = srcIdx / ratio;
      const i0 = Math.floor(sf);
      const frac = sf - i0;
      const a = s[Math.min(i0, s.length - 1)] ?? 0;
      const b = s[Math.min(i0 + 1, s.length - 1)] ?? 0;
      let v = a + (b - a) * frac;
      if (i < fi) v *= i / Math.max(1, fi);
      else if (i >= len - fo) { const t = (len - 1 - i) / Math.max(1, fo); v *= Math.max(0, t); }
      d[i] = v;
    }
  }
  return out;
}

/** AudioBuffer → 压缩后的 Blob，走 MediaRecorder（≈ 实时） */
async function recordAudioBuffer(buffer: AudioBuffer, mime: string, bitrateBps: number): Promise<Blob> {
  const Ctx = (globalThis.AudioContext || (globalThis as any).webkitAudioContext) as typeof AudioContext;
  const ctx = new Ctx({ sampleRate: buffer.sampleRate });
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const dest = ctx.createMediaStreamDestination();
  source.connect(dest);
  source.connect(ctx.destination); // 不播放：实际可静音，保持链路
  try {
    const MR = (globalThis as any).MediaRecorder;
    const recOptions: any = { mimeType: mime || undefined };
    if (bitrateBps > 0) recOptions.audioBitsPerSecond = bitrateBps;
    const rec = new MR(dest.stream, recOptions);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e: any) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise<Blob>((resolve, reject) => {
      rec.onerror = (e: any) => reject(new Error('MediaRecorder 录制失败：' + (e?.message || 'unknown')));
      rec.onstop = () => resolve(new Blob(chunks, { type: chunks[0]?.type || mime.split(';')[0] || 'audio/webm' }));
    });
    rec.start(250);
    source.start(0);
    // 保证播放与录制完整时长 + 尾部 250ms 余量
    await new Promise<void>((res) => setTimeout(res, buffer.duration * 1000 + 350));
    try { rec.stop(); } catch { /* ignore */ }
    source.stop();
    return await stopped;
  } finally {
    try { source.disconnect(); } catch { /* ignore */ }
    void ctx.close();
  }
}

/** 视频统一重编码 · 返回 Blob（带 canvas 缩放/录制时长） */
async function processVideoFile(
  file: File,
  opts: {
    startSec: number; endSec: number;
    scalePct: number;
    level: string;
    audioBitrateKbps: number;
    requestFmt: string; // 'auto' | 'mp4' | 'webm'
    onTick?: (progress01: number, msg?: string) => void;
  }
): Promise<{ blob: Blob; actualMime: string; actualExt: string; info: Record<string, any> }> {
  // 0) 准备
  const video = document.createElement('video');
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.controls = false;
  video.preload = 'auto';
  const url = URL.createObjectURL(file);
  video.src = url;
  await waitVideoMeta(video);

  const duration = isFinite(video.duration) ? video.duration : 0;
  const baseW = video.videoWidth || 0;
  const baseH = video.videoHeight || 0;
  if (baseW === 0 || baseH === 0) throw new Error('视频尺寸无效，可能是损坏文件或纯音频文件');

  let startSec = Math.max(0, opts.startSec);
  let endSec = opts.endSec <= 0 ? duration : Math.min(duration, opts.endSec);
  if (endSec <= startSec + 0.05) { endSec = Math.min(duration, startSec + 0.5); if (endSec <= startSec) endSec = Math.min(duration, startSec + 1); }

  const scale = Math.max(0.1, Math.min(1, opts.scalePct / 100));
  let outW = Math.max(48, Math.round(baseW * scale));
  let outH = Math.max(48, Math.round(baseH * scale));
  if (outW % 2) outW -= 1; if (outH % 2) outH -= 1; // 编码偏好偶数
  const basePixels = baseW * baseH;
  const videoBitsPerSec = videoBitrateByLevel(opts.level, basePixels);
  const audioBitsPerSec = Math.max(16_000, opts.audioBitrateKbps * 1000);

  const fmtPref = opts.requestFmt === 'webm' ? 'webm' : 'mp4';
  const mime = pickSupportedMime('video', opts.requestFmt === 'auto' ? 'auto' : fmtPref) || pickSupportedMime('video', 'auto');
  if (!mime) throw new Error('当前浏览器 MediaRecorder 不支持任何视频编码，请升级到最新版 Chrome / Edge / Safari');

  // 1) 创建 canvas + captureStream
  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  const cctx = canvas.getContext('2d')!;
  const fps = 30;
  const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(fps) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(fps) : null;
  if (!canvasStream) throw new Error('当前浏览器不支持 HTMLCanvasElement.captureStream，请升级浏览器');

  // 2) 获取视频捕获的音频轨（如有）
  let videoStream: MediaStream | null = null;
  try { videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream ? (video as any).mozCaptureStream() : null; } catch { /* ignore */ }
  const audioTracks: MediaStreamTrack[] = [];
  if (videoStream) for (const t of videoStream.getAudioTracks()) audioTracks.push(t);

  // 合并
  const combined = new MediaStream([
    ...(canvasStream.getVideoTracks() || []),
    ...audioTracks,
  ]);

  // 3) MediaRecorder
  const MR = (globalThis as any).MediaRecorder;
  const recOpts: any = { mimeType: mime, videoBitsPerSecond: videoBitsPerSec };
  if (audioBitsPerSec > 0) recOpts.audioBitsPerSecond = audioBitsPerSec;
  const recorder = new MR(combined, recOpts);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e: any) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stoppedP = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = (e: any) => reject(new Error('视频录制失败：' + (e?.message || 'unknown')));
    recorder.onstop = () => resolve(new Blob(chunks, { type: chunks[0]?.type || mime.split(';')[0] || 'video/webm' }));
  });

  // 4) Seek 到 start, play, draw 帧
  await waitSeeked(video, startSec);
  // 绘制首帧（防止首帧黑色）
  cctx.drawImage(video, 0, 0, outW, outH);
  video.muted = true;
  try { await video.play(); } catch (e) { throw new Error('浏览器阻止自动播放，请使用 HTTPS 或最新版浏览器：' + ((e as Error)?.message || '')); }
  recorder.start(500);

  const totalTarget = endSec - startSec;
  let stopped = false;
  const stopAll = () => {
    if (stopped) return;
    stopped = true;
    try { recorder.stop(); } catch { /* ignore */ }
    try { video.pause(); } catch { /* ignore */ }
  };

  // 帧绘制循环：requestVideoFrameCallback 优先，退化为 rAF
  const startWall = Date.now();
  await new Promise<void>((resolve) => {
    const draw = () => {
      if (stopped) return;
      cctx.drawImage(video, 0, 0, outW, outH);
      const cur = video.currentTime;
      const prog = Math.max(0, Math.min(1, totalTarget > 0 ? (cur - startSec) / totalTarget : 0));
      if (opts.onTick) opts.onTick(prog, `录制中 ${(cur - startSec).toFixed(1)}s / ${totalTarget.toFixed(1)}s`);
      if (cur >= endSec - 0.02 || video.ended) {
        stopAll();
        setTimeout(resolve, 350);
        return;
      }
      // 超时保护：wall time > target*1.2 + 15s
      if ((Date.now() - startWall) > totalTarget * 1200 + 15_000) {
        stopAll();
        setTimeout(resolve, 350);
        return;
      }
      if ((video as any).requestVideoFrameCallback) {
        (video as any).requestVideoFrameCallback(draw);
      } else {
        requestAnimationFrame(draw);
      }
    };
    if ((video as any).requestVideoFrameCallback) {
      (video as any).requestVideoFrameCallback(draw);
    } else {
      requestAnimationFrame(draw);
    }
    // safety timeout
    setTimeout(() => { if (!stopped) { stopAll(); setTimeout(resolve, 400); } }, totalTarget * 1100 + 60_000);
  });

  const blob = await stoppedP;
  // cleanup
  try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  combined.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  canvasStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  videoStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
  (video as any).src = ''; try { video.load(); } catch { /* ignore */ }

  const actualMime = blob.type || mime.split(';')[0];
  const actualExt = actualMime.includes('mp4') ? 'mp4' : actualMime.includes('webm') ? 'webm' : (mime.includes('mp4') ? 'mp4' : 'webm');
  const info: Record<string, any> = {
    原始尺寸: `${baseW}×${baseH}px`, 原始时长: duration.toFixed(2) + 's',
    输出尺寸: `${outW}×${outH}px`, 裁剪区间: `${startSec.toFixed(2)}s ~ ${endSec.toFixed(2)}s（共 ${totalTarget.toFixed(2)}s）`,
    视频目标码率: (videoBitsPerSec / 1_000_000).toFixed(2) + ' Mbps',
    音频目标码率: (audioBitsPerSec / 1000) + ' kbps',
    使用MIME: mime, 实际输出MIME: actualMime,
  };
  return { blob, actualMime, actualExt, info };
}

/* ============ 4.1 视频压缩 ============ */
export const videoCompress: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.01, '准备处理');
  const level: string = options.level || 'balanced';
  const scalePct = Number(options.scale ?? 100);
  const audioBitrateKbps = Number(options.audioBitrate ?? 128);
  const requestFmt: string = options.outputFormat || 'auto';
  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.85, `开始处理 ${fi + 1}/${files.length}：${f.name}`);
    try {
      const r = await processVideoFile(f, {
        startSec: 0, endSec: 0, scalePct, level, audioBitrateKbps, requestFmt,
        onTick: (subP, msg) => {
          const base = 0.05 + (fi / files.length) * 0.85;
          const span = 0.85 / files.length;
          onProgress(Math.min(0.95, base + subP * span), `[${fi + 1}/${files.length}] ${msg || ''}`);
        },
      });
      infos.push({ file: f.name, ...r.info, 输出大小: formatBytes(r.blob.size) });
      results.push({ name: `${stripExt(safeName(f.name))}_compressed.${r.actualExt}`, blob: r.blob });
    } catch (e: any) {
      throw new Error(`处理「${f.name}」失败：${e?.message || String(e)}`);
    }
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    质量档位: level === 'crisp' ? '清晰（≈10Mbps 基准）' : level === 'extreme' ? '极致（≈2.5Mbps 基准）' : '均衡（≈5Mbps 基准）',
    缩放: `${scalePct}%`,
    音频码率: `${audioBitrateKbps} kbps`,
    请求格式: requestFmt === 'auto' ? '自动（浏览器最佳）' : requestFmt.toUpperCase(),
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i['输出大小']}`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_视频压缩结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 4.2 视频裁剪截取 ============ */
export const videoCrop: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.01, '准备处理');
  const mode: string = options.mode || 'seconds';
  const startSec = Math.max(0, Number(options.startSec ?? 0));
  const endSec = Math.max(0, Number(options.endSec ?? 0));
  const startPct = Math.max(0, Math.min(100, Number(options.startPercent ?? 0)));
  const endPct = Math.max(0, Math.min(100, Number(options.endPercent ?? 100)));
  const quality: string = options.quality || 'balanced';
  const requestFmt: string = options.outputFormat || 'auto';

  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.85, `读取 ${fi + 1}/${files.length}：${f.name}`);
    // 先加载元数据以计算 percent 模式下起止秒
    const video = document.createElement('video');
    video.muted = true; video.preload = 'auto'; video.crossOrigin = 'anonymous';
    const url = URL.createObjectURL(f);
    video.src = url;
    let duration = 0;
    try { await waitVideoMeta(video); duration = isFinite(video.duration) ? video.duration : 0; }
    finally { try { URL.revokeObjectURL(url); } catch { /* ignore */ } (video as any).src = ''; }
    let ss = startSec, ee = endSec;
    if (mode === 'percent') {
      ss = duration * (startPct / 100);
      ee = duration * (endPct / 100);
    }
    try {
      const r = await processVideoFile(f, {
        startSec: ss, endSec: ee, scalePct: 100, level: quality,
        audioBitrateKbps: 160, requestFmt,
        onTick: (subP, msg) => {
          const base = 0.05 + (fi / files.length) * 0.85;
          const span = 0.85 / files.length;
          onProgress(Math.min(0.95, base + subP * span), `[${fi + 1}/${files.length}] ${msg || ''}`);
        },
      });
      infos.push({ file: f.name, 原始时长: duration.toFixed(2) + 's', ...r.info, 输出大小: formatBytes(r.blob.size) });
      results.push({ name: `${stripExt(safeName(f.name))}_clip.${r.actualExt}`, blob: r.blob });
    } catch (e: any) {
      throw new Error(`处理「${f.name}」失败：${e?.message || String(e)}`);
    }
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    裁剪模式: mode === 'percent' ? `百分比区间 ${startPct}% ~ ${endPct}%` : `精确秒数 ${startSec}s ~ ${endSec === 0 ? '末尾' : endSec + 's'}`,
    重编码质量: quality === 'crisp' ? '清晰' : quality === 'extreme' ? '极致' : '均衡',
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i.裁剪区间} → ${i['输出大小']}`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_视频裁剪结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 4.3 视频格式转换 ============ */
export const videoConvert: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.01, '准备处理');
  const format: string = options.format || 'mp4';
  const quality: string = options.quality || 'balanced';
  const audioBitrateKbps = Number(options.audioBitrate ?? 128);
  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.85, `转码 ${fi + 1}/${files.length}：${f.name}`);
    try {
      const r = await processVideoFile(f, {
        startSec: 0, endSec: 0, scalePct: 100, level: quality, audioBitrateKbps, requestFmt: format,
        onTick: (subP, msg) => {
          const base = 0.05 + (fi / files.length) * 0.85;
          const span = 0.85 / files.length;
          onProgress(Math.min(0.95, base + subP * span), `[${fi + 1}/${files.length}] ${msg || ''}`);
        },
      });
      infos.push({ file: f.name, 原始类型: f.type || '未知', 请求格式: format, 实际格式: r.actualExt.toUpperCase(), 输出大小: formatBytes(r.blob.size) });
      results.push({ name: `${stripExt(safeName(f.name))}.${r.actualExt}`, blob: r.blob });
    } catch (e: any) {
      throw new Error(`处理「${f.name}」失败：${e?.message || String(e)}`);
    }
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    请求格式: format.toUpperCase(),
    质量档位: quality === 'crisp' ? '高清' : quality === 'extreme' ? '省流量' : '标准',
    音频码率: `${audioBitrateKbps} kbps`,
    说明: '若浏览器不支持请求格式会自动降级为兼容编码，并在"实际格式"中体现',
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i['原始类型']} → ${i.实际格式} (${i['输出大小']})`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_视频格式转换结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 4.4 音频压缩 ============ */
export const audioCompress: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const bitrateKbps = Number(options.bitrate ?? 128);
  const sampleRate = Number(options.sampleRate ?? 44100);
  const outputFormat: string = options.outputFormat || 'auto';
  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.82, `解码 ${fi + 1}/${files.length}：${f.name}`);
    const buffer = await decodeAudio(f);
    const processed = processAudioBuffer(buffer, { startSec: 0, endSec: 0, fadeIn: 0, fadeOut: 0, targetSampleRate: sampleRate });
    let blob: Blob; let ext: string;
    if (outputFormat === 'wav') {
      blob = encodeWAV(processed, sampleRate); ext = 'wav';
    } else {
      const pref = outputFormat === 'mp4' ? 'mp4' : outputFormat === 'webm' ? 'webm' : 'auto';
      const mime = pickSupportedMime('audio', pref) || pickSupportedMime('audio', 'auto');
      if (!mime) { blob = encodeWAV(processed, sampleRate); ext = 'wav'; }
      else {
        onProgress(0.05 + (fi / files.length) * 0.82 + 0.15, `编码 ${fi + 1}/${files.length}（约 ${processed.duration.toFixed(0)}s）`);
        blob = await recordAudioBuffer(processed, mime, bitrateKbps * 1000);
        ext = blob.type.includes('webm') ? 'webm' : blob.type.includes('mp4') || blob.type.includes('m4a') ? 'm4a' : (mime.includes('webm') ? 'webm' : 'm4a');
        if (ext === 'm4a' && (blob.type.includes('webm'))) ext = 'webm';
        if (ext === 'm4a') ext = 'mp4'; // 统一 mp4 后缀更通用
      }
    }
    infos.push({ file: f.name, 原始大小: formatBytes(f.size), 输出大小: formatBytes(blob.size), 输出格式: ext.toUpperCase(), 码率: `${bitrateKbps} kbps`, 采样率: `${sampleRate} Hz` });
    results.push({ name: `${stripExt(safeName(f.name))}_compressed.${ext}`, blob });
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    码率: `${bitrateKbps} kbps`,
    采样率: `${sampleRate} Hz`,
    输出模式: outputFormat === 'wav' ? 'WAV(PCM无损)' : outputFormat,
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i['原始大小']} → ${i['输出大小']} (${i.输出格式})`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_音频压缩结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 4.5 音频裁剪截取 ============ */
export const audioCrop: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const mode: string = options.mode || 'seconds';
  let startSec = Math.max(0, Number(options.startSec ?? 0));
  let endSec = Math.max(0, Number(options.endSec ?? 0));
  const startPct = Math.max(0, Math.min(100, Number(options.startPercent ?? 0)));
  const endPct = Math.max(0, Math.min(100, Number(options.endPercent ?? 100)));
  const fadeIn = Math.max(0, Math.min(3, Number(options.fadeIn ?? 0)));
  const fadeOut = Math.max(0, Math.min(3, Number(options.fadeOut ?? 0)));
  const outputFormat: string = options.outputFormat || 'auto';
  const outputBitrate = Number(options.outputBitrate ?? 192);

  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.82, `解码 ${fi + 1}/${files.length}：${f.name}`);
    const buffer = await decodeAudio(f);
    const dur = buffer.duration;
    let ss = startSec, ee = endSec;
    if (mode === 'percent') { ss = dur * (startPct / 100); ee = dur * (endPct / 100); }
    const processed = processAudioBuffer(buffer, { startSec: ss, endSec: ee, fadeIn, fadeOut });
    let blob: Blob; let ext: string;
    if (outputFormat === 'wav') {
      blob = encodeWAV(processed); ext = 'wav';
    } else {
      const pref = outputFormat === 'mp4' ? 'mp4' : outputFormat === 'webm' ? 'webm' : 'auto';
      const mime = pickSupportedMime('audio', pref) || pickSupportedMime('audio', 'auto');
      if (!mime) { blob = encodeWAV(processed); ext = 'wav'; }
      else {
        onProgress(0.05 + (fi / files.length) * 0.82 + 0.15, `编码 ${fi + 1}/${files.length}（约 ${processed.duration.toFixed(0)}s）`);
        blob = await recordAudioBuffer(processed, mime, outputBitrate * 1000);
        ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      }
    }
    infos.push({ file: f.name, 原始时长: dur.toFixed(2) + 's', 裁剪区间: `${ss.toFixed(2)}s ~ ${ee <= 0 ? '末尾' : ee.toFixed(2) + 's'}`, 淡入淡出: `${fadeIn}s / ${fadeOut}s`, 输出大小: formatBytes(blob.size), 输出格式: ext.toUpperCase() });
    results.push({ name: `${stripExt(safeName(f.name))}_clip.${ext}`, blob });
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    裁剪模式: mode === 'percent' ? `按百分比 ${startPct}% ~ ${endPct}%` : `按秒 ${startSec}s ~ ${endSec <= 0 ? '末尾' : endSec + 's'}`,
    淡入淡出: `${fadeIn}s / ${fadeOut}s`,
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i.裁剪区间} (${i.输出格式} · ${i['输出大小']})`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_音频裁剪结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 4.6 音频格式转换 ============ */
export const audioConvert: ProcessFn = async ({ files, options }, onProgress) => {
  onProgress(0.02, '准备处理');
  const format: string = options.format || 'wav';
  const bitrateKbps = Number(options.bitrate ?? 192);
  const sampleRate = Number(options.sampleRate ?? 44100);
  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    onProgress(0.05 + (fi / files.length) * 0.82, `解码 ${fi + 1}/${files.length}：${f.name}`);
    const buffer = await decodeAudio(f);
    const processed = processAudioBuffer(buffer, { startSec: 0, endSec: 0, fadeIn: 0, fadeOut: 0, targetSampleRate: sampleRate });
    let blob: Blob; let ext: string;
    if (format === 'wav') {
      blob = encodeWAV(processed, sampleRate); ext = 'wav';
    } else {
      const mime = pickSupportedMime('audio', format);
      if (!mime) {
        // 浏览器不支持请求的压缩格式 → 降级 WAV 并在详情中注明
        blob = encodeWAV(processed, sampleRate); ext = 'wav';
        infos.push({ file: f.name, 原始: f.type || '未知', 请求: format.toUpperCase(), 实际: 'WAV (降级：浏览器不支持请求编码)', 大小: formatBytes(blob.size) });
      } else {
        onProgress(0.05 + (fi / files.length) * 0.82 + 0.15, `编码 ${fi + 1}/${files.length}（约 ${processed.duration.toFixed(0)}s）`);
        blob = await recordAudioBuffer(processed, mime, bitrateKbps * 1000);
        ext = blob.type.includes('webm') ? 'webm' : 'mp4';
        infos.push({ file: f.name, 原始: f.type || '未知', 请求: format.toUpperCase(), 实际: ext.toUpperCase(), 码率: `${bitrateKbps} kbps`, 采样率: `${sampleRate} Hz`, 大小: formatBytes(blob.size) });
      }
    }
    if (!infos[infos.length - 1] || infos[infos.length - 1].file !== f.name) {
      infos.push({ file: f.name, 原始: f.type || '未知', 请求: format.toUpperCase(), 实际: ext.toUpperCase(), 采样率: `${sampleRate} Hz`, 大小: formatBytes(blob.size) });
    }
    results.push({ name: `${stripExt(safeName(f.name))}.${ext}`, blob });
  }
  const stats: Record<string, any> = {
    处理文件: `${files.length} 个`,
    请求格式: format.toUpperCase(),
    码率: format === 'wav' ? '无损 PCM 16-bit' : `${bitrateKbps} kbps`,
    采样率: `${sampleRate} Hz`,
    详情: infos.slice(0, 5).map((i) => `${i.file}：${i.原始} → ${i.实际} (${i.大小})`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_音频格式转换结果', (r, m) => onProgress(0.88 + r * 0.1, m || '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 5.1 文本批量处理 ============ */
export const textProcess: ProcessFn = async ({ files, options }, onProgress) => {
  const mode: string = options.mode || 'clean';
  const results: { name: string; blob: Blob }[] = [];
  const infos: Record<string, any>[] = [];

  // ---- clean helpers ----
  const cleanText = (t: string, opt: any): string => {
    let s = t;
    if (opt.fullwidthToHalf) {
      // 全角→半角（字母/数字/空格/标点）
      s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
      s = s.replace(/　/g, ' ');
    }
    if (opt.removeAllSpaces) {
      s = s.replace(/[ \t\u3000]+/g, '');
    } else {
      if (opt.trimEach) {
        s = s.split('\n').map((ln) => ln.replace(/^[ \t]+|[ \t]+$/g, '')).join('\n');
      }
    }
    if (opt.removeBlankLines) {
      s = s.replace(/\n{2,}/g, '\n').replace(/^\n+|\n+$/g, '');
    }
    return s;
  };
  // ---- mask helpers ----
  const maskText = (t: string, opt: any): string => {
    let s = t;
    if (opt.maskPhone) {
      s = s.replace(/(\+?86[-\s]?)?1[3-9]\d{9}/g, (m) => {
        const digits = m.replace(/\D/g, '');
        const len = digits.length;
        if (len === 11) return digits.slice(0, 3) + '****' + digits.slice(7);
        return m.slice(0, Math.max(0, m.length - 8)) + '****' + m.slice(Math.max(0, m.length - 4));
      });
    }
    if (opt.maskEmail) {
      s = s.replace(/([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, (_, u, d) => {
        const name = u.length <= 2 ? u : (u[0] + '*'.repeat(Math.max(2, u.length - 2)) + u[u.length - 1]);
        return `${name}@${d}`;
      });
    }
    if (opt.maskIdCard) {
      s = s.replace(/\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx]\b/g, (m) =>
        m.slice(0, 4) + '**********' + m.slice(14)
      );
      s = s.replace(/\b[1-9]\d{5}\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}\b/g, (m) =>
        m.slice(0, 3) + '********' + m.slice(12)
      );
    }
    if (opt.maskBank) {
      s = s.replace(/\b[3-6]\d{15,18}\b/g, (m) =>
        m.slice(0, 4) + ' **** **** ' + m.slice(m.length - 4)
      );
    }
    return s;
  };

  // ---- diff helper (LCS-based unified diff) ----
  const doDiff = (a: string, b: string, mode: string): string => {
    const la = a.split(/\r?\n/), lb = b.split(/\r?\n/);
    const n = la.length, m = lb.length;
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = la[i] === lb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    const out: string[] = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (la[i] === lb[j]) { out.push(`  ${la[i]}`); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push(`- ${la[i]}`); i++; }
      else { out.push(`+ ${lb[j]}`); j++; }
    }
    while (i < n) { out.push(`- ${la[i]}`); i++; }
    while (j < m) { out.push(`+ ${lb[j]}`); j++; }
    return `--- 原始 (${n} 行)\n+++ 新文件 (${m} 行)\n\n` + out.join('\n');
  };

  if (mode === 'diff') {
    onProgress(0.1, '读取文件中');
    if (files.length < 2) throw new Error('差异对比需要两个文件（原始 vs 新文件）');
    const fa = await files[0].text(), fb = await files[1].text();
    onProgress(0.5, '差异计算中');
    const result = doDiff(fa, fb, options.diffMode || 'unified');
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    infos.push({ 原始: files[0].name, 新文件: files[1].name, 差异行数: result.split('\n').filter(l => /^[+-]/.test(l)).length });
    onProgress(0.95, '打包中');
    return packImages([{ name: `${stripExt(files[0].name || 'diff')}_vs_${stripExt(files[1].name) || 'diff'}.diff.txt`, blob }], 'zip', 'MendFile_文本差异结果', (r) => onProgress(0.95 + r * 0.05))
      .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), 详情: infos } } }));
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress((i / files.length) * 0.8, `处理 ${i + 1}/${files.length}：${f.name}`);
    let text;
    try { text = await f.text(); } catch { text = ''; }
    let out = text, action = '';
    if (mode === 'clean') { out = cleanText(text, options); action = '清洗'; }
    else if (mode === 'mask') { out = maskText(text, options); action = '脱敏'; }
    else if (mode === 'trad') {
      out = options.tradDirection === 't2s' ? toSimplified(text) : toTraditional(text);
      action = options.tradDirection === 't2s' ? '繁转简' : '简转繁';
    }
    const blob = new Blob([out], { type: 'text/plain;charset=utf-8' });
    results.push({ name: `${stripExt(safeName(f.name))}_${action}.txt`, blob });
    infos.push({ file: f.name, 操作: action, 原始: formatBytes(f.size), 处理后: formatBytes(blob.size) });
  }
  const stats: Record<string, any> = {
    模式: mode === 'clean' ? '清洗' : mode === 'mask' ? '脱敏' : mode === 'trad' ? `繁简转换(${options.tradDirection === 't2s' ? '繁→简' : '简→繁'}，收录${getDictSize()}字)` : '差异对比',
    处理文件: `${files.length} 个`,
    详情: infos.slice(0, 5).map((i) => `${i.file}（${i.操作}，${i.原始} → ${i.处理后}）`).join('；'),
  };
  return packImages(results, 'zip', 'MendFile_文本处理结果', (r) => onProgress(0.8 + r * 0.2, '打包中'))
    .then((out) => ({ ...out, preview: { stats: { ...(out.preview?.stats || {}), ...stats } } }));
};

/* ============ 5.2 工时计算与薪资 ============ */
export const workHours: ProcessFn = async ({ options }, onProgress) => {
  onProgress(0.1, '计算中');
  const mode: string = options.mode || 'single';
  const lines: string[] = [];
  lines.push('======================================================');
  lines.push(' MendFile 工时计算与薪资报告');
  lines.push(` 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('======================================================');

  const hmToMin = (s: string): number => {
    const [h, m] = String(s || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const minToHm = (m: number): string => {
    const sign = m < 0 ? '-' : '';
    m = Math.abs(Math.round(m));
    return `${sign}${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;
  };

  const calOne = (ws: string, we: string, ls: string, le: string, label: string) => {
    const wsm = hmToMin(ws), wem = hmToMin(we);
    const lsm = hmToMin(ls), lem = hmToMin(le);
    let total = wem - wsm;
    if (total <= 0) total += 24 * 60; // 跨天
    // 午休重叠扣除
    let overlap = 0;
    if (lem > lsm && wem > wsm) {
      const s = Math.max(wsm, lsm), e = Math.min(wem, lem);
      overlap = Math.max(0, e - s);
    }
    const workMin = total - overlap;
    return { label, totalMin: total, lunchMin: overlap, workMin };
  };

  const hourlyMode: string = options.salaryMode || 'hourly';
  const workDays = Number(options.workDaysPerMonth) || 22;
  let hourlyRate = Number(options.hourlyRate) || 0;
  if (hourlyMode === 'monthly') {
    const monthly = Number(options.monthlyRate) || 0;
    hourlyRate = monthly / workDays / 8;
  }
  lines.push(`【薪资设置】模式：${hourlyMode === 'monthly' ? '月薪反推时薪' : '直接时薪'}；时薪：¥${hourlyRate.toFixed(2)}/h`);
  if (hourlyMode === 'monthly') lines.push(`  → 月薪 ¥${Number(options.monthlyRate) || 0} ÷ ${workDays} 天/月 ÷ 8h/天 = ¥${hourlyRate.toFixed(2)}/h`);

  const rate15 = options.overtime15 ? 1.5 : 1;
  const rate20 = options.overtime20 ? 2 : 1;
  const rate30 = options.overtime30 ? 3 : 1;
  lines.push(`【加班倍率】工作日 ${rate15}x / 周末 ${rate20}x / 节假日 ${rate30}x`);
  lines.push('------------------------------------------------------');

  const processRow = (row: { date?: string; ws: string; we: string; type?: string }) => {
    const r = calOne(row.ws, row.we, options.lunchStart || '12:00', options.lunchEnd || '13:00', row.date || '单日');
    const stdMin = 8 * 60;
    const normalMin = Math.min(r.workMin, stdMin);
    const otMin = Math.max(0, r.workMin - stdMin);
    const type = row.type || 'normal';
    const otRate = type === 'holiday' ? rate30 : type === 'weekend' ? rate20 : rate15;
    const salary = (normalMin / 60) * hourlyRate + (otMin / 60) * hourlyRate * otRate;
    return { ...r, normalMin, otMin, otRate, salary };
  };

  let grandSalary = 0, grandMin = 0;
  if (mode === 'single') {
    const r = processRow({ ws: options.workStart || '09:00', we: options.workEnd || '18:00' });
    lines.push(`【单日工时】上班 ${options.workStart} → 下班 ${options.workEnd}（午休 ${minToHm(r.lunchMin)} 扣除）`);
    lines.push(`  · 总时长 ${minToHm(r.totalMin)}，有效工时 ${minToHm(r.workMin)}`);
    lines.push(`  · 标准工时 ${minToHm(r.normalMin)} + 加班 ${minToHm(r.otMin)} ×${r.otRate}`);
    lines.push(`  · 本日应得薪资：¥${r.salary.toFixed(2)}`);
    grandSalary = r.salary; grandMin = r.workMin;
  } else {
    const raw = String(options.batchData || '').trim();
    if (!raw) throw new Error('批量模式请粘贴 CSV 打卡数据（每行：日期,上班,下班,类型）');
    const rows = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.push(`【批量模式】共 ${rows.length} 条打卡记录`);
    lines.push('------------------------------------------------------');
    for (const row of rows) {
      const parts = row.split(/[,\t]/).map(x => x.trim());
      const date = parts[0] || '';
      const ws = parts[1] || '09:00', we = parts[2] || '18:00';
      const type = (parts[3] || '').toLowerCase();
      try {
        const r = processRow({ date, ws, we, type });
        lines.push(`✓ ${date}：${ws}→${we} 有效 ${minToHm(r.workMin)}，加班 ${minToHm(r.otMin)}，薪资 ¥${r.salary.toFixed(2)}`);
        grandSalary += r.salary; grandMin += r.workMin;
      } catch (e: any) {
        lines.push(`✗ ${date}：解析失败 - ${e?.message || e}`);
      }
    }
  }
  lines.push('------------------------------------------------------');
  lines.push(`【合计】有效总工时：${minToHm(grandMin)}（${(grandMin / 60).toFixed(2)} 小时）`);
  lines.push(`【合计】应付总薪资：¥${grandSalary.toFixed(2)}`);
  lines.push('');
  lines.push('※ 本报告不含个税、社保扣除，仅供参考。');

  onProgress(0.9, '生成报告');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const stats = { 总工时: `${(grandMin / 60).toFixed(2)}h`, 总薪资: `¥${grandSalary.toFixed(2)}`, 模式: mode === 'single' ? '单日' : '批量' };
  return {
    blob,
    fileName: 'MendFile_工时计算报告',
    ext: 'txt',
    preview: { stats },
  };
};

/* ============ 5.3 时间戳转换 ============ */
export const timestampConvert: ProcessFn = async ({ options }, onProgress) => {
  onProgress(0.1, '转换中');
  const mode: string = options.mode || 'ts2date';
  const lines: string[] = [];
  lines.push('======================================================');
  lines.push(' MendFile 时间戳转换报告');
  lines.push(` 生成时间：${new Date().toLocaleString('zh-CN')}`);
  lines.push('======================================================');

  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const fmtAll = (d: Date) => {
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
    const bj = new Date(d.getTime() + 8 * 3600 * 1000);
    const bjStr = `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}:${pad(bj.getUTCSeconds())} GMT+8`;
    return { local, utc, bj: bjStr };
  };
  const isNum = (s: string) => /^-?\d+$/.test(s.trim());

  if (mode === 'batch') {
    const raw = String(options.batchInput || '').trim();
    if (!raw) throw new Error('批量模式请粘贴多行输入（每行一个时间戳或日期）');
    const rows = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.push(`【批量模式】${rows.length} 条输入`);
    lines.push('------------------------------------------------------');
    for (const line of rows) {
      if (isNum(line)) {
        const n = Number(line);
        const isMs = String(Math.abs(n)).length >= 13;
        const ms = isMs ? n : n * 1000;
        const d = new Date(ms);
        const f = fmtAll(d);
        lines.push(`• 输入: ${line} (${isMs ? '毫秒' : '秒'})`);
        lines.push(`   本地: ${f.local}   UTC: ${f.utc}   北京时间: ${f.bj}`);
      } else {
        const d = new Date(line.replace(/-/g, '/'));
        if (isNaN(d.getTime())) {
          lines.push(`• 输入: ${line} → ✗ 解析失败`);
          continue;
        }
        const sec = Math.floor(d.getTime() / 1000);
        const ms = d.getTime();
        const f = fmtAll(d);
        lines.push(`• 输入: ${line}`);
        lines.push(`   秒级时间戳: ${sec}   毫秒级: ${ms}`);
        lines.push(`   本地: ${f.local}   UTC: ${f.utc}   北京时间: ${f.bj}`);
      }
    }
  } else if (mode === 'date2ts') {
    const dt = String(options.dateTime || '').trim();
    const d = new Date(dt.replace(/-/g, '/'));
    if (isNaN(d.getTime())) throw new Error('日期格式无法解析，请使用 YYYY-MM-DD HH:mm:ss');
    const sec = Math.floor(d.getTime() / 1000);
    const ms = d.getTime();
    const f = fmtAll(d);
    lines.push(`【日期 → 时间戳】输入: ${dt}`);
    lines.push(`  秒级（10位）:  ${sec}`);
    lines.push(`  毫秒级（13位）: ${ms}`);
    lines.push(`  本地时区:  ${f.local}`);
    lines.push(`  UTC:  ${f.utc}`);
    lines.push(`  北京时间: ${f.bj}`);
  } else {
    const raw = String(options.timestamp || '').trim();
    if (!isNum(raw)) throw new Error('请输入纯数字时间戳（10位秒 or 13位毫秒）');
    const n = Number(raw);
    const isMs = String(Math.abs(n)).length >= 13;
    const ms = isMs ? n : n * 1000;
    const d = new Date(ms);
    const f = fmtAll(d);
    lines.push(`【时间戳 → 日期】输入: ${raw}  (${isMs ? '毫秒级 13 位' : '秒级 10 位'})`);
    lines.push(`  本地时区:  ${f.local}`);
    lines.push(`  UTC:  ${f.utc}`);
    lines.push(`  北京时间: ${f.bj}`);
    lines.push(`  ISO 8601: ${d.toISOString()}`);
    lines.push(`  相对时间: 距现在 ${((Date.now() - ms) / 1000 >= 0 ? Math.floor((Date.now() - ms) / 1000) + ' 秒前' : Math.floor((ms - Date.now()) / 1000) + ' 秒后')}`);
  }

  onProgress(0.95, '生成报告');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  return { blob, fileName: 'MendFile_时间戳转换结果', ext: 'txt' };
};

/* ============ 5.4 密码生成器 ============ */
export const passwordGenerate: ProcessFn = async ({ options }, onProgress) => {
  onProgress(0.1, '使用 window.crypto 生成安全随机序列');

  let len = Math.max(4, Math.min(128, Number(options.length) || 16));
  const count = Math.max(1, Math.min(1000, Number(options.count) || 1));
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const number = '23456789';
  const symbolOrig = String(options.customSymbols || '!@#$%^&*()-_=+[]{};:,.<>?');
  let symbols = symbolOrig;
  if (options.excludeAmbiguous) {
    symbols = symbols.replace(/[|oO0\\/`'"]/g, '');
  }

  let pool = '';
  const needEach = !!options.requireEachType;
  const pools: string[] = [];
  if (options.includeUpper) { pool += upper; pools.push(upper); }
  if (options.includeLower) { pool += lower; pools.push(lower); }
  if (options.includeNumber) { pool += number; pools.push(number); }
  if (options.includeSymbol && symbols) { pool += symbols; pools.push(symbols); }
  if (!pool) throw new Error('请至少勾选一种字符类型（大写/小写/数字/符号）');

  if (needEach && pools.length > len) len = pools.length;
  const pick = (src: string): string => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return src.charAt(arr[0] % src.length);
  };
  const pwds: string[] = [];
  for (let i = 0; i < count; i++) {
    onProgress(0.1 + (i / count) * 0.8, `生成 ${i + 1}/${count}`);
    let pwd = '';
    if (needEach) {
      for (const p of pools) pwd += pick(p);
    }
    while (pwd.length < len) pwd += pick(pool);
    // 随机打乱
    const arr = pwd.split('');
    const rnd = new Uint32Array(arr.length);
    crypto.getRandomValues(rnd);
    for (let k = arr.length - 1; k > 0; k--) {
      const j = rnd[k] % (k + 1);
      [arr[k], arr[j]] = [arr[j], arr[k]];
    }
    pwds.push(arr.join(''));
  }
  onProgress(0.92, '写入报告');
  const lines = [
    `MendFile 密码生成报告（crypto 级随机）`,
    `生成时间: ${new Date().toLocaleString('zh-CN')}`,
    `长度: ${len}  数量: ${count}  字符池大小: ${pool.length}`,
    `包含: ${[options.includeUpper && '大写', options.includeLower && '小写', options.includeNumber && '数字', options.includeSymbol && '符号'].filter(Boolean).join('/')}`,
    `排除易混字符: ${options.excludeAmbiguous ? '是' : '否'}   每类至少一个: ${needEach ? '是' : '否'}`,
    '------------------------------------------------------',
    ...pwds.map((p, i) => `${String(i + 1).padStart(4, ' ')}   ${p}`),
    '',
    '※ 请妥善保管生成的密码，切勿粘贴到公共场合。',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const stats = { 生成: `${count} 条`, 长度: `${len} 位`, 字符池: pool.length.toString() };
  // 预览
  const previewPwds = pwds.slice(0, 10).map((p, i) => `#${i + 1} ${p}`).join('； ');
  return { blob, fileName: 'MendFile_生成密码', ext: 'txt', preview: { stats: { ...stats, 前10条: previewPwds } } };
};

/* ============ 5.5 单位换算器 ============ */
export const unitConvert: ProcessFn = async ({ options }, onProgress) => {
  onProgress(0.1, '加载换算规则');

  // 换算表：单位key -> [label, toBaseFactor]（温度特殊处理）
  const TABLES: Record<string, Record<string, { label: string; to: (v: number) => number; from: (v: number) => number }>> = {
    length: {
      m: { label: '米 (m)', to: v => v, from: v => v },
      km: { label: '千米/公里 (km)', to: v => v * 1000, from: v => v / 1000 },
      cm: { label: '厘米 (cm)', to: v => v * 0.01, from: v => v / 0.01 },
      mm: { label: '毫米 (mm)', to: v => v * 0.001, from: v => v / 0.001 },
      inch: { label: '英寸 (in)', to: v => v * 0.0254, from: v => v / 0.0254 },
      ft: { label: '英尺 (ft)', to: v => v * 0.3048, from: v => v / 0.3048 },
      yd: { label: '码 (yd)', to: v => v * 0.9144, from: v => v / 0.9144 },
      mi: { label: '英里 (mi)', to: v => v * 1609.344, from: v => v / 1609.344 },
      li: { label: '里（中国市制）', to: v => v * 500, from: v => v / 500 },
      zhang: { label: '丈', to: v => v * (10 / 3), from: v => v / (10 / 3) },
      chi: { label: '尺', to: v => v * (1 / 3), from: v => v / (1 / 3) },
    },
    weight: {
      kg: { label: '千克/公斤 (kg)', to: v => v, from: v => v },
      g: { label: '克 (g)', to: v => v * 0.001, from: v => v / 0.001 },
      mg: { label: '毫克 (mg)', to: v => v * 1e-6, from: v => v / 1e-6 },
      t: { label: '吨 (t)', to: v => v * 1000, from: v => v / 1000 },
      lb: { label: '磅 (lb)', to: v => v * 0.45359237, from: v => v / 0.45359237 },
      oz: { label: '盎司 (oz)', to: v => v * 0.028349523125, from: v => v / 0.028349523125 },
      jin: { label: '斤（市斤）', to: v => v * 0.5, from: v => v / 0.5 },
      liang: { label: '两', to: v => v * 0.05, from: v => v / 0.05 },
      ct: { label: '克拉 (ct)', to: v => v * 0.0002, from: v => v / 0.0002 },
    },
    volume: {
      L: { label: '升 (L)', to: v => v, from: v => v },
      mL: { label: '毫升 (mL)', to: v => v * 0.001, from: v => v / 0.001 },
      m3: { label: '立方米 (m³)', to: v => v * 1000, from: v => v / 1000 },
      gal_us: { label: '美制加仑 (gal US)', to: v => v * 3.785411784, from: v => v / 3.785411784 },
      gal_uk: { label: '英制加仑 (gal UK)', to: v => v * 4.54609, from: v => v / 4.54609 },
      pt_us: { label: '美制品脱 (pt)', to: v => v * 0.473176473, from: v => v / 0.473176473 },
      cup: { label: '杯 (cup, 240mL)', to: v => v * 0.24, from: v => v / 0.24 },
      tbsp: { label: '汤匙 (Tbsp, 15mL)', to: v => v * 0.015, from: v => v / 0.015 },
    },
    temp: {
      C: { label: '摄氏度 (℃)', to: v => v, from: v => v },
      F: { label: '华氏度 (℉)', to: v => ((v - 32) * 5) / 9, from: v => (v * 9) / 5 + 32 },
      K: { label: '开尔文 (K)', to: v => v - 273.15, from: v => v + 273.15 },
    },
    area: {
      m2: { label: '平方米 (㎡)', to: v => v, from: v => v },
      km2: { label: '平方千米 (km²)', to: v => v * 1e6, from: v => v / 1e6 },
      ha: { label: '公顷 (ha)', to: v => v * 10000, from: v => v / 10000 },
      mu: { label: '亩（市亩）', to: v => v * (10000 / 15), from: v => v / (10000 / 15) },
      ft2: { label: '平方英尺 (sq ft)', to: v => v * 0.09290304, from: v => v / 0.09290304 },
      in2: { label: '平方英寸 (sq in)', to: v => v * 0.00064516, from: v => v / 0.00064516 },
      acre: { label: '英亩 (acre)', to: v => v * 4046.8564224, from: v => v / 4046.8564224 },
    },
    time: {
      s: { label: '秒 (s)', to: v => v, from: v => v },
      ms: { label: '毫秒 (ms)', to: v => v * 0.001, from: v => v / 0.001 },
      min: { label: '分钟 (min)', to: v => v * 60, from: v => v / 60 },
      h: { label: '小时 (h)', to: v => v * 3600, from: v => v / 3600 },
      d: { label: '天 (day)', to: v => v * 86400, from: v => v / 86400 },
      wk: { label: '周 (week)', to: v => v * 604800, from: v => v / 604800 },
      mo: { label: '月（30天）', to: v => v * 2592000, from: v => v / 2592000 },
      yr: { label: '年（365天）', to: v => v * 31536000, from: v => v / 31536000 },
    },
    storage: {
      B: { label: '字节 (B)', to: v => v, from: v => v },
      KB: { label: '千字节 (KB)', to: v => v * 1024, from: v => v / 1024 },
      MB: { label: '兆字节 (MB)', to: v => v * 1024 * 1024, from: v => v / (1024 * 1024) },
      GB: { label: '吉字节 (GB)', to: v => v * 1024 ** 3, from: v => v / (1024 ** 3) },
      TB: { label: '太字节 (TB)', to: v => v * 1024 ** 4, from: v => v / (1024 ** 4) },
      PB: { label: '拍字节 (PB)', to: v => v * 1024 ** 5, from: v => v / (1024 ** 5) },
      Kb: { label: '千比特 (Kbit)', to: v => v * 128, from: v => v / 128 },
      Mb: { label: '兆比特 (Mbit)', to: v => v * 128 * 1024, from: v => v / (128 * 1024) },
    },
    energy: {
      J: { label: '焦耳 (J)', to: v => v, from: v => v },
      kJ: { label: '千焦 (kJ)', to: v => v * 1000, from: v => v / 1000 },
      cal: { label: '卡路里 (cal)', to: v => v * 4.184, from: v => v / 4.184 },
      kcal: { label: '大卡/千卡 (kcal)', to: v => v * 4184, from: v => v / 4184 },
      Wh: { label: '瓦时 (Wh)', to: v => v * 3600, from: v => v / 3600 },
      kWh: { label: '千瓦时/度 (kWh)', to: v => v * 3_600_000, from: v => v / 3_600_000 },
      BTU: { label: '英热单位 (BTU)', to: v => v * 1055.05585262, from: v => v / 1055.05585262 },
    },
  };
  const CAT_LABELS: Record<string, string> = {
    length: '长度', weight: '重量/质量', volume: '体积/容量', temp: '温度',
    area: '面积', time: '时间', storage: '数据存储', energy: '能量/热量',
  };

  const cat: string = options.category || 'length';
  const tbl = TABLES[cat];
  if (!tbl) throw new Error('未知类别');

  const fromUnit: string = options.fromUnit || Object.keys(tbl)[0];
  const toUnit: string = options.toUnit || Object.keys(tbl)[1] || Object.keys(tbl)[0];
  const prec = Math.max(0, Math.min(12, Number(options.precision) || 4));
  const fromDef = tbl[fromUnit] || tbl[Object.keys(tbl)[0]];
  const toDef = tbl[toUnit] || tbl[Object.keys(tbl)[Object.keys(tbl).length - 1]];
  const conv = (v: number) => toDef.from(fromDef.to(v));

  const lines: string[] = [
    '======================================================',
    ' MendFile 单位换算结果',
    ` 类别：${CAT_LABELS[cat] || cat}   精度：${prec} 位小数`,
    ` 生成时间：${new Date().toLocaleString('zh-CN')}`,
    '======================================================',
  ];

  const batch = options.batchMode && String(options.batchInput || '').trim();
  if (batch) {
    const rows = batch.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    lines.push(`【批量模式】${rows.length} 条  ${fromDef.label} → ${toDef.label}`);
    lines.push('------------------------------------------------------');
    for (const line of rows) {
      const v = parseFloat(line);
      if (isNaN(v)) { lines.push(`✗ ${line} 非数字`); continue; }
      const r = conv(v);
      lines.push(`  ${v} ${fromUnit}  =  ${Number(r.toFixed(prec))} ${toUnit}`);
    }
  } else {
    const v = parseFloat(String(options.value || '0'));
    if (isNaN(v)) throw new Error('请输入数值');
    const r = conv(v);
    lines.push(`【单次换算】${v} ${fromDef.label}  →  ${toDef.label}`);
    lines.push('');
    lines.push(`  结果：${Number(r.toFixed(prec))} ${toUnit}`);
    lines.push('');
    // 输出同类所有单位对照
    lines.push('【同类单位一键对照】');
    const baseVal = fromDef.to(v);
    for (const k of Object.keys(tbl)) {
      const def = tbl[k];
      const val = def.from(baseVal);
      lines.push(`  ${Number(val.toFixed(prec))} ${def.label}`);
    }
  }
  onProgress(0.95, '生成报告');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  return { blob, fileName: 'MendFile_单位换算结果', ext: 'txt' };
};
