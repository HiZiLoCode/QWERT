"use client";

import React, { useState, useCallback, useRef } from "react";
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
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from "@/app/i18n";

// WebHID API 类型声明
declare global {
  interface HIDDevice {
    vendorId: number;
    productId: number;
    productName: string;
    opened: boolean;
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
      }>;
    }): Promise<HIDDevice[]>;
  }

  interface Navigator {
    hid: HID;
  }
}

// Dongle设备配置
const DONGLE_CONFIG = {
  vendorId: 0x36B0,
  productId: 0x3002,
  usagePage: 0xFF00,
  reportId: 0x3F,
};

// IAP 命令定义
const IAP_CMD = {
  START: 0xA0,
  FLASH_WRITE: 0xA1,
  SWITCH_APP: 0xA4,
  ACK: 0xB0,
};

// ACK代码定义
const ACK_CODE = {
  SUCCESS: 0x00,
  CRC_ERROR: 0xE2,
  FLASH_OPERATION_FAILED: 0xE8,
  HEADER_IDENTIFY_ERROR: 0xF0,
};

interface UpgradeState {
  isUpgrading: boolean;
  progress: number;
  status: string;
  error?: string;
  statusType?: 'normal' | 'warning' | 'error';
}

interface DongleFirmwareUpgradeProps {
  isOpen: boolean;
  onClose: () => void;
  deviceInfo?: {
    firmwareFile: string;
    currentVersion?: string;
    upgradeVersion?: string;
  };
}

