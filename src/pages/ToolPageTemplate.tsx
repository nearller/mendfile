import { Helmet } from 'react-helmet-async';
import type { ToolConfig } from '@/config/tools';
import { CATEGORY_META } from '@/config/tools';
import { useEffect, useRef, useState } from 'react';
import { formatBytes, generatePdfThumbnail, readAsArrayBuffer, readAsDataURL, downloadBlob, stripExt, safeName } from '@/core/utils';
import { pdfjsLib } from '@/core/pdfjs';
import AdSlot from '@/components/AdSlot';
import type { ProcessOutput } from '@/core/types';

export default function ToolPageTemplate({
  toolKey,
  config,
}: {
  toolKey: string;
  config: ToolConfig;
}) {
  const catMeta = CATEGORY_META[config.category];
  return (
    <>
      <Helmet prioritizeSeoTags>
        <title>{config.title}</title>
        <meta name="description" content={config.description} />
        <meta name="keywords" content={config.keywords.filter(Boolean).join(',')} />
        <meta property="og:title" content={config.title} />
        <meta property="og:description" content={config.description} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`https://mendfile.com${config.path}`} />
      </Helmet>

      <div className="space-y-6">
        {/* 功能标题 + 面包屑 */}
        <ToolHeader toolKey={toolKey} config={config} />

        {/* 主要工作区：上传 + 选项 + 进度 + 下载 */}
        <div className="card p-4 sm:p-6 lg:p-8 space-y-6">
          <ToolWorker toolKey={toolKey} config={config} />
        </div>

        {/* 预览 / 文本输出区 */}
        <AdSlot position="in-article" className="min-h-[90px]" />

        {/* 功能说明 */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="card p-5">
            <h3 className="font-semibold text-slate-800 mb-3 inline-flex items-center gap-2">
              <span className={`w-6 h-6 rounded-md text-white text-xs grid place-items-center bg-gradient-to-r ${catMeta.color}`}>✦</span>
              功能亮点
            </h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {config.features.map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-500">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
          {(() => {
            const isRed = config.boundaryCardStyle === 'red';
            return (
              <div className={`card p-5 ${isRed ? 'border-red-200/90 bg-red-50/40' : 'border-amber-200/70 bg-amber-50/30'}`}>
                <h3 className={`font-semibold mb-3 inline-flex items-center gap-2 ${isRed ? 'text-red-800' : 'text-amber-800'}`}>
                  <span className={`w-6 h-6 rounded-md text-white text-xs grid place-items-center ${isRed ? 'bg-red-500' : 'bg-amber-500'}`}>
                    {isRed ? '⚠️' : '!'}
                  </span>
                  {isRed ? '⚠️ 合规提示 · 功能边界与免责声明' : '功能边界与免责提示'}
                </h3>
                <ul className={`space-y-2 text-sm ${isRed ? 'text-red-900/80' : 'text-amber-900/80'}`}>
                  {config.boundaries.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span>▸</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </section>

        {/* SEO 长文本段落：为收录提供足量关键词内容 */}
        <section className="card p-5 sm:p-8 text-slate-600 text-sm leading-7 space-y-3">
          <h2 className="text-xl font-semibold text-slate-800">{config.name}在线工具介绍 - MendFile 全能办公工具</h2>
          <p>
            <strong>MendFile 全能办公工具</strong>
            提供的 {config.name} 功能是面向办公人群的免费在线服务，纯前端本地处理，
            文件不会上传到任何服务器，在您的浏览器里即可完成 {config.shortDesc}。
            官方主域名：<a href="https://mendfile.com" target="_blank" rel="noreferrer noopener">mendfile.com</a>、
            <a href="https://mendfile.cn" target="_blank" rel="noreferrer noopener"> mendfile.cn</a>。
          </p>
          <p>
            您无需注册登录、无需付费、无使用次数限制，直接拖放文件到上传区或点击选择文件即可开始使用。
            本页面向「{config.keywords[0]}、{config.keywords.slice(1, 3).join('、')}
            」等高频长尾关键词进行优化，{config.features[0]}。
          </p>
          <p>
            使用步骤：① 上传需要处理的文件（
            {config.multiple ? `支持批量多文件同时上传，单文件最大建议不超过 500MB` : `支持单文件上传，最大建议不超过 500MB`}
            ）；② 根据具体工具配置参数（如页面范围、图片格式、水印样式等）；
            ③ 点击「开始处理」按钮，观察实时进度条；④ 处理完成后点击一键下载即可获得结果文件。
          </p>
          <p>
            注意：{config.boundaries[0]}。如果您处理的文件包含敏感商业信息或个人隐私数据，完全无需担心，MendFile 全程本地处理，您的文件内容绝不会离开您自己的设备。
          </p>
        </section>
      </div>
    </>
  );
}

function ToolHeader({ config }: { toolKey: string; config: ToolConfig }) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
        <a href="/" className="hover:text-brand-600">首页</a>
        <span>›</span>
        <span>{CATEGORY_META[config.category].name}</span>
        <span>›</span>
        <span className="text-slate-700">{config.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className={`h-14 w-14 rounded-2xl grid place-items-center text-2xl text-white bg-gradient-to-br ${CATEGORY_META[config.category].color} shadow-card`}>
          {config.icon}
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">{config.name}</h1>
          <p className="text-slate-500 mt-1 text-sm sm:text-base">{config.shortDesc}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {config.keywords.slice(0, 6).map((k) => (
          <span key={k} className="chip">#{k}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * 每个工具的执行主区：
 * 1) 上传区（拖拽 + 点击 + 多文件管理）
 * 2) 参数区（按工具 key 显示不同表单）
 * 3) 进度条 + 操作按钮
 * 4) 下载结果 + 预览
 */
function ToolWorker({ toolKey, config }: { toolKey: string; config: ToolConfig }) {
  const [files, setFiles] = useState<File[]>([]);
  const [order, setOrder] = useState<number[]>([]); // 文件顺序（支持多文件排序的工具使用）
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [pageInfo, setPageInfo] = useState<Record<number, number>>({}); // 文件索引 -> 页数
  const [errors, setErrors] = useState<string[]>([]);
  const [options, setOptions] = useState<any>(() => structuredCloneSafe(config.defaultOptions));
  const [extras, setExtras] = useState<any>({});
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('准备就绪');
  const [output, setOutput] = useState<ProcessOutput | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 重置 options 到默认值的简单策略：仅首次使用 defaultOptions 直接 set
  useEffect(() => {
    // 初始化 extras.order（用于合并/图片转pdf的排序）
    if (config.multiple) {
      setExtras((prev: any) => ({ ...prev, order: files.map((_, i) => i) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length]);

  const onFilesChosen = (fl: FileList | File[]) => {
    const arr = Array.from(fl).filter((f) => f && f.size > 0);
    if (!config.multiple && arr.length) {
      arr.splice(1);
    }
    if (!arr.length) return;
    setErrors([]);
    setOutput(null);
    const newList = config.multiple ? [...files, ...arr] : arr;
    setFiles(newList);
    // 为每个 PDF 生成缩略图 + 页数
    newList.forEach(async (file, idx) => {
      if (/\.(pdf)$/i.test(file.name) || file.type === 'application/pdf') {
        try {
          const buf = await readAsArrayBuffer(file);
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          setPageInfo((p) => ({ ...p, [idx]: pdf.numPages }));
          if (config.showPreview && idx < 6) {
            const t = await generatePdfThumbnail(pdf, 0, 200);
            setThumbs((p0) => ({ ...p0, [idx]: t }));
          }
        } catch (e) {
          setErrors((p) => [...p, `文件 ${file.name} 读取失败：${(e as Error).message}`]);
        }
      } else if (file.type.startsWith('image/')) {
        if (config.showPreview && idx < 12) {
          try {
            const u = await readAsDataURL(file);
            setThumbs((p0) => ({ ...p0, [idx]: u }));
          } catch {
            /* ignore */
          }
        }
      }
    });
  };

  const clearFiles = () => {
    setFiles([]);
    setOrder([]);
    setThumbs({});
    setPageInfo({});
    setOutput(null);
    setProgress(0);
    setProgressMsg('准备就绪');
    setErrors([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const start = async () => {
    const needFile = config.fileRequired !== false;
    if (needFile && !files.length) {
      setErrors(['请先选择至少一个文件']);
      return;
    }
    setErrors([]);
    setRunning(true);
    setProgress(0.01);
    setProgressMsg('开始处理…');
    setOutput(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const mergedExtras = { ...extras };
      if (config.multiple && (toolKey === 'pdf-merge' || toolKey === 'image-to-pdf')) {
        // 确保 order 有值
        if (!mergedExtras.order || mergedExtras.order.length !== files.length) {
          mergedExtras.order = files.map((_, i) => i);
        }
      }
      const result = await config.processor(
        { files, options, extras: mergedExtras } as any,
        (r, msg) => {
          setProgress(Math.max(0, Math.min(1, r)));
          if (msg) setProgressMsg(msg);
        },
        ctrl.signal
      );
      setOutput(result);
      setProgress(1);
      setProgressMsg('处理完成');
    } catch (e: any) {
      setErrors([e?.message || '处理失败，请重试或更换文件']);
      setProgress(0);
      setProgressMsg('处理失败');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setRunning(false);
    setProgressMsg('已取消');
  };

  const downloadAll = () => {
    if (!output) return;
    const filename = `${safeName(output.fileName) || 'MendFile'}.${output.ext}`;
    downloadBlob(output.blob, filename);
  };

  // 进度条百分比
  const pct = Math.min(100, Math.round(progress * 100));
  const needFile = config.fileRequired !== false;
  const startBtnLabel = needFile
    ? (running ? '处理中…' : `⚙️ 开始处理（输出 .${config.outputExt}）`)
    : (running ? '计算中…' : `✨ 开始生成 / 计算（输出 .${config.outputExt}）`);

  return (
    <div className="space-y-6">
      {/* 上传区（fileRequired=false 时隐藏，如工时计算、密码生成、单位换算等） */}
      {needFile && (
        <DropZone
          accept={config.accept}
          multiple={config.multiple}
          disabled={running}
          onFiles={onFilesChosen}
          inputRef={inputRef}
        />
      )}

      {/* 文件列表 */}
      {needFile && !!files.length && (
        <FileList
          config={config}
          files={files}
          thumbs={thumbs}
          pageInfo={pageInfo}
          order={config.multiple ? (extras.order as number[]) || files.map((_, i) => i) : undefined}
          onRemove={(idx) => {
            setFiles((prev) => prev.filter((_, i) => i !== idx));
            setThumbs((prev) => {
              const np: typeof prev = {};
              Object.keys(prev).forEach((k) => {
                const ki = Number(k);
                if (ki < idx) np[ki] = prev[ki];
                else if (ki > idx) np[ki - 1] = prev[ki];
              });
              return np;
            });
          }}
          onReorder={(newOrder) => setExtras((e: any) => ({ ...e, order: newOrder }))}
          onFileMoveUp={(idx) => {
            if (idx <= 0 || !config.multiple) return;
            setFiles((prev) => {
              const arr = [...prev];
              [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
              return arr;
            });
          }}
          onFileMoveDown={(idx) => {
            if (idx >= files.length - 1 || !config.multiple) return;
            setFiles((prev) => {
              const arr = [...prev];
              [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
              return arr;
            });
          }}
        />
      )}

      {/* 参数区：按工具 key 差异化 */}
      <OptionsPanel
        toolKey={toolKey}
        config={config}
        options={options}
        setOptions={setOptions}
        extras={extras}
        setExtras={setExtras}
        disabled={running}
        totalPages={pageInfo[0] || 0}
      />

      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-slate-500">
          <div>
            {running ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
                {progressMsg}
              </span>
            ) : (
              <span>
                {output ? '✅ 处理完成' : errors.length ? '⚠️ 处理异常' : (needFile ? `准备就绪，共 ${files.length} 个文件` : '准备就绪，配置参数后点击开始')}
              </span>
            )}
          </div>
          <div>{pct}%</div>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* 错误 */}
      {!!errors.length && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
          {errors.map((e, i) => (
            <div key={i}>• {e}</div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={running || (needFile && !files.length)}
            onClick={start}
          >
            {startBtnLabel}
          </button>
          {running ? (
            <button className="btn-secondary" onClick={cancel}>取消</button>
          ) : (
            needFile && (
              <button className="btn-secondary" onClick={clearFiles} disabled={!files.length}>
                清空文件
              </button>
            )
          )}
        </div>
        <div className="flex gap-2 items-center">
          {needFile && (
            <div className="text-xs text-slate-500 hidden sm:inline">
              总大小：{formatBytes(files.reduce((s, f) => s + f.size, 0))}
            </div>
          )}
          <button
            className="btn-primary !bg-emerald-600 hover:!bg-emerald-700"
            disabled={!output}
            onClick={downloadAll}
          >
            ⬇️ 一键下载结果
          </button>
        </div>
      </div>

      {/* 结果 + 预览 */}
      {output && (
        <ResultCard output={output} config={config} onDownload={downloadAll} />
      )}
    </div>
  );
}

function DropZone({
  accept, multiple, disabled, onFiles, inputRef,
}: {
  accept: string; multiple: boolean; disabled: boolean;
  onFiles: (f: FileList | File[]) => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`block border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition cursor-pointer ${over ? 'dropzone-active' : 'border-slate-200 hover:border-brand-400 hover:bg-slate-50/50'}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="mx-auto h-14 w-14 rounded-full bg-brand-50 text-brand-600 grid place-items-center text-2xl">
        ☁️
      </div>
      <div className="mt-4 font-semibold text-slate-800">
        {multiple ? '拖拽文件到此处，或点击选择多个文件' : '拖拽文件到此处，或点击选择文件'}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        支持格式：<code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{accept || '全部'}</code>
        {' · '}全程本地处理，文件不上传服务器
      </div>
    </label>
  );
}

function FileList(props: {
  config: ToolConfig;
  files: File[];
  thumbs: Record<number, string>;
  pageInfo: Record<number, number>;
  order?: number[];
  onRemove: (idx: number) => void;
  onReorder: (order: number[]) => void;
  onFileMoveUp: (idx: number) => void;
  onFileMoveDown: (idx: number) => void;
}) {
  const { files, thumbs, pageInfo, config } = props;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="border border-slate-100 rounded-xl p-3 flex gap-3 items-start bg-slate-50/50">
          <div className="h-16 w-14 shrink-0 rounded-md bg-white border border-slate-100 overflow-hidden grid place-items-center text-slate-400">
            {thumbs[i] ? (
              <img src={thumbs[i]} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl">{fileIcon(f)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-slate-800 font-medium" title={f.name}>{f.name}</div>
            <div className="text-xs text-slate-500 mt-0.5">
              {formatBytes(f.size)}
              {pageInfo[i] != null && ` · ${pageInfo[i]} 页`}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {config.multiple && (
                <>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
                    onClick={() => props.onFileMoveUp(i)}
                  >
                    ↑ 上移
                  </button>
                  <button
                    type="button"
                    className="text-[11px] px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-600"
                    onClick={() => props.onFileMoveDown(i)}
                  >
                    ↓ 下移
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-[11px] px-2 py-0.5 rounded border border-red-200 bg-white text-red-600 hover:bg-red-50"
                onClick={() => props.onRemove(i)}
              >
                ✕ 移除
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function fileIcon(f: File) {
  const n = f.name.toLowerCase();
  if (n.endsWith('.pdf')) return '📕';
  if (/\.(png|jpe?g|webp|bmp|gif)$/.test(n)) return '🖼️';
  if (/\.(docx?|pptx?|xlsx?|txt|md)$/.test(n)) return '📄';
  return '📎';
}

/**
 * 工具差异化参数面板，按 toolKey 渲染。
 * 每个选项的修改都直接写入 options / extras，供处理器使用。
 */
function OptionsPanel(props: {
  toolKey: string;
  config: ToolConfig;
  options: any;
  setOptions: (fn: any) => void;
  extras: any;
  setExtras: (fn: any) => void;
  disabled: boolean;
  totalPages: number;
}) {
  const { toolKey, options, setOptions, extras, setExtras, disabled } = props;
  const update = (patch: any) => setOptions((prev: any) => ({ ...prev, ...patch }));
  const updateExtras = (patch: any) => setExtras((prev: any) => ({ ...prev, ...patch }));

  // 所有 pdf 相关带页码范围/选择的工具通用信息
  const pageTip = props.totalPages ? `当前文件共 ${props.totalPages} 页` : '';

  const common = (
    <div className="text-xs text-slate-400">以上为基础参数，点击「开始处理」即可应用</div>
  );

  const panels: Record<string, JSX.Element> = {
    'pdf-to-word': (
      <div className="text-sm text-slate-600">
        <div>扫描版 PDF 无法转为可编辑文字，请知悉。本工具对 <strong>文本型 PDF</strong> 效果最佳。</div>
      </div>
    ),
    'pdf-to-image': (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="输出格式">
          <select className="input" disabled={disabled} value={options.format}
            onChange={(e) => update({ format: e.target.value })}>
            <option value="png">PNG（无损高清，推荐）</option>
            <option value="jpg">JPG（体积更小）</option>
          </select>
        </Field>
        <Field label="渲染分辨率">
          <select className="input" disabled={disabled} value={options.dpi}
            onChange={(e) => update({ dpi: Number(e.target.value) })}>
            <option value={72}>72 DPI（极速）</option>
            <option value={150}>150 DPI（标准）</option>
            <option value={220}>220 DPI（高清）</option>
            <option value={300}>300 DPI（印刷级，较慢）</option>
          </select>
        </Field>
      </div>
    ),
    'image-to-pdf': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="页面尺寸">
          <select className="input" disabled={disabled} value={options.pageSize}
            onChange={(e) => update({ pageSize: e.target.value })}>
            <option value="a4">A4</option>
            <option value="letter">Letter</option>
            <option value="original">原图尺寸</option>
            <option value="custom">自定义宽高</option>
          </select>
        </Field>
        <Field label="内边距 (pt)">
          <input type="number" className="input" min={0} max={200} disabled={disabled}
            value={options.margin} onChange={(e) => update({ margin: Number(e.target.value) })} />
        </Field>
        <Field label="图片适配方式">
          <select className="input" disabled={disabled} value={options.fit}
            onChange={(e) => update({ fit: e.target.value })}>
            <option value="contain">等比包含（推荐）</option>
            <option value="cover">等比填充裁剪</option>
            <option value="fill">拉伸铺满</option>
          </select>
        </Field>
        <Field label="图片顺序">
          <div className="text-xs text-slate-500 leading-5">
            在上方文件列表点击「↑ / ↓」或直接拖拽到上传区时按顺序选择。
          </div>
        </Field>
        {options.pageSize === 'custom' && (
          <>
            <Field label="自定义宽度 (pt)">
              <input type="number" className="input" value={options.customWidth || 595}
                onChange={(e) => update({ customWidth: Number(e.target.value) })} disabled={disabled} />
            </Field>
            <Field label="自定义高度 (pt)">
              <input type="number" className="input" value={options.customHeight || 842}
                onChange={(e) => update({ customHeight: Number(e.target.value) })} disabled={disabled} />
            </Field>
          </>
        )}
      </div>
    ),
    'pdf-to-txt': (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="换行符">
          <select className="input" value={options.lineBreak} disabled={disabled}
            onChange={(e) => update({ lineBreak: e.target.value })}>
            <option value="crlf">CRLF（Windows 常用）</option>
            <option value="lf">LF（Mac/Linux）</option>
          </select>
        </Field>
      </div>
    ),
    'pdf-split': (
      <div className="space-y-3">
        <Field label="拆分方式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'ranges', label: '按页码范围（例：1-3,5,8-10）' },
              { k: 'every', label: '均等拆分（每 N 页一份）' },
              { k: 'pages', label: '提取指定页（例：2,4,6）' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`split-${toolKey}`} value={r.k}
                  checked={options.mode === r.k} disabled={disabled}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {options.mode === 'ranges' && (
          <Field label="页码范围" hint={`${pageTip}，多个范围使用英文逗号分隔，留空则默认按每页一份拆分`}>
            <input type="text" className="input" placeholder="如 1-3,5,8-10" value={options.ranges || ''} disabled={disabled}
              onChange={(e) => update({ ranges: e.target.value })} />
          </Field>
        )}
        {options.mode === 'every' && (
          <Field label="每 N 页一份" hint={pageTip}>
            <input type="number" min={1} className="input max-w-xs" value={options.every || 2} disabled={disabled}
              onChange={(e) => update({ every: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        )}
        {options.mode === 'pages' && (
          <Field label="指定要提取的页码" hint={`${pageTip}，多个页码使用英文逗号分隔`}>
            <input type="text" className="input" placeholder="如 2,4,6,9" value={options.pages || ''} disabled={disabled}
              onChange={(e) => update({ pages: e.target.value })} />
          </Field>
        )}
      </div>
    ),
    'pdf-pages': (
      <div className="space-y-4">
        <PageEditorPanel
          totalPages={props.totalPages}
          disabled={disabled}
          rotations={extras.rotations || {}}
          remove={extras.remove || []}
          crop={extras.crop || { top: 0, bottom: 0, left: 0, right: 0 }}
          onChange={(patch) => updateExtras(patch)}
        />
      </div>
    ),
    'pdf-remove-watermark': (
      <div>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="rounded" disabled={disabled}
            checked={options.aggressive !== false}
            onChange={(e) => update({ aggressive: e.target.checked })} />
          启用激进模式（额外扫描低透明度整段水印，推荐开启）
        </label>
      </div>
    ),
    'pdf-add-watermark': (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="水印类型">
          <select className="input" value={options.mode} disabled={disabled}
            onChange={(e) => update({ mode: e.target.value })}>
            <option value="text">文字水印</option>
            <option value="image">图片水印</option>
          </select>
        </Field>
        <Field label="布局方式">
          <select className="input" value={options.layout} disabled={disabled}
            onChange={(e) => update({ layout: e.target.value })}>
            <option value="tile">平铺水印（密集防盗）</option>
            <option value="center">页面中央（单个）</option>
            <option value="corners">四角 + 居中</option>
          </select>
        </Field>
        <Field label="透明度">
          <input type="range" min={0.05} max={1} step={0.05} value={options.opacity} disabled={disabled}
            onChange={(e) => update({ opacity: Number(e.target.value) })} />
          <div className="text-xs text-slate-500 mt-1">{Math.round(Number(options.opacity) * 100)}%</div>
        </Field>
        <Field label="旋转角度">
          <input type="number" className="input" value={options.rotation} disabled={disabled}
            onChange={(e) => update({ rotation: Number(e.target.value) })} />
        </Field>
        {options.mode === 'text' && (
          <>
            <Field label="文字内容">
              <input type="text" className="input" value={options.text} disabled={disabled}
                onChange={(e) => update({ text: e.target.value })} />
            </Field>
            <Field label="字号">
              <input type="number" className="input" min={8} max={160} value={options.fontSize} disabled={disabled}
                onChange={(e) => update({ fontSize: Number(e.target.value) })} />
            </Field>
            <Field label="文字颜色">
              <input type="color" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-1" value={options.color} disabled={disabled}
                onChange={(e) => update({ color: e.target.value })} />
            </Field>
          </>
        )}
        {options.mode === 'image' && (
          <Field label="上传水印图片" colSpan={3}>
            <input type="file" accept="image/png,image/jpeg,image/webp" className="input" disabled={disabled}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const url = await readAsDataURL(f);
                update({ image: url });
                if (!options.imageWidth) {
                  try {
                    const img = await new Promise<HTMLImageElement>((res, rej) => {
                      const el = new Image();
                      el.onload = () => res(el); el.onerror = rej; el.src = url;
                    });
                    update({ imageWidth: Math.min(400, img.width) });
                  } catch { /* ignore */ }
                }
              }} />
            {options.image && (
              <div className="mt-2 flex items-center gap-3">
                <img src={options.image} alt="水印预览" className="h-12 rounded border border-slate-200 bg-white" />
                <Field label="图片宽度(pt)">
                  <input type="number" className="input max-w-[140px]" min={10} value={options.imageWidth || 180} disabled={disabled}
                    onChange={(e) => update({ imageWidth: Number(e.target.value) })} />
                </Field>
              </div>
            )}
          </Field>
        )}
      </div>
    ),
    'pdf-encrypt': (
      <div className="space-y-4">
        <Field label="操作模式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'encrypt', label: '🔒 设置密码加密 PDF' },
              { k: 'decrypt', label: '🔓 输入密码解除保护' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`enc-${toolKey}`} value={r.k} disabled={disabled}
                  checked={options.mode === r.k}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {options.mode === 'decrypt' ? (
          <Field label="当前 PDF 的打开密码">
            <input type="password" className="input" placeholder="请输入 PDF 的已知密码" autoComplete="off" disabled={disabled}
              value={options.inputPassword}
              onChange={(e) => update({ inputPassword: e.target.value })} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="打开密码（User）">
              <input type="password" className="input" placeholder="建议 8 位以上，留空则不设置" autoComplete="new-password" disabled={disabled}
                value={options.userPassword} onChange={(e) => update({ userPassword: e.target.value })} />
            </Field>
            <Field label="权限密码（Owner）">
              <input type="password" className="input" placeholder="留空则与打开密码一致" autoComplete="new-password" disabled={disabled}
                value={options.ownerPassword} onChange={(e) => update({ ownerPassword: e.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={options.permissions?.print !== false} disabled={disabled}
                  onChange={(e) => update({ permissions: { ...(options.permissions || {}), print: e.target.checked } })} />
                允许打印
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={options.permissions?.copy !== false} disabled={disabled}
                  onChange={(e) => update({ permissions: { ...(options.permissions || {}), copy: e.target.checked } })} />
                允许复制内容
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={options.permissions?.modify !== false} disabled={disabled}
                  onChange={(e) => update({ permissions: { ...(options.permissions || {}), modify: e.target.checked } })} />
                允许修改
              </label>
            </div>
          </div>
        )}
      </div>
    ),
    'pdf-compress': (
      <Field label="压缩模式">
        <div className="flex flex-wrap gap-3">
          {[
            { k: 'normal', label: '普通压缩（平衡清晰度/体积，推荐）' },
            { k: 'extreme', label: '极致压缩（体积最小，略损失画质）' },
          ].map((r) => (
            <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={`com-${toolKey}`} value={r.k} disabled={disabled}
                checked={options.level === r.k}
                onChange={() => update({ level: r.k })} />
              {r.label}
            </label>
          ))}
        </div>
      </Field>
    ),
    'pdf-page-number': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="页码位置">
          <select className="input" disabled={disabled} value={options.position}
            onChange={(e) => update({ position: e.target.value })}>
            <option value="bottom-center">页脚居中（常用）</option>
            <option value="bottom-left">页脚左</option>
            <option value="bottom-right">页脚右</option>
            <option value="bottom-inner">页脚内侧（对开）</option>
            <option value="bottom-outer">页脚外侧（对开）</option>
            <option value="top-center">页眉居中</option>
            <option value="top-left">页眉左</option>
            <option value="top-right">页眉右</option>
          </select>
        </Field>
        <Field label="页码样式">
          <select className="input" disabled={disabled} value={options.style}
            onChange={(e) => update({ style: e.target.value })}>
            <option value="1,2,3">阿拉伯数字 1, 2, 3</option>
            <option value="i,ii,iii">小写罗马 i, ii, iii</option>
            <option value="I,II,III">大写罗马 I, II, III</option>
            <option value="一二三">中文数字 一、二、三</option>
          </select>
        </Field>
        <Field label="起始页码">
          <input type="number" min={0} className="input" disabled={disabled} value={options.start}
            onChange={(e) => update({ start: Number(e.target.value) })} />
        </Field>
        <Field label="字号">
          <input type="number" min={6} max={72} className="input" disabled={disabled} value={options.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })} />
        </Field>
        <Field label="颜色">
          <input type="color" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-1" value={options.color} disabled={disabled}
            onChange={(e) => update({ color: e.target.value })} />
        </Field>
        <Field label="边距 (pt)">
          <input type="number" min={0} className="input" disabled={disabled} value={options.margin}
            onChange={(e) => update({ margin: Number(e.target.value) })} />
        </Field>
      </div>
    ),
    'pdf-metadata': (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="标题 Title">
          <input className="input" value={options.title || ''} disabled={disabled}
            onChange={(e) => update({ title: e.target.value })} />
        </Field>
        <Field label="作者 Author">
          <input className="input" value={options.author || ''} disabled={disabled}
            onChange={(e) => update({ author: e.target.value })} />
        </Field>
        <Field label="主题 Subject">
          <input className="input" value={options.subject || ''} disabled={disabled}
            onChange={(e) => update({ subject: e.target.value })} />
        </Field>
        <Field label="关键词 Keywords（逗号分隔）">
          <input className="input" value={options.keywords || ''} disabled={disabled}
            onChange={(e) => update({ keywords: e.target.value })} />
        </Field>
        <Field label="创建时间">
          <input type="datetime-local" className="input" disabled={disabled}
            value={options.createdAt || ''}
            onChange={(e) => update({ createdAt: e.target.value })} />
        </Field>
        <Field label="修改时间">
          <input type="datetime-local" className="input" disabled={disabled}
            value={options.modifiedAt || ''}
            onChange={(e) => update({ modifiedAt: e.target.value })} />
        </Field>
        <Field colSpan={2}>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" className="rounded" disabled={disabled}
              checked={!!options.clear}
              onChange={(e) => update({ clear: e.target.checked })} />
            <strong>一键清空敏感元数据</strong>（标题/作者/关键词置空，生成器更新为 MendFile）
          </label>
        </Field>
      </div>
    ),
    'pdf-merge': <div className="text-sm text-slate-500">提示：上传多个文件后，可在上方列表使用「↑ / ↓」调整合并顺序。</div>,

    /* =====================================
     *  二期 · 批次 1 · 图片工具参数面板
     * ===================================== */
    'image-compress': (
      <div className="space-y-3">
        <Field label="压缩档位">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {[
              { k: 'light', label: '轻度压缩（85%）', desc: '视觉无损，体积 ↓10~25%' },
              { k: 'normal', label: '⚑ 标准压缩（70%）', desc: '推荐，体积 ↓30~50%' },
              { k: 'extreme', label: '极致压缩（45%+缩放）', desc: '体积 ↓60~80%，最长边≤1920px' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-start gap-2 text-sm cursor-pointer p-2.5 rounded-lg border border-slate-200 hover:border-brand-400 bg-white w-full sm:w-auto sm:min-w-[220px]">
                <input type="radio" name={`compress-${toolKey}`} value={r.k}
                  checked={options.level === r.k} disabled={disabled}
                  onChange={() => update({ level: r.k })} />
                <div>
                  <div className="font-medium text-slate-800">{r.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </Field>
        <div className="text-xs text-slate-500 bg-slate-100/60 rounded-lg p-3 leading-5">
          💡 <strong>使用建议</strong>：日常办公文档插图 → 推荐「标准压缩」；发送邮件、网页上传等对体积极其敏感的场景 → 选择「极致压缩」；对画质要求高（摄影作品、海报）请选择「轻度压缩」。
        </div>
      </div>
    ),
    'image-convert': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="输出格式">
          <select className="input" disabled={disabled} value={options.format}
            onChange={(e) => update({ format: e.target.value })}>
            <option value="same">保持原格式（默认）</option>
            <option value="jpg">JPG（体积小，通用）</option>
            <option value="png">PNG（无损，支持透明）</option>
            <option value="webp">WebP（新一代，更小更高清）</option>
            <option value="bmp">BMP（位图无压缩）</option>
          </select>
        </Field>
        <Field label={`压缩质量 (${Number(options.quality ?? 85)}%)`} hint="仅在输出 JPG / WebP 时生效，PNG/BMP 无损格式会忽略此参数">
          <input type="range" min={10} max={100} step={1}
            value={options.quality ?? 85}
            disabled={disabled}
            onChange={(e) => update({ quality: Number(e.target.value) })} />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1">
            <span>10% 最小</span><span>100% 最佳画质</span>
          </div>
        </Field>
        <Field label="透明填充颜色" hint="当 PNG(透明) → JPG/BMP 时，透明区域将被此颜色填充（其他转换不受影响）">
          <div className="flex items-center gap-2">
            <input type="color" className="h-10 w-14 rounded-lg border border-slate-200 bg-white cursor-pointer"
              value={options.fillColor || '#ffffff'}
              disabled={disabled}
              onChange={(e) => update({ fillColor: e.target.value })} />
            <input type="text" className="input flex-1 font-mono text-xs"
              value={options.fillColor || '#ffffff'}
              disabled={disabled}
              onChange={(e) => update({ fillColor: e.target.value })} />
          </div>
        </Field>
      </div>
    ),
    'id-photo': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="尺寸模板">
            <select className="input" disabled={disabled} value={options.template}
              onChange={(e) => update({ template: e.target.value })}>
              <option value="1inch">一寸（295×413px · 25×35mm）</option>
              <option value="2inch">二寸（413×579px · 35×49mm）</option>
              <option value="small1inch">小一寸（260×378px）</option>
              <option value="small2inch">小二寸（413×531px）</option>
              <option value="big1inch">大一寸（390×567px）</option>
              <option value="passport">护照签证（390×567px）</option>
              <option value="custom">自定义宽高（下两栏填写）</option>
            </select>
          </Field>
          <Field label="自定义 宽度(px)" hint="仅在「自定义」模板生效">
            <input type="number" min={100} max={2400} className="input"
              value={options.customW ?? 295} disabled={disabled}
              onChange={(e) => update({ customW: Number(e.target.value) })} />
          </Field>
          <Field label="自定义 高度(px)" hint="仅在「自定义」模板生效">
            <input type="number" min={100} max={3600} className="input"
              value={options.customH ?? 413} disabled={disabled}
              onChange={(e) => update({ customH: Number(e.target.value) })} />
          </Field>
          <Field label="输出模式">
            <select className="input" disabled={disabled} value={options.output}
              onChange={(e) => update({ output: e.target.value })}>
              <option value="single">仅单张证件照</option>
              <option value="layout">仅 6 张 2×3 拼版</option>
              <option value="both">单张 + 拼版，打包 ZIP</option>
            </select>
          </Field>
        </div>
        <Field label="更换背景色（默认保留原图背景）">
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {[
              { k: 'keep', label: '保留原色', swatch: 'linear-gradient(45deg,#e5e7eb 25%,transparent 25%,transparent 75%,#e5e7eb 75%),linear-gradient(45deg,#e5e7eb 25%,#ffffff 25%,#ffffff 75%,#e5e7eb 75%)', swatchText: '原图' },
              { k: 'white', label: '白色', swatch: '#ffffff', swatchText: '白' },
              { k: 'blue', label: '蓝色 #438EDB', swatch: '#438EDB', swatchText: '蓝' },
              { k: 'red', label: '红色 #D9383E', swatch: '#D9383E', swatchText: '红' },
              { k: 'gradient', label: '渐变蓝（渐变背景）', swatch: 'linear-gradient(180deg,#438EDB,#8edef7)', swatchText: '渐' },
              { k: 'custom', label: '自定义颜色（右方选择）', swatch: '#ffffff', swatchText: '自' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer p-2 rounded-lg border border-slate-200 bg-white">
                <input type="radio" name={`bg-${toolKey}`} value={r.k}
                  checked={options.bgMode === r.k} disabled={disabled}
                  onChange={() => update({ bgMode: r.k })} />
                <span className="inline-block w-7 h-7 rounded border border-slate-300 grid place-items-center text-[10px] text-slate-700"
                  style={{ background: r.swatch }}>{r.swatchText}</span>
                <span>{r.label}</span>
              </label>
            ))}
            <div className="inline-flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white">
              <div className="text-xs text-slate-500 mr-1">自定义值：</div>
              <input type="color" className="h-9 w-10 rounded border border-slate-200 bg-white"
                value={options.customColor || '#ffffff'}
                disabled={disabled}
                onChange={(e) => update({ customColor: e.target.value, bgMode: 'custom' })} />
              <input type="text" className="input font-mono text-xs !py-1 !h-9 !w-[100px]"
                value={options.customColor || '#ffffff'}
                disabled={disabled}
                onChange={(e) => update({ customColor: e.target.value })} />
            </div>
          </div>
        </Field>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 leading-5">
          ⚠️ <strong>合规提示：</strong>本工具采用纯 Canvas 颜色阈值换底，<strong>不是 AI 人像分割</strong>。正式证件（身份证/护照/签证）请务必前往专业照相馆，本工具仅适合日常临时使用。
        </div>
      </div>
    ),
  };

  if (!panels[toolKey]) return null;

  return (
    <section className="border border-slate-100 rounded-xl p-4 sm:p-5 bg-slate-50/40 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800 text-sm sm:text-base">🛠️ 参数与选项</h3>
        {pageTip && <span className="text-xs text-slate-500">{pageTip}</span>}
      </div>
      {panels[toolKey]}
      <div className="pt-2 text-xs text-slate-400">{common}</div>
    </section>
  );
}

function Field(props: {
  label?: string;
  hint?: string;
  colSpan?: number;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = props.colSpan
    ? { gridColumn: `span ${props.colSpan} / span ${props.colSpan}` }
    : {};
  return (
    <label className="block" style={style}>
      {props.label && (
        <div className="text-xs text-slate-500 mb-1.5 font-medium">{props.label}</div>
      )}
      {props.children}
      {props.hint && <div className="mt-1 text-[11px] text-slate-400">{props.hint}</div>}
    </label>
  );
}

/**
 * 页面编辑面板：为 PDF Pages 工具提供每一页的旋转 / 删除配置 + 统一裁剪
 */
function PageEditorPanel(props: {
  totalPages: number;
  disabled: boolean;
  rotations: Record<string | number, number>;
  remove: number[];
  crop: { top: number; bottom: number; left: number; right: number };
  onChange: (patch: any) => void;
}) {
  const { totalPages, rotations, remove, crop, disabled, onChange } = props;
  const removeSet = new Set(remove);

  if (totalPages === 0) {
    return <div className="text-sm text-slate-500">请先上传一个 PDF 文件，加载完成后即可在此配置页面编辑选项。</div>;
  }

  const toggleRemove = (p: number) => {
    const set = new Set(removeSet);
    set.has(p) ? set.delete(p) : set.add(p);
    onChange({ remove: Array.from(set).sort((a, b) => a - b) });
  };
  const rotate = (p: number, add: number) => {
    const cur = Number(rotations[p] || 0);
    onChange({ rotations: { ...rotations, [p]: (cur + add) % 360 } });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-slate-500 mb-2">单页操作：点击 90°/180° 旋转，或勾选删除页</div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[340px] overflow-y-auto pr-1">
          {Array.from({ length: totalPages }, (_, i) => {
            const pageNo = i + 1;
            const rot = rotations[pageNo] || 0;
            const isRemove = removeSet.has(pageNo);
            return (
              <div
                key={i}
                className={`border rounded-lg p-2 text-center transition ${
                  isRemove ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold">P{pageNo}</span>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" className="rounded !h-3 !w-3"
                      checked={isRemove} disabled={disabled}
                      onChange={() => toggleRemove(pageNo)} />
                    <span>删</span>
                  </label>
                </div>
                <div className={`text-2xl my-1 transition-transform ${isRemove ? 'line-through opacity-60' : ''}`}
                  style={{ transform: `rotate(${rot}deg)`, display: 'inline-block' }}>📄</div>
                <div className="text-[11px] text-slate-500">旋 {rot}°</div>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  <button type="button" className="text-[10px] px-0.5 py-1 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
                    disabled={disabled} onClick={() => rotate(pageNo, -90)}>↺</button>
                  <button type="button" className="text-[10px] px-0.5 py-1 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
                    disabled={disabled} onClick={() => rotate(pageNo, 180)}>⇅</button>
                  <button type="button" className="text-[10px] px-0.5 py-1 rounded bg-slate-100 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-50"
                    disabled={disabled} onClick={() => rotate(pageNo, 90)}>↻</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
        <Field label="上边距裁剪 (pt)">
          <input type="number" className="input" min={0} disabled={disabled} value={crop.top}
            onChange={(e) => onChange({ crop: { ...crop, top: Number(e.target.value) } })} />
        </Field>
        <Field label="下边距裁剪 (pt)">
          <input type="number" className="input" min={0} disabled={disabled} value={crop.bottom}
            onChange={(e) => onChange({ crop: { ...crop, bottom: Number(e.target.value) } })} />
        </Field>
        <Field label="左边距裁剪 (pt)">
          <input type="number" className="input" min={0} disabled={disabled} value={crop.left}
            onChange={(e) => onChange({ crop: { ...crop, left: Number(e.target.value) } })} />
        </Field>
        <Field label="右边距裁剪 (pt)">
          <input type="number" className="input" min={0} disabled={disabled} value={crop.right}
            onChange={(e) => onChange({ crop: { ...crop, right: Number(e.target.value) } })} />
        </Field>
      </div>
    </div>
  );
}

/**
 * 结果卡片：显示 blob 大小 / 输出文件名 / 预览 / 文本复制 / 缩略图 / stats
 */
function ResultCard({ output, config, onDownload }: {
  output: ProcessOutput;
  config: ToolConfig;
  onDownload: () => void;
}) {
  const stats = output.preview?.stats;
  const thumbs = output.preview?.thumbnails || [];
  const text = output.preview?.text;
  const filename = `${safeName(output.fileName) || 'MendFile'}.${output.ext}`;
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-emerald-200 rounded-xl p-4 sm:p-5 bg-emerald-50/40 space-y-4 animate-[fadeIn_.3s_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-emerald-800 font-semibold">🎉 处理完成，请下载结果</div>
          <div className="text-xs text-slate-500 mt-1">
            文件名：<span className="font-mono">{filename}</span> · 大小：{formatBytes(output.blob.size)}
          </div>
        </div>
        <div className="flex gap-2">
          {text && (
            <button className="btn-secondary" onClick={copyText}>{copied ? '已复制 ✓' : '📋 复制文本'}</button>
          )}
          <button className="btn-primary !bg-emerald-600 hover:!bg-emerald-700" onClick={onDownload}>
            ⬇️ 下载 {config.outputExt.toUpperCase()}
          </button>
        </div>
      </div>

      {stats && Object.keys(stats).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-white rounded-lg border border-slate-100 px-3 py-2">
              <div className="text-[11px] text-slate-500">{k}</div>
              <div className="text-sm font-semibold text-slate-800 truncate">{String(v)}</div>
            </div>
          ))}
        </div>
      )}

      {thumbs.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {thumbs.filter(Boolean).map((t, i) => (
            <img key={i} src={t} alt={`预览 ${i + 1}`} className="h-36 rounded-lg border border-slate-200 bg-white shrink-0" />
          ))}
        </div>
      )}

      {text && (
        <Field label="文本预览（前 10000 字）">
          <textarea readOnly className="input font-mono h-48 whitespace-pre-wrap" value={text} />
        </Field>
      )}
    </div>
  );
}

function structuredCloneSafe<T>(v: T): T {
  try {
    if (typeof structuredClone === 'function') return structuredClone(v);
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(v));
}
