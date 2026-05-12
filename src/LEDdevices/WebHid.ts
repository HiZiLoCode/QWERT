import { FilterDevice, WebHidDevice} from "../types/types";
import { hidSendReportWithRetry, withHidOutputWriteLock } from "../lib/hidOutputWriteLock";

const globalBuffer: {
  [path: string]: { currTime: number; message: Uint8Array }[];
} = {};

const eventWaitBuffer: {
  [path: string]: ((a: Uint8Array) => void)[];
} = {};

// 发送后等待设备应答；超过超时时间视为失败（由上层决定重试/断连）
// 不用 Promise.race：读先成功时若仍 reject 超时，会产生 Uncaught (in promise) HID read timeout
const promisify = (cb: Function) => (...args: any[]) => {
  return new Promise((res, rej) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      rej(new Error('HID read timeout'));
    }, 10000);
    cb((e: any, d: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      if (e) rej(e);
      else res(d);
    }, ...args);
  });
};

// 根据usage和usagePage, 筛选HID设备
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        (collection.usagePage === 0x00ff && collection.usage === 0x0001)
    )
  );

/**
 * 屏幕 DFU / 图传 OTA 的 IN 与 AA 业务帧不同形；此类包若进 globalBuffer 会与 readP 抢应答，二次 OTA 常在未满 100 包 bulk 处卡住。
 */
function looksLikeScreenOtaStatusReport(u8: Uint8Array): boolean {
  const addr = 0xff;
  const cmds = new Set([0x61, 0x65, 0x66, 0x70, 0x68, 0x64]);
  const maxOff = Math.min(8, Math.max(0, u8.length - 2));
  for (let off = 0; off <= maxOff; off++) {
    if (u8[off] === addr && cmds.has(u8[off + 1]!)) return true;
  }
  return false;
}

