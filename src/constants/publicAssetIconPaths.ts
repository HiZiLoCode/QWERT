import customKeys from '@/data/customkeys.json';

/** 首屏侧栏、Logo 等关键 UI 图标（优先预加载） */
export const CRITICAL_UI_ICON_PATHS = [
  '/qk-text-logo.svg',
  '/QKlogo.png.svg',
  '/sidebar/menu-keyboard.svg',
  '/sidebar/menu-test.svg',
  '/sidebar/menu-settings.svg',
  '/sidebar/setting-keypress.svg',
  '/sidebar/setting-layout.svg',
  '/sidebar/setting-lighting.svg',
  '/sidebar/setting-logolighting.svg',
  '/sidebar/setting-led.svg',
  '/sidebar/setting-matrix.svg',
  '/sidebar/setting-test.svg',
] as const;

/** `customkeys.json` 中所有键位池 / 映射用图标路径（去重） */
export const KEY_TYPE_ICON_PATHS: string[] = (() => {
  const paths = new Set<string>();
  for (const group of customKeys as { keycodes?: { icon?: string }[] }[]) {
    for (const item of group?.keycodes ?? []) {
      const icon = typeof item?.icon === 'string' ? item.icon.trim() : '';
      if (!icon) continue;
      if (icon.startsWith('/KeyType/') || icon.endsWith('.svg') || icon.endsWith('.png')) {
        paths.add(icon);
      }
    }
  }
  return [...paths];
})();
