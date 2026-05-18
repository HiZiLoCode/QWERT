'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  getScreenThemeColors,
  SCREEN_THEME_LIGHT,
  type ScreenThemeVisualColors,
} from './theme';

const ScreenThemeVisualContext = createContext<ScreenThemeVisualColors>(SCREEN_THEME_LIGHT);

/** 由父组件根据 MUI `palette.mode` 注入（例如 ScreenThemePage 内与 render 闭包共用同一套令牌） */
export function ScreenThemeVisualSet({
  value,
  children,
}: {
  value: ScreenThemeVisualColors;
  children: ReactNode;
}) {
  return (
    <ScreenThemeVisualContext.Provider value={value}>{children}</ScreenThemeVisualContext.Provider>
  );
}

export function ScreenThemeVisualProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const value = useMemo(
    () => getScreenThemeColors(theme.palette.mode),
    [theme.palette.mode]
  );
  return <ScreenThemeVisualSet value={value}>{children}</ScreenThemeVisualSet>;
}

export function useScreenThemeVisual(): ScreenThemeVisualColors {
  return useContext(ScreenThemeVisualContext);
}
