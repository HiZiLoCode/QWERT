import { FilterDevice, WebHidDevice} from "../types/types";

const globalBuffer: {
  [path: string]: { currTime: number; message: Uint8Array }[];
} = {};

const eventWaitBuffer: {
  [path: string]: ((a: Uint8Array) => void)[];
} = {};

// 发送后，等待500毫秒，如果没有数据，则不再等待
const promisify = (cb: Function) => () => {
  return Promise.race([
    new Promise((res, rej) => {
      cb((e: any, d: any) => {
        if (e) 
          rej(e);
        else 
          res(d);
      });
    }),
    new Promise((resolve, reject) => {
      setTimeout(() => {resolve([])}, 1000)
    })
  ])
};

// 根据usage和usagePage, 筛选HID设备
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        (collection.usagePage === 0x00ff && collection.usage === 0x0001)
    )
  );

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
    const sortDevices = devices.sort((a, b) => a.productId - b.productId)
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

  devices: async (requestAuthorize = false, filters:FilterDevice[] = []) => {
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
  interface: number = -1;
  vendorId: number = -1;
  productId: number = -1;
  productName: string = "";
  address: string = "";
  openPromise: Promise<void> = Promise.resolve();
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
      if (!this._hidDevice._device.opened) {
        this.open();
      }
    }
  }

  async open() {
    if (this._hidDevice && !this._hidDevice._device.opened) {
      this.openPromise = this._hidDevice._device.open();
      this.setupListeners();
      try {
        await this.openPromise;
      } catch (error) {
       console.log(error) 
      }
    }
    return Promise.resolve();
  }

  // 添加Input事件监听
  addListeners(fn: (this: HIDDevice, ev: HIDInputReportEvent) => any) {
    if (this._hidDevice) {
      this._hidDevice._device.oninputreport = fn;
    }
  }

  // 安装Input事件监听
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
    eventWaitBuffer[this.address] = [];
    this.fastForwardGlobalBuffer(Date.now());
    if (globalBuffer[this.address].length > 0) {
      // this should be a noop normally
      fn(undefined, globalBuffer[this.address].shift()?.message as any);
    } else {
      eventWaitBuffer[this.address].push((data) => fn(undefined, data as any));
    }
  }

  readP = promisify((arg: any) => this.read(arg));

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

  // hid 写入数据
  async hid_write(buffer: number[]) {
    await this.openPromise;
    const data = new Uint8Array(buffer.slice(1));
    //console.log("SetDeviceData", data, new Date().getMilliseconds);
    await this._hidDevice?._device.sendReport(buffer[0], data);
  }

  // hid 发送 feature数据
  async hid_send_feature_report(reportId: number, buffer: number[]) {
    await this.openPromise;
    const data = new Uint8Array(buffer.slice(1));
    await this._hidDevice?._device.sendFeatureReport(reportId, data);
    return await this._hidDevice?._device.receiveFeatureReport(reportId);
  }

  // hid 获取 feature数据
  async hid_get_feature_report(reportId: number, buffer: number[]) {
    await this.openPromise;
    const data = new Uint8Array(buffer.slice(1));
    return await this._hidDevice?._device.receiveFeatureReport(reportId);
  }
}