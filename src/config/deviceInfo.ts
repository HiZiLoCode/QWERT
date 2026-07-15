export const deviceInfo: any = {
  "0x36B0_0x3059_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "QK100 Mk2",
    layout: "36B0_3059_0",
    updateFile: "./fw-files/KeyBoard/129/36B0_3059_0.bin",
    upgradeVersion: "129",
    /** 屏幕 OTA：app.bin（必选）；image.bin（可选，不配则只升固件） */
    screenFirmwareFile: "./fw-files/screen/119/36B0_3059_0_screen_app.bin",
    screenImageFile: "./fw-files/screen/119/36B0_3059_0_screen_image.bin",
    screenUpgradeVersion: "119",
    vendorId: "0x36B0",
    productId: "0x3059",
    keyBoardLayer: false,

  },
  "0x36B0_0x33FF_0": {
    id: 1,
    name: "IAP Boot",
    vendorId: "0x36B0",
    productId: "0x33FF",
    /** Boot 救砖：授权页可选该设备，连接后选择键盘型号恢复升级 */
    iapBoot: true,
  },
  "0x36B0_0x3081_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "QK100 Mk2 ISO",
    layout: "36B0_3081_0",
    // updateFile: "./fw-files/KeyBoard/127/36B0_3059_0.bin",
    upgradeVersion: "100",
    /** 屏幕 OTA：app.bin（必选）；image.bin（可选，不配则只升固件） */
    // screenFirmwareFile: "./fw-files/screen/118/36B0_3059_0_screen_app.bin",
    // screenImageFile: "./fw-files/screen/118/36B0_3059_0_screen_image.bin",
    screenUpgradeVersion: "100",
    vendorId: "0x36B0",
    productId: "0x3081",
    keyBoardLayer: false,
    isLed: false,
    matrixScreen: false,
  },
  "0x36B0_0x307F_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "Neo Code 98 ISO",
    layout: "36B0_307F_0",
    // updateFile: "./fw-files/KeyBoard/127/36B0_3059_0.bin",
    upgradeVersion: "100",
    /** 屏幕 OTA：app.bin（必选）；image.bin（可选，不配则只升固件） */
    // screenFirmwareFile: "./fw-files/screen/118/36B0_3059_0_screen_app.bin",
    // screenImageFile: "./fw-files/screen/118/36B0_3059_0_screen_image.bin",
    screenUpgradeVersion: "100",
    vendorId: "0x36B0",
    productId: "0x307F",
    keyBoardLayer: false,
    isLed: false,
    matrixScreen: false,
  },
  "0x36B0_0x307E_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "Neo Code 75 ISO",
    layout: "36B0_307E_0",
    // updateFile: "./fw-files/KeyBoard/127/36B0_3059_0.bin",
    upgradeVersion: "100",
    /** 屏幕 OTA：app.bin（必选）；image.bin（可选，不配则只升固件） */
    // screenFirmwareFile: "./fw-files/screen/118/36B0_3059_0_screen_app.bin",
    // screenImageFile: "./fw-files/screen/118/36B0_3059_0_screen_image.bin",
    screenUpgradeVersion: "100",
    vendorId: "0x36B0",
    productId: "0x307E",
    keyBoardLayer: false,
    isLed: false,
    matrixScreen: false,
  },
  "0x36B0_0x31BA_0": {
    name: "OWARIA80",
    layout: "36B0_31BA_0",
    vendorId: "0x36B0",
    productId: "0x31BA",
    keyBoardLayer: false,
    /** QMK VIA JSON：`src/data/config/{qmkConfig}.json` */
    qmkConfig: "OWARIA80",
    /** QMK 侧边栏：是否显示 LED 屏幕设置 */
    isLed: false,
    /** QMK 侧边栏：是否显示点阵屏设置 */
    matrixScreen: false,
    /** 点阵屏协议：qmk-via= VIA Lattice 菜单；lattice-hid= Raw HID 子协议 */
    matrixScreenProtocol: "qmk-via",
    /** 点阵屏灯效名称：`src/data/matrixLight/{matrixLightLayout}.json` */
    matrixLightLayout: "OWARIA80",
    /** VIA 灯光分组 label，与 qmk-via 协议配合 */
    matrixLightGroupLabel: "Lattice",
  },
  "0x36B0_0x314D_0": {
    name: "Neo Code 75",
    layout: "36B0_314D_0",
    /** 与 91683 版 Neo Code 75 共用物理键位（测试按键 HID code） */
    physicalLayout: "36B0_307E_0",
    vendorId: "0x36B0",
    productId: "0x314D",
    keyBoardLayer: false,
    /** QMK VIA JSON：`src/data/config/{qmkConfig}.json` */
    qmkConfig: "Neo Code 75",
    /** QMK 侧边栏：是否显示 LED 屏幕设置 */
    isLed: false,
    /** QMK 侧边栏：是否显示点阵屏设置 */
    matrixScreen: false,
    /** 点阵屏协议：qmk-via= VIA Lattice 菜单；lattice-hid= Raw HID 子协议 */
    matrixScreenProtocol: "qmk-via",
    /** 点阵屏灯效名称：`src/data/matrixLight/{matrixLightLayout}.json` */
    matrixLightLayout: "OWARIA80",
    /** VIA 灯光分组 label，与 qmk-via 协议配合 */
    matrixLightGroupLabel: "Lattice",
  },
  "0x36B0_0x314F_0": {
    name: "Neo Code 98",
    layout: "36B0_314F_0",
    /** 与 91683 版 Neo Code 98 共用物理键位（测试按键 HID code） */
    physicalLayout: "36B0_307F_0",
    vendorId: "0x36B0",
    productId: "0x314F",
    keyBoardLayer: false,
    /** QMK VIA JSON：`src/data/config/{qmkConfig}.json` */
    qmkConfig: "Neo Code 98",
    /** QMK 侧边栏：是否显示 LED 屏幕设置 */
    isLed: false,
    /** QMK 侧边栏：是否显示点阵屏设置 */
    matrixScreen: false,
    /** 点阵屏协议：qmk-via= VIA Lattice 菜单；lattice-hid= Raw HID 子协议 */
    matrixScreenProtocol: "qmk-via",
    /** 点阵屏灯效名称：`src/data/matrixLight/{matrixLightLayout}.json` */
    matrixLightLayout: "OWARIA80",
    /** VIA 灯光分组 label，与 qmk-via 协议配合 */
    matrixLightGroupLabel: "Lattice",
  },
};

