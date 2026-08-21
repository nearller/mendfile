/**
 * ============================================================
 *  批次 6 · 云端增强双模式架构预留
 * ============================================================
 *  【架构预留说明】
 *  本文件仅搭建「入口 Banner + 授权弹窗 + 全局状态开关」的框架结构，
 *  暂不开发任何云端后台、付费功能、文件上传云端的真实逻辑。
 *  所有用户文件在当前版本依然 100% 纯浏览器本地处理。
 *  预留此结构的目的：未来在部署合规、拿到增值电信业务许可后，
 *  仅需在此处增加真正的云端 API 调用（替换 reservedCloudApiStub），
 *  无需改动业务页面的 UI 与授权流程。
 * ============================================================
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';

// --------- 类型定义 ---------
export interface CloudModeState {
  enabled: boolean;                    // 云端增强模式开关（预留：开启=未来走云端，当前仅 UI 切换）
  agreeTerms: boolean;                // 同意用户协议
  agreePrivacy: boolean;              // 同意隐私政策
  agreeTransmit: boolean;             // 同意文件传输到云端（仅预留，当前不会真的传输）
  agreeAge18: boolean;                // 同意本人年满 18 岁或监护人同意
  subscribeNews: boolean;             // 订阅上线通知（邮箱/短信，预留字段，当前不采集）
  openPopup: boolean;                 // 弹窗是否展示
}

interface CloudModeContextValue extends CloudModeState {
  setEnabled: (v: boolean) => void;
  patch: (patch: Partial<CloudModeState>) => void;
  openCloudModal: () => void;
  closeCloudModal: () => void;
  /**
   * ========== 预留 API ==========
   * 未来云端能力接入点：此处所有实现仅为占位 STUB。
   * 合规上线前置条件（必须全部满足后才可替换实现）：
   *   1. 完成 ICP 备案 + 增值电信业务（EDI/ICP 证）
   *   2. 部署独立的云端处理后端（含加密存储、审计日志）
   *   3. 签署第三方数据处理协议（DPA）
   *   4. 通过等保二级 / 三级测评
   *   5. 更新《隐私政策》《用户协议》关于云端章节并公示 30 天
   */
  reservedCloudApiStub: {
    uploadFile: (file: File) => Promise<never>;   // 预留上传
    runCloudTask: (taskId: string, payload: unknown) => Promise<never>; // 预留任务
    subscribeNotify: (email: string) => Promise<never>; // 预留订阅
  };
}

const STORAGE_KEY = 'mendfile.cloud-mode.reserved.v1';

const DEFAULT_STATE: CloudModeState = {
  enabled: false,
  agreeTerms: false,
  agreePrivacy: false,
  agreeTransmit: false,
  agreeAge18: false,
  subscribeNews: false,
  openPopup: false,
};

const CloudModeContext = createContext<CloudModeContextValue | null>(null);

// --------- Provider ---------
export function CloudModeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CloudModeState>(() => {
    if (typeof window === 'undefined') return DEFAULT_STATE;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...saved, openPopup: false };
      }
    } catch { /* ignore */ }
    return DEFAULT_STATE;
  });

  // 持久化（不存 openPopup）
  useEffect(() => {
    try {
      const { openPopup: _o, ...rest } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    } catch { /* ignore */ }
  }, [state]);

  const patch = useCallback((p: Partial<CloudModeState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);
  const setEnabled = useCallback((v: boolean) => {
    setState((s) => {
      if (v) {
        // 开启前必须先勾选 4 项核心授权；否则打开授权弹窗引导
        const ok = s.agreeTerms && s.agreePrivacy && s.agreeTransmit && s.agreeAge18;
        if (!ok) return { ...s, openPopup: true };
        return { ...s, enabled: true };
      }
      return { ...s, enabled: false };
    });
  }, []);
  const openCloudModal = useCallback(() => setState((s) => ({ ...s, openPopup: true })), []);
  const closeCloudModal = useCallback(() => setState((s) => ({ ...s, openPopup: false })), []);

  // ========== 预留云端 API（全部为占位错误，绝对不会发送任何网络请求）==========
  const reservedCloudApiStub = useMemo(() => ({
    uploadFile: (_file: File) => Promise.reject<never>(new Error('[CloudMode.Reserved] 云端模式暂未开放（架构预留）。请等待 MendFile 完成 ICP 经营许可后再使用。当前文件仍继续本地处理。')),
    runCloudTask: (_taskId: string, _payload: unknown) => Promise.reject<never>(new Error('[CloudMode.Reserved] 云端任务调度暂未开放（架构预留）。')),
    subscribeNotify: (_email: string) => Promise.reject<never>(new Error('[CloudMode.Reserved] 邮件/短信订阅通道暂未开放（架构预留）。')),
  }), []);

  const value: CloudModeContextValue = {
    ...state,
    setEnabled, patch, openCloudModal, closeCloudModal, reservedCloudApiStub,
  };
  return <CloudModeContext.Provider value={value}>{children}</CloudModeContext.Provider>;
}

