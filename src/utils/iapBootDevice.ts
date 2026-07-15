/** 91683 IAP Boot 模式（WebHID） */
export const IAP_BOOT_VENDOR_ID = 0x36b0;
export const IAP_BOOT_PRODUCT_ID = 0x33ff;

export function isIapBootHidDevice(vendorId?: number, productId?: number): boolean {
  return vendorId === IAP_BOOT_VENDOR_ID && productId === IAP_BOOT_PRODUCT_ID;
}

function isIapBootCollection(device: HIDDevice): boolean {
  return Boolean(
    device.collections?.some(
      (collection) => collection.usagePage === 0xff00 && collection.usage === 0x0001,
    ),
  );
}

/** 已授权的 Boot 设备（getDevices，无需再次弹窗） */
export async function getAuthorizedIapBootDevice(): Promise<HIDDevice | null> {
  if (typeof navigator === 'undefined' || !('hid' in navigator)) return null;
  const devices = await navigator.hid.getDevices();
  return (
    devices.find(
      (device) => isIapBootHidDevice(device.vendorId, device.productId) && isIapBootCollection(device),
    ) ?? null
  );
}

/** 浏览器授权弹窗：仅筛选 IAP Boot 接口 */
export async function requestIapBootAuthorization(): Promise<HIDDevice | null> {
  if (typeof navigator === 'undefined' || !('hid' in navigator)) return null;
  try {
    const devices = await navigator.hid.requestDevice({
      filters: [
        {
          vendorId: IAP_BOOT_VENDOR_ID,
          productId: IAP_BOOT_PRODUCT_ID,
          usagePage: 0xff00,
          usage: 0x0001,
        },
        { usagePage: 0xff00, usage: 0x0001 },
      ],
    });
    return devices[0] ?? null;
  } catch {
    return null;
  }
}

export async function isIapBootAuthorizedOnline(): Promise<boolean> {
  return Boolean(await getAuthorizedIapBootDevice());
}
