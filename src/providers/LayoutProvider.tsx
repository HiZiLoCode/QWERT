"use client";

import { createContext, useContext, useMemo, useState } from 'react';

export type LayoutOptionKey =
  | 'enterSplit'
  | 'enterNormal'
  | 'backspaceAnsi'
  | 'backspaceIso'
  | 'lshiftSplit'
  | 'lshiftNormal'
  | 'rshiftSplit'
  | 'rshiftNormal'
  | 'space625'
  | 'space7';

type LayoutState = Record<LayoutOptionKey, boolean>;

type LayoutContextValue = {
  layoutState: LayoutState;
  setLayoutOption: (key: LayoutOptionKey, value: boolean) => void;
  toggleLayoutOption: (key: LayoutOptionKey) => void;
};

const defaultLayoutState: LayoutState = {
  enterSplit: true,
  enterNormal: false,
  backspaceAnsi: true,
  backspaceIso: false,
  lshiftSplit: false,
  lshiftNormal: true,
  rshiftSplit: true,
  rshiftNormal: false,
  space625: true,
  space7: false,
};

export const LayoutContext = createContext<LayoutContextValue>({} as LayoutContextValue);

export function useLayoutConfig() {
  return useContext(LayoutContext);
}

export default function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [layoutState, setLayoutState] = useState<LayoutState>(defaultLayoutState);

  const setLayoutOption = (key: LayoutOptionKey, value: boolean) => {
    setLayoutState((prev) => ({ ...prev, [key]: value }));
  };

  const toggleLayoutOption = (key: LayoutOptionKey) => {
    setLayoutState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const value = useMemo(
    () => ({
      layoutState,
      setLayoutOption,
      toggleLayoutOption,
    }),
    [layoutState]
  );

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}




