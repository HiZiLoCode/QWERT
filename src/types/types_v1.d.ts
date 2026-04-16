// 设备基本信息
export type DeviceBaseInfo = {
  vendorId: number;
  productId: number;
  firmwareVer: number;
  protocolVer: number;
  profile: number;
  keyboardID: number;
  keyboardType: number;
  keyMatrixSize: number;
  macroSize: number;
  showLight: boolean;
  lightSize: number;
  lightMaxBrightness: number;
  lightMaxSpeed: number;
  lightKeySize: number;

  // V2 扩展字段
  showLogoLight?: boolean;
  logoLightModeSize?: number;
  logoLigthSize?: number;
  logoLightMaxBrightness?: number;
  logoLightMaxSpeed?: number;
  logoLightSupportMusic?: boolean;
  showLightSideLight?: boolean;
  sideLightModeSize?: number;
  sideLightSize?: number;
  sideLightMaxBrightness?: number;
  sideLightMaxSpeed?: number;
  sideLightSupportMusic?: boolean;
  matrixScreen?: boolean;
  matrixScreenLightSize?: number;
  matrixScreenLightRows?: number;
  matrixScreenLightColumns?: number;
  matrixScreenLightMaxBrightness?: number;
  matrixScreenLightMaxSpeed?: number;
  encoder?: boolean;
  isLed?: boolean;
}
export type FunInfo = {
  profile: number;
  lightSwitch: number;
  lightMode: number;
  lightBrightness: number;
  lightSpeed: number;
  lightMixColor: number;
  lightColorIndex: number;
  lightRValue: number;
  lightGValue: number;
  lightBValue: number;
  lightCustomIndex: number;

  logoLightSwitch: number;
  logoLightMode: number;
  logoLightBrightness: number;
  logoLightSpeed: number;
  logoLightMixColor: number;
  logoLightColorIndex: number;
  logoLightRValue: number;
  logoLightGValue: number;
  logoLightBValue: number;

  sideLightSwitch: number;
  sideLightMode: number;
  sideLightBrightness: number;
  sideLightSpeed: number;
  sideLightMixColor: number;
  sideLightColorIndex: number;
  sideLightRValue: number;
  sideLightGValue: number;
  sideLightBValue: number;

  matrixScreenLightSwitch: boolean;
  matrixScreenLightMode: number;
  matrixScreenLightBrightness: number;
  matrixScreenLightSpeed: number;
  matrixScreenLightMixColor: number;
  matrixScreenLightColorIndex: number;
  matrixScreenLightRValue: number;
  matrixScreenLightGValue: number;
  matrixScreenLightBValue: number;
  sixKeysOrAllKeys: number;
  maxOrWin: number;
  winLock: number;
  keyWasd: number;
  scanDelay: number;
  layerDefault: number;
  fSwitch: boolean;
  wheelDefaultMode: number;
  sleepTime: number;
  deepSleepTime: number;
  lcdScreenLightSwitch: boolean;
  lcdScreenLightMode: number;
  lcdScreenLightBrightness: number;
  lcdScreenMaxGif: number;
  lcdScreenLanguage: number;
  lcdScreenUsbEnum: boolean;
  snapTap: boolean;

  /** 仅 PID 0x3059 等扩展功能区：屏幕页面 */
  lcdScreenPage?: number;
  /** 灵动岛状态 */
  lcdDynamicIsland?: number;
  /** 屏幕自定义模式 - 时间显示 RGB */
  lcdCustomTimeRValue?: number;
  lcdCustomTimeGValue?: number;
  lcdCustomTimeBValue?: number;
  /** 电池指示 RGB */
  lcdCustomBatteryRValue?: number;
  lcdCustomBatteryGValue?: number;
  lcdCustomBatteryBValue?: number;
  /** 指示图标 RGB */
  lcdCustomIconRValue?: number;
  lcdCustomIconGValue?: number;
  lcdCustomIconBValue?: number;
  /** 主灯灯效方向（如正向/反向） */
  lightEffectDirection?: number;
  /** 字节 71：NumLock 模式（仅 0x3059 扩展布局） */
  numLockMode?: number;
  /** 字节 72：拾音灯效开关（仅 0x3059 扩展布局） */
  pickupLightEffectSwitch?: number;
  /** 字节 73：拾音灯效方向（仅 0x3059 扩展布局） */
  pickupLightEffectDirection?: number;
  /** 字节 74：拾音灯频率档位（示例：1=15fps, 2=30fps, 3=60fps） */
  pickupLightFpsLevel?: number;
  /** 字节 75：拾音灯频率定义开关（0=正常, 1=自定义） */
  pickupLightFpsDefine?: number;
}