// --------- Hook ---------
export function useCloudMode(): CloudModeContextValue {
  const ctx = useContext(CloudModeContext);
  if (!ctx) throw new Error('useCloudMode must be used within CloudModeProvider');
  return ctx;
}

// --------- 入口横幅（可嵌入 Header / SecurityBanner / 工具页）---------
export function CloudBannerEntry({ compact = false }: { compact?: boolean }) {
  const { enabled, openCloudModal } = useCloudMode();
  if (compact) {
    return (
      <button
        type="button"
        onClick={openCloudModal}
        className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/70 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 shadow-sm hover:shadow transition whitespace-nowrap"
        title="云端增强模式（架构预留 · 即将上线）"
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
        {enabled ? '云端增强 · ON（预留）' : '云端增强 · 预约'}
      </button>
    );
  }
  return (
    <div className="rounded-xl border border-violet-200/70 bg-gradient-to-r from-violet-50/80 via-fuchsia-50/60 to-indigo-50/60 px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white grid place-items-center text-sm shadow-sm">
          ☁️
        </div>
        <div className="text-sm leading-5">
          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
            云端增强双模式 <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500 text-white">架构预留</span>
          </div>
          <div className="text-xs text-slate-500">AI 抠图升级版、大文件压缩队列、多设备云端同步 · 即将上线（当前仅预留入口，不启用）</div>
        </div>
      </div>
      <button
        type="button"
        onClick={openCloudModal}
        className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
      >
        立即预约 / 授权
      </button>
    </div>
  );
}

// --------- 工具页内小提示条（当 enabled=true 时在工具页顶部显示，说明当前仍是本地处理）---------
export function CloudModeHintStrip() {
  const { enabled } = useCloudMode();
  if (!enabled) return null;
  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800 flex items-center gap-2 mb-4">
      <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
      <strong>云端增强模式：</strong>
      已开启预留开关。<em className="not-italic text-violet-700">本版本为架构预留，实际处理仍在您的浏览器本地执行，不会向任何服务器上传文件。</em>
      正式云端能力将在完成备案 + 资质许可后开放。
    </div>
  );
}

