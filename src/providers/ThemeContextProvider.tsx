'use client';
// ThemeContextProvider.tsx
import React, { createContext, useState, useMemo, useContext, ReactNode, useEffect } from 'react';
import { ThemeProvider, Theme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './theme';
interface ThemeContextType {
  toggleTheme: () => void;
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

const getLocalAppTheme = (): 'light' | 'dark' => {
  if (cachedTheme !== null) return cachedTheme;

  if (typeof window !== 'undefined') {
    cachedTheme = localStorage.getItem('appTheme') as 'light' | 'dark' | null;
    return cachedTheme === 'light' || cachedTheme === 'dark' ? cachedTheme : 'light';
  }
  cachedTheme = 'light';
  return cachedTheme;
};

const ThemeContextProvider: React.FC<ThemeContextProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(getLocalAppTheme()) ;
  
  // useEffect(() => {
  //   if (typeof window !== 'undefined') {
  //     const storedTheme = localStorage.getItem('appTheme') as 'light' | 'dark' | null;
      
  //     if (storedTheme === 'light' || storedTheme === 'dark') {
  //       setMode(storedTheme);
  //     }
  //   }
  // }, []);

  const toggleTheme = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    setMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('appTheme', newMode);
    }
  };
  const theme: Theme = useMemo(() => (mode === 'light' ? lightTheme : darkTheme), [mode]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // localStorage.setItem('appTheme', mode);
      // 有主题色 建议写成函数调用 
      document.documentElement.style.setProperty(
        '--key--color_accent',
        theme.palette.primary.main,
      )
      document.documentElement.style.setProperty(
        '--key--color_inside-accent',
        theme.palette.black.main,
      )
    }
  }, [mode]);
  return (
    <ThemeContext.Provider value={{ toggleTheme, mode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export default ThemeContextProvider;
  