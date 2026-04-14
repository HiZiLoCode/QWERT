"use client";

import { createContext, useState } from "react";

type Editor = {
  editMode: string,
  setEditMode: Function,
  currentTab: string,
  onChangeTab: Function,
  keycodeTab: string,
  setKeycodeTab: Function,
  travelModeTab: number,
  setTravelModeTab: Function,
  lastTab: string,
  setLastTab: Function,
  triggerMode: 'all' | 'single',
  setTriggerMode: Function,
  setSelectedSetting:Function,
  selectedSetting:string
}

export const EditorContext = createContext({} as Editor);

function EditorProvider({ children }: {children: React.ReactNode}) {
  const [editMode, setEditMode] = useState("");
  const [currentTab, setCurrentTab] = useState("keyCode");
  const [lastTab, setLastTab] = useState("left");
  const [selectedSetting, setSelectedSetting] = useState('keypress');
  // 高级键类型设置
  const [keycodeTab, setKeycodeTab] = useState("normal");
   // 触发设置 0键程 1rt 2死区
  const [travelModeTab, setTravelModeTab] = useState(0);
  // 触发设置模式 all全局设置 single单独设置
  const [triggerMode, setTriggerMode] = useState<Editor["triggerMode"]>('all');

  const EditorProps: Editor = {
    editMode: editMode,
    setEditMode: setEditMode,
    currentTab: currentTab,
    onChangeTab: (tab) => {
      setCurrentTab(tab);
    },
    keycodeTab,
    setKeycodeTab,
    travelModeTab,
    setTravelModeTab,
    lastTab, setLastTab,
    triggerMode,
    setTriggerMode,
    setSelectedSetting,
    selectedSetting
  };
  return (
    <EditorContext.Provider value={EditorProps}>
      {children}
    </EditorContext.Provider>
  );
}

export default EditorProvider;
