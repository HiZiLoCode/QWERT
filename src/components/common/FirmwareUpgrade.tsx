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

    console.log(`[输入报告] 收到数据: ID=0x${event.reportId.toString(16)}, 前3字节: ${bytes[0].toString(16)} ${bytes[1].toString(16)} ${bytes[2].toString(16)}`);

    // 将数据放入队列
    inputQueueRef.current.push(bytes);

    // 唤醒等待者
    if (inputQueueWaitersRef.current.length > 0) {
      const waiter = inputQueueWaitersRef.current.shift();
      if (waiter) {
        waiter.resolve(bytes);
      }
    }
  }, []);

  // 发送HID报告
  const sendReport = async (device: HIDDevice, reportId: number, data: Uint8Array): Promise<void> => {
    if (!device || !device.opened) {
      throw new Error('设备未连接');
    }

    // HID报告：Report ID (1字节) + 数据 (63字节) = 64字节
    // WebHID API的sendReport不包含Report ID，数据部分是63字节
    const reportData = new Uint8Array(63);
    reportData.set(data.slice(0, 63));

    try {
      console.log(`[发送前] 准备发送 Report ID: 0x${reportId.toString(16)}`);
      await device.sendReport(reportId, reportData.buffer);
      console.log(`[发送后] 成功发送 Report ID: 0x${reportId.toString(16)}`);
    } catch (error: any) {
      console.error('[发送失败]', error);
      throw new Error('发送数据失败: ' + error.message);
    }
  };

  // 接收HID报告 (带超时) - 从队列读取
  const receiveReport = async (device: HIDDevice, timeout: number = 2000): Promise<Uint8Array> => {
    // 如果队列中已有数据，立即返回
    if (inputQueueRef.current.length > 0) {
      const data = inputQueueRef.current.shift();
      if (data) {
        console.log(`[接收] 从队列获取数据`);
        return data;
      }
    }

    // 否则等待新数据
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // 从等待列表中移除
        const index = inputQueueWaitersRef.current.findIndex(w => w.resolve === resolve);
        if (index >= 0) {
          inputQueueWaitersRef.current.splice(index, 1);
        }
        reject(new Error('接收超时'));
      }, timeout);

      inputQueueWaitersRef.current.push({
        resolve: (data: Uint8Array) => {
          clearTimeout(timer);
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
        const data = await receiveReport(device, 100);
        flushedCount++;
        console.log(`清除残留数据 #${flushedCount}: [6]=0x${data[6].toString(16)}`);
      } catch (e) {
        // 超时表示没有更多数据
        break;
      }
    }

    if (flushedCount > 0) {
      console.log(`已清除 ${flushedCount} 个残留数据包`);
    } else {
      console.log(`输入缓冲区干净`);
    }
  };

  // 快速清空输入缓冲区（不输出日志）
  const clearInputBufferQuick = async (device: HIDDevice): Promise<void> => {
    let count = 0;
    const startTime = Date.now();
    while (Date.now() - startTime < 500) {
      try {
        await receiveReport(device, 50);
        count++;
        if (count > 100) break; // 最多清除100个
      } catch (e) {
        break;
      }
    }
  };

  // 发送业务包（自定义协议，非标准Transfer层）
  const sendBusinessPacket = async (device: HIDDevice, data: Uint8Array): Promise<void> => {
    const reportId = REPORT_ID;
    const maxPayloadSize = 56;  // 每包最大56字节有效数据（0x38）
    const packetNum = Math.ceil(data.length / maxPayloadSize);

    console.log(`📦 发送业务包: ${data.length}字节, 分${packetNum}包`);

    for (let i = 0; i < packetNum; i++) {
      const offset = i * maxPayloadSize;
      const payloadSize = Math.min(maxPayloadSize, data.length - offset);
      const payload = data.slice(offset, offset + payloadSize);

      const packIdx = packetNum - i - 1;  // 倒序包索引
      const isFirstPacket = (i === 0);  // 是否是第一个包

      // 自定义协议包
      const packet = new Uint8Array(63);
      packet[0] = 0xAA;  // 协议头
      packet[1] = 0x00;  // 包索引低字节（固定0x00）
      packet[2] = packIdx & 0xFF;  // 包索引高字节（实际值）
      packet[3] = isFirstPacket ? 0x80 : 0x00;  // 控制字节：首包=0x80，后续=0x00
      packet[4] = payloadSize & 0xFF;  // 长度低字节
      packet[5] = (payloadSize >> 8) & 0xFF;  // 长度高字节
      packet.set(payload, 6);  // 数据从第6字节开始

      // 计算BCC校验：从packet[1]开始，包括传输层头（5字节）+ 有效载荷（payloadSize字节）
      const bcc = bccCheck(packet.slice(1, 6 + payloadSize));
      packet[6 + payloadSize] = bcc;  // BCC放在有效载荷后面

      console.log(`[业务包] 准备发送包${i + 1}/${packetNum}, 索引=${packIdx}`);
      await sendReport(device, reportId, packet);
      console.log(`[业务包] 包${i + 1}/${packetNum} 发送完成，等待回显...`);

      // 读取回显（必须读取，否则输入缓冲区会满）
      try {
        const echo = await receiveReport(device, 200);  // 减少到200ms超时
        console.log(`[业务包] 收到回显: ${echo[0].toString(16)} ${echo[1].toString(16)} ${echo[2].toString(16)}...`);
      } catch (e) {
        console.warn(`[业务包] 回显超时（可能设备未返回）`);
      }
    }

    console.log(`[业务包] 所有${packetNum}个包发送完成`);
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

  // 显示错误
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

  // 显示成功
  const showSuccess = useCallback(() => {
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
        window.location.reload();
      },
      onCancel: () => {},
      confirmOnly: true,
    });
  }, [showDialog, t]);

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
      console.error('APP模式设备检测失败:', error);
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
      console.error('Boot模式设备检测失败:', error);
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
      console.error('设备授权失败:', error);
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
      console.log('[设备连接] 已安装全局输入监听器');
      return true;
    } catch (error) {
      console.error('设备连接失败:', error);
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
        console.warn('断开设备时出错:', error);
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

      console.log(`loadLocalFirmware: 使用传入的固件文件: ${firmwareFileName}`);
      console.log(`loadLocalFirmware: 开始加载固件文件: ${firmwarePath}`);

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

      console.log(`loadLocalFirmware: 固件文件 ${firmwareFileName} 加载成功，大小: ${data.length} 字节，分块数: ${parts.length}`);

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
        console.log("使用传入的设备信息，PID:", initPID);
        setOriginalKeyboardPID(initPID);
      }

      // 立即检测当前设备并记录PID
      detectAppModeDevice()
        .then((appDevice) => {
          if (appDevice && !initPID) {
            console.log("检测到APP模式设备，记录PID:", appDevice.productId);
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
            const versionInfo = deviceInfo?.currentVersion && deviceInfo?.upgradeVersion
              ? ` (${t("1206")}: ${deviceInfo.currentVersion} → ${t("1207")}: ${deviceInfo.upgradeVersion})`
              : '';
            updateStatus(`${t("1209")} (${data.totalSize} ${t("字节")})${versionInfo}`, 0, UpgradeStep.IDLE);
            console.log("初始化加载固件成功，当前原始PID:", initPID || originalKeyboardPID);
          }
        })
        .catch((error) => {
          console.error("初始化检测设备失败:", error);
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
    // 数据部分63字节
    const cmdData = new Uint8Array(63);
    cmdData[0] = 0xAA;  // 协议头
    cmdData[1] = 0x00;  // 序列号低字节
    cmdData[2] = 0x00;  // 序列号高字节
    cmdData[3] = 0x80;  // 控制字
    cmdData[4] = 0x07;  // 参数2低字节
    cmdData[5] = 0x00;  // 参数2高字节
    cmdData[6] = IAP_CMD.SWITCH_BOOT;  // 命令码 0xC0
    cmdData[7] = 0x02;  // 参数3低字节
    cmdData[8] = 0x00;  // 参数3高字节
    cmdData[9] = 0x64;  // 延时100ms低字节
    cmdData[10] = 0x00; // 延时100ms高字节
    cmdData[11] = 0x69; // 参数5低字节 (0x0F69 = 3945)
    cmdData[12] = 0x0F; // 参数5高字节
    cmdData[13] = 0x47; // 参数6低字节 (0x0047 = 71)
    cmdData[14] = 0x00; // 参数6高字节

    await sendReport(device, reportId, cmdData);

    // 等待应答
    try {
      const response = await receiveReport(device, 5000);
      // 解析应答: [0]=0xAA 协议头, [6]=0xB0 ACK命令, [7]=0x00 ACK代码
      if (response[0] === 0xAA && response[6] === 0xB0 && response[7] === 0x00) {
        updateStatus(t("1222"), 8, UpgradeStep.ENTERING_IAP_MODE);
        // 等待设备重启
        await delay(5000);
        updateStatus(t("1223"), 10, UpgradeStep.WAITING_IAP_DEVICE);
      } else {
        const ackCode = response[7];
        throw new Error(`切换失败，ACK代码: 0x${ackCode.toString(16).padStart(2, '0')}`);
      }
    } catch (error: any) {
      if (error.message.includes('超时')) {
        updateStatus(t('2912'), 10, UpgradeStep.WAITING_IAP_DEVICE);
      } else {
        throw error;
      }
    }
  };

  // 发送启动命令
  const sendStartCommand = async (device: HIDDevice, firmwareData: Uint8Array): Promise<void> => {
    updateStatus(t("1228"), 15, UpgradeStep.UPGRADING);

    // 先清空输入缓冲区
    await clearInputBuffer(device);

    const header = firmwareData.slice(0, 128);

    // Business层数据包
    const businessData = new Uint8Array(1 + 2 + 128 + 2);
    let idx = 0;

    businessData[idx++] = IAP_CMD.START;  // 0xA0
    businessData[idx++] = 128;  // 长度低字节
    businessData[idx++] = 0;    // 长度高字节
    businessData.set(header, idx);
    idx += 128;

    const crc = crc16Modbus(businessData.slice(0, idx));
    businessData[idx++] = crc & 0xFF;
    businessData[idx++] = (crc >> 8) & 0xFF;

    console.log(`数据: CMD=0xA0, Header=128字节, CRC=0x${crc.toString(16).padStart(4, '0')}`);

    await sendBusinessPacket(device, businessData.slice(0, idx));

    // 等待设备验证Header（重要！设备需要时间验证，约1-2秒）
    updateStatus(t("1229"), 18, UpgradeStep.UPGRADING);
    await delay(2000);

    updateStatus(t("1230"), 20, UpgradeStep.UPGRADING);
  };

  // 写入Flash
  const writeFlash = async (device: HIDDevice, firmwareData: Uint8Array): Promise<void> => {
    updateStatus(t('1231'), 25, UpgradeStep.UPGRADING);

    const binData = firmwareData.slice(128);
    const blockSize = firmwareData[66] | (firmwareData[67] << 8);
    const blockNum = Math.floor((binData.length - 1) / blockSize) + 1;

    console.log(`块大小: ${blockSize}字节, 总块数: ${blockNum}`);

    for (let blockIdx = 0; blockIdx < blockNum; blockIdx++) {
      const offset = blockIdx * blockSize;
      const currentSize = (blockIdx === blockNum - 1)
        ? ((binData.length - 1) % blockSize) + 1
        : blockSize;

      // 每100块清空一次输入缓冲区（减少频率）
      if (blockIdx % 100 === 0 && blockIdx > 0) {
        await clearInputBufferQuick(device);
      }

      // Business层Flash写入包
      const businessData = new Uint8Array(1 + 2 + 6 + currentSize + 2);
      let idx = 0;

      businessData[idx++] = IAP_CMD.FLASH_WRITE;  // 0xA1
      const length = currentSize + 6;
      businessData[idx++] = length & 0xFF;
      businessData[idx++] = (length >> 8) & 0xFF;

      // 块编号 (最后一块用0xFFFF)
      if (blockIdx === blockNum - 1) {
        businessData[idx++] = 0xFF;
        businessData[idx++] = 0xFF;
      } else {
        businessData[idx++] = blockIdx & 0xFF;
        businessData[idx++] = (blockIdx >> 8) & 0xFF;
      }

      // 偏移地址
      businessData[idx++] = offset & 0xFF;
      businessData[idx++] = (offset >> 8) & 0xFF;
      businessData[idx++] = (offset >> 16) & 0xFF;
      businessData[idx++] = (offset >> 24) & 0xFF;

      // 数据
      businessData.set(binData.slice(offset, offset + currentSize), idx);
      idx += currentSize;

      // CRC
      const crc = crc16Modbus(businessData.slice(0, idx));
      businessData[idx++] = crc & 0xFF;
      businessData[idx++] = (crc >> 8) & 0xFF;

      // 每50块或最后一块输出日志（减少日志频率）
      if (blockIdx % 50 === 0 || blockIdx === blockNum - 1) {
        console.log(`→ 块${blockIdx + 1}/${blockNum}: 偏移=0x${offset.toString(16)}, 大小=${currentSize}`);
      }

      try {
        await sendBusinessPacket(device, businessData.slice(0, idx));
      } catch (error: any) {
        throw new Error(`发送块${blockIdx + 1}失败: ${error.message}`);
      }

      const progress = 25 + ((blockIdx + 1) / blockNum) * 65;  // 25%-90%
      updateStatus(`写入进度: ${blockIdx + 1}/${blockNum} (${((blockIdx + 1) / blockNum * 100).toFixed(1)}%)`, progress, UpgradeStep.UPGRADING);
    }

    console.log('✅ Flash写入数据全部发送完成');

    // 尝试读取最终ACK
    updateStatus(t('1233'), 90, UpgradeStep.UPGRADING);
    try {
      await clearInputBufferQuick(device);
      const finalAck = await receiveReport(device, 5000);
      console.log(`✓ 收到设备响应: ${Array.from(finalAck.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    } catch (e) {
      console.warn('⚠️ 未收到确认响应（可能设备已完成写入）');
    }

    updateStatus(t('1234'), 90, UpgradeStep.UPGRADING);
  };

  // 切换到APP
  const switchToApp = async (device: HIDDevice): Promise<void> => {
    updateStatus(t('1235'), 92, UpgradeStep.UPGRADING);

    const businessData = new Uint8Array(7);
    let idx = 0;

    businessData[idx++] = IAP_CMD.SWITCH_APP;  // 0xA4
    businessData[idx++] = 2;  // 长度
    businessData[idx++] = 0;
    businessData[idx++] = 0xE8;  // 延时1000ms低字节
    businessData[idx++] = 0x03;  // 延时1000ms高字节

    const crc = crc16Modbus(businessData.slice(0, idx));
    businessData[idx++] = crc & 0xFF;
    businessData[idx++] = (crc >> 8) & 0xFF;

    console.log(`数据: CMD=0xA4, Delay=1000ms, CRC=0x${crc.toString(16).padStart(4, '0')}`);

    await sendBusinessPacket(device, businessData.slice(0, idx));

    updateStatus(t('1236'), 95, UpgradeStep.UPGRADING);
    updateStatus(t('1237'), 95, UpgradeStep.UPGRADING);
    await delay(2000);
    updateStatus(t('2884'), 100, UpgradeStep.UPGRADING);
  };

  // 设备监控循环
  const startDeviceMonitoring = useCallback(() => {
    const monitor = async () => {
      try {
        // 检测APP模式设备
        const appDevice = await detectAppModeDevice();
        if (appDevice && !keyboardDevice.isConnected) {
          console.log('[设备监控] 检测到APP模式设备:', appDevice.productName);
          setKeyboardDevice(prev => ({ ...prev, device: appDevice, isConnected: true, isAuthorized: false }));
          // 记录原始设备PID（只在没有记录时设置）
          if (!originalKeyboardPID) {
            console.log("[设备监控] 记录原始PID:", appDevice.productId);
            setOriginalKeyboardPID(appDevice.productId);
          }
        } else if (!appDevice && keyboardDevice.isConnected) {
          console.log('[设备监控] APP模式设备已断开');
          setKeyboardDevice(prev => ({ ...prev, device: null, isConnected: false, isAuthorized: false }));
        }

        // 检测Boot模式设备
        const bootDevice = await detectBootModeDevice();
        if (bootDevice && !iapDevice.isConnected) {
          console.log('[设备监控---------------] 🎉 检测到Boot模式设备:', bootDevice.productName, 'PID:', bootDevice.productId.toString(16));
          setIapDevice(prev => ({ ...prev, device: bootDevice, isConnected: true, isAuthorized: false }));
          if (upgradeState.currentStep === UpgradeStep.WAITING_IAP_DEVICE ||
            upgradeState.currentStep === UpgradeStep.ENTERING_IAP_MODE) {
            console.log('[设备监控] 正在等待IAP设备，准备开始升级');
            // 立即更新状态，防止重复触发
            setUpgradeState(prev => ({ ...prev, currentStep: UpgradeStep.UPGRADING }));
            // 使用setTimeout避免循环依赖
            setTimeout(() => {
              handleBootDeviceDetected(bootDevice);
            }, 0);
          }
        } else if (!bootDevice && iapDevice.isConnected) {
          console.log('[设备监控] Boot模式设备已断开');
          setIapDevice(prev => ({ ...prev, device: null, isConnected: false, isAuthorized: false }));
        }
      } catch (error) {
        console.error('[设备监控] 出错:', error);
      }
    };

    console.log('[设备监控] 启动监控循环');
    // 立即执行一次
    monitor();

    // 每500ms检查一次设备状态
    deviceMonitorRef.current = setInterval(monitor, 500);
  }, [keyboardDevice.isConnected, iapDevice.isConnected, detectAppModeDevice, detectBootModeDevice, originalKeyboardPID, upgradeState.currentStep]);

  // 停止设备监控
  const stopDeviceMonitoring = useCallback(() => {
    if (deviceMonitorRef.current) {
      clearInterval(deviceMonitorRef.current);
      deviceMonitorRef.current = null;
    }
  }, []);

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
      console.log("Boot设备检测：当前固件文件状态:", currentFirmwareData ? "已加载" : "未加载", "大小:", currentFirmwareData?.length);
      if (!currentFirmwareData) {
        updateStatus(t('1227'), 10, UpgradeStep.UPGRADING);

        try {
          const loadedFileData = await loadLocalFirmware();
          setFileData(loadedFileData);
          currentFirmwareData = await loadFirmwareAsUint8Array(loadedFileData);
          console.log("loadLocalFirmware: 使用外部传入的固件文件路径");
        } catch (error: any) {
          throw new Error('固件文件加载失败: ' + error.message);
        }
      }

      // 开始升级流程
      await performFirmwareUpgradeWithDeviceAndData(device, currentFirmwareData);

    } catch (error: any) {
      showError(`${t('2914')}: ${error.message}`);
    } finally {
      isProcessingIAPRef.current = false;
    }
  }, [updateStatus, connectDevice, showError, originalKeyboardPID, keyboardDevice, fileData, detectAppModeDevice, t]);

  // 主升级流程
  const startFirmwareUpgrade = async () => {
    if (!fileData) {
      showError(t('2916'));
      return;
    }

    try {
      setUpgradeState(prev => ({ ...prev, isUpgrading: true, error: undefined }));
      
      // 💾 保存升级状态到 localStorage（升级开始）
      try {
        const upgradeStateInfo = {
          isUpgrading: true,
          startTime: new Date().toISOString(),
          deviceInfo: {
            vendorId: deviceInfo?.vendorId || 0x36B0,
            productId: deviceInfo?.productId || originalKeyboardPID || 0x302B,
            firmwareFile: deviceInfo?.firmwareFile,
            currentVersion: deviceInfo?.currentVersion,
            upgradeVersion: deviceInfo?.upgradeVersion,
          },
          step: 'starting'
        };
        localStorage.setItem('firmwareUpgradeState', JSON.stringify(upgradeStateInfo));
        console.log('[升级状态] 已保存到 localStorage:', upgradeStateInfo);
      } catch (e) {
        console.warn('[升级状态] 保存失败:', e);
      }

      // 步骤1: 检测设备
      updateStatus(t('1220'), 5, UpgradeStep.DETECTING_KEYBOARD);

      const appDevice = await detectAppModeDevice();
      const bootDevice = await detectBootModeDevice();

      if (bootDevice) {
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

        // 🔑 关键：发送完切换Boot命令后，立即显示"立即授权"按钮
        // 用户点击授权后，将筛选IAP模式设备（VID: 0x36B0, PID: 0x33FF）
        console.log('[开始升级] 切换Boot命令已发送，显示授权按钮');
        updateStatus(t('2898'), 12, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'warning');
        // 不再等待自动检测，而是让用户手动授权IAP设备
      } else {
        // 未检测到设备，显示授权按钮
        console.log('[开始升级] 未检测到已授权设备，显示授权按钮');
        updateStatus(t('2899'), 5, UpgradeStep.REQUESTING_AUTHORIZATION, undefined, 'warning');
        // 保持 isUpgrading=true，显示授权按钮
      }

    } catch (error: any) {
      console.error('升级启动失败:', error);
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

      updateStatus(t('1238'), 10, UpgradeStep.UPGRADING);

      // 步骤1: 发送启动命令
      await sendStartCommand(device, firmwareData);

      // 步骤2: 写入Flash
      await writeFlash(device, firmwareData);

      // 步骤3: 切换到APP
      await switchToApp(device);

      showSuccess();
      
      // 🗑️ 清空升级状态（升级成功）
      try {
        localStorage.removeItem('firmwareUpgradeState');
        console.log('[升级状态] 升级成功，已清空状态');
      } catch (e) {
        console.warn('[升级状态] 清空失败:', e);
      }

      // 清理资源
      await disconnectDevice(device);
      setIapDevice({ device: null, isConnected: false, isAuthorized: false });

    } catch (error: any) {
      updateStatus(t('1219'), 0, UpgradeStep.ERROR, error.message, 'error');
      
      // ⚠️ 升级失败时不清空状态，保留用于异常检测
      // localStorage 中的状态会在下次连接时检测到
      console.log('[升级状态] 升级失败，保留状态用于异常检测');
      
      throw new Error('升级过程失败: ' + error.message);
    } finally {
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
          await handleBootDeviceDetected(device);
        } else {
          // APP模式，需要切换到Boot模式
          await switchToBoot(device);
          await disconnectDevice(device);
          updateStatus(t('2903'), 12, UpgradeStep.WAITING_IAP_DEVICE);
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
    stopDeviceMonitoring();
    isProcessingIAPRef.current = false; // 重置处理标志
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
    if (isOpen) {
      console.log('[设备监控] 窗口打开，启动设备监控');
      startDeviceMonitoring();
    } else {
      console.log('[设备监控] 窗口关闭，停止设备监控');
      stopDeviceMonitoring();
    }

    return () => {
      stopDeviceMonitoring();
    };
  }, [isOpen, startDeviceMonitoring, stopDeviceMonitoring]);

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
                      0x{(deviceInfo?.vendorId || keyboardDevice.device?.vendorId || 0).toString(16).toUpperCase().padStart(4, '0')}
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
                      0x{(deviceInfo?.productId || keyboardDevice.device?.productId || 0).toString(16).toUpperCase().padStart(4, '0')}
                    </Typography>
                  </Box>
                  {deviceInfo?.currentVersion && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                        {t('1206')}
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: '14px', fontWeight: 600 }}>
                        v{deviceInfo.currentVersion}
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
                  {Math.round(upgradeState.progress)}%
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
                onClick={upgradeState.currentStep === UpgradeStep.COMPLETED ? handleClose : startFirmwareUpgrade}
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
