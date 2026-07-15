'use client';
// ThemeContextProvider.tsx
import React, { createContext, useState, useMemo, useContext, ReactNode, useEffect } from 'react';
import { ThemeProvider, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme, DARK_APP, LIGHT_APP } from './theme';
import UpgradeFlowLogPanel from '@/components/common/UpgradeFlowLogPanel';
interface ThemeContextType {
  toggleTheme: () => void;
  /** 直接设为明亮或深色（与切换等价，可幂等） */
  setThemeMode: (next: 'light' | 'dark') => void;
  mode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeContextProvider');
  }
  return context;
};

interface ThemeContextProviderProps {
  children: ReactNode;
}
// 直接获取 
let cachedTheme: 'light' | 'dark' | null = null;

const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  // 首屏与服务端保持一致，避免读取 localStorage 导致 hydration 不匹配（HeroSection 等）
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = localStorage.getItem('appTheme') as 'light' | 'dark' | null;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setMode(storedTheme);
      cachedTheme = storedTheme;
    }
  }, []);

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setThemeModeInternal(newMode);
  };

  const setThemeMode = (next: 'light' | 'dark') => {
    if (next === mode) return;
    setThemeModeInternal(next);
  };

  const setThemeModeInternal = (newMode: 'light' | 'dark') => {
    setMode(newMode);
    cachedTheme = newMode;
    if (typeof window !== 'undefined') {
      localStorage.setItem('appTheme', newMode);
    }
  };

  const theme: Theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-app-theme', mode);
    const app = mode === 'light' ? LIGHT_APP : DARK_APP;
    root.style.setProperty('--background', app.bgMain);
    root.style.setProperty('--foreground', app.textPrimary);
    root.style.setProperty('--surface-panel', app.bgPanel);
    root.style.setProperty('--surface-elevated', app.bgElevated);
    root.style.setProperty('--border-default', app.borderDefault);
    root.style.setProperty('--border-muted', app.borderMuted);
    root.style.setProperty('--divider', app.divider);
    root.style.setProperty('--key--color_accent', theme.palette.primary.main);
    root.style.setProperty(
      '--key--color_inside-accent',
      theme.palette.mode === 'dark' ? '#ffffff' : theme.palette.black.main,
    );
  }, [mode, theme]);
  return (
    <ThemeContext.Provider value={{ toggleTheme, setThemeMode, mode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
        <UpgradeFlowLogPanel />
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;
  