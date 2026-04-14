// theme.ts
import { createTheme } from '@mui/material/styles';
import { Theme } from '@mui/material';

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
  spacing: factor => `${0.0625 * factor}rem`, // 1 unit = 0.0625rem / 16
  typography: {
    htmlFontSize: 16, // base rem
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
  },
});

// Dark 主题
export const darkTheme: Theme = createTheme({
  spacing: factor => `${0.0625 * factor}rem`, // 1 unit = 0.0625rem / 16
  typography: {
    htmlFontSize: 16, // base rem
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
  },
});

