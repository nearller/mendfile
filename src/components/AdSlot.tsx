/**
 * 广告位组件：全站所有广告统一在此组件里配置，后期只需要在此处接入
 * 百度联盟 / Google AdSense / 自定义图片广告 等代码，业务页面无需任何改动。
 *
 * 每个广告位都配置了「占位外观 + data-ad-slot 属性」，上线前替换内部内容即可。
 */
interface Props {
  /** 广告位标识：footer / sidebar-top / sidebar-mid / in-feed-mobile / in-article */
  position: string;
  className?: string;
}

export default function AdSlot({ position, className = '' }: Props) {
  // TODO: 上线后接入真实广告代码，示例如下：
  // if (position === 'footer') return <ins className="adsbygoogle" style={{display:'block'}} data-ad-client="ca-pub-XXX" data-ad-slot="YYY" data-ad-format="auto" />;
  return (
    <div
      data-ad-slot={position}
      className={`relative w-full rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-slate-400 grid place-items-center p-4 text-xs overflow-hidden ${className}`}
    >
      <div className="text-center space-y-1">
        <div className="uppercase tracking-widest text-[10px]">Ad Slot · {position}</div>
        <div className="text-slate-400/80">
          {position.includes('sidebar') ? '侧边 · 静态广告位（300×250/300×600）' :
           position === 'footer' ? '页脚 · 静态广告位（728×90 / 通栏）' :
           position.includes('mobile') ? '移动端 · 信息流广告位' :
           '静态广告位预留'}
        </div>
        <div className="text-[10px] text-slate-400/70">
          合规广告 · 无弹窗 · 无悬浮 · 无自动播放
        </div>
      </div>
    </div>
  );
}
