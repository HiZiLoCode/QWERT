import { HID } from "../shims/node-hid";
import { usbDetect } from "../shims/usb-detection";
import { WebKbDevice, Device } from "../types/types";

export { HID } from "../shims/node-hid";
export { usbDetect } from "../shims/usb-detection";

export async function scanDevices(
  forceRequest: boolean
): Promise<WebKbDevice[]> {
  return HID.devices(forceRequest);
}

// TODO: fix typing. This actually returns a HID object, but it complains if you type it as such.
export function initAndConnectDevice({ address }: Pick<Device, "address">) {
  const device = new HID.HID(address);
  return device;
}

export function startMonitoring() {
  usbDetect.startMonitoring();
}
