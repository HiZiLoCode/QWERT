"use client";

import { createContext, useState, ReactNode, useEffect, useRef, useCallback } from "react";
import {
  FilterDevice, screenInfo, type ConnectScreenHidResult
} from "../types/types";
import { DeviceComm, connectDeviceHID, type LcdScreenFuncInfo } from "../LEDdevices/LCDScreenDevice";
import { useTranslation } from "@/app/i18n";
import { usbDetect } from "../shims/led-usb-detection";
import { GifEditState } from "../../../drive_app/src/components/GifEditor/types";
import { TransferProgress } from "@/components/GifConverter";
type MainProps = {
  softwareVersion: string;
  deviceComm?: DeviceComm;
  connectDevice: (filter: FilterDevice[] | undefined) => Promise<ConnectScreenHidResult>;
  disconnectDevice: Function;       // 断开设备
  downLoad: boolean;                // 下载状态
  setDownLoad: Function;
  demoMode: boolean;                // 演示模式
  setDemoMode: Function;

  connectMode: string;
  deviceStatus: boolean;           // 设备连接状态
  setDeviceStatus: Function;
  screenWidth: number;
  screenHeight: number;
  t: Function;

  appliedEditStates: GifEditState[];
  setAppliedEditStates: Function;
  qgifModule: any;
  setQgifModule: Function;
  isDownloading: boolean;
  setIsDownloading: Function;
  downloadProgress: TransferProgress | null;
  setDownloadProgress: Function;
  selectedScreen: number | null;
  setSelectedScreen: (screenIdx: number) => void;
  screenInfo: screenInfo;
  /** 0x14 读回的屏幕功能区摘要（含 upgrade_status），轮询时更新 */
  lcdScreenFuncInfo?: LcdScreenFuncInfo;
  /** WebHID 屏幕固件/图传 OTA：须同步置 true，在 downLoad 状态提交前即拦住 0x1C/0x14 心跳 */
  setScreenFirmwareOtaBlocking?: (blocked: boolean) => void;
  /** 与 ref 同步，供 Content 等在 OTA 期间跳过 USB remove 对键盘列表的误处理 */
  screenFirmwareOtaBlocking?: boolean;
};

export const MainContext = createContext({} as MainProps);

