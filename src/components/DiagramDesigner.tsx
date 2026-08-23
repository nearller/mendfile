/**
 * 通用在线设计器：流程图 / 平面图 / 时序图 共享同一个 Canvas 编辑器组件
 * 基于 @excalidraw/excalidraw：
 *   - 左工具栏：选择 / 矩形 / 菱形 / 圆 / 箭头 / 文字 / 自由画笔 / 橡皮擦 / 图片
 *   - 顶部自定义工具栏：保存 JSON / 导入 JSON / 导出 PNG / 导出 JPG / 导出 PDF / 清空
 *   - localStorage 草稿自动保存（按 toolKey 区分不互串）
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
// 注意：Excalidraw v0.17 的 CSS 已打包进 dist/excalidraw.*.js，运行时自动以 <style> 注入到页面 head
// 因此不需要额外单独 import index.css
import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import {
  saveDiagramJson,
  loadDiagramJson,
  loadDiagramDraft,
  saveDiagramDraft,
  clearDiagramDraft,
  exportDiagramImage,
  exportDiagramPdf,
  exportDiagramSvg,
  type DiagramScene,
  type ExcalidrawRefAPI,
} from '@/core/diagram';
import { formatBytes } from '@/core/utils';

export type DiagramToolPreset = 'flowchart' | 'floorplan' | 'sequence';

export interface DiagramDesignerProps {
  toolKey: string;
  toolName: string;
  /** 建议输出文件名（不含扩展名） */
  outputFileName?: string;
  /** 起始画布尺寸比例 */
  aspect?: '16:9' | '4:3' | 'A4';
}

const PRESET_HELP: Record<DiagramToolPreset, { title: string; tips: string }> = {
  flowchart: {
    title: '流程图设计 · 上手建议',
    tips: '使用左侧工具栏：圆角矩形（开始/结束）、矩形（步骤）、菱形（判断）、平行四边形（输入/输出）+ 箭头连接；拖拽选中可批量移动；Ctrl/Cmd + Z 撤销。',
  },
  floorplan: {
    title: '平面图设计 · 上手建议',
    tips: '用矩形/直线画墙体和房间轮廓；按住 Shift 画正方形 / 水平垂直线；文本标签标注尺寸、名称；图片按钮可插入家具/卫浴/门窗等素材图。',
  },
  sequence: {
    title: '时序图设计 · 上手建议',
    tips: '用文本框列出参与者（从左到右）；细直线画生命线；箭头工具画调用消息（实线）和返回消息（虚线）；用标签写消息名；矩形覆盖生命线上可画激活条。',
  },
};

const presetOfToolKey = (toolKey: string): DiagramToolPreset => {
  if (toolKey.includes('flow')) return 'flowchart';
  if (toolKey.includes('floor') || toolKey.includes('plane')) return 'floorplan';
  if (toolKey.includes('sequence') || toolKey.includes('time')) return 'sequence';
  return 'flowchart';
};

