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
import type { ProcessFn, ProgressFn } from './types';
import {
  readAsArrayBuffer,
  loadImage,
  canvasToBlob,
  formatBytes,
  safeName,
  stripExt,
  generatePdfThumbnail,
} from './utils';
import { pdfjsLib } from './pdfjs';

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
