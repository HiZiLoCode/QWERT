export const deviceInfo: any = {
  "0x36B0_0x3059_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "KRUX Drox",
    layout: "36B0_3059_0",
    updateFile: "./fw-files/36B0_3059_0.bin",
    upgradeVersion: "118",
    /** 屏幕 OTA：app.bin（必选）；image.bin（可选，不配则只升固件） */
    screenFirmwareFile: "./fw-files/36B0_3059_0_screen_app.bin",
    screenImageFile: "./fw-files/36B0_3059_0_screen_image.bin",
    screenUpgradeVersion: "115",
    vendorId: "0x36B0",
    productId: "0x3059",
    keyBoardLayer:false
  },
  "0x373B_0x119B_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "KRUX Drox",
    layout: "36B0_3059_0",
    updateFile: "./fw-files/36B0_119B_0.bin",
    upgradeVersion: "103",
    vendorId: "0x373B",
    productId: "0x119B",
    keyBoardLayer:false
  },
};

/** 与 KeyboardPanel / ConnectKb 中 VID+PID+devMode 的 key 规则一致 */
export function deviceInfoKey(vendorId: number, productId: number, devMode = 0): string {
  return `0x${vendorId.toString(16).toUpperCase()}_0x${productId.toString(16).toUpperCase()}_${devMode}`;
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