function DongleFirmwareUpgrade({ isOpen, onClose, deviceInfo }: DongleFirmwareUpgradeProps) {
  const theme = useTheme();
  const isLightMode = theme.palette.mode === 'light';
  const { t } = useTranslation("common");

  const [upgradeState, setUpgradeState] = useState<UpgradeState>({
    isUpgrading: false,
    progress: 0,
    status: t("1208"), // "就绪"
    statusType: 'normal',
  });

  const [device, setDevice] = useState<HIDDevice | null>(null);
  const [firmwareData, setFirmwareData] = useState<Uint8Array | null>(null);
  const [isDeviceReady, setIsDeviceReady] = useState(false);

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
    return ((crc << 8) | (crc >> 8)) & 0xFFFF;
  };

  // BCC校验
  const bccCheck = (data: Uint8Array): number => {
    let bcc = 0;
    for (let i = 0; i < data.length; i++) {
      bcc ^= data[i];
    }
    return bcc & 0xFF;
  };

  // 全局输入报告处理器
  const globalInputHandler = useCallback((event: HIDInputReportEvent) => {
    const bytes = new Uint8Array(event.data.buffer);
    inputQueueRef.current.push(bytes);

    if (inputQueueWaitersRef.current.length > 0) {
      const waiter = inputQueueWaitersRef.current.shift();
      if (waiter) {
        waiter.resolve(bytes);
      }
    }
  }, []);

  // 接收HID报告
  const receiveReport = async (timeout: number = 200): Promise<Uint8Array> => {
    if (inputQueueRef.current.length > 0) {
      const data = inputQueueRef.current.shift();
      if (data) {
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
  const clearInputBuffer = async (): Promise<void> => {
    const oldCount = inputQueueRef.current.length;
    inputQueueRef.current = [];
    
    while (inputQueueWaitersRef.current.length > 0) {
      const waiter = inputQueueWaitersRef.current.shift();
      if (waiter) {
        waiter.reject(new Error('缓冲区已清空'));
      }
    }
    
    if (oldCount > 0) {
      console.log(`已清除 ${oldCount} 个残留数据包`);
    }
  };

  // iapTransfer: 发送单个传输层包并读取回显
  const iapTransfer = async (
    device: HIDDevice,
    data: Uint8Array,
    size: number,
    packIdxReverse: number,
    isFirst: boolean,
    timeout: number = 500
  ): Promise<Uint8Array> => {
    const packet = new Uint8Array(64);
    packet[0] = DONGLE_CONFIG.reportId;  // Report ID
    packet[1] = 0xAA;  // 协议头
    packet[2] = 0x00;  // Direction
    
    const pack_ctrl = (isFirst ? 0x8000 : 0x0000) | (packIdxReverse & 0x7FFF);
    packet[3] = pack_ctrl & 0xFF;
    packet[4] = (pack_ctrl >> 8) & 0xFF;
    packet[5] = size & 0xFF;
    packet[6] = (size >> 8) & 0xFF;
    packet.set(data.slice(0, size), 7);
    
    const bcc = bccCheck(packet.slice(2, 7 + size));
    packet[7 + size] = bcc;
    
    // 发送（不包含Report ID）
    await device.sendReport(DONGLE_CONFIG.reportId, packet.slice(1).buffer);
    
    await delay(2);
    
    try {
      const echo = await receiveReport(timeout);
      
      // 检查是否是ACK包
      if (echo[1] & 0x80) {
        // 放回队列供 iapBusinessRead 读取
        inputQueueRef.current.unshift(echo);
      }
      
      return echo;
    } catch (e) {
      throw new Error('读取回显超时');
    }
  };

  // iapBusiness: 发送业务层数据
  const iapBusiness = async (device: HIDDevice, data: Uint8Array, size: number, timeout: number = 500): Promise<void> => {
    await clearInputBuffer();
    
    const packSize = 56;
    const packNum = Math.ceil(size / packSize);
    const packLastSize = ((size - 1) % packSize) + 1;
    
    console.log(`发送业务包: ${size}字节, 分${packNum}包`);
    
    for (let packIdx = 0; packIdx < packNum; packIdx++) {
      const currentPackSize = (packIdx === packNum - 1) ? packLastSize : packSize;
      const packIdxReverse = packNum - packIdx - 1;
      const isFirst = (packIdx === 0);
      
      try {
        await iapTransfer(
          device,
          data.slice(packIdx * packSize),
          currentPackSize,
          packIdxReverse,
          isFirst,
          timeout
        );
      } catch (e: any) {
        throw new Error(`发送第${packIdx + 1}/${packNum}包失败: ${e.message}`);
      }
    }
  };

  // iapBusinessRead: 读取ACK应答
  const iapBusinessRead = async (timeout: number = 5000): Promise<number> => {
    const startTime = Date.now();
    let businessData: number[] = [];
    let businessPackLen = 0;
    let isFirst = false;
    let receivedLen = 0;
    let hasReceivedData = false;
    
    while (Date.now() - startTime < timeout) {
      try {
        const remainingTime = timeout - (Date.now() - startTime);
        if (remainingTime <= 0) {
          break;
        }
        
        const response = await receiveReport(Math.min(remainingTime, 2000));
        hasReceivedData = true;
        
        // 检查传输层header
        if (response[0] !== 0xAA) {
          continue;
        }
        
        // 检查是否是全零回显
        const isZeroEcho = response.slice(1, 10).every(b => b === 0x00);
        if (isZeroEcho) {
          continue;
        }
        
        // 提取数据
        const len = response[4] | (response[5] << 8);
        isFirst = (response[3] & 0x80) !== 0;
        
        // 验证BCC
        const bcc_calc = bccCheck(response.slice(1, 6 + len));
        if (response[6 + len] !== bcc_calc) {
          throw new Error('BCC校验失败');
        }
        
        // 提取业务数据
        const payload = response.slice(6, 6 + len);
        businessData.push(...Array.from(payload));
        
        if (isFirst) {
          businessPackLen = payload[3] | (payload[4] << 8);
        }
        
        receivedLen += len;
        
        // 检查是否接收完整
        if (receivedLen >= businessPackLen + 5 + 2) {
          break;
        }
      } catch (e) {
        if (!hasReceivedData) {
          throw new Error('未收到ACK包');
        }
        continue;
      }
    }
    
    if (businessData.length === 0) {
      throw new Error('读取ACK超时');
    }
    
    const businessArray = new Uint8Array(businessData);
    
    if (businessArray[0] !== 0xB0) {
      throw new Error(`不是ACK包: CMD=0x${businessArray[0].toString(16)}`);
    }
    
    // 验证CRC
    const crcDataLen = 5 + businessPackLen;
    const crcData = businessArray.slice(0, crcDataLen);
    const crc_calc = crc16Modbus(crcData);
    const crc_recv = businessArray[businessPackLen + 5] | (businessArray[businessPackLen + 6] << 8);
    
    if (crc_calc !== crc_recv) {
      throw new Error(`CRC校验失败`);
    }
    
    return businessArray[1];  // 返回ACK码
  };

  // 获取ACK错误消息
  const getAckMessage = (code: number): string => {
    const messages: { [key: number]: string } = {
      0x00: '操作成功',
      0xE0: '未知命令',
      0xE2: 'CRC错误',
      0xE8: 'Flash操作失败',
      0xF0: 'Header标识错误',
    };
    return messages[code] || `未知错误码 0x${code.toString(16).toUpperCase()}`;
  };

  // 更新状态
  const updateStatus = (status: string, progress: number, error?: string, statusType: 'normal' | 'warning' | 'error' = 'normal') => {
    setUpgradeState(prev => ({
      ...prev,
      status,
      progress,
      error,
      statusType
    }));
  };

  // 加载固件文件
  const loadFirmware = async (): Promise<Uint8Array> => {
    if (!deviceInfo?.firmwareFile) {
      throw new Error(t("1240")); // '未指定固件文件路径，请通过 deviceInfo.firmwareFile 传入'
    }

    const response = await fetch(deviceInfo.firmwareFile);
    if (!response.ok) {
      throw new Error(t("1243")); // '加载固件文件失败'
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);

    if (data.length === 0) {
      throw new Error(t("1242")); // '固件文件为空'
    }

    return data;
  };

  // 检测已授权的Dongle设备
  const detectDongleDevice = async (): Promise<HIDDevice | null> => {
    try {
      const devices = await navigator.hid.getDevices();
      // 需要同时检查 VID、PID 和 usagePage，确保选择正确的 HID 接口
      const dongleDevice = devices.find(device => {
        // 检查 VID 和 PID
        if (device.vendorId !== DONGLE_CONFIG.vendorId ||
            device.productId !== DONGLE_CONFIG.productId) {
          return false;
        }
        // 检查 usagePage (collections 中包含 Vendor-Defined Page 0xFF00)
        const hasCorrectUsagePage = device.collections?.some(
          collection => collection.usagePage === DONGLE_CONFIG.usagePage
        );
        return hasCorrectUsagePage;
      });
      return dongleDevice || null;
    } catch (error) {
      console.error('Dongle设备检测失败:', error);
      return null;
    }
  };

  // 连接设备（自动检测或请求授权）
  const connectDevice = async (autoDetected?: HIDDevice): Promise<HIDDevice> => {
    let dev: HIDDevice;

    if (autoDetected) {
      // 使用自动检测到的设备
      dev = autoDetected;
    } else {
      // 请求用户授权
      const devices = await navigator.hid.requestDevice({
        filters: [{
          vendorId: DONGLE_CONFIG.vendorId,
          productId: DONGLE_CONFIG.productId,
          usagePage: DONGLE_CONFIG.usagePage,
        }]
      });

      if (devices.length === 0) {
        throw new Error(t("1253")); // '未选择设备'
      }

      dev = devices[0];
    }

    // 打开设备
    if (!dev.opened) {
      await dev.open();
    }

    inputQueueRef.current = [];
    inputQueueWaitersRef.current = [];
    dev.addEventListener('inputreport', globalInputHandler);

    setDevice(dev);
    setIsDeviceReady(true);
    return dev;
  };

  // 断开设备
  const disconnectDevice = async (dev: HIDDevice | null) => {
    if (dev && dev.opened) {
      try {
        dev.removeEventListener('inputreport', globalInputHandler);
        await dev.close();
      } catch (error) {
        console.warn('断开设备时出错:', error);
      }
    }
  };

  // 开始升级
  const startUpgrade = async () => {
    let connectedDevice: HIDDevice | null = null;

    try {
      setUpgradeState(prev => ({ ...prev, isUpgrading: true, error: undefined }));

      // 加载固件
      updateStatus(t("1254"), 5); // "加载固件文件..."
      const firmware = firmwareData || await loadFirmware();
      setFirmwareData(firmware);

      // 连接设备
      updateStatus(t("1255"), 10); // "连接设备..."
      if (device) {
        connectedDevice = device;
      } else {
        // 先尝试自动检测
        const autoDetected = await detectDongleDevice();
        if (autoDetected) {
          console.log('自动检测到Dongle设备:', autoDetected.productName);
          connectedDevice = await connectDevice(autoDetected);
        } else {
          // 未检测到，请求用户授权
          connectedDevice = await connectDevice();
        }
      }

      // 步骤1: 发送启动命令
      updateStatus(t("1228"), 15); // "发送启动命令..."
      const header = firmware.slice(0, 128);
      const businessData1 = new Uint8Array(1 + 2 + 128 + 2);
      let idx = 0;
      businessData1[idx++] = IAP_CMD.START;
      businessData1[idx++] = 128;
      businessData1[idx++] = 0;
      businessData1.set(header, idx);
      idx += 128;
      
      const crc1 = crc16Modbus(businessData1.slice(0, idx));
      businessData1[idx++] = crc1 & 0xFF;
      businessData1[idx++] = (crc1 >> 8) & 0xFF;

      await iapBusiness(connectedDevice, businessData1, idx);
      await delay(200);
      
      const ack1 = await iapBusinessRead(5000);
      if (ack1 !== ACK_CODE.SUCCESS) {
        console.warn(`启动命令ACK异常: ${getAckMessage(ack1)}`);
      }

      // 步骤2: 写入Flash
      updateStatus(t("1231"), 20); // "写入Flash数据..."
      const binData = firmware.slice(128);
      const blockSize = firmware[66] | (firmware[67] << 8);
      const blockNum = Math.ceil(binData.length / blockSize);
      
      for (let blockIdx = 0; blockIdx < blockNum; blockIdx++) {
        const currentSize = (blockIdx === blockNum - 1)
          ? ((binData.length - 1) % blockSize) + 1
          : blockSize;
        const offset = blockIdx * blockSize;
        
        const businessData2 = new Uint8Array(1 + 2 + 6 + currentSize + 2);
        let idx2 = 0;
        businessData2[idx2++] = IAP_CMD.FLASH_WRITE;
        const length = currentSize + 6;
        businessData2[idx2++] = length & 0xFF;
        businessData2[idx2++] = (length >> 8) & 0xFF;
        
        if (blockIdx === blockNum - 1) {
          businessData2[idx2++] = 0xFF;
          businessData2[idx2++] = 0xFF;
        } else {
          businessData2[idx2++] = blockIdx & 0xFF;
          businessData2[idx2++] = (blockIdx >> 8) & 0xFF;
        }
        
        businessData2[idx2++] = offset & 0xFF;
        businessData2[idx2++] = (offset >> 8) & 0xFF;
        businessData2[idx2++] = (offset >> 16) & 0xFF;
        businessData2[idx2++] = (offset >> 24) & 0xFF;
        
        businessData2.set(binData.slice(offset, offset + currentSize), idx2);
        idx2 += currentSize;
        
        const crc2 = crc16Modbus(businessData2.slice(0, idx2));
        businessData2[idx2++] = crc2 & 0xFF;
        businessData2[idx2++] = (crc2 >> 8) & 0xFF;

        await iapBusiness(connectedDevice, businessData2, idx2);
        
        const ack2 = await iapBusinessRead(5000);
        if (ack2 !== ACK_CODE.SUCCESS) {
          console.warn(`写入块${blockIdx} ACK异常: ${getAckMessage(ack2)}`);
        }
        
        const progress = 20 + ((blockIdx + 1) / blockNum) * 70;
        updateStatus(`${t("1232")}: ${blockIdx + 1}/${blockNum}`, progress); // "写入进度"
      }

      // 步骤3: 切换到APP
      updateStatus(t("1233"), 95); // "发送切换APP命令..."
      const businessData3 = new Uint8Array(7);
      let idx3 = 0;
      businessData3[idx3++] = IAP_CMD.SWITCH_APP;
      businessData3[idx3++] = 2;
      businessData3[idx3++] = 0;
      businessData3[idx3++] = 0xE8;
      businessData3[idx3++] = 0x03;
      
      const crc3 = crc16Modbus(businessData3.slice(0, idx3));
      businessData3[idx3++] = crc3 & 0xFF;
      businessData3[idx3++] = (crc3 >> 8) & 0xFF;

      await iapBusiness(connectedDevice, businessData3, idx3);
      await delay(200);
      
      const ack3 = await iapBusinessRead(5000);
      if (ack3 !== ACK_CODE.SUCCESS) {
        console.warn(`切换APP响应: ${getAckMessage(ack3)}`);
      }

      updateStatus(t("1234"), 100, undefined, 'normal'); // "升级完成！"

    } catch (error: any) {
      updateStatus(`${t("1235")}: ${error.message}`, 0, error.message, 'error'); // "升级失败"
    } finally {
      setUpgradeState(prev => ({ ...prev, isUpgrading: false }));
      if (connectedDevice) {
        await disconnectDevice(connectedDevice);
        setDevice(null);
      }
    }
  };

  const handleClose = () => {
    if (!upgradeState.isUpgrading) {
      onClose();
    }
  };

  // 组件打开时自动检测并连接Dongle设备
  React.useEffect(() => {
    if (isOpen && !device && !isDeviceReady) {
      const autoConnectDevice = async () => {
        try {
          updateStatus(t("1255"), 5); // "连接设备..."
          
          const autoDetected = await detectDongleDevice();
          if (autoDetected) {
            console.log('✅ 自动检测到Dongle设备:', autoDetected.productName);
            await connectDevice(autoDetected);
            updateStatus(t("1256"), 10); // "设备已连接，准备升级"
          } else {
            updateStatus(t("1257"), 0, undefined, 'warning'); // "未检测到设备，请点击开始升级授权"
          }
        } catch (error: any) {
          console.error('自动连接失败:', error);
          updateStatus(t("1208"), 0); // "就绪"
        }
      };

      autoConnectDevice();
    }

    // 组件关闭时清理设备连接
    return () => {
      if (!isOpen && device) {
        disconnectDevice(device);
        setDevice(null);
        setIsDeviceReady(false);
      }
    };
  }, [isOpen]);

  const primaryColor = theme.palette.primary.main;

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
          bgcolor: isLightMode ? 'rgba(250, 250, 252, 0.98)' : 'rgba(40, 40, 52, 0.98)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '16px',
          padding: '36px !important',
          boxShadow: isLightMode
            ? '0 20px 60px rgba(0, 0, 0, 0.12)'
            : '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* 标题栏 */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ fontSize: '28px', mr: 1.5 }}>
              📡
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontSize: '20px', fontWeight: 600, mb: 0.3 }}>
                {t("1250")} {/* 2.4G 接收器固件升级 */}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                {t("1251")} {/* 基于 WebHID 的无线接收器升级工具 */}
              </Typography>
            </Box>
          </Box>
          {!upgradeState.isUpgrading && (
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{
                '&:hover': {
                  bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '24px !important' } }}>
          {/* 设备信息 */}
          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px !important', color: 'text.primary' }}>
              📱 {t("1202")} {/* 设备状态 */}
            </Typography>
            <Paper
              sx={{
                padding: '20px !important',
                bgcolor: isLightMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.3)',
                border: `1px solid ${device ? primaryColor : (isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)')}`,
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  color: device ? primaryColor : 'text.disabled',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: device ? '16px !important' : '0',
                }}
              >
                {device ? `✅ ${t("1258")}` : `⏳ ${t("1255")}`} {/* 设备已连接 / 连接设备... */}
              </Typography>

              {device && (
                <Box sx={{
                  marginTop: '16px !important',
                  paddingTop: '16px !important',
                  borderTop: `1px solid ${isLightMode ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)'}`
                }}>
                  <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '10px !important' } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        {t("1252")} {/* 设备名称 */}
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: '12px', fontWeight: 600 }}>
                        {device.productName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        VID:PID
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {DONGLE_CONFIG.vendorId.toString(16).toUpperCase().padStart(4, '0')}:
                        {DONGLE_CONFIG.productId.toString(16).toUpperCase().padStart(4, '0')}
                      </Typography>
                    </Box>
                    {deviceInfo?.currentVersion && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {t("1206")} {/* 当前版本 */}
                        </Typography>
                        <Typography sx={{ color: 'text.primary', fontSize: '12px', fontWeight: 600 }}>
                          v{deviceInfo.currentVersion}
                        </Typography>
                      </Box>
                    )}
                    {deviceInfo?.upgradeVersion && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {t("1207")} {/* 升级版本 */}
                        </Typography>
                        <Typography sx={{ color: primaryColor, fontSize: '13px', fontWeight: 700 }}>
                          v{deviceInfo.upgradeVersion}
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}
            </Paper>
          </Box>

          {/* 进度条 */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px !important' }}>
              <Typography
                sx={{
                  color: upgradeState.statusType === 'error' ? 'error.main' :
                    upgradeState.statusType === 'warning' ? 'warning.main' :
                      'text.primary',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {upgradeState.status}
              </Typography>
              <Typography
                sx={{
                  color: primaryColor,
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {Math.round(upgradeState.progress)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={upgradeState.progress}
              sx={{
                height: 8,
                borderRadius: '6px',
                bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
                '& .MuiLinearProgress-bar': {
                  bgcolor: upgradeState.statusType === 'error' ? 'error.main' :
                    upgradeState.statusType === 'warning' ? 'warning.main' :
                      primaryColor,
                  borderRadius: '6px',
                }
              }}
            />
          </Box>

          {/* 错误信息 */}
          {upgradeState.error && (
            <Alert severity="error">
              <AlertTitle sx={{ fontSize: '14px' }}>{t("1219")}</AlertTitle> {/* 升级失败 */}
              <Typography sx={{ fontSize: '12px' }}>
                {upgradeState.error}
              </Typography>
            </Alert>
          )}

          {/* 升级按钮 */}
          <Button
            variant="contained"
            size="medium"
            onClick={startUpgrade}
            disabled={upgradeState.isUpgrading}
            sx={{
              paddingTop: '10px !important',
              paddingBottom: '10px !important',
              bgcolor: primaryColor,
              color: '#000 !important',
              fontWeight: 600,
              fontSize: '14px',
              borderRadius: '10px',
              boxShadow: `0 4px 12px ${primaryColor}30`,
              '&:hover': {
                bgcolor: primaryColor,
                filter: 'brightness(1.05)',
                boxShadow: `0 6px 16px ${primaryColor}40`,
              },
              '&:disabled': {
                bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
              },
            }}
          >
            🚀 {t("1217")} {/* 开始升级 */}
          </Button>
        </Stack>
      </Paper>
    </Modal>
  );
}

export default DongleFirmwareUpgrade;

