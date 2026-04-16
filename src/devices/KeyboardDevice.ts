import { hexToRgba, rgbaToHex, rgbaToHsva } from "@uiw/color-convert";
import {
  getKeyboardKeyFromKeycode,
  getKeycodeFromKeyboardKey,
  getNameFromKeyCode,
  eventCode2Keycode,
  getKeyName,
  getKeyCode,
  hidKeycode2EventCode,
} from "../keyboard/keycode";
import {
  baseTestData,
  kbNameTestData,
  layoutKeyTestData,
  travelConfigTestData,
} from "../keyboard/test";
import {
  DeviceBaseInfo,
  FunInfo,
  AdvancedKey,
  KeyboardBase,
  KeyboardKey,
  KeyboardLight,
  MacroProfile,
  TravelConfig,
  TravelKey,
} from "../types/types_v1";
import { KeyboardAPI, shiftFrom16Bit, shiftTo16Bit } from "./KeyboardAPI";
import { tagDevice, WebHid } from "./WebHid";
import type { WebHidDevice } from "../types/types";
import _ from "lodash";
import { hexToRgb } from "@mui/material";
import { CMD_V2, CMD_V1, CMD_V3 } from "./cmdVersions";

export const shiftTo24Bit = ([lo, mid, hi]: [number, number, number]): number =>
  (hi << 16) | (mid << 8) | lo;

export const shiftFrom24Bit = (value: number): [number, number, number] => [
  value & 255, // 低 8 位
  (value >> 8) & 255, // 中 8 位
  (value >> 16) & 255, // 高 8 位
];

/** V2 功能区：0x3059 为 72 字节有效载荷（含 NumLockMode 等），与标准 59 字节 V2 区分 */
const PID_FUNCINFO_V2_LAYOUT_71 = 0x3059;

// WebHID 支持检测接口
interface BrowserSupport {
  isSupported: boolean;
  browserName: string;
  recommendedBrowser: string;
}
interface lightSpeed {
  lightMaxSpeed: number,
  logoLightMaxSpeed: number,
  sideLightMaxSpeed: number,
  matrixScreenLightMaxSpeed?: number
}
/**
 * 检查浏览器是否支持 WebHID
 * @returns BrowserSupport 对象
 */
const checkWebHIDSupport = (): BrowserSupport => {
  // 检测当前浏览器
  const getBrowser = (): string => {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf("Chrome") > -1) return "Chrome";
    if (userAgent.indexOf("Firefox") > -1) return "Firefox";
    if (userAgent.indexOf("Safari") > -1) return "Safari";
    if (userAgent.indexOf("Edge") > -1) return "Edge";
    return "Unknown";
  };

  const browserName = getBrowser();
  const isSupported = "hid" in navigator;

  return {
    isSupported,
    browserName,
    recommendedBrowser: "Chrome 89+ 或 Edge 89+",
  };
};

/**
 * 连接HID设备
 * @param mode 连接模式
 * @throws {Error} 当浏览器不支持 WebHID 时抛出错误
 */
export const connectHID = async (
  mode: string = "demo",
  requestAuthorize?: boolean,
  selectedDevices?: WebHidDevice[]
): Promise<KeyboardDevice | undefined> => {
  // 检查 WebHID 支持
  const support = checkWebHIDSupport();

  if (!support.isSupported) {
    const errorMessage = `您的浏览器 (${support.browserName}) 不支持 WebHID。\n请使用 ${support.recommendedBrowser} 访问。`;
    throw new Error(errorMessage);
  }

  try {
    const devices = selectedDevices ?? await WebHid.devices(requestAuthorize);
    console.log(devices);
    
    // devices.
    if (devices?.length > 0) {
      return new KeyboardDevice(new KeyboardAPI(devices[0].address, devices[0].productId === 12290 ? 1 : 0));
    }
  } catch (error) {
    console.error("连接HID设备失败:", error);
    throw error;
  }
};
// 获取已授权的设备
export const getAccreditDevice = async () => {
  const devices = await WebHid.getFilteredDevices();
  const pidStart = 0x2000; // 起始 PID
  const pidEnd = 0x352f; // 结束 PID
  console.log(devices);

  const devicesList = devices
    .filter(
      (device) =>
        device && (device.productId >= pidStart && device.productId <= pidEnd) || [0x2731, 0x119B, 0x119C, 0x6040].includes(device.productId)

    ) // 根据 productId 过滤设备
    .map((device) => {
      return tagDevice(device); // 处理设备
    });

  return devicesList;
};
let CMD: any = CMD_V2

// 定义处理后的宏动作接口
interface ProcessedMacroAction {
  code: number;
  time: number;
  type: 1 | 2; // 1 表示按下, 2 表示释放
}
export class KeyboardDevice {
  api: KeyboardAPI;
  vendorId: number = 0;
  productId: number = 0;
  productName: string = "Test Keyboard";
  listeners: Array<{ name: string; fn: Function }> = [];
  test: boolean = false;
  keys: number[] = [];
  deviceMode: number = 0
  deviceBaseInfo: lightSpeed
  constructor(api: KeyboardAPI) {
    // 在构造函数中也检查 WebHID 支持
    const support = checkWebHIDSupport();
    if (!support.isSupported) {
      throw new Error(
        `您的浏览器 (${support.browserName}) 不支持 WebHID。\n请使用 ${support.recommendedBrowser} 访问。`
      );
    }

    this.api = api;
    this.test = api.test;
    const hid = this.api.getHID();
    this.vendorId = hid.vendorId;
    this.productId = hid.productId;
    this.productName = hid.productName;
    this.deviceMode = hid.productId === 12290 ? 1 : 0
    this.addListeners();
    this.deviceBaseInfo = {
      lightMaxSpeed: 6,
      logoLightMaxSpeed: 6,
      sideLightMaxSpeed: 6,
      matrixScreenLightMaxSpeed: 6,
    }
  }
  private saveSpeedState(data: DeviceBaseInfo) {
    if (!data) return
    this.deviceBaseInfo.lightMaxSpeed = data.lightMaxSpeed ?? this.deviceBaseInfo.lightMaxSpeed
    this.deviceBaseInfo.logoLightMaxSpeed = data.logoLightMaxSpeed ?? this.deviceBaseInfo.logoLightMaxSpeed
    this.deviceBaseInfo.sideLightMaxSpeed = data.sideLightMaxSpeed ?? this.deviceBaseInfo.sideLightMaxSpeed
    this.deviceBaseInfo.matrixScreenLightMaxSpeed = data.matrixScreenLightMaxSpeed ?? this.deviceBaseInfo.matrixScreenLightMaxSpeed
  }
  addListeners() {
    // 通信端点监听 (原有)
    const fn = (evt: HIDInputReportEvent) => {
      const data = Array.from(new Uint8Array(evt.data.buffer));
      console.log(data);
      
      if (data[0] == 0xaa && data[1] == 0xd0) {
        const listener = this.listeners.find(
          (listener) => listener.name == "devNotify"
        );
        console.log(listener);

        if (listener) {
          console.log("11111", listener);
          listener.fn(data);
        }
      }
    };
    this.api.getHID().addListeners(fn);

    // 通知端点监听 (新增)
    this.initNotifyListener();
    this.init8kListener()
  }

  // 初始化通知端点监听 (新增)
  async initNotifyListener() {
    const hid = this.api.getHID();
    await hid.initNotifyDevice();

    /**
     * 处理HID输入报告事件的回调函数
     * @param {HIDInputReportEvent} evt - HID输入报告事件对象，包含设备发送的数据
     */
    const notifyFn = (evt: HIDInputReportEvent) => {
      const data = Array.from(new Uint8Array(evt.data.buffer));
      // console.log("[NotifyEndpoint] 收到通知数据:", data);
      if (data[0] == 0xaa && data[1] == 0x55) {
        // 查找通知监听器并触发
        console.log(this.listeners);
        
        const listener = this.listeners.find(
          (listener) => listener.name == "consumerNotify"
        );
        if (listener) {
          listener.fn(data);
        }
      }

    };

    hid.addNotifyListeners(notifyFn);
  }
  // 添加8k键盘端点监听
  async init8kListener() {
    const hid = this.api.getHID();
    await hid.initDevice();

    const fn = (evt: HIDInputReportEvent) => {
      const data = Array.from(new Uint8Array(evt.data.buffer));
      // console.log("[KeyboardEndpoint] 收到键盘数据:", data);

      // 查找键盘监听器并触发
      const listener = this.listeners.find((listener) => listener.name == "8KdevNotify")
      
      if (listener) {
        listener.fn(data);
      }
    }
    hid.addNotifyListeners(fn);
  }

  // 添加8K键盘固件升级端点监听 (新增 - 用于固件升级ACK响应)
  async init8kUpgradeListener() {
    const hid = this.api.getHID();
    await hid.initDevice();

    const upgradeFn = (evt: HIDInputReportEvent) => {
      const data = Array.from(new Uint8Array(evt.data.buffer));
      console.log("[8KUpgradeEndpoint] 收到固件升级响应数据:", data);

      // 查找固件升级监听器并触发
      const listener = this.listeners.find((listener) => listener.name == "8KUpgradeNotify");
        
      if (listener) {
        console.log("[8KUpgradeEndpoint] 触发固件升级监听器");
        listener.fn(data);
      }
    };

    // 使用通信端点接收固件升级的ACK响应
    hid.addListeners(upgradeFn);
    console.log("[8KUpgradeEndpoint] 固件升级监听器已添加");
  }
  async getKeyboardLayout(deviceLayout: string) {
    console.log(deviceLayout, "-----------deviceLayout");

    try {
      const conf = await import(`@/data/keyboardLayout/${deviceLayout}.json`);
      return conf;
    }catch (error) {
      
    }
  }

