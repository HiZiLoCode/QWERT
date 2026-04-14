import { LCDScreenAPI, shiftFrom16Bit, shiftTo16Bit } from "./LCDScreenAPI";
import { WebHid } from "./WebHid";
import {
  FilterDevice,
} from "../types/types";
// 连接设备的HID接口
export const connectDeviceHID = async (filters: FilterDevice[] = []): Promise<DeviceComm | undefined> => {
  const devices = await WebHid.devices(false, filters);
  if (devices.length > 1) {
    const sortDevices = devices.sort((a, b) => a.vendorId - b.vendorId)
    return new DeviceComm(new LCDScreenAPI(sortDevices[0].address));
  } else if (devices.length == 1) {
    return new DeviceComm(new LCDScreenAPI(devices[0].address));
  } else {
    return undefined;
  }
};

export const shiftLoFrom16Bit = (value: number): number => {
  return value & 0xFF; // 使用 0xFF 而不是 255，虽然在这里两者等价，但 0xFF 更清晰地表示是8位掩码
};

export const shiftHIFrom16Bit = (value: number): number => {
  return value >> 8; // 右移8位以获取高位字节
};



// 设备通讯接口
export class DeviceComm {

  demoMode: Boolean = false;
  api: LCDScreenAPI;
  vendorId: number = 0;
  productId: number = 0;
  productName: string = "Test Mouse";
  onListeners: Array<{ name: string; fb: Function }> = [];
  mode: string = 'usb';


  onChangeDpi: ((dpi: number) => void) | undefined;

  constructor(api: LCDScreenAPI) {
    this.api = api;
    const hid = this.api.getHID();
    this.vendorId = hid.vendorId;
    this.productId = hid.productId;
    this.productName = hid.productName;
    this.addListeners();
  }

  addListeners() {
    const fn = (evt: HIDInputReportEvent) => {
      //console.log(evt);
      let notifyValue = {};
      const data = new Uint8Array(evt.data.buffer);
      //console.log("addListeners:", data);
      if (data[0] == 0xD1 || data[0] == 0xD2) {
        notifyValue = data;
        console.log(notifyValue);
        const listener = this.onListeners.find(
          (listener) => listener.name == 'statu'
        );
        listener && listener.fb(notifyValue);
      }
    };
    this.api.getHID().addListeners(fn);
  }

  // 获取连接模式
  async getConnectMode() {
    return this.api.getConnectMode();
  }

  // 设置数据
  async setData(data: number[]) {
    return this.api.sendDeviceData(data);
  }

  // 获取设备信息
  async getDeviceInfo() {

    const buffer: number[] = new Array(33).fill(0);
    buffer[0] = 0x00;
    buffer[1] = 0x30;
    const data = await this.setData(buffer);
    return {
      firmware_version: shiftTo16Bit([data[8], data[9]]),
      ic_type: data[10],
      report_max: data[11],
      charge_flag: data[12],
      battery_value: data[13],
      connect_status: data[14]
    }
  }
  // 获取有线无线
  async getConnectStatus() {
    const buffer: number[] = new Array(65).fill(0);
    buffer[1] = 0xAA;
    buffer[2] = 0x1C;
    const data = await this.setData(buffer);
    return {
      connect_status: data[9]
    }
  }

  // 获取屏幕宽高
  async getScreenSize() {
    // 通讯开始
    const beginBuffer: number[] = new Array(65).fill(0);
    beginBuffer[1] = 0xAA;
    beginBuffer[2] = 0x10;
    await this.setData(beginBuffer);
    const buffer: number[] = new Array(65).fill(0);
    buffer[1] = 0xAA;
    buffer[2] = 0x12;
    buffer[6] = 0x38;
    const data = await this.setData(buffer);
    // 通讯结束
    const endBuffer: number[] = new Array(65).fill(0);
    endBuffer[1] = 0xAA;
    endBuffer[2] = 0x11;
    await this.setData(endBuffer);
    console.log(data, 'getScreenSize');

    return {
      width: shiftTo16Bit([data[20], data[21]]),
      height: shiftTo16Bit([data[22], data[23]]),
      maxSereen:data[25]
    }
  }

  // 同步时间
  async syncTime() {
    // 通讯开始
    const beginBuffer: number[] = new Array(65).fill(0);
    beginBuffer[1] = 0xAA;
    beginBuffer[2] = 0x10;
    this.setData(beginBuffer);
    const buffer: number[] = new Array(65).fill(0);
    buffer[1] = 0xAA;
    buffer[2] = 0x17;
    buffer[6] = 0x38;
    const st = new Date();
    console.log(st.getMonth());

    // 年：分成千、百、十、个
    buffer[9] = Math.floor(st.getFullYear() / 1000) % 10;
    buffer[10] = (st.getFullYear() / 100) % 10;
    buffer[11] = (st.getFullYear() / 10) % 10;
    buffer[12] = st.getFullYear() % 10;

    // 月 0 表示一月，11 表示十二月。
    const month = st.getMonth() + 1;
    buffer[13] = Math.floor(month / 10) % 10;
    buffer[14] = month % 10;

    // 星期（0-6，0 表示星期天）
    buffer[15] = st.getDay() % 7;

    // 日
    buffer[16] = (st.getDate() / 10) % 10;
    buffer[17] = st.getDate() % 10;

    // 时
    buffer[18] = (st.getHours() / 10) % 10;
    buffer[19] = st.getHours() % 10;

    // 分
    buffer[20] = (st.getMinutes() / 10) % 10;
    buffer[21] = st.getMinutes() % 10;

    // 秒
    buffer[22] = (st.getSeconds() / 10) % 10;
    buffer[23] = st.getSeconds() % 10;
    this.setData(buffer);
    // 通讯结束
    const endBuffer: number[] = new Array(65).fill(0);
    endBuffer[1] = 0xAA;
    endBuffer[2] = 0x11;
    this.setData(endBuffer);
  }
  // 发送图片数据
  async sendImageData(data: number[]) {
    this.setData(data);
  }
}