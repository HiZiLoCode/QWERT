// theme.ts
import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material';

const UNIFIED_FONT_FAMILY =
    '"HarmonyOS Sans SC","Noto Sans SC",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif';

const TITLE_TYPOGRAPHY = {
    fontSize: '18px',
    fontWeight: 400,
    lineHeight: 1.5,
};

const BODY_TYPOGRAPHY = {
    fontSize: '20px',
    fontWeight: 400,
    lineHeight: 1.5,
};

/** 黑色主题：主底 / 卡片 / 键面 + 边框层级（与 globals.css 深色变量一致） */
export const DARK_APP = {
    bgMain: '#0B0B0C',
    bgPanel: '#1A1A1F',
    bgElevated: '#131316',
    /** 面板、侧栏、内容区外轮廓 */
    borderDefault: 'rgba(255, 255, 255, 0.14)',
    /** 弱分割、内嵌区域 */
    borderMuted: 'rgba(255, 255, 255, 0.09)',
    accent: '#F97316',
    accentHover: '#EA580C',
    textPrimary: '#F4F4F5',
    textSecondary: '#A1A1AA',
    divider: 'rgba(255, 255, 255, 0.11)',
} as const;

/** 浅色主题：与 palette 对齐，供 CSS 变量与非 MUI 区域复用 */
export const LIGHT_APP = {
    bgMain: '#ffffff',
    bgPanel: '#f5f5f5',
    bgElevated: '#ffffff',
    borderDefault: 'rgba(15, 23, 42, 0.12)',
    borderMuted: 'rgba(15, 23, 42, 0.07)',
    textPrimary: '#151515',
    textSecondary: '#4a4a4a',
    divider: 'rgba(15, 23, 42, 0.08)',
} as const;

declare module '@mui/material/styles' {
    interface TypeBackground {
        header?: string;
        footer?: string;
        sidebar?: string;
    }
    interface Palette {
        customed1: Palette['primary'];
        customed2: Palette['primary'];
        customed3: Palette['primary'];
        black: Palette['primary'];
        background: TypeBackground;
    }
    interface PaletteOptions {
        customed1?: PaletteOptions['primary'];
        customed2?: PaletteOptions['primary'];
        customed3?: PaletteOptions['primary'];
        black?: PaletteOptions['primary'];
    }
}

// Light 主题（保持现有明亮风格）
export const lightTheme: Theme = createTheme({
    spacing: (factor: number) => `${factor}px`,
    typography: {
        htmlFontSize: 16,
        fontFamily: UNIFIED_FONT_FAMILY,
        fontWeightRegular: 400,
        h1: TITLE_TYPOGRAPHY,
        h2: TITLE_TYPOGRAPHY,
        h3: TITLE_TYPOGRAPHY,
        h4: TITLE_TYPOGRAPHY,
        h5: TITLE_TYPOGRAPHY,
        h6: TITLE_TYPOGRAPHY,
        subtitle1: TITLE_TYPOGRAPHY,
        subtitle2: TITLE_TYPOGRAPHY,
        body1: BODY_TYPOGRAPHY,
        body2: BODY_TYPOGRAPHY,
        button: {
            ...BODY_TYPOGRAPHY,
            textTransform: 'none',
        },
        caption: BODY_TYPOGRAPHY,
        overline: BODY_TYPOGRAPHY,
    },
    palette: {
        mode: 'light',
        primary: {
            main: '#3B82F6',
        },
        secondary: {
            main: '#f50057',
        },
        background: {
            default: LIGHT_APP.bgMain,
            paper: LIGHT_APP.bgPanel,
            sidebar: '#e9e9f1',
        },
        customed1: {
            main: '#e9e9f1',
        },
        customed2: {
            main: '#ffffff',
        },
        customed3: {
            main: '#E8E8E8',
        },
        black: {
            main: '#151515',
        },
        text: {
            primary: '#151515',
            secondary: '#4a4a4a',
        },
        divider: LIGHT_APP.divider,
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    textOverflow: 'clip',
                    lineHeight: 1.4,
                    height: 'auto',
                    minHeight: '36px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                },
            },
        },
        MuiCssBaseline: {
            styleOverrides: {
                '*, *::before, *::after': {
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                },
                'div, span, p, label, button, a, li, td, th, .MuiTypography-root, .MuiButton-root, .MuiInputBase-input': {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                },
                body: {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '18px',
                    fontWeight: 400,
                    color: '#151515',
                },
                'h1, h2, h3, h4, h5, h6': {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#151515',
                },
                p: {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '20px',
                    fontWeight: 400,
                    color: '#151515',
                },
            },
        },
    },
});

