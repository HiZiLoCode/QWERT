import { WebHidDevice } from "../types/types";
import { deviceInfo } from "../config/deviceInfo";
const globalBuffer: {
  [path: string]: { currTime: number; message: Uint8Array }[];
} = {};

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

// 过滤通信端点设备 (原有)
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        collection.usagePage === USAGE_PAGE_VENDOR && collection.usage === USAGE_VENDOR
    )
  );

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
const generateHIDFiltersV2 = (deviceInfo) => {
  const filters = deviceInfo.map((device) => {
    return {
      vendorId: device.vendorId, // VID 固定值
      productId: device.productId, // PID 在指定区间内
      usagePage: 0xff60, // usagePage
      usage: 0x0061, // usage
    };
  });
  return filters;
};
export const WebHid = {
  _cache: {} as { [address: string]: WebHidDevice },
  _notifyCache: {} as { [address: string]: HIDDevice },  // 通知端点缓存

  requestDevice: async () => {
    // 固定 VID 和 PID 区间
    const vendorId = 0x36b0; // 键盘 VID
    const pidStart = 0x2000; // 起始 PID
    const pidEnd = 0x352f; // 结束 PID
    // 生成过滤器
    let filters;
    if (Object.values(deviceInfo).length > 0) {
      console.log(deviceInfo);

      filters = generateHIDFiltersV2(Object.values(deviceInfo));
    } else {
      filters = generateHIDFilters(vendorId, pidStart, pidEnd);
    }
    // 额外追加一个“通用过滤器”：不限制 VID/PID，只按 usagePage/usage 匹配
    // 这样即使设备不在 deviceInfo 列表里，也能在授权弹窗里被选到
    //（仍然会被 usage 约束，不会把无关 HID 设备全放出来）
    filters = [
      ...filters,
      { usagePage: USAGE_PAGE_VENDOR, usage: USAGE_VENDOR },
    ];
    // 请求设备
    const devices = await navigator.hid.requestDevice({ filters });

    if (devices.length === 0) {
      return null;
    }
    devices.forEach(tagDevice);
    return devices[0];
  },

  getFilteredDevices: async () => {
    try {
      const result = await navigator.hid.getDevices();
      const hidDevices = filterHIDDevices(await navigator.hid.getDevices());
      return hidDevices;
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
    if (this._hidDevice) {
      this._hidDevice._device.addEventListener("inputreport", (e) => {
        if (eventWaitBuffer[this.address].length !== 0) {
          // It should be impossible to have a handler in the buffer
          // that has a ts that happened after the current message
          // came in
          (eventWaitBuffer[this.address].shift() as any)(
            new Uint8Array(e.data.buffer)
          );
        } else {
          globalBuffer[this.address].push({
            currTime: Date.now(),
            message: new Uint8Array(e.data.buffer),
          });
        }
      });
    }
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
    const data = new Uint8Array(arr.slice(1));
    this.fastForwardGlobalBuffer(Date.now());
    eventWaitBuffer[this.address] = [];
    await this._hidDevice?._device.sendReport(0, data);
  }

  async writeMany(packets: number[][]) {
    await this.openPromise;
    this.fastForwardGlobalBuffer(Date.now());
    eventWaitBuffer[this.address] = [];
    for (const packet of packets) {
      const data = new Uint8Array(packet.slice(1));
      await this._hidDevice?._device.sendReport(0, data);
    }
  }
}
