"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Modal,
  Paper,
  IconButton,
  useTheme,
  Alert,
  AlertTitle,
  Stack,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from "@/app/i18n";
import { lightingPanelCardSx } from "@/constants/lightingPanelChrome";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
import {
  clearFirmwareUpgradeState,
  isIapBootUpgradePersistStep,
  readFirmwareUpgradeState,
  resolveKeyboardUpgradeCurrentVersion,
  saveFirmwareUpgradeState,
  type FirmwareUpgradePersistStep,
} from "@/utils/firmwareUpgradeState";
import { releaseAllKeyboardHidSessions } from "@/utils/keyboardHidSession";
import { upgradeFlowLog, UF_SOURCE, formatBytesHex } from "@/utils/upgradeFlowLog";
import {
  formatIapAckStatus,
  parseIapAck,
  type IapAckInfo,
} from "@/utils/iapAckParse";

const UFL = UF_SOURCE.KEYBOARD_IAP;
const ufl = {
  info: (message: string, detail?: string) => upgradeFlowLog.info(UFL, message, detail),
  warn: (message: string, detail?: string) => upgradeFlowLog.warn(UFL, message, detail),
  error: (message: string, detail?: string) => upgradeFlowLog.error(UFL, message, detail),
  debug: (message: string, detail?: string) => upgradeFlowLog.debug(UFL, message, detail),
  out: (label: string, data: ArrayLike<number>, reportId?: number, maxBytes?: number) =>
    upgradeFlowLog.logOut(UFL, label, data, reportId, maxBytes),
  in: (label: string, data: ArrayLike<number>, reportId?: number, maxBytes?: number) =>
    upgradeFlowLog.logIn(UFL, label, data, reportId, maxBytes),
  exchange: (
    outLabel: string,
    outData: ArrayLike<number>,
    inLabel: string,
    inData: ArrayLike<number> | null,
    reportId?: number,
    maxBytes?: number,
  ) => upgradeFlowLog.logExchange(UFL, outLabel, outData, inLabel, inData, reportId, maxBytes),
};

// WebHID API 类型声明
declare global {
  interface HIDDevice {
    vendorId: number;
    productId: number;
    productName: string;
    opened: boolean;
    collections?: Array<{
      usagePage: number;
      usage: number;
    }>;
    open(): Promise<void>;
    close(): Promise<void>;
    sendReport(reportId: number, data: BufferSource): Promise<void>;
    addEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
    removeEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void;
  }

  interface HIDInputReportEvent extends Event {
    data: DataView;
    reportId: number;
  }

  interface HID extends EventTarget {
    getDevices(): Promise<HIDDevice[]>;
    requestDevice(options: {
      filters: Array<{
        vendorId?: number;
        productId?: number;
        usagePage?: number;
        usage?: number;
      }>;
    }): Promise<HIDDevice[]>;
  }

  interface Navigator {
    hid: HID;
  }
}

// 设备信息配置 - 使用动态配置
const getDeviceFilters = (deviceInfo?: FirmwareUpgradeProps['deviceInfo']) => {
  const appPID = deviceInfo?.productId || 0x302B;
  const appVid = deviceInfo?.vendorId || 0x36B0;
  return {
    // 应用模式设备
    APP_MODE: {
      vendorId: appVid,
      productId: appPID,
      usagePage: 0xFF00,
      usage: 0x0001
    },
    // Bootloader模式设备
    BOOT_MODE: {
      vendorId: 0x36B0,
      productId: 0x33FF,
      usagePage: 0xFF00,
      usage: 0x0001
    }
  };
};

// IAP 命令定义
const IAP_CMD = {
  START: 0xA0,
  FLASH_WRITE: 0xA1,
  FLASH_READ: 0xA2,
  REBOOT: 0xA3,
  SWITCH_APP: 0xA4,
  SWITCH_BOOT: 0xC0,
  ACK: 0xB0
};

// ACK代码定义
const ACK_CODE = {
  SUCCESS: 0x00,
  UNKNOWN_CMD: 0xE0,
  LENGTH_ERROR: 0xE1,
  CRC_ERROR: 0xE2,
  BLOCK_NUM_ERROR: 0xE3,
  BLOCK_SIZE_ERROR: 0xE4,
  WRITE_OFFSET_ERROR: 0xE5,
  READ_OFFSET_ERROR: 0xE6,
  ARGUMENT_ERROR: 0xE7,
  FLASH_OPERATION_FAILED: 0xE8,
  STATUS_ERROR: 0xE9,
  HEADER_IDENTIFY_ERROR: 0xF0,
  HEADER_CHIP_ID_ERROR: 0xF1,
  HEADER_HW_VERSION_ERROR: 0xF3,
  HEADER_SW_VERSION_ERROR: 0xF4,
  HEADER_CHECK_INFO_ERROR: 0xF5,
  HEADER_BLOCK_INFO_ERROR: 0xF6
};

const IAP_MAX_RETRIES = 3;
/** Flash 写入 / 切换 APP */
const IAP_ACK_TIMEOUT_FAST = 250;
/** START：设备校验 Header 后应答，可达数秒 */
const IAP_ACK_TIMEOUT_START = 8000;
/** 切换 Boot 应答 */
const IAP_ACK_TIMEOUT_BOOT = 1200;
/** SWITCH_BOOT 命令内延时参数（设备协议字段，非主机 sleep）；0 会被设备拒绝 */
const IAP_SWITCH_BOOT_DELAY_MS = 0x64;
/** START ACK 成功后等待设备校验 Header */
const IAP_HEADER_READY_MS = 600;
/** 每包传输层回显等待 */
const IAP_ECHO_TIMEOUT_MS = 30;
/** 极速通道回显等待 */
const IAP_ECHO_TIMEOUT_TURBO = 18;
/** 普通 Flash 块业务 ACK 上限（严格模式） */
const IAP_ACK_TIMEOUT_FLASH = 120;
/** 4KB 扇区边界块（可能触发擦除） */
const IAP_ACK_TIMEOUT_FLASH_SECTOR = 800;
/** 发完分包后额外 soak，与 receiveIapAck 共享 ackTimeout 预算 */
const IAP_POST_ACK_SOAK_MS = 25;
/** ACK 单次轮询间隔 */
const IAP_POLL_INTERVAL_MS = 4;
/** 重试间隔 */
const IAP_RETRY_DELAY_MS = 2;
/** 批量写入时每隔 N 块清一次输入缓冲 */
const IAP_FLASH_BUFFER_FLUSH_INTERVAL = 256;
/** 批量写入日志抽样间隔 */
const IAP_FLASH_LOG_EVERY = 100;
/** 极速模式下每隔 N 块做一次严格 ACK 校验 */
const IAP_FLASH_CHECKPOINT_EVERY = 128;
const FLASH_SECTOR_SIZE = 4096;

const getFlashBlockAckTimeout = (offset: number): number =>
  offset % FLASH_SECTOR_SIZE === 0 ? IAP_ACK_TIMEOUT_FLASH_SECTOR : IAP_ACK_TIMEOUT_FLASH;

/** 须严格等 ACK 的块：首块 / 末块 / 扇区边界 / 定期检查点 */
const needsStrictFlashAck = (blockIdx: number, blockNum: number, offset: number): boolean =>
  blockIdx === 0 ||
  blockIdx === blockNum - 1 ||
  offset % FLASH_SECTOR_SIZE === 0 ||
  (blockIdx > 0 && blockIdx % IAP_FLASH_CHECKPOINT_EVERY === 0);
/** 切换 APP 后等待设备复位 */
const IAP_SWITCH_APP_SETTLE_MS = 250;
/** 切换 Boot 后等待设备重新枚举 */
const IAP_BOOT_REENUMERATE_MS = 800;
/** Boot 设备轮询间隔（原 500ms，约 2 倍速） */
const IAP_DEVICE_MONITOR_MS = 250;

/** IAP 升级 IN 队列上限，防止刷写阶段 report 洪泛导致 OOM */
const IAP_INPUT_QUEUE_MAX = 512;

// HID Report ID
const REPORT_ID = 0x3F;

interface UpgradeState {
  isUpgrading: boolean;
  progress: number;
  status: string;
  error?: string;
  currentStep: string;
  statusType?: 'normal' | 'warning' | 'error';
}

interface DeviceInfo {
  device: HIDDevice | null;
  isConnected: boolean;
  isAuthorized: boolean;
}

interface FileData {
  startAddress: number;
  parts: Array<{
    startAddress: number;
    endAddress: number;
    size: number;
    data: Uint8Array;
  }>;
  totalSize: number;
}

// 升级步骤枚举
enum UpgradeStep {
  IDLE = 'idle',
  DETECTING_KEYBOARD = 'detecting_keyboard',
  ENTERING_IAP_MODE = 'entering_iap_mode',
  WAITING_IAP_DEVICE = 'waiting_iap_device',
  REQUESTING_AUTHORIZATION = 'requesting_authorization',
  UPGRADING = 'upgrading',
  COMPLETED = 'completed',
  ERROR = 'error'
}

interface FirmwareUpgradeProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo?: {
    vendorId: number;
    productId: number;
    firmwareFile?: string;
    currentVersion?: string;
    upgradeVersion?: string;
  };
}

