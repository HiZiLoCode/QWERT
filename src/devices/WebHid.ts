import { WebHidDevice } from "../types/types";
import { deviceInfo } from "../config/deviceInfo";
import { hidSendReportWithRetry, withHidOutputWriteLock } from "../lib/hidOutputWriteLock";
const globalBuffer: {
  [path: string]: { currTime: number; message: Uint8Array }[];
} = {};

/** 防止 notify 洪泛时 globalBuffer 无限膨胀导致 tab OOM */
const GLOBAL_BUFFER_MAX = 128;

const eventWaitBuffer: {
  [path: string]: ((a: Uint8Array) => void)[];
} = {};

const promisify = (cb: Function) => () => {
  return Promise.race([
    new Promise((res, rej) => {
      setTimeout(() => {
        res([]);
      }, 1000);
    }),
    new Promise((res, rej) => {
      cb((e: any, d: any) => {
        if (e) rej(e);
        else res(d);
      });
    }),
  ]);
};

// 端点常量定义
const USAGE_PAGE_VENDOR = 0xff60;
const USAGE_VENDOR = 0x0061;
const USAGE_PAGE_CONSUMER = 0x000c;
const USAGE_CONSUMER = 0x0001;

export function hasVendorHidCollection(device: HIDDevice): boolean {
  return (
    device.collections?.some(
      (collection) =>
        collection.usagePage === USAGE_PAGE_VENDOR && collection.usage === USAGE_VENDOR,
    ) ?? false
  );
}

// 过滤通信端点设备 (原有)
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) => hasVendorHidCollection(device));

function parseHexId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return 0;
  const parsed = parseInt(value.replace(/^0x/i, ''), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** 授权弹窗可能选中标准键盘输入接口；解析为同 VID/PID 的 vendor 通信接口 */
export async function resolveVendorCommHidDevice(preferred: HIDDevice): Promise<HIDDevice> {
  if (hasVendorHidCollection(preferred)) {
    return preferred;
  }
  const all = await navigator.hid.getDevices();
  const resolved = all.find(
    (d) =>
      d.vendorId === preferred.vendorId &&
      d.productId === preferred.productId &&
      hasVendorHidCollection(d),
  );
  if (resolved) {
    tagDevice(resolved);
    return resolved;
  }
  return preferred;
}

// 过滤通知端点设备 (新增)
const filterNotifyDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        collection.usagePage === USAGE_PAGE_CONSUMER && collection.usage === USAGE_CONSUMER
    )
  );

