"use client";

import { createContext, useState } from "react";
import { AdvancedKeyItem } from "../types/types";

type AdvancedKeyProps = {
  advancedKeyItems: AdvancedKeyItem[] | undefined,
  setAdvancedKeyItems: Function,
  currentKeyItem: AdvancedKeyItem | undefined,
  setCurrentKeyItem: Function
}

export const AdvancedKeyContext = createContext({} as AdvancedKeyProps);

function AdvancedKeyProvider({ children }: {children: React.ReactNode}) {
  const [advancedKeyItems, setAdvancedKeyItems] = useState<AdvancedKeyItem[]>([]);
  const [currentKeyItem, setCurrentKeyItem] = useState<AdvancedKeyItem>();
  const advancedKeyProps: AdvancedKeyProps = {
    advancedKeyItems: advancedKeyItems,
    setAdvancedKeyItems: setAdvancedKeyItems,
    currentKeyItem: currentKeyItem,
    setCurrentKeyItem: setCurrentKeyItem,
  };
  return (
    <AdvancedKeyContext.Provider value={advancedKeyProps}>
      {children}
    </AdvancedKeyContext.Provider>
  );
}

export default AdvancedKeyProvider;