// --------- 授权弹窗主体（架构预留）---------
export function CloudReserveModal() {
  const {
    openPopup, enabled,
    agreeTerms, agreePrivacy, agreeTransmit, agreeAge18, subscribeNews,
    patch, setEnabled, closeCloudModal,
  } = useCloudMode();
  if (!openPopup) return null;

  const allChecked = agreeTerms && agreePrivacy && agreeTransmit && agreeAge18;
  const enable = () => {
    if (!allChecked) return;
    patch({ enabled: true });
    closeCloudModal();
  };
  const disable = () => {
    patch({ enabled: false });
    closeCloudModal();
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center p-4" role="dialog" aria-modal="true" aria-labelledby="cloud-reserve-title">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeCloudModal} />
      {/* 内容卡 */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* 头 */}
        <div className="px-6 py-4 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 grid place-items-center text-xl backdrop-blur">☁️</div>
            <div className="flex-1">
              <h2 id="cloud-reserve-title" className="text-lg font-semibold flex items-center gap-2">
                云端增强双模式授权 · 架构预留
                <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-white/20 border border-white/30">预约中 · 不启用</span>
              </h2>
              <p className="text-xs text-white/85 mt-0.5">预留云端 AI 抠图、批量队列、多端同步等能力。当前版本：全部本地处理，绝不上传。</p>
            </div>
            <button onClick={closeCloudModal} className="w-8 h-8 grid place-items-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition" aria-label="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* 双模式对比说明卡片 */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-2">
                💻 <span>本地模式（当前 · 默认启用）</span>
              </div>
              <ul className="space-y-1 text-xs text-emerald-900/80">
                <li>• 所有处理在您的浏览器本地完成</li>
                <li>• 文件不出本机，0 上传 0 留存</li>
                <li>• 免费无限次 · 无需登录</li>
                <li>• 大文件受本机内存限制</li>
              </ul>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <div className="font-semibold text-violet-800 flex items-center gap-1.5 mb-2">
                ☁️ <span>云端增强模式（预留 · 即将上线）</span>
              </div>
              <ul className="space-y-1 text-xs text-violet-900/80">
                <li>• AI 抠图神经网络模型（优于 Flood Fill）</li>
                <li>• 大文件压缩队列 / 后台异步跑完通知</li>
                <li>• 多设备进度同步 & 历史记录云盘</li>
                <li>• <span className="text-rose-600 font-medium">⚠️ 需文件上传云端处理</span></li>
              </ul>
            </div>
          </div>
        </div>

        {/* 合规边界与免责 */}
        <div className="px-6 pt-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800 leading-5">
            <p className="font-semibold mb-1">⚠️ 本版本云端模式为「架构预留」</p>
            <p>在 MendFile 官方完成 <strong>ICP 备案 + 增值电信业务许可证 + 等保测评 + 隐私政策更新公示</strong> 之前，
              云端模式<strong>不会真的发起任何网络请求、不会上传任何文件、不采集任何个人信息</strong>。
              开启开关仅为 UI 视觉切换，用于未来正式上线时授权流程复用。</p>
          </div>
        </div>

        {/* 授权勾选（顺序与合规要求一致） */}
        <div className="px-6 py-5 space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-700 pt-1">📝 开通云端增强模式请先阅读并同意（架构预留 · 仅保存到本地）：</h3>
          <AuthCheck label={<><strong>《MendFile 用户服务协议》</strong>（未来云端章节）· 我已阅读并同意</>}
            checked={agreeTerms} onChange={(v) => patch({ agreeTerms: v })} />
          <AuthCheck label={<><strong>《MendFile 隐私政策》</strong>云端处理章节 · 理解文件将在云端服务器解密与处理</>}
            checked={agreePrivacy} onChange={(v) => patch({ agreePrivacy: v })} />
          <AuthCheck label={<><strong>文件云端传输授权</strong> · 同意将我使用云端增强功能的文件通过 TLS 加密通道传输至 MendFile 官方服务器处理</>}
            checked={agreeTransmit} onChange={(v) => patch({ agreeTransmit: v })} />
          <AuthCheck label={<><strong>年龄/监护人确认</strong> · 本人年满 18 岁或已获得监护人同意使用云端服务</>}
            checked={agreeAge18} onChange={(v) => patch({ agreeAge18: v })} />
          <AuthCheck optional label={<>有新功能上线或云端正式开放时，通过邮件/短信通知我 <span className="text-slate-400">（当前不采集联系方式 · 仅保留勾选状态）</span></>}
            checked={subscribeNews} onChange={(v) => patch({ subscribeNews: v })} />
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            状态：{enabled ? <span className="text-violet-700 font-medium">云端增强模式（预留）已开启</span> : <span className="text-slate-600">本地纯前端模式</span>}
          </div>
          <div className="flex items-center gap-2">
            {enabled ? (
              <button onClick={disable}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition">
                切回纯本地模式
              </button>
            ) : (
              <button onClick={closeCloudModal}
                className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition">
                稍后再说
              </button>
            )}
            <button
              onClick={enable}
              disabled={!allChecked}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition ${
                allChecked
                  ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700'
                  : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {enabled ? '更新授权' : '同意并开启（预留）'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --------- 勾选框小组件 ---------
function AuthCheck({
  label, checked, onChange, optional,
}: {
  label: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; optional?: boolean;
}) {
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50/60 cursor-pointer transition">
      <input
        type="checkbox"
        className={`mt-0.5 rounded ${optional ? '' : 'accent-violet-600'}`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="text-xs leading-5 text-slate-700 flex-1">
        {!optional && <span className="text-rose-500 mr-1">* </span>}
        {label}
      </div>
    </label>
  );
}