const getRandomAdress = () => {
  return (
    (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
    `path:${Math.random()}`
  );
};

export const tagDevice = (device: HIDDevice): WebHidDevice => {
  const address = (device as any)._address || getRandomAdress();
  (device as any)._address = address;
  const HIDDevice = {
    _device: device,
    usage: 0x0000,
    usagePage: 0x0001,
    interface: 0x0001,
    vendorId: device.vendorId ?? -1,
    productId: device.productId ?? -1,
    address,
    productName: device.productName,
  };
  return (WebHid._cache[address] = HIDDevice);
};
// 生成符合 PID 范围的过滤器
const generateHIDFilters = (vid: number, pidStart: number, pidEnd: number) => {
  const filters = [];
  for (let pid = pidStart; pid < pidEnd; pid++) {
    filters.push({
      vendorId: vid, // VID 固定值
      productId: pid, // PID 在指定区间内
      usagePage: 0xff60, // usagePage
      usage: 0x0061, // usage
    });
  }
  return filters;
};
const generateHIDFiltersV2 = (deviceInfoList: Array<{ vendorId: unknown; productId: unknown }>) => {
  const seen = new Set<string>();
  const filters: Array<{ vendorId: number; productId: number; usagePage: number; usage: number }> = [];
  for (const device of deviceInfoList) {
    const vendorId = parseHexId(device.vendorId);
    const productId = parseHexId(device.productId);
    if (!vendorId || !productId) continue;
    const key = `${vendorId}:${productId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filters.push({
      vendorId,
      productId,
      usagePage: USAGE_PAGE_VENDOR,
      usage: USAGE_VENDOR,
    });
  }
  return filters;
};
export const WebHid = {
  _cache: {} as { [address: string]: WebHidDevice },
  _notifyCache: {} as { [address: string]: HIDDevice },  // 通知端点缓存

  /**
   * 与固件升级授权一致：弹窗等待期间仅调用 requestDevice，不做 getDevices / 监听开关。
   * 单一 VID+usage 过滤器，避免全量 deviceInfo 枚举导致 Chrome 在插线等待时崩溃。
   */
  requestDeviceForPicker: async (options?: { includeIapBoot?: boolean }): Promise<HIDDevice | null> => {
    const filters: Array<{ vendorId?: number; productId?: number; usagePage: number; usage: number }> = [
      { vendorId: 0x36b0, usagePage: USAGE_PAGE_VENDOR, usage: USAGE_VENDOR },
    ];
    if (options?.includeIapBoot) {
      filters.push({
        vendorId: 0x36b0,
        productId: 0x33ff,
        usagePage: 0xff00,
        usage: 0x0001,
      });
    }
    const devices = await navigator.hid.requestDevice({ filters });
    return devices.length > 0 ? devices[0] : null;
  },

  requestDevice: async (options?: { includeIapBoot?: boolean }) => {
    const picked = await WebHid.requestDeviceForPicker(options);
    if (!picked) {
      return null;
    }
    tagDevice(picked);
    if (picked.vendorId === 0x36b0 && picked.productId === 0x33ff) {
      return picked;
    }
    return resolveVendorCommHidDevice(picked);
  },

  getFilteredDevices: async () => {
    try {
      const allDevices = await navigator.hid.getDevices();
      return filterHIDDevices(allDevices);
    } catch (e) {
      return [];
    }
  },

  devices: async (requestAuthorize = false) => {
    let devices = await WebHid.getFilteredDevices();
    console.log(devices, requestAuthorize, "devices");
    // 只有在“需要授权”且当前没有已授权设备时，才触发浏览器授权弹窗
    // 避免在探测/重连流程中重复 requestDevice 导致多次弹窗
    if (requestAuthorize) {
      try {
        const devices = await WebHid.requestDevice();
        if (!devices) {
          return devices;
        }
      } catch (error) {
        return [];
      }
      devices = await WebHid.getFilteredDevices();
    }
    console.log(devices, "devices");
    return devices.map(tagDevice);
  },

  // 获取通知端点设备 (新增)
  getNotifyDevices: async (): Promise<HIDDevice[]> => {
    try {
      const allDevices = await navigator.hid.getDevices();
      return filterNotifyDevices(allDevices);
    } catch (e) {
      console.error("获取通知设备失败:", e);
      return [];
    }
  },

  // 根据 VID/PID 获取对应的通知设备 (新增)
  getNotifyDeviceByVidPid: async (vendorId: number, productId: number): Promise<HIDDevice | null> => {
    const notifyDevices = await WebHid.getNotifyDevices();
    const device = notifyDevices.find(
      (d) => d.vendorId === vendorId && d.productId === productId
    );
    if (device) {
      const address = (device as any)._address || getRandomAdress();
      WebHid._notifyCache[address] = device;
    }
    return device || null;
  },
};

export class HidDeivce {
  _hidDevice: WebHidDevice | undefined;
  _notifyDevice: HIDDevice | undefined;  // 通知端点设备
  /** 避免 close/open 后重复 addEventListener，同一条 IN 被多次入队 */
  private _internalInputReportHandler: ((e: HIDInputReportEvent) => void) | null = null;
  interface: number = -1;
  vendorId: number = -1;
  productId: number = -1;
  productName: string = "";
  address: string = "";
  openPromise: Promise<void> = Promise.resolve();
  notifyOpenPromise: Promise<void> = Promise.resolve();  // 通知设备打开 Promise
  constructor(address: string) {
    if (address == "demo") {
      this.address = "demo";
      this.vendorId = 0x9a9a;
      this.productId = 0xbaba;
      this.productName = "Test";
      return;
    }
    this._hidDevice = WebHid._cache[address];
    if (this._hidDevice) {
      this.vendorId = this._hidDevice.vendorId;
      this.productId = this._hidDevice.productId;
      this.address = this._hidDevice.address;
      this.interface = this._hidDevice.interface;
      this.productName = this._hidDevice.productName;
      globalBuffer[this.address] = globalBuffer[this.address] || [];
      eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
      if (!this._hidDevice._device.opened) {
        this.open();
      }
    }
  }

  async open() {
    if (this._hidDevice && !this._hidDevice._device.opened) {
      this.openPromise = this._hidDevice._device.open();
      this.setupListeners();
      await this.openPromise;
    }
    return Promise.resolve();
  }

  addListeners(fn: (this: HIDDevice, ev: HIDInputReportEvent) => any) {
    if (this._hidDevice) {
      this._hidDevice._device.oninputreport = fn;
    }
  }

  // 初始化通知端点设备 (新增)
  async initNotifyDevice() {
    if (this.vendorId > 0 && this.productId > 0) {
      this._notifyDevice = await WebHid.getNotifyDeviceByVidPid(this.vendorId, this.productId);
      if (this._notifyDevice && !this._notifyDevice.opened) {
        this.notifyOpenPromise = this._notifyDevice.open();
        await this.notifyOpenPromise;
        console.log("[NotifyDevice] 通知端点已打开:", this.productName);
      }
    }
  }

  // 添加通知端点监听器 (新增)
  addNotifyListeners(fn: (this: HIDDevice, ev: HIDInputReportEvent) => any) {
    if (this._notifyDevice) {
      this._notifyDevice.oninputreport = fn;
      console.log("[NotifyDevice] 通知监听器已添加");
    }
  }

  // 获取通知设备 (新增)
  getNotifyDevice(): HIDDevice | undefined {
    return this._notifyDevice;
  }

  // 初始化8K键盘设备端点 (新增 - 用于固件升级)
  async initDevice() {
    if (this.vendorId > 0 && this.productId > 0) {
      // 8K键盘使用通信端点接收固件升级的ACK响应
      // 不需要额外打开设备，因为通信端点已经在 open() 中打开
      console.log("[8KDevice] 8K键盘设备端点已初始化:", this.productName);
    }
  }

  setupListeners() {
    if (!this._hidDevice) return;
    const dev = this._hidDevice._device;
    if (this._internalInputReportHandler) {
      dev.removeEventListener("inputreport", this._internalInputReportHandler);
      this._internalInputReportHandler = null;
    }
    this._internalInputReportHandler = (e: HIDInputReportEvent) => {
      const message = new Uint8Array(e.data.buffer);
      if (eventWaitBuffer[this.address].length !== 0) {
        (eventWaitBuffer[this.address].shift() as any)(message);
        return;
      }
      const queue = globalBuffer[this.address] ?? (globalBuffer[this.address] = []);
      if (queue.length >= GLOBAL_BUFFER_MAX) {
        queue.shift();
      }
      queue.push({
        currTime: Date.now(),
        message,
      });
    };
    dev.addEventListener("inputreport", this._internalInputReportHandler);
  }

  read(fn: (err?: Error, data?: ArrayBuffer) => void) {
    if (globalBuffer[this.address]?.length > 0) {
      // this should be a noop normally
      fn(undefined, globalBuffer[this.address].shift()?.message as any);
    } else {
      eventWaitBuffer[this.address].push((data) => fn(undefined, data));
    }
  }

  readP = promisify((arg: any) => this.read(arg));

  fastForwardGlobalBuffer(time: number) {
    let messagesLeft = globalBuffer[this.address]?.length;
    while (messagesLeft) {
      messagesLeft--;
      // message in buffer happened before requested time
      if (globalBuffer[this.address][0].currTime < time) {
        globalBuffer[this.address].shift();
      } else {
        break;
      }
    }
  }

  async write(arr: number[]) {
    await this.openPromise;
    const device = this._hidDevice?._device;
    if (!device) return;
    const data = new Uint8Array(arr.slice(1));
    this.fastForwardGlobalBuffer(Date.now());
    eventWaitBuffer[this.address] = [];
    await withHidOutputWriteLock(device, () => hidSendReportWithRetry(device, 0, data));
  }

  async writeMany(packets: number[][]) {
    await this.openPromise;
    const device = this._hidDevice?._device;
    if (!device) return;
    this.fastForwardGlobalBuffer(Date.now());
    eventWaitBuffer[this.address] = [];
    for (const packet of packets) {
      const data = new Uint8Array(packet.slice(1));
      await withHidOutputWriteLock(device, () => hidSendReportWithRetry(device, 0, data));
    }
  }

  /** 断开连接时移除 inputreport 监听并清空缓冲，防止重插后旧回调堆积 */
  release() {
    const dev = this._hidDevice?._device;
    if (this._internalInputReportHandler && dev) {
      try {
        dev.removeEventListener('inputreport', this._internalInputReportHandler);
      } catch {
        /* ignore */
      }
      this._internalInputReportHandler = null;
    }
    if (dev) {
      try {
        dev.oninputreport = null;
      } catch {
        /* ignore */
      }
    }
    if (this.address) {
      delete globalBuffer[this.address];
      eventWaitBuffer[this.address] = [];
    }
  }
}

/** 按物理 HID 句柄或逻辑 address 释放 vendor 通信缓存 */
export function releaseVendorHidSessionsForPhysicalDevice(
  device?: HIDDevice | null,
  taggedAddress?: string | null,
) {
  const addresses = new Set<string>();
  if (taggedAddress) addresses.add(taggedAddress);

  for (const [addr, entry] of Object.entries(WebHid._cache)) {
    if (device && entry._device === device) {
      addresses.add(addr);
    }
  }

  for (const addr of addresses) {
    const entry = WebHid._cache[addr];
    if (entry?._device) {
      try {
        entry._device.oninputreport = null;
      } catch {
        /* ignore */
      }
    }
    delete globalBuffer[addr];
    eventWaitBuffer[addr] = [];
    delete WebHid._cache[addr];
  }
}

export function releaseAllVendorHidSessions() {
  for (const addr of Object.keys(WebHid._cache)) {
    releaseVendorHidSessionsForPhysicalDevice(undefined, addr);
  }
}

/** USB 拔出时匹配当前已连接键盘（_address / 缓存句柄 / VID+PID） */
export function hidDeviceMatchesConnectedKeyboard(
  physical: HIDDevice | undefined | null,
  connectedAddress: string | undefined | null,
  vendorId?: number,
  productId?: number,
): boolean {
  if (!physical) return false;
  const tagged = (physical as { _address?: string })._address;
  if (tagged && connectedAddress && tagged === connectedAddress) {
    return true;
  }
  for (const entry of Object.values(WebHid._cache)) {
    if (entry._device === physical) {
      if (connectedAddress && entry.address === connectedAddress) return true;
      break;
    }
  }
  if (vendorId != null && productId != null) {
    return physical.vendorId === vendorId && physical.productId === productId;
  }
  return false;
}