export const DiagramDesigner: React.FC<DiagramDesignerProps> = ({
  toolKey,
  toolName,
  outputFileName,
}) => {
  const preset = presetOfToolKey(toolKey);
  const help = PRESET_HELP[preset];
  const suggestedBase = outputFileName || `MendFile_${toolName}`;

  // —— Excalidraw ref：包成 `as any` 组件，避免 TS Memo 类型未带 ref 属性导致的报错（运行时实际支持 ref）
  const AnyExcalidraw = Excalidraw as any;
  const excalidrawRef = useRef<any>(null);
  const apiRef = useRef<ExcalidrawRefAPI | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const [savedDraftAt, setSavedDraftAt] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('编辑器加载中…');
  const [statusType, setStatusType] = useState<'info' | 'ok' | 'error'>('info');

  const flashStatus = useCallback((msg: string, type: 'info' | 'ok' | 'error' = 'ok', ms = 2800) => {
    setStatusMsg(msg);
    setStatusType(type);
    if (ms > 0) window.setTimeout(() => { /* 等下一个消息覆盖，或恢复为草稿状态 */ }, ms);
  }, []);

  const getApi = useCallback((): ExcalidrawRefAPI => {
    if (apiRef.current) return apiRef.current;
    // 组件 ref.current 实际就是 ExcalidrawAPI 实例（有 getSceneElements / getAppState / resetScene 等）
    const r = excalidrawRef.current as any;
    const api: ExcalidrawRefAPI = {
      getSceneElements: () => (r?.getSceneElements?.() ?? []) as readonly ExcalidrawElement[],
      getAppState: () => (r?.getAppState?.() ?? {}) as any,
      getFiles: () => (r?.getFiles?.() ?? {}) as any,
      updateScene: (opts) => r?.updateScene?.(opts),
      resetScene: (opts) => r?.resetScene?.(opts ?? {}),
      setActiveTool: (tool) => r?.setActiveTool?.(tool),
      clearSelection: () => r?.clearSelection?.(),
    };
    apiRef.current = api;
    return api;
  }, []);

  /** 防抖写入草稿（节流 1.2s） */
  const draftTimer = useRef<number | null>(null);
  const scheduleSaveDraft = useCallback(() => {
    if (draftTimer.current) window.clearTimeout(draftTimer.current);
    draftTimer.current = window.setTimeout(() => {
      try {
        const api = getApi();
        saveDiagramDraft(toolKey, api);
        const now = new Date();
        setSavedDraftAt(now);
        setHasDraft(api.getSceneElements().length > 0);
        setStatusMsg(
          api.getSceneElements().length > 0
            ? `草稿已自动保存（本地浏览器，${now.toLocaleTimeString('zh-CN')}）`
            : '画布为空，暂未写入草稿',
        );
        setStatusType('info');
      } catch (e) {
        /* ignore */
      }
    }, 1200);
  }, [getApi, toolKey]);

  // —— 首次挂载：加载草稿
  useEffect(() => {
    let alive = true;
    (async () => {
      const draft = await loadDiagramDraft(toolKey);
      if (!alive) return;
      try {
        const api = getApi();
        if (draft && draft.elements && draft.elements.length > 0) {
          // 把草稿写入画布（通过 updateScene(elements, appState, files)）
          api.updateScene({
            elements: draft.elements,
            appState: draft.appState,
            files: draft.files,
          });
          setHasDraft(true);
          setSavedDraftAt(new Date());
          flashStatus(`已恢复上次未完成的 ${toolName} 草稿（共 ${draft.elements.length} 个元素）`, 'info', 3500);
        } else {
          setHasDraft(false);
          flashStatus('全新空白画布；已开启草稿自动保存，误关页不丢失', 'info', 3000);
        }
      } catch (e) {
        flashStatus(`草稿恢复失败：${(e as Error).message}`, 'error');
      }
    })();
    return () => { alive = false; if (draftTimer.current) window.clearTimeout(draftTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolKey]);

  // —— 工具栏动作
  const onSaveJson = () => {
    try {
      const api = getApi();
      if (api.getSceneElements().length === 0) {
        flashStatus('画布为空，暂无需保存', 'info');
        return;
      }
      saveDiagramJson(toolKey, api, suggestedBase);
      flashStatus('✅ 工程 JSON 已下载到本地（下次可用「导入 JSON」继续编辑）', 'ok');
    } catch (e) {
      flashStatus(`保存失败：${(e as Error).message}`, 'error');
    }
  };

  const onImportJson = () => jsonInputRef.current?.click();

  const handleJsonFileChosen: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const scene: DiagramScene = await loadDiagramJson(file);
      const api = getApi();
      api.updateScene({
        elements: scene.elements,
        appState: scene.appState,
        files: scene.files,
      });
      flashStatus(
        `✅ 已导入工程：${file.name}（${formatBytes(file.size)}，共 ${scene.elements.length} 个元素）`,
        'ok',
        3200,
      );
      scheduleSaveDraft();
    } catch (err) {
      flashStatus(`导入失败：${(err as Error).message}`, 'error', 4200);
    }
  };

  const onExportPng = () => {
    const api = getApi();
    if (api.getSceneElements().length === 0) { flashStatus('画布为空，先画点内容再导出', 'info'); return; }
    exportDiagramImage('png', api, suggestedBase).then(
      () => flashStatus('✅ PNG 已下载（高清 2x 缩放，透明背景）', 'ok'),
      (e) => flashStatus(`PNG 导出失败：${e.message}`, 'error'),
    );
  };
  const onExportJpg = () => {
    const api = getApi();
    if (api.getSceneElements().length === 0) { flashStatus('画布为空，先画点内容再导出', 'info'); return; }
    exportDiagramImage('jpg', api, suggestedBase).then(
      () => flashStatus('✅ JPG 已下载（白色背景，适合打印/传阅）', 'ok'),
      (e) => flashStatus(`JPG 导出失败：${e.message}`, 'error'),
    );
  };
  const onExportPdf = () => {
    const api = getApi();
    if (api.getSceneElements().length === 0) { flashStatus('画布为空，先画点内容再导出', 'info'); return; }
    flashStatus('PDF 生成中…（高清渲染嵌入）', 'info', 0);
    exportDiagramPdf(api, suggestedBase).then(
      () => flashStatus('✅ PDF 已下载（所见即所得，适合存档/分享）', 'ok'),
      (e) => flashStatus(`PDF 导出失败：${e.message}`, 'error'),
    );
  };
  const onExportSvg = () => {
    const api = getApi();
    if (api.getSceneElements().length === 0) { flashStatus('画布为空，先画点内容再导出', 'info'); return; }
    exportDiagramSvg(api, suggestedBase).then(
      () => flashStatus('✅ SVG 矢量图已下载（可二次编辑，无损放大）', 'ok'),
      (e) => flashStatus(`SVG 导出失败：${e.message}`, 'error'),
    );
  };
  const onReset = () => {
    const api = getApi();
    if (api.getSceneElements().length === 0) { flashStatus('画布已是空白', 'info'); return; }
    const ok = window.confirm(
      `确定清空当前画布？\n\n可以先点「保存 JSON」保留工程，清空后草稿也会一并清除。`,
    );
    if (!ok) return;
    api.resetScene({ confirm: false });
    clearDiagramDraft(toolKey);
    setHasDraft(false);
    setSavedDraftAt(null);
    flashStatus('画布已清空', 'info');
  };

  const statusClasses = useMemo(() => {
    switch (statusType) {
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      case 'ok':    return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default:      return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  }, [statusType]);

  return (
    <div className="space-y-3">
      {/* 顶部工具栏：与现有工具页 UI 风格一致，白底卡片 + 圆角 + 按钮分主次 */}
      <div className="card !p-3 sm:!p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* 左：按钮组（保存 / 导入 / 清空） */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={onSaveJson}>
              💾 保存工程 JSON
            </button>
            <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={onImportJson}>
              📥 导入 JSON
            </button>
            <input
              ref={jsonInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleJsonFileChosen}
            />
            <span className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
            <button type="button" className="btn-ghost !px-3 !py-2 text-sm text-slate-500 hover:!text-slate-800 hover:!bg-slate-100"
              onClick={onReset}
              title="清空当前画布并删除草稿">
              🗑️ 清空画布
            </button>
          </div>

          {/* 中：状态条（草稿自动保存） */}
          <div className={`flex-1 min-w-0 mx-0 lg:mx-4 px-3 py-2 rounded-lg border text-xs flex items-center gap-2 ${statusClasses}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${hasDraft ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="truncate">{statusMsg}</span>
            {savedDraftAt && (
              <span className="shrink-0 text-[10px] opacity-70 ml-auto hidden sm:inline">
                草稿上次保存：{savedDraftAt.toLocaleTimeString('zh-CN')}
              </span>
            )}
          </div>

          {/* 右：导出按钮组（PNG/JPG/PDF 常用，SVG 次级） */}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={onExportSvg}>
              🎨 SVG
            </button>
            <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={onExportJpg}>
              🖼️ JPG
            </button>
            <button type="button" className="btn-secondary !px-3 !py-2 text-sm" onClick={onExportPng}>
              🖼️ PNG
            </button>
            <button type="button" className="btn-primary !px-3.5 !py-2 text-sm" onClick={onExportPdf}>
              📄 导出 PDF
            </button>
          </div>
        </div>

        {/* 工具入门提示：一行小字，需要时展开 */}
        <details className="mt-3 text-xs text-slate-500 select-auto rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
          <summary className="cursor-pointer hover:text-slate-700 flex items-center gap-2">
            💡 {help.title}（点击展开）
          </summary>
          <div className="mt-2 leading-5 text-slate-600">
            {help.tips}
            <br />
            <span className="text-slate-500">
              💡 保存 JSON 到本地 → 以后任意时刻「导入 JSON」即可继续编辑；支持多人互相传阅工程文件。
              全程浏览器本地画布，不上传任何文件与内容。默认开启草稿自动保存（按「{toolKey}」分别保存，三个工具互不影响）。
            </span>
          </div>
        </details>
      </div>

      {/* 主体：Excalidraw 画布。高度采用自适应：桌面固定 640px，移动端 70vh，用户可以用工具栏缩放 */}
      <div
        id={`excalidraw-container-${toolKey}`}
        className="card !p-0 overflow-hidden"
        style={{ height: 'min(78vh, 820px)', minHeight: 520 }}
      >
        <AnyExcalidraw
          ref={excalidrawRef}
          onChange={() => scheduleSaveDraft()}
          initialData={{
            elements: [],
            appState: { viewBackgroundColor: '#fafafa' },
            scrollToContent: true,
          }}
          detectScroll={false}
          UIOptions={{
            canvasActions: {
              export: { saveFileToDisk: false }, // 用我们自定义的导出按钮组
              saveToActiveFile: false,
              toggleTheme: true,
              saveAsImage: true, // 保留画布右下角内置导出图（作为备用）
              loadScene: false,
            },
            tools: {
              image: true,
            },
          }}
          zenModeEnabled={false}
          gridModeEnabled
          name={toolName}
        />
      </div>
    </div>
  );
};

export default DiagramDesigner;
