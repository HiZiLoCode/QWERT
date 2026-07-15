// @ts-nocheck
"use client";

import { createContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  connectHID,
  KeyboardDevice,
  getAccreditDevice,
} from "../devices/KeyboardDevice";
import { WebHid, tagDevice, resolveVendorCommHidDevice, hidDeviceMatchesConnectedKeyboard } from "../devices/WebHid";
import { QMK_connectHID } from "../devices/QMK/QMK_KeyboardDevice";
import { KeyboardAPI, shiftFrom16Bit, shiftTo16Bit } from "../devices/KeyboardAPI";
import { initKeyboardKey } from "../keyboard/layout";
import useKeyboard from "../hooks/useKeyBoard";
import { travelKeysTestData } from "../keyboard/test";
import useMacro from "../hooks/useMacro";
import { createSmoothProgressController } from "@/utils/keyboardSwitchProgress";
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
import { buildQmkLightingFuncPatch } from '@/utils/qmkLightingBridge';
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
import {
  deviceInfo,
  deviceInfoKey,
  getDeviceUiCapabilities,
  getPhysicalLayoutStem,
  getQmkConfigFileStem,
  hasIapBootDeviceInDeviceInfo,
  isKeyboardDriverUpgradeDisabled,
} from "../config/deviceInfo";
import {
  listBootRecoveryKeyboardOptions,
  type BootRecoveryKeyboardOption,
} from "@/utils/bootRecoveryKeyboardOptions";
import {
  clearFirmwareUpgradeState,
  getDiscardFirmwareUpgradeStateReason,
  isActiveFirmwareUpgradeState,
  isIapBootUpgradePersistStep,
  readFirmwareUpgradeState,
  saveFirmwareUpgradeState,
} from "@/utils/firmwareUpgradeState";
import BootRecoveryKeyboardDialog from "@/components/common/BootRecoveryKeyboardDialog";
import {
  isDeviceAnyMacroKey,
  toDeviceKeyType,
  toVendorAnyUserKey,
} from "@/utils/vendor91683AnyKey";
import {
  getAuthorizedIapBootDevice,
  isIapBootHidDevice,
  requestIapBootAuthorization,
} from "@/utils/iapBootDevice";
import { isHidWriteNotAllowedError } from "@/lib/hidOutputWriteLock";
import {
  beginKeyboardHidUserSession,
  clearKeyboardHidDriverCaches,
  endKeyboardHidUserSession,
  isKeyboardHidReconcilePaused,
  isKeyboardHidUserSessionActive,
  pauseKeyboardHidReconcile,
  releaseAllKeyboardHidSessions,
  releaseKeyboardHidSessionForAddress,
  setKeyboardAuthorizePickerOpen,
  waitForHidEnumerationStable,
  waitForKeyboardHidReconcileIdle,
} from "@/utils/keyboardHidSession";
import { areNavigatorHidNativeEventsSuspended } from "@/utils/hidNativeEventGate";
import { isFirmwareVersionBehind, isFirmwareVersionUpgradeable } from "@/utils/firmwareVersionCompare";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box
} from "@mui/material";
import {
  checkWebHIDSupport,
  getWebHIDUnsupportedMessageKey,
  type WebHIDSupportInfo,
} from "@/utils/checkWebHIDSupport";
import useMatrix from "@/hooks/useMatrix";
import { getMatrixScreenConfig } from "../config/deviceInfo";
import {
  loadMatrixLightConfig,
  matrixLightConfigToEffects,
  matrixLightMetaFromConfig,
} from "@/utils/matrixLightConfig";
import { resolveQmkEffectsKeyForLabel } from "@/utils/qmkLightingBridge";
import { createLatticeScreenComm } from "@/devices/lattice/LatticeScreenDevice";
import { DEFAULT_KEYBOARD_CONFIG, type KeyboardConfig } from '../types/leyout'
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
import { useTranslation } from "@/app/i18n";
// import { getBasicKeyToByte } from "@/utils/fileConversion";
import { buildMatrixKeyInfo, setCustomKeycodes } from "@/utils/keyLabelUtils";
import { loadPhysicalLayoutKeys, mergePhysicalLayoutWithQmkLayer, qmkLayerToLayoutKeys } from "@/utils/qmkLayoutBridge";
import { getDefinitionByVendorProductId, saveDefinition, type KeyboardDefinition } from '../utils/definition-storage';
import { FileManager } from '@/components/FileManager';
function lookupConfiguredUpgradeVersion(
  vendorId?: number,
  productId?: number,
  keyboardID = 0,
): string {
  if (vendorId == null || productId == null) return "";
  const key = deviceInfoKey(vendorId, productId, keyboardID);
  return deviceInfo[key]?.upgradeVersion || "";
}

function hydrateKeyboardFromPersistedUpgrade(keyboard: any, upgradeState: ReturnType<typeof readFirmwareUpgradeState>) {
  const di = upgradeState?.deviceInfo;
  if (!di) return;
  if (di.vendorId != null) keyboard.setDeviceVID?.(di.vendorId);
  if (di.productId != null) keyboard.setDevicePID?.(di.productId);
  if (di.firmwareFile) keyboard.setDeviceUpgradeFile?.(di.firmwareFile);
  const savedVersion = di.upgradeVersion?.trim();
  if (savedVersion && upgradeState?.isUpgrading) {
    keyboard.setDeviceUpgradeVersion?.(savedVersion);
    return;
  }
  const cfgVersion = lookupConfiguredUpgradeVersion(di.vendorId, di.productId, 0);
  if (cfgVersion) keyboard.setDeviceUpgradeVersion?.(cfgVersion);
}

