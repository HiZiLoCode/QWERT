// @ts-nocheck
"use client";

import { createContext, useState, useCallback, useEffect, useRef } from "react";
import {
  connectHID,
  KeyboardDevice,
  getAccreditDevice,
} from "../devices/KeyboardDevice";
import { WebHid, tagDevice } from "../devices/WebHid";
import { QMK_connectHID } from "../devices/QMK/QMK_KeyboardDevice";
import { KeyboardAPI, shiftFrom16Bit, shiftTo16Bit } from "../devices/KeyboardAPI";
import { initKeyboardKey } from "../keyboard/layout";
import useKeyboard from "../hooks/useKeyBoard";
import { travelKeysTestData } from "../keyboard/test";
import useMacro from "../hooks/useMacro";
import {
  AdvancedKeyItem,
  KeyboardKey,
  KeyboardLayout,
  KeyboardLayoutKey,
  KeyCode,
  KeyColor,
  KeyItem,
  WebHidDevice,
} from "../types/types";
import { ProfileContent, MacroProfile, DeviceBaseInfo } from "../types/types_v1";
import {
  testConfigInfo,
  testDefaultKeys,
  testLight,
  testTravelKeys,
  testUserKeys,
} from "@/keyboard/testData";
import {
  DEMO_LIGHT_MATRIX,
  demoDeviceBaseInfo,
  demoDeviceFuncInfo,
} from "@/keyboard/demoKeyboardDefaults";
import { deviceInfo } from "../config/deviceInfo";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Box
} from "@mui/material";
import useMatrix from "@/hooks/useMatrix";
import { DEFAULT_KEYBOARD_CONFIG, type KeyboardConfig } from '../types/leyout'
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
import { useTranslation } from "@/app/i18n";
// import { getBasicKeyToByte } from "@/utils/fileConversion";
import { buildMatrixKeyInfo, setCustomKeycodes } from "@/utils/keyLabelUtils";
import { getDefinitionByVendorProductId, saveDefinition, type KeyboardDefinition } from '../utils/definition-storage';
import { FileManager } from '@/components/FileManager';
// 检测是否是 IAP/Boot 升级模式
const isIAPMode = async (): Promise<boolean> => {
  try {
    if (!("hid" in navigator)) {
      return false;
    }

    // 检测 Boot 模式设备（VID: 0x36B0, PID: 0x33FF）
    const devices = await navigator.hid.getDevices();
    const bootDevice = devices.find(device =>
      device.vendorId === 0x36B0 &&
      device.productId === 0x33FF &&
      device.collections?.some(collection =>
        collection.usagePage === 0xFF00 &&
        collection.usage === 0x0001
      )
    );

    if (bootDevice) {
      console.log('[IAP检测] 检测到Boot模式设备:', bootDevice.productName, 'PID:', bootDevice.productId.toString(16));
      return true;
    }

    return false;
  } catch (error) {
    console.error('[IAP检测] 检测失败:', error);
    return false;
  }
};

// 统一的 IAP 模式处理函数
// 返回 true 表示检测到升级模式并已处理，调用者应该停止后续流程
const handleIAPModeDetection = async (keyboard: any, setIsUpgradeWindowOpen: Function, setLoading?: Function): Promise<boolean> => {
  try {
    // 步骤1: 检测是否有未完成的升级（异常退出检测）
    const upgradeStateStr = localStorage.getItem('firmwareUpgradeState');
    if (upgradeStateStr) {
      const upgradeState = JSON.parse(upgradeStateStr);
      console.log('[IAP统一检测] ⚠️ 检测到未完成的升级:', upgradeState);
      console.log('[IAP统一检测] 上次升级时间:', upgradeState.startTime);

      // 检查是否有固件文件信息
      const hasFirmwareFile = upgradeState.deviceInfo?.firmwareFile;
      console.log(hasFirmwareFile);

      if (!hasFirmwareFile) {
        console.log('[IAP统一检测] ❌ 未完成的升级记录中没有固件文件，跳过 Boot 检测');
        // 清理无效的升级状态
        localStorage.removeItem('firmwareUpgradeState');
        return false;
      }

      // 恢复设备信息
      if (upgradeState.deviceInfo) {
        keyboard.setDeviceVID?.(upgradeState.deviceInfo.vendorId);
        keyboard.setDevicePID?.(upgradeState.deviceInfo.productId);
        keyboard.setDeviceUpgradeFile?.(upgradeState.deviceInfo.firmwareFile);
        if (upgradeState.deviceInfo.upgradeVersion) {
          keyboard.setDeviceUpgradeVersion?.(upgradeState.deviceInfo.upgradeVersion);
        }
      }

      // 有固件文件信息，检测 Boot 设备是否在线
      if (await isIAPMode()) {
        console.log('[IAP统一检测] ✅ Boot设备在线，有固件文件，打开升级窗口以继续升级');
        setIsUpgradeWindowOpen(true);
        if (setLoading) setLoading(false);
        return true;
      } else {
        console.log('[IAP统一检测] ⚠️ Boot设备不在线，但有未完成的升级记录');
        // 继续检查是否有其他设备
      }
    }

    // 步骤2: 检测是否在 IAP/Boot 升级模式
    if (await isIAPMode()) {
      console.log('[IAP统一检测] 检测到Boot模式设备');
      console.log('[IAP统一检测] ⚠️ 但没有未完成的升级记录，不打开升级窗口');
      console.log('[IAP统一检测] 💡 提示：只有在升级过程中才会自动打开升级窗口');

      // 不处理，因为没有升级记录就说明不是异常退出
      return false;
    }

    return false;
  } catch (error) {
    console.error('[IAP统一检测] 检测失败:', error);
    return false;
  }
};

export const ConnectKbContext = createContext<any>({});

type KbConnect = {
  keyItems: KeyItem[];
  setKeyItems: Function;
  advancedKeyItems: AdvancedKeyItem[];
  setAdvancedKeyItems: Function;
  currentLayer: number;
  setCurrentLayer: Function;
  loading: boolean;
  setLoading: Function;
  connectKeyboard: Function;
  initState: Function;
  keyCodes: KeyCode[];
  setKeyCodes: Function;
  keyColors: KeyColor[];
  setKeyColors: Function;
  macroProfiles: MacroProfile[];
  setMacroProfiles: Function;
  connectedKeyboard: KeyboardDevice | undefined;
  setConnectedKeyboard: Function;
  keyboardKeys: KeyboardLayoutKey[];
  keyboardLayout: KeyboardLayout | undefined;
  calibration: boolean;
  setCalibration: Function;
  resetProgress: number;
  setResetProgress: Function;
  updateProgress: number;
  setUpdateProgress: Function;
  updateMode: boolean;
  setUpdateMode: Function;
  startUpdateFw: boolean;
  setStartUpdateFw: Function;
  forceUpdate: boolean;
  setForceUpdate: Function;
  updateFw?: Function;
  keyboard: any;
  macroList: any;
  matrixData: any;
  loadCustomProfile: Function;
  initDataLoaded: boolean;
  resetKeyboard: Function;
  keyboardData: WebHidDevice[];
  setKeyboardData: Function;
  connectState: boolean;
  setConnectState: Function;
  setConnectKeyboardStauts: Function;
  // 升级窗口状态
  isUpgradeWindowOpen: boolean;
  setIsUpgradeWindowOpen: Function;
  // 音效相关
  enableSound: boolean;
  setEnableSound: Function;
  selectedSound: string;
  setSelectedSound: Function;
};

