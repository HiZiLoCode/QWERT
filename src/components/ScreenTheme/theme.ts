import type { PaletteMode } from '@mui/material';

/** 屏幕主题页专用视觉令牌（与全局 MUI 深浅模式联动） */
export type ScreenThemeVisualColors = {
    primary: string;
    primaryHover: string;
    /** 实心按钮投影 */
    filledShadow: string;
    filledShadowHover: string;
    /** 药丸 / Select 光晕 */
    primaryGlow: string;
    primarySoft: string;
    pageBg: string;
    cardBg: string;
    sidebarBg: string;
    /** 侧栏外框：亮色无描边，深色橙边 */
    sidebarBorder: string;
    boxShadow: string;
    border: string;
    borderLight: string;
    /** 大内容区描边 */
    panelBorder: string;
    textMuted: string;
    textDark: string;
    selectBg: string;
    /** Select 键盘焦点浅底 */
    selectFocusBg: string;
    /** 描边药丸默认底（导入 / 侧栏非选中） */
    pillOutlinedBg: string;
    /** 预览区外框底 */
    previewOuterBg: string;
    previewInnerBg: string;
    /** 预览裁切虚线 */
    previewCropDash: string;
};

export const SCREEN_THEME_LIGHT: ScreenThemeVisualColors = {
    primary: 'rgba(0, 102, 255, 1)',
    primaryHover: 'rgba(0, 102, 255, 0.92)',
    filledShadow: '0 4px 12px rgba(0, 102, 255, 0.38)',
    filledShadowHover: '0 5px 14px rgba(0, 102, 255, 0.45)',
    primaryGlow: 'rgba(0, 102, 255, 0.22)',
    primarySoft: 'rgba(0, 102, 255, 0.35)',
    pageBg: '#eef0f4',
    cardBg: '#ffffff',
    sidebarBg: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
    border: '1px solid #e5edf7',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05);',
    sidebarBorder: '1px solid #e5e7eb',
    borderLight: 'rgba(181, 187, 196, 0.6)',
    panelBorder: 'rgba(181,187,196,0.32)',
    textMuted: 'rgba(100, 106, 115, 1)',
    textDark: 'rgba(40, 44, 52, 1)',
    selectBg: '#ffffff',
    selectFocusBg: 'rgba(0, 102, 255, 0.08)',
    pillOutlinedBg: '#ffffff',
    previewOuterBg: 'rgba(255, 255, 255, 0.72)',
    previewInnerBg: 'rgba(248, 250, 252, 0.98)',
    previewCropDash: 'rgba(0, 0, 0, 0.72)',
};

/** 深色：橙主色 + 橙描边（与设计稿一致） */
export const SCREEN_THEME_DARK: ScreenThemeVisualColors = {
    primary: '#F97316',
    primaryHover: '#EA580C',
    filledShadow: '0 4px 12px rgba(249, 115, 22, 0.38)',
    filledShadowHover: '0 5px 14px rgba(249, 115, 22, 0.48)',
    primaryGlow: 'rgba(249, 115, 22, 0.28)',
    primarySoft: 'rgba(249, 115, 22, 0.45)',
    pageBg: '#0B0B0C',
    cardBg: '#1A1A1F',
    sidebarBg: '#17171C',
    sidebarBorder: '1px solid rgba(249, 115, 22, 0.58)',
    border: 'rgba(249, 115, 22, 0.58)',
    borderLight: 'rgba(249, 115, 22, 0.38)',
    panelBorder: 'rgba(249, 115, 22, 0.52)',
    textMuted: '#A1A1AA',
    textDark: '#F4F4F5',
    selectBg: '#131316',
    boxShadow:'',
    selectFocusBg: 'rgba(249, 115, 22, 0.12)',
    pillOutlinedBg: '#25252C',
    previewOuterBg: 'rgba(26, 26, 31, 0.92)',
    previewInnerBg: 'rgba(22, 22, 28, 0.98)',
    previewCropDash: 'rgba(255, 255, 255, 0.52)',
};

export function getScreenThemeColors(mode: PaletteMode): ScreenThemeVisualColors {
    return mode === 'dark' ? SCREEN_THEME_DARK : SCREEN_THEME_LIGHT;
}

/** 兼容旧引用：未包 Provider 时等同浅色 */
export const screenThemeColors = SCREEN_THEME_LIGHT;