// 生成一个随机的地址
const getRandomAdress = () => {
  return (
    (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
    `path:${Math.random()}`
  );
};

// 添加设备信息
const addDeviceInfo = (device: HIDDevice): WebHidDevice => {
  const address = (device as any)._address || getRandomAdress();
  (device as any)._address = address;
  const webHidDevice: WebHidDevice = {
    _device: device,
    interface: 0x0002,
    vendorId: device.vendorId ?? -1,
    productId: device.productId ?? -1,
    address,
    productName: device.productName || "Unknown Device",
    reportId: 0,
    reportSize: 64,
    reportCount: 1
  };
  return (WebHid.hid_cache[address] = webHidDevice);
};

export const WebHid = {

  // HID设备缓存
  hid_cache: {} as { [address: string]: WebHidDevice },

  requestDevice: async (filters: FilterDevice[] = []) => {
    // 请求用户选择 HID 设备
    const devices = await navigator.hid.requestDevice({
      filters: filters
    });
    // 添加设备
    devices.forEach(addDeviceInfo);
    const sortDevices = devices.sort((a, b) => a.productId - b.productId);
    return sortDevices[0];
  },

  getFilteredDevices: async () => {
    try {
      const hidDevices = filterHIDDevices(await navigator.hid.getDevices());
      return hidDevices;
    } catch (e) {
      return [];
    }
  },

  devices: async (requestAuthorize = false, filters: FilterDevice[] = []) => {
    let devices = await WebHid.getFilteredDevices();
    if (devices.length === 0 || requestAuthorize) {
      try {
        await WebHid.requestDevice(filters);
      } catch (error) {
        return [];
      }
      devices = await WebHid.getFilteredDevices();
    }
    return devices.map(addDeviceInfo);
  }
};

export class HidDeivce {

  _hidDevice: WebHidDevice | undefined;
  /** 避免 close 后再 open 时重复 addEventListener 导致同一条 IN 被多次入队 */
  private _internalInputReportHandler: ((e: HIDInputReportEvent) => void) | null = null;
  interface: number = -1;
  vendorId: number = -1;
  productId: number = -1;
  productName: string = "";
  address: string = "";
  openPromise: Promise<void> = Promise.resolve();
  /** 合并并发 open()：构造里不再抢先 open，避免与 hid_write 里 await open 双开 */
  private _hidOpenOnce: Promise<void> | null = null;

  constructor(address: string) {
    
    if (address == 'demo') {
      this.vendorId = 0x9a9a;
      this.productId = 0xbaba;
      this.productName = 'Test'
      return ;
    }

    this._hidDevice = WebHid.hid_cache[address];
    if (this._hidDevice) {
      this.vendorId = this._hidDevice.vendorId;
      this.productId = this._hidDevice.productId;
      this.address = this._hidDevice.address;
      this.interface = this._hidDevice.interface;
      this.productName = this._hidDevice.productName;
      globalBuffer[this.address] = globalBuffer[this.address] || [];
      eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
    }
  }

  async open() {
    if (!this._hidDevice) return;
    const dev = this._hidDevice._device;
    if (dev.opened) return;

    this._hidOpenOnce ??= (async () => {
      try {
        if (!this._hidDevice || this._hidDevice._device.opened) return;
        this.openPromise = this._hidDevice._device.open();
        this.setupListeners();
        await this.openPromise;
      } catch (error) {
        console.log(error);
      } finally {
        this._hidOpenOnce = null;
      }
    })();

    await this._hidOpenOnce;
  }

  // 添加Input事件监听
  addListeners(fn: (this: HIDDevice, ev: HIDInputReportEvent) => any) {
    if (this._hidDevice) {
      this._hidDevice._device.oninputreport = fn;
    }
  }

  // 安装Input事件监听
  setupListeners() {
    if (!this._hidDevice) return;
    const dev = this._hidDevice._device;
    if (this._internalInputReportHandler) {
      dev.removeEventListener("inputreport", this._internalInputReportHandler);
      this._internalInputReportHandler = null;
    }
    this._internalInputReportHandler = (e: HIDInputReportEvent) => {
      const msg = new Uint8Array(e.data.buffer);
      if (looksLikeScreenOtaStatusReport(msg)) {
        return;
      }
      if (eventWaitBuffer[this.address].length !== 0) {
        (eventWaitBuffer[this.address].shift() as any)(msg);
      } else {
        globalBuffer[this.address].push({
          currTime: Date.now(),
          message: msg,
        });
      }
    };
    dev.addEventListener("inputreport", this._internalInputReportHandler);
  }

  /** OTA 结束或再次开传前清空，避免二次升级读到上一次残留 IN */
  clearOtaStaleBuffers() {
    if (!this.address) return;
    globalBuffer[this.address] = globalBuffer[this.address] || [];
    eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
    globalBuffer[this.address].length = 0;
    eventWaitBuffer[this.address].length = 0;
  }

  read(fn: (err?: Error, data?: ArrayBuffer) => void, sinceTime = 0) {
    eventWaitBuffer[this.address] = [];
    if (sinceTime > 0) this.fastForwardGlobalBuffer(sinceTime);
    if (globalBuffer[this.address].length > 0) {
      // this should be a noop normally
      fn(undefined, globalBuffer[this.address].shift()?.message as any);
    } else {
      eventWaitBuffer[this.address].push((data) => fn(undefined, data as any));
    }
  }

  readP = promisify((arg: any, sinceTime?: number) => this.read(arg, sinceTime ?? 0));

  fastForwardGlobalBuffer(time: number) {
    let messagesLeft = globalBuffer[this.address].length;
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

  /** 与 WebHID 屏幕 OTA 共用：已打开的 HIDDevice（勿在此处 close，由上层 MainProvider 管理） */
  getWebHidDevice(): HIDDevice | undefined {
    return this._hidDevice?._device;
  }

  // hid 写入数据（与 OTA 直连 sendReport 共用设备时须串行 + 重试）
  async hid_write(buffer: number[]) {
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) return;
    const data = new Uint8Array(buffer.slice(1));
    const reportId = buffer[0] ?? 0;
    await withHidOutputWriteLock(dev, async () => {
      await hidSendReportWithRetry(dev, reportId, data);
    });
  }

  /** LCDScreenAPI.webhid_send_report 使用：与 hid_write 同一套 OUT 锁 */
  async send(reportId: number, buffer: number[]) {
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) return;
    const data = new Uint8Array(buffer);
    await withHidOutputWriteLock(dev, async () => {
      await hidSendReportWithRetry(dev, reportId & 0xff, data);
    });
  }

  // hid 发送 feature数据
  async hid_send_feature_report(reportId: number, buffer: number[]) {
    await this.open();
    const data = new Uint8Array(buffer.slice(1));
    await this._hidDevice?._device.sendFeatureReport(reportId, data);
    return await this._hidDevice?._device.receiveFeatureReport(reportId);
  }

  // hid 获取 feature数据
  async hid_get_feature_report(reportId: number, buffer: number[]) {
    await this.open();
    const data = new Uint8Array(buffer.slice(1));
    return await this._hidDevice?._device.receiveFeatureReport(reportId);
  }
}