// Dark 主题（黑色 + 橙色强调）
export const darkTheme: Theme = createTheme({
    spacing: (factor: number) => `${factor}px`,
    typography: {
        htmlFontSize: 16,
        fontFamily: UNIFIED_FONT_FAMILY,
        fontWeightRegular: 400,
        h1: TITLE_TYPOGRAPHY,
        h2: TITLE_TYPOGRAPHY,
        h3: TITLE_TYPOGRAPHY,
        h4: TITLE_TYPOGRAPHY,
        h5: TITLE_TYPOGRAPHY,
        h6: TITLE_TYPOGRAPHY,
        subtitle1: TITLE_TYPOGRAPHY,
        subtitle2: TITLE_TYPOGRAPHY,
        body1: { ...BODY_TYPOGRAPHY, fontSize: '18px', color: DARK_APP.textPrimary },
        body2: { ...BODY_TYPOGRAPHY, fontSize: '16px', color: DARK_APP.textSecondary },
        button: {
            ...BODY_TYPOGRAPHY,
            fontSize: '16px',
            textTransform: 'none',
        },
        caption: { ...BODY_TYPOGRAPHY, fontSize: '14px', color: DARK_APP.textSecondary },
        overline: TITLE_TYPOGRAPHY,
    },
    palette: {
        mode: 'dark',
        primary: {
            main: DARK_APP.accent,
            dark: DARK_APP.accentHover,
            light: '#FB923C',
            contrastText: '#FFFFFF',
        },
        secondary: {
            main: '#f48fb1',
        },
        background: {
            default: DARK_APP.bgMain,
            paper: DARK_APP.bgPanel,
            sidebar: DARK_APP.bgPanel,
        },
        customed1: {
            main: DARK_APP.bgElevated,
        },
        customed2: {
            main: DARK_APP.bgPanel,
        },
        customed3: {
            main: DARK_APP.bgElevated,
        },
        black: {
            main: DARK_APP.textPrimary,
        },
        text: {
            primary: DARK_APP.textPrimary,
            secondary: DARK_APP.textSecondary,
        },
        divider: DARK_APP.divider,
        action: {
            active: 'rgba(255,255,255,0.65)',
            hover: 'rgba(249, 115, 22, 0.12)',
            selected: 'rgba(249, 115, 22, 0.2)',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    textOverflow: 'clip',
                    lineHeight: 1.4,
                    height: 'auto',
                    minHeight: '36px',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiCssBaseline: {
            styleOverrides: {
                '*, *::before, *::after': {
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                },
                'div, span, p, label, button, a, li, td, th, .MuiTypography-root, .MuiButton-root, .MuiInputBase-input': {
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                },
                body: {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '18px',
                    fontWeight: 400,
                    color: DARK_APP.textPrimary,
                    backgroundColor: DARK_APP.bgMain,
                },
                'h1, h2, h3, h4, h5, h6': {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '18px',
                    fontWeight: 500,
                    color: DARK_APP.textPrimary,
                },
                p: {
                    fontFamily: UNIFIED_FONT_FAMILY,
                    fontSize: '18px',
                    fontWeight: 400,
                    color: DARK_APP.textPrimary,
                },
            },
        },
    },
});
