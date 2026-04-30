import { useEffect, useRef, useState, type RefObject } from 'react';

type UseViewportMaskOptions = {
  containerRef: RefObject<HTMLElement | null>;
  isAuthView: boolean;
  enabled: boolean;
};

const ENTER_WIDTH_AUTH = 1280;
const EXIT_WIDTH_AUTH = 1320;
const ENTER_WIDTH_MAIN = 1020;
const EXIT_WIDTH_MAIN = 1060;
const ENTER_HEIGHT = 690;
const EXIT_HEIGHT = 730;
const OVERFLOW_EPS = 2;

function getViewportSize() {
  const vv = window.visualViewport;
  const root = document.documentElement;
  const width = Math.min(window.innerWidth || 0, root.clientWidth || 0, vv?.width ?? Number.POSITIVE_INFINITY);
  const height = Math.min(window.innerHeight || 0, root.clientHeight || 0, vv?.height ?? Number.POSITIVE_INFINITY);
  return { width: Number.isFinite(width) ? width : 0, height: Number.isFinite(height) ? height : 0 };
}

function hasHorizontalOverflow(container: HTMLElement | null): boolean {
  const root = document.documentElement;
  const rootOverflowX = root.scrollWidth - root.clientWidth > OVERFLOW_EPS;
  if (!container) return rootOverflowX;
  const containerOverflowX = container.scrollWidth - container.clientWidth > OVERFLOW_EPS;
  return rootOverflowX || containerOverflowX;
}

export function useViewportMask({ containerRef, isAuthView, enabled }: UseViewportMaskOptions) {
  const [showMask, setShowMask] = useState(false);
  const showMaskRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      showMaskRef.current = false;
      setShowMask(false);
      return;
    }
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    let raf = 0;

    const recalc = () => {
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

      if (next !== showMaskRef.current) {
        showMaskRef.current = next;
        setShowMask(next);
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
    if (containerRef.current) ro.observe(containerRef.current);
    ro.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [containerRef, isAuthView, enabled]);

  return showMask;
}