/**
 * deviceInfo 中 `upgradeVersion` / `screenUpgradeVersion` 为该值时，关闭对应固件升级入口。
 * 需要恢复升级时改为真实目标版本号并配置固件路径即可。
 */
export const DEVICE_DRIVER_UPGRADE_DISABLED_VERSION = "100";

export function isKeyboardDriverUpgradeDisabled(
  vendorId: number,
  productId: number,
  devMode = 0,
): boolean {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const v = String(deviceInfo[key]?.upgradeVersion ?? "").trim();
  return v === DEVICE_DRIVER_UPGRADE_DISABLED_VERSION;
}

export function isScreenDriverUpgradeDisabled(
  vendorId: number,
  productId: number,
  devMode = 0,
): boolean {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const v = String(deviceInfo[key]?.screenUpgradeVersion ?? "").trim();
  return v === DEVICE_DRIVER_UPGRADE_DISABLED_VERSION;
}

/** 与 KeyboardPanel / ConnectKb 中 VID+PID+devMode 的 key 规则一致 */
export function deviceInfoKey(vendorId: number, productId: number, devMode = 0): string {
  return `0x${vendorId.toString(16).toUpperCase()}_0x${productId.toString(16).toUpperCase()}_${devMode}`;
}

/** deviceInfo 中是否登记了 IAP Boot 救砖设备（如 0x36B0 / 0x33FF） */
export function isIapBootDeviceInfoEntry(
  vendorId: number,
  productId: number,
  devMode: number = 0,
): boolean {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  return Boolean(row && typeof row === "object" && row.iapBoot === true);
}

export function hasIapBootDeviceInDeviceInfo(): boolean {
  return (Object.values(deviceInfo) as Array<{ iapBoot?: boolean }>).some(
    (row) => row?.iapBoot === true,
  );
}

/** 仅列出在 deviceInfo 中已配置的设备 */
export function isDeviceInDeviceInfo(
  vendorId: unknown,
  productId: unknown,
  devMode: number = 0
): boolean {
  if (typeof vendorId !== "number" || typeof productId !== "number") return false;
  const key = deviceInfoKey(vendorId, productId, devMode);
  return Object.prototype.hasOwnProperty.call(deviceInfo, key);
}

/** 屏幕 OTA 固件包（app.bin）路径；未配置 screenFirmwareFile 时回退旧字段 screenUpdateFile */
export function getScreenFirmwareFile(
  vendorId: number,
  productId: number,
  devMode: number = 0
): string {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  return row?.screenFirmwareFile || row?.screenUpdateFile || "";
}

/** 屏幕 OTA 图包（image.bin）路径；空字符串表示不传图、仅升固件 */
export function getScreenImageFile(
  vendorId: number,
  productId: number,
  devMode: number = 0
): string {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const v = deviceInfo[key]?.screenImageFile;
  return typeof v === "string" ? v.trim() : "";
}

export function getScreenUpgradeVersion(
  vendorId: number,
  productId: number,
  devMode: number = 0
): string {
  const key = deviceInfoKey(vendorId, productId, devMode);
  return deviceInfo[key]?.screenUpgradeVersion || "";
}

/** 测试按键 / 虚拟键盘物理键位 JSON：`src/data/keyboardLayout/{stem}.json` */
export function getPhysicalLayoutStem(
  vendorId: number,
  productId: number,
  devMode: number = 0,
): string {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  if (!row) return '';
  const stem = row.physicalLayout ?? row.layout;
  return typeof stem === 'string' ? stem.trim() : '';
}

