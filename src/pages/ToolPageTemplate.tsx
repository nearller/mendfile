import { Helmet } from 'react-helmet-async';
import type { ToolConfig } from '@/config/tools';
import { CATEGORY_META } from '@/config/tools';
import { useEffect, useRef, useState } from 'react';
import { formatBytes, generatePdfThumbnail, readAsArrayBuffer, readAsDataURL, downloadBlob, stripExt, safeName } from '@/core/utils';
import { pdfjsLib } from '@/core/pdfjs';
import AdSlot from '@/components/AdSlot';
import type { ProcessOutput } from '@/core/types';
// 批次 6 · 云端增强模式提示条（仅架构预留）
import { CloudModeHintStrip, CloudBannerEntry } from '@/components/CloudReserve';

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
  const [options, setOptions] = useState<any>(() => {
    const defaults = structuredCloneSafe(config.defaultOptions);
    // 抠图工具：从 localStorage 恢复上次背景选择
    if (toolKey === 'image-removebg') {
      try {
        const savedBg = localStorage.getItem('mendfile_removebg_bgmode');
        const savedColor = localStorage.getItem('mendfile_removebg_customcolor');
        const savedThr = localStorage.getItem('mendfile_removebg_threshold');
        const savedFeather = localStorage.getItem('mendfile_removebg_feather');
        if (savedBg) defaults.bgMode = savedBg;
        if (savedColor) defaults.customBgColor = savedColor;
        if (savedThr) defaults.threshold = Number(savedThr);
        if (savedFeather) defaults.feather = Number(savedFeather);
      } catch { /* localStorage 不可用时静默 */ }
    }
    return defaults;
  });
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

  // 抠图工具：自动缓存用户背景选择到 localStorage
  useEffect(() => {
    if (toolKey !== 'image-removebg' || !options) return;
    try {
      if (options.bgMode) localStorage.setItem('mendfile_removebg_bgmode', options.bgMode);
      if (options.customBgColor) localStorage.setItem('mendfile_removebg_customcolor', options.customBgColor);
      if (options.threshold != null) localStorage.setItem('mendfile_removebg_threshold', String(options.threshold));
      if (options.feather != null) localStorage.setItem('mendfile_removebg_feather', String(options.feather));
    } catch { /* 静默 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolKey, options?.bgMode, options?.customBgColor, options?.threshold, options?.feather]);

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
      {/* 批次 6 · 云端增强模式提示（仅开关开启时显示；当前为架构预留，仍纯本地处理） */}
      <CloudModeHintStrip />
      {/* 工具页紧凑云端入口 + 工具信息右上小徽章 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div />
        <CloudBannerEntry compact />
      </div>
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

    /* =====================================
     *  二期 · 批次 2 · 二维码工具参数面板
     * ===================================== */
    'qr-generate': (
      <QrGeneratePanel options={options} update={update} disabled={disabled} />
    ),
    'qr-batch': (
      <div className="space-y-4">
        <Field label="批量内容（每行一条，最多 10000 条）" colSpan={1} hint="空行会被自动忽略。示例：\nhttps://mendfile.com\n联系电话：400-000-0000\n张三 - 销售经理 - 工号001">
          <textarea className="input min-h-[160px] font-mono text-xs leading-5 resize-y"
            disabled={disabled}
            value={options.lines ?? ''}
            onChange={(e) => update({ lines: e.target.value })}
            placeholder={'例如：\nhttps://mendfile.com\nhttps://example.com\n联系电话：400-000-0000'} />
          <div className="mt-1 text-[11px] text-slate-500">
            当前 {String((options.lines ?? '').split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean).length)} 条有效内容
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="容错等级" hint="L=7%｜M=15%｜Q=25%｜H=30%（支持更大 Logo 叠加）">
            <select className="input" disabled={disabled} value={options.ecLevel || 'M'}
              onChange={(e) => update({ ecLevel: e.target.value })}>
              <option value="L">L · 约 7%（最快）</option>
              <option value="M">M · 约 15%（日常推荐）</option>
              <option value="Q">Q · 约 25%（较强容错）</option>
              <option value="H">H · 约 30%（最大容错，推荐 Logo 叠加）</option>
            </select>
          </Field>
          <Field label={`尺寸 ${options.size || 512}×${options.size || 512} px`}>
            <input type="range" min={128} max={2000} step={32}
              value={options.size || 512}
              disabled={disabled}
              onChange={(e) => update({ size: Number(e.target.value) })} />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>128</span><span>2000</span></div>
          </Field>
          <Field label="前背景色">
            <div className="flex items-center gap-2 h-10">
              <input type="color" className="h-10 w-12 rounded-lg border border-slate-200 bg-white cursor-pointer"
                value={options.fgColor || '#111827'} disabled={disabled}
                onChange={(e) => update({ fgColor: e.target.value })} />
              <span className="text-slate-400 text-sm">→</span>
              <input type="color" className="h-10 w-12 rounded-lg border border-slate-200 bg-white cursor-pointer"
                value={options.bgColor || '#ffffff'} disabled={disabled}
                onChange={(e) => update({ bgColor: e.target.value })} />
            </div>
          </Field>
          <Field label="点样式">
            <select className="input" disabled={disabled} value={options.dotStyle || 'square'}
              onChange={(e) => update({ dotStyle: e.target.value })}>
              <option value="square">■ 方形（经典）</option>
              <option value="rounded">▢ 圆角（柔和）</option>
              <option value="dot">● 圆点（活泼）</option>
            </select>
          </Field>
          <Field label="文件名前缀" hint="ZIP 内部文件名：前缀_001.png / 前缀_002.png …">
            <input type="text" className="input" value={options.fileNamePrefix || 'qrcode'}
              disabled={disabled} onChange={(e) => update({ fileNamePrefix: e.target.value })} />
          </Field>
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.format || 'png'}
              onChange={(e) => update({ format: e.target.value })}>
              <option value="png">PNG（无损透明推荐）</option>
              <option value="jpg">JPG（体积更小）</option>
            </select>
          </Field>
          <Field label={`JPG 质量 ${options.quality ?? 92}%`} hint="仅 JPG 生效，PNG 始终无损">
            <input type="range" min={40} max={100} step={1}
              value={options.quality ?? 92}
              disabled={disabled}
              onChange={(e) => update({ quality: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
    ),
    'qr-parse': (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="识别结果导出格式">
          <select className="input" disabled={disabled}
            value={options.exportFormat || 'txt'}
            onChange={(e) => update({ exportFormat: e.target.value })}>
            <option value="txt">TXT（按条分组注释，便于阅读复制）</option>
            <option value="csv">CSV（序号/文件/状态/消息/内容，便于 Excel 分析）</option>
          </select>
        </Field>
        <div className="text-xs text-slate-500 bg-slate-100/60 rounded-lg p-3 leading-5 flex items-start gap-2">
          <span>ℹ️</span>
          <div>
            <p><strong>使用建议</strong>：图片像素 ≥ 200×200，图像平整无倾斜、无强烈反光可大幅提升识别率。</p>
            <p className="mt-1">单次最多 <strong>50 张</strong> 图片，若有大量照片可按 50 张一组分批处理。</p>
            <p className="mt-1">当前仅支持<strong>标准 QR Code</strong>，Aztec / DataMatrix / Code128 等其他条码暂不支持。</p>
          </div>
        </div>
      </div>
    ),

    /* =====================================
     *  二期 · 批次 3 · 图片补齐参数面板
     * ===================================== */
    'image-watermark': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="水印模式">
            <select className="input" disabled={disabled} value={options.mode || 'text'}
              onChange={(e) => update({ mode: e.target.value })}>
              <option value="text">文字水印（可多行）</option>
              <option value="image">图片水印 / Logo</option>
            </select>
          </Field>
          <Field label="布局方式">
            <select className="input" disabled={disabled} value={options.layout || 'tile'}
              onChange={(e) => update({ layout: e.target.value })}>
              <option value="tile">平铺密集（防盗水印）</option>
              <option value="center">居中单张</option>
              <option value="corners">四角 + 居中（共 5 处）</option>
            </select>
          </Field>
          <Field label={`透明度 ${Math.round((options.opacity ?? 0.28) * 100)}%`} hint="建议防盗水印 15~35%，居中署名 60~90%">
            <input type="range" min={0.02} max={1} step={0.01}
              value={options.opacity ?? 0.28}
              disabled={disabled}
              onChange={(e) => update({ opacity: Number(e.target.value) })} />
          </Field>
          <Field label="旋转角度 (°)" hint="平铺模式建议 -30° 或 45° 交错更美观">
            <input type="number" className="input"
              value={options.rotation ?? -30}
              disabled={disabled}
              onChange={(e) => update({ rotation: Number(e.target.value) })} />
          </Field>
        </div>
        {options.mode === 'image' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Field label="上传水印图片（Logo）" colSpan={2} hint="推荐透明 PNG、白底 JPG 亦可；过大建议先压缩">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="input" disabled={disabled}
                onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  const url = await readAsDataURL(f);
                  update({ imageDataURL: url });
                }} />
              {options.imageDataURL ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
                  <img src={options.imageDataURL} alt="水印预览" className="h-14 max-w-36 rounded border border-slate-200 bg-slate-50 object-contain" />
                  <button type="button" disabled={disabled}
                    onClick={() => update({ imageDataURL: '' })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm text-slate-600 disabled:opacity-50">
                    🗑 移除 Logo
                  </button>
                </div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500">⚠️ 未上传水印图片，点击「开始处理」会报错。请上传或切换到「文字水印」模式。</div>
              )}
            </Field>
            <Field label={`Logo 宽度占比 ${Math.round((options.imageWidthRatio ?? 0.18) * 100)}%`} hint="居中模式为整图宽度占比；四角模式会自动缩小约 40%">
              <input type="range" min={0.03} max={0.8} step={0.01}
                value={options.imageWidthRatio ?? 0.18}
                disabled={disabled}
                onChange={(e) => update({ imageWidthRatio: Number(e.target.value) })} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="文字内容" colSpan={2} hint="支持换行符（多行水印）；建议控制在 40 字以内">
              <textarea className="input min-h-[72px] resize-y leading-6" rows={2}
                value={options.text ?? '© MendFile.com'}
                disabled={disabled}
                onChange={(e) => update({ text: e.target.value })} />
            </Field>
            <Field label="字号 (px)">
              <input type="number" className="input" min={8} max={240}
                value={options.fontSize ?? 32}
                disabled={disabled}
                onChange={(e) => update({ fontSize: Number(e.target.value) })} />
            </Field>
            <Field label="文字颜色">
              <div className="flex items-center gap-2 h-10">
                <input type="color" className="h-10 w-14 rounded-lg border border-slate-200 bg-white cursor-pointer"
                  value={options.color || '#111827'}
                  disabled={disabled}
                  onChange={(e) => update({ color: e.target.value })} />
                <input type="text" className="input font-mono text-xs flex-1 !py-1 !h-10"
                  value={options.color || '#111827'}
                  disabled={disabled}
                  onChange={(e) => update({ color: e.target.value })} />
              </div>
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={`间距 / 边距 ${options.padding ?? 60} px`} hint="平铺模式为水印之间步长；四角模式为距边距离">
            <input type="range" min={0} max={400} step={2}
              value={options.padding ?? 60}
              disabled={disabled}
              onChange={(e) => update({ padding: Number(e.target.value) })} />
          </Field>
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'same'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="same">保持原格式（默认）</option>
              <option value="jpg">JPG（体积小）</option>
              <option value="png">PNG（无损透明）</option>
            </select>
          </Field>
          <Field label={`输出质量 ${options.quality ?? 92}%`} hint="仅 JPG/WebP 生效">
            <input type="range" min={40} max={100} step={1}
              value={options.quality ?? 92}
              disabled={disabled}
              onChange={(e) => update({ quality: Number(e.target.value) })} />
          </Field>
        </div>
      </div>
    ),
    'image-stitch': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="拼接模式">
            <select className="input" disabled={disabled} value={options.direction || 'vertical'}
              onChange={(e) => update({ direction: e.target.value })}>
              <option value="vertical">⬇ 纵向拼接（聊天记录 / 长截图）</option>
              <option value="horizontal">➡ 横向拼接（对比图 / 全景）</option>
              <option value="grid2">⊞ 2 列网格拼图（九宫格 · 发圈）</option>
            </select>
          </Field>
          <Field label={`间距 ${options.gap ?? 8} px`} hint="0 为无缝密接；推荐 6~16px 带白边更美观">
            <input type="range" min={0} max={200} step={1}
              value={options.gap ?? 8}
              disabled={disabled}
              onChange={(e) => update({ gap: Number(e.target.value) })} />
          </Field>
          <Field label="背景模式">
            <div className="flex items-center gap-3 h-10">
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name={`stitch-bg-${toolKey}`}
                  checked={!options.bgTransparent}
                  disabled={disabled}
                  onChange={() => update({ bgTransparent: false })} />
                纯色
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input type="radio" name={`stitch-bg-${toolKey}`}
                  checked={!!options.bgTransparent}
                  disabled={disabled}
                  onChange={() => update({ bgTransparent: true })} />
                透明（仅 PNG）
              </label>
            </div>
          </Field>
          <Field label="背景颜色" hint="仅「纯色」模式生效">
            <div className="flex items-center gap-2 h-10">
              <input type="color" className="h-10 w-14 rounded-lg border border-slate-200 bg-white cursor-pointer"
                value={options.bgColor || '#ffffff'}
                disabled={disabled || options.bgTransparent}
                onChange={(e) => update({ bgColor: e.target.value })} />
              <input type="text" className="input font-mono text-xs flex-1 !py-1 !h-10"
                value={options.bgColor || '#ffffff'}
                disabled={disabled || options.bgTransparent}
                onChange={(e) => update({ bgColor: e.target.value })} />
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'jpg'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="jpg">JPG（体积小，推荐）</option>
              <option value="png">PNG（无损 / 透明）</option>
              <option value="webp">WebP（更小更高清）</option>
            </select>
          </Field>
          <Field label={`输出质量 ${options.quality ?? 92}%`} hint="仅 JPG/WebP 生效">
            <input type="range" min={40} max={100} step={1}
              value={options.quality ?? 92}
              disabled={disabled}
              onChange={(e) => update({ quality: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="text-xs text-slate-500 bg-slate-100/60 rounded-lg p-3 leading-5">
          💡 <strong>使用提示</strong>：纵向模式自动等宽对齐（取最大宽度），横向模式自动等高对齐；2 列网格按首行宽度统一列宽，建议上传比例相近的图片以获得最佳观感。顺序可在上方文件列表用「↑ / ↓」调整。
        </div>
      </div>
    ),
    'image-split': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="分割模式">
            <select className="input" disabled={disabled} value={options.mode || 'grid'}
              onChange={(e) => update({ mode: e.target.value })}>
              <option value="grid">网格等分（例：九宫格 3×3）</option>
              <option value="rows">仅横向等分（按行切）</option>
              <option value="cols">仅纵向等分（按列切）</option>
            </select>
          </Field>
          <Field label={`行数 ${options.rows ?? 3}`} hint="2~12，仅 grid / rows 生效">
            <input type="range" min={1} max={12} step={1}
              value={options.rows ?? 3}
              disabled={disabled || options.mode === 'cols'}
              onChange={(e) => update({ rows: Number(e.target.value) })} />
            <div className="text-[11px] text-slate-400 mt-0.5 text-right">当前 {options.mode === 'cols' ? 1 : options.rows ?? 3} 行</div>
          </Field>
          <Field label={`列数 ${options.cols ?? 3}`} hint="2~12，仅 grid / cols 生效">
            <input type="range" min={1} max={12} step={1}
              value={options.cols ?? 3}
              disabled={disabled || options.mode === 'rows'}
              onChange={(e) => update({ cols: Number(e.target.value) })} />
            <div className="text-[11px] text-slate-400 mt-0.5 text-right">当前 {options.mode === 'rows' ? 1 : options.cols ?? 3} 列</div>
          </Field>
          <Field label={`重叠像素 ${options.overlap ?? 0} px`} hint="地图 / 全景 / 漫画拼图时可设 10~30px 消除边界缝隙">
            <input type="range" min={0} max={80} step={1}
              value={options.overlap ?? 0}
              disabled={disabled}
              onChange={(e) => update({ overlap: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'same'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="same">保持原格式（默认）</option>
              <option value="png">PNG（无损）</option>
              <option value="jpg">JPG（体积小）</option>
            </select>
          </Field>
          <Field label={`输出质量 ${options.quality ?? 92}%`} hint="仅 JPG 生效">
            <input type="range" min={40} max={100} step={1}
              value={options.quality ?? 92}
              disabled={disabled}
              onChange={(e) => update({ quality: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="text-xs text-slate-500 bg-slate-100/60 rounded-lg p-3 leading-5">
          🧩 批量多图分割会自动命名为 <code className="font-mono bg-white px-1.5 py-0.5 rounded border">文件名_r1c1.png</code>、<code className="font-mono bg-white px-1.5 py-0.5 rounded border">_r1c2.png</code>…，所有切片打包进一个 ZIP。建议发朋友圈九宫格：模式「网格」，行列 3×3。
        </div>
      </div>
    ),
    'image-edit': (
      <div className="space-y-4">
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium">① 旋转角度（常用快捷操作）</div>
          <div className="flex flex-wrap gap-2">
            {[
              { v: 0, label: '0° 不旋转' },
              { v: 90, label: '↻ 90° 顺时针' },
              { v: 180, label: '⇅ 180° 上下颠倒' },
              { v: 270, label: '↺ 90° 逆时针' },
            ].map((r) => (
              <button type="button" key={r.v}
                disabled={disabled}
                onClick={() => update({ rotate: r.v })}
                className={`px-3 py-1.5 text-sm rounded-lg border transition disabled:opacity-50 ${Number(options.rotate ?? 0) === r.v ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium' : 'bg-white border-slate-200 text-slate-700 hover:border-brand-300'}`}>
                {r.label}
              </button>
            ))}
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-slate-200 bg-white">
              <span className="text-xs text-slate-500">自定义°</span>
              <input type="number" className="w-20 input !py-1 !h-8 text-xs" min={-180} max={180}
                value={options.rotate ?? 0}
                disabled={disabled}
                onChange={(e) => update({ rotate: Number(e.target.value) })} />
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 mb-2 font-medium">② 镜像翻转（可组合）</div>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <input type="checkbox" className="rounded" disabled={disabled}
                checked={!!options.flipH}
                onChange={(e) => update({ flipH: e.target.checked })} />
              ⇆ 水平镜像（左右翻转）
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer px-3 py-2 rounded-lg border border-slate-200 bg-white">
              <input type="checkbox" className="rounded" disabled={disabled}
                checked={!!options.flipV}
                onChange={(e) => update({ flipV: e.target.checked })} />
              ⇅ 垂直镜像（上下翻转）
            </label>
            <button type="button" disabled={disabled}
              onClick={() => update({ flipH: false, flipV: false, rotate: 0, cropTop: 0, cropBottom: 0, cropLeft: 0, cropRight: 0 })}
              className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 disabled:opacity-50">
              ↺ 重置所有参数
            </button>
          </div>
        </div>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="text-xs text-slate-500 font-medium">③ 四边裁剪</div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400">单位：</span>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="radio" name={`cropunit-${toolKey}`}
                  checked={(options.cropUnit || 'pixel') === 'pixel'}
                  disabled={disabled}
                  onChange={() => update({ cropUnit: 'pixel' })} />
                像素 px
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input type="radio" name={`cropunit-${toolKey}`}
                  checked={(options.cropUnit || 'pixel') === 'percent'}
                  disabled={disabled}
                  onChange={() => update({ cropUnit: 'percent' })} />
                百分比 %
              </label>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label={`上 ${options.cropUnit === 'percent' ? '%' : 'px'}`}>
              <input type="number" className="input" min={0} max={99999}
                value={options.cropTop ?? 0}
                disabled={disabled}
                onChange={(e) => update({ cropTop: Number(e.target.value) })} />
            </Field>
            <Field label={`下 ${options.cropUnit === 'percent' ? '%' : 'px'}`}>
              <input type="number" className="input" min={0} max={99999}
                value={options.cropBottom ?? 0}
                disabled={disabled}
                onChange={(e) => update({ cropBottom: Number(e.target.value) })} />
            </Field>
            <Field label={`左 ${options.cropUnit === 'percent' ? '%' : 'px'}`}>
              <input type="number" className="input" min={0} max={99999}
                value={options.cropLeft ?? 0}
                disabled={disabled}
                onChange={(e) => update({ cropLeft: Number(e.target.value) })} />
            </Field>
            <Field label={`右 ${options.cropUnit === 'percent' ? '%' : 'px'}`}>
              <input type="number" className="input" min={0} max={99999}
                value={options.cropRight ?? 0}
                disabled={disabled}
                onChange={(e) => update({ cropRight: Number(e.target.value) })} />
            </Field>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'same'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="same">保持原格式（默认）</option>
              <option value="jpg">JPG（体积小）</option>
              <option value="png">PNG（无损透明）</option>
            </select>
          </Field>
          <Field label={`输出质量 ${options.quality ?? 92}%`} hint="仅 JPG/WebP 生效">
            <input type="range" min={40} max={100} step={1}
              value={options.quality ?? 92}
              disabled={disabled}
              onChange={(e) => update({ quality: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="text-xs text-slate-500 bg-slate-100/60 rounded-lg p-3 leading-5">
          ℹ️ <strong>处理顺序</strong>：先按数值裁剪四边 → 再执行镜像翻转 → 最后旋转角度。自定义非 90° 倍数斜切旋转后四周会自动填充透明或白底，保证画面完整不被裁切。
        </div>
      </div>
    ),
    'image-removebg': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={`容差阈值 ${options.threshold ?? 35} / 120`} hint={'越大抠除越多可能误扣主体；越小越保守可能残留背景边。建议 25~50'}>
            <input type="range" min={10} max={120} step={1}
              value={options.threshold ?? 35}
              disabled={disabled}
              onChange={(e) => update({ threshold: Number(e.target.value) })} />
          </Field>
          <Field label={`边缘羽化 ${options.feather ?? 2} px`} hint="羽化越大边缘越柔和但可能略模糊；建议 1~4px">
            <input type="range" min={0} max={15} step={1}
              value={options.feather ?? 2}
              disabled={disabled}
              onChange={(e) => update({ feather: Number(e.target.value) })} />
          </Field>
          <Field label="输出背景" hint="默认白底，选择会自动缓存">
            <select className="input" disabled={disabled} value={options.bgMode || 'white'}
              onChange={(e) => update({ bgMode: e.target.value })}>
              <option value="white">⚪ 白色背景（默认）</option>
              <option value="transparent">🔍 透明背景 PNG</option>
              <option value="custom">🎨 自定义纯色</option>
            </select>
          </Field>
          {options.bgMode === 'custom' && (
            <Field label="自定义背景色">
              <div className="flex items-center gap-2 h-10">
                <input type="color" className="h-10 w-14 rounded-lg border border-slate-200 bg-white cursor-pointer"
                  value={options.customBgColor || '#ffffff'}
                  disabled={disabled}
                  onChange={(e) => update({ customBgColor: e.target.value })} />
                <input type="text" className="input font-mono text-xs flex-1 !py-1 !h-10"
                  value={options.customBgColor || '#ffffff'}
                  disabled={disabled}
                  onChange={(e) => update({ customBgColor: e.target.value })} />
              </div>
            </Field>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="边缘精修" hint="自动消除前景中的孤立噪点">
            <label className="inline-flex items-center gap-2 h-10 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded"
                checked={options.edgeRefine !== false}
                disabled={disabled}
                onChange={(e) => update({ edgeRefine: e.target.checked })} />
              <span>启用边缘精修 + 形态学清理</span>
            </label>
          </Field>
          <Field label="自动压缩" hint="限制最长边 2400px + 智能择优格式">
            <label className="inline-flex items-center gap-2 h-10 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded"
                checked={options.autoCompress !== false}
                disabled={disabled}
                onChange={(e) => update({ autoCompress: e.target.checked })} />
              <span>启用自动无损轻量化压缩</span>
            </label>
          </Field>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 leading-5">
          ℹ️ <strong>下载逻辑</strong>：单张图片抠图完成直接输出 PNG 图片文件下载；仅当上传多张图片（批量抠图）时才打包 ZIP 压缩包。背景选择已自动缓存，下次进入自动复用。
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 leading-5">
          <p className="font-semibold mb-1">⚠️ 【合规提示 · 必看】本工具不是神经网络 AI 抠图</p>
          <p>采用高精度纯 Canvas Flood Fill 颜色容差法 + 边缘精修 + 形态学清理，效果远不如专业商用云端抠图服务。</p>
          <ul className="mt-1.5 space-y-0.5 list-disc list-inside text-red-700/90">
            <li>✅ 仅适合：<strong>纯色墙面背景人像 / 白底产品图 / 轻度渐变色背景</strong></li>
            <li>❌ 不适合：发丝、婚纱、半透明玻璃、高反光、复杂图案背景、前景与背景颜色相近</li>
            <li>❌ 身份证、护照、签证、考试报名、正式证件照等用途请务必使用专业照相馆服务</li>
          </ul>
          <p className="mt-1.5 text-red-700/80">建议先上传单张预览调整阈值，满意后再批量处理。全部计算均在浏览器本地完成，不传输任何图像数据。</p>
        </div>
      </div>
    ),
    // =======================================================
    // 批次 4 · 多媒体工具参数面板
    // =======================================================
    'video-compress': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="压缩质量档位">
          <select className="input" disabled={disabled} value={options.level || 'balanced'}
            onChange={(e) => update({ level: e.target.value })}>
            <option value="crisp">✨ 清晰（≈10Mbps，接近原画）</option>
            <option value="balanced">⚖️ 均衡（≈5Mbps，推荐默认）</option>
            <option value="extreme">🔥 极致（≈2.5Mbps，体积最小）</option>
          </select>
        </Field>
        <Field label="分辨率缩放" hint="缩小分辨率可大幅减小体积">
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { k: '100', label: '原始 100%' },
              { k: '75', label: '75%' },
              { k: '50', label: '50%' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" name={`vscale-${toolKey}`} value={r.k}
                  checked={(options.scale || '100') === r.k} disabled={disabled}
                  onChange={() => update({ scale: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        <Field label="音频码率">
          <select className="input" disabled={disabled} value={options.audioBitrate || '128'}
            onChange={(e) => update({ audioBitrate: e.target.value })}>
            <option value="256">256 kbps（高品质）</option>
            <option value="128">128 kbps（标准）</option>
            <option value="96">96 kbps（紧凑）</option>
            <option value="64">64 kbps（语音级）</option>
          </select>
        </Field>
        <Field label="输出格式" hint="若浏览器不支持所选格式会自动降级">
          <select className="input" disabled={disabled} value={options.outputFormat || 'auto'}
            onChange={(e) => update({ outputFormat: e.target.value })}>
            <option value="auto">🎯 自动（浏览器最佳）</option>
            <option value="mp4">MP4（H.264，兼容性最好）</option>
            <option value="webm">WebM（VP9，体积更小）</option>
          </select>
        </Field>
      </div>
    ),
    'video-crop': (
      <div className="space-y-4">
        <Field label="裁剪模式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'seconds', label: '⏱️ 精确秒数（推荐，0.01s 精度）' },
              { k: 'percent', label: '📊 百分比（粗略 10%~80%）' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`vcmode-${toolKey}`} value={r.k}
                  checked={(options.mode || 'seconds') === r.k} disabled={disabled}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {(options.mode || 'seconds') === 'seconds' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="起始时间（秒）" hint="0 表示从开头开始">
              <input type="number" className="input" min={0} step={0.01}
                value={options.startSec ?? 0} disabled={disabled}
                onChange={(e) => update({ startSec: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="结束时间（秒）" hint="0 表示截取到视频末尾">
              <input type="number" className="input" min={0} step={0.01}
                value={options.endSec ?? 0} disabled={disabled}
                onChange={(e) => update({ endSec: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`起始位置 ${options.startPercent ?? 0}%`}>
              <input type="range" min={0} max={100} step={1}
                value={options.startPercent ?? 0} disabled={disabled}
                onChange={(e) => update({ startPercent: Number(e.target.value) })} />
            </Field>
            <Field label={`结束位置 ${options.endPercent ?? 100}%`}>
              <input type="range" min={0} max={100} step={1}
                value={options.endPercent ?? 100} disabled={disabled}
                onChange={(e) => update({ endPercent: Number(e.target.value) })} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="重编码质量">
            <select className="input" disabled={disabled} value={options.quality || 'balanced'}
              onChange={(e) => update({ quality: e.target.value })}>
              <option value="crisp">✨ 清晰</option>
              <option value="balanced">⚖️ 均衡（推荐）</option>
              <option value="extreme">🔥 极致压缩</option>
            </select>
          </Field>
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'auto'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="auto">🎯 自动（浏览器最佳）</option>
              <option value="mp4">MP4（H.264）</option>
              <option value="webm">WebM（VP9）</option>
            </select>
          </Field>
        </div>
      </div>
    ),
    'video-convert': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="目标格式">
          <select className="input" disabled={disabled} value={options.format || 'mp4'}
            onChange={(e) => update({ format: e.target.value })}>
            <option value="mp4">MP4（H.264，全平台兼容）</option>
            <option value="webm">WebM（VP9，体积更小）</option>
          </select>
        </Field>
        <Field label="转码质量">
          <select className="input" disabled={disabled} value={options.quality || 'balanced'}
            onChange={(e) => update({ quality: e.target.value })}>
            <option value="crisp">✨ 高清（≈10Mbps）</option>
            <option value="balanced">⚖️ 标准（≈5Mbps）</option>
            <option value="extreme">🔻 省流量（≈2.5Mbps）</option>
          </select>
        </Field>
        <Field label="音频码率">
          <select className="input" disabled={disabled} value={options.audioBitrate || '128'}
            onChange={(e) => update({ audioBitrate: e.target.value })}>
            <option value="256">256 kbps 高品质</option>
            <option value="192">192 kbps</option>
            <option value="128">128 kbps 标准</option>
            <option value="96">96 kbps</option>
            <option value="64">64 kbps 语音</option>
          </select>
        </Field>
      </div>
    ),
    'audio-compress': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="目标码率">
          <select className="input" disabled={disabled} value={options.bitrate || '128'}
            onChange={(e) => update({ bitrate: e.target.value })}>
            <option value="320">320 kbps（高品质音乐）</option>
            <option value="192">192 kbps（标准）</option>
            <option value="128">128 kbps（通用，推荐）</option>
            <option value="96">96 kbps（紧凑）</option>
            <option value="64">64 kbps（语音级）</option>
            <option value="32">32 kbps（极致压缩）</option>
          </select>
        </Field>
        <Field label="采样率">
          <select className="input" disabled={disabled} value={options.sampleRate || '44100'}
            onChange={(e) => update({ sampleRate: e.target.value })}>
            <option value="48000">48 kHz（原声级）</option>
            <option value="44100">44.1 kHz（CD 级，推荐）</option>
            <option value="22050">22.05 kHz（语音级）</option>
            <option value="16000">16 kHz（电话级）</option>
          </select>
        </Field>
        <Field label="输出格式" hint="WAV 为无损 PCM；WebM/MP4 为压缩编码">
          <select className="input" disabled={disabled} value={options.outputFormat || 'auto'}
            onChange={(e) => update({ outputFormat: e.target.value })}>
            <option value="auto">🎯 自动（浏览器最佳）</option>
            <option value="webm">WebM（Opus 编码，体积最小）</option>
            <option value="mp4">MP4（AAC 编码，Apple 生态）</option>
            <option value="wav">WAV（无损 16-bit PCM）</option>
          </select>
        </Field>
      </div>
    ),
    'audio-crop': (
      <div className="space-y-4">
        <Field label="裁剪模式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'seconds', label: '⏱️ 精确秒数（0.01s 精度，推荐）' },
              { k: 'percent', label: '📊 百分比（粗略裁剪）' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`acmode-${toolKey}`} value={r.k}
                  checked={(options.mode || 'seconds') === r.k} disabled={disabled}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {(options.mode || 'seconds') === 'seconds' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="起始时间（秒）" hint="0 表示从开头开始">
              <input type="number" className="input" min={0} step={0.01}
                value={options.startSec ?? 0} disabled={disabled}
                onChange={(e) => update({ startSec: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
            <Field label="结束时间（秒）" hint="0 表示截取到音频末尾">
              <input type="number" className="input" min={0} step={0.01}
                value={options.endSec ?? 0} disabled={disabled}
                onChange={(e) => update({ endSec: Math.max(0, Number(e.target.value) || 0) })} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`起始位置 ${options.startPercent ?? 0}%`}>
              <input type="range" min={0} max={100} step={1}
                value={options.startPercent ?? 0} disabled={disabled}
                onChange={(e) => update({ startPercent: Number(e.target.value) })} />
            </Field>
            <Field label={`结束位置 ${options.endPercent ?? 100}%`}>
              <input type="range" min={0} max={100} step={1}
                value={options.endPercent ?? 100} disabled={disabled}
                onChange={(e) => update({ endPercent: Number(e.target.value) })} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={`淡入 ${options.fadeIn ?? 0} 秒`} hint="0 = 关闭，避免开头爆音，最大 3s">
            <input type="range" min={0} max={3} step={0.1}
              value={options.fadeIn ?? 0} disabled={disabled}
              onChange={(e) => update({ fadeIn: Number(e.target.value) })} />
          </Field>
          <Field label={`淡出 ${options.fadeOut ?? 0} 秒`} hint="0 = 关闭，避免结尾突然截断">
            <input type="range" min={0} max={3} step={0.1}
              value={options.fadeOut ?? 0} disabled={disabled}
              onChange={(e) => update({ fadeOut: Number(e.target.value) })} />
          </Field>
          <Field label="输出格式">
            <select className="input" disabled={disabled} value={options.outputFormat || 'auto'}
              onChange={(e) => update({ outputFormat: e.target.value })}>
              <option value="auto">🎯 自动</option>
              <option value="wav">WAV（无损 PCM）</option>
              <option value="webm">WebM（Opus）</option>
              <option value="mp4">MP4（AAC）</option>
            </select>
          </Field>
          {(options.outputFormat || 'auto') !== 'wav' && (
            <Field label="输出码率" hint="仅 WebM/MP4 生效">
              <select className="input" disabled={disabled} value={options.outputBitrate || '192'}
                onChange={(e) => update({ outputBitrate: e.target.value })}>
                <option value="320">320 kbps</option>
                <option value="256">256 kbps</option>
                <option value="192">192 kbps（推荐）</option>
                <option value="128">128 kbps</option>
                <option value="96">96 kbps</option>
                <option value="64">64 kbps</option>
              </select>
            </Field>
          )}
        </div>
      </div>
    ),
    'audio-convert': (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Field label="目标输出格式">
          <select className="input" disabled={disabled} value={options.format || 'wav'}
            onChange={(e) => update({ format: e.target.value })}>
            <option value="wav">WAV 16-bit PCM（无损通用，推荐）</option>
            <option value="mp4">MP4（AAC 编码，Apple/微信）</option>
            <option value="webm">WebM（Opus 编码，高压缩比）</option>
          </select>
        </Field>
        <Field label={`码率 ${options.bitrate || '192'} kbps`} hint="仅 MP4/WebM 生效；WAV 为无损不受影响">
          <select className="input" disabled={disabled} value={options.bitrate || '192'}
            onChange={(e) => update({ bitrate: e.target.value })}>
            <option value="320">320 kbps（极致音质）</option>
            <option value="256">256 kbps</option>
            <option value="192">192 kbps（推荐）</option>
            <option value="128">128 kbps</option>
            <option value="96">96 kbps</option>
            <option value="64">64 kbps（紧凑）</option>
          </select>
        </Field>
        <Field label="采样率">
          <select className="input" disabled={disabled} value={options.sampleRate || '44100'}
            onChange={(e) => update({ sampleRate: e.target.value })}>
            <option value="48000">48 kHz（原声）</option>
            <option value="44100">44.1 kHz（CD 级）</option>
            <option value="22050">22.05 kHz（语音）</option>
            <option value="16000">16 kHz（电话级）</option>
          </select>
        </Field>
      </div>
    ),
    // =======================================================
    // 批次 5 · 办公小工具合集参数面板
    // =======================================================
    'text-process': (
      <div className="space-y-4">
        <Field label="处理模式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'clean', label: '🧹 文本清洗（去空格/空行/全角）' },
              { k: 'mask', label: '🛡️ 信息脱敏（手机/邮箱/身份证/银行卡打码）' },
              { k: 'trad', label: '🀄 繁简转换（2000+ 常用字双向）' },
              { k: 'diff', label: '🔍 差异对比（LCS 算法，需传 2 个文件）' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`tpmode-${toolKey}`} value={r.k}
                  checked={(options.mode || 'clean') === r.k} disabled={disabled}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {(options.mode || 'clean') === 'clean' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="每行去首尾空格">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={options.trimEach !== false} disabled={disabled}
                  onChange={(e) => update({ trimEach: e.target.checked })} />
                开启（推荐）
              </label>
            </Field>
            <Field label="去除空行（含纯空格行）">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={options.removeBlankLines !== false} disabled={disabled}
                  onChange={(e) => update({ removeBlankLines: e.target.checked })} />
                开启
              </label>
            </Field>
            <Field label="全角 → 半角（字母/数字/空格）">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={!!options.fullwidthToHalf} disabled={disabled}
                  onChange={(e) => update({ fullwidthToHalf: e.target.checked })} />
                开启
              </label>
            </Field>
            <Field label="去除所有空格/Tab（含中间）">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={!!options.removeAllSpaces} disabled={disabled}
                  onChange={(e) => update({ removeAllSpaces: e.target.checked })} />
                谨慎开启（会删除中间空格）
              </label>
            </Field>
          </div>
        )}
        {(options.mode || 'clean') === 'mask' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="手机号（11位）打码">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={options.maskPhone !== false} disabled={disabled}
                  onChange={(e) => update({ maskPhone: e.target.checked })} />
                138****1234
              </label>
            </Field>
            <Field label="邮箱 (@) 打码">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={options.maskEmail !== false} disabled={disabled}
                  onChange={(e) => update({ maskEmail: e.target.checked })} />
                z***e@domain.com
              </label>
            </Field>
            <Field label="身份证号（18/15位）打码">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={options.maskIdCard !== false} disabled={disabled}
                  onChange={(e) => update({ maskIdCard: e.target.checked })} />
                1101**********1234
              </label>
            </Field>
            <Field label="银行卡号（16~19位）打码">
              <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
                <input type="checkbox" className="rounded" checked={!!options.maskBank} disabled={disabled}
                  onChange={(e) => update({ maskBank: e.target.checked })} />
                6222 **** **** 1234
              </label>
            </Field>
          </div>
        )}
        {(options.mode || 'clean') === 'trad' && (
          <Field label="转换方向">
            <div className="flex flex-wrap gap-3 pt-1">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`tdir-${toolKey}`} value="s2t"
                  checked={(options.tradDirection || 's2t') === 's2t'} disabled={disabled}
                  onChange={() => update({ tradDirection: 's2t' })} />
                简体 → 繁体
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`tdir-${toolKey}`} value="t2s"
                  checked={(options.tradDirection || 's2t') === 't2s'} disabled={disabled}
                  onChange={() => update({ tradDirection: 't2s' })} />
                繁体 → 简体
              </label>
              <span className="text-xs text-slate-400 pt-1">※ 基于 2000+ 常用字库，生僻字保留原样</span>
            </div>
          </Field>
        )}
        {(options.mode || 'clean') === 'diff' && (
          <div className="text-xs text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200 leading-5">
            ℹ️ 差异对比模式：请上传 <strong>恰好 2 个</strong> 文本文件（先上传 = 原始文件，后上传 = 新文件）。输出统一 Diff 格式，
            <code className="mx-1 px-1 rounded bg-white">-</code>代表删除、
            <code className="mx-1 px-1 rounded bg-white">+</code>代表新增、
            <code className="mx-1 px-1 rounded bg-white">空格</code>代表相同。
          </div>
        )}
      </div>
    ),
    'work-hours': (
      <div className="space-y-4">
        <Field label="计算模式">
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={`whm-${toolKey}`} value="single"
                checked={(options.mode || 'single') === 'single'} disabled={disabled}
                onChange={() => update({ mode: 'single' })} />
              📅 单日工时 + 薪资
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name={`whm-${toolKey}`} value="batch"
                checked={(options.mode || 'single') === 'batch'} disabled={disabled}
                onChange={() => update({ mode: 'batch' })} />
              📊 批量多日（粘贴 CSV 数据）
            </label>
          </div>
        </Field>
        {(options.mode || 'single') === 'single' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="上班时间">
              <input type="time" className="input" value={options.workStart || '09:00'} disabled={disabled}
                onChange={(e) => update({ workStart: e.target.value })} />
            </Field>
            <Field label="下班时间">
              <input type="time" className="input" value={options.workEnd || '18:00'} disabled={disabled}
                onChange={(e) => update({ workEnd: e.target.value })} />
            </Field>
            <Field label="午休开始">
              <input type="time" className="input" value={options.lunchStart || '12:00'} disabled={disabled}
                onChange={(e) => update({ lunchStart: e.target.value })} />
            </Field>
            <Field label="午休结束">
              <input type="time" className="input" value={options.lunchEnd || '13:00'} disabled={disabled}
                onChange={(e) => update({ lunchEnd: e.target.value })} />
            </Field>
          </div>
        )}
        {(options.mode || 'single') === 'batch' && (
          <Field label="批量 CSV 打卡数据" hint="每行格式：日期,上班时间,下班时间,类型(可选 normal/weekend/holiday)" colSpan={2}>
            <textarea className="input min-h-[140px] font-mono text-xs leading-5" disabled={disabled}
              placeholder={'2024-05-01,09:00,18:00,normal\n2024-05-02,09:30,21:00,weekend\n2024-05-03,10:00,19:00,holiday'}
              value={options.batchData || ''}
              onChange={(e) => update({ batchData: e.target.value })} />
          </Field>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="薪资模式">
            <select className="input" disabled={disabled} value={options.salaryMode || 'hourly'}
              onChange={(e) => update({ salaryMode: e.target.value })}>
              <option value="hourly">输入时薪（¥/h）</option>
              <option value="monthly">输入月薪 → 反推时薪</option>
            </select>
          </Field>
          {(options.salaryMode || 'hourly') === 'hourly' ? (
            <Field label="时薪（¥）">
              <input type="number" className="input" min={0} step={0.5} value={options.hourlyRate ?? 30} disabled={disabled}
                onChange={(e) => update({ hourlyRate: Number(e.target.value) || 0 })} />
            </Field>
          ) : (
            <>
              <Field label="月薪（¥）">
                <input type="number" className="input" min={0} step={100} value={options.monthlyRate ?? 8000} disabled={disabled}
                  onChange={(e) => update({ monthlyRate: Number(e.target.value) || 0 })} />
              </Field>
              <Field label="月工作天数">
                <input type="number" className="input" min={1} max={31} value={options.workDaysPerMonth ?? 22} disabled={disabled}
                  onChange={(e) => update({ workDaysPerMonth: Number(e.target.value) || 22 })} />
              </Field>
            </>
          )}
        </div>
        <Field label="加班倍率（按劳动法常用默认）">
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.overtime15 !== false} disabled={disabled}
                onChange={(e) => update({ overtime15: e.target.checked })} />
              工作日 ×1.5
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={!!options.overtime20} disabled={disabled}
                onChange={(e) => update({ overtime20: e.target.checked })} />
              周末 ×2
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={!!options.overtime30} disabled={disabled}
                onChange={(e) => update({ overtime30: e.target.checked })} />
              法定假日 ×3
            </label>
          </div>
        </Field>
      </div>
    ),
    'timestamp': (
      <div className="space-y-4">
        <Field label="转换模式">
          <div className="flex flex-wrap gap-3">
            {[
              { k: 'ts2date', label: '⏳ 时间戳 → 日期（秒/毫秒自动识别）' },
              { k: 'date2ts', label: '📆 日期 → 时间戳' },
              { k: 'batch', label: '📋 批量混合（每行一个时间戳或日期）' },
            ].map((r) => (
              <label key={r.k} className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`tsm-${toolKey}`} value={r.k}
                  checked={(options.mode || 'ts2date') === r.k} disabled={disabled}
                  onChange={() => update({ mode: r.k })} />
                {r.label}
              </label>
            ))}
          </div>
        </Field>
        {(options.mode || 'ts2date') === 'ts2date' && (
          <Field label="时间戳（10位秒 / 13位毫秒，自动识别）">
            <input type="text" className="input font-mono" value={options.timestamp ?? ''} disabled={disabled}
              onChange={(e) => update({ timestamp: e.target.value })} />
          </Field>
        )}
        {(options.mode || 'ts2date') === 'date2ts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="日期时间（YYYY-MM-DD HH:mm:ss）">
              <input type="datetime-local" className="input"
                value={(options.dateTime || '').replace(' ', 'T')} disabled={disabled}
                onChange={(e) => update({ dateTime: e.target.value.replace('T', ' ') })} />
            </Field>
          </div>
        )}
        {(options.mode || 'ts2date') === 'batch' && (
          <Field label="批量输入（每行一个：纯数字按时间戳解析，否则按日期解析）" colSpan={2}>
            <textarea className="input min-h-[140px] font-mono text-xs leading-5" disabled={disabled}
              placeholder={'1717209600\n1717209600000\n2024-06-01 12:00:00\n2023-12-31 23:59:59'}
              value={options.batchInput || ''}
              onChange={(e) => update({ batchInput: e.target.value })} />
          </Field>
        )}
      </div>
    ),
    'password-generator': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label={`密码长度 ${options.length ?? 16} 位`}>
            <input type="range" min={4} max={128} step={1}
              value={options.length ?? 16} disabled={disabled}
              onChange={(e) => update({ length: Number(e.target.value) })} />
          </Field>
          <Field label={`生成数量 ${options.count ?? 5} 条`} hint="最大 1000 条">
            <input type="number" className="input" min={1} max={1000}
              value={options.count ?? 5} disabled={disabled}
              onChange={(e) => update({ count: Math.min(1000, Math.max(1, Number(e.target.value) || 1)) })} />
          </Field>
        </div>
        <Field label="包含的字符类型（至少一项）">
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.includeUpper !== false} disabled={disabled}
                onChange={(e) => update({ includeUpper: e.target.checked })} />
              A-Z 大写字母
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.includeLower !== false} disabled={disabled}
                onChange={(e) => update({ includeLower: e.target.checked })} />
              a-z 小写字母
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.includeNumber !== false} disabled={disabled}
                onChange={(e) => update({ includeNumber: e.target.checked })} />
              0-9 数字
            </label>
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" className="rounded" checked={!!options.includeSymbol} disabled={disabled}
                onChange={(e) => update({ includeSymbol: e.target.checked })} />
              特殊符号
            </label>
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="排除易混字符（I/l/1/|/O/0/o）" hint="推荐开启，避免手写/抄录错误">
            <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.excludeAmbiguous !== false} disabled={disabled}
                onChange={(e) => update({ excludeAmbiguous: e.target.checked })} />
              开启（推荐）
            </label>
          </Field>
          <Field label="每类字符至少各一个" hint="保证强密码混合度，长度不足会自动补齐">
            <label className="inline-flex items-center gap-2 text-sm pt-1.5 cursor-pointer">
              <input type="checkbox" className="rounded" checked={options.requireEachType !== false} disabled={disabled}
                onChange={(e) => update({ requireEachType: e.target.checked })} />
              开启（推荐）
            </label>
          </Field>
        </div>
        {!!options.includeSymbol && (
          <Field label="自定义符号集" hint="修改后会覆盖默认符号；不建议使用引号/斜杠/反引号等">
            <input type="text" className="input font-mono text-sm"
              value={options.customSymbols || '!@#$%^&*()-_=+[]{};:,.<>?'} disabled={disabled}
              onChange={(e) => update({ customSymbols: e.target.value })} />
          </Field>
        )}
        <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200 leading-5">
          🔒 <strong>安全说明</strong>：使用 <code className="mx-1 px-1 rounded bg-white">window.crypto.getRandomValues</code> 加密级随机数（非 <code className="mx-1 px-1 rounded bg-white">Math.random()</code>），
          密码仅在您的浏览器生成，<strong>绝不联网、不传输、不存储</strong>。
        </div>
      </div>
    ),
    'unit-convert': (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Field label="换算类别">
            <select className="input" disabled={disabled} value={options.category || 'length'}
              onChange={(e) => update({ category: e.target.value })}>
              <option value="length">📏 长度</option>
              <option value="weight">⚖️ 重量/质量</option>
              <option value="volume">🧪 体积/容量</option>
              <option value="temp">🌡️ 温度</option>
              <option value="area">🟦 面积</option>
              <option value="time">⏱️ 时间</option>
              <option value="storage">💾 数据存储</option>
              <option value="energy">🔥 能量/热量</option>
            </select>
          </Field>
          <Field label="从（源单位）">
            <select className="input" disabled={disabled} value={options.fromUnit || 'm'}
              onChange={(e) => update({ fromUnit: e.target.value })}>
              {(function () {
                const cat = options.category || 'length';
                const MAP: Record<string, [string, string][]> = {
                  length: [['m', '米 (m)'], ['km', '千米 (km)'], ['cm', '厘米 (cm)'], ['mm', '毫米 (mm)'], ['inch', '英寸 (in)'], ['ft', '英尺 (ft)'], ['yd', '码 (yd)'], ['mi', '英里 (mi)'], ['li', '里（市制）'], ['zhang', '丈'], ['chi', '尺']],
                  weight: [['kg', '千克 (kg)'], ['g', '克 (g)'], ['mg', '毫克 (mg)'], ['t', '吨 (t)'], ['lb', '磅 (lb)'], ['oz', '盎司 (oz)'], ['jin', '斤（市斤）'], ['liang', '两'], ['ct', '克拉 (ct)']],
                  volume: [['L', '升 (L)'], ['mL', '毫升 (mL)'], ['m3', '立方米 (m³)'], ['gal_us', '美制加仑'], ['gal_uk', '英制加仑'], ['pt_us', '美制品脱'], ['cup', '杯 (240mL)'], ['tbsp', '汤匙 (15mL)']],
                  temp: [['C', '摄氏度 (℃)'], ['F', '华氏度 (℉)'], ['K', '开尔文 (K)']],
                  area: [['m2', '平方米 (㎡)'], ['km2', '平方千米 (km²)'], ['ha', '公顷 (ha)'], ['mu', '亩（市亩）'], ['ft2', '平方英尺'], ['in2', '平方英寸'], ['acre', '英亩 (acre)']],
                  time: [['s', '秒 (s)'], ['ms', '毫秒 (ms)'], ['min', '分钟'], ['h', '小时 (h)'], ['d', '天 (day)'], ['wk', '周'], ['mo', '月（30天）'], ['yr', '年（365天）']],
                  storage: [['B', '字节 (B)'], ['KB', '千字节 (KB)'], ['MB', '兆字节 (MB)'], ['GB', '吉字节 (GB)'], ['TB', '太字节 (TB)'], ['PB', '拍字节 (PB)'], ['Kb', '千比特 (Kbit)'], ['Mb', '兆比特 (Mbit)']],
                  energy: [['J', '焦耳 (J)'], ['kJ', '千焦 (kJ)'], ['cal', '卡路里 (cal)'], ['kcal', '大卡/千卡 (kcal)'], ['Wh', '瓦时 (Wh)'], ['kWh', '度 (kWh)'], ['BTU', '英热单位 (BTU)']],
                };
                return (MAP[cat] || []).map(([v, l]) => <option key={v} value={v}>{l}</option>);
              })()}
            </select>
          </Field>
          <Field label="到（目标单位）">
            <select className="input" disabled={disabled} value={options.toUnit || 'inch'}
              onChange={(e) => update({ toUnit: e.target.value })}>
              {(function () {
                const cat = options.category || 'length';
                const MAP: Record<string, [string, string][]> = {
                  length: [['m', '米 (m)'], ['km', '千米 (km)'], ['cm', '厘米 (cm)'], ['mm', '毫米 (mm)'], ['inch', '英寸 (in)'], ['ft', '英尺 (ft)'], ['yd', '码 (yd)'], ['mi', '英里 (mi)'], ['li', '里（市制）'], ['zhang', '丈'], ['chi', '尺']],
                  weight: [['kg', '千克 (kg)'], ['g', '克 (g)'], ['mg', '毫克 (mg)'], ['t', '吨 (t)'], ['lb', '磅 (lb)'], ['oz', '盎司 (oz)'], ['jin', '斤（市斤）'], ['liang', '两'], ['ct', '克拉 (ct)']],
                  volume: [['L', '升 (L)'], ['mL', '毫升 (mL)'], ['m3', '立方米 (m³)'], ['gal_us', '美制加仑'], ['gal_uk', '英制加仑'], ['pt_us', '美制品脱'], ['cup', '杯 (240mL)'], ['tbsp', '汤匙 (15mL)']],
                  temp: [['C', '摄氏度 (℃)'], ['F', '华氏度 (℉)'], ['K', '开尔文 (K)']],
                  area: [['m2', '平方米 (㎡)'], ['km2', '平方千米 (km²)'], ['ha', '公顷 (ha)'], ['mu', '亩（市亩）'], ['ft2', '平方英尺'], ['in2', '平方英寸'], ['acre', '英亩 (acre)']],
                  time: [['s', '秒 (s)'], ['ms', '毫秒 (ms)'], ['min', '分钟'], ['h', '小时 (h)'], ['d', '天 (day)'], ['wk', '周'], ['mo', '月（30天）'], ['yr', '年（365天）']],
                  storage: [['B', '字节 (B)'], ['KB', '千字节 (KB)'], ['MB', '兆字节 (MB)'], ['GB', '吉字节 (GB)'], ['TB', '太字节 (TB)'], ['PB', '拍字节 (PB)'], ['Kb', '千比特 (Kbit)'], ['Mb', '兆比特 (Mbit)']],
                  energy: [['J', '焦耳 (J)'], ['kJ', '千焦 (kJ)'], ['cal', '卡路里 (cal)'], ['kcal', '大卡/千卡 (kcal)'], ['Wh', '瓦时 (Wh)'], ['kWh', '度 (kWh)'], ['BTU', '英热单位 (BTU)']],
                };
                return (MAP[cat] || []).map(([v, l]) => <option key={v} value={v}>{l}</option>);
              })()}
            </select>
          </Field>
          <Field label="要换算的数值">
            <input type="number" className="input" step="any" value={options.value ?? 1} disabled={disabled}
              onChange={(e) => update({ value: e.target.value })} />
          </Field>
          <Field label={`小数位数 ${options.precision ?? 4}`} hint="0~12 位">
            <input type="range" min={0} max={12} step={1} value={options.precision ?? 4} disabled={disabled}
              onChange={(e) => update({ precision: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="启用批量模式">
          <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" className="rounded" checked={!!options.batchMode} disabled={disabled}
              onChange={(e) => update({ batchMode: e.target.checked })} />
            批量模式（粘贴多行数值一次完成换算，单次模式的数值将被忽略）
          </label>
        </Field>
        {!!options.batchMode && (
          <Field label="批量数值（每行一个纯数字）" colSpan={2}>
            <textarea className="input min-h-[140px] font-mono text-xs leading-5" disabled={disabled}
              placeholder={'1\n2.5\n3.785\n1000\n1048576'}
              value={options.batchInput || ''}
              onChange={(e) => update({ batchInput: e.target.value })} />
          </Field>
        )}
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

// ============================================================
// 批次 2 · 美化二维码生成 · 专属参数面板（6 模板一键应用）
// ============================================================
interface QrGeneratePanelProps { options: any; update: (patch: any) => void; disabled: boolean; }
const QR_TEMPLATES: Array<{ k: string; label: string; desc: string; fg: string; bg: string; dot: 'square' | 'rounded' | 'dot'; chip: string }> = [
  { k: 'default',  label: '经典黑',   desc: '方形 / 黑 · 白',          fg: '#111827', bg: '#ffffff', dot: 'square',  chip: 'from-slate-900 to-slate-600' },
  { k: 'business', label: '商务蓝',   desc: '方形 / 深蓝 · 白',        fg: '#1d4ed8', bg: '#ffffff', dot: 'square',  chip: 'from-blue-700 to-sky-400' },
  { k: 'sakura',   label: '樱花粉',   desc: '圆角 / 玫红 · 粉白',      fg: '#be185d', bg: '#fff1f2', dot: 'rounded', chip: 'from-pink-500 to-rose-300' },
  { k: 'gold',     label: '渐变金',   desc: '方形 / 琥珀 · 米黄',      fg: '#b45309', bg: '#fffbeb', dot: 'square',  chip: 'from-amber-500 to-yellow-300' },
  { k: 'tech',     label: '科技青',   desc: '圆点 / 青蓝 · 冰白',      fg: '#0e7490', bg: '#ecfeff', dot: 'dot',     chip: 'from-cyan-600 to-sky-400' },
  { k: 'vintage',  label: '复古棕',   desc: '圆角 / 深棕 · 米杏',      fg: '#78350f', bg: '#fef3c7', dot: 'rounded', chip: 'from-amber-800 to-orange-400' },
];
function QrGeneratePanel({ options, update, disabled }: QrGeneratePanelProps) {
  const applyTemplate = (k: string) => {
    const tpl = QR_TEMPLATES.find(t => t.k === k);
    if (!tpl) return;
    update({ template: k, fgColor: tpl.fg, bgColor: tpl.bg, dotStyle: tpl.dot });
  };
  const contentLen = String(options?.content ?? '').length;
  return (
    <div className="space-y-4">
      {/* 内容输入 */}
      <div>
        <Field label="二维码内容（链接 / 文本 / 联系方式）" colSpan={1} hint="中文与英文均可，内容越长二维码越密建议提高容错等级">
          <textarea className="input min-h-[110px] font-mono text-xs sm:text-sm leading-5 resize-y"
            disabled={disabled}
            value={options?.content ?? ''}
            onChange={(e) => update({ content: e.target.value })}
            placeholder={'例如：\nhttps://mendfile.com\n公司：某某科技有限公司\n电话：400-000-0000\n邮箱：hi@mendfile.com'} />
          <div className="mt-1 text-[11px] text-slate-500">当前 {contentLen} 字符 · 建议普通 URL 文本 ≤ 500 字，H 级容错下汉字约 ≤ 180 字</div>
        </Field>
      </div>

      {/* 6 套模板卡片 */}
      <Field label="一键主题模板（点击自动应用配色与点样式）" colSpan={1}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {QR_TEMPLATES.map((tpl) => {
            const active = String(options?.template || 'default') === tpl.k;
            return (
              <button key={tpl.k} type="button" disabled={disabled} onClick={() => applyTemplate(tpl.k)}
                className={`text-left p-2.5 rounded-xl border transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  active ? 'border-brand-500 bg-brand-50/70 ring-2 ring-brand-300/40 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm'
                }`}>
                <div className={`w-full h-10 rounded-md mb-2 bg-gradient-to-br ${tpl.chip} relative overflow-hidden`} aria-hidden>
                  {/* 装饰点阵示意 */}
                  <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full opacity-40 mix-blend-overlay" fill="white" xmlns="http://www.w3.org/2000/svg">
                    {Array.from({ length: 8 * 8 }).map((_, i) => {
                      const r = i >> 3, c = i & 7; if (((r * 7 + c * 3) % 5) !== 0) return null;
                      return <rect key={i} x={4 + c * 4} y={4 + r * 4} width={3} height={3} rx={tpl.dot === 'dot' ? 2 : (tpl.dot === 'rounded' ? 1 : 0)} />;
                    })}
                  </svg>
                </div>
                <div className={`text-sm font-semibold ${active ? 'text-brand-700' : 'text-slate-800'}`}>{tpl.label}</div>
                <div className="text-[11px] text-slate-500 leading-4 mt-0.5">{tpl.desc}</div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* 尺寸 / 容错 / 颜色 / 样式 / 输出 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="容错等级" hint="H(30%) 支持覆盖最大面积 Logo">
          <select className="input" disabled={disabled} value={options?.ecLevel || 'M'}
            onChange={(e) => update({ ecLevel: e.target.value })}>
            <option value="L">L · 约 7%（最快 · 最小体积）</option>
            <option value="M">M · 约 15%（日常推荐）</option>
            <option value="Q">Q · 约 25%（较强容错）</option>
            <option value="H">H · 约 30%（加 Logo 请选此项）</option>
          </select>
        </Field>
        <Field label={`输出尺寸 ${Number(options?.size || 512)}×${Number(options?.size || 512)} px`}>
          <input type="range" min={128} max={2000} step={32}
            value={Number(options?.size || 512)}
            disabled={disabled}
            onChange={(e) => update({ size: Number(e.target.value) })} />
          <div className="flex justify-between text-[11px] text-slate-400 mt-1"><span>128</span><span>2000</span></div>
        </Field>
        <Field label="前景色 / 背景色">
          <div className="flex items-center gap-2 h-10">
            <input type="color" className="h-10 w-12 rounded-lg border border-slate-200 bg-white cursor-pointer"
              value={options?.fgColor || '#111827'} disabled={disabled}
              onChange={(e) => update({ fgColor: e.target.value })} />
            <span className="text-slate-400 text-sm">→</span>
            <input type="color" className="h-10 w-12 rounded-lg border border-slate-200 bg-white cursor-pointer"
              value={options?.bgColor || '#ffffff'} disabled={disabled}
              onChange={(e) => update({ bgColor: e.target.value })} />
          </div>
        </Field>
        <Field label="点阵样式">
          <select className="input" disabled={disabled} value={options?.dotStyle || 'square'}
            onChange={(e) => update({ dotStyle: e.target.value })}>
            <option value="square">■ 方形（经典）</option>
            <option value="rounded">▢ 圆角（柔和）</option>
            <option value="dot">● 圆点（活泼）</option>
          </select>
        </Field>
        <Field label="输出格式">
          <select className="input" disabled={disabled} value={options?.outputFormat || 'png'}
            onChange={(e) => update({ outputFormat: e.target.value })}>
            <option value="png">PNG 位图（通用易分享）</option>
            <option value="svg">SVG 矢量（无损放大 · 印刷推荐）</option>
          </select>
        </Field>
      </div>

      {/* Logo 叠加 */}
      <Field label="Logo 图片叠加（可选，居中 20% 区域）" colSpan={1}
        hint="建议容错等级设为 H，以保证识别率；Logo 过大会导致识别失败，建议使用简洁清晰的小图标。">
        <input type="file" accept="image/png,image/jpeg,image/webp" className="input" disabled={disabled}
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const d = await readAsDataURL(f);
            update({ logoDataURL: d });
          }} />
        {options?.logoDataURL ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5">
              <div className="w-14 h-14 grid place-items-center rounded-md border border-slate-200"
                style={{ background: options?.bgColor || '#fff' }}>
                <img src={options?.logoDataURL} alt="Logo 预览" className="max-w-10 max-h-10 object-contain" />
              </div>
              <div className="text-xs text-slate-600 leading-5">
                <div className="font-semibold text-slate-800">✅ Logo 已载入</div>
                <div>将居中叠加于二维码之上（约 22% 面积）</div>
                <button type="button" disabled={disabled}
                  onClick={() => update({ logoDataURL: '' })}
                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 disabled:opacity-50">
                  🗑 移除 Logo
                </button>
              </div>
            </div>
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-5 max-w-sm">
              ⚠️ 请在生成后用手机实际扫码验证。若识别失败请提升容错等级至 Q/H 或移除 Logo。
            </div>
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-slate-500">未选择 Logo 将输出纯净二维码。推荐 PNG 格式、圆形或方形透明图标、边长 ≥ 512 px。</div>
        )}
      </Field>
    </div>
  );
}
