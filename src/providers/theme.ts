// theme.ts
import { createTheme } from '@mui/material/styles';
import { Theme } from '@mui/material';

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
    black: PaletteOptions['primary'];
  }
}

// Light 主题
export const lightTheme: Theme = createTheme({
  spacing: (factor: number) => `${factor}px`, // 1 unit = 1px（与原先 1px @16px 根字号等价）
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
      main: '#1976d2',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5',
      sidebar: "#e9e9f1", // 新增的背景颜色示例：Sidebar区域
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
      main: '#151515'
    },
    text: {
      primary: '#151515',
      secondary: '#4a4a4a',
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
        'p': {
          fontFamily: UNIFIED_FONT_FAMILY,
          fontSize: '20px',
          fontWeight: 400,
          color: '#151515',
        },
      },
    },
  },
});

// Dark 主题
export const darkTheme: Theme = createTheme({
  spacing: (factor: number) => `${factor}px`, // 1 unit = 1px（与原先 1px @16px 根字号等价）
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
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#424242',
      sidebar: '#1e1e2d'
    },
    customed1: {
      main: '#e9e9f1',
    },
    customed2: {
      main: '#000',
    },
    customed3: {
      main: '#606060',
    },
    black: {
      main: '#fff'
    },
    text: {
      primary: '#ffffff',
      secondary: '#c7c7c7',
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
          fontSize: '20px',
          fontWeight: 400,
          color: '#ffffff',
        },
        'h1, h2, h3, h4, h5, h6': {
          fontFamily: UNIFIED_FONT_FAMILY,
          fontSize: '18px',
          fontWeight: 400,
          color: '#ffffff',
        },
        'p': {
          fontFamily: UNIFIED_FONT_FAMILY,
          fontSize: '20px',
          fontWeight: 400,
          color: '#151515',
        },
      },
    },
  },
});

