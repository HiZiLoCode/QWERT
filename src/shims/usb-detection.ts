type USBMonitorEvent = "remove" | "change";
import { areNavigatorHidNativeEventsSuspended } from "@/utils/hidNativeEventGate";

export class usbDetect {
  static _listeners: { change: Function[]; remove: Function[] } = {
    change: [],
    remove: [],
  };
  static shouldMonitor = false;
  static hasMonitored = false;
  static startMonitoring() {
    this.shouldMonitor = true;
    if (!this.hasMonitored && navigator.hid) {
      navigator.hid.addEventListener("connect", usbDetect.onConnect);
      navigator.hid.addEventListener("disconnect", usbDetect.onDisconnect);
      this.hasMonitored = true;
    }
  }
  static stopMonitoring() {
    this.shouldMonitor = false;
    if (this.hasMonitored && navigator.hid) {
      navigator.hid.removeEventListener("connect", usbDetect.onConnect);
      navigator.hid.removeEventListener("disconnect", usbDetect.onDisconnect);
      this.hasMonitored = false;
    }
  }
  private static onConnect = ({ device }: HIDConnectionEvent) => {
    if (areNavigatorHidNativeEventsSuspended()) return;
    console.log("Detected Connection");
    if (usbDetect.shouldMonitor) {
      usbDetect._listeners.change.forEach((f) => f(device));
    }
  };
  private static onDisconnect = ({ device }: HIDConnectionEvent) => {
    if (areNavigatorHidNativeEventsSuspended()) return;
    console.log("Detected Disconnection", device);
    if (usbDetect.shouldMonitor) {
      // usbDetect._listeners.change.forEach((f) => f(device));
      usbDetect._listeners.remove.forEach((f) => f(device));
    }
  };
  static on(eventName: USBMonitorEvent, cb: (device?: any) => void) {
    this._listeners[eventName] = [...this._listeners[eventName], cb];
  }
  static off(eventName: USBMonitorEvent, cb: (device?: any) => void) {
    this._listeners[eventName] = this._listeners[eventName].filter(
      (f) => f !== cb
    );
  }
}
