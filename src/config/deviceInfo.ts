export const deviceInfo: any = {
  "0x36B0_0x3059_0": {
    id: 2,
    type: 102,
    fwVersion: 104,
    name: "KRUX Drox",
    layout: "36B0_3059_0",
    updateFile: "./fw-files/36B0_3059_0.bin",
    upgradeVersion: "103",
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