function MainProvider({ children }: { children: ReactNode }) {
  const [qgifModule, setQgifModule] = useState<any>(null);
  // GIF文件和预览状态
  const [appliedEditStates, setAppliedEditStates] = useState<GifEditState[]>([
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] }
  ]);
  // 下载状态管理
  const [isDownloading, setIsDownloadingState] = useState(false);
  const isDownloadingRef = useRef(false);
  const setIsDownloading = useCallback((v: boolean) => {
    isDownloadingRef.current = v;
    setIsDownloadingState(v);
  }, []);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);

  // 编辑状态
  const [selectedScreen, setSelectedScreen] = useState<number | null>(null);
  // 软件版本
  const [softwareVersion, setSoftwareVersion] = useState("1.0.1");
  const [deviceComm, setDeviceComm] = useState<DeviceComm>();
  const [downLoad, setDownLoadState] = useState(false);
  const downLoadRef = useRef(false);
  const setDownLoad = useCallback((v: boolean) => {
    downLoadRef.current = v;
    setDownLoadState(v);
  }, []);
  /** 与 downLoad 解耦：在 React 批处理前即可为 true，彻底跳过 LCD 心跳里的 pollConnectStatus */
  const screenFirmwareOtaBlockingRef = useRef(false);
  const [screenFirmwareOtaBlocking, setScreenFirmwareOtaBlockingState] = useState(false);
  const setScreenFirmwareOtaBlocking = useCallback((blocked: boolean) => {
    screenFirmwareOtaBlockingRef.current = blocked;
    setScreenFirmwareOtaBlockingState(blocked);
  }, []);
  // 演示模式
  const [demoMode, setDemoMode] = useState(false);
  // 设备连接状态
  const [deviceStatus, setDeviceStatus] = useState(false);

  const [connectMode, setConnectMode] = useState("USB");

  // 屏幕宽高
  const [screenWidth, setScreenWidth] = useState(240);
  const [screenHeight, setScreenHeight] = useState(136);
  // 基本信息
  const [screenInfo, setScreenInfo] = useState<screenInfo>()
  const [funcInfo, setFuncInfo] = useState<LcdScreenFuncInfo | undefined>(undefined);
  const { t } = useTranslation("common");
  const lcdHeartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLcdHeartbeat = useCallback(() => {
    if (lcdHeartbeatIntervalRef.current != null) {
      clearInterval(lcdHeartbeatIntervalRef.current);
      lcdHeartbeatIntervalRef.current = null;
    }
  }, []);

  // 设备断开处理函数
  const handleDeviceDisconnect = async (device: HIDDevice) => {
    console.log('设备断开:', device.productName, 'VID:', device.vendorId, 'PID:', device.productId);

    // OTA 图传/固件密集 OUT 时，Windows/复合设备偶发瞬时 disconnect，清空 deviceComm 会导致第二次升级中途「假掉线」
    if (screenFirmwareOtaBlockingRef.current) {
      console.warn(
        '[MainProvider] 屏幕固件 OTA 进行中，忽略本次 HID disconnect，避免误清空 deviceComm；若已物理拔线，下一包 OUT 仍会失败。'
      );
      return;
    }

    // 检查断开的设备是否是当前连接的设备
    if (deviceComm && deviceComm.vendorId === device.vendorId && deviceComm.productId === device.productId) {
      console.log('当前连接的设备已断开，更新状态');
      setDeviceStatus(false);
      setDeviceComm(undefined);
      setIsDownloading(false);
      setDownLoad(false);
      setFuncInfo(undefined);
      screenFirmwareOtaBlockingRef.current = false;
      clearLcdHeartbeat();
    }
  };

  // 设备连接处理函数
  const handleDeviceConnect = (device: HIDDevice) => {
    console.log('设备连接:', device.productName, 'VID:', device.vendorId, 'PID:', device.productId);
    // 连接事件不自动连接，需要用户手动点击连接按钮
  };

  // 初始化USB设备监听
  useEffect(() => {
    // 启动USB设备监控
    usbDetect.startMonitoring();

    // 注册设备断开事件监听
    usbDetect.on('disconnect', handleDeviceDisconnect);
    usbDetect.on('connect', handleDeviceConnect);

    // 清理函数
    return () => {
      usbDetect.off('disconnect', handleDeviceDisconnect);
      usbDetect.off('connect', handleDeviceConnect);
      // 不调用cleanup，避免影响其他可能的监听
    };
  }, [deviceComm]);


  function roundToNearestDivisible(n: number, divisor: number) {
    const remainder = n % divisor;
    if (remainder === 0) return n;

    const lower = n - remainder;
    const upper = lower + divisor;

    return (n - lower <= upper - n) ? lower : upper;
  }
  // 异步函数，用于轮询连接状态
  const pollConnectStatus = async (connecDevice: DeviceComm, downLoad?: boolean) => {
    // LCD 下发过程中禁止轮询：否则会发 0x1C（getConnectStatus），且在 status≠2 时误发 0x1A，打断 0x19 传图
    // 不在「动效」页也要轮询：设置页等连接屏幕后同样依赖 0x1C 维持链路
    if (screenFirmwareOtaBlockingRef.current || downLoad || isDownloadingRef.current || !connecDevice) {
      return;
    }
    // 获取连接状态
    const connectStatus = await connecDevice.getConnectStatus();
    // 将连接状态转换为数字
    const statusNum = Number(connectStatus.connect_status);
    // 设置连接模式
    setConnectMode(['蓝牙', '2.4G', 'USB'][statusNum]);

    // 0x14 读屏幕功能区：用 upgrade_status===0 判定非升级态，再发 0x1A（避免传图/升级中误打断）
    const fi = await connecDevice.getScreenFuncInfo();
    setFuncInfo(fi);
    if (statusNum !== 2 && connecDevice && Number(fi.upgrade_status) === 0) {
      const buffer = new Uint8Array(65).fill(0);
      buffer[1] = 0xAA;
      buffer[2] = 0x1A;
      await connecDevice.setData(Array.from(buffer));
    }
  };

  // 连接设备
  const connectDevice = async (filter: FilterDevice[] | undefined): Promise<ConnectScreenHidResult> => {
    try {
      // 连接设备
      const connecDevice = await connectDeviceHID(filter);
      if (connecDevice === undefined) {
        console.log("connectedDevice undefined, not find device!");
        setDeviceStatus(false);
        setDeviceComm(undefined);
        return { success: false };
      }
      setDeviceStatus(true);
      setDeviceComm(connecDevice);
      const screenInfo = await connecDevice.getScreenSize()
      console.log(screenInfo, 'screenInfo');
      setFuncInfo(await connecDevice.getScreenFuncInfo());
      setScreenWidth(screenInfo.width)
      setScreenHeight(roundToNearestDivisible(screenInfo.height, 4));
      setScreenInfo(screenInfo)
      // 同步时间
      connecDevice.syncTime()
      clearLcdHeartbeat();
      // 初始化执行一次 0x1C，并每 3 秒心跳（设置页等非「动效」页也需维持）
      void pollConnectStatus(connecDevice, downLoadRef.current).catch((e) =>
        console.warn('pollConnectStatus:', e)
      );
      lcdHeartbeatIntervalRef.current = setInterval(() => {
        void pollConnectStatus(connecDevice, downLoadRef.current).catch((e) =>
          console.warn('pollConnectStatus:', e)
        );
      }, 3000);
      return { success: true, screenInfo };
    } catch (error) {
      console.error("连接设备失败:", error);
      clearLcdHeartbeat();
      setDeviceStatus(false);
      setDeviceComm(undefined);
      setFuncInfo(undefined);
      return { success: false };
    }
  };

  // 设备断开
  const disconnectDevice = async () => {
    clearLcdHeartbeat();
    screenFirmwareOtaBlockingRef.current = false;
    setDeviceStatus(false);
    setDeviceComm(undefined);
    setFuncInfo(undefined);
  };

  const mainProps: MainProps = {
    screenInfo,
    lcdScreenFuncInfo: funcInfo,
    softwareVersion,
    deviceComm,             // 连接设备
    connectDevice,          // 断开设备
    disconnectDevice,
    demoMode,                // 演示模式
    setDemoMode,
    downLoad,
    setDownLoad,
    connectMode,
    deviceStatus,            // 设备连接状态
    setDeviceStatus,
    screenWidth,
    screenHeight,
    t,
    appliedEditStates,
    setAppliedEditStates,
    setQgifModule,
    qgifModule,
    isDownloading,
    setIsDownloading,
    downloadProgress,
    setDownloadProgress,
    selectedScreen,
    setSelectedScreen,
    setScreenFirmwareOtaBlocking,
    screenFirmwareOtaBlocking,
  };

  return (
    <MainContext.Provider value={mainProps}>{children}</MainContext.Provider>
  );
}

export default MainProvider;
