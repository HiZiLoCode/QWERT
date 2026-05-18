"use client";

import { createContext, useCallback, useState } from "react";

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
  selectedSetting:string,
  /** 递增后设置页应切到「固件」子页（如动效页「立即前往」） */
  settingsFirmwareTabRequestSeq: number,
  requestSettingsFirmwareTab: () => void,
}

export const EditorContext = createContext({} as Editor);

function EditorProvider({ children }: {children: React.ReactNode}) {
  const [editMode, setEditMode] = useState("");
  const [currentTab, setCurrentTab] = useState("keyCode");
  const [lastTab, setLastTab] = useState("left");
  const [selectedSetting, setSelectedSetting] = useState('keypress');
  const [settingsFirmwareTabRequestSeq, setSettingsFirmwareTabRequestSeq] = useState(0);
  const requestSettingsFirmwareTab = useCallback(() => {
    setSettingsFirmwareTabRequestSeq((n) => n + 1);
  }, []);
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
    selectedSetting,
    settingsFirmwareTabRequestSeq,
    requestSettingsFirmwareTab,
  };
  return (
    <EditorContext.Provider value={EditorProps}>
      {children}
    </EditorContext.Provider>
  );
}

export default EditorProvider;