function FirmwareUpgrade({ isOpen, onClose, deviceInfo }: FirmwareUpgradeProps) {
  const theme = useTheme();
  const isLightMode = theme.palette.mode === 'light';
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation("common");
  const { showDialog } = useSnackbarDialog();

  // 状态管理
  const [upgradeState, setUpgradeState] = useState<UpgradeState>({
    isUpgrading: false,
    progress: 0,
    status: t("1208"), // "准备就绪"
    currentStep: UpgradeStep.IDLE,
    statusType: 'normal',
  });

  // 设备状态
  const [keyboardDevice, setKeyboardDevice] = useState<DeviceInfo>({
    device: null,
    isConnected: false,
    isAuthorized: false,
  });

  const [iapDevice, setIapDevice] = useState<DeviceInfo>({
    device: null,
    isConnected: false,
    isAuthorized: false,
  });

  const displayCurrentVersion = useMemo(
    () => resolveKeyboardUpgradeCurrentVersion({
      deviceVersion: deviceInfo?.currentVersion,
      upgradeStep: readFirmwareUpgradeState()?.step,
      iapBootConnected: iapDevice.isConnected,
    }),
    [deviceInfo?.currentVersion, iapDevice.isConnected, upgradeState.currentStep, isOpen],
  );

  const [fileData, setFileData] = useState<FileData | null>(null);
  const [pendingResponse, setPendingResponse] = useState<any>(null);

  // 记录原始键盘PID (优先使用传入的deviceInfo)
  const [originalKeyboardPID, setOriginalKeyboardPID] = useState<number | null>(
    deviceInfo?.productId || null
  );

  // 用于设备监控的定时器
  const deviceMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const iapWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingIAPRef = useRef<boolean>(false);
  /** 刷写完成后置 true，禁止监控循环在设备重枚举时继续 setState（易引发 tab 崩溃） */
  const upgradeFinishedRef = useRef(false);
  const monitorInFlightRef = useRef(false);
  const keyboardDeviceRef = useRef(keyboardDevice);
  const iapDeviceRef = useRef(iapDevice);
  const upgradeStateRef = useRef(upgradeState);
  const originalKeyboardPIDRef = useRef<number | null>(originalKeyboardPID);
  const resumeAttemptedRef = useRef(false);
  const handleBootDeviceDetectedRef = useRef<(device: HIDDevice) => Promise<void>>(async () => {});
  const pendingResponseRef = useRef<{
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // 输入报告队列
  const inputQueueRef = useRef<Uint8Array[]>([]);
  const inputQueueWaitersRef = useRef<Array<{
    resolve: (data: Uint8Array) => void;
    reject: (error: Error) => void;
  }>>([]);

  /** START(0xA0) 已成功且设备 Header 已就绪，才允许 FLASH_WRITE */
  const iapHeaderReadyRef = useRef(false);

  useEffect(() => { keyboardDeviceRef.current = keyboardDevice; }, [keyboardDevice]);
  useEffect(() => { iapDeviceRef.current = iapDevice; }, [iapDevice]);
  useEffect(() => { upgradeStateRef.current = upgradeState; }, [upgradeState]);
  useEffect(() => { originalKeyboardPIDRef.current = originalKeyboardPID; }, [originalKeyboardPID]);

  const releaseUpgradeMemory = useCallback(() => {
    inputQueueRef.current = [];
    inputQueueWaitersRef.current = [];
    setFileData(null);
  }, []);

  const stopDeviceMonitoring = useCallback(() => {
    if (deviceMonitorRef.current) {
      clearInterval(deviceMonitorRef.current);
      deviceMonitorRef.current = null;
    }
  }, []);

  // 延时函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // CRC16计算 (Modbus)
  const crc16Modbus = (data: Uint8Array): number => {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 0x0001) {
          crc = (crc >> 1) ^ 0xA001;
        } else {
          crc >>= 1;
        }
      }
    }
    // C++代码会交换高低字节！
    return ((crc << 8) | (crc >> 8)) & 0xFFFF;
  };

  // BCC校验
  const bccCheck = (data: Uint8Array): number => {
    let bcc = 0;
    for (let i = 0; i < data.length; i++) {
      bcc ^= data[i];
    }
    return bcc;
  };

  // 全局输入报告处理器
  const globalInputHandler = useCallback((event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer);
    const bytes = new Uint8Array(data.buffer);

    inputQueueRef.current.push(bytes);
    if (inputQueueRef.current.length > IAP_INPUT_QUEUE_MAX) {
      inputQueueRef.current.splice(0, inputQueueRef.current.length - IAP_INPUT_QUEUE_MAX);
    }

    // 唤醒等待者
    if (inputQueueWaitersRef.current.length > 0) {
      const waiter = inputQueueWaitersRef.current.shift();
      if (waiter) {
        waiter.resolve(bytes);
      }
    }
  }, []);

  // 发送HID报告
  const sendReport = async (
    device: HIDDevice,
    reportId: number,
    data: Uint8Array,
    opts?: { silent?: boolean },
  ): Promise<void> => {
    if (!device || !device.opened) {
      throw new Error('设备未连接');
    }

    const reportData = new Uint8Array(63);
    reportData.set(data.slice(0, 63));

    try {
      if (!opts?.silent) {
        ufl.out('HID OUT', reportData, reportId);
      }
      await device.sendReport(reportId, reportData.buffer);
    } catch (error: any) {
      ufl.error('发送数据失败', error.message);
      throw new Error('发送数据失败: ' + error.message);
    }
  };

  // 接收HID报告 (带超时) - 从队列读取
  const receiveReport = async (
    device: HIDDevice,
    timeout: number = 2000,
    opts?: { silent?: boolean },
  ): Promise<Uint8Array> => {
    if (inputQueueRef.current.length > 0) {
      const data = inputQueueRef.current.shift();
      if (data) {
        if (!opts?.silent) {
          ufl.in('HID IN (queue)', data, REPORT_ID);
        }
        return data;
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = inputQueueWaitersRef.current.findIndex(w => w.resolve === resolve);
        if (index >= 0) {
          inputQueueWaitersRef.current.splice(index, 1);
        }
        reject(new Error('接收超时'));
      }, timeout);

      inputQueueWaitersRef.current.push({
        resolve: (data: Uint8Array) => {
          clearTimeout(timer);
          if (!opts?.silent) {
            ufl.in('HID IN', data, REPORT_ID);
          }
          resolve(data);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  };

  // 清空输入缓冲区
  const clearInputBuffer = async (device: HIDDevice): Promise<void> => {
    let flushedCount = 0;
    const startTime = Date.now();

    // 持续读取直到没有数据或超时
    while (Date.now() - startTime < 2000) {
      try {
        const data = await receiveReport(device, 100, { silent: true });
        flushedCount++;
        ufl.debug(`清除残留数据 #${flushedCount}`, `byte[6]=0x${data[6].toString(16)}`);
      } catch (e) {
        // 超时表示没有更多数据
        break;
      }
    }

    if (flushedCount > 0) {
      ufl.info(`已清除 ${flushedCount} 个残留数据包`);
    } else {
      ufl.debug('输入缓冲区干净');
    }
  };

  // 快速清空输入缓冲区（不输出日志）
  const clearInputBufferQuick = async (device: HIDDevice): Promise<void> => {
    let count = 0;
    const startTime = Date.now();
    while (Date.now() - startTime < 150) {
      try {
        await receiveReport(device, 30, { silent: true });
        count++;
        if (count > 50) break;
      } catch {
        break;
      }
    }
  };

  // 判断是否为 IAP ACK 包（支持传输层 aa...[6]=b0 与直连 b0 两种格式）
  const isIapAckReport = (pkt: Uint8Array): boolean => {
    if (pkt[0] === IAP_CMD.ACK) {
      return true;
    }
    return pkt.length > 6 && pkt[0] === 0xAA && pkt[6] === IAP_CMD.ACK;
  };

  const hasPendingIapAck = (): boolean => inputQueueRef.current.some(isIapAckReport);

  const peekIapAckFromQueue = (): IapAckInfo | null => {
    for (const pkt of inputQueueRef.current) {
      const ack = parseIapAck(pkt);
      if (ack) return ack;
    }
    return null;
  };

  /** 从队列取出已到达的 IAP ACK，保留非 ACK 包顺序 */
  const takeIapAckFromQueue = (): { ack: IapAckInfo; packet: Uint8Array } | null => {
    const kept: Uint8Array[] = [];
    let ackInfo: IapAckInfo | null = null;
    let ackPacket: Uint8Array | null = null;
    for (const pkt of inputQueueRef.current) {
      const ack = parseIapAck(pkt);
      if (ack && ackInfo === null) {
        ackInfo = ack;
        ackPacket = pkt;
      } else {
        kept.push(pkt);
      }
    }
    inputQueueRef.current = kept;
    if (ackInfo && ackPacket) {
      return { ack: ackInfo, packet: ackPacket };
    }
    return null;
  };

  // 等待单包传输层回显；ACK 保留给 receiveIapAck
  const waitTransferEcho = async (
    device: HIDDevice,
    timeoutMs: number = IAP_ECHO_TIMEOUT_MS,
  ): Promise<Uint8Array | null> => {
    const takeFromQueue = (): Uint8Array | null => {
      if (inputQueueRef.current.length === 0) return null;
      const pkt = inputQueueRef.current.shift()!;
      if (isIapAckReport(pkt)) {
        inputQueueRef.current.unshift(pkt);
        return null;
      }
      return pkt;
    };

    const queued = takeFromQueue();
    if (queued) return queued;

    try {
      const echo = await receiveReport(device, timeoutMs, { silent: true });
      if (parseIapAck(echo)) {
        inputQueueRef.current.unshift(echo);
        return null;
      }
      return echo;
    } catch {
      // 回显可能晚于超时到达，再扫一次队列
      return takeFromQueue();
    }
  };

  const peekFirstIapAckPacket = (): Uint8Array | null => {
    for (const pkt of inputQueueRef.current) {
      if (isIapAckReport(pkt)) return pkt;
    }
    return null;
  };

  // 发送业务包：每包 OUT 后等回显；一旦收到 B0 ACK（含错误 FC）立即停止，不得继续发后续分包
  const sendBusinessPacket = async (
    device: HIDDevice,
    data: Uint8Array,
    opts?: { postAckWaitMs?: number; quiet?: boolean; turbo?: boolean; echoTimeoutMs?: number },
  ): Promise<void> => {
    const reportId = REPORT_ID;
    const maxPayloadSize = 56;
    const packetNum = Math.ceil(data.length / maxPayloadSize);
    const echoTimeout = opts?.echoTimeoutMs ?? (opts?.turbo ? IAP_ECHO_TIMEOUT_TURBO : IAP_ECHO_TIMEOUT_MS);
    const turbo = opts?.turbo === true;

    for (let i = 0; i < packetNum; i++) {
      const offset = i * maxPayloadSize;
      const payloadSize = Math.min(maxPayloadSize, data.length - offset);
      const payload = data.slice(offset, offset + payloadSize);

      const packIdx = packetNum - i - 1;
      const isFirstPacket = (i === 0);

      const packet = new Uint8Array(63);
      packet[0] = 0xAA;
      packet[1] = 0x00;
      packet[2] = packIdx & 0xFF;
      packet[3] = isFirstPacket ? 0x80 : 0x00;
      packet[4] = payloadSize & 0xFF;
      packet[5] = (payloadSize >> 8) & 0xFF;
      packet.set(payload, 6);

      const bcc = bccCheck(packet.slice(1, 6 + payloadSize));
      packet[6 + payloadSize] = bcc;

      const sentSnapshot = packet.slice();
      await sendReport(device, reportId, packet, { silent: true });

      let echo = await waitTransferEcho(device, echoTimeout);
      // 极速模式不重发分包；普通模式中间分包无回显时重发一次
      if (!turbo && !echo && !hasPendingIapAck() && i < packetNum - 1) {
        if (!opts?.quiet) {
          ufl.warn(`传输 ${i + 1}/${packetNum} 无回显`, '重发该分包');
        }
        await sendReport(device, reportId, packet, { silent: true });
        echo = await waitTransferEcho(device, echoTimeout);
      }

      const ackInstead = !echo && hasPendingIapAck();
      if (!opts?.quiet) {
        ufl.exchange(
          `传输 ${i + 1}/${packetNum} idx=${packIdx} len=${payloadSize}`,
          sentSnapshot,
          echo ? '回显' : ackInstead ? 'IAP ACK(代替回显)' : '(无回显)',
          echo ?? (ackInstead ? peekFirstIapAckPacket() : null),
          reportId,
          64,
        );
      }

      if (hasPendingIapAck()) {
        if (!opts?.quiet) {
          const midAck = peekIapAckFromQueue();
          ufl.info(
            `收到中途 ACK，停止发送后续分包`,
            `${midAck ? formatIapAckStatus(midAck) : 'ACK'} | 已发 ${i + 1}/${packetNum}`,
          );
        }
        break;
      }
    }

    // 末包发完后 ACK 可能晚于回显到达（极速模式跳过 soak）
    if (!turbo && !hasPendingIapAck()) {
      const postWait = opts?.postAckWaitMs ?? IAP_ECHO_TIMEOUT_MS;
      const deadline = Date.now() + postWait;
      while (Date.now() < deadline) {
        if (hasPendingIapAck()) break;
        const remain = deadline - Date.now();
        if (remain <= 0) break;
        try {
          const late = await receiveReport(device, Math.min(remain, IAP_POLL_INTERVAL_MS), {
            silent: true,
          });
          if (parseIapAck(late)) {
            inputQueueRef.current.unshift(late);
            break;
          }
          inputQueueRef.current.push(late);
        } catch {
          // 继续等到 postWait 结束
        }
      }
    }
  };

  // 等待 IAP ACK（0xB0）并返回 ErrCode 与原始包
  const receiveIapAck = async (
    device: HIDDevice,
    timeout: number = IAP_ACK_TIMEOUT_FAST,
  ): Promise<{ ack: IapAckInfo; packet: Uint8Array }> => {
    const startTime = Date.now();
    const deferredEchoes: Uint8Array[] = [];

    const flushDeferred = () => {
      if (deferredEchoes.length > 0) {
        inputQueueRef.current.push(...deferredEchoes);
        deferredEchoes.length = 0;
      }
    };

    while (Date.now() - startTime < timeout) {
      const queued = takeIapAckFromQueue();
      if (queued) {
        flushDeferred();
        return queued;
      }

      const remainingTime = timeout - (Date.now() - startTime);
      if (remainingTime <= 0) {
        break;
      }

      let response: Uint8Array;
      try {
        response = await receiveReport(device, Math.min(remainingTime, IAP_POLL_INTERVAL_MS), {
          silent: true,
        });
      } catch {
        continue;
      }

      const ack = parseIapAck(response);
      if (ack) {
        flushDeferred();
        return { ack, packet: response };
      }

      deferredEchoes.push(response);
    }

    flushDeferred();
    ufl.error('读取ACK超时', `timeout=${timeout}ms`);
    throw new Error('读取ACK超时');
  };

  // 发送 IAP 业务命令并在 ErrCode 非 0 时重试
  const sendIapBusinessCommandWithRetry = async (
    device: HIDDevice,
    buildBusinessData: () => Uint8Array,
    context: string,
    ackTimeout: number = IAP_ACK_TIMEOUT_FAST,
    onErrCode?: (errCode: number) => Promise<void>,
    sendOpts?: { quiet?: boolean; skipBufferClear?: boolean },
  ): Promise<IapAckInfo> => {
    let lastError = '';

    for (let attempt = 1; attempt <= IAP_MAX_RETRIES; attempt++) {
      if (attempt > 1 || !sendOpts?.skipBufferClear) {
        await clearInputBufferQuick(device);
      }

      const businessData = buildBusinessData();
      const cmdHex = businessData[0]?.toString(16).toUpperCase().padStart(2, '0') ?? '??';
      if (!sendOpts?.quiet) {
        ufl.info(`${context}`, `尝试 ${attempt}/${IAP_MAX_RETRIES} | CMD=0x${cmdHex} | ${businessData.length}B`);
      }

      const ackWaitStart = Date.now();
      const postSoak = Math.min(IAP_POST_ACK_SOAK_MS, ackTimeout);
      await sendBusinessPacket(device, businessData, { postAckWaitMs: postSoak, quiet: sendOpts?.quiet });

      try {
        const remaining = Math.max(ackTimeout - (Date.now() - ackWaitStart), IAP_POLL_INTERVAL_MS);
        const immediate = takeIapAckFromQueue();
        const { ack, packet } = immediate ?? (await receiveIapAck(device, remaining));
        if (!sendOpts?.quiet) {
          ufl.exchange(
            `${context} | CMD=0x${cmdHex}`,
            businessData,
            'IAP ACK',
            packet,
            REPORT_ID,
            64,
          );
        }
        if (ack.errCode === ACK_CODE.SUCCESS) {
          if (!sendOpts?.quiet) {
            ufl.info(`${context} 成功`, formatIapAckStatus(ack));
          }
          return ack;
        }

        lastError = formatIapAckStatus(ack);
        ufl.warn(
          `${context} ${formatIapAckStatus(ack)}`,
          `重发整笔命令 ${attempt}/${IAP_MAX_RETRIES}`,
        );

        if (onErrCode) {
          await onErrCode(ack.errCode);
        }
      } catch (error: any) {
        lastError = error.message;
        ufl.warn(`${context} ${lastError}`, `重发整笔命令 ${attempt}/${IAP_MAX_RETRIES}`);
      }

      if (attempt < IAP_MAX_RETRIES) {
        await delay(IAP_RETRY_DELAY_MS);
      }
    }

    throw new Error(`${context}失败: ${lastError}（已重试 ${IAP_MAX_RETRIES} 次）`);
  };

  // 更新升级状态
  const updateStatus = useCallback((status: string, progress: number, step: UpgradeStep, error?: string, statusType: 'normal' | 'warning' | 'error' = 'normal') => {
    setUpgradeState(prev => ({
      ...prev,
      status,
      progress,
      currentStep: step,
      error,
      statusType
    }));
  }, []);

  /** 仅更新进度条（高频调用，避免整段 status 文本频繁刷新） */
  const setUpgradeProgress = useCallback((progress: number) => {
    setUpgradeState(prev => {
      if (Math.abs(prev.progress - progress) < 0.02) return prev;
      return { ...prev, progress };
    });
  }, []);

  const persistUpgradeStep = useCallback((step: FirmwareUpgradePersistStep) => {
    const prev = readFirmwareUpgradeState();
    const omitCurrentVersion = isIapBootUpgradePersistStep(step);
    saveFirmwareUpgradeState({
      isUpgrading: true,
      startTime: prev?.startTime ?? new Date().toISOString(),
      step,
      deviceInfo: {
        vendorId: deviceInfo?.vendorId || 0x36B0,
        productId: deviceInfo?.productId || originalKeyboardPID || 0,
        firmwareFile: deviceInfo?.firmwareFile,
        currentVersion: omitCurrentVersion ? undefined : deviceInfo?.currentVersion,
        upgradeVersion: deviceInfo?.upgradeVersion,
      },
    });
  }, [deviceInfo, originalKeyboardPID]);

  // 显示错误（启动阶段，关闭升级流程）
  const showError = useCallback((message: string) => {
    setUpgradeState(prev => ({
      ...prev,
      error: message,
      isUpgrading: false,
      currentStep: UpgradeStep.ERROR,
      statusType: 'error',
      status: t('1219'),
      progress: prev.progress,
    }));
  }, [t]);

  // Boot 模式下升级失败：保留弹窗与设备连接，允许重试
  const showUpgradeFailed = useCallback((message: string) => {
    setUpgradeState(prev => ({
      ...prev,
      error: message,
      isUpgrading: false,
      currentStep: UpgradeStep.ERROR,
      statusType: 'error',
      status: t('1219'),
      progress: prev.progress,
    }));
  }, [t]);

  // 显示成功
  const showSuccess = useCallback(() => {
    upgradeFinishedRef.current = true;
    stopDeviceMonitoring();
    releaseUpgradeMemory();

    setUpgradeState(prev => ({
      ...prev,
      currentStep: UpgradeStep.COMPLETED,
      isUpgrading: false,
      status: t('2884'),
      progress: 100,
      statusType: 'normal',
      error: undefined,
    }));
    showDialog({
      title: t('2905'),
      content: t('2906'),
      confirmText: t('1111'),
      onConfirm: () => {
        stopDeviceMonitoring();
        releaseUpgradeMemory();
        clearFirmwareUpgradeState();
        void (async () => {
          await releaseAllKeyboardHidSessions();
          window.setTimeout(() => {
            window.location.reload();
          }, 350);
        })();
      },
      onCancel: () => {},
      confirmOnly: true,
    });
  }, [showDialog, t, releaseUpgradeMemory, stopDeviceMonitoring]);

  // 检测APP模式设备
  const detectAppModeDevice = useCallback(async (): Promise<HIDDevice | null> => {
    try {
      const DEVICE_FILTERS = getDeviceFilters(deviceInfo);
      const devices = await navigator.hid.getDevices();
      const targetDevice = devices.find(device =>
        device.vendorId === DEVICE_FILTERS.APP_MODE.vendorId &&
        device.productId === DEVICE_FILTERS.APP_MODE.productId &&
        device.collections?.some(collection =>
          collection.usagePage === DEVICE_FILTERS.APP_MODE.usagePage &&
          collection.usage === DEVICE_FILTERS.APP_MODE.usage
        )
      );
      return targetDevice || null;
    } catch (error) {
      ufl.error('APP模式设备检测失败', String(error));
      return null;
    }
  }, [deviceInfo]);

  // 检测Boot模式设备
  const detectBootModeDevice = useCallback(async (): Promise<HIDDevice | null> => {
    try {
      const DEVICE_FILTERS = getDeviceFilters(deviceInfo);
      const devices = await navigator.hid.getDevices();
      const targetDevice = devices.find(device =>
        device.vendorId === DEVICE_FILTERS.BOOT_MODE.vendorId &&
        device.productId === DEVICE_FILTERS.BOOT_MODE.productId &&
        device.collections?.some(collection =>
          collection.usagePage === DEVICE_FILTERS.BOOT_MODE.usagePage &&
          collection.usage === DEVICE_FILTERS.BOOT_MODE.usage
        )
      );
      return targetDevice || null;
    } catch (error) {
      ufl.error('Boot模式设备检测失败', String(error));
      return null;
    }
  }, [deviceInfo]);

  // 请求设备授权
  const requestDeviceAuthorization = useCallback(async (): Promise<HIDDevice | null> => {
    try {
      const DEVICE_FILTERS = getDeviceFilters(deviceInfo);
      // 🔑 只筛选IAP模式（Boot模式）设备，不筛选APP模式
      // 因为切换Boot后，用户需要授权IAP设备才能继续升级
      const devices = await navigator.hid.requestDevice({
        filters: [
          // 先用精确匹配（固定 VID/PID）
          DEVICE_FILTERS.BOOT_MODE,
          // 再加一个更宽松的兜底：只按 usagePage/usage 匹配 Boot 接口
          // 这样即使设备不在预设 VID/PID（或 deviceInfo 未覆盖），也能在授权弹窗里选到
          { usagePage: DEVICE_FILTERS.BOOT_MODE.usagePage, usage: DEVICE_FILTERS.BOOT_MODE.usage },
        ]
      });
      return devices.length > 0 ? devices[0] : null;
    } catch (error) {
      ufl.error('设备授权失败', String(error));
      return null;
    }
  }, [deviceInfo]);

  // 连接设备
  const connectDevice = useCallback(async (device: HIDDevice): Promise<boolean> => {
    try {
      if (!device.opened) {
        await device.open();
      }
      // 清空队列和等待者
      inputQueueRef.current = [];
      inputQueueWaitersRef.current = [];
      // 监听输入报告（使用全局处理器）
      device.addEventListener('inputreport', globalInputHandler);
      ufl.info('设备连接', '已安装全局输入监听器');
      return true;
    } catch (error) {
      ufl.error('设备连接失败', String(error));
      return false;
    }
  }, [globalInputHandler]);

  // 断开设备连接
  const disconnectDevice = useCallback(async (device: HIDDevice | null) => {
    if (device && device.opened) {
      try {
        device.removeEventListener('inputreport', globalInputHandler);
        await device.close();
      } catch (error) {
        ufl.warn('断开设备时出错', String(error));
      }
    }
  }, [globalInputHandler]);

  // 将FileData转换为Uint8Array（用于新协议）
  const loadFirmwareAsUint8Array = async (fileData: FileData): Promise<Uint8Array> => {
    // 计算总大小
    const totalSize = fileData.parts.reduce((sum, part) => sum + part.size, 0);
    const result = new Uint8Array(totalSize);

    // 合并所有部分
    let offset = 0;
    for (const part of fileData.parts) {
      // ✅ 只复制实际数据大小，避免越界
      result.set(part.data.slice(0, part.size), offset);
      offset += part.size;
    }

    return result;
  };

  // 加载本地固件文件
  const loadLocalFirmware = async (): Promise<FileData> => {
    try {
      // 必须传入固件文件路径
      if (!deviceInfo?.firmwareFile) {
        throw new Error(t("1240")); // '未指定固件文件路径，请通过 deviceInfo.firmwareFile 传入'
      }

      const firmwarePath = deviceInfo.firmwareFile;
      const firmwareFileName = firmwarePath.split('/').pop() || firmwarePath;

      ufl.info('加载固件', `文件: ${firmwareFileName}`);
      ufl.info('加载固件', `路径: ${firmwarePath}`);

      const response = await fetch(firmwarePath);
      if (!response.ok) {
        throw new Error(`${t("1241")} ${firmwareFileName}`); // '找不到固件文件'
      }

      const arrayBuffer = await response.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);

      if (data.length === 0) {
        throw new Error(t("1242")); // '固件文件为空'
      }

      const PART_SIZE = 2048;
      const parts = [];
      let partIndex = 0;

      for (let i = 0; i < data.length; i += PART_SIZE) {
        const partSize = Math.min(PART_SIZE, data.length - i);
        const partData = new Uint8Array(PART_SIZE);

        // 初始化为0xFF
        partData.fill(0xFF);

        // 复制实际数据
        partData.set(data.slice(i, i + partSize), 0);

        parts.push({
          startAddress: partIndex * PART_SIZE,
          endAddress: partIndex * PART_SIZE + partSize - 1,
          size: partSize,  // ✅ 使用实际数据大小，而不是固定的PART_SIZE
          data: partData
        });

        partIndex++;
      }

      ufl.info('固件加载成功', `${firmwareFileName} ${data.length} 字节，分块 ${parts.length}`);

      return {
        startAddress: 0,
        parts: parts,
        totalSize: data.length
      };
    } catch (error: any) {
      throw new Error(t("1243") + ': ' + error.message); // '加载固件文件失败'
    }
  };

  // 初始化时检测设备并加载固件文件
  useEffect(() => {
    if (isOpen && deviceInfo?.firmwareFile) {
      // 优先使用传入的设备信息
      const initPID = deviceInfo?.productId || originalKeyboardPID;

      if (initPID) {
        ufl.info('使用传入设备信息', `PID=0x${initPID.toString(16)}`);
        setOriginalKeyboardPID(initPID);
      }

      // 立即检测当前设备并记录PID
      detectAppModeDevice()
        .then((appDevice) => {
          if (appDevice && !initPID) {
            ufl.info('检测到APP模式设备', `PID=0x${appDevice.productId.toString(16)}`);
            setOriginalKeyboardPID(appDevice.productId);
          }

          // 如果还没有固件文件，则加载
          if (!fileData) {
            return loadLocalFirmware();
          }
          return null;
        })
        .then((data) => {
          if (data) {
            setFileData(data);
            const versionInfo = displayCurrentVersion && deviceInfo?.upgradeVersion
              ? ` (${t("1206")}: ${displayCurrentVersion} → ${t("1207")}: ${deviceInfo.upgradeVersion})`
              : '';
            updateStatus(`${t("1209")} (${data.totalSize} ${t("字节")})${versionInfo}`, 0, UpgradeStep.IDLE);
            ufl.info('初始化加载固件成功', `PID=0x${(initPID || originalKeyboardPID || 0).toString(16)}`);
          }
        })
        .catch((error) => {
          ufl.error('初始化检测设备失败', String(error));
          if (!fileData) {
            showError(error.message);
          }
        });
    }
  }, [isOpen, deviceInfo]); // 依赖 deviceInfo 变化

  // 切换到Boot模式
  const switchToBoot = async (device: HIDDevice): Promise<void> => {
    if (!device || !device.opened) {
      throw new Error('设备未连接');
    }

    updateStatus(t("1221"), 5, UpgradeStep.ENTERING_IAP_MODE); // '正在发送切换Boot模式命令...'

    const reportId = REPORT_ID;
    const buildSwitchBootCmd = () => {
      const cmdData = new Uint8Array(63);
      cmdData[0] = 0xAA;
      cmdData[1] = 0x00;
      cmdData[2] = 0x00;
      cmdData[3] = 0x80;
      cmdData[4] = 0x07;
      cmdData[5] = 0x00;
      cmdData[6] = IAP_CMD.SWITCH_BOOT;
      cmdData[7] = 0x02;
      cmdData[8] = 0x00;
      cmdData[9] = IAP_SWITCH_BOOT_DELAY_MS & 0xFF;
      cmdData[10] = (IAP_SWITCH_BOOT_DELAY_MS >> 8) & 0xFF;
      cmdData[11] = 0x69;
      cmdData[12] = 0x0F;
      cmdData[13] = 0x47;
      cmdData[14] = 0x00;
      return cmdData;
    };

    await clearInputBufferQuick(device);
    await sendReport(device, reportId, buildSwitchBootCmd());

    let lastError = '';
    for (let attempt = 1; attempt <= IAP_MAX_RETRIES; attempt++) {
      try {
        const response = await receiveReport(device, IAP_ACK_TIMEOUT_BOOT);
        const ack = parseIapAck(response);
        if (ack?.errCode === ACK_CODE.SUCCESS) {
          ufl.info('切换Boot 成功', formatIapAckStatus(ack));
          updateStatus(t("1222"), 8, UpgradeStep.ENTERING_IAP_MODE);
          updateStatus(t("1223"), 10, UpgradeStep.WAITING_IAP_DEVICE);
          return;
        }
        if (ack) {
          lastError = formatIapAckStatus(ack);
          ufl.warn(
            `切换Boot ${formatIapAckStatus(ack)}`,
            `重试 ${attempt}/${IAP_MAX_RETRIES}`,
          );
        } else {
          lastError = '未收到有效 Boot 切换 ACK';
          ufl.warn(`切换Boot ${lastError}`, `重试 ${attempt}/${IAP_MAX_RETRIES}`);
        }
      } catch (error: any) {
        if (error.message.includes('超时')) {
          // 设备切 Boot 后可能立即断开，无 ACK 也视为已发送成功
          updateStatus(t('2912'), 10, UpgradeStep.WAITING_IAP_DEVICE);
          return;
        }
        lastError = error.message;
      }

      if (attempt < IAP_MAX_RETRIES) {
        await clearInputBufferQuick(device);
        await sendReport(device, reportId, buildSwitchBootCmd());
        await delay(IAP_RETRY_DELAY_MS);
      }
    }

    throw new Error(`切换Boot失败: ${lastError}（已重试 ${IAP_MAX_RETRIES} 次）`);
  };

  // 发送启动命令（0xA0 Header），设备就绪后才允许 FLASH_WRITE
  const sendStartCommand = async (device: HIDDevice, firmwareData: Uint8Array): Promise<void> => {
    updateStatus(t("1228"), 15, UpgradeStep.UPGRADING);
    iapHeaderReadyRef.current = false;

    await clearInputBuffer(device);

    const header = firmwareData.slice(0, 128);

    updateStatus(t("1229"), 18, UpgradeStep.UPGRADING);

    await sendIapBusinessCommandWithRetry(
      device,
      () => {
        const businessData = new Uint8Array(1 + 2 + 128 + 2);
        let idx = 0;

        businessData[idx++] = IAP_CMD.START;
        businessData[idx++] = 128;
        businessData[idx++] = 0;
        businessData.set(header, idx);
        idx += 128;

        const crc = crc16Modbus(businessData.slice(0, idx));
        businessData[idx++] = crc & 0xFF;
        businessData[idx++] = (crc >> 8) & 0xFF;

        return businessData.slice(0, idx);
      },
      '发送启动命令',
      IAP_ACK_TIMEOUT_START,
    );

    await delay(IAP_HEADER_READY_MS);
    await clearInputBufferQuick(device);
    iapHeaderReadyRef.current = true;
    updateStatus(t("1230"), 20, UpgradeStep.UPGRADING);
  };

  // 写入Flash
  const writeFlash = async (device: HIDDevice, firmwareData: Uint8Array): Promise<void> => {
    if (!iapHeaderReadyRef.current) {
      throw new Error('设备 Header 未就绪，请先发送启动命令');
    }

    updateStatus(t('1231'), 25, UpgradeStep.UPGRADING);

    const binData = firmwareData.slice(128);
    const blockSize = firmwareData[66] | (firmwareData[67] << 8);
    const blockNum = Math.floor((binData.length - 1) / blockSize) + 1;

    const buildFlashBlock = (blockIdx: number) => {
      const offset = blockIdx * blockSize;
      const currentSize = (blockIdx === blockNum - 1)
        ? ((binData.length - 1) % blockSize) + 1
        : blockSize;

      const businessData = new Uint8Array(1 + 2 + 6 + currentSize + 2);
      let idx = 0;

      businessData[idx++] = IAP_CMD.FLASH_WRITE;
      const length = currentSize + 6;
      businessData[idx++] = length & 0xFF;
      businessData[idx++] = (length >> 8) & 0xFF;

      if (blockIdx === blockNum - 1) {
        businessData[idx++] = 0xFF;
        businessData[idx++] = 0xFF;
      } else {
        businessData[idx++] = blockIdx & 0xFF;
        businessData[idx++] = (blockIdx >> 8) & 0xFF;
      }

      businessData[idx++] = offset & 0xFF;
      businessData[idx++] = (offset >> 8) & 0xFF;
      businessData[idx++] = (offset >> 16) & 0xFF;
      businessData[idx++] = (offset >> 24) & 0xFF;

      businessData.set(binData.slice(offset, offset + currentSize), idx);
      idx += currentSize;

      const crc = crc16Modbus(businessData.slice(0, idx));
      businessData[idx++] = crc & 0xFF;
      businessData[idx++] = (crc >> 8) & 0xFF;

      return businessData.slice(0, idx);
    };

    const onFlashWriteErrCode = async (errCode: number) => {
      if (
        errCode === ACK_CODE.STATUS_ERROR ||
        errCode === ACK_CODE.BLOCK_NUM_ERROR ||
        errCode === ACK_CODE.WRITE_OFFSET_ERROR
      ) {
        iapHeaderReadyRef.current = false;
        await sendStartCommand(device, firmwareData);
      }
    };

    const writeBlockStrict = async (
      blockIdx: number,
      context: string,
      sendOpts: { quiet?: boolean; skipBufferClear?: boolean },
    ): Promise<void> => {
      const preview = buildFlashBlock(blockIdx);
      const off =
        preview[5] |
        (preview[6] << 8) |
        (preview[7] << 16) |
        (preview[8] << 24);
      await sendIapBusinessCommandWithRetry(
        device,
        () => buildFlashBlock(blockIdx),
        context,
        getFlashBlockAckTimeout(off),
        onFlashWriteErrCode,
        sendOpts,
      );
    };

    const writeBlockWithRetry = async (blockIdx: number): Promise<void> => {
      const preview = buildFlashBlock(blockIdx);
      const blkNum = preview[3] | (preview[4] << 8);
      const off =
        preview[5] |
        (preview[6] << 8) |
        (preview[7] << 16) |
        (preview[8] << 24);
      const payloadLen = preview.length - 9 - 2;
      const payloadPreview = formatBytesHex(
        preview.slice(9, 9 + Math.min(16, payloadLen)),
        16,
      );
      const context = `写入块 ${blockIdx + 1}/${blockNum} | blk=0x${blkNum.toString(16).toUpperCase()} off=0x${off.toString(16).toUpperCase()} len=${payloadLen} data=${payloadPreview}`;
      const quiet =
        blockIdx !== 0 &&
        blockIdx !== blockNum - 1 &&
        blockIdx % IAP_FLASH_LOG_EVERY !== 0;
      const skipBufferClear =
        blockIdx > 0 && blockIdx % IAP_FLASH_BUFFER_FLUSH_INTERVAL !== 0;
      const sendOpts = { quiet, skipBufferClear };

      if (needsStrictFlashAck(blockIdx, blockNum, off)) {
        await writeBlockStrict(blockIdx, context, sendOpts);
        return;
      }

      // 极速通道：只发传输分包，ACK 已在队列则校验，否则直接写下一块（参考 Mechanical）
      await sendBusinessPacket(device, preview, {
        quiet: true,
        turbo: true,
        postAckWaitMs: 0,
      });

      const ackResult = takeIapAckFromQueue();
      if (ackResult?.ack.errCode === ACK_CODE.SUCCESS) {
        return;
      }
      if (ackResult && ackResult.ack.errCode !== ACK_CODE.SUCCESS) {
        ufl.warn(context, formatIapAckStatus(ackResult.ack));
        await onFlashWriteErrCode(ackResult.ack.errCode);
        await writeBlockStrict(blockIdx, context, { quiet: false, skipBufferClear: false });
      }
      // 无 ACK 也继续（设备可能在后台写 Flash）；检查点块会走 strict 校验
    };

    const prevDataLog = upgradeFlowLog.isDataLogEnabled();
    upgradeFlowLog.setDataLogEnabled(false);

    try {
      for (let blockIdx = 0; blockIdx < blockNum; blockIdx++) {
        await writeBlockWithRetry(blockIdx);

        const progress = 25 + ((blockIdx + 1) / blockNum) * 65;
        if (blockIdx % 4 === 0 || blockIdx === blockNum - 1) {
          setUpgradeProgress(progress);
        }

        if (blockIdx % 50 === 0 || blockIdx === blockNum - 1) {
          updateStatus(
            `写入进度: ${blockIdx + 1}/${blockNum} (${((blockIdx + 1) / blockNum * 100).toFixed(1)}%)`,
            progress,
            UpgradeStep.UPGRADING,
          );
        }
      }
    } finally {
      upgradeFlowLog.setDataLogEnabled(prevDataLog);
    }

    updateStatus(t('1234'), 90, UpgradeStep.UPGRADING);
  };

  // 切换到APP
  const switchToApp = async (device: HIDDevice): Promise<void> => {
    updateStatus(t('1235'), 92, UpgradeStep.UPGRADING);

    await sendIapBusinessCommandWithRetry(
      device,
      () => {
        const businessData = new Uint8Array(7);
        let idx = 0;

        businessData[idx++] = IAP_CMD.SWITCH_APP;
        businessData[idx++] = 2;
        businessData[idx++] = 0;
        businessData[idx++] = 0xF4;
        businessData[idx++] = 0x01;

        const crc = crc16Modbus(businessData.slice(0, idx));
        businessData[idx++] = crc & 0xFF;
        businessData[idx++] = (crc >> 8) & 0xFF;

        return businessData.slice(0, idx);
      },
      '切换APP',
      IAP_ACK_TIMEOUT_FAST,
    );

    updateStatus(t('1236'), 95, UpgradeStep.UPGRADING);
    await delay(IAP_SWITCH_APP_SETTLE_MS);
    updateStatus(t('2884'), 100, UpgradeStep.UPGRADING);
  };

  // 设备监控循环
  const startDeviceMonitoring = useCallback(() => {
    if (upgradeFinishedRef.current) return;

    if (deviceMonitorRef.current) {
      clearInterval(deviceMonitorRef.current);
      deviceMonitorRef.current = null;
    }

    const monitor = async () => {
      if (upgradeFinishedRef.current || monitorInFlightRef.current || isProcessingIAPRef.current) {
        return;
      }
      monitorInFlightRef.current = true;
      try {
        const kbDev = keyboardDeviceRef.current;
        const iapDev = iapDeviceRef.current;
        const us = upgradeStateRef.current;

        const appDevice = await detectAppModeDevice();
        if (appDevice && !kbDev.isConnected) {
          ufl.info('设备监控', `检测到APP模式: ${appDevice.productName}`);
          setKeyboardDevice(prev => ({ ...prev, device: appDevice, isConnected: true, isAuthorized: false }));
          if (!originalKeyboardPIDRef.current) {
            ufl.info('设备监控', `记录原始PID=0x${appDevice.productId.toString(16)}`);
            setOriginalKeyboardPID(appDevice.productId);
          }
        } else if (!appDevice && kbDev.isConnected) {
          ufl.info('设备监控', 'APP模式设备已断开');
          setKeyboardDevice(prev => ({ ...prev, device: null, isConnected: false, isAuthorized: false }));
        }

        const bootDevice = await detectBootModeDevice();
        if (bootDevice && !iapDev.isConnected) {
          ufl.info('设备监控', `检测到Boot模式: ${bootDevice.productName} PID=0x${bootDevice.productId.toString(16)}`);
          setIapDevice(prev => ({ ...prev, device: bootDevice, isConnected: true, isAuthorized: false }));
          const shouldAutoContinue =
            us.isUpgrading &&
            (
              us.currentStep === UpgradeStep.WAITING_IAP_DEVICE ||
              us.currentStep === UpgradeStep.ENTERING_IAP_MODE ||
              us.currentStep === UpgradeStep.REQUESTING_AUTHORIZATION
            );
          if (shouldAutoContinue) {
            ufl.info('设备监控', 'Boot 已授权，自动继续升级');
            setUpgradeState(prev => ({ ...prev, currentStep: UpgradeStep.UPGRADING }));
            setTimeout(() => {
              void handleBootDeviceDetectedRef.current(bootDevice);
            }, 0);
          }
        } else if (!bootDevice && iapDev.isConnected) {
          ufl.info('设备监控', 'Boot模式设备已断开');
          setIapDevice(prev => ({ ...prev, device: null, isConnected: false, isAuthorized: false }));
        }
      } catch (error) {
        ufl.error('设备监控出错', String(error));
      } finally {
        monitorInFlightRef.current = false;
      }
    };

    ufl.info('设备监控', '启动监控循环');
    void monitor();
    deviceMonitorRef.current = setInterval(monitor, IAP_DEVICE_MONITOR_MS);
  }, [detectAppModeDevice, detectBootModeDevice]);

  // 处理Boot设备检测到的情况
  const handleBootDeviceDetected = useCallback(async (device: HIDDevice) => {
    // 防止重复处理
    if (isProcessingIAPRef.current) {
      return;
    }

    try {
      isProcessingIAPRef.current = true;

      if (iapWaitTimeoutRef.current) {
        clearTimeout(iapWaitTimeoutRef.current);
        iapWaitTimeoutRef.current = null;
      }

      updateStatus(t('1226'), 15, UpgradeStep.UPGRADING);

      // 连接Boot设备
      const connected = await connectDevice(device);
      if (!connected) {
        throw new Error('无法连接Boot设备');
      }

      // 更新设备状态
      setIapDevice(prev => ({ ...prev, device, isConnected: true, isAuthorized: true }));

      // 检查固件文件是否已加载，如果没有则先加载
      let currentFirmwareData = fileData ? await loadFirmwareAsUint8Array(fileData) : null;
      ufl.info('Boot设备检测', `固件${currentFirmwareData ? '已加载' : '未加载'} size=${currentFirmwareData?.length ?? 0}`);
      if (!currentFirmwareData) {
        updateStatus(t('1227'), 10, UpgradeStep.UPGRADING);

        try {
          const loadedFileData = await loadLocalFirmware();
          setFileData(loadedFileData);
          currentFirmwareData = await loadFirmwareAsUint8Array(loadedFileData);
          ufl.info('Boot设备检测', '从外部路径加载固件');
        } catch (error: any) {
          throw new Error('固件文件加载失败: ' + error.message);
        }
      }

      // 开始升级流程
      await performFirmwareUpgradeWithDeviceAndData(device, currentFirmwareData);

    } catch (error: any) {
      showUpgradeFailed(`${t('2914')}: ${error.message}`);
    } finally {
      isProcessingIAPRef.current = false;
    }
  }, [updateStatus, connectDevice, showUpgradeFailed, originalKeyboardPID, keyboardDevice, fileData, detectAppModeDevice, t]);

  handleBootDeviceDetectedRef.current = handleBootDeviceDetected;

  // 主升级流程
  const startFirmwareUpgrade = async () => {
    if (!fileData) {
      showError(t('2916'));
      return;
    }

    try {
      upgradeFinishedRef.current = false;
      setUpgradeState(prev => ({ ...prev, isUpgrading: true, error: undefined }));
      
      // 💾 保存升级状态到 localStorage（升级开始）
      try {
        saveFirmwareUpgradeState({
          isUpgrading: true,
          startTime: new Date().toISOString(),
          deviceInfo: {
            vendorId: deviceInfo?.vendorId || 0x36B0,
            productId: deviceInfo?.productId || originalKeyboardPID || 0x302B,
            firmwareFile: deviceInfo?.firmwareFile,
            currentVersion: deviceInfo?.currentVersion,
            upgradeVersion: deviceInfo?.upgradeVersion,
          },
          step: 'starting',
        });
      } catch (e) {
        ufl.warn('升级状态', `保存失败: ${String(e)}`);
      }

      // 步骤1: 检测设备
      updateStatus(t('1220'), 5, UpgradeStep.DETECTING_KEYBOARD);

      const appDevice = await detectAppModeDevice();
      const bootDevice = await detectBootModeDevice();

      if (bootDevice) {
        persistUpgradeStep('waiting-iap');
        // 如果已经在Boot模式，直接开始升级
        updateStatus(t('1226'), 10, UpgradeStep.UPGRADING);
        setIapDevice({ device: bootDevice, isConnected: true, isAuthorized: true });
        await handleBootDeviceDetected(bootDevice);
      } else if (appDevice) {
        // 如果在APP模式，需要切换到Boot模式
        updateStatus(t('1221'), 8, UpgradeStep.ENTERING_IAP_MODE);

        if (!originalKeyboardPID) {
          setOriginalKeyboardPID(appDevice.productId);
        }
        setKeyboardDevice({ device: appDevice, isConnected: true, isAuthorized: true });

        // 连接设备
        const connected = await connectDevice(appDevice);
        if (!connected) {
          throw new Error('无法连接设备');
        }

        // 切换到Boot模式
        await switchToBoot(appDevice);

        // 断开设备
        await disconnectDevice(appDevice);
        setKeyboardDevice(prev => ({ ...prev, isConnected: false }));

        persistUpgradeStep('awaiting-boot-auth');
        await delay(IAP_BOOT_REENUMERATE_MS);

        const bootAfterSwitch = await detectBootModeDevice();
        if (bootAfterSwitch) {
          ufl.info('开始升级', 'Boot 已授权，自动继续');
          setIapDevice({ device: bootAfterSwitch, isConnected: true, isAuthorized: true });
          await handleBootDeviceDetected(bootAfterSwitch);
        } else {
          ufl.info('开始升级', '切换Boot完成，等待用户授权 Boot 设备');
          updateStatus(t('2898'), 12, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'warning');
        }
      } else {
        // 未检测到设备，显示授权按钮
        persistUpgradeStep('awaiting-boot-auth');
        ufl.info('开始升级', '未检测到已授权设备，显示授权按钮');
        updateStatus(t('2899'), 5, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'warning');
      }

    } catch (error: any) {
      ufl.error('升级启动失败', error.message);
      showError(`${t('2917')}: ${error.message}`);
      setUpgradeState(prev => ({ ...prev, isUpgrading: false }));
    }
  };

  // 执行固件升级（使用传入的设备和固件数据）
  const performFirmwareUpgradeWithDeviceAndData = async (device: HIDDevice, firmwareData: Uint8Array) => {
    if (!device || !firmwareData) {
      throw new Error('Boot设备或固件数据未准备就绪');
    }

    try {
      // 检查设备是否在Boot模式
      const DEVICE_FILTERS = getDeviceFilters(deviceInfo);
      const isBootMode = device.vendorId === DEVICE_FILTERS.BOOT_MODE.vendorId &&
        device.productId === DEVICE_FILTERS.BOOT_MODE.productId;

      if (!isBootMode) {
        throw new Error('设备不在Bootloader模式，请先切换到Boot模式');
      }

      iapHeaderReadyRef.current = false;
      updateStatus(t('1238'), 10, UpgradeStep.UPGRADING);
      persistUpgradeStep('flashing');

      // 步骤1: 发送启动命令
      await sendStartCommand(device, firmwareData);

      // 步骤2: 写入Flash
      await writeFlash(device, firmwareData);

      // 刷写完成：先停监控，避免 switchToApp 重枚举时 250ms 轮询 + setState 把 tab 打崩
      upgradeFinishedRef.current = true;
      stopDeviceMonitoring();
      inputQueueRef.current = [];
      inputQueueWaitersRef.current = [];

      // 步骤3: 切换到APP
      await switchToApp(device);

      try {
        clearFirmwareUpgradeState();
        ufl.info('升级状态', '升级成功，已清空状态');
      } catch (e) {
        ufl.warn('升级状态', `清空失败: ${String(e)}`);
      }

      try {
        await disconnectDevice(device);
      } catch (e) {
        ufl.warn('升级收尾', `断开 Boot 设备: ${String(e)}`);
      }

      setIapDevice({ device: null, isConnected: false, isAuthorized: false });
      releaseUpgradeMemory();
      showSuccess();

    } catch (error: any) {
      ufl.info('升级状态', '升级失败，保留状态用于异常检测');
      showUpgradeFailed(error.message);
    } finally {
      setUpgradeState(prev => ({ ...prev, isUpgrading: false }));
    }
  };

  // Boot 模式下重新尝试升级
  const retryFirmwareUpgrade = async () => {
    if (!fileData || upgradeState.isUpgrading) {
      return;
    }

    try {
      setUpgradeState(prev => ({
        ...prev,
        isUpgrading: true,
        error: undefined,
        statusType: 'normal',
        currentStep: UpgradeStep.UPGRADING,
      }));

      let device = iapDevice.device;
      if (!device) {
        device = await detectBootModeDevice();
      }

      if (!device) {
        throw new Error(t('1205'));
      }

      if (!device.opened) {
        const connected = await connectDevice(device);
        if (!connected) {
          throw new Error('无法连接Boot设备');
        }
      }

      setIapDevice({ device, isConnected: true, isAuthorized: true });

      const firmwareData = await loadFirmwareAsUint8Array(fileData);
      await performFirmwareUpgradeWithDeviceAndData(device, firmwareData);
    } catch (error: any) {
      showUpgradeFailed(error.message);
      setUpgradeState(prev => ({ ...prev, isUpgrading: false }));
    }
  };

  // 打开WebHID授权
  const handleOpenAuthorization = async (isAutomatic = false) => {
    try {
      // 如果不是自动调用，更新状态为正常的请求授权状态
      if (!isAutomatic) {
        updateStatus(t('2900'), 12, UpgradeStep.REQUESTING_AUTHORIZATION);
      }

      // 请求设备授权
      const device = await requestDeviceAuthorization();
      if (device) {
        // 检查设备模式
        const DEVICE_FILTERS = getDeviceFilters(deviceInfo);
        const isBootMode = device.vendorId === DEVICE_FILTERS.BOOT_MODE.vendorId &&
          device.productId === DEVICE_FILTERS.BOOT_MODE.productId;

        if (isBootMode) {
          persistUpgradeStep('waiting-iap');
          await handleBootDeviceDetected(device);
        } else {
          // APP模式，需要切换到Boot模式
          await switchToBoot(device);
          await disconnectDevice(device);
          persistUpgradeStep('awaiting-boot-auth');
          await delay(IAP_BOOT_REENUMERATE_MS);
          const bootAfterSwitch = await detectBootModeDevice();
          if (bootAfterSwitch) {
            await handleBootDeviceDetected(bootAfterSwitch);
          } else {
            updateStatus(t('2903'), 12, UpgradeStep.REQUESTING_AUTHORIZATION);
          }
        }
      } else {
        // 如果是自动调用且用户取消，保持错误提示状态
        if (isAutomatic) {
          updateStatus(t('2899'), 12, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'error');
        } else {
          updateStatus(t('2900'), 12, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'error');
        }
      }
    } catch (error: any) {
      if (isAutomatic) {
        updateStatus(t('2899'), 12, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'error');
      } else {
        showError(`${t('2918')}: ${error.message}`);
      }
    }
  };

  // 取消升级
  const cancelUpgrade = () => {
    stopDeviceMonitoring();
    setUpgradeState(prev => ({ ...prev, isUpgrading: false, currentStep: UpgradeStep.IDLE }));

    // 清理设备连接
    disconnectDevice(keyboardDevice.device);
    disconnectDevice(iapDevice.device);

    updateStatus(t('2904'), 0, UpgradeStep.IDLE);
    onClose();
  };

  // 重置状态
  const resetState = () => {
    upgradeFinishedRef.current = false;
    monitorInFlightRef.current = false;
    stopDeviceMonitoring();
    isProcessingIAPRef.current = false;
    iapHeaderReadyRef.current = false;
    releaseUpgradeMemory();
    setUpgradeState({
      isUpgrading: false,
      progress: 0,
      status: t("1208"),
      currentStep: UpgradeStep.IDLE,
      statusType: 'normal',
    });
    setKeyboardDevice({ device: null, isConnected: false, isAuthorized: false });
    setIapDevice({ device: null, isConnected: false, isAuthorized: false });
    // 注意：不清除原始PID记录，保持设备信息以便下次使用

  };

  // 弹窗关闭时重置状态
  const handleClose = () => {
    if (!upgradeState.isUpgrading) {
      resetState();
      onClose();
    }
  };

  // 组件挂载时开始设备监控
  // 重要：无论是否传入deviceInfo，都需要启动设备监控
  // 因为升级过程中需要检测设备从APP模式切换到Boot模式
  useEffect(() => {
    if (!isOpen) {
      ufl.info('设备监控', '窗口关闭，停止设备监控');
      stopDeviceMonitoring();
      resumeAttemptedRef.current = false;
      return;
    }
    if (upgradeFinishedRef.current) {
      stopDeviceMonitoring();
      return;
    }
    ufl.info('设备监控', '窗口打开，启动设备监控');
    startDeviceMonitoring();

    return () => {
      stopDeviceMonitoring();
    };
  }, [isOpen, startDeviceMonitoring, stopDeviceMonitoring]);

  /** 页面刷新 / Boot 授权后：仅预加载固件，不自动开始刷写，用户可点「开始升级」重试 */
  useEffect(() => {
    if (!isOpen) {
      resumeAttemptedRef.current = false;
      return;
    }
    if (resumeAttemptedRef.current) return;

    const persisted = readFirmwareUpgradeState();
    if (!persisted?.isUpgrading) return;
    resumeAttemptedRef.current = true;

    const prep = async () => {
      ufl.info('升级恢复', '预加载固件，等待用户开始升级');

      if (!fileData && deviceInfo?.firmwareFile) {
        try {
          const loaded = await loadLocalFirmware();
          setFileData(loaded);
          const versionInfo = displayCurrentVersion && deviceInfo?.upgradeVersion
            ? ` (${t('1206')}: ${displayCurrentVersion} → ${t('1207')}: ${deviceInfo.upgradeVersion})`
            : '';
          updateStatus(`${t('1209')} (${loaded.totalSize} ${t('字节')})${versionInfo}`, 0, UpgradeStep.IDLE);
        } catch (error) {
          ufl.error('升级恢复', `加载固件失败: ${String(error)}`);
        }
      }

      const bootDevice = await detectBootModeDevice();
      if (bootDevice) {
        setIapDevice({ device: bootDevice, isConnected: true, isAuthorized: true });
        updateStatus(t('1226'), 0, UpgradeStep.IDLE);
      } else {
        updateStatus(t('2899'), 5, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'warning');
      }
    };

    void prep();
  }, [isOpen, deviceInfo?.firmwareFile, displayCurrentVersion, deviceInfo?.upgradeVersion, fileData, detectBootModeDevice, t, updateStatus]);

  const primaryColor = theme.palette.primary.main;
  const trackBg = isLightMode ? 'rgba(0, 0, 0, 0.06)' : alpha(theme.palette.common.white, 0.1);

  const progressHeadlineLeft = useMemo(() => {
    if (upgradeState.statusType === 'error' || upgradeState.statusType === 'warning') {
      return upgradeState.status;
    }
    if (upgradeState.currentStep === UpgradeStep.COMPLETED || upgradeState.progress >= 100) {
      return t('2884');
    }
    if (
      upgradeState.currentStep === UpgradeStep.UPGRADING &&
      upgradeState.progress >= 25 &&
      upgradeState.progress < 92
    ) {
      return t('2848');
    }
    if (upgradeState.currentStep === UpgradeStep.IDLE && fileData) {
      return t('1209');
    }
    return upgradeState.status;
  }, [
    upgradeState.currentStep,
    upgradeState.progress,
    upgradeState.status,
    upgradeState.statusType,
    fileData,
    t,
  ]);

  const authFailureBanner =
    upgradeState.currentStep === UpgradeStep.REQUESTING_AUTHORIZATION &&
    upgradeState.statusType === 'error';

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Paper
        sx={{
          position: 'relative',
          width: '90%',
          maxWidth: '600px',
          bgcolor: theme.palette.background.paper,
          backdropFilter: isLightMode ? 'blur(20px)' : 'none',
          border: `1px solid ${isDark ? alpha(primaryColor, 0.48) : 'rgba(15, 23, 42, 0.08)'}`,
          borderRadius: '18px',
          padding: '32px !important',
          boxShadow: isLightMode
            ? '0 20px 60px rgba(0, 0, 0, 0.12)'
            : '0 20px 60px rgba(0, 0, 0, 0.55)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px !important',
            minHeight: '44px',
          }}
        >
          <Typography
            sx={{
              fontSize: '20px',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '0.02em',
              textAlign: 'center',
              color: 'text.primary',
            }}
          >
            {t("1200")}
          </Typography>
          {!upgradeState.isUpgrading && (
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'text.secondary',
                '& .MuiSvgIcon-root': { fontSize: 22 },
                '&:hover': {
                  bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.05)' : alpha(theme.palette.common.white, 0.08),
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '24px !important' } }}>
          <Box>
            <Typography
              sx={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'text.secondary',
                mb: '8px',
                letterSpacing: '0.03em',
              }}
            >
              {t('1202')}
            </Typography>
            <Paper
              sx={{
                p: '20px !important',
                textAlign: 'center',
                ...lightingPanelCardSx(theme),
                ...(iapDevice.isConnected || keyboardDevice.isConnected
                  ? {}
                  : {
                      border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.55 : 0.45)}`,
                    }),
              }}
            >
              <Typography
                sx={{
                  color: iapDevice.isConnected
                    ? 'success.main'
                    : keyboardDevice.isConnected
                      ? 'primary.main'
                      : 'text.disabled',
                  fontSize: '15px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                  mb: '16px !important',
                }}
              >
                {iapDevice.isConnected
                  ? t('1203')
                  : keyboardDevice.isConnected
                    ? t('1204')
                    : `✕ ${t('1205')}`}
              </Typography>

              <Box
                sx={{
                  pt: '16px',
                  borderTop: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.1) : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '10px !important' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>VID</Typography>
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      0x{(iapDevice.device?.vendorId ?? deviceInfo?.vendorId ?? keyboardDevice.device?.vendorId ?? 0).toString(16).toUpperCase().padStart(4, '0')}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>PID</Typography>
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      }}
                    >
                      0x{(iapDevice.device?.productId ?? deviceInfo?.productId ?? keyboardDevice.device?.productId ?? 0).toString(16).toUpperCase().padStart(4, '0')}
                    </Typography>
                  </Box>
                  {displayCurrentVersion && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                        {t('1206')}
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: '14px', fontWeight: 600 }}>
                        v{displayCurrentVersion}
                      </Typography>
                    </Box>
                  )}
                  {deviceInfo?.upgradeVersion && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                        {t('1207')}
                      </Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'primary.main' }}>
                        v{deviceInfo.upgradeVersion}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>
            </Paper>
          </Box>

          <Box
            sx={{
              borderRadius: '10px',
              border: isLightMode ? '1px solid rgba(0, 0, 0, 0.06)' : `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
              bgcolor: isLightMode ? '#ffffff' : alpha(theme.palette.common.white, 0.04),
              pt: '12px',
              pb: '14px',
              overflow: 'hidden',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 44 }}>
             
              <Box
                sx={{
                  flex: 1,
                  minWidth: 0,
                  pl: '14px',
                  pr: '14px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Typography
                  sx={{
                    color:
                      upgradeState.statusType === 'error'
                        ? 'error.main'
                        : upgradeState.statusType === 'warning'
                          ? 'warning.main'
                          : 'text.secondary',
                    fontSize: '14px',
                    fontWeight: 400,
                    lineHeight: 1.45,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {progressHeadlineLeft}
                </Typography>
                <Typography
                  sx={{
                    color:
                      upgradeState.statusType === 'error'
                        ? 'error.main'
                        : upgradeState.statusType === 'warning'
                          ? 'primary.main'
                          : 'text.secondary',
                    fontSize: '14px',
                    fontWeight: 400,
                    lineHeight: 1.45,
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {upgradeState.progress.toFixed(1)}%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ px: '14px', mt: '12px' }}>
              <LinearProgress
                variant="determinate"
                value={upgradeState.progress}
                sx={{
                  height: 10,
                  borderRadius: '999px',
                  bgcolor: trackBg,
                  '& .MuiLinearProgress-bar': {
                    bgcolor:
                      upgradeState.statusType === 'error'
                        ? theme.palette.error.main
                        : upgradeState.statusType === 'warning'
                          ? theme.palette.warning.main
                          : primaryColor,
                    borderRadius: '999px',
                    transition: 'transform 0.18s ease-out',
                  },
                }}
              />
            </Box>
          </Box>

          {authFailureBanner ? (
            <Paper
              sx={{
                ...lightingPanelCardSx(theme),
                p: '18px !important',
                borderRadius: '12px',
                border: `1px solid ${alpha(theme.palette.error.main, 0.45)}`,
              }}
            >
              <Typography sx={{ fontSize: '16px', fontWeight: 700, color: 'error.main', mb: '10px', lineHeight: 1.4 }}>
                {t('2896')}
              </Typography>
              <Typography sx={{ fontSize: '14px', lineHeight: 1.7, color: 'error.main', fontWeight: 500 }}>
                {t('2897')}
              </Typography>
            </Paper>
          ) : null}

          {upgradeState.error && !authFailureBanner ? (
            <Alert
              severity="error"
              sx={{
                borderRadius: '12px',
                ...(isDark
                  ? {
                      bgcolor: alpha(theme.palette.error.main, 0.12),
                      border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
                      color: alpha(theme.palette.common.white, 0.88),
                      '& .MuiAlert-icon': { color: theme.palette.error.main },
                    }
                  : {}),
              }}
            >
              <AlertTitle sx={{ fontSize: '16px', fontWeight: 700 }}>{t('1219')}</AlertTitle>
              <Typography sx={{ fontSize: '14px', lineHeight: 1.65, color: 'error.light' }}>{upgradeState.error}</Typography>
            </Alert>
          ) : null}

          <Paper
            sx={{
              p: '20px !important',
              ...lightingPanelCardSx(theme),
            }}
          >
            <Typography
              sx={{
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: 1.4,
                mb: '14px !important',
                color: 'error.main',
              }}
            >
              {t('1210')}
            </Typography>
            <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '10px !important' } }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('1211')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('1212')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('1213')}
              </Typography>
              <Typography sx={{ color: 'error.main', fontSize: '14px', lineHeight: 1.7, fontWeight: 600 }}>
                {t('1214')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('1215')}
              </Typography>
            </Stack>
          </Paper>

          {authFailureBanner ? (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => void handleOpenAuthorization(false)}
              sx={{
                py: '13px',
                minHeight: 48,
                textTransform: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 700,
                bgcolor: theme.palette.error.main,
                color: '#fff !important',
                boxShadow: `0 8px 24px ${alpha(theme.palette.error.main, 0.35)}`,
                '&:hover': { bgcolor: theme.palette.error.dark },
              }}
            >
              {t('2902')}
            </Button>
          ) : (
            <Stack direction="row" sx={{ gap: '16px !important' }}>
              {upgradeState.currentStep === UpgradeStep.REQUESTING_AUTHORIZATION &&
              upgradeState.statusType !== 'error' ? (
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => void handleOpenAuthorization(false)}
                  sx={{
                    flex: 1,
                    py: '13px',
                    minHeight: 48,
                    textTransform: 'none',
                    borderRadius: '12px',
                    fontSize: '16px',
                    fontWeight: 700,
                    bgcolor: theme.palette.error.main,
                    color: '#fff !important',
                    boxShadow: `0 8px 24px ${alpha(theme.palette.error.main, 0.35)}`,
                    '&:hover': { bgcolor: theme.palette.error.dark },
                  }}
                >
                  {t('1216')}
                </Button>
              ) : null}

              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={
                  upgradeState.currentStep === UpgradeStep.COMPLETED
                    ? handleClose
                    : upgradeState.currentStep === UpgradeStep.ERROR
                      ? () => void retryFirmwareUpgrade()
                      : () => void startFirmwareUpgrade()
                }
                disabled={
                  upgradeState.currentStep === UpgradeStep.COMPLETED
                    ? false
                    : !fileData || upgradeState.isUpgrading
                }
                sx={{
                  flex:
                    upgradeState.currentStep === UpgradeStep.REQUESTING_AUTHORIZATION &&
                    upgradeState.statusType !== 'error'
                      ? 1
                      : '100%',
                  py: '13px',
                  minHeight: 48,
                  textTransform: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: 700,
                  lineHeight: 1.35,
                  boxShadow: `0 8px 24px ${alpha(primaryColor, 0.35)}`,
                  '&:hover': {
                    bgcolor: theme.palette.primary.dark,
                    filter: 'brightness(1.02)',
                  },
                  '&:disabled': {
                    bgcolor: isDark ? alpha(theme.palette.common.white, 0.08) : 'rgba(0, 0, 0, 0.08)',
                    color: `${isDark ? alpha(theme.palette.common.white, 0.35) : 'rgba(0,0,0,0.38)'} !important`,
                    boxShadow: 'none',
                  },
                }}
              >
                {upgradeState.currentStep === UpgradeStep.COMPLETED
                  ? t('1218')
                  : upgradeState.isUpgrading
                    ? t('2901')
                    : upgradeState.currentStep === UpgradeStep.ERROR
                      ? t('2952')
                      : t('1217')}
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Modal>
  );
}

export default FirmwareUpgrade;
