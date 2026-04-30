// rem-adapter：按设计稿宽度等比缩放 html 根字号。designWidth 必须为固定设计稿（如 1920），
// 切勿传入 screen.width，否则小屏设备分母变小，根字号会异常偏大。
const DEFAULT_DESIGN_WIDTH = 1920;

/** 默认全局视觉缩放（<1 更小）；无规则命中时使用 */
const REM_VISUAL_SCALE = 0.82;

/**
 * 按「物理屏」单独覆盖缩放（用 window.screen，与浏览器窗口宽度无关）。
 * 从上到下匹配第一条：用 min/max 包一段范围，避免个别显卡报 3432 等与标称差几像素。
 * 需要再加显示器：往数组前面插更具体的规则即可。
 */
export const REM_VISUAL_SCALE_RULES: Array<{
  minScreenW?: number;
  maxScreenW?: number;
  minScreenH?: number;
  maxScreenH?: number;
  scale: number;
}> = [
    // 3440×1440 带鱼示例：按需改 scale（可先试 0.68～0.75）
    { minScreenW: 3360, maxScreenW: 3840, minScreenH: 1300, maxScreenH: 1520, scale: 1 },
  ];

function screenMatches(
  sw: number,
  sh: number,
  rule: (typeof REM_VISUAL_SCALE_RULES)[number]
): boolean {
  if (rule.minScreenW != null && sw < rule.minScreenW) return false;
  if (rule.maxScreenW != null && sw > rule.maxScreenW) return false;
  if (rule.minScreenH != null && sh < rule.minScreenH) return false;
  if (rule.maxScreenH != null && sh > rule.maxScreenH) return false;
  return true;
}

function resolveVisualScale(visualScaleOverride?: number): number {
  if (visualScaleOverride != null) return visualScaleOverride;
  const sw = typeof window !== 'undefined' ? window.screen?.width ?? 0 : 0;
  const sh = typeof window !== 'undefined' ? window.screen?.height ?? 0 : 0;
  for (const rule of REM_VISUAL_SCALE_RULES) {
    if (screenMatches(sw, sh, rule)) return rule.scale;
  }
  return REM_VISUAL_SCALE;
}

/**
 * 供 RootLayout `<head>` 内联执行：在首帧绘制前按与 setRemBase 相同公式设 html 字号，避免 globals 18px 闪一下再变小。
 * 不注册 resize；由客户端 setRemBase 接管监听与后续重算。
 */
export function getRemBootstrapOneShotInlineScript(): string {
  const R = JSON.stringify(REM_VISUAL_SCALE_RULES);
  return `(function(){var R=${R},D=${REM_VISUAL_SCALE},DefW=${DEFAULT_DESIGN_WIDTH};function sm(sw,sh,r){if(r.minScreenW!=null&&sw<r.minScreenW)return false;if(r.maxScreenW!=null&&sw>r.maxScreenW)return false;if(r.minScreenH!=null&&sh<r.minScreenH)return false;if(r.maxScreenH!=null&&sh>r.maxScreenH)return false;return true}function rs(sw,sh){for(var i=0;i<R.length;i++){if(sm(sw,sh,R[i]))return R[i].scale}return D}var dw=screen.width||DefW,sh0=screen.height||0,sc=rs(dw,sh0),el=document.documentElement,cw=el.clientWidth||window.innerWidth||0;if(cw)el.style.fontSize=(16*(cw/dw)*sc)+"px"})();`;
}

export function setRemBase(
  designWidth: number = DEFAULT_DESIGN_WIDTH,
  options?: {
    minRootFontPx?: number;
    maxRootFontPx?: number;
    /** 强制覆盖：忽略 REM_VISUAL_SCALE 与 REM_VISUAL_SCALE_RULES */
    visualScale?: number;
  }
): (() => void) | undefined {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const docEl = document.documentElement;
  const resizeEvt = 'orientationchange' in window ? 'orientationchange' : 'resize';
  const { minRootFontPx, maxRootFontPx, visualScale } = options ?? {};

  const recalc = () => {
    const clientWidth = docEl.clientWidth;
    if (!clientWidth) return;
    const scale = resolveVisualScale(visualScale);
    let fontSize = 16 * (clientWidth / designWidth) * scale;
    if (minRootFontPx != null) fontSize = Math.max(minRootFontPx, fontSize);
    if (maxRootFontPx != null) fontSize = Math.min(maxRootFontPx, fontSize);
    docEl.style.fontSize = `${fontSize}px`;
  };

  window.addEventListener(resizeEvt, recalc, false);
  recalc();

  return () => {
    window.removeEventListener(resizeEvt, recalc, false);
    docEl.style.fontSize = '';
  };
}