  parseNoColorEffectIds(showIf?: string): Set<number> {
    const result = new Set<number>()
    if (!showIf) return result

    // 匹配：!= 24、!=28、!=  32
    const regex = /!=\s*(\d+)/g
    let match: RegExpExecArray | null

    while ((match = regex.exec(showIf)) !== null) {
      result.add(Number(match[1]))
    }

    return result
  }
  // 处理背光灯效
  async convertQmkEffectsToBacklight(
    effects: [string, number][],
    colorShowIf?: string
  ) {
    const noColorEffectIds = this.parseNoColorEffectIds(colorShowIf)

    return effects.map(([label, value]) => ({
      name: label,
      value,
      brightness: true,
      speed: value !== 0,
      direction: false,
      color: !noColorEffectIds.has(value),
      palette: true
    }))
  }
  // 开始通讯
  async startComm() {
    return this.api.sendDeviceData(CMD.REPORT_ID, [CMD.CMD_START_COMM, 0x00, 0x00, 0x00]);
  }
  // 结束通讯
  async stopComm() {
    this.api.sendDeviceData(CMD.REPORT_ID, [CMD.CMD_STOP_COMM, 0x00, 0x00, 0x00]);
  }
  // 2.4G获取连接状态
  async getConnStatus() {
    const data = await this.api.sendDeviceData(CMD.REPORT_ID, [0xD0, 0x00, 0x00, 0x00]);
    return {
      // 键盘数量
      keyboardNum: data[8],
      // 键盘PID
      vendorId: shiftTo16Bit([data[9], data[10]]),
      productId: shiftTo16Bit([data[11], data[12]]),
      // 键盘连接状态 0:默认 1:空闲 2:配对 3:回连 4:连接成功 5:休眠
      status: data[13] == 4 ? true : false,
    }
  }
  // 屏幕点亮
  async lightOn() {
    try {
      this.startComm()
      const data = await this.api.sendDeviceData(CMD.REPORT_ID, [CMD.CMD_SET_LIGHT_ON, 0x00, 0x00, 0x00]);
      this.stopComm()
      console.log(data);

      return true
    } catch {
      return false
    }
  }
  // 查看屏幕在线状态
  async checkLightStatus() {
    const data = await this.api.sendDeviceData(CMD.REPORT_ID, [CMD.CMD_CHECK_LIGHT_STATUS, 0x00, 0x00, 0x00]);
    console.log(data);
    return {
      status: data[8] == 1 ? true : false,
    }
  }
  // 获取设备基本信息

