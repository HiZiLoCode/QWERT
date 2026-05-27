import { FilterDevice, WebHidDevice} from "../types/types";
import {
  hidSendReportFast,
  hidSendReportWithRetry,
  withHidOutputWriteLock,
} from "../lib/hidOutputWriteLock";

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
  /** 0x19 连续 OUT：丢弃设备回显 IN，避免 globalBuffer 膨胀（不等 IN） */
  private _bulkWrite19DropIn = false;
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
      if (this._bulkWrite19DropIn) {
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

  /** 每包 0x19 前丢弃未配对的 IN，避免 read(0) 误消费上一包应答后本包不再发 OUT */
  drainAllInputReports() {
    this.clearOtaStaleBuffers();
  }

  beginBulkWrite19() {
    this._bulkWrite19DropIn = true;
    globalBuffer[this.address] = globalBuffer[this.address] || [];
    eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
    globalBuffer[this.address].length = 0;
    eventWaitBuffer[this.address].length = 0;
  }

  endBulkWrite19() {
    this._bulkWrite19DropIn = false;
    globalBuffer[this.address] = globalBuffer[this.address] || [];
    eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
    globalBuffer[this.address].length = 0;
    eventWaitBuffer[this.address].length = 0;
  }

  /**
   * 0x19 写 FLASH：只 OUT 不等 IN（设备仍会 IN 回显，由 drain 丢弃，避免堵死传图）。
   */
  async writeReportOutOnly(reportId: number, data: BufferSource): Promise<void> {
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) throw new Error("HID device not open");
    if (!this._bulkWrite19DropIn) {
      globalBuffer[this.address] = globalBuffer[this.address] || [];
      eventWaitBuffer[this.address] = eventWaitBuffer[this.address] || [];
      globalBuffer[this.address].length = 0;
      eventWaitBuffer[this.address].length = 0;
    }
    await withHidOutputWriteLock(dev, async () => {
      await hidSendReportFast(dev, reportId & 0xff, data);
    });
  }

  /** 单次持锁连续 OUT，减少包间 Promise/清缓冲开销（对齐 OTA 图传 bulk 思路） */
  async writeReportsOutOnlyBurst(
    reportId: number,
    payloads: BufferSource[],
  ): Promise<void> {
    if (!payloads.length) return;
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) throw new Error("HID device not open");
    const rid = reportId & 0xff;
    await withHidOutputWriteLock(dev, async () => {
      for (const data of payloads) {
        await hidSendReportFast(dev, rid, data);
      }
    });
  }

  /**
   * 0x19 整段传图：一次持锁 + 复用 64B OUT 缓冲 + 无每包数组分配（目标 ~2–3ms/包）。
   */
  async writeLcd19PayloadFast(
    reportId: number,
    data: Uint8Array,
    baseAddress: number,
    islandMode: 0 | 1,
    step = 56,
    onPacket?: (transferred: number, total: number) => void,
    progressEveryPackets = 64,
  ): Promise<void> {
    if (!data.length) return;
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) throw new Error("HID device not open");
    const rid = reportId & 0xff;
    const payload = new Uint8Array(64);
    const total = data.length;
    let addr = baseAddress;
    let transferred = 0;
    let sinceProgress = 0;

    this.beginBulkWrite19();
    try {
      await withHidOutputWriteLock(dev, async () => {
        for (let i = 0; i < data.length; i += step) {
          const n = Math.min(step, data.length - i);
          payload[0] = 0xaa;
          payload[1] = 0x19;
          payload[2] = addr & 0xff;
          payload[3] = (addr >> 8) & 0xff;
          payload[4] = (addr >> 16) & 0xff;
          payload[5] = n;
          payload[6] = islandMode;
          if (n < step) {
            payload.fill(0, 8 + n, 64);
          }
          payload.set(data.subarray(i, i + n), 8);
          await hidSendReportFast(dev, rid, payload);
          addr += n;
          transferred += n;
          sinceProgress += 1;
          if (onPacket && sinceProgress >= progressEveryPackets) {
            sinceProgress = 0;
            onPacket(transferred, total);
          }
        }
      });
    } finally {
      this.endBulkWrite19();
    }
    onPacket?.(total, total);
  }

  /**
   * 0x19 专用：为本包单独挂 inputreport 监听，不用共享 eventWaitBuffer（shift 会丢掉等待器）。
   * 抓包 IN 已秒回仍 timeout → 旧路径 IN 进了 globalBuffer 但没进本包 Promise。
   */
  async writeReportAndWaitInput(
    reportId: number,
    data: BufferSource,
    timeoutMs = 3000,
  ): Promise<Uint8Array> {
    await this.open();
    const dev = this._hidDevice?._device;
    if (!dev) throw new Error("HID device not open");

    return new Promise((res, rej) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        dev.removeEventListener("inputreport", onReport);
      };

      const onReport = (e: HIDInputReportEvent) => {
        const msg = new Uint8Array(e.data.buffer);
        if (looksLikeScreenOtaStatusReport(msg)) return;
        if (settled) return;
        settled = true;
        cleanup();
        res(msg);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        rej(new Error("HID read timeout"));
      }, timeoutMs);

      dev.addEventListener("inputreport", onReport);

      void withHidOutputWriteLock(dev, async () => {
        await hidSendReportWithRetry(dev, reportId & 0xff, data);
      }).catch((e) => {
        if (settled) return;
        settled = true;
        cleanup();
        rej(e);
      });
    });
  }

  read(fn: (err?: Error, data?: ArrayBuffer) => void, sinceTime = 0) {
    if (sinceTime > 0) this.fastForwardGlobalBuffer(sinceTime);
    if (globalBuffer[this.address].length > 0) {
      const msg = globalBuffer[this.address].shift()?.message as ArrayBuffer;
      eventWaitBuffer[this.address] = [];
      fn(undefined, msg);
      return;
    }
    eventWaitBuffer[this.address] = [];
    eventWaitBuffer[this.address].push((data) => fn(undefined, data as any));
  }

  readP = promisify((arg: any, sinceTime?: number) => this.read(arg, sinceTime ?? 0));

  /** 0x19 写 FLASH 时片内应答可能远超 10s，须单独加长超时 */
  readPWithTimeout(sinceTime = 0, timeoutMs = 10000): Promise<Uint8Array> {
    return new Promise((res, rej) => {
      let settled = false;
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        rej(new Error("HID read timeout"));
      }, timeoutMs);
      this.read((err, data) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        if (err) rej(err);
        else res(new Uint8Array(data as ArrayBuffer));
      }, sinceTime);
    });
  }

  /**
   * 丢弃「明显早于本次 OUT」的残留 IN。
   * slackMs：IN 常在 hid_write 完成前就进缓冲，若 cutoff=time 会把刚到的应答误删 → read 超时、下一包 OUT 发不出。
   */
  fastForwardGlobalBuffer(time: number, slackMs = 80) {
    const cutoff = Math.max(0, time - slackMs);
    let messagesLeft = globalBuffer[this.address].length;
    while (messagesLeft) {
      messagesLeft--;
      if (globalBuffer[this.address][0].currTime < cutoff) {
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