/** QMK：`src/data/config` 下 VIA JSON 文件名（不含扩展名） */
export function getQmkConfigFileStem(
  vendorId: number,
  productId: number,
  devMode: number = 0,
): string {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  if (!row) return "";
  const stem = row.qmkConfig ?? row.name;
  return typeof stem === "string" ? stem.trim() : "";
}

export type MatrixScreenProtocol = 'func-info' | 'qmk-via' | 'lattice-hid';

export type MatrixScreenDeviceConfig = {
  matrixScreen: boolean;
  matrixScreenProtocol?: MatrixScreenProtocol;
  matrixLightLayout?: string;
  matrixLightGroupLabel?: string;
  latticeCMD2?: number;
  latticeEnd?: number;
  matrixScreenLightRows?: number;
  matrixScreenLightColumns?: number;
  matrixScreenLightMaxBrightness?: number;
  matrixScreenLightMaxSpeed?: number;
  matrixScreenLightSize?: number;
};

/** 点阵屏完整配置（含协议与灯效 JSON 路径） */
export function getMatrixScreenConfig(
  vendorId: number,
  productId: number,
  devMode: number = 0,
): MatrixScreenDeviceConfig | null {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  if (!row?.matrixScreen) return null;

  const protocol = row.matrixScreenProtocol as MatrixScreenProtocol | undefined;
  return {
    matrixScreen: true,
    matrixScreenProtocol: protocol ?? 'func-info',
    ...(typeof row.matrixLightLayout === 'string' ? { matrixLightLayout: row.matrixLightLayout.trim() } : {}),
    ...(typeof row.matrixLightGroupLabel === 'string' ? { matrixLightGroupLabel: row.matrixLightGroupLabel.trim() } : {}),
    ...(typeof row.latticeCMD2 === 'number' ? { latticeCMD2: row.latticeCMD2 } : {}),
    ...(typeof row.latticeEnd === 'number' ? { latticeEnd: row.latticeEnd } : {}),
    ...(typeof row.matrixScreenLightRows === 'number' ? { matrixScreenLightRows: row.matrixScreenLightRows } : {}),
    ...(typeof row.matrixScreenLightColumns === 'number' ? { matrixScreenLightColumns: row.matrixScreenLightColumns } : {}),
    ...(typeof row.matrixScreenLightMaxBrightness === 'number' ? { matrixScreenLightMaxBrightness: row.matrixScreenLightMaxBrightness } : {}),
    ...(typeof row.matrixScreenLightMaxSpeed === 'number' ? { matrixScreenLightMaxSpeed: row.matrixScreenLightMaxSpeed } : {}),
    ...(typeof row.matrixScreenLightSize === 'number' ? { matrixScreenLightSize: row.matrixScreenLightSize } : {}),
  };
}

/** QMK：从 deviceInfo 读取 UI 能力（LED 屏 / 点阵屏等），91683 仍由固件 getDeviceBaseInfo 提供 */
export function getDeviceUiCapabilities(
  vendorId: number,
  productId: number,
  devMode: number = 0,
): {
  isLed: boolean;
  matrixScreen: boolean;
  matrixScreenProtocol?: MatrixScreenProtocol;
  matrixLightLayout?: string;
  matrixLightGroupLabel?: string;
  matrixScreenLightRows?: number;
  matrixScreenLightColumns?: number;
  matrixScreenLightMaxBrightness?: number;
  matrixScreenLightMaxSpeed?: number;
  matrixScreenLightSize?: number;
} {
  const key = deviceInfoKey(vendorId, productId, devMode);
  const row = deviceInfo[key];
  if (!row) {
    return { isLed: false, matrixScreen: false };
  }
  const matrixCfg = getMatrixScreenConfig(vendorId, productId, devMode);
  return {
    isLed: Boolean(row.isLed),
    matrixScreen: Boolean(row.matrixScreen),
    ...(matrixCfg?.matrixScreenProtocol ? { matrixScreenProtocol: matrixCfg.matrixScreenProtocol } : {}),
    ...(matrixCfg?.matrixLightLayout ? { matrixLightLayout: matrixCfg.matrixLightLayout } : {}),
    ...(matrixCfg?.matrixLightGroupLabel ? { matrixLightGroupLabel: matrixCfg.matrixLightGroupLabel } : {}),
    ...(typeof matrixCfg?.matrixScreenLightRows === 'number' ? { matrixScreenLightRows: matrixCfg.matrixScreenLightRows } : {}),
    ...(typeof matrixCfg?.matrixScreenLightColumns === 'number' ? { matrixScreenLightColumns: matrixCfg.matrixScreenLightColumns } : {}),
    ...(typeof matrixCfg?.matrixScreenLightMaxBrightness === 'number' ? { matrixScreenLightMaxBrightness: matrixCfg.matrixScreenLightMaxBrightness } : {}),
    ...(typeof matrixCfg?.matrixScreenLightMaxSpeed === 'number' ? { matrixScreenLightMaxSpeed: matrixCfg.matrixScreenLightMaxSpeed } : {}),
    ...(typeof matrixCfg?.matrixScreenLightSize === 'number' ? { matrixScreenLightSize: matrixCfg.matrixScreenLightSize } : {}),
  };
}
