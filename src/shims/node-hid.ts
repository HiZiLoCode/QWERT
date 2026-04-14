import type {
  AuthorizedDevice,
  ConnectedDevice,
  WebKbDevice,
} from "../types/types";
// This is a bit cray
const globalBuffer: {
  [path: string]: { currTime: number; message: Uint8Array }[];
} = {};
const eventWaitBuffer: {
  [path: string]: ((a: Uint8Array) => void)[];
} = {};
const filterHIDDevices = (devices: HIDDevice[]) =>
  devices.filter((device) =>
    device.collections?.some(
      (collection) =>
        collection.usage === 0x61 && collection.usagePage === 0xff60
    )
  );

const getKbPathIdentifier = () =>
  (self.crypto && self.crypto.randomUUID && self.crypto.randomUUID()) ||
  `kb-path:${Math.random()}`;

const tagDevice = (device: HIDDevice): WebKbDevice => {
  // This is super important in order to have a stable way to identify the same device
  // that was already scanned. It's a bit hacky but https://github.com/WICG/webhid/issues/7
  // ¯\_(ツ)_/¯
  const address = (device as any).__address || getKbPathIdentifier();
  (device as any).__address = address;
  const HIDDevice = {
    _device: device,
    usage: 0x61,
    usagePage: 0xff60,
    interface: 0x0001,
    vendorId: device.vendorId ?? -1,
    productId: device.productId ?? -1,
    address,
    productName: device.productName,
  };
  return (ExtendedHID._cache[address] = HIDDevice) as unknown as WebKbDevice;
};

// Attempt to forget device
export const tryForgetDevice = (device: ConnectedDevice | AuthorizedDevice) => {
  const cachedDevice = ExtendedHID._cache[device.path];
  if (cachedDevice) {
    return cachedDevice._device.forget();
  }
};

const ExtendedHID = {
  _cache: {} as { [key: string]: WebKbDevice },
  requestDevice: async () => {
    const requestedDevice = await navigator.hid.requestDevice({
      filters: [
        {
          vendorId: 0x0c45,
          productId: 0x0500,
          usagePage: 0xff05,
          usage: 0x0010,
        },
      ],
    });
    requestedDevice.forEach(tagDevice);
    return requestedDevice[0];
  },
  getFilteredDevices: async () => {
    try {
      const hidDevices = filterHIDDevices(await navigator.hid.getDevices());
      return hidDevices;
    } catch (e) {
      return [];
    }
  },
  devices: async (requestAuthorize = false) => {
    let devices = await ExtendedHID.getFilteredDevices();
    // TODO: This is a hack to avoid spamming the requestDevices popup
    if (devices.length === 0 || requestAuthorize) {
      try {
        await ExtendedHID.requestDevice();
      } catch (e) {
        // The request seems to fail when the last authorized device is disconnected.
        return [];
      }
      devices = await ExtendedHID.getFilteredDevices();
    }
    return devices.map(tagDevice);
  },
  HID: class HID {
    _hidDevice?: WebKbDevice;
    interface: number = -1;
    vendorId: number = -1;
    productId: number = -1;
    productName: string = "";
    address: string = "";
    openPromise: Promise<void> = Promise.resolve();
    constructor(address: string) {
      this._hidDevice = ExtendedHID._cache[address];
      // TODO: seperate open attempt from constructor as it's async
      // Attempt to connect to the device

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
      } else {
        throw new Error("Missing hid device in cache");
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
    // Should we unsubscribe at some point of time
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
      this.fastForwardGlobalBuffer(Date.now() - 1000);
      if (globalBuffer[this.address].length > 0) {
        // this should be a noop normally
        fn(undefined, globalBuffer[this.address].shift()?.message as any);
      } else {
        eventWaitBuffer[this.address].push((data) => fn(undefined, data));
      }
    }

    readP = promisify((arg: any) => this.read(arg));

    // The idea is discard any messages that have happened before the time a command was issued
    // since time-travel is not possible yet...
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

    async write(arr: number[]) {
      await this.openPromise;
      const data = new Uint8Array(arr.slice(1));
      await this._hidDevice?._device.sendReport(0, data);
    }
  },
};

const promisify = (cb: Function) => () => {
  return new Promise((res, rej) => {
    cb((e: any, d: any) => {
      if (e) rej(e);
      else res(d);
    });
  });
};
export const HID = ExtendedHID;