/** 仅恢复 localStorage 中的升级元数据，不跳转升级页 */
const handleIAPModeDetection = async (keyboard: any): Promise<void> => {
  try {
    const upgradeState = readFirmwareUpgradeState();
    if (!upgradeState) return;

    console.log('[IAP统一检测] 检测到 localStorage 升级记录:', upgradeState);
    const discardReason = getDiscardFirmwareUpgradeStateReason(upgradeState, {
      vendorId: upgradeState.deviceInfo?.vendorId,
      productId: upgradeState.deviceInfo?.productId,
      currentUpgradeVersion: lookupConfiguredUpgradeVersion(
        upgradeState.deviceInfo?.vendorId,
        upgradeState.deviceInfo?.productId,
        0,
      ),
    });
    if (discardReason) {
      console.log('[IAP统一检测] 丢弃无效/过期升级记录:', discardReason);
      clearFirmwareUpgradeState();
      return;
    }
    hydrateKeyboardFromPersistedUpgrade(keyboard, upgradeState);
  } catch (error) {
    console.error('[IAP统一检测] 检测失败:', error);
  }
};

export const ConnectKbContext = createContext<any>({});

type KeyboardDetectResult =
  | { type: 'QMK' | '91683'; device: KeyboardDevice | undefined; bootHid?: undefined }
  | { type: 'IAP_BOOT'; device?: undefined; bootHid: HIDDevice };

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
  connectBootForFirmwareUpgrade: () => Promise<boolean>;
  disconnectCurrentKeyboardAndReturnHome: () => void;
  initState: Function;
  /** 刷新已授权键盘列表（切换设备 Popover 用） */
  refreshAuthorizedKeyboardList: () => Promise<void>;
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
  /** QMK：当前连接使用的完整 VIA JSON 定义 */
  qmkLoadedDefinition: KeyboardDefinition | null;
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
  isKeyboardSwitching: boolean;
  keyboardSwitchProgress: number;
  keyboardSwitchLabel: string;
  beginKeyboardSwitch: (deviceName?: string) => void;
  abortKeyboardSwitch: () => void;
  // 升级窗口状态
  isUpgradeWindowOpen: boolean;
  setIsUpgradeWindowOpen: Function;
  pendingOpenUpgradeAfterBootConnect: boolean;
  setPendingOpenUpgradeAfterBootConnect: Function;
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
  const [qmkLoadedDefinition, setQmkLoadedDefinition] = useState<KeyboardDefinition | null>(null);
  const [keyboardKeys, setKeyboardKeys] = useState<KeyboardLayoutKey[]>([]);

  const [initDataLoaded, setInitDataLoaded] = useState(false);
  const [isKeyboardSwitching, setIsKeyboardSwitching] = useState(false);
  const [keyboardSwitchProgress, setKeyboardSwitchProgress] = useState(0);
  const [keyboardSwitchLabel, setKeyboardSwitchLabel] = useState('');
  const switchProgressCtrlRef = useRef(createSmoothProgressController());
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
  /** Boot 授权并进入主界面后，再打开升级弹窗 */
  const [pendingOpenUpgradeAfterBootConnect, setPendingOpenUpgradeAfterBootConnect] = useState(false);
  /** 无升级记录时 Boot 救砖：选择键盘型号 */
  const [bootRecoveryOpen, setBootRecoveryOpen] = useState(false);
  const pendingBootHidRef = useRef<HIDDevice | null>(null);
  /** Boot 救砖会话中：阻止 reconcile 把页面打回首页（避免 initDataLoaded 闭包过期） */
  const bootRecoverySessionRef = useRef(false);
  const initDataLoadedRef = useRef(false);
  const bootRecoveryOptions = useMemo(() => listBootRecoveryKeyboardOptions(), []);
  const isUpgradeWindowOpenRef = useRef(false);
  useEffect(() => {
    isUpgradeWindowOpenRef.current = isUpgradeWindowOpen;
  }, [isUpgradeWindowOpen]);

  useEffect(() => {
    initDataLoadedRef.current = initDataLoaded;
  }, [initDataLoaded]);

  /** 页面加载时丢弃明显过期的升级残留，避免旧版本号影响提示 */
  useEffect(() => {
    const state = readFirmwareUpgradeState();
    if (!state) return;
    const reason = getDiscardFirmwareUpgradeStateReason(state, {
      vendorId: state.deviceInfo?.vendorId,
      productId: state.deviceInfo?.productId,
      currentUpgradeVersion: lookupConfiguredUpgradeVersion(
        state.deviceInfo?.vendorId,
        state.deviceInfo?.productId,
        0,
      ),
    });
    if (reason === 'expired' || reason === 'no-firmware-file' || reason === 'config-version-changed') {
      console.log('[firmwareUpgradeState] 页面加载清理残留:', reason);
      clearFirmwareUpgradeState();
    }
  }, []);

  /** 已授权键盘：轮询 / 热插拔检测「发现设备」用（与历史会话 7f903078 一致） */
  const hidAuthorizedKnownRef = useRef(new Set<string>());
  const hidAuthorizedInitRef = useRef(false);
  const reconcileInFlightRef = useRef(false);
  /** 授权/连接进行中：暂停 reconcile，避免与 requestDevice / startComm 并发写 HID 导致 tab 崩溃 */
  const keyboardConnectInFlightRef = useRef(false);
  const hidAuthorizeDialogOpenRef = useRef(false);
  const initStateRef = useRef<() => Promise<void>>(async () => {});
  const reconcileFnRef = useRef<() => void>(() => {});
  const reconcileIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconcileInitialTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHidConnectHandlerRef = useRef<(() => void) | null>(null);
  const reconcilePollingPausedRef = useRef(false);

  const pauseReconcilePolling = useCallback(() => {
    reconcilePollingPausedRef.current = true;
    if (reconcileIntervalRef.current != null) {
      window.clearInterval(reconcileIntervalRef.current);
      reconcileIntervalRef.current = null;
    }
    if (reconcileInitialTimeoutRef.current != null) {
      window.clearTimeout(reconcileInitialTimeoutRef.current);
      reconcileInitialTimeoutRef.current = null;
    }
    if (onHidConnectHandlerRef.current) {
      navigator.hid.removeEventListener("connect", onHidConnectHandlerRef.current);
    }
  }, []);

  const resumeReconcilePolling = useCallback(() => {
    if (!reconcilePollingPausedRef.current) return;
    reconcilePollingPausedRef.current = false;
    const reconcile = reconcileFnRef.current;
    if (reconcileIntervalRef.current == null && reconcile) {
      reconcileIntervalRef.current = window.setInterval(() => void reconcile(), 2500);
    }
    if (onHidConnectHandlerRef.current) {
      navigator.hid.addEventListener("connect", onHidConnectHandlerRef.current);
    }
  }, []);

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
        presentation: "deviceCardDark",
      });
    },
    [showMessage, t]
  );

  /** 当前连接的键盘已物理断开 → 回到首页重新选设备 */
  const disconnectCurrentKeyboardAndReturnHome = useCallback(() => {
    if (connectedKeyboard?.test || connectedKeyboard?.api?.address === 'demo') {
      return;
    }
    pauseKeyboardHidReconcile(2000);
    releaseKeyboardHidSessionForAddress(connectedKeyboard?.api?.address);
    setConnectedKeyboard(null);
    setQmkLoadedDefinition(null);
    setShowQMKFileManager(false);
    setPendingQMKDevice(null);
    keyboard.setDeviceStatus(false);
    keyboard.setDeviceOnline(false);
    keyboard.setDeviceMode(0);
    setConnectState(true);
    setLoading(true);
    initDataLoadedRef.current = false;
    setInitDataLoaded(false);
  }, [connectedKeyboard, keyboard]);

  /** 已授权设备插入：轮询 + hid connect，持续 initState；新 address 弹「发现设备」 */
  useEffect(() => {
    if (typeof window === "undefined" || !("hid" in navigator)) {
      return;
    }

    const reconcile = async () => {
      if (
        isUpgradeWindowOpenRef.current
        || reconcileInFlightRef.current
        || keyboardConnectInFlightRef.current
        || hidAuthorizeDialogOpenRef.current
        || bootRecoverySessionRef.current
        || isKeyboardHidUserSessionActive()
        || areNavigatorHidNativeEventsSuspended()
        || isKeyboardHidReconcilePaused()
      ) {
        return;
      }
      reconcileInFlightRef.current = true;
      try {
        const list = (await getAccreditDevice()) || [];
        const nextKnown = new Set(list.map((d) => d.address));
        const addressesChanged =
          list.length !== hidAuthorizedKnownRef.current.size
          || list.some((d) => !hidAuthorizedKnownRef.current.has(d.address));

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
                presentation: "deviceCardDark",
              });
            }
          }
        }

        hidAuthorizedKnownRef.current = nextKnown;
        if (addressesChanged) {
          await initStateRef.current();
        }
      } catch (e) {
        console.warn("[HID] reconcile authorized devices failed", e);
      } finally {
        reconcileInFlightRef.current = false;
      }
    };

    reconcileFnRef.current = reconcile;

    const intervalId = window.setInterval(() => void reconcile(), 2500);
    reconcileIntervalRef.current = intervalId;
    const initialReconcileId = window.setTimeout(() => void reconcile(), 3500);
    reconcileInitialTimeoutRef.current = initialReconcileId;

    const onHidConnect = () => {
      if (
        areNavigatorHidNativeEventsSuspended()
        || keyboardConnectInFlightRef.current
        || hidAuthorizeDialogOpenRef.current
        || isKeyboardHidUserSessionActive()
      ) {
        return;
      }
      window.setTimeout(() => {
        if (
          areNavigatorHidNativeEventsSuspended()
          || keyboardConnectInFlightRef.current
          || hidAuthorizeDialogOpenRef.current
          || isKeyboardHidUserSessionActive()
          || isKeyboardHidReconcilePaused()
        ) {
          return;
        }
        void reconcile();
      }, 1200);
    };
    onHidConnectHandlerRef.current = onHidConnect;
    navigator.hid.addEventListener("connect", onHidConnect);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(initialReconcileId);
      reconcileIntervalRef.current = null;
      reconcileInitialTimeoutRef.current = null;
      if (onHidConnectHandlerRef.current) {
        navigator.hid.removeEventListener("connect", onHidConnectHandlerRef.current);
      }
    };
  }, [showMessage, t]);

  const [showWebHIDError, setShowWebHIDError] = useState(false);
  const [webHidSupportInfo, setWebHidSupportInfo] = useState<WebHIDSupportInfo | null>(null);
  const matrixData = useMatrix(keyboard);

  const openWebHIDUnsupportedDialog = useCallback((support: WebHIDSupportInfo) => {
    setWebHidSupportInfo(support);
    setShowWebHIDError(true);
  }, []);

  /** 进入页面即检测（微信等内置浏览器不会走「新设备」点击才提示） */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const support = checkWebHIDSupport();
    if (!support.isSupported) {
      openWebHIDUnsupportedDialog(support);
    }
  }, [openWebHIDUnsupportedDialog]);

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
      pauseKeyboardHidReconcile(2000);
      releaseKeyboardHidSessionForAddress(item?.address);
      releaseKeyboardHidSessionForAddress(connectedKeyboard?.api?.address);
      if (devPID === item.devPID) {
        keyboard.setDeviceMode(0);
        disconnectCurrentKeyboardAndReturnHome();
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
  async function loadAuthorizedKeyboardList(options?: { skipPauseGuard?: boolean }) {
    if (
      keyboardConnectInFlightRef.current
      || hidAuthorizeDialogOpenRef.current
      || bootRecoverySessionRef.current
      || isKeyboardHidUserSessionActive()
      || areNavigatorHidNativeEventsSuspended()
      || isUpgradeWindowOpenRef.current
    ) {
      return;
    }
    if (!options?.skipPauseGuard && isKeyboardHidReconcilePaused()) {
      return;
    }
    await handleIAPModeDetection(keyboard);

    const deviceData = await getAccreditDevice();

    if (!deviceData?.length) {
      if (connectedKeyboard?.test) {
        return;
      }
      if (!initDataLoadedRef.current && !bootRecoverySessionRef.current) {
        setLoading(true);
        setConnectState(true);
      }
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

          if (!device.listeners.some(l => l.name === "consumerNotify")) {
            device.listeners.push({
              name: "consumerNotify",
              fn: (notifyValue) => handleConsumerNotify(device, notifyValue),
            });
          }

          if (loading && !keyboardConnectInFlightRef.current) {
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

    setKeyboardData(results.filter(Boolean));
  }

  async function initState() {
    await loadAuthorizedKeyboardList();
  }
  initStateRef.current = initState;

  const refreshAuthorizedKeyboardListRef = useRef<(options?: { skipPauseGuard?: boolean }) => Promise<void>>(
    async () => {},
  );
  refreshAuthorizedKeyboardListRef.current = loadAuthorizedKeyboardList;

  const refreshAuthorizedKeyboardList = useCallback(async () => {
    await refreshAuthorizedKeyboardListRef.current({ skipPauseGuard: true });
  }, []);

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
    const upgradeState = readFirmwareUpgradeState();
    const includeIapBoot =
      hasIapBootDeviceInDeviceInfo() ||
      isActiveFirmwareUpgradeState({
        vendorId: upgradeState?.deviceInfo?.vendorId,
        productId: upgradeState?.deviceInfo?.productId,
      });

    // 目标：无论后续是 QMK 探测还是普通连接，整个流程只弹一次“选择设备/授权”框
    // 做法：如果需要授权且当前没有任何已授权设备，则先统一触发一次 requestDevice，之后探测/连接都不再触发授权弹窗
    let userDidAuthorize = false;
    let selectedHidDevice: HIDDevice | null = null;
    if (requestAuthorize) {
      try {
        selectedHidDevice = await WebHid.requestDeviceForPicker({ includeIapBoot });
        userDidAuthorize = !!selectedHidDevice;
      } catch (e) {
        // 用户取消授权时，不要在同一次连接流程里重复弹窗；直接走“无设备/连接失败”分支
        return { type: "91683", device: undefined };
      }
      if (!selectedHidDevice) {
        return { type: "91683", device: undefined };
      }
      await waitForHidEnumerationStable();
      clearKeyboardHidDriverCaches();
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

    if (isIapBootHidDevice(selectedHidDevice.vendorId, selectedHidDevice.productId)) {
      return { type: 'IAP_BOOT', bootHid: selectedHidDevice };
    }

    selectedHidDevice = await resolveVendorCommHidDevice(selectedHidDevice);

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

  const enterBootUpgradeMainFlow = useCallback(async (
    bootHid?: HIDDevice,
    recoveryOption?: BootRecoveryKeyboardOption,
  ): Promise<boolean> => {
    bootRecoverySessionRef.current = true;
    try {
      if (recoveryOption) {
        saveFirmwareUpgradeState({
          isUpgrading: true,
          startTime: new Date().toISOString(),
          step: 'waiting-iap',
          deviceInfo: {
            vendorId: recoveryOption.vendorId,
            productId: recoveryOption.productId,
            firmwareFile: recoveryOption.updateFile,
            upgradeVersion: recoveryOption.upgradeVersion,
          },
        });
      }

      const upgradeState = readFirmwareUpgradeState();
      const discardReason = upgradeState
        ? getDiscardFirmwareUpgradeStateReason(upgradeState, {
            vendorId: upgradeState.deviceInfo?.vendorId,
            productId: upgradeState.deviceInfo?.productId,
            currentUpgradeVersion: upgradeState.deviceInfo?.upgradeVersion,
          })
        : 'no-firmware-file';

      if (!upgradeState || discardReason) {
        console.warn('[Boot连接] 无有效升级记录，无法进入 Boot 续升');
        return false;
      }

      if (isIapBootUpgradePersistStep(upgradeState.step) || upgradeState.deviceInfo?.currentVersion) {
        saveFirmwareUpgradeState({
          ...upgradeState,
          step: upgradeState.step ?? 'waiting-iap',
          deviceInfo: {
            ...upgradeState.deviceInfo,
            currentVersion: undefined,
          },
        });
      }

      hydrateKeyboardFromPersistedUpgrade(keyboard, readFirmwareUpgradeState());
      keyboard.setDeviceVersion('');

      let boot = bootHid ?? await getAuthorizedIapBootDevice();
      if (!boot) {
        boot = await requestIapBootAuthorization();
      }
      if (!boot) {
        console.log('[Boot连接] 用户取消 Boot 设备授权');
        return false;
      }

      try {
        if (!boot.opened) {
          await boot.open();
        }
      } catch (error) {
        console.warn('[Boot连接] Boot 设备 open 失败:', error);
      }

      console.log('[Boot连接] Boot 设备已授权:', boot.productName, 'PID=0x33FF');
      keyboard.keyboardType = '91683';
      keyboard.setKeyboardType?.('91683');
      keyboard.setDeviceStatus(true);
      keyboard.setDeviceOnline(true);
      keyboard.setDeviceType(101);
      keyboard.setDeviceName(recoveryOption?.name || boot.productName || 'Boot Device');

      setConnectedKeyboard(undefined);
      initDataLoadedRef.current = true;
      setLoading(false);
      setConnectState(false);
      setInitDataLoaded(true);
      setPendingOpenUpgradeAfterBootConnect(true);
      return true;
    } finally {
      bootRecoverySessionRef.current = false;
    }
  }, [keyboard]);

  const openBootRecoveryDialog = useCallback((bootHid: HIDDevice): boolean => {
    if (bootRecoveryOptions.length === 0) {
      showMessage({
        message: t('2985'),
        type: 'warning',
        duration: 6000,
      });
      return false;
    }
    bootRecoverySessionRef.current = true;
    pendingBootHidRef.current = bootHid;
    setBootRecoveryOpen(true);
    return true;
  }, [bootRecoveryOptions.length, showMessage, t]);

  const confirmBootRecoveryKeyboard = useCallback(async (option: BootRecoveryKeyboardOption) => {
    const bootHid = pendingBootHidRef.current;
    pendingBootHidRef.current = null;
    setBootRecoveryOpen(false);
    if (!bootHid) {
      bootRecoverySessionRef.current = false;
      resumeReconcilePolling();
      return;
    }
    beginKeyboardHidUserSession();
    try {
      await enterBootUpgradeMainFlow(bootHid, option);
    } finally {
      endKeyboardHidUserSession();
      if (!bootRecoverySessionRef.current) {
        resumeReconcilePolling();
      }
    }
  }, [enterBootUpgradeMainFlow, resumeReconcilePolling]);

  const cancelBootRecoveryDialog = useCallback(() => {
    bootRecoverySessionRef.current = false;
    pendingBootHidRef.current = null;
    setBootRecoveryOpen(false);
    resumeReconcilePolling();
  }, [resumeReconcilePolling]);

  const connectBootForFirmwareUpgrade = useCallback(
    async () => {
      let boot = await getAuthorizedIapBootDevice();
      if (!boot) {
        boot = await requestIapBootAuthorization();
      }
      if (!boot) return false;

      const upgradeState = readFirmwareUpgradeState();
      if (isActiveFirmwareUpgradeState({
        vendorId: upgradeState?.deviceInfo?.vendorId,
        productId: upgradeState?.deviceInfo?.productId,
      })) {
        return enterBootUpgradeMainFlow(boot);
      }
      return openBootRecoveryDialog(boot);
    },
    [enterBootUpgradeMainFlow, openBootRecoveryDialog],
  );

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
      const webHidSupport = checkWebHIDSupport();
      if (!webHidSupport.isSupported) {
        openWebHIDUnsupportedDialog(webHidSupport);
        return false;
      }

      if (keyboardConnectInFlightRef.current) {
        console.log('[连接设备] 已有连接流程进行中，跳过重复请求');
        return false;
      }

      keyboardConnectInFlightRef.current = true;
      let connectSucceeded = false;
      beginKeyboardHidUserSession();
      if (requestAuthorize) {
        hidAuthorizeDialogOpenRef.current = true;
        setKeyboardAuthorizePickerOpen(true);
        pauseReconcilePolling();
      }

      try {
        if (!requestAuthorize) {
          await waitForKeyboardHidReconcileIdle(() => reconcileInFlightRef.current);
          await releaseAllKeyboardHidSessions();
        }

        // 设置设备未连接
        keyboard.setDeviceStatus(false);

        // WebHID连接键盘，如果第一次连接需要浏览器授权
        const result = await detectAndConnectKeyboard(mode, requestAuthorize, forcePrompt);

        if (result.type === 'IAP_BOOT' && result.bootHid) {
          const upgradeState = readFirmwareUpgradeState();
          if (isActiveFirmwareUpgradeState({
            vendorId: upgradeState?.deviceInfo?.vendorId,
            productId: upgradeState?.deviceInfo?.productId,
          })) {
            connectSucceeded = await enterBootUpgradeMainFlow(result.bootHid);
            return connectSucceeded;
          }
          connectSucceeded = openBootRecoveryDialog(result.bootHid);
          return connectSucceeded;
        }

        const { type, device } = result;
        // 如果没有获取到设备（用户取消授权或无设备），直接返回
        if (!device) {
          console.log('[连接设备] 未获取到设备，退出连接流程');
          return false;
        }
        keyboard.keyboardType = type;
        keyboard.setKeyboardType(type);
        try {
          const acc = await getAccreditDevice();
          hidAuthorizedKnownRef.current = new Set(acc.map((d) => d.address));
          hidAuthorizedInitRef.current = true;
        } catch (_) {
          /* ignore */
        }
        if (mode === "tryConnect") {
          connectSucceeded = await setConnectKeyboardStauts(device, undefined, type);
          return connectSucceeded;
        }

        connectSucceeded = true;
        return true;
      } catch (e) {
        console.log("---------------error-----------------");
        console.log(e);
        if (isHidWriteNotAllowedError(e)) {
          showMessage({ message: t('2996'), type: 'error', duration: 8000 });
          return false;
        }
        throw e;
      } finally {
        keyboardConnectInFlightRef.current = false;
        if (requestAuthorize) {
          hidAuthorizeDialogOpenRef.current = false;
          setKeyboardAuthorizePickerOpen(false);
        }
        endKeyboardHidUserSession();
        if (!bootRecoverySessionRef.current) {
          resumeReconcilePolling();
        }
        if (connectSucceeded) {
          void refreshAuthorizedKeyboardList();
        }
      }
    },
    [keyboard, enterBootUpgradeMainFlow, openBootRecoveryDialog, notifyKeyboardConnected, openWebHIDUnsupportedDialog, showMessage, t, pauseReconcilePolling, resumeReconcilePolling, refreshAuthorizedKeyboardList]
  );
  // 设置连接键盘状态
  const beginKeyboardSwitch = useCallback((deviceName = '') => {
    switchProgressCtrlRef.current.stop();
    switchProgressCtrlRef.current = createSmoothProgressController();
    setKeyboardSwitchLabel(deviceName);
    setIsKeyboardSwitching(true);
    setKeyboardSwitchProgress(0);
    switchProgressCtrlRef.current.start((value) => {
      setKeyboardSwitchProgress(value);
    });
  }, []);

  const abortKeyboardSwitch = useCallback(() => {
    switchProgressCtrlRef.current.stop();
    setIsKeyboardSwitching(false);
    setKeyboardSwitchProgress(0);
    setKeyboardSwitchLabel('');
  }, []);

  const finishKeyboardSwitch = useCallback(async () => {
    await switchProgressCtrlRef.current.complete();
    setIsKeyboardSwitching(false);
    setKeyboardSwitchProgress(0);
    setKeyboardSwitchLabel('');
  }, []);

  const setConnectKeyboardStauts = async (nextKeyboard, item?, kbType?: string): Promise<boolean> => {
    if (isIapBootHidDevice(nextKeyboard?.vendorId, nextKeyboard?.productId)) {
      showMessage({ message: t('2981'), type: 'warning', duration: 6000 });
      return false;
    }
    const isCustom = nextKeyboard.productId === 12290;
    const isDeviceSwitch = initDataLoaded && !!connectedKeyboard;
    const switchLabel = item?.productName ?? nextKeyboard?.productName ?? '';

    if (isDeviceSwitch && !isKeyboardSwitching) {
      beginKeyboardSwitch(switchLabel);
    }

    try {
      // 切换设备时先清空上一台的固件升级状态，避免提示残留到新设备
      keyboard.setDeviceNeedsUpgrade(false);
      keyboard.setDeviceVersion('');
      keyboard.setDeviceUpgradeVersion('');
      keyboard.setDeviceUpgradeFile('');

      switchProgressCtrlRef.current.setMilestone(18);
      const { devVID, devPID } = await applyDeviceInfo(nextKeyboard, isCustom);
      console.log(nextKeyboard);

      // 设置设备名称（在获取数据前先临时设置，便于 getDeviceData 内部使用）
      keyboard.deviceName = nextKeyboard.productName;
      keyboard.setDeviceName(nextKeyboard.productName);

      keyboard.setDeviceVID(devVID);
      keyboard.setDevicePID(devPID);

      // 设置设备本地配置
      keyboard.setProfile(1);
      keyboard.setFnLayer(0);
      switchProgressCtrlRef.current.setMilestone(36);
      let success
      // 获取设备数据
      const resolvedType = kbType ?? keyboard.keyboardType;
      if (resolvedType === "QMK") {
        switchProgressCtrlRef.current.setMilestone(52);
        success = await getQMKDeviceData(nextKeyboard, 1)
      } else {
        // 91683 设备：确保关闭 QMK 文件管理器
        setShowQMKFileManager(false);
        setPendingQMKDevice(null);
        setQmkLoadedDefinition(null);
        switchProgressCtrlRef.current.setMilestone(52);
        success = await getDeviceData(nextKeyboard, 1);
      }

      switchProgressCtrlRef.current.setMilestone(88);

      if (!nextKeyboard.listeners.some(l => l.name === 'devNotify')) {
        nextKeyboard.listeners.push({
          name: "devNotify",
          fn: (notifyValue) => handleDeviceNotify(nextKeyboard, item, notifyValue),
        });
      }

      if (!nextKeyboard.listeners.some(l => l.name === 'consumerNotify') && keyboard.keyboardType === "91683") {
        nextKeyboard.listeners.push({
          name: "consumerNotify",
          fn: (notifyValue) => handleConsumerNotify(nextKeyboard, notifyValue),
        });
      }

      // 只有在成功获取数据后才设置界面状态
      if (success) {
        const finalType = kbType ?? keyboard.keyboardType;
        if (finalType) {
          await keyboard.setKeyboardType(finalType);
          keyboard.keyboardType = finalType;
        }
        // 设置通讯接口（在确认有配置后才赋值）
        setConnectedKeyboard(nextKeyboard);
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
        initDataLoadedRef.current = true;
        setInitDataLoaded(true);
        notifyKeyboardConnected(nextKeyboard.productName || keyboard.deviceName || "");
        void refreshAuthorizedKeyboardListRef.current({ skipPauseGuard: true });
        if (isDeviceSwitch) {
          await finishKeyboardSwitch();
        }
        return true;
      }
      if (isDeviceSwitch) {
        abortKeyboardSwitch();
      } else if (!initDataLoaded) {
        setLoading(true);
        setConnectState(true);
      }
      // 如果 success 为 false（无配置），不赋值 connectedKeyboard，不关闭 loading，保持在选择界面
      return false;
    } catch (error) {
      if (isDeviceSwitch) {
        abortKeyboardSwitch();
      } else if (!initDataLoaded) {
        setLoading(true);
        setConnectState(true);
      }
      if (isHidWriteNotAllowedError(error)) {
        showMessage({ message: t('2996'), type: 'error', duration: 8000 });
        return false;
      }
      throw error;
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

    const tryImportQmkConfig = async (fileStem: string): Promise<KeyboardDefinition | null> => {
      const normalized = fileStem.trim();
      if (!normalized) return null;
      for (const ext of ["json", "JSON"]) {
        try {
          const staticConfig = await import(`@/data/config/${normalized}.${ext}`);
          const config = staticConfig.default || staticConfig;
          console.log(`[QMK配置加载] ✅ 成功加载静态配置: ${config.name} (${normalized}.${ext})`);
          await saveDefinition(config);
          console.log(`[QMK配置加载] 已保存到本地存储`);
          return config;
        } catch {
          console.log(`[QMK配置加载] 静态配置文件 ${normalized}.${ext} 不存在`);
        }
      }
      return null;
    };

    // 0. deviceInfo 中声明的 qmkConfig / name（优先级最高）
    const deviceInfoStem = getQmkConfigFileStem(keyboard.deviceVID, keyboard.devicePID, 0);
    if (deviceInfoStem) {
      const fromDeviceInfo = await tryImportQmkConfig(deviceInfoStem);
      if (fromDeviceInfo) return fromDeviceInfo;
    }

    // 1. 尝试加载静态配置文件（从 src/data/config 目录）
    try {
      // 尝试根据设备名称加载（如果有的话）

      const deviceName = (keyboard.deviceName || '').replace(/\s+/g, '');
      if (deviceName) {
        const fromDeviceName = await tryImportQmkConfig(deviceName);
        if (fromDeviceName) return fromDeviceName;
      }

      // 尝试根据 VID_PID 加载
      const fromVidPid = await tryImportQmkConfig(`${vidStr}_${pidStr}`);
      if (fromVidPid) return fromVidPid;
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
      setQmkLoadedDefinition(config);

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

      // 初始化布局按键：优先合并 91683 物理布局（含 HID code），供测试按键正确映射
      const physicalStem = getPhysicalLayoutStem(keyboard.deviceVID, keyboard.devicePID, 0);
      const physicalKeys = physicalStem ? await loadPhysicalLayoutKeys(physicalStem) : [];
      if (physicalKeys.length && allLayersKeymap[0]?.length) {
        keyboard.initLayoutKeys(mergePhysicalLayoutWithQmkLayer(physicalKeys, allLayersKeymap[0]));
      } else if (allLayersKeymap[0]?.length) {
        keyboard.initLayoutKeys(qmkLayerToLayoutKeys(allLayersKeymap[0]));
      } else if (keyboardLayout.layouts?.keys) {
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

        // QMK 点阵屏：加载灯效名称 JSON，覆盖 matrixlight 列表
        const matrixCfg = getMatrixScreenConfig(keyboard.deviceVID, keyboard.devicePID, 0);
        if (matrixCfg?.matrixLightLayout) {
          try {
            const mlConfig = await loadMatrixLightConfig(matrixCfg.matrixLightLayout);
            layoutConfig.lighting.matrixlight = matrixLightConfigToEffects(mlConfig);
            layoutConfig.lighting.matrixLightMeta = matrixLightMetaFromConfig(mlConfig);
            const groupLabel = matrixCfg.matrixLightGroupLabel ?? 'Lattice';
            const effectsKey = resolveQmkEffectsKeyForLabel(keyboardLayout.menus, groupLabel);
            layoutConfig.lighting.effects[effectsKey] = matrixLightConfigToEffects(mlConfig);
            console.log('[QMK连接] 点阵屏灯效配置已加载:', matrixCfg.matrixLightLayout);
          } catch (error) {
            console.warn('[QMK连接] 点阵屏灯效配置加载失败:', error);
          }
        }

        // 读取设备当前灯光状态，回显到 LightSetting
        try {
          const lightState = await deviceComm.getLightingState(keyboardLayout.menus);
          console.log('[QMK连接] 当前灯光状态:', lightState);

          const funcPatch = buildQmkLightingFuncPatch(keyboardLayout.menus, lightState);

          const baseFuncInfo = keyboard.deviceFuncInfo ?? {};
          keyboard.setDeviceFuncInfo({ ...baseFuncInfo, ...funcPatch });
          console.log('[QMK连接] deviceFuncInfo 已更新:', funcPatch);
        } catch (error) {
          console.warn('[QMK连接] 读取灯光状态失败:', error);
        }
      }

      // 设置键盘布局（附加原始 menus、layouts、customKeycodes，供 LightSetting / QMKKeyCodeSetting / 重置流程使用）
      setKeyboardLayout({
        ...layoutConfig,
        menus: keyboardLayout.menus,
        layouts: keyboardLayout.layouts,
        customKeycodes: keyboardLayout.customKeycodes ?? [],
        previewSkins: (keyboardLayout as { previewSkins?: unknown }).previewSkins,
      });

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

      // QMK：从 deviceInfo 合并 LED / 点阵屏等 UI 能力（91683 由固件回读）
      const matrixCfg = getMatrixScreenConfig(keyboard.deviceVID, keyboard.devicePID, 0);
      const qmkUiCaps = getDeviceUiCapabilities(
        keyboard.deviceVID,
        keyboard.devicePID,
        0,
      );
      const matrixLightMeta = layoutConfig.lighting?.matrixLightMeta;
      const uiCapsPatch = {
        ...qmkUiCaps,
        ...(matrixLightMeta ? { matrixScreenLightSize: matrixLightMeta.close } : {}),
      };

      if (matrixCfg?.matrixScreenProtocol === 'lattice-hid' && deviceComm.api?.address) {
        try {
          const latticeComm = createLatticeScreenComm(deviceComm.api.address);
          matrixData.setLatticeDevice(latticeComm);
          const info = await latticeComm.getDeviceInfo();
          const modeRes = await latticeComm.getLightMode();
          const brightRes = await latticeComm.getLightBrightness();
          const speedRes = await latticeComm.getLightSpeed();
          uiCapsPatch.matrixScreenLightRows = info.rows;
          uiCapsPatch.matrixScreenLightColumns = info.cols;
          uiCapsPatch.matrixScreenLightMaxBrightness = info.maxLightBrightness;
          uiCapsPatch.matrixScreenLightMaxSpeed = info.maxLightSpeed;
          keyboard.setDeviceFuncInfo({
            ...(keyboard.deviceFuncInfo ?? {}),
            matrixScreenLightMode: modeRes.lightMode,
            matrixScreenLightBrightness: brightRes.brightness,
            matrixScreenLightSpeed: speedRes.speed,
            matrixScreenLightSwitch: modeRes.lightMode !== (matrixLightMeta?.close ?? 0),
          });
          console.log('[QMK连接] 点阵屏 Raw HID 协议已初始化');
        } catch (error) {
          console.warn('[QMK连接] 点阵屏 Raw HID 初始化失败:', error);
        }
      }

      keyboard.setDeviceBaseInfo(uiCapsPatch);

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
        setPendingQMKDevice(deviceComm);
        setShowQMKFileManager(true);
        return false;
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
      const upgradeFile = getDeviceUpgradeFile(
        keyboard.deviceVID,
        keyboard.devicePID,
        deviceInfo.keyboardID,
      );
      keyboard.setDeviceUpgradeFile(upgradeFile);
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
      // 设置设备是否需要升级（须已配置版本号与固件路径才提示；upgradeVersion=100 时关闭）
      const keyboardUpgradeDisabled = isKeyboardDriverUpgradeDisabled(
        keyboard.deviceVID,
        keyboard.devicePID,
        deviceInfo.keyboardID,
      );
      const firmwarePackageReady =
        !keyboardUpgradeDisabled && Boolean(upgradeVersion?.trim() && upgradeFile?.trim());
      const needsUpgrade =
        firmwarePackageReady && isFirmwareVersionBehind(curVersion, upgradeVersion);
      const canFlashFirmware =
        firmwarePackageReady && isFirmwareVersionUpgradeable(curVersion, upgradeVersion);
      console.log(
        "GetDeviceData, needsUpgrade",
        needsUpgrade,
        curVersion,
        upgradeVersion
      );
      keyboard.setDeviceNeedsUpgrade(needsUpgrade);

      const persistedUpgrade = readFirmwareUpgradeState();
      if (persistedUpgrade && !isUpgradeWindowOpenRef.current) {
        const discardReason = getDiscardFirmwareUpgradeStateReason(persistedUpgrade, {
          vendorId: keyboard.deviceVID,
          productId: keyboard.devicePID,
          currentUpgradeVersion: upgradeVersion,
        });
        if (discardReason || !canFlashFirmware) {
          console.log(
            '[GetDeviceData] 清理 firmwareUpgradeState',
            discardReason || 'device-up-to-date',
          );
          clearFirmwareUpgradeState();
        }
      }

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
        return keys.map(key => {
          if (isDeviceAnyMacroKey(key)) {
            return toVendorAnyUserKey(key, keyboard.version);
          }

          if (parsedLocalMacros.length === 0) return key;

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
      if (isHidWriteNotAllowedError(error)) {
        showMessage({ message: t('2996'), type: 'error', duration: 8000 });
        return false;
      }
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
    connectBootForFirmwareUpgrade,
    disconnectCurrentKeyboardAndReturnHome,
    setConnectKeyboardStauts,
    isKeyboardSwitching,
    keyboardSwitchProgress,
    keyboardSwitchLabel,
    beginKeyboardSwitch,
    abortKeyboardSwitch,
    initState,
    refreshAuthorizedKeyboardList,
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
    qmkLoadedDefinition,
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
    pendingOpenUpgradeAfterBootConnect,
    setPendingOpenUpgradeAfterBootConnect,
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
      <Dialog
        open={showWebHIDError}
        onClose={() => setShowWebHIDError(false)}
        sx={{ zIndex: 14000 }}
      >
        <DialogTitle>{t("2850")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(getWebHIDUnsupportedMessageKey(webHidSupportInfo?.reason))}
          </DialogContentText>
          {webHidSupportInfo?.browserName ? (
            <DialogContentText sx={{ mt: 1.5, color: "text.secondary" }}>
              {t("2851", { browser: webHidSupportInfo.browserName })}
            </DialogContentText>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setShowWebHIDError(false)}>
            {t("2569")}
          </Button>
        </DialogActions>
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

      <BootRecoveryKeyboardDialog
        open={bootRecoveryOpen}
        options={bootRecoveryOptions}
        onCancel={cancelBootRecoveryDialog}
        onConfirm={confirmBootRecoveryKeyboard}
      />
    </ConnectKbContext.Provider>
  );
}

export default ConnectKbProvider;