let consumerNotifyTimer: number | null = null
let layoutConfig: KeyboardConfig = structuredClone(DEFAULT_KEYBOARD_CONFIG);
function ConnectKbProvider({ children }: { children: React.ReactNode }) {
  const [keyItems, setKeyItems] = useState<KeyItem[]>([]);
  const [advancedKeyItems, setAdvancedKeyItems] = useState<AdvancedKeyItem[]>(
    []
  );
  const [currentLayer, setCurrentLayer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [keyCodes, setKeyCodes] = useState<KeyCode[]>([]);
  const [keyColors, setKeyColors] = useState<KeyColor[]>([]);

  const [macroProfiles, setMacroProfiles] = useState<MacroProfile[]>([]);

  const [connectedKeyboard, setConnectedKeyboard] = useState<KeyboardDevice>();
  // eslint-disable-next-line
  const [keyboardLayout, setKeyboardLayout] = useState<any>();
  const [keyboardKeys, setKeyboardKeys] = useState<KeyboardLayoutKey[]>([]);

  const [initDataLoaded, setInitDataLoaded] = useState(false);
  const [calibration, setCalibration] = useState(false);

  const [resetProgress, setResetProgress] = useState(0);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [updateMode, setUpdateMode] = useState(false);
  const [startUpdateFw, setStartUpdateFw] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [keyboardData, setKeyboardData] = useState<WebHidDevice[]>([]);
  const [connectState, setConnectState] = useState(true);
  // 编码器位置
  const [encoderPosition, setEncoderPosition] = useState({});
  // 升级窗口状态 - 用于控制设备事件监听
  const [isUpgradeWindowOpen, setIsUpgradeWindowOpen] = useState(false);
  const isUpgradeWindowOpenRef = useRef(false);
  useEffect(() => {
    isUpgradeWindowOpenRef.current = isUpgradeWindowOpen;
  }, [isUpgradeWindowOpen]);

  /** 已授权键盘：轮询 / 热插拔检测「发现设备」用（与历史会话 7f903078 一致） */
  const hidAuthorizedKnownRef = useRef(new Set<string>());
  const hidAuthorizedInitRef = useRef(false);
  const initStateRef = useRef<() => Promise<void>>(async () => {});

  // QMK 配置文件管理器状态
  const [showQMKFileManager, setShowQMKFileManager] = useState(false);
  const [pendingQMKDevice, setPendingQMKDevice] = useState<any>(null);

  // 音效相关状态 - 从 localStorage 读取初始值
  const [enableSound, setEnableSound] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('keyboard_sound_enabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [selectedSound, setSelectedSound] = useState(() => {
    if (typeof window === 'undefined') return "default";
    const saved = localStorage.getItem('keyboard_sound_type');
    return saved || "default";
  });

  const keyboard = useKeyboard();
  const { showMessage } = useSnackbarDialog();
  const { t } = useTranslation("common");

  const macroList = useMacro();

  /** 连接成功：2581 / 2582（右上角设备卡片） */
  const notifyKeyboardConnected = useCallback(
    (deviceDisplayName: string) => {
      const name = (deviceDisplayName || "").trim() || "Keyboard";
      showMessage({
        title: t("2581"),
        message: t("2582", { name }),
        type: "success",
        duration: 4200,
        presentation: "deviceCard",
      });
    },
    [showMessage, t]
  );

  /** 已授权设备插入：轮询 + hid connect，持续 initState；新 address 弹「发现设备」 */
  useEffect(() => {
    if (typeof window === "undefined" || !("hid" in navigator)) {
      return;
    }

    const reconcile = async () => {
      if (isUpgradeWindowOpenRef.current) return;
      try {
        const list = (await getAccreditDevice()) || [];
        const nextKnown = new Set(list.map((d) => d.address));

        if (!hidAuthorizedInitRef.current) {
          hidAuthorizedKnownRef.current = nextKnown;
          hidAuthorizedInitRef.current = true;
          await initStateRef.current();
          return;
        }

        for (const d of list) {
          if (!hidAuthorizedKnownRef.current.has(d.address)) {
            const name = (d.productName || "").trim();
            if (name) {
              showMessage({
                title: t("2579"),
                message: t("2580", { name }),
                type: "success",
                duration: 4500,
                presentation: "deviceCard",
              });
            }
          }
        }

        hidAuthorizedKnownRef.current = nextKnown;
        await initStateRef.current();
      } catch (e) {
        console.warn("[HID] reconcile authorized devices failed", e);
      }
    };

    const intervalId = window.setInterval(() => void reconcile(), 2500);
    void reconcile();

    const onHidConnect = () => {
      window.setTimeout(() => void reconcile(), 450);
    };
    navigator.hid.addEventListener("connect", onHidConnect);

    return () => {
      window.clearInterval(intervalId);
      navigator.hid.removeEventListener("connect", onHidConnect);
    };
  }, [showMessage, t]);

  const [showWebHIDError, setShowWebHIDError] = useState(false);
  const matrixData = useMatrix(keyboard);

  // 监听音效设置变化，保存到 localStorage
  useEffect(() => {
    localStorage.setItem('keyboard_sound_enabled', JSON.stringify(enableSound));
  }, [enableSound]);

  useEffect(() => {
    localStorage.setItem('keyboard_sound_type', selectedSound);
  }, [selectedSound]);

  async function handleDeviceNotify(device, item, notifyValue) {
    console.log("devNotify", notifyValue);

    const isReconnect = notifyValue[0] === 0xAA && notifyValue[1] === 0xD0 && notifyValue[13] === 4;

    if (!isReconnect) {
      const devPID = shiftTo16Bit([notifyValue[11], notifyValue[12]]);

      console.log("设备断开:", device, item, keyboardData, connectedKeyboard);
      if (devPID === item.devPID) {
        keyboard.setDeviceMode(0);
        // 演示会话：列表里物理端点的断开通知不得清空虚拟键盘、不得拉回设备选择态
        if (!connectedKeyboard?.test) {
          setConnectState(true);
          setConnectedKeyboard(null);
        }
      }
      setKeyboardData(prev =>
        prev.map(d =>
          d.devPID === devPID ? { ...d, devMode: 0, devVID: null, devPID: null } : d
        )
      );
      return;
    }

    console.log("重新通信 startComm");
    try {
      const buf = await device.startComm();
      let devPID
      let devVID
      if (notifyValue[11] === 0 && notifyValue[12] === 0) {
        devPID = shiftTo16Bit([buf[11], buf[12]]);
        devVID = shiftTo16Bit([buf[9], buf[10]]);
      } else {
        devPID = shiftTo16Bit([notifyValue[11], notifyValue[12]]);
        devVID = shiftTo16Bit([notifyValue[9], notifyValue[10]]);
      }
      const deviceBaseInfo = await device.getDeviceBaseInfo();

      const updatedItem = {
        ...item,
        devVID,
        devPID,
        devID: deviceBaseInfo.keyboardID,
        devMode: 1,
      };
      console.log(updatedItem, 'updatedItem');

      keyboard.setDeviceMode(1);
      setKeyboardData(prev => prev.map(d => (d.address === item.address ? updatedItem : d)));

      console.log("设备重新连接:", updatedItem, deviceBaseInfo);
      return updatedItem;
    } catch (error) {
      console.error("设备重新通信失败:", error);
    }
  }

  // 消费者控制端点通知处理 (新增 - 用于 0x000c/0x0001 端点)
  async function handleConsumerNotify(
    device: any,
    notifyValue: Uint8Array
  ) {
    // notify 可以一直来
    if (!notifyValue || notifyValue.length === 0) return

    const reportId = notifyValue[0]
    const data = notifyValue.slice(1)

    console.log(
      "[ConsumerNotify] notify received",
      "reportId =", reportId,
      "data =", data
    )

    // 🔑 防抖：只执行最后一次
    if (consumerNotifyTimer) {
      clearTimeout(consumerNotifyTimer)
    }

    consumerNotifyTimer = window.setTimeout(async () => {
      try {
        console.log("[ConsumerNotify] >>> final notify triggered")

        await device.startComm()

        const deviceInfo = await device.getDeviceBaseInfo()
        keyboard.setDeviceBaseInfo(deviceInfo)

        const funcInfo = await device.getFuncInfo(deviceInfo.protocolVer)
        keyboard.setDeviceFuncInfo(funcInfo)

        console.log("[ConsumerNotify] <<< done")
      } catch (err) {
        console.error("[ConsumerNotify] error:", err)
      }
    }, 500)
  }
  async function initState() {
    // 🔍 统一的 IAP 模式检测和处理
    const isInUpgradeMode = await handleIAPModeDetection(keyboard, setIsUpgradeWindowOpen, setLoading);
    if (isInUpgradeMode) {
      console.log('[初始化] 检测到升级模式，已处理');
      return;
    }

    const deviceData = await getAccreditDevice();

    if (!deviceData?.length) {
      // 演示模式：无已授权 HID 时仍可能正在使用虚拟键盘，不应把 loading 打开导致退回首页
      if (connectedKeyboard?.test) {
        return;
      }
      setLoading(true);
      return;
    }
    const results = await Promise.all(
      deviceData.map(async (item) => {
        if (item.productId !== 12290) return { ...item, devMode: 0 };

        const device = new KeyboardDevice(new KeyboardAPI(item.address, 1));
        try {
          await device.open?.();

          if (!device.listeners.some(l => l.name === "devNotify")) {
            device.listeners.push({
              name: "devNotify",
              fn: (notifyValue) => handleDeviceNotify(device, item, notifyValue),
            });
          }

          // 注册消费者控制端点监听 (新增)
          if (!device.listeners.some(l => l.name === "consumerNotify")) {
            device.listeners.push({
              name: "consumerNotify",
              fn: (notifyValue) => handleConsumerNotify(device, notifyValue),
            });
          }

          if (loading) {
            console.log(loading, "触发Promise");

            const data = await device.getConnStatus();
            if (data.status === 4) {
              const devVID = data.vendorId;
              const devPID = data.productId;
              const deviceBaseInfo = await device.getDeviceBaseInfo();

              return { ...item, devVID, devPID, devID: deviceBaseInfo.keyboardID, devMode: 1 };
            }

          }
          return { ...item, devMode: 0 };
        } catch (error) {
          console.warn("设备初始化失败:", item.address, error);
          return { ...item, devMode: 0 };
        }
      })
    );

    console.log("初始化完成:", results);
    setKeyboardData(results.filter(Boolean));
    // initState 只负责刷新设备列表，不控制 loading
    // loading 的关闭由 setConnectKeyboardStauts 在成功获取配置后负责
  }
  initStateRef.current = initState;

  async function applyDeviceInfo(connectedKeyboard, isCustom) {
    let devVID, devPID;

    try {
      console.log("触发applyDeviceInfo");

      if (isCustom && typeof connectedKeyboard.getConnStatus === "function") {
        // 仅自定义设备支持 getConnStatus
        const data = await connectedKeyboard.getConnStatus();
        devVID = data?.vendorId ?? connectedKeyboard.vendorId;
        devPID = data?.productId ?? connectedKeyboard.productId;
      } else {
        // 标准设备直接取 vendorId/productId
        devVID = connectedKeyboard.vendorId;
        devPID = connectedKeyboard.productId;
      }
    } catch (err) {
      console.warn("⚠️ 获取设备连接状态失败，使用默认 VID/PID:", err);
      devVID = connectedKeyboard.vendorId ?? 0;
      devPID = connectedKeyboard.productId ?? 0;
    }
    keyboard.deviceVID = devVID;
    keyboard.devicePID = devPID;
    keyboard.setDeviceVIDFun?.(devVID);
    keyboard.setDevicePIDFun?.(devPID);
    keyboard.setDeviceMode(isCustom ? 1 : 0);
    return { devVID, devPID };
  }
  const initDemo = async () => {
    const connectedKeyboard = new KeyboardDevice(new KeyboardAPI("demo"));
    if (connectedKeyboard == undefined) {
      return false;
    }
    // 与真实 0x3059 设备对齐，便于功能区/自定义灯等逻辑走同一分支（仍不下发 HID）
    connectedKeyboard.vendorId = demoDeviceBaseInfo.vendorId;
    connectedKeyboard.productId = demoDeviceBaseInfo.productId;
    connectedKeyboard.productName = "Demo Keyboard";
    connectedKeyboard.deviceBaseInfo = {
      lightMaxSpeed: demoDeviceBaseInfo.lightMaxSpeed,
      logoLightMaxSpeed: demoDeviceBaseInfo.logoLightMaxSpeed ?? 6,
      sideLightMaxSpeed: demoDeviceBaseInfo.sideLightMaxSpeed ?? 6,
      matrixScreenLightMaxSpeed: demoDeviceBaseInfo.matrixScreenLightMaxSpeed ?? 6,
    };

    setConnectedKeyboard(connectedKeyboard);
    // const keyboarBaseInfo = await connectedKeyboard.getBase();

    const keyboardLayout = await connectedKeyboard.getKeyboardLayout('K98');
    console.log(keyboardLayout, "-------------keyboardLayout");
    localStorage.setItem("keyboardMode", keyboardLayout?.keyboardMode || null)
    setKeyboardLayout(keyboardLayout);

    const layoutKeys = keyboardLayout.layouts.keys;
    keyboard.initLayoutKeys(layoutKeys);

    // const defaultKeys = await connectedKeyboard.getDafultKeys();

    keyboard.updateDefaultKeys(testDefaultKeys["0"], 0);
    keyboard.updateDefaultKeys(testDefaultKeys["1"], 1);
    keyboard.updateDefaultKeys(testDefaultKeys["2"], 2);
    keyboard.updateDefaultKeys(testDefaultKeys["3"], 3);

    keyboard.updateUserKeys(testUserKeys["0"], 0, 0);
    keyboard.updateUserKeys(testUserKeys["1"], 0, 1);
    keyboard.updateUserKeys(testUserKeys["2"], 0, 2);
    keyboard.updateUserKeys(testUserKeys["3"], 0, 3);

    // const light = await connectedKeyboard.getLightConfig();

    keyboard.setKeyboardBaseInfo({
      profileIndex: 1,
    } as any);

    keyboard.updateKeyboardLight(testLight as any);

    keyboard.updateTravelKeys(testTravelKeys as any);

    // const globalTravel = await connectedKeyboard.getGlobalTravel();
    // keyboard.setTravelConfig(globalTravel as any);

    // const kbName = await connectedKeyboard.getKbName();
    keyboard.setAdvancedKeys([]);

    // 获取配置信息
    keyboard.setConfigInfo(testConfigInfo as any);

    keyboard.deviceVID = demoDeviceBaseInfo.vendorId;
    keyboard.devicePID = demoDeviceBaseInfo.productId;
    keyboard.setDeviceVID?.(demoDeviceBaseInfo.vendorId);
    keyboard.setDevicePID?.(demoDeviceBaseInfo.productId);
    keyboard.setDeviceBaseInfo(demoDeviceBaseInfo);
    keyboard.setDeviceFuncInfo(demoDeviceFuncInfo);
    keyboard.setLightMatrix(DEMO_LIGHT_MATRIX);
    keyboard.setKeysColor(Array(128).fill("#000000"));

    setInitDataLoaded(true);
    return true;
  };

  // 获取设备类型
  function getDeviceType(vendorId: number, productId: number, devId: number) {
    const key = `${"0x" + vendorId.toString(16).toUpperCase()}_${"0x" + productId.toString(16).toUpperCase()
      }_${devId}`;
    return deviceInfo[key]?.type || 101; // 默认返回 101
  }

  // 获取设备布局
  function getDeviceLayout(vendorId: number, productId: number, devId: number) {
    const key = `${"0x" + vendorId.toString(16).toUpperCase()}_${"0x" + productId.toString(16).toUpperCase()
      }_${devId}`;
    return deviceInfo[key]?.layout || "";
  }

  // 获取设备升级文件
  function getDeviceUpgradeFile(
    vendorId: number,
    productId: number,
    devId: number
  ) {
    const key = `${"0x" + vendorId.toString(16).toUpperCase()}_${"0x" + productId.toString(16).toUpperCase()
      }_${devId}`;
    return deviceInfo[key]?.updateFile || "";
  }

  // 获取设备升级版本
  // 根据vendorId、productId和devId获取设备升级版本
  function getDeviceUpgradeVersion(
    vendorId: number,
    productId: number,
    devId: number
  ) {
    // 将vendorId和productId转换为16进制并大写，然后拼接上devId，作为key
    const key = `${"0x" + vendorId.toString(16).toUpperCase()}_${"0x" + productId.toString(16).toUpperCase()
      }_${devId}`;
    // 返回deviceInfo中key对应的upgradeVersion，如果没有则返回空字符串
    return deviceInfo[key]?.upgradeVersion || "";
  }
  /**
   * 判断并连接QMK键盘设备的函数
   * @returns {Promise<any>} 返回连接的键盘设备对象
   */
  const detectAndConnectKeyboard = async (
    mode: string,
    requestAuthorize: boolean
    // 是否强制弹出一次设备选择框（用于“授权设备/重新选择设备”按钮场景）
    , forcePrompt: boolean = false
  ): Promise<KeyboardDetectResult> => {
    // 目标：无论后续是 QMK 探测还是普通连接，整个流程只弹一次“选择设备/授权”框
    // 做法：如果需要授权且当前没有任何已授权设备，则先统一触发一次 requestDevice，之后探测/连接都不再触发授权弹窗
    let userDidAuthorize = false;
    let selectedHidDevice: HIDDevice | null = null;
    if (requestAuthorize) {
      // 每次手动连接都只弹一次设备选择框，后续流程复用同一设备
      try {
        selectedHidDevice = await WebHid.requestDevice();
        userDidAuthorize = true;
      } catch (e) {
        // 用户取消授权时，不要在同一次连接流程里重复弹窗；直接走“无设备/连接失败”分支
        return { type: "91683", device: undefined };
      }
    } else {
      userDidAuthorize = true;
      const authorized = await WebHid.devices(false);
      if (authorized && authorized.length > 0) {
        selectedHidDevice = authorized[0]._device;
      }
    }

    // 统一只查询一次设备，后续 QMK/普通连接都复用同一份已选设备
    if (!selectedHidDevice) {
      return { type: "91683", device: undefined };
    }
    const selectedDevices = [tagDevice(selectedHidDevice)];

    // 只有用户明确授权后才探测 QMK，避免自动连上已授权旧 QMK 设备触发 FileManager
    if (userDidAuthorize) {
      const qmkDevice = await QMK_connectHID(mode, false, selectedDevices);
      console.log(qmkDevice);

      // 如果是QMK键盘，则返回QMK设备
      if (qmkDevice) {
        return { type: "QMK", device: qmkDevice };
      }
    }
    // 非 QMK 设备走常规连接流程
    const vendorDevice = await connectHID(mode, false, selectedDevices);
    return { type: "91683", device: vendorDevice };
  };

  // 连接键盘，如果是Demo模式，则不用连接
  const connectKeyboard = useCallback(
    async (mode: string = "product", requestAuthorize: boolean = true, forcePrompt: boolean = false) => {
      // Demo 模式：直接走 initDemo，不需要 WebHID
      if (mode === "demo") {
        const success = await initDemo();
        if (success) {
          keyboard.setDeviceStatus(true);
          keyboard.setDeviceOnline(true);
          keyboard.setDeviceType(101);
          keyboard.setDeviceName("Demo Keyboard");
          keyboard.setDeviceVID?.(demoDeviceBaseInfo.vendorId);
          keyboard.setDevicePID?.(demoDeviceBaseInfo.productId);
          setLoading(false);
          setConnectState(false);
          notifyKeyboardConnected(keyboard.deviceName || "Demo Keyboard");
        }
        return success;
      }
      if (!("hid" in navigator)) {
        setShowWebHIDError(true);
        return;
      }
      try {
        // 🔍 统一的 IAP 模式检测和处理（连接前）
        const isInUpgradeMode = await handleIAPModeDetection(keyboard, setIsUpgradeWindowOpen);
        if (isInUpgradeMode) {
          console.log('[连接设备] 检测到升级模式，已处理');
          return false;
        }

        // 设置设备未连接
        keyboard.setDeviceStatus(false);

        // WebHID连接键盘，如果第一次连接需要浏览器授权
        const { type, device } = await detectAndConnectKeyboard(mode, requestAuthorize, forcePrompt);
        // 如果没有获取到设备（用户取消授权或无设备），直接返回
        if (!device) {
          console.log('[连接设备] 未获取到设备，退出连接流程');
          return false;
        }
        keyboard.keyboardType = type;
        keyboard.setKeyboardType(type);
        if (keyboard.keyboardType === "91683") {
          // 🔍 连接后再次检测是否在 IAP 模式
          const isInUpgradeModeAfterConnect = await handleIAPModeDetection(keyboard, setIsUpgradeWindowOpen);
          if (isInUpgradeModeAfterConnect) {
            console.log('[连接设备] 连接后检测到升级模式，已处理');
            return false;
          }
        }
        await initState();
        try {
          const acc = await getAccreditDevice();
          hidAuthorizedKnownRef.current = new Set(acc.map((d) => d.address));
          hidAuthorizedInitRef.current = true;
        } catch (_) {
          /* ignore */
        }
        if (mode === "tryConnect") {
          // setConnectKeyboardStauts 内部会根据是否有配置决定是否 setLoading(false) 和切换界面
          await setConnectKeyboardStauts(device, undefined, type);
        }

        return true;
      } catch (e) {
        console.log("---------------error-----------------");
        console.log(e);
        throw e;
      }
    },
    [keyboard, notifyKeyboardConnected]
  );
  // 设置连接键盘状态
  const setConnectKeyboardStauts = async (connectedKeyboard, item?, kbType?: string) => {
    const isCustom = connectedKeyboard.productId === 12290;

    const { devVID, devPID } = await applyDeviceInfo(connectedKeyboard, isCustom);
    console.log(connectedKeyboard);

    // 设置设备名称（在获取数据前先临时设置，便于 getDeviceData 内部使用）
    keyboard.deviceName = connectedKeyboard.productName;
    keyboard.setDeviceName(connectedKeyboard.productName);

    keyboard.setDeviceVID(devVID);
    keyboard.setDevicePID(devPID);

    // 设置设备本地配置
    keyboard.setProfile(1);
    keyboard.setFnLayer(0);
    let success
    // 获取设备数据
    const resolvedType = kbType ?? keyboard.keyboardType;
    if (resolvedType === "QMK") {
      success = await getQMKDeviceData(connectedKeyboard, 1)
    } else {
      // 91683 设备：确保关闭 QMK 文件管理器
      setShowQMKFileManager(false);
      setPendingQMKDevice(null);
      success = await getDeviceData(connectedKeyboard, 1);
    }

    // 只有在成功获取数据后才设置界面状态
    if (success) {
      // 设置通讯接口（在确认有配置后才赋值）
      setConnectedKeyboard(connectedKeyboard);
      // 设置设备连接
      keyboard.setDeviceStatus(true);
      // 设置设备在线
      keyboard.setDeviceOnline(true);
      // 设置设备类型
      keyboard.setDeviceType(101);
      // 关闭 loading，进入主界面
      setLoading(false);
      // 设置设备选择界面
      setConnectState(false);
      setInitDataLoaded(true);
      notifyKeyboardConnected(connectedKeyboard.productName || keyboard.deviceName || "");
    }
    // 如果 success 为 false（无配置），不赋值 connectedKeyboard，不关闭 loading，保持在选择界面

    if (!connectedKeyboard.listeners.some(l => l.name === 'devNotify')) {
      connectedKeyboard.listeners.push({
        name: "devNotify",
        fn: (notifyValue) => handleDeviceNotify(connectedKeyboard, item, notifyValue),
      });
    }

    // 注册消费者控制端点监听 (新增)
    if (!connectedKeyboard.listeners.some(l => l.name === 'consumerNotify') && keyboard.keyboardType === "91683") {
      connectedKeyboard.listeners.push({
        name: "consumerNotify",
        fn: (notifyValue) => handleConsumerNotify(connectedKeyboard, notifyValue),
      });
    }
  };
  /**
   * 加载 QMK 键盘配置文件
   * 优先级：静态配置文件 > 本地存储配置 > 提示用户上传
   */
  const loadQMKConfig = async (keyboard): Promise<KeyboardDefinition | null> => {
    const vidStr = `0x${keyboard.deviceVID.toString(16).toUpperCase()}`;
    const pidStr = `0x${keyboard.devicePID.toString(16).toUpperCase()}`;

    console.log(`[QMK配置加载] 开始加载配置 VID: ${vidStr}, PID: ${pidStr}`);

    // 1. 尝试加载静态配置文件（从 src/data/config 目录）
    try {
      // 尝试根据设备名称加载（如果有的话）

      const deviceName = (keyboard.deviceName || '').replace(/\s+/g, '');
      if (deviceName) {
        try {
          const ext = "json".toLowerCase();
          const staticConfig = await import(`@/data/config/${deviceName}.${ext}`);
          const config = staticConfig.default || staticConfig;
          console.log(`[QMK配置加载] ✅ 成功加载静态配置: ${config.name}`);

          // 保存到本地存储，方便下次快速加载
          await saveDefinition(config);
          console.log(`[QMK配置加载] 已保存到本地存储`);

          return config;
        } catch (error) {
          console.log(`[QMK配置加载] 静态配置文件 ${deviceName}.json 不存在`);
        }
      }

      // 尝试根据 VID_PID 加载
      try {
        const ext = "json".toLowerCase();
        const staticConfig = await import(`@/data/config/${vidStr}_${pidStr}.${ext}`);
        const config = staticConfig.default || staticConfig;
        console.log(`[QMK配置加载] ✅ 成功加载静态配置: ${config.name}`);

        // 保存到本地存储，方便下次快速加载
        await saveDefinition(config);
        console.log(`[QMK配置加载] 已保存到本地存储`);

        return config;
      } catch (error) {
        console.log(`[QMK配置加载] 静态配置文件 ${vidStr}_${pidStr}.json 不存在`);
      }
    } catch (error) {
      console.log(`[QMK配置加载] 静态配置文件加载失败:`, error);
    }

    // 2. 尝试从本地存储加载
    const vendorProductId = (keyboard.deviceVID << 16) | keyboard.devicePID;
    const localConfig = await getDefinitionByVendorProductId(vendorProductId);

    if (localConfig) {
      console.log(`[QMK配置加载] ✅ 从本地存储加载配置: ${localConfig.name}`);
      return localConfig;
    }

    console.log(`[QMK配置加载] ⚠️ 未找到配置文件，需要用户上传`);
    return null;
  };

  /**
   * 继续 QMK 设备连接（配置文件已准备好）
   * 按照 keyboard-demo 的方式实现
   */
  const continueQMKConnection = async (deviceComm: any, config: KeyboardDefinition) => {
    try {
      console.log('[QMK连接] 使用配置继续连接:', config.name);

      // 保存配置到本地存储（确保用户上传的配置被持久化）
      try {
        await saveDefinition(config);
        console.log('[QMK连接] ✅ 配置已保存到 IndexedDB');
      } catch (error) {
        console.error('[QMK连接] ⚠️ 保存配置失败:', error);
      }

      // 使用配置文件初始化键盘布局
      const keyboardLayout = config;

      // 设置矩阵信息
      layoutConfig.matrix = keyboardLayout.matrix;
      const { rows, cols } = keyboardLayout.matrix;

      // 获取协议版本
      const protocolVersion = await deviceComm.getProtocolVersion();
      console.log(`[QMK连接] 协议版本: v${protocolVersion}`);
      keyboard.setVersion(protocolVersion);
      // 获取层数
      const numberOfLayers = await deviceComm.getLayerCount();
      console.log(`[QMK连接] 键盘层数: ${numberOfLayers}, 矩阵: ${rows}x${cols}`);

      // 注入自定义按键表（customKeycodes），与 keyboard-demo 一致
      setCustomKeycodes(config.customKeycodes);

      // 读取所有层的按键映射（按照 keyboard-demo 的方式）
      const allLayersKeymap = [];

      for (let layerIndex = 0; layerIndex < numberOfLayers; layerIndex++) {
        console.log(`[QMK连接] 读取 Layer ${layerIndex}...`);

        // 使用 readRawMatrix 读取原始按键码
        const rawKeycodes = await deviceComm.readRawMatrix(keyboardLayout.matrix, layerIndex);
        console.log(`[QMK连接] Layer ${layerIndex} 原始按键码 (${rawKeycodes.length}个):`, rawKeycodes);

        // 将整层按键码一次性转换为按键信息（包含 x/y/w/h/row/col 等“物理布局数据”）
        // 注意：buildMatrixKeyInfo 支持传入 keycodes 数组 + layouts.keymap
        const layerKeys = buildMatrixKeyInfo(
          rawKeycodes,
          keyboardLayout.layouts.keymap,
          keyboardLayout.matrix
        );

        allLayersKeymap.push(layerKeys);
        console.log(`[QMK连接] Layer ${layerIndex} 解析完成，共 ${layerKeys.length} 个按键`);
      }

      console.log('[QMK连接] ✅ 所有层级数据已加载:', allLayersKeymap);

      // 存储所有层的按键数据到 keyboard 对象
      keyboard.setAllQMKLayers?.(allLayersKeymap);

      // 初始化布局按键
      if (keyboardLayout.layouts?.keys) {
        keyboard.initLayoutKeys(keyboardLayout.layouts.keys);
      }

      // 解析灯光效果配置
      if (keyboardLayout.menus) {
        try {
          const parsed = await deviceComm.PARSE_MENUS_TO_LIGHTING_EFFECTS(keyboardLayout.menus);
          for (const element in parsed.effects) {
            layoutConfig.lighting.effects[element] = parsed.effects[element];
            layoutConfig.lighting.maxBrightness[element] = parsed.maxBrightness[element];
            layoutConfig.lighting.maxSpeed[element] = parsed.maxSpeed[element];
          }
          console.log('[QMK连接] 灯光配置解析完成');
        } catch (error) {
          console.warn('[QMK连接] 灯光配置解析失败:', error);
        }

        // 读取设备当前灯光状态，回显到 LightSetting
        try {
          const lightState = await deviceComm.getLightingState(keyboardLayout.menus);
          console.log('[QMK连接] 当前灯光状态:', lightState);

          // 从 VIA menus 里找各控件的 contentId，映射到 deviceFuncInfo 字段
          // 约定：Backlight 区块使用 id_qmk_rgb_matrix_* 前缀
          //        logo/side  区块使用 id_qmk_rgblight_* 前缀
          const toEffect = (id: string) => lightState[id] ?? 0;
          const toBright = (id: string, max: number) =>
            max > 0 ? Math.round((lightState[id] ?? 0) / max * 100) : 0;

          // 用 contentId 前缀区分分组类型（不依赖 group.label 字符串）
          // id_qmk_rgb_matrix_* → backlight；id_qmk_rgblight_* → logo/side
          const getGroupType = (items: any[]): 'backlight' | 'logo' | null => {
            const probe = items.find(
              (i: any) => Array.isArray(i.content) && i.content.length >= 3 && typeof i.content[0] === 'string'
            );
            if (!probe) return null;
            const cid: string = probe.content[0];
            if (cid.startsWith('id_qmk_rgb_matrix_')) return 'backlight';
            if (cid.startsWith('id_qmk_rgblight_')) return 'logo';
            return null;
          };

          const lightingMenu = keyboardLayout.menus.find((m: any) => m.label === 'Lighting');
          if (lightingMenu) {
            const funcPatch: Record<string, any> = {};

            for (const group of lightingMenu.content) {
              const items: any[] = group.content || [];
              const groupType = getGroupType(items);
              if (!groupType) continue;

              const effectItem = items.find((i: any) => i.type === 'dropdown');
              const brightItem = items.find((i: any) => i.type === 'range' && i.label === 'Brightness');
              const speedItem = items.find((i: any) => i.type === 'range' && i.label === 'Effect Speed');
              const colorItem = items.find((i: any) => i.type === 'color');

              const effectId = effectItem?.content?.[0];
              const brightId = brightItem?.content?.[0];
              const speedId = speedItem?.content?.[0];
              const colorId = colorItem?.content?.[0];
              const brightMax = brightItem?.options?.[1] ?? 255;

              if (groupType === 'backlight') {
                if (effectId) funcPatch.lightMode = toEffect(effectId);
                if (brightId) funcPatch.lightBrightness = Math.round((lightState[brightId] ?? 0) / brightMax * 100);
                if (speedId) funcPatch.lightSpeed = lightState[speedId] ?? 0;
                if (colorId) {
                  funcPatch.lightRValue = lightState[`${colorId}_hue`] ?? lightState[colorId] ?? 0;
                  funcPatch.lightGValue = lightState[`${colorId}_sat`] ?? 0;
                }
                funcPatch.lightSwitch = 0;
                funcPatch.lightCustomIndex = 0;
                funcPatch.lightMixColor = 1;
              } else if (groupType === 'logo') {
                if (effectId) funcPatch.logoLightMode = toEffect(effectId);
                if (brightId) funcPatch.logoLightBrightness = Math.round((lightState[brightId] ?? 0) / brightMax * 100);
                if (speedId) funcPatch.logoLightSpeed = lightState[speedId] ?? 0;
                if (colorId) {
                  funcPatch.logoLightRValue = lightState[`${colorId}_hue`] ?? lightState[colorId] ?? 0;
                  funcPatch.logoLightGValue = lightState[`${colorId}_sat`] ?? 0;
                }
                funcPatch.logoLightSwitch = 0;
                funcPatch.logoLightMixColor = 1;
              }
            }

            // 合并到 deviceFuncInfo（保留已有字段）
            const baseFuncInfo = keyboard.deviceFuncInfo ?? {};
            keyboard.setDeviceFuncInfo({ ...baseFuncInfo, ...funcPatch });
            console.log('[QMK连接] deviceFuncInfo 已更新:', funcPatch);
          }
        } catch (error) {
          console.warn('[QMK连接] 读取灯光状态失败:', error);
        }
      }

      // 设置键盘布局（附加原始 menus、layouts、customKeycodes，供 LightSetting / QMKKeyCodeSetting / 重置流程使用）
      setKeyboardLayout({ ...layoutConfig, menus: keyboardLayout.menus, layouts: keyboardLayout.layouts, customKeycodes: keyboardLayout.customKeycodes ?? [] });

      // 初始化 lightType 为第一个灯光分组的原始 label（不依赖硬编码字符串）
      if (keyboardLayout.menus) {
        const lightingMenu = keyboardLayout.menus.find((m: any) => m.label === 'Lighting');
        const firstGroup = lightingMenu?.content?.[0];
        if (firstGroup?.label) {
          keyboard.setLightType(firstGroup.label);
        }
      }

      // 设置键盘模式为 QMK
      localStorage.setItem("keyboardMode", "QMK");

      console.log('[QMK连接] ✅ 设备数据加载完成');
      console.log('[QMK连接] 配置信息:', {
        name: config.name,
        layers: numberOfLayers,
        matrix: `${rows}x${cols}`,
        totalKeys: rows * cols,
        protocol: `v${protocolVersion}`
      });

      return true;
    } catch (error) {
      console.error('[QMK连接] 获取设备数据时出错:', error);
      throw error;
    }
  };

  const getQMKDeviceData = async (
    deviceComm,
    profile: number
  ): Promise<boolean> => {
    if (!deviceComm) {
      console.log("GetDeviceData, deviceComm is null", deviceComm);
      return false;
    }

    try {
      console.log('[QMK设备] 开始获取设备数据');
      // 切换到 QMK 键盘时重置 deviceBaseInfo，避免残留 91683 的字段（如 matrixScreen/isLed）
      keyboard.setDeviceBaseInfo({});
      // 加载 QMK 配置文件
      const config = await loadQMKConfig(keyboard);
      console.log('[QMK设备] 配置加载结果:', config);
      console.log(keyboard.keyboardType);
      if (!config) {
        // 没有配置文件，打开文件管理器让用户上传
        // 只有在用户主动连接时才弹出文件管理器（keyboardType 已确认为 QMK）
        if (keyboard.keyboardType !== "QMK") {
          console.log('[QMK设备] 未找到配置文件，打开文件管理器');
          return false;

        }
        setPendingQMKDevice(deviceComm);
        setShowQMKFileManager(true);
      }

      // 有配置文件，直接继续连接
      console.log('[QMK设备] 找到配置文件，继续连接');
      const success = await continueQMKConnection(deviceComm, config);

      // 返回连接结果，由 setConnectKeyboardStauts 统一处理界面状态
      return success;

    } catch (error) {
      console.error("[QMK设备] 获取设备数据时出错:", error);
      throw error;
    }
  }

  /**
   * 监听 FileManager 的文件变化，自动重试加载配置
   */
  useEffect(() => {

    if (!showQMKFileManager || !pendingQMKDevice) {
      return;
    }

    console.log('[QMK自动检测] 开始监听配置文件上传');

    // 每秒检查一次是否有新上传的配置
    const checkInterval = setInterval(async () => {
      console.log('[QMK自动检测] 检查配置文件...');
      const config = await loadQMKConfig(keyboard);
      if (config) {
        console.log('[QMK设备] 检测到新配置，继续连接');
        clearInterval(checkInterval); // 立即清除定时器
        setShowQMKFileManager(false);
        const success = await continueQMKConnection(pendingQMKDevice, config);
        setPendingQMKDevice(null);

        // 连接成功后设置界面状态
        if (success) {
          setConnectState(false);
          setInitDataLoaded(true);
          notifyKeyboardConnected(config?.name || keyboard.deviceName || "");
        }
      }
    }, 1000);

    return () => {
      console.log('[QMK自动检测] 停止监听');
      clearInterval(checkInterval);
    };
  }, [showQMKFileManager, pendingQMKDevice, notifyKeyboardConnected]);
  const getDeviceData = async (
    deviceComm,
    profile: number
  ): Promise<boolean> => {
    if (!deviceComm) {
      console.log("GetDeviceData, deviceComm is null", deviceComm);
      return false;
    }

    try {
      // 开始通讯  
      await deviceComm.startComm();
      // 获取设备基本信息
      const deviceInfo = await deviceComm.getDeviceBaseInfo();
      keyboard.setDeviceBaseInfo(deviceInfo);
      // 重置界面元素
      keyboard.setLightType("backlight");

      // 设置设备升级文件
      keyboard.setDeviceUpgradeFile(
        getDeviceUpgradeFile(keyboard.deviceVID, keyboard.devicePID, deviceInfo.keyboardID)
      );
      console.log(keyboard.deviceVID, keyboard.deviceVID, 'keyboard.devVID, keyboard.devPID');

      // 设置设备升级版本
      const upgradeVersion = getDeviceUpgradeVersion(
        keyboard.deviceVID,
        keyboard.devicePID,
        deviceInfo.keyboardID
      );
      keyboard.setDeviceUpgradeVersion(upgradeVersion);


      console.log("GetDeviceData, deviceInfo", deviceInfo);
      // 获取编码位置
      if (deviceInfo.encoder) {
        setEncoderPosition(await deviceComm.getEncoderKeyMatrixData())
        console.log(encoderPosition, 'encoderPosition');

      }
      // 设置设备固件版本
      const curVersion = Number(deviceInfo.firmwareVer)
        .toString(16)
        .toUpperCase();
      keyboard.setDeviceVersion(curVersion);
      // 设置设备是否需要升级
      const needsUpgrade = parseInt(curVersion) < parseInt(upgradeVersion);
      console.log(
        "GetDeviceData, needsUpgrade",
        needsUpgrade,
        curVersion,
        upgradeVersion
      );
      keyboard.setDeviceNeedsUpgrade(needsUpgrade);


      // 设备布局
      const deviceLayout = getDeviceLayout(
        keyboard.deviceVID,
        keyboard.devicePID,
        deviceInfo.keyboardID
      );
      console.log(deviceLayout);

      const keyboardLayout = await deviceComm.getKeyboardLayout(deviceLayout);
      // 未找到键盘布局配置时，直接返回 false，不继续初始化
      if (!keyboardLayout) {
        console.warn('[getDeviceData] getKeyboardLayout 返回空，该设备在91683下未找到配置，跳过初始化');
        return false;
      }
      // 提取处理删除 255 的操作
      const removeBacklight255 = (lightArray, targetArray) => {
        lightArray.forEach((item, index) => {
          if (item === 255) targetArray.splice(index, 1);
        });
      };

      if (deviceInfo.showLight) {
        const backLight = await deviceComm.getBackLightMode();
        console.log(backLight, "backLight");

        removeBacklight255(backLight, keyboardLayout.lighting.backlight);
      }

      if (deviceInfo.showLogoLight) {
        if (!deviceInfo.showLightSideLight) {
          const sideLight = await deviceComm.getLogoLightMode();
          removeBacklight255(sideLight, keyboardLayout.lighting.sidelight);
        } else {
          const logoLight = await deviceComm.getLogoLightMode();
          removeBacklight255(logoLight, keyboardLayout.lighting.logolight);
        }
      }
      if (deviceInfo.showLightSideLight) {
        const sideLight = await deviceComm.getSideLightMode();
        console.log(sideLight);

        removeBacklight255(sideLight, keyboardLayout.lighting.sidelight);
      }
      const keyboardMode =
        keyboardLayout?.keyboardMode === 0
          ? 0
          : deviceInfo.protocolVer === 1
            ? 1
            : 2;

      localStorage.setItem("keyboardMode", keyboardMode)
      setKeyboardLayout(keyboardLayout);
      keyboard.initLayoutKeys(keyboardLayout.layouts.keys);
      console.log(deviceInfo.protocolVer);

      // 获取设备功能区信息，包括灯光
      const funcInfo = await deviceComm.getFuncInfo(deviceInfo.protocolVer);
      console.log(funcInfo);
      
      keyboard.setDeviceFuncInfo(funcInfo);
      let lightInfo = {
        light: 1,
        direct: 1,
        superRet: 1,
        brightness: 1,
        effect: 1,
        speed: 1,
        sleep: 1,
      };
      keyboard.updateKeyboardLight(lightInfo);
      console.log("GetDeviceData, funcInfo", funcInfo);

      // 获取按键默认矩阵数据
      let defaultKeys = await deviceComm.getDefaultKeyMatrixData(0);
      console.log("DefaultKey keyData", defaultKeys);
      keyboard.updateDefaultKeys(defaultKeys, 0);
      defaultKeys = await deviceComm.getDefaultKeyMatrixData(1);
      keyboard.updateDefaultKeys(defaultKeys, 1);
      defaultKeys = await deviceComm.getDefaultKeyMatrixData(2);
      keyboard.updateDefaultKeys(defaultKeys, 2);
      defaultKeys = await deviceComm.getDefaultKeyMatrixData(3);
      keyboard.updateDefaultKeys(defaultKeys, 3);
      const Matrix = await deviceComm.setMatrixLight()
      console.log(Matrix, 'Matrix');
      // 从本地存储获取宏配置数据，用于为宏类型按键设置名称
      let parsedLocalMacros: MacroProfile[] = [];
      try {
        const localMacroKey = "macro_profile_" + keyboard.version;
        const localMacros = localStorage.getItem(localMacroKey);
        if (localMacros) {
          parsedLocalMacros = JSON.parse(localMacros);
          console.log("从本地读取的宏配置:", parsedLocalMacros);

          // 将本地宏配置数据保存到状态
          setMacroProfiles(parsedLocalMacros);
          // 使用函数式更新方式调用macroList中的setMacroProfiles
          macroList.setMacroProfiles(() => parsedLocalMacros);
        }
      } catch (error) {
        console.error("读取宏配置数据出错:", error);
      }

      // 定义辅助函数，用于匹配宏名称
      const matchMacroNames = (keys) => {
        if (parsedLocalMacros.length === 0) return keys;

        return keys.map(key => {
          // 检查按键是否为宏类型(0x60)
          if ((key.type === 0x60 || key.type === 0x61) && key.code1 < parsedLocalMacros.length) {
            return {
              ...key,
              name: parsedLocalMacros[key.code1].name,
              code1: parsedLocalMacros[key.code1].key,
              code2: parsedLocalMacros[key.code1].type,
              code3: parsedLocalMacros[key.code1].replayCnt
            };
          }
          return key;
        });
      };

      // 获取并处理所有层的按键矩阵数据
      for (let layer = 0; layer < 4; layer++) {
        let userKeys = await deviceComm.getKeyMatrixData(layer);
        console.log(userKeys, 'userKeys');

        // if (layer === 0) {
        //   console.log(`userKeys keyData (layer ${layer}):`, userKeys);
        // }

        // 为宏类型的按键设置正确的宏名称
        userKeys = matchMacroNames(userKeys);

        // 更新用户按键数据
        keyboard.updateUserKeys(userKeys, 0, layer);
      }

      // 读取灯光矩阵
      const lightMatrix = await deviceComm.getLightMatrixData();
      console.log("lightMatrix", lightMatrix);
      keyboard.setLightMatrix(lightMatrix);
      if (deviceInfo.matrixScreen) {
        const lightMatrixV2 = await deviceComm.getLightMode();
      }
      // 结束通讯
      // await deviceComm.stopComm();

      return true;
    } catch (error) {
      console.error("获取设备数据时出错:", error);
      // await deviceComm.stopComm();
      throw error;
    }
  };

  const diffKey = (key1, key2) => {
    return (
      key1.type == key2.type &&
      key1.code1 == key2.code1 &&
      key1.code2 == key2.code2
    );
  };

  const initProfileData = async (connectedKeyboard, profileIndex) => {
    setResetProgress(90);
  };

  const loadCustomProfile = async (profile: ProfileContent) => {
    if (!connectedKeyboard) {
      return;
    }
    const { userKeys, travelKeys, light, advancedKeys, colorKeys } = profile;
    keyboard.updateKeyboardLight(light);
    keyboard.updateAllUserKeys(userKeys);
    keyboard.updateAllColorKeys(colorKeys);
    keyboard.setAdvancedKeys(advancedKeys);
    keyboard.updateTravelKeys(travelKeys);

    await connectedKeyboard.setLightConfig(light);
    await connectedKeyboard.setAllUserKeys(userKeys);
    await connectedKeyboard.setAdvancedKeys(advancedKeys);
    await connectedKeyboard.setTravelKeys(travelKeys);

    // connectedKeyboard.setReportRate(reportRate);
  };

  const getKeyboardConfig = async (vendorId, productId, layoutMode = "") => {
    const kbConf = await import(
      `@/data/keyboardLayout/${vendorId}_${productId}${layoutMode == "iso" ? "_iso" : ""
      }.json`
    );
    // const kbConf = await import(`@/data/keyboardLayout/13357_58451${layoutMode == 'iso' ? '_iso' : ''}.json`);
    return kbConf;
  };

  // 恢复出厂设置
  const resetKeyboard = () => {
    if (!connectedKeyboard) return;
    setResetProgress(0);
    connectedKeyboard.restoreFactorySettings().then(async () => {
      setResetProgress(50);
      // 开始通讯
      await connectedKeyboard.startComm();

      // 获取设备功能区信息，包括灯光
      const funcInfo = await connectedKeyboard.getFuncInfo(keyboard.deviceBaseInfo.protocolVer);
      console.log(funcInfo,'1231232111');

      keyboard.setDeviceFuncInfo(funcInfo);
      let lightInfo = {
        light: 1,
        direct: 1,
        superRet: 1,
        brightness: 1,
        effect: 1,
        speed: 1,
        sleep: 1,
      };
      keyboard.updateKeyboardLight(lightInfo);
      console.log("GetDeviceData, funcInfo", funcInfo);

      // 获取并处理所有层的按键矩阵数据
      for (let layer = 0; layer < 4; layer++) {
        let userKeys = await connectedKeyboard.getKeyMatrixData(layer);
        keyboard.updateUserKeys(userKeys, 0, layer);
      }

      setResetProgress(90);
      // 读取灯光矩阵                                                             
      const lightMatrix = await connectedKeyboard.getLightMatrixData();
      console.log("lightMatrix", lightMatrix);
      keyboard.setLightMatrix(lightMatrix);
      // 结束通讯
      // await connectedKeyboard.stopComm();
      setResetProgress(100);

      // 清除本地存储的宏数据
      try {
        const localMacroKey = "macro_profile_" + keyboard.version;
        localStorage.removeItem(localMacroKey);
        localStorage.removeItem("macro_profile_index_" + keyboard.version);
        localStorage.setItem('layoutLanguage', "en-US")
        // 清空宏配置数据，确保使用函数式更新来触发所有组件的重绘
        setMacroProfiles([]);

        // 使用函数式更新，确保macroList数据被正确清空
        macroList.setMacroProfiles(() => []);

        // 清空选中的宏相关状态
        if (macroList.selectedMacro) {
          macroList.setSelectedMacro(null);
        }

        // 清空宏动作列表
        if (macroList.macroActions && macroList.macroActions.length > 0) {
          macroList.setMacroAction([]);
        }

        // 重置新宏索引
        if (macroList.newMacroIndex !== 0) {
          macroList.setNewMacroIndex(0);
        }

        // 确保所有状态都被正确重置，触发UI更新
        setTimeout(() => {
          console.log("宏数据已完全清除，UI已更新");
        }, 0);

      } catch (error) {
        console.error("清除宏数据出错:", error);
      }
    });
  };

  const connectKb: KbConnect = {
    keyItems,
    setKeyItems,
    encoderPosition,
    advancedKeyItems,
    setAdvancedKeyItems,
    currentLayer,
    setCurrentLayer,
    connectKeyboard,
    setConnectKeyboardStauts,
    initState,
    loading,
    setLoading,
    keyCodes,
    setKeyCodes,
    keyColors,
    setKeyColors,
    macroProfiles,
    setMacroProfiles,
    connectedKeyboard,
    keyboardKeys,
    keyboardLayout,
    keyboard,
    setConnectedKeyboard,
    macroList,
    matrixData,
    loadCustomProfile,
    initDataLoaded,
    calibration,
    setCalibration,
    resetKeyboard,
    resetProgress,
    setResetProgress,
    updateProgress,
    setUpdateProgress,
    updateMode,
    setUpdateMode,
    startUpdateFw,
    setStartUpdateFw,
    forceUpdate,
    setForceUpdate,
    keyboardData,
    setKeyboardData,
    connectState,
    setConnectState,
    // 升级窗口状态
    isUpgradeWindowOpen,
    setIsUpgradeWindowOpen,
    detectAndConnectKeyboard,
    // 音效相关
    enableSound,
    setEnableSound,
    selectedSound,
    setSelectedSound,
    // QMK 配置文件管理器
    showQMKFileManager,
    setShowQMKFileManager,
  };
  return (
    <ConnectKbContext.Provider value={connectKb}>
      {children}
      <Dialog open={showWebHIDError} onClose={() => setShowWebHIDError(false)}>
        <DialogTitle>浏览器不支持</DialogTitle>
        <DialogContent>
          <DialogContentText>
            您的浏览器不支持 WebHID 功能，请使用 Chrome 或 Edge 浏览器。
          </DialogContentText>
        </DialogContent>
      </Dialog>

      {/* QMK 配置文件管理器 */}
      <FileManager
        open={showQMKFileManager}
        onClose={() => {
          setShowQMKFileManager(false);
          setPendingQMKDevice(null);
        }}
        t={(key: string) => key}
      />
    </ConnectKbContext.Provider>
  );
}

export default ConnectKbProvider;
