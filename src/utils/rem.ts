// rem-adapter.ts
export function setRemBase(designWidth = 1920) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  const docEl = document.documentElement;
  const resizeEvt = 'orientationchange' in window ? 'orientationchange' : 'resize';

  const recalc = () => {
    const clientWidth = docEl.clientWidth;
    if (!clientWidth) return;
    const fontSize = 16 * (clientWidth / designWidth);
    docEl.style.fontSize = fontSize + 'px';
  };

  window.addEventListener(resizeEvt, recalc, false);
  document.addEventListener('DOMContentLoaded', recalc, false);
  recalc(); // 初始化
}