  async getDeviceBaseInfo(): Promise<DeviceBaseInfo | {}> {
    const fetchChunk = async (offset: number, size: number): Promise<number[]> => {
      const [lo, hi] = shiftFrom16Bit(offset);
      return await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_DEVICEINFO,
        lo,
        hi,
        size,
      ]);
    };

    const chunkSize = [0x38, 0x18][this.deviceMode]; // 0x38 = 完整包，0x18 = 分包模式
    let offset = 0;
    const maxLength = 47; // 我们只关心 data[0] ~ data[46]
    let result: number[] = [];

    while (result.length < maxLength) {
      let chunk = await fetchChunk(offset, chunkSize);

      // 数据合法性检查
      if (chunk[0] !== CMD.REPORT_ID || chunk[1] !== CMD.CMD_GET_DEVICEINFO || chunk[7] !== 0x55) {
        await this.api.timeout(100);
        chunk = await fetchChunk(offset, chunkSize);
        if (chunk[0] !== CMD.REPORT_ID || chunk[1] !== CMD.CMD_GET_DEVICEINFO || chunk[7] !== 0x55) {
          console.warn("设备信息数据无效");
          return {};
        }
      }

      // 拼接数据（去掉报文头部前 8 字节），并限制长度不超过 maxLength
      const needed = maxLength - result.length;
      result = result.concat(chunk.slice(8, 8 + needed));

      offset += chunkSize; // 下一包偏移
    }

    if (!result.length) return {};
    console.log(result);

    const protocolVer = result[8];
    CMD = [CMD_V1, CMD_V2, CMD_V3][protocolVer - 1] || CMD_V2;
    console.log(protocolVer, 'protocolVer');

    // 根据协议解析
    if (protocolVer === 1 || result.length <= 35) {

      const data = {
        vendorId: shiftTo16Bit([result[2], result[3]]),
        productId: shiftTo16Bit([result[4], result[5]]),
        firmwareVer: shiftTo16Bit([result[6], result[7]]),
        protocolVer,
        profile: result[9],
        keyboardID: result[10],
        keyboardType: result[11],
        keyMatrixSize: result[12],
        macroSize: result[13],
        showLight: result[14] === 1,
        lightSize: result[15],
        lightMaxBrightness: result[16],
        lightMaxSpeed: result[17],
        lightKeySize: result[18],
        showLogoLight: result[19] === 1,
        logoLightSize: result[20],
        logoLightMaxBrightness: result[21],
        logoLightMaxSpeed: result[22],
        showLightSideLight: result[23] === 1,
        sideLightSize: result[24],
        sideLightMaxBrightness: result[25],
        sideLightMaxSpeed: result[26],
      } as DeviceBaseInfo;
      this.saveSpeedState(data);
      return data
    }

    // V2 / V3 协议
    const data = {
      vendorId: shiftTo16Bit([result[2], result[3]]),
      productId: shiftTo16Bit([result[4], result[5]]),
      firmwareVer: shiftTo16Bit([result[6], result[7]]),
      protocolVer,
      profile: result[9],
      keyboardID: result[10],
      keyboardType: result[11],
      keyMatrixSize: result[12],
      macroSize: result[13],
      showLight: result[14] === 1,
      lightSize: result[15],
      lightMaxBrightness: result[16],
      lightMaxSpeed: result[17],
      lightKeySize: result[18],
      showLogoLight: result[19] === 1,
      logoLightModeSize: result[20],
      logoLigthSize: result[21],
      logoLightMaxBrightness: result[22],
      logoLightMaxSpeed: result[23],
      logoLightSupportMusic: result[24] === 1,
      showLightSideLight: result[25] === 1,
      sideLightModeSize: result[26],
      sideLightSize: result[27],
      sideLightMaxBrightness: result[28],
      sideLightMaxSpeed: result[29],
      sideLightSupportMusic: result[30] === 1,
      matrixScreen: result[31] === 1,
      matrixScreenLightSize: result[32],
      matrixScreenLightRows: result[33],
      matrixScreenLightColumns: result[34],
      matrixScreenLightMaxBrightness: result[35],
      matrixScreenLightMaxSpeed: result[36],
      encoder: result[37] === 1,
      isLed: result[38] === 1,
    } as DeviceBaseInfo;
    this.saveSpeedState(data);
    return data
  }

  // 获取功能区信息
  async getFuncInfo(isProtocolVer2 = 2): Promise<FunInfo | {}> {
    const fetchChunk = async (offset: number, size: number): Promise<number[]> => {
      const [lo, hi] = shiftFrom16Bit(offset);
      const resp = await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_FUNCINFO,
        lo,
        hi,
        size,
      ]);
      return resp;
    };

    if (isProtocolVer2 === 1) {
      // --- V1 协议，直接一次性取 ---
      let data = await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_FUNCINFO,
        0x00,
        0x00,
        [0x38, 0x18][this.deviceMode],
      ]);

      if (
        data[0] !== CMD.REPORT_ID ||
        data[1] !== CMD.CMD_GET_FUNCINFO ||
        data[7] !== 0x55
      ) {
        await this.api.timeout(100);
        data = await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_GET_FUNCINFO,
          0x00,
          0x00,
          [0x38, 0x18][this.deviceMode],
        ]);
      }

      if (
        data[0] === CMD.REPORT_ID &&
        data[1] === CMD.CMD_GET_FUNCINFO &&
        data[7] === 0x55
      ) {
        const buf = data.slice(8);
        return {
          profile: buf[0],
          lightSwitch: buf[1],
          lightMode: buf[2],
          lightBrightness: buf[3],
          lightSpeed: this.deviceBaseInfo.lightMaxSpeed - buf[4],
          lightMixColor: buf[5],
          lightColorIndex: buf[6],
          lightRValue: buf[7],
          lightGValue: buf[8],
          lightBValue: buf[9],
          lightCustomIndex: buf[10],
          logoLightSwitch: buf[11],
          logoLightMode: buf[12],
          logoLightBrightness: buf[13],
          logoLightSpeed: this.deviceBaseInfo.logoLightMaxSpeed - buf[14],
          logoLightMixColor: buf[15],
          logoLightColorIndex: buf[16],
          logoLightRValue: buf[17],
          logoLightGValue: buf[18],
          logoLightBValue: buf[19],
          sideLightSwitch: buf[20],
          sideLightMode: buf[21],
          sideLightBrightness: buf[22],
          sideLightSpeed: this.deviceBaseInfo.sideLightMaxSpeed - buf[23],
          sideLightMixColor: buf[24],
          sideLightColorIndex: buf[25],
          sideLightRValue: buf[26],
          sideLightGValue: buf[27],
          sideLightBValue: buf[28],
          sixKeysOrAllKeys: buf[29],
          maxOrWin: buf[30],
          winLock: buf[31],
          keyWasd: buf[32],
          scanDelay: buf[33],
          layerDefault: buf[34],
          sleepTime: shiftTo24Bit([buf[35], buf[36], buf[37]]),
          deepSleepTime: shiftTo24Bit([buf[38], buf[39], buf[40]]),
          snapTap: buf[41]
        }
      }
      return {};
    }

    // --- V2 协议：分包读取 ---
    const v2FuncTotalBytes =
      this.productId === PID_FUNCINFO_V2_LAYOUT_71 ? 76 : 59;
    const bufferSize = [0x38, 0x18][this.deviceMode];  // 每次最大取 56 bytes
    let result: number[] = [];

    for (let offset = 0; offset < v2FuncTotalBytes; offset += bufferSize) {
      const size = Math.min(v2FuncTotalBytes - offset, bufferSize);
      let resp = await fetchChunk(offset, size);

      if (
        resp[0] !== CMD.REPORT_ID ||
        resp[1] !== CMD.CMD_GET_FUNCINFO ||
        resp[7] !== 0x55
      ) {
        await this.api.timeout(100);
        resp = await fetchChunk(offset, size);
      }

      if (
        resp[0] === CMD.REPORT_ID &&
        resp[1] === CMD.CMD_GET_FUNCINFO &&
        resp[7] === 0x55
      ) {
        result = result.concat(resp.slice(8));
      }
    }

    if (result.length < v2FuncTotalBytes) {
      return {};
    }

    // --- 解析 V2（0x3059 为 72 字节：灯带 LT + LCD 扩展 + 灯效方向 + NumLockMode 等）---
    const base: FunInfo = {
      profile: result[0],
      lightSwitch: result[1],
      lightMode: result[2],
      lightBrightness: result[3],
      lightSpeed: this.deviceBaseInfo.lightMaxSpeed - result[4],
      lightMixColor: result[5],
      lightColorIndex: result[6],
      lightRValue: result[7],
      lightGValue: result[8],
      lightBValue: result[9],
      lightCustomIndex: result[10],

      logoLightSwitch: result[11],
      logoLightMode: result[12],
      logoLightBrightness: result[13],
      logoLightSpeed: this.deviceBaseInfo.logoLightMaxSpeed - result[14],
      logoLightMixColor: result[15],
      logoLightColorIndex: result[16],
      logoLightRValue: result[17],
      logoLightGValue: result[18],
      logoLightBValue: result[19],

      sideLightSwitch: result[20],
      sideLightMode: result[21],
      sideLightBrightness: result[22],
      sideLightSpeed: this.deviceBaseInfo.sideLightMaxSpeed - result[23],
      sideLightMixColor: result[24],
      sideLightColorIndex: result[25],
      sideLightRValue: result[26],
      sideLightGValue: result[27],
      sideLightBValue: result[28],

      matrixScreenLightSwitch: result[29] === 1,
      matrixScreenLightMode: result[30],
      matrixScreenLightBrightness: result[31],
      matrixScreenLightSpeed: result[32],
      matrixScreenLightMixColor: result[33],
      matrixScreenLightColorIndex: result[34],
      matrixScreenLightRValue: result[35],
      matrixScreenLightGValue: result[36],
      matrixScreenLightBValue: result[37],

      sixKeysOrAllKeys: result[38],
      maxOrWin: result[39],
      winLock: result[40],
      keyWasd: result[41],
      scanDelay: result[42],
      layerDefault: result[43],

      fSwitch: result[44] === 1,
      wheelDefaultMode: result[45],

      sleepTime: shiftTo24Bit([result[46], result[47], result[48]]),
      deepSleepTime: shiftTo24Bit([result[49], result[50], result[51]]),

      lcdScreenLightSwitch: result[52] === 1,
      lcdScreenLightMode: result[53],
      lcdScreenLightBrightness: result[54],
      lcdScreenMaxGif: result[55],
      lcdScreenLanguage: result[56],
      lcdScreenUsbEnum: result[57] === 1,
      snapTap: result[58] === 1,
    };

    if (this.productId === PID_FUNCINFO_V2_LAYOUT_71 && result.length >= 76) {
      return {
        ...base,
        lcdScreenPage: result[59],
        lcdDynamicIsland: result[60],
        lcdCustomTimeRValue: result[61],
        lcdCustomTimeGValue: result[62],
        lcdCustomTimeBValue: result[63],
        lcdCustomBatteryRValue: result[64],
        lcdCustomBatteryGValue: result[65],
        lcdCustomBatteryBValue: result[66],
        lcdCustomIconRValue: result[67],
        lcdCustomIconGValue: result[68],
        lcdCustomIconBValue: result[69],
        lightEffectDirection: result[70],
        numLockMode: result[71],
        pickupLightEffectSwitch: result[72],
        pickupLightEffectDirection: result[73],
        pickupLightFpsLevel: result[74],
        pickupLightFpsDefine: result[75],
      };
    }

    return base;
  }
  // 设置功能区信息
  async setFuncInfo(data: FunInfo, isProtocolVer2 = 2) {
    if ([2, 3].includes(isProtocolVer2)) {
      // --- V2：仅 0x3059 下发满 128 字节（尾部补 0），其余设备仍为 64 字节 ---
      const isFuncLayout71 = this.productId === PID_FUNCINFO_V2_LAYOUT_71;
      console.log(isFuncLayout71,data,'isFuncLayout71');
      
      const buffer: number[] = new Array(isFuncLayout71 ? 128 : 64).fill(0);
      buffer[0] = data.profile || 0;
      buffer[1] = data.lightSwitch || 0;
      buffer[2] = data.lightMode || 0;
      buffer[3] = data.lightBrightness || 0;
      buffer[4] = this.deviceBaseInfo.lightMaxSpeed - (data.lightSpeed || 0);
      buffer[5] = data.lightMixColor || 0;
      buffer[6] = data.lightColorIndex || 0;
      buffer[7] = data.lightRValue || 0;
      buffer[8] = data.lightGValue || 0;
      buffer[9] = data.lightBValue || 0;
      buffer[10] = data.lightCustomIndex || 0;

      buffer[11] = data.logoLightSwitch || 0;
      buffer[12] = data.logoLightMode || 0;
      buffer[13] = data.logoLightBrightness || 0;
      buffer[14] = this.deviceBaseInfo.logoLightMaxSpeed - (data.logoLightSpeed || 0);
      buffer[15] = data.logoLightMixColor || 0;
      buffer[16] = data.logoLightColorIndex || 0;
      buffer[17] = data.logoLightRValue || 0;
      buffer[18] = data.logoLightGValue || 0;
      buffer[19] = data.logoLightBValue || 0;

      buffer[20] = data.sideLightSwitch || 0;
      buffer[21] = data.sideLightMode || 0;
      buffer[22] = data.sideLightBrightness || 0;
      buffer[23] = this.deviceBaseInfo.sideLightMaxSpeed - (data.sideLightSpeed || 0);
      buffer[24] = data.sideLightMixColor || 0;
      buffer[25] = data.sideLightColorIndex || 0;
      buffer[26] = data.sideLightRValue || 0;
      buffer[27] = data.sideLightGValue || 0;
      buffer[28] = data.sideLightBValue || 0;

      buffer[29] = data.matrixScreenLightSwitch ? 1 : 0;
      buffer[30] = data.matrixScreenLightMode || 0;
      buffer[31] = data.matrixScreenLightBrightness || 0;
      buffer[32] = data.matrixScreenLightSpeed || 0;
      buffer[33] = isFuncLayout71
        ? data.matrixScreenLightMixColor ?? 0
        : 0; // 标准 V2 灯带 mix 位未下发；0x3059 灯带 LT 与 BL/LG/SD 同结构
      buffer[34] = data.matrixScreenLightColorIndex || 0;
      buffer[35] = data.matrixScreenLightRValue || 0;
      buffer[36] = data.matrixScreenLightGValue || 0;
      buffer[37] = data.matrixScreenLightBValue || 0;

      buffer[38] = data.sixKeysOrAllKeys || 0;
      buffer[39] = data.maxOrWin || 0;
      buffer[40] = data.winLock || 0;
      buffer[41] = data.keyWasd || 0;
      buffer[42] = data.scanDelay || 0;
      buffer[43] = data.layerDefault || 0;
      buffer[44] = data.fSwitch ? 1 : 0;
      buffer[45] = data.wheelDefaultMode || 0;

      const [lo, mid, hi] = shiftFrom24Bit(data.sleepTime);
      buffer[46] = lo;
      buffer[47] = mid;
      buffer[48] = hi;

      const [deeplo, deepmid, deephi] = shiftFrom24Bit(data.deepSleepTime);
      buffer[49] = deeplo;
      buffer[50] = deepmid;
      buffer[51] = deephi;

      buffer[52] = data.lcdScreenLightSwitch ? 1 : 0;
      buffer[53] = data.lcdScreenLightMode || 0;
      buffer[54] = data.lcdScreenLightBrightness || 0;
      buffer[55] = data.lcdScreenMaxGif || 0;
      buffer[56] = data.lcdScreenLanguage || 0;
      buffer[57] = data.lcdScreenUsbEnum ? 1 : 0;
      buffer[58] = data.snapTap ? 1 : 0;

      if (isFuncLayout71) {
        buffer[59] = data.lcdScreenPage ?? 0;
        buffer[60] = data.lcdDynamicIsland ?? 0;
        buffer[61] = data.lcdCustomTimeRValue ?? 0;
        buffer[62] = data.lcdCustomTimeGValue ?? 0;
        buffer[63] = data.lcdCustomTimeBValue ?? 0;
        buffer[64] = data.lcdCustomBatteryRValue ?? 0;
        buffer[65] = data.lcdCustomBatteryGValue ?? 0;
        buffer[66] = data.lcdCustomBatteryBValue ?? 0;
        buffer[67] = data.lcdCustomIconRValue ?? 0;
        buffer[68] = data.lcdCustomIconGValue ?? 0;
        buffer[69] = data.lcdCustomIconBValue ?? 0;
        buffer[70] = data.lightEffectDirection ?? 0;
        buffer[71] = data.numLockMode ?? 0;
        buffer[72] = data.pickupLightEffectSwitch ?? 0;
        buffer[73] = data.pickupLightEffectDirection ?? 0;
        buffer[74] = data.pickupLightFpsLevel ?? 0;
        buffer[75] = data.pickupLightFpsDefine ?? 0;
      }

      await this.startComm();

      const bufferSize = [0x38, 0x18][this.deviceMode];
      const totalSize = buffer.length;
      for (let offset = 0; offset < totalSize; offset += bufferSize) {
        const size = Math.min(totalSize - offset, bufferSize);
        const chunk = buffer.slice(offset, offset + size);
        const [lo, hi] = shiftFrom16Bit(offset);
        const checkSum = 0;
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_FUNCINFO,
          lo,
          hi,
          size,
          checkSum,
          0x00,
          0x00,
          ...chunk,
        ]);
      }
      // await this.stopComm();
    } else {
      // --- V1 兼容 ---
      const buffer: number[] = new Array(41).fill(0);
      buffer[0] = data.profile || 0;
      buffer[1] = data.lightSwitch || 0;
      buffer[2] = data.lightMode || 0;
      buffer[3] = data.lightBrightness || 0;
      buffer[4] = data.lightSpeed || 0;
      buffer[5] = data.lightMixColor || 0;
      buffer[6] = data.lightColorIndex || 0;
      buffer[7] = data.lightRValue || 0;
      buffer[8] = data.lightGValue || 0;
      buffer[9] = data.lightBValue || 0;
      buffer[10] = data.lightCustomIndex || 0;
      buffer[11] = data.logoLightSwitch || 0;
      buffer[12] = data.logoLightMode || 0;
      buffer[13] = data.logoLightBrightness || 0;
      buffer[14] = data.logoLightSpeed || 0;
      buffer[15] = data.logoLightMixColor || 0;
      buffer[16] = data.logoLightColorIndex || 0;
      buffer[17] = data.logoLightRValue || 0;
      buffer[18] = data.logoLightGValue || 0;
      buffer[19] = data.logoLightBValue || 0;
      buffer[20] = data.sideLightSwitch || 0;
      buffer[21] = data.sideLightMode || 0;
      buffer[22] = data.sideLightBrightness || 0;
      buffer[23] = data.sideLightSpeed || 0;
      buffer[24] = data.sideLightMixColor || 0;
      buffer[25] = data.sideLightColorIndex || 0;
      buffer[26] = data.sideLightRValue || 0;
      buffer[27] = data.sideLightGValue || 0;
      buffer[28] = data.sideLightBValue || 0;

      buffer[29] = data.sixKeysOrAllKeys || 0;
      buffer[30] = data.maxOrWin || 0;
      buffer[31] = data.winLock || 0;
      buffer[32] = data.keyWasd || 0;
      buffer[33] = data.scanDelay || 0;
      buffer[34] = data.layerDefault || 0;

      const [lo, mid, hi] = shiftFrom24Bit(data.sleepTime);
      buffer[35] = lo;
      buffer[36] = mid;
      buffer[37] = hi;

      const [deeplo, deepmid, deephi] = shiftFrom24Bit(data.deepSleepTime);
      buffer[38] = deeplo;
      buffer[39] = deepmid;
      buffer[40] = deephi;
      buffer[41] = data.snapTap ? 1 : 0;
      await this.startComm();

      const bufferSize = [0x38, 0x18][this.deviceMode];
      const totalSize = buffer.length;
      for (let offset = 0; offset < totalSize; offset += bufferSize) {
        const size = Math.min(totalSize - offset, bufferSize);
        const chunk = buffer.slice(offset, offset + size);
        const [lo, hi] = shiftFrom16Bit(offset);
        const checkSum = 0;
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_FUNCINFO,
          lo,
          hi,
          size,
          checkSum,
          0x00,
          0x00,
          ...chunk,
        ]);
      }
      // await this.stopComm();
    }
  }

  // 获取灯光矩阵屏实际使用的灯光模式`
  async getLightMode() {
    const data = await this.api.getDeviceData(CMD.REPORT_ID, [
      CMD.CMD_GET_LIGHT_MODE,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    return data;
  }
  // 读取灯光矩阵自定义灯光数据
  async getLightMatrixCustomData(matrix: number) {
    await this.startComm();
    const totalSize = matrix * 3;
    const bufferSize = [0x38, 0x18][this.deviceMode];
    let data = [];
    for (let offset = 0; offset < totalSize; offset += bufferSize) {
      const size = Math.min(totalSize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const chunk = await this.api.getDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_USER_LIGHT_DATA,
        lo,
        hi,
        size,
        checkSum

      ])
      data = data.concat(chunk.slice(8));
    }
    // await this.stopComm();
    const keyColor = new Array(matrix).fill("");
    for (let index = 0; index < matrix; index++) {
      keyColor[index] = rgbaToHex({
        r: data[index * 3],
        g: data[index * 3 + 1],
        b: data[index * 3 + 2],
        a: 1,
      });
    }

    return keyColor;

  }
  // 写入灯光矩阵自定义灯光数据
  async setLighttMatrixCustomData(data: number[]) {
    await this.startComm();
    const bufferSize = [0x38, 0x18][this.deviceMode];
    for (let offset = 0; offset < data.length; offset += bufferSize) {
      const size = Math.min(data.length - offset, bufferSize);
      const chunk = data.slice(offset, offset + size);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      // 十六进制截取

      await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_SET_USER_LIGHT_DATA,
        lo,
        hi,
        size,
        checkSum,
        0x00,
        0x00,
        ...chunk,
      ])
    }
    // await this.stopComm();
  }
  // 同步设置灯光矩阵灯光同步
  async syncLightMatrix() {
    const data = await this.api.sendDeviceData(CMD.REPORT_ID, [
      CMD.CMD_SET_LIGHT_SYNC,
      0x00,
      0x00,
      [0x38, 0x18][this.deviceMode],
      0x00,
    ]);
    return data
  }
  // sendPixelData(data: number[]) {
  //   const bufferSize = 56;
  //   let data = await this.api.sendDeviceData(
  //     CMD.REPORT_ID,
  //     [0x14, 0x00, 0x00, 0x38]
  //   );
  // }
  // 获取默认按键矩阵数据
  async getDefaultKeyMatrixData(layer: number) {
    let command: number = CMD.CMD_GET_DEFAULT_0;
    if (layer == 1) {
      command = CMD.CMD_GET_DEFAULT_1;
    } else if (layer == 2) {
      command = CMD.CMD_GET_DEFAULT_2;
    } else if (layer == 3) {
      command = CMD.CMD_GET_DEFAULT_3;
    }
    // 从设备读取按键数据数据
    let keyData = [];
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const keySize = 512;
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const data = await this.api.getDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,
        checkSum,
      ]);
      keyData = keyData.concat(data.slice(8));
    }
    //console.log("getKeyMatrixData keyData", keyData);

    // 解析按键数据
    const maxKeyCnt = 128;
    let newKeyInfos = [];
    for (let i = 0; i < maxKeyCnt; i++) {
      const [type, code1, code2] = keyData.slice(i * 3, i * 3 + 3);
      if (type == 0x10 || type == 0x50 || type == 0x30) {
        const code = getKeyCode(type, code1, code2);
        const name = getKeyName({ type, code1, code2 });
        newKeyInfos.push({
          type,
          code1,
          code2,
          code,
          name,
          profile: 1,
          layer: 0,
          index: i,
        });
      } else {
        const name = getKeyName({ type, code1, code2 }) || "";
        newKeyInfos.push({
          type: type,
          code1: code1,
          code2: code2,
          code: 0,
          name,
          profile: 1,
          layer: 0,
          index: i,
        });
      }
    }
    //console.log("getKeyMatrixData newKeyInfos", newKeyInfos);
    return newKeyInfos;
  }

  // 获取按键矩阵数据
  async getKeyMatrixData(layer: number) {
    let command: number = CMD.CMD_GET_USERKEY_0;
    if (layer == 1) {
      command = CMD.CMD_GET_USERKEY_1;
    } else if (layer == 2) {
      command = CMD.CMD_GET_USERKEY_2;
    } else if (layer == 3) {
      command = CMD.CMD_GET_USERKEY_3;
    }
    // 从设备读取按键数据数据
    let keyData = [];
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const keySize = 512;
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const data = await this.api.getDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,
        checkSum,
      ]);
      keyData = keyData.concat(data.slice(8));
    }
    //console.log("getKeyMatrixData keyData", keyData);

    // 解析按键数据
    const maxKeyCnt = 128;
    let newKeyInfos = [];
    for (let i = 0; i < maxKeyCnt; i++) {
      const [type, code1, code2] = keyData.slice(i * 3, i * 3 + 3);
      if (
        type == 0x10 ||
        type == 0x12 ||
        type == 0x20 ||
        type == 0x30 ||
        type == 0x40 ||
        type == 0x50 ||
        type == 0x60
      ) {
        const code = getKeyCode(type, code1, code2);
        const name = getKeyName({ type, code1, code2 });
        newKeyInfos.push({
          type,
          code1,
          code2,
          code,
          name,
          profile: 1,
          layer: 0,
          index: i,
        });
      } else {
        const name = getKeyName({ type, code1, code2 }) || "";
        newKeyInfos.push({
          type: type,
          code1: code1,
          code2: code2,
          code: 0,
          name,
          profile: 1,
          layer: 0,
          index: i,
        });
      }
    }
    //console.log("getKeyMatrixData newKeyInfos", newKeyInfos);
    return newKeyInfos;
  }

  // 设置按键矩阵数据
  async setKeyMatrixData(
    layer: number,
    keyIndex: number,
    keyType: number,
    newValue1: number,
    newValue2: number
  ) {


    let command: number = CMD.CMD_SET_USERKEY_0;
    const offset = keyIndex * 3;
    const [lo, hi] = shiftFrom16Bit(offset);

    if (layer == 1) {
      command = CMD.CMD_SET_USERKEY_1;
    } else if (layer == 2) {
      command = CMD.CMD_SET_USERKEY_2;
    } else if (layer == 3) {
      command = CMD.CMD_SET_USERKEY_3;
    }
    console.log(CMD.REPORT_ID, [
      command,
      lo,
      hi,
      0x03,
      0x00,
      0x00,
      0x00,
      keyType,
      newValue1,
      newValue2,
    ]);
    await this.startComm();

    await this.api.sendDeviceData(CMD.REPORT_ID, [
      command,
      lo,
      hi,
      0x03,
      0x00,
      0x00,
      0x00,
      keyType,
      newValue1,
      newValue2,
    ]);
    // await this.stopComm();
  }
  async setRestoreDefaultKeys(layer: number, defaultKeys: any[]) {
    // 选择对应层的命令
    const commandMap = [
      CMD.CMD_SET_USERKEY_0,
      CMD.CMD_SET_USERKEY_1,
      CMD.CMD_SET_USERKEY_2,
      CMD.CMD_SET_USERKEY_3,
    ];
    const command = commandMap[layer] ?? CMD.CMD_SET_USERKEY_0;

    const bufferSize = [0x38, 0x18][this.deviceMode]; // 一次可发送的字节数
    const KEY_UNIT_SIZE = 3; // type, code1, code2
    const totalKeys = defaultKeys.length;

    // 预生成 keyData：连续的字节数组
    const keyData: number[] = new Array(totalKeys * KEY_UNIT_SIZE);
    for (let i = 0; i < totalKeys; i++) {
      const pos = i * KEY_UNIT_SIZE;
      keyData[pos] = defaultKeys[i].type & 0xff;
      keyData[pos + 1] = defaultKeys[i].code1 & 0xff;
      keyData[pos + 2] = defaultKeys[i].code2 & 0xff;
    }

    // 分包发送
    const keySize = keyData.length; // 总字节数
    await this.startComm();
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);

      // 分段偏移（按字节）
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;

      // 按 offset 和 size 取出本段字节
      const payload = keyData.slice(offset, offset + size);

      await this.api.sendDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,     // 本次字节数
        checkSum,
        0x00,
        0x00,
        ...payload,
      ]);
    }

    await this.stopComm();
  }
  // 设置用户灯光模式
  async setUserLightInfo(data: FunInfo, lightId: number, isV2 = 2) {
    console.log("setUserLightInfo", data);

    let buffer: number[]
    if (isV2 == 1) {
      // V1 构造
      buffer = new Array(56).fill(0);
      buffer[0] = data.profile;
      buffer[1] = data.lightSwitch;
      buffer[2] = 0xfd;
      buffer[3] = data.lightBrightness;
      buffer[4] = data.lightSpeed;
      buffer[5] = data.lightMixColor;
      buffer[6] = data.lightColorIndex;
      buffer[7] = data.lightRValue;
      buffer[8] = data.lightGValue;
      buffer[9] = data.lightBValue;
      buffer[10] = data.lightCustomIndex;
      buffer[11] = data.logoLightSwitch;
      buffer[12] = data.logoLightMode;
      buffer[13] = data.logoLightBrightness;
      buffer[14] = data.logoLightSpeed;
      buffer[15] = data.logoLightMixColor;
      buffer[16] = data.logoLightColorIndex;
      buffer[17] = data.logoLightRValue;
      buffer[18] = data.logoLightGValue;
      buffer[19] = data.logoLightBValue;
      buffer[20] = data.sideLightSwitch;
      buffer[21] = data.sideLightMode;
      buffer[22] = data.sideLightBrightness;
      buffer[23] = data.sideLightSpeed;
      buffer[24] = data.sideLightMixColor;
      buffer[25] = data.sideLightColorIndex;
      buffer[26] = data.sideLightRValue;
      buffer[27] = data.sideLightGValue;
      buffer[28] = data.sideLightBValue;
      buffer[29] = data.sixKeysOrAllKeys;
      buffer[30] = data.maxOrWin;
      buffer[31] = data.winLock;
      buffer[32] = data.keyWasd;
      buffer[33] = data.scanDelay;
      buffer[34] = data.layerDefault;

      const [lo, mid, hi] = shiftFrom24Bit(data.sleepTime);
      buffer[35] = lo;
      buffer[36] = mid;
      buffer[37] = hi;

      const [deeplo, deepmid, deephi] = shiftFrom24Bit(data.deepSleepTime);
      buffer[38] = deeplo;
      buffer[39] = deepmid;
      buffer[40] = deephi;
      buffer[41] = data.snapTap ? 1 : 0;
    } else if (isV2 == 1) {

      // V2 构造
      buffer = new Array(58).fill(0);
      buffer[0] = data.profile;
      buffer[1] = data.lightSwitch;
      buffer[2] = data.lightMode;
      buffer[3] = data.lightBrightness;
      buffer[4] = 6 - data.lightSpeed;
      buffer[5] = data.lightMixColor;
      buffer[6] = data.lightColorIndex;
      buffer[7] = data.lightRValue;
      buffer[8] = data.lightGValue;
      buffer[9] = data.lightBValue;
      buffer[10] = data.lightCustomIndex;

      buffer[11] = data.logoLightSwitch;
      buffer[12] = data.logoLightMode;
      buffer[13] = data.logoLightBrightness;
      buffer[14] = 6 - data.logoLightSpeed;
      buffer[15] = data.logoLightMixColor;
      buffer[16] = data.logoLightColorIndex;
      buffer[17] = data.logoLightRValue;
      buffer[18] = data.logoLightGValue;
      buffer[19] = data.logoLightBValue;

      buffer[20] = data.sideLightSwitch;
      buffer[21] = data.sideLightMode;
      buffer[22] = data.sideLightBrightness;
      buffer[23] = 6 - data.sideLightSpeed;
      buffer[24] = data.sideLightMixColor;
      buffer[25] = data.sideLightColorIndex;
      buffer[26] = data.sideLightRValue;
      buffer[27] = data.sideLightGValue;
      buffer[28] = data.sideLightBValue;

      buffer[29] = data.matrixScreenLightSwitch ? 1 : 0;
      buffer[30] = data.matrixScreenLightMode;
      buffer[31] = data.matrixScreenLightBrightness;
      buffer[32] = data.matrixScreenLightSpeed;
      buffer[33] = 0 //data.matrixScreenLightMixColor;
      buffer[34] = data.matrixScreenLightColorIndex;
      buffer[35] = data.matrixScreenLightRValue;
      buffer[36] = data.matrixScreenLightGValue;
      buffer[37] = data.matrixScreenLightBValue;

      buffer[38] = data.sixKeysOrAllKeys;
      buffer[39] = data.maxOrWin;
      buffer[40] = data.winLock;
      buffer[41] = data.keyWasd;
      buffer[42] = data.scanDelay;
      buffer[43] = data.layerDefault;
      buffer[44] = data.fSwitch ? 1 : 0;
      buffer[45] = data.wheelDefaultMode;

      const [lo, mid, hi] = shiftFrom24Bit(data.sleepTime);
      buffer[46] = lo;
      buffer[47] = mid;
      buffer[48] = hi;

      const [deeplo, deepmid, deephi] = shiftFrom24Bit(data.deepSleepTime);
      buffer[49] = deeplo;
      buffer[50] = deepmid;
      buffer[51] = deephi;

      buffer[52] = data.lcdScreenLightSwitch ? 1 : 0;
      buffer[53] = data.lcdScreenLightMode;
      buffer[54] = data.lcdScreenLightBrightness;
      buffer[55] = data.lcdScreenMaxGif;
      buffer[56] = data.lcdScreenLanguage;
      buffer[57] = data.lcdScreenUsbEnum ? 1 : 0;
      buffer[58] = data.snapTap ? 1 : 0;
    } else {
      // V3 构造
      buffer = new Array(64).fill(0);
      buffer[0] = data.profile;
      buffer[1] = data.lightSwitch;
      buffer[2] = data.lightMode;
      buffer[3] = data.lightBrightness;
      buffer[4] = 6 - data.lightSpeed;
      buffer[5] = data.lightMixColor;
      buffer[6] = data.lightColorIndex;
      buffer[7] = data.lightRValue;
      buffer[8] = data.lightGValue;
      buffer[9] = data.lightBValue;
      buffer[10] = data.lightCustomIndex;

      buffer[11] = data.logoLightSwitch;
      buffer[12] = data.logoLightMode;
      buffer[13] = data.logoLightBrightness;
      buffer[14] = 6 - data.logoLightSpeed;
      buffer[15] = data.logoLightMixColor;
      buffer[16] = data.logoLightColorIndex;
      buffer[17] = data.logoLightRValue;
      buffer[18] = data.logoLightGValue;
      buffer[19] = data.logoLightBValue;

      buffer[20] = data.sideLightSwitch;
      buffer[21] = data.sideLightMode;
      buffer[22] = data.sideLightBrightness;
      buffer[23] = 6 - data.sideLightSpeed;
      buffer[24] = data.sideLightMixColor;
      buffer[25] = data.sideLightColorIndex;
      buffer[26] = data.sideLightRValue;
      buffer[27] = data.sideLightGValue;
      buffer[28] = data.sideLightBValue;

      buffer[29] = data.matrixScreenLightSwitch ? 1 : 0;
      buffer[30] = data.matrixScreenLightMode;
      buffer[31] = data.matrixScreenLightBrightness;
      buffer[32] = data.matrixScreenLightSpeed;
      buffer[33] = 0 //data.matrixScreenLightMixColor;
      buffer[34] = data.matrixScreenLightColorIndex;
      buffer[35] = data.matrixScreenLightRValue;
      buffer[36] = data.matrixScreenLightGValue;
      buffer[37] = data.matrixScreenLightBValue;

      buffer[38] = data.sixKeysOrAllKeys;
      buffer[39] = data.maxOrWin;
      buffer[40] = data.winLock;
      buffer[41] = data.keyWasd;
      buffer[42] = data.scanDelay;
      buffer[43] = data.layerDefault;
      buffer[44] = data.fSwitch ? 1 : 0;
      buffer[45] = data.wheelDefaultMode;

      const [lo, mid, hi] = shiftFrom24Bit(data.sleepTime);
      buffer[46] = lo;
      buffer[47] = mid;
      buffer[48] = hi;

      const [deeplo, deepmid, deephi] = shiftFrom24Bit(data.deepSleepTime);
      buffer[49] = deeplo;
      buffer[50] = deepmid;
      buffer[51] = deephi;

      buffer[52] = data.lcdScreenLightSwitch ? 1 : 0;
      buffer[53] = data.lcdScreenLightMode;
      buffer[54] = data.lcdScreenLightBrightness;
      buffer[55] = data.lcdScreenMaxGif;
      buffer[56] = data.lcdScreenLanguage;
      buffer[57] = data.lcdScreenUsbEnum ? 1 : 0;
      buffer[58] = data.snapTap ? 1 : 0;
    }
    // 开始通信，发送数据，停止通信
    await this.startComm();
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const totalSize = buffer.length;
    for (let offset = 0; offset < totalSize; offset += bufferSize) {
      const size = Math.min(totalSize - offset, bufferSize);
      const chunk = buffer.slice(offset, offset + size);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0; // 可以替换为实际校验值

      await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_SET_FUNCINFO,
        lo,
        hi,
        size,
        checkSum,
        0x00, 0x00,  // 保留位或填充头部
        ...chunk,
      ]);
    }
    const rgbData = await this.getUserAllKeyColor(lightId);
    // await this.stopComm();
    return rgbData;
  }

  // 读取编码器的按键矩阵位置
  async getEncoderKeyMatrixData() {
    let command: number = CMD.CMD_GET_WHEEL_DATA;
    const data = await this.api.sendDeviceData(CMD.REPORT_ID, [
      command,
    ]);
    return {
      wheelleft: data[8],
      wheelCenter: data[9],
      wheelright: data[10],
    }
  }
  // 设置用户灯光颜色(单键)
  async setUserKeyColor(lightId: number, keyIndex: number, color: string) {
    let command: number = CMD.CMD_SET_USERLIGHT_1;
    const offset = keyIndex * 3;
    const [lo, hi] = shiftFrom16Bit(offset);

    if (lightId == 1) {
      command = CMD.CMD_SET_USERLIGHT_2;
    } else if (lightId == 2) {
      command = CMD.CMD_SET_USERLIGHT_3;
    } else if (lightId == 3) {
      command = CMD.CMD_SET_USERLIGHT_4;
    } else if (lightId == 4) {
      command = CMD.CMD_SET_USERLIGHT_5;
    }
    const { r, g, b } = hexToRgba(color);
    await this.startComm();
    await this.api.sendDeviceData(CMD.REPORT_ID, [
      command,
      lo,
      hi,
      0x03,
      0x00,
      0x00,
      0x00,
      r,
      g,
      b,
    ]);
    // await this.stopComm();
  }

  // 设置用户灯光颜色(全量 128 键，按自定义灯效槽位)
  async setUserAllKeyColorByLight(lightId: number, keyColors: string[]) {
    let command: number = CMD.CMD_SET_USERLIGHT_1;
    if (lightId == 1) {
      command = CMD.CMD_SET_USERLIGHT_2;
    } else if (lightId == 2) {
      command = CMD.CMD_SET_USERLIGHT_3;
    } else if (lightId == 3) {
      command = CMD.CMD_SET_USERLIGHT_4;
    } else if (lightId == 4) {
      command = CMD.CMD_SET_USERLIGHT_5;
    }

    const totalKeyCount = 128;
    const rgbData: number[] = new Array(totalKeyCount * 3).fill(0);
    for (let index = 0; index < totalKeyCount; index += 1) {
      const color = keyColors[index] || "#000000";
      const { r, g, b } = hexToRgba(color);
      const offset = index * 3;
      rgbData[offset] = r;
      rgbData[offset + 1] = g;
      rgbData[offset + 2] = b;
    }

    await this.startComm();
    const bufferSize = [0x38, 0x18][this.deviceMode];
    for (let offset = 0; offset < rgbData.length; offset += bufferSize) {
      const size = Math.min(rgbData.length - offset, bufferSize);
      const chunk = rgbData.slice(offset, offset + size);
      const [lo, hi] = shiftFrom16Bit(offset);
      await this.api.sendDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,
        0x00,
        0x00,
        0x00,
        ...chunk,
      ]);
    }
    // await this.stopComm();
  }

  // 读取灯光矩阵
  async getLightMatrixData() {
    let command: number = CMD.CMD_GET_LIGHT_MATRIX;
    let lightMatrix = [];
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const keySize = 128;
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const data = await this.api.getDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,
        checkSum,
      ]);
      lightMatrix = lightMatrix.concat(data.slice(8));
    }
    return lightMatrix;
  }

  // 获取用户灯光颜色（全部按键）
  async getUserAllKeyColor(lightId: number) {
    let command: number = CMD.CMD_GET_USERLIGHT_1;
    if (lightId == 1) {
      command = CMD.CMD_GET_USERLIGHT_2;
    } else if (lightId == 2) {
      command = CMD.CMD_GET_USERLIGHT_3;
    } else if (lightId == 3) {
      command = CMD.CMD_GET_USERLIGHT_4;
    } else if (lightId == 4) {
      command = CMD.CMD_GET_USERLIGHT_5;
    }
    await this.startComm();
    let rgbData = [];
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const keySize = 128 * 3;
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const data = await this.api.getDeviceData(CMD.REPORT_ID, [
        command,
        lo,
        hi,
        size,
        checkSum,
      ]);
      rgbData = rgbData.concat(data.slice(8));
    }
    // await this.stopComm();
    //console.log("getUserAllKeyColor newKeyInfos", rgbData);
    const keyColor = new Array(128).fill("");
    for (let index = 0; index < 128; index++) {
      keyColor[index] = rgbaToHex({
        r: rgbData[index * 3],
        g: rgbData[index * 3 + 1],
        b: rgbData[index * 3 + 2],
        a: 1,
      });
    }
    return keyColor;
  }
  // 获取用户灯光颜色（单色）
  async getUserSingleAllKeyColor(lightId: number) {
    let command: number = CMD.CMD_GET_USERLIGHT_1;
    if (lightId == 1) {
      command = CMD.CMD_GET_USERLIGHT_2;
    } else if (lightId == 2) {
      command = CMD.CMD_GET_USERLIGHT_3;
    } else if (lightId == 3) {
      command = CMD.CMD_GET_USERLIGHT_4;
    } else if (lightId == 4) {
      command = CMD.CMD_GET_USERLIGHT_5;
    }
    await this.startComm();
    let data = await this.api.getDeviceData(CMD.REPORT_ID, [
      command,
      0x00,
      0x00,
      0x10,
      0x00,
    ])
    return data.slice(8);
  }
  // 获取灯光颜色（全部按键）
  async getAllKeyColor() {
    await this.startComm();
    let rgbData = [];
    const bufferSize = [0x38, 0x18][this.deviceMode];
    const keySize = 128 * 3;
    for (let offset = 0; offset < keySize; offset += bufferSize) {
      const size = Math.min(keySize - offset, bufferSize);
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = 0;
      const data = await this.api.getDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_LIGHT_MODE_DATA,
        lo,
        hi,
        size,
        checkSum,
      ]);
      rgbData = rgbData.concat(data.slice(8));
    }
    // await this.stopComm();
    //console.log("getUserAllKeyColor newKeyInfos", rgbData);
    const keyColor = new Array(128).fill("");
    for (let index = 0; index < 128; index++) {
      keyColor[index] = rgbaToHex({
        r: rgbData[index * 3],
        g: rgbData[index * 3 + 1],
        b: rgbData[index * 3 + 2],
        a: 1,
      });
    }
    return keyColor;
  }
  // 设置用户灯光颜色(全部按键)
  async setUserAllKeyColor(colors: string[]) {
    let colorData = [];
    this.keys.map((key, index) => {
      if (key && colors[index]) {
        const { r, g, b } = hexToRgba(colors[index]);
        colorData.push([key, r, g, b]);
      }
    });
    if (colorData.length > 0) {

    }
  }
  // 读取背光模式信息
  async getBackLightMode() {
    const fetchData = async (): Promise<number[]> => {
      const response = await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_BL_MODE,
        0x00,
        0x00,
        [0x38, 0x18][this.deviceMode],
      ]);
      return response;
    };
    let data = await fetchData();
    return data.slice(9);
  }
  // 读取Logo模式信息
  async getLogoLightMode() {
    const fetchData = async (): Promise<number[]> => {
      const response = await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_LG_MODE,
        0x00,
        0x00,
        [0x38, 0x18][this.deviceMode],
      ]);
      return response;
    };
    let data = await fetchData();
    return data.slice(9);
  }
  // 读取侧灯模式信息
  async getSideLightMode() {
    const fetchData = async (): Promise<number[]> => {
      const response = await this.api.sendDeviceData(CMD.REPORT_ID, [
        CMD.CMD_GET_SD_MODE,
        0x00,
        0x00,
        [0x38, 0x18][this.deviceMode],
      ]);
      return response;
    };
    let data = await fetchData();
    return data.slice(9);
  }

  // 设置宏数据
  async setAllMacroData(macroList: MacroProfile[]) {
    if (macroList == undefined || macroList.length <= 0) {
      return;
    }
    console.log("macroList", macroList);
    const newMacroList: any = [];
    macroList.map((macroInfo, index) => {
      const newMacroActions: any = [];
      macroInfo.list.map((macroAction) => {
        const { webCode, down_delay, up_delay, action } = macroAction;
        const code = eventCode2Keycode(webCode || "");
        newMacroActions.push({
          action,
          code,
          webCode,
          time: down_delay,
          type: 1,
        });
        newMacroActions.push({
          action,
          code,
          webCode,
          time: up_delay,
          type: 2,
        });
      });
      const newMacroList2 = _.orderBy(newMacroActions, ["time"], ["asc"]);
      newMacroList.push({
        name: macroInfo.name,
        key: macroInfo.key,
        type: macroInfo.type,
        replayCnt: macroInfo.replayCnt,
        list: newMacroList2,
      });
    });
    if (newMacroList.length <= 0) {
      return;
    }
    console.log("newMacroList", newMacroList);
    const macroData = new Array(1096).fill(0);
    macroData[0] = 0xaa;
    macroData[1] = 0x55;
    const [lo2, hi2] = shiftFrom16Bit(macroList.length);
    macroData[4] = lo2;
    macroData[5] = hi2;
    macroData[6] = 0x00; // 保留
    macroData[7] = 0x00; // 保留
    let macroActionOffset = 8 + macroList.length * 2;
    newMacroList.map((macroInfo, macorIndex) => {
      const [lo, hi] = shiftFrom16Bit(macroActionOffset);
      if (macroInfo.list.length > 0) {
        macroData[8 + macorIndex * 2] = lo;
        macroData[9 + macorIndex * 2] = hi;
        const [lo3, hi3] = shiftFrom16Bit(macroInfo.list.length);
        macroData[macroActionOffset] = lo3;
        macroData[macroActionOffset + 1] = hi3;
        macroData[macroActionOffset + 2] = 0x00;
        macroData[macroActionOffset + 3] = 0x00;
        macroActionOffset += 4;
      } else {
        macroData[8 + macorIndex * 2] = 0;
        macroData[9 + macorIndex * 2] = 0;
      }
      let preTime: number = 0;
      let time = 10;
      for (let i = 0; i < macroInfo.list.length; i++) {
        const action = macroInfo.list[i];
        time = action.time - preTime;
        if (time < 10) {
          time = 10;
        }
        if (time > 10000) {
          time = 10000;
        }
        if (i == 0) {
          time = 10;
        }
        preTime = action.time;
        if (action.action == 1) {
          const [lo, hi] = shiftFrom16Bit(time);
          macroData[macroActionOffset] = lo;
          macroData[macroActionOffset + 1] = hi;
          macroData[macroActionOffset + 2] = action.code;
          if (action.type === 1) {
            macroData[macroActionOffset + 3] = 0x01 | (1 << 7);
          } else {
            macroData[macroActionOffset + 3] = 0x01;
          }
          macroActionOffset += 4;
        } else if (action.action == 3) {
          console.log("action", action);
          let code = 0x01;
          if (action.webCode == "0") {
            code = 0x01;
          } else if (action.webCode == "1") {
            code = 0x04;
          } else if (action.webCode == "2") {
            code = 0x02;
          } else if (action.webCode == "3") {
            code = 0x08;
          } else if (action.webCode == "4") {
            code = 0x10;
          }
          const [lo, hi] = shiftFrom16Bit(time);
          macroData[macroActionOffset] = lo;
          macroData[macroActionOffset + 1] = hi;
          macroData[macroActionOffset + 2] = code;
          if (action.type === 1) {
            macroData[macroActionOffset + 3] = 0x03 | (1 << 7);
          } else {
            macroData[macroActionOffset + 3] = 0x03;
          }
          macroActionOffset += 4;
        }
      }
    });
    const [lo, hi] = shiftFrom16Bit(macroActionOffset);
    macroData[2] = lo;
    macroData[3] = hi;
    await this.startComm();
    const dataSlice = _.chunk(macroData, [56, 24][this.deviceMode]);
    let step = Math.ceil(macroActionOffset / [56, 24][this.deviceMode]);
    for (let index = 0; index < step; index++) {
      const offset = index * [56, 24][this.deviceMode];
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = dataSlice[index].reduce((p, c) => p + c) & 0xff;
      if (index == step - 1) {
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_MACRODATA,
          lo,
          hi,
          macroActionOffset % [56, 24][this.deviceMode],
          checkSum,
          0x00,
          0x00,
          ...dataSlice[index],
        ]);
      } else {
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_MACRODATA,
          lo,
          hi,
          [0x38, 0x18][this.deviceMode],
          checkSum,
          0x00,
          0x00,
          ...dataSlice[index],
        ]);
      }
    }
    // await this.stopComm();
  }
  // 设置宏数据
  async setAllMacroDataV2(macroList: MacroProfile[]) {
    if (macroList == undefined || macroList.length <= 0) {
      return;
    }
    console.log("macroList", macroList);
    const newMacroList: any = [];
    macroList.map((macroInfo, index) => {
      const newMacroActions: any = [];
      let delayTime = 0;
      macroInfo.list.map((macroAction) => {
        const { key, webCode, type, hasDownArrow } = macroAction;
        if (type == "delay") {
          delayTime += parseInt(key);
        } else if (type == "keyboard") {
          const code = eventCode2Keycode(webCode || "");
          newMacroActions.push({
            action: 1,
            code,
            key,
            time: delayTime,
            type: hasDownArrow ? 1 : 0,
          });
          delayTime = 0;
        } else if (type == "mouse") {
          newMacroActions.push({
            action: 3,
            webCode,
            key,
            time: delayTime,
            type: hasDownArrow ? 1 : 0,
          });
          delayTime = 0;
        }
      });
      newMacroList.push({
        name: macroInfo.name,
        key: macroInfo.key,
        type: macroInfo.type,
        replayCnt: macroInfo.replayCnt,
        list: newMacroActions,
      });
    });
    if (newMacroList.length <= 0) {
      return;
    }
    console.log("newMacroList", newMacroList);
    const macroData = new Array(1096).fill(0);
    macroData[0] = 0xaa;
    macroData[1] = 0x55;
    const [lo2, hi2] = shiftFrom16Bit(macroList.length);
    macroData[4] = lo2;
    macroData[5] = hi2;
    macroData[6] = 0x00; // 保留
    macroData[7] = 0x00; // 保留
    let macroActionOffset = 8 + macroList.length * 2;
    newMacroList.map((macroInfo, macorIndex) => {
      const [lo, hi] = shiftFrom16Bit(macroActionOffset);
      if (macroInfo.list.length > 0) {
        macroData[8 + macorIndex * 2] = lo;
        macroData[9 + macorIndex * 2] = hi;
        const [lo3, hi3] = shiftFrom16Bit(macroInfo.list.length);
        macroData[macroActionOffset] = lo3;
        macroData[macroActionOffset + 1] = hi3;
        macroData[macroActionOffset + 2] = 0x00;
        macroData[macroActionOffset + 3] = 0x00;
        macroActionOffset += 4;
      } else {
        macroData[8 + macorIndex * 2] = 0;
        macroData[9 + macorIndex * 2] = 0;
      }
      let time = 0;
      for (let i = 0; i < macroInfo.list.length; i++) {
        const action = macroInfo.list[i];
        time = action.time;
        if (time < 10) {
          time = 10;
        }
        if (time > 50000) {
          time = 50000;
        }
        if (action.action == 1) {
          const [lo, hi] = shiftFrom16Bit(time);
          macroData[macroActionOffset] = lo;
          macroData[macroActionOffset + 1] = hi;
          macroData[macroActionOffset + 2] = action.code;
          if (action.type === 1) {
            macroData[macroActionOffset + 3] = 0x01 | (1 << 7);
          } else {
            macroData[macroActionOffset + 3] = 0x01;
          }
          macroActionOffset += 4;
        } else if (action.action == 3) {
          let code = 0x01;
          if (action.webCode == "0") {
            code = 0x01;
          } else if (action.webCode == "1") {
            code = 0x04;
          } else if (action.webCode == "2") {
            code = 0x02;
          } else if (action.webCode == "3") {
            code = 0x08;
          } else if (action.webCode == "4") {
            code = 0x10;
          }
          const [lo, hi] = shiftFrom16Bit(time);
          macroData[macroActionOffset] = lo;
          macroData[macroActionOffset + 1] = hi;
          macroData[macroActionOffset + 2] = code;
          if (action.type === 1) {
            macroData[macroActionOffset + 3] = 0x03 | (1 << 7);
          } else {
            macroData[macroActionOffset + 3] = 0x03;
          }
          macroActionOffset += 4;
        }
      }
    });
    const [lo, hi] = shiftFrom16Bit(macroActionOffset);
    macroData[2] = lo;
    macroData[3] = hi;
    await this.startComm();
    const dataSlice = _.chunk(macroData, [56, 24][this.deviceMode]);
    let step = Math.ceil(macroActionOffset / [56, 24][this.deviceMode]);
    for (let index = 0; index < step; index++) {
      const offset = index * [56, 24][this.deviceMode];
      const [lo, hi] = shiftFrom16Bit(offset);
      const checkSum = dataSlice[index].reduce((p, c) => p + c) & 0xff;
      if (index == step - 1) {
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_MACRODATA,
          lo,
          hi,
          macroActionOffset % [56, 24][this.deviceMode],
          checkSum,
          0x00,
          0x00,
          ...dataSlice[index],
        ]);
      } else {
        await this.api.sendDeviceData(CMD.REPORT_ID, [
          CMD.CMD_SET_MACRODATA,
          lo,
          hi,
          [0x38, 0x18][this.deviceMode],
          checkSum,
          0x00,
          0x00,
          ...dataSlice[index],
        ]);
      }
    }
    // await this.stopComm();
  }

  // 读取宏数据 (0x2C)
  async getAllMacroDataV2(): Promise<any[] | null> {
    try {
      await this.startComm();
      const bufferSize = [56, 24][this.deviceMode];
      const totalSize = 1096;
      let rawData: number[] = [];

      for (let offset = 0; offset < totalSize; offset += bufferSize) {
        const size = Math.min(totalSize - offset, bufferSize);
        const [lo, hi] = shiftFrom16Bit(offset);
        const data = await this.api.getDeviceData(CMD.REPORT_ID, [
          CMD.CMD_GET_MACRODATA,
          lo,
          hi,
          size,
          0x00,
        ]);
        rawData = rawData.concat(data.slice(8, 8 + size));
      }

      // 校验魔数
      if (rawData[0] !== 0xaa || rawData[1] !== 0x55) {
        console.warn('[getAllMacroDataV2] 魔数不匹配，返回 null');
        return null;
      }

      const dataEnd = shiftTo16Bit([rawData[2], rawData[3]]);
      const macroCnt = shiftTo16Bit([rawData[4], rawData[5]]);
      console.log('[getAllMacroDataV2] macroCnt:', macroCnt, 'dataEnd:', dataEnd);

      const macroList: any[] = [];
      for (let i = 0; i < macroCnt; i++) {
        const offsetLo = rawData[8 + i * 2];
        const offsetHi = rawData[9 + i * 2];
        const actionOffset = shiftTo16Bit([offsetLo, offsetHi]);

        if (actionOffset === 0) {
          macroList.push({ key: i, name: `M${i}`, type: 0, replayCnt: 1, list: [] });
          continue;
        }

        const actionCnt = shiftTo16Bit([rawData[actionOffset], rawData[actionOffset + 1]]);
        const actions: any[] = [];
        let ptr = actionOffset + 4; // 跳过 cnt(2) + 保留(2)

        for (let j = 0; j < actionCnt; j++) {
          const timeLo = rawData[ptr];
          const timeHi = rawData[ptr + 1];
          const code = rawData[ptr + 2];
          const flags = rawData[ptr + 3];
          ptr += 4;

          const time = shiftTo16Bit([timeLo, timeHi]);
          const actionType = flags & 0x0F; // 低4位：1=键盘, 3=鼠标
          const hasDown = (flags & 0x80) !== 0; // bit7: 1=按下, 0=释放

          if (actionType === 1) {
            // 键盘动作：先插入延迟节点，再插入按键节点
            // 10ms 是固件最小填充值，过滤掉避免产生多余节点
            if (time > 10) {
              actions.push({
                type: 'delay',
                key: String(time),
                webCode: '',
                hasUpArrow: false,
                hasDownArrow: false,
                showAddButtons: false,
                index: actions.length,
                hasError: false,
              });
            }
            const { eventCode, displayName } = hidKeycode2EventCode(code);
            actions.push({
              type: 'keyboard',
              key: displayName,
              webCode: eventCode,
              hasUpArrow: !hasDown,
              hasDownArrow: hasDown,
              showAddButtons: false,
              index: actions.length,
              hasError: false,
            });
          } else if (actionType === 3) {
            // 鼠标动作
            let webCode = '0';
            if (code === 0x01) webCode = '0';
            else if (code === 0x04) webCode = '1';
            else if (code === 0x02) webCode = '2';
            else if (code === 0x08) webCode = '3';
            else if (code === 0x10) webCode = '4';
            if (time > 10) {
              actions.push({
                type: 'delay',
                key: String(time),
                webCode: '',
                hasUpArrow: false,
                hasDownArrow: false,
                showAddButtons: false,
                index: actions.length,
                hasError: false,
              });
            }
            actions.push({
              type: 'mouse',
              key: webCode,
              webCode,
              hasUpArrow: !hasDown,
              hasDownArrow: hasDown,
              showAddButtons: false,
              index: actions.length,
              hasError: false,
            });
          }
        }

        macroList.push({
          key: i,
          name: `M${i}`,
          type: 0,
          replayCnt: 1,
          list: actions,
        });
      }

      return macroList;
    } catch (e) {
      console.error('[getAllMacroDataV2] 读取失败:', e);
      return null;
    }
  }

  // 恢复出厂设置
  async restoreFactorySettings() {
    await this.startComm();
    await this.api.sendDeviceData(CMD.REPORT_ID, [
      CMD.CMD_RESTORE_FACTORYSETTINGS,
      0x00,
      0x00,
      [0x38, 0x18][this.deviceMode],
    ]);
    // await this.stopComm();
  }
  // 点阵屏灯光模式
  async setMatrixLight() {
    const data = await this.api.sendDeviceData(CMD.REPORT_ID, [
      CMD.CMD_GET_MATRIX_MODE,
      0x00,
      0x00,
      [0x38, 0x18][this.deviceMode],
    ]);
    return data
  }
  async getBase() {
    const data = await this.api.getBase();
    return {
      profileIndex: data[8],
    };
  }

  async getInfo() {
    const data = await this.api.getInfo();
    return {
      fw_ver: ((data[1] << 8) | data[0]).toString(16),
      // fw_ver: data[11].toString(10)+'.'+data[12].toString(10)+'.'+data[13].toString(10)
    };
  }

  // 获取2.4G接收器版本号
  async getDongleVersion() {
    try {
      // 设置超时时间 500ms，老版本接收器可能不支持此命令
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取版本超时')), 500);
      });

      const dataPromise = this.api.sendDeviceData(0xAA, [0xEE, 0x00, 0x00, 0x00]);
      const data = await Promise.race([dataPromise, timeoutPromise]) as number[];
      console.log(data, 'getDongleVersion data');
      // 响应数据中，版本号在 data[13] 和 data[14] 位置（如 04 01 表示版本 1.04）
      const versionLow = data[13];   // 次版本号（低字节）
      const versionHigh = data[14];  // 主版本号（高字节）

      // 版本号格式：主版本*100 + 次版本，例如 1.04 = "104"（十进制字符串，padStart确保至少3位）
      const version = (versionHigh << 8) | versionLow;
      const versionStr = version.toString(16).toUpperCase().padStart(4, '0');  // 使用4位，如 "0104"

      console.log(`[Dongle版本] 原始数据: 主=${versionHigh} 次=${versionLow}, 版本=${versionStr} (${versionHigh}.${versionLow.toString().padStart(2, '0')})`);

      return {
        version: versionStr,
        versionHigh,
        versionLow,
        rawData: data,
        isDefault: false
      };
    } catch (error) {
      // 老版本接收器不支持版本查询命令，默认返回 1.00
      console.warn('[Dongle版本] 获取版本超时，使用默认版本 1.00');
      return {
        version: '0100',  // 1.00（4位格式）
        versionHigh: 1,
        versionLow: 0,
        rawData: null,
        isDefault: true
      };
    }
  }

  code2Char(data: number[]) {
    const index = data.findIndex((v) => v == 0x0);
    const code = index > -1 ? data.slice(0, index) : data;
    return String.fromCharCode(...code);
  }

  // 获取默认层的按键布局信息
  // 算出按键所在的位置
  async getDefaultKeyInfos(profile, layer) {
    let keyData = await this.api.getKeyMatrix(profile, layer, true);
    console.log(keyData, "矩阵数据");
    let newKeyInfos = [];
    const maxKeyCnt = 128;
    for (let i = 0; i < maxKeyCnt; i++) {
      const [type, code1, code2] = keyData.slice(i * 3, i * 3 + 3);
      if (type == 0x10 || type == 0xf0) {
        const code = getKeyCode(type, code1, code2);
        const name = getKeyName({ type, code1, code2 });
        newKeyInfos.push({ type, code1, code2, code, name, i, profile, layer });
      } else {
        const name = getKeyName({ type, code1, code2 }) || "";
        newKeyInfos.push({
          type: type,
          code1: code1,
          code2: code2,
          code: 0,
          name,
          index: i,
          profile,
          layer,

        });
      }
    }
    return newKeyInfos;
  }

  async getDafultKeys() {
    // const data = await this.api.getLayoutKey();
    const data = layoutKeyTestData;
    this.keys = data;
    const defaultKeys = new Array(92).fill({} as KeyboardKey);

    data.map((code, index) => {
      const name = code == 1 ? "FN" : getNameFromKeyCode(code);
      defaultKeys[index] = {
        type: 0,
        code1: 0,
        code2: code,
        name,
      };
    });

    return defaultKeys;
  }

  async clearMacroRom() { }

  // 获取键盘当前矩阵
  async getKeyInfos(profile, layer) {
    let keyData = await this.api.getKeyMatrix(profile, layer);
    console.log(keyData, "矩阵数据");
    // 确保 keyData 是有效的，并且长度符合预期
    if (!Array.isArray(keyData) || keyData.length < 3 * 128) {
      throw new Error("Invalid keyData format");
    }
    let newKeyInfos = [];
    const maxKeyCnt = 128;
    for (let i = 0; i < maxKeyCnt; i++) {
      const [type, code1, code2] = keyData.slice(i * 3, i * 3 + 3);
      if (type == 0xff) {
        newKeyInfos.push({
          type,
          code1,
          code2,
          code: -1,
          name: "",
          index: i,
          profile,
          layer,
        });
      } else {
        const name = getKeyName({ type, code1, code2 }) || "";
        newKeyInfos.push({
          type,
          code1,
          code2,
          code: -1,
          name,
          index: i,
          profile,
          layer,
        });
      }
    }
    return newKeyInfos;
  }

  async setUserKeys(
    userKeys: KeyboardKey[],
    profileIndex: number = 0,
    layer: number = 0
  ) {
    let keyData = [];
    userKeys?.map((key) => {
      keyData.push(key.type, key.code1, key.code2);
    });
    await this.api.setUserKeyMatrix(keyData, profileIndex, layer, 0);
  }

  async setAllUserKeys(allUserKeys: Record<string, KeyboardKey[]>) {
    for (let index = 0; index < 4; index++) {
      await this.setUserKeys(allUserKeys[index], 0, index);
    }
  }

  async setUserKey(
    userKey: KeyboardKey,
    index: number,
    profileIndex: number = 0,
    layer: number = 0
  ) {
    const keyData = [userKey.type, userKey.code1, userKey.code2];
    await this.api.setUserKeyMatrix(keyData, profileIndex, layer, index);
  }

  // 获取设备性能参数
  async getPerformanceInfo(profileIndex: number = 0) { }

  // 获取灯光模式数据
  async getLightConfig(profileIndex: number = 0) { }

  // 设置灯光模式
  async setLightConfig(
    keyboardLight: KeyboardLight,
    profileIndex: number = 0
  ) { }

  // 获取用户按键灯光颜色
  async getUserLightKeyColors(profile) { }

  async setLightColor(color, profileIndex = 0) { }

  // 设置单个按键颜色
  async setSingleKeyColor(profile, keyIndex, keyColor) { }

  // 设置单个按键颜色
  async setAllKeysColor(colors) { }

  async getKeyLight() { }

  async getKeyCustomLight() { }

  // 获取按键行程信息
  async getKeyTrigger(profile) { }

  // 设置按键单键行程
  async setKeyTrigger(keyTrigger, layer, index) { }

  // 设置按键行程
  async setTravelKeys(travelKeys, profileIndex = 0) { }

  async startCalibration() { }
  async endCalibration() { }

  // 性能设置 - 设置Mac模式
  async setMacMode(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[1] = value;
    console.log("setMacMode", value);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 性能设置 - 狂暴模式
  async setBerserkMode(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[7] = (baseInfoData[7] & 0b11111110) | (value ? 0b1 : 0b0);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 性能配置 - 回报率
  async setReportRate(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[4] = (baseInfoData[4] & 0b11110000) | (value & 0b1111);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 性能配置 -游戏速率
  async setTickRate(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[4] = (baseInfoData[4] & 0b1111) | (value << 4);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 性能配置 - 锁Win
  async setLockWinKey(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[6] = (baseInfoData[6] & 0b11110) | value;
    this.api.setFuncConfig(profile, baseInfoData);
  }
  // 性能配置 -稳定性模式（触底优化）
  async setStabilityMode(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[7] = (baseInfoData[7] & 0b11101) | (value << 1);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 性能配置 - 按键响应
  async setDebounce(profile, value) {
    let baseInfoData = await this.api.getFuncConfig(profile);
    baseInfoData[7] = (baseInfoData[7] & 0b01111) | (value << 5);
    this.api.setFuncConfig(profile, baseInfoData);
  }

  // 获取所有高级键
  async getAdvancedKeys(profileIndex) {
    const dksData = await this.getDksKeyInfo(profileIndex);
    const mtData = await this.getMtKeyInfo(profileIndex);
    const tglData = await this.getTglKeyInfo(profileIndex);
    return { dksData, mtData, tglData };
  }

  async getDksKeyInfo(layer) {
    const data = await this.api.getDksKeyInfo(layer);
    let dksKeys = [];
    for (let i = 0; i < 32; i++) {
      const offset = i * 24;
      const point0 = shiftTo16Bit([data[offset + 7], data[offset + 8]]);
      const point1 = shiftTo16Bit([data[offset + 12], data[offset + 13]]);
      const point2 = shiftTo16Bit([data[offset + 17], data[offset + 18]]);
      const point3 = shiftTo16Bit([data[offset + 22], data[offset + 23]]);
      const key0 = {
        type: data[offset + 4],
        code1: data[offset + 5],
        code2: data[offset + 6],
      };
      const key1 = {
        type: data[offset + 9],
        code1: data[offset + 10],
        code2: data[offset + 11],
      };
      const key2 = {
        type: data[offset + 14],
        code1: data[offset + 15],
        code2: data[offset + 16],
      };
      const key3 = {
        type: data[offset + 19],
        code1: data[offset + 20],
        code2: data[offset + 21],
      };
      dksKeys.push({
        point: data.slice(offset, offset + 4),
        action0: { ...key0, name: getKeyName(key0) },
        action1: { ...key1, name: getKeyName(key1) },
        action2: { ...key2, name: getKeyName(key2) },
        action3: { ...key3, name: getKeyName(key3) },
        point0: {
          action0: point0 & 0b111,
          action1: (point0 >> 3) & 0b111,
          action2: (point0 >> 6) & 0b111,
          action3: (point0 >> 9) & 0b1,
        },
        point1: {
          action0: point1 & 0b111,
          action1: (point1 >> 3) & 0b111,
          action2: (point1 >> 6) & 0b111,
          action3: (point1 >> 9) & 0b1,
        },
        point2: {
          action0: point2 & 0b111,
          action1: (point2 >> 3) & 0b111,
          action2: (point2 >> 6) & 0b111,
          action3: (point2 >> 9) & 0b1,
        },
        point3: {
          action0: point3 & 0b111,
          action1: (point3 >> 3) & 0b111,
          action2: (point3 >> 6) & 0b111,
          action3: (point3 >> 9) & 0b1,
        },
      });
    }
    return dksKeys;
  }

  async setDksKeyInfo(layer, index, advancedKeyitem) { }

  async setAllDksKeyInfo(profileIndex, keys) { }

  dksStatus2Bit(status) {
    const bit0 = status > 0 ? 1 : 0;
    const bit1 = status > 1 ? 1 : 0;
    const bit2 = status > 2 ? 1 : 0;
    const res = bit0 | (bit1 << 1) | (bit2 << 2);
    return res;
  }

  async getMtKeyInfo(layer) { }

  async setMtKeyInfo(layer, index, advancedKeyitem) { }

  async setAllMtKeyInfo(profileIndex, keys) { }

  async getTglKeyInfo(layer) {
    if (this.test) return;
    const data = await this.api.getTglKeyInfo(layer);
    let tglKeys = [];

    for (let i = 0; i < 32; i++) {
      const offset = i * 3;
      const key = {
        type: data[offset],
        code1: data[offset + 1],
        code2: data[offset + 2],
      };
      tglKeys.push({ ...key, name: getKeyName(key) });
    }
    return tglKeys;
  }

  async setTglKeyInfo(layer, index, advancedKeyitem) {
    const { tglKey } = advancedKeyitem;
    if (tglKey) {
      const tglKeyData = [tglKey?.type, tglKey?.code1, tglKey?.code2];
      await this.api.setTglKeyInfo(layer, index, tglKeyData);
    }
  }

  async setAllTglKeyInfo(profileIndex, keys) { }

  async getGlobalTravel() { }

  async setGlobalTravel(globalTravel: TravelConfig) { }

  async setAdvancedKeys(advancedKeys: AdvancedKey[]) { }

  async setKeyInfo(keyInfo, profileIndex, layer, index) { }

  async setMtKey(mtKey) { }

  async getMtKey(index: number) { }

  async setMtKeyMode(index: number, travelMode: number) { }

  async setRsKey(socdKey) { }

  async getRsKey(index) { }

  async setRsKeyMode(index1, index2, mode1, mode2) { }

  async setSocdKey(socdKey) { }

  async getSocdKey(index: number) { }

  async setSocdKeyMode(
    index1: number,
    index2: number,
    mode1: number,
    mode2: number
  ) { }

  async setAllMacro(macros: MacroProfile[]) { }

  async setMacro(macro: MacroProfile, index: number) { }

  async setMacroKey(
    macroIndex: number,
    macroLength: number,
    keyIndex: number,
    travelMode: number
  ) { }

  async getKbName() { }

  async setDksKey(advancedKey: AdvancedKey) { }

  async getDksKey(index: number) { }

  async setDksKeyMode(index: number, travelMode: number) { }
}
