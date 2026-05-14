import { useEffect, useRef, useState, type RefObject } from 'react';

export type ViewportMaskKind = 'viewport-small';

export type ViewportMaskState = {
  show: boolean;
  kind: ViewportMaskKind | null;
};

type UseViewportMaskOptions = {
  containerRef: RefObject<HTMLElement | null>;
  /** 主界面为 false；仅在不使用 homeContentOverflowMode 时参与阈值 */
  isAuthView: boolean;
  enabled: boolean;
  /**
   * 首页（连接前）或「设置」页：用 visualViewport（无则 inner）与 HOME_MIN_* 比较；否则沿用主界面视口过小逻辑。
   */
  homeContentOverflowMode?: boolean;
};

/** 首页 / 设置页最小可视宽高（CSS px），与 `page.tsx` 首页 min-w 等设计对齐 */
const HOME_MIN_VIEWPORT_W = 1380;
const HOME_MIN_VIEWPORT_H = 740;
/** 关闭遮罩时略大于 MIN，减少在临界尺寸来回抖动 */
const HOME_VIEWPORT_EXIT_PAD_W = 40;
const HOME_VIEWPORT_EXIT_PAD_H = 32;

/** 授权页：视口宽度 ≤ 此值视为过窄，与高度、overflow 一起可触发「窗口过小」遮罩 */
const ENTER_WIDTH_AUTH = 1080;
/** 授权页：宽度 ≥ 此值且满足 recovered 条件后才关闭遮罩（与 ENTER 滞回，减少抖动） */
const EXIT_WIDTH_AUTH = 1160;
/** 主界面（改键/灯光/设置等）：宽度 ≤ 此值视为过窄，与 overflow、高度为「或」关系触发遮罩 */
const ENTER_WIDTH_MAIN = 1340;
const EXIT_WIDTH_MAIN = 1380;
/** 视口高度 ≤ 此值视为过矮，参与触发遮罩 */
const ENTER_HEIGHT = 690;
/** 视口高度 ≥ 此值才认为高度已恢复，配合宽度与 overflow 关闭遮罩 */
const EXIT_HEIGHT = 730;
/** 判断横向是否溢出时允许的像素容差，避免 scrollWidth≈clientWidth 的取整抖动 */
const OVERFLOW_EPS = 2;

function getViewportSize() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const width = Math.min(window.innerWidth || 0, root.clientWidth || 0, vv?.width ?? Number.POSITIVE_INFINITY);
  const height = Math.min(window.innerHeight || 0, root.clientHeight || 0, vv?.height ?? Number.POSITIVE_INFINITY);
  return { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0 };
}

/** 首页：优先 visualViewport；无有效值则用 innerWidth / innerHeight */
function getHomeViewportLayoutSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return { width: vv.width, height: vv.height };
  }
  return {
    width: window.innerWidth || 0,
    height: window.innerHeight || 0,
  };
}

function hasHorizontalOverflow(container: HTMLElement | null): boolean {
  const root = document.documentElement;
  const rootOverflowX = root.scrollWidth - root.clientWidth > OVERFLOW_EPS;
  if (!container) return rootOverflowX;
  const containerOverflowX = container.scrollWidth - container.clientWidth > OVERFLOW_EPS;
  return rootOverflowX || containerOverflowX;
}

export function useViewportMask({
  containerRef,
  isAuthView,
  enabled,
  homeContentOverflowMode = false,
}: UseViewportMaskOptions): ViewportMaskState {
  const [mask, setMask] = useState<ViewportMaskState>({ show: false, kind: null });
  const showMaskRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      showMaskRef.current = false;
      setMask({ show: false, kind: null });
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    let raf = 0;

    const recalc = () => {
      if (homeContentOverflowMode) {
        const { width, height } = getHomeViewportLayoutSize();
        const enter = width < HOME_MIN_VIEWPORT_W || height < HOME_MIN_VIEWPORT_H;
        const exitOk =
          width >= HOME_MIN_VIEWPORT_W + HOME_VIEWPORT_EXIT_PAD_W &&
          height >= HOME_MIN_VIEWPORT_H + HOME_VIEWPORT_EXIT_PAD_H;

        let next = showMaskRef.current;
        if (!showMaskRef.current) {
          next = enter;
        } else {
          next = !exitOk;
        }

        const kind: ViewportMaskKind | null = next ? 'viewport-small' : null;
        if (next !== showMaskRef.current) {
          showMaskRef.current = next;
          setMask({ show: next, kind });
        }
        return;
      }

      const { width, height } = getViewportSize();
      const overflowX = hasHorizontalOverflow(containerRef.current);
      const enterW = isAuthView ? ENTER_WIDTH_AUTH : ENTER_WIDTH_MAIN;
      const exitW = isAuthView ? EXIT_WIDTH_AUTH : EXIT_WIDTH_MAIN;
      const hitBySize = width <= enterW || height <= ENTER_HEIGHT;

      let next = showMaskRef.current;
      if (!showMaskRef.current) {
        // 授权页可直接按阈值；主界面需要“尺寸不足 + 横向挤压”同时命中，避免过早遮罩。
        next = isAuthView ? overflowX || hitBySize : overflowX && hitBySize;
      } else {
        const clearBySize = width >= exitW && height >= EXIT_HEIGHT;
        // 退出时优先看“尺寸是否回到安全区”，避免被轻微/持续 overflow 卡住无法取消。
        next = overflowX && !clearBySize;
      }

      const kind: ViewportMaskKind | null = next ? 'viewport-small' : null;
      if (next !== showMaskRef.current) {
        showMaskRef.current = next;
        setMask({ show: next, kind });
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(recalc);
    };

    schedule();

    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);

    const ro = new ResizeObserver(schedule);
    const el = containerRef.current;
    if (el) {
      ro.observe(el);
      const first = el.firstElementChild;
      if (first instanceof HTMLElement) ro.observe(first);
    }
    ro.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [containerRef, isAuthView, enabled, homeContentOverflowMode]);

  return mask;
}