// 按键信息
export type KeyCodeInfo = {
  name?: string;
  code?: string;
  langid?: string;
  type: number;
  value1: number;
  value2: number;
  value3?: number;
};

export type KeyboardKey = {
  type: number;
  code1: number;
  code2: number;
  code3?: number;
  name?: string;
  shortName?: string;
  webKeyId?: string;
};

export type LayoutKey = {
  row?: number,
  col?: number,
  x: number,
  y: number,
  h: number,
  w: number,
  code?: number,
  index?: number,
  name?: string,
  mode?: number
}

export type KeyboardLight = {
  light: number;
  direct: number;
  superRet: number;
  brightness: number;
  effect: number;
  speed: number;
  sleep: number;
};

export type TravelParam = {
  mode: number;
  actuation: number;
  press: number;
  release: number;
  pressDz: number;
  releaseDz: number;
};

export type TravelKey = {
  axiosType: number;
  mode: number;
  type: number;
  maxActuation: number;
  actuation: number;
  press: number;
  release: number;
  pressDeadzone: number;
  releaseDeadzone: number;
};

export type TravelConfig = {
  actuation: number;
  pressDeadzone: number;
  releaseDeadzone: number;
};

export type AdvancedKeyOption = {
  actuation: number;
  priority?: number;
  repidTrigger?: boolean;
};

export type DKSKeyStatus = {
  downStart: number;
  downEnd: number;
  upStart: number;
  upEnd: number;
};

export type DKSKeyPosition = DKSKeyStatus;

export type DKSKey = {
  key: KeyboardKey;
} & DKSKeyStatus;

export type AdvancedKey = {
  type: string;
  index1: number;
  index2?: nunber;
  key1?: KeyboardKey;
  key2?: KeyboardKey;
  mtDownKey?: KeyboardKey;
  mtClickKey?: KeyboardKey;
  mtTime?: number;
  tglKey?: KeyboardKey;
  dksPoint?: number[];
  dksKeys?: DKSKey[];
  option?: AdvancedKeyOption;
};

export type ProfileContent = {
  detail: { name: string; id?: string };
  userKeys: Record<string, KeyboardKey[]>;
  travelKeys: TravelKey[];
  advancedKeys: AdvancedKey[];
  light: KeyboardLight;
  colorKeys: Record<number, string[]>;
  globalTravel: TravelConfig;
  reportRate: number;
  macro?: MacroProfile[];
};

export type KeyboardBase = {
  layout: number;
  keyType: number;
  fwSize: number;
  sn: string;
  version: string;
  date: string;
};

export type MacroProfile = {
  name: string;
  key?: number;
  type: number;
  replayCnt: number;
  list: MacroAction[];
};

export type MacroAction = {
  key: string;
  hasUpArrow: boolean;
  hasDownArrow: boolean;
  showAddButtons: boolean;
  type: 'keyboard' | 'mouse' | 'delay' | 'transcribe';
  index: number;
  hasError: boolean;
  value?: string | number;
  webCode?: string;
  delay?: number;
  mouse?: {
    x: number;
    y: number;
    button: 'left' | 'right' | 'middle';
    action: 'click' | 'doubleClick' | 'press' | 'release';
  };
};

export type ProfileItem = {
  profileId: number;
  profileName: string;
};