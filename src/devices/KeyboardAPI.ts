import { HidDeivce } from "./WebHid";
import _ from "lodash";
import { hexToRgba } from "@uiw/color-convert";
// 定义命令类型和队列参数类型
type Command = number;
type CommandQueueArgs = [number, Array<number>] | (() => Promise<void>);
type CommandQueueEntry = {
  res: (val?: any) => void;
  rej: (error?: any) => void;
  args: CommandQueueArgs;
};
type CommandQueue = Array<CommandQueueEntry>;
// 存储设备缓存信息
const cache: { [addr: string]: { hid: any } } = {};
// 存储每个地址的命令队列信息
const globalCommandQueue: {
  [address: string]: { isFlushing: boolean; commandQueue: CommandQueue };
} = {};
// 16位转换工具函数
export const shiftTo16Bit = ([lo, hi]: [number, number]): number =>
  (hi << 8) | lo;

export const shiftFrom16Bit = (value: number): [number, number] => [
  value & 255,
  value >> 8,
];
// 初始化并连接到设备
const initAndConnectDevice = (address: string) => {
  return new HidDeivce(address);
};
// 定义一些常用命令常量
const HEAD = 0x5c;
const CRC_CODE = 0x35;
const CMD_BASEINFO = 0x1;
const CMD_FUNC = 0x0;
const CMD_KEY = 0x23;
const CMD_TRAVEL = 0x29;
const CMD_DEFAULT_KEY = 0x2b;
const CMD_MATRIX = 0x12;
const CMD_MT = 0x24;
const CMD_TGL = 0x25;
const CMD_DKS = 0x26;
const CMD_MACRO = 0x20;
const CMD_SOCD = 0x2c;
const CMD_RBG = 0x18;
const CMD_RBG_KEY = 0x2a;
// 键盘API类
export class KeyboardAPI {
  address: string;
  test: boolean = false;
  deviceMode: number = 0
  /**
   * 构造函数，用于初始化设备连接
   * @param address 设备地址
   */
  constructor(address: string, deviceMode: number) {
    this.address = address;
    this.deviceMode = deviceMode //设置设备模式（0: 有线; 1：2.4G; 2：蓝牙）
    if (address == "demo") {
      this.test = true;
      cache[address] = { hid: new HidDeivce(address) };
    } else {
      if (!cache[address]) {
        const device = initAndConnectDevice(address);
        cache[address] = { hid: device };
      }
    }
  }
  // 刷新设备连接
  refresh(address: string) {
    this.address = address;
    cache[address] = { hid: initAndConnectDevice(address) };
  }
  // 获取命令队列
  get commandQueueWrapper() {
    if (!globalCommandQueue[this.address]) {
      globalCommandQueue[this.address] = {
        isFlushing: false,
        commandQueue: [],
      };
      return globalCommandQueue[this.address];
    }
    return globalCommandQueue[this.address];
  }
  // 设置延迟函数
  async timeout(time: number) {
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: () =>
          new Promise((r) =>
            setTimeout(() => {
              r();
              res(undefined);
            }, time)
          ),
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }
  // 获取设备信息
  async getInfo() {
    const data = await this.sendDeviceData(0x55, [0x03, 0x00, 0x20, 0x20]);
    return data.slice(8);
  }
  // 获取基础信息
  async getBase() {
    const data = await this.sendDeviceData(0x55, [0x04, 0x00, 0x20, 0x20]);
    return data.slice(8);
  }
  // 获取键位矩阵
  async getKeyMatrix(
    profile: number,
    layer: number,
    isDefault: boolean = false
  ) {
    let bytesP = [];
    const bufferSize = [56,24][this.deviceMode];
    const command = isDefault ? 0x07 : 0x08;
    const profileSize = 512 * 4;
    const layerSize = 512;
    for (
      let offset = layerSize * layer;
      offset < layerSize * (layer + 1);
      offset += bufferSize
    ) {
      const size = Math.min(layerSize * (layer + 1) - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset + profile * profileSize);
      const checkSum = (lo + hi + size) & 0xff;
      bytesP.push(
        this.getDeviceData(0x55, [command, 0, checkSum, size, lo, hi])
      );
    }
    const allBytes = await Promise.all(bytesP);
    const keyData = allBytes.flatMap((bytes) => bytes.slice(8));
    return keyData.slice(0, 512);
  }
  // 获取布局键
  async getLayoutKey(): Promise<number[]> {
    const keyData = [];
    for (let index = 0; index < 3; index++) {
      const data = [0x0, index * 2, index * 2 + 1];
      const crc = 0x35 + 0x5c + 3 + 0x2b + data[2];
      const res = await this.getDeviceData(0x5c, [0x3, 0x2b, crc, ...data]);

      keyData[res[5]] = res.slice(6, 27);
      keyData[res[27]] = res.slice(28, 49);
    }
    return keyData.flat();
  }
  // 获取用户按键数据
  async getUserKeys(data: number[], length: number = 0) {
    const crc = (0x35 + 0x5c + length + 0x23 + data[length - 1]) & 0xff;
    const res = await this.getDeviceData(0x5c, [length, 0x23, crc, ...data]);
    return res.slice(5, 61);
  }
  // 设置用户按键
  async setUserKeys(data: number[]) {
    const dataArr = _.chunk(data, 56);
    for (let index = 0; index < dataArr.length; index++) {
      const data = dataArr[index];
      const crc =
        (0x35 + 0x5c + data.length + 1 + 0x23 + data[data.length - 1]) & 0xff;
      await this.getDeviceData(0x5c, [data.length + 1, 0x23, crc, 1, ...data]);
    }
  }
  // 设置单个用户按键
  async setUserKey(data: number[]) {
    const crc =
      (0x35 + 0x5c + data.length + 1 + 0x23 + data[data.length - 1]) & 0xff;
    await this.getDeviceData(0x5c, [data.length + 1, 0x23, crc, 1, ...data]);
  }
  // 获取灯光配置
  async getLightConfig() {
    const data = new Array(42).fill(0);
    return await this.getDeviceData(0x5c, [
      0x2c,
      0x18,
      0xd4,
      ...data,
      0xff,
      0xff,
    ]);
  }

  // 获取功能配置
  async getFuncConfig(profile: number) {
    let bytesP = [];
    const bufferSize = [56,24][this.deviceMode];
    const command = 0x05;
    const profileSize = 64;

    const [lo, hi] = shiftFrom16Bit(profile * 64);
    const checkSum = (lo + hi + bufferSize) & 0xff;
    bytesP.push(
      this.getDeviceData(0x55, [command, 0, checkSum, bufferSize, lo, hi])
    );

    const allBytes = await Promise.all(bytesP);
    const keyData = allBytes.flatMap((bytes) => bytes.slice(8));
    return keyData.slice(0, profileSize);
  }

  // 设置功能配置
  async setFuncConfig(profile, data) {
    const command = 0x06;
    const profileSize = 64;
    const offset = profileSize * profile;
    await this.sendData(command, offset, data);
  }

  // 设置灯光模式
  async setLightConfig(keyboardLight: any, profileIndex = 0) {
    const lightData = await this.api.getLightConfigData(profileIndex);
    const { light, direct, superRet, brightness, effect, speed } =
      keyboardLight;
    lightData[8] = effect;
    lightData[9] = brightness;
    lightData[10] = speed;
    if (light.singleColor) {
      const rgb = hexToRgba(light.color);
      lightData[12] = 0;
      lightData[14] = rgb.r;
      lightData[15] = rgb.g;
      lightData[16] = rgb.b;
    }
    console.log(lightData);
    await this.api.setLightConfigData(profileIndex, [...lightData]);
  }
  // 发送数据
  async sendData(command, offset, data) {
    const bufferSize = [56,24][this.deviceMode];
    for (let index = 0; index < data.length;) {
      const dataLength = Math.min(bufferSize, data.length - index);
      const [lo, hi] = shiftFrom16Bit(offset + index);
      const buffer = data.slice(index, index + dataLength);
      const newdata = [dataLength, lo, hi, 0, ...buffer];
      const checkSum = _.sum(newdata) & 0xff;
      await this.sendDeviceData(0x55, [command, 0x0, checkSum, ...newdata]);
      index += dataLength;
    }
  }
  // 发送设备数据
  async sendDeviceData(
    command: Command,
    bytes: Array<number> = [],
  ): Promise<number[]> {
    if (this.test) return new Array(64).fill(0);
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: [command, bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }

  // 发送设备数据（无需等待响应）- 用于固件升级等高速场景
  async sendDeviceDataNoWait(
    command: Command,
    bytes: Array<number> = [],
  ): Promise<void> {
    const commandBytes = [0, command, ...bytes];
    const paddedArray = new Array([65, 33][this.deviceMode]).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    await this.getHID().write(paddedArray);
    console.debug(
      `Command (NoWait) for ${this.address}`,
      commandBytes
    );
  }

  // 获取设备数据
  async getDeviceData(
    command: Command,
    bytes: Array<number> = [],
  ): Promise<number[]> {
    if (this.test) return new Array(64).fill(0);
    return new Promise((res, rej) => {
      this.commandQueueWrapper.commandQueue.push({
        res,
        rej,
        args: [command, bytes],
      });
      if (!this.commandQueueWrapper.isFlushing) {
        this.flushQueue();
      }
    });
  }
  // 刷新命令队列
  async flushQueue() {
    if (this.commandQueueWrapper.isFlushing === true) {
      return;
    }
    this.commandQueueWrapper.isFlushing = true;
    while (this.commandQueueWrapper.commandQueue.length !== 0) {
      const { res, rej, args } =
        this.commandQueueWrapper.commandQueue.shift() as CommandQueueEntry;
      // This allows us to queue promises in between hid commands, useful for timeouts
      if (typeof args === "function") {
        await args();
        res();
      } else {
        try {
          const ans = await this.webhid_write_command(...args);
          res(ans) ;
        } catch (e: any) {
          rej(e);
        }
      }
    }
    this.commandQueueWrapper.isFlushing = false;
  }
  // 获取HID设备实例
  getHID() {
    if (this.address) {
      return cache[this.address].hid;
    }
    return null;
  }
  // 读取HID命令
  async webhid_read_command(): Promise<Uint8Array> {
    return this.getHID().readP();
  }
  // 通过WebHID发送数据到键盘
  async webhid_write_command(
    command: Command,
    bytes: Array<number> = [],
  ): Promise<any> {
    const commandBytes = [0, command, ...bytes];
    const paddedArray = new Array([65, 33][this.deviceMode]).fill(0);
    commandBytes.forEach((val, idx) => {
      paddedArray[idx] = val;
    });

    await this.getHID().write(paddedArray);
    const buffer = Array.from(await this.webhid_read_command());
    console.debug(
      `Command for ${this.address}`,
      // commandBytes.map((e) => e.toString(16)),
      commandBytes,
      "Correct Resp:",
      // buffer.map((e) => e.toString(16))
      buffer
    );
    return buffer;
  }
}
