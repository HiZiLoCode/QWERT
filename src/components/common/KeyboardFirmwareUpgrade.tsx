"use client";

import React, { useState, useContext, useRef } from "react";
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
import { ConnectKbContext } from "@/providers/ConnectKbProvider";

// 常量定义 - 严格按照 index.html
const BIN_HEADER_SIZE = 64;
const UPGRADE_CHUNK_SIZE = 4096;
const SEND_SIZE = 48;
const REPORT_ID = 0xFF;

interface UpgradeState {
  isUpgrading: boolean;
  progress: number;
  status: string;
  error?: string;
  statusType?: 'normal' | 'warning' | 'error';
}

interface KeyboardFirmwareUpgradeProps {
  isOpen: boolean;
  onClose: () => void;
}

function KeyboardFirmwareUpgrade({ isOpen, onClose }: KeyboardFirmwareUpgradeProps) {
  const theme = useTheme();
  const isLightMode = theme.palette.mode === 'light';
  const { t } = useTranslation("common");

  // 从 ConnectKbProvider 获取设备信息
  const { connectedKeyboard, keyboard } = useContext(ConnectKbContext);

  const [upgradeState, setUpgradeState] = useState<UpgradeState>({
    isUpgrading: false,
    progress: 0,
    status: t("1208"), // "就绪"
    statusType: 'normal',
  });

  const [firmwareData, setFirmwareData] = useState<Uint8Array | null>(null);

  // 升级过程中的状态变量
  let sentBytes = 0;
  let packetCount = 0;
  let binOffset = 0;
  let ack01Done = false;

  // NotifyDevice 相关
  const ackResolverRef = useRef<((value: number[]) => void) | null>(null);

  // 延时函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 计算校验和
  const calcChecksum = (data: Uint8Array): number => {
    let checksum = 0;
    for (let i = 0; i < data.length; i++) {
      checksum += data[i];
    }
    return checksum & 0xFFFF;
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
    const firmwareFile = keyboard?.deviceUpgradeFile;

    if (!firmwareFile) {
      throw new Error(t("1240")); // '未指定固件文件路径'
    }

    const response = await fetch(firmwareFile);
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

  // 初始化 8K 键盘固件升级监听器
  const init8kUpgradeListener = async () => {
    // 检查是否已经有 8KUpgradeNotify 监听器
    const existingListener = connectedKeyboard.listeners.find(
      (listener) => listener.name === "8KUpgradeNotify"
    );

    if (existingListener) {
      const index = connectedKeyboard.listeners.indexOf(existingListener);
      connectedKeyboard.listeners.splice(index, 1);
    }

    // 添加新的监听器
    connectedKeyboard.listeners.push({
      name: "8KUpgradeNotify",
      fn: (data: number[]) => {
        if (ackResolverRef.current) {
          ackResolverRef.current(data);
          ackResolverRef.current = null;
        }
      }
    });

    // 调用 KeyboardDevice 的 init8kUpgradeListener 方法来设置底层监听器
    await connectedKeyboard.init8kUpgradeListener();
  };

  // 移除 8K 键盘固件升级监听器
  const remove8kUpgradeListener = () => {
    const existingListener = connectedKeyboard.listeners.find(
      (listener) => listener.name === "8KUpgradeNotify"
    );

    if (existingListener) {
      const index = connectedKeyboard.listeners.indexOf(existingListener);
      connectedKeyboard.listeners.splice(index, 1);
    }
  };

  // 等待 ACK 响应 - 返回接收到的数据
  const waitForAck = (timeout: number = 5000): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ackResolverRef.current = null;
        reject(new Error(t("1262") || "等待 ACK 超时"));
      }, timeout);

      ackResolverRef.current = (data: number[]) => {
        clearTimeout(timer);
        resolve(data);
      };
    });
  };

  // 检查是否是ACK响应
  const isAck = (resp: number[], type: number): boolean => {
    return (
      resp &&
      resp[0] === 0xFF &&
      resp[1] === 0x70 &&
      resp[2] === type
    );
  };

  // 下载固件数据 - 严格按照 index.html 的 downloadFirmwareData
  const downloadFirmwareData = async (data: Uint8Array, sendSize: number, ackType: number, firmware: Uint8Array): Promise<void> => {
    for (let i = 0; i < data.length; i += sendSize) {
      const packet = new Uint8Array(sendSize + 4);
      packet[0] = 0xFF;
      packet[1] = 0x68;

      const chunk = data.slice(i, i + sendSize);
      packet.set(chunk, 2);

      // padding
      if (chunk.length < sendSize) {
        packet.fill(0, 2 + chunk.length, 2 + sendSize);
      }

      const checksum = calcChecksum(packet.slice(0, sendSize + 2));
      packet[sendSize + 2] = checksum & 0xff;
      packet[sendSize + 3] = (checksum >> 8) & 0xff;

      // 1️⃣ 发送数据（不等待返回）- 使用 NoWait 方法提高速度
      await connectedKeyboard.api.sendDeviceDataNoWait(packet[0], packet.slice(1, 63));
      packetCount++;

      // 2️⃣ 统计
      sentBytes += chunk.length;

      // ⭐ 只统计 BIN 本体（header 不算）
      if (ackType === 0x02) {
        binOffset += chunk.length;
      }

      const binDataLength = firmware.length - BIN_HEADER_SIZE;
      const remainBytes = binDataLength - binOffset;

      // 3️⃣ ACK 判断（严格按 BIN 4K）
      let needWaitAck = false;

      if (ackType === 0x01) {
        // Header：两包等一次 ACK
        if (!ack01Done && packetCount === 2) {
          needWaitAck = true;
          ack01Done = true;
        }
      }

      if (ackType === 0x02) {
        // ⭐ BIN 文件 4K block 或最后一包
        if (binOffset % 4096 === 0 || remainBytes === 0) {
          needWaitAck = true;
        }
      }

      if (needWaitAck) {
        // 从 NotifyDevice 等待 ACK
        const resp = await waitForAck(ackType === 0x01 ? 5000 : 1500);

        if (!isAck(resp, ackType)) {
          throw new Error(t("1263") || "DFU ACK 错误");
        }
      }
    }
  };

  // 升级过程 - 严格按照 index.html 的 upgradeProcess
  const upgradeProcess = async (firmware: Uint8Array): Promise<void> => {
    sentBytes = 0;
    binOffset = 0;
    packetCount = 0;
    ack01Done = false;
    await connectedKeyboard.startComm();

    // 初始化 8K 键盘固件升级监听器
    await init8kUpgradeListener();

    // 发送升级开始命令 - 发送完整的 64 字节
    const packet = new Uint8Array(63);
    packet[0] = 0xFF;
    packet[1] = 0x64;
    packet[2] = 0x01;
    packet[3] = SEND_SIZE & 0xFF;
    packet[4] = (SEND_SIZE >> 8) & 0xFF;

    const checksum = calcChecksum(packet.slice(0, 18));
    packet[18] = checksum & 0xFF;
    packet[19] = (checksum >> 8) & 0xFF;
    let reply = null;
    let retries = 10;

    while (retries-- > 0 && reply === null) {
      try {
        await connectedKeyboard.api.sendDeviceData(packet[0], packet.slice(1));

        const response = await waitForAck(500);
        if (response[0] === 0xFF && response[1] === 0x70) {
          reply = response[2];
          break;
        }
        break;
      } catch (e) {
        if (retries === 0) {
          throw new Error(t("1264") || "设备无响应");
        }
        await delay(500);
      }
    }

    updateStatus(t("1231") || "正在上传固件...", 10);
    await delay(2);

    // 发送 Header
    await new Promise(resolve => setTimeout(resolve, 2));
    const header = firmware.slice(0, BIN_HEADER_SIZE);
    await downloadFirmwareData(header, SEND_SIZE, 0x01, firmware);

    // 分块发送固件
    const binLength = firmware.length;
    let downloadLen = BIN_HEADER_SIZE;

    for (let i = BIN_HEADER_SIZE; i < binLength; i += UPGRADE_CHUNK_SIZE) {
      await delay(2);
      const chunk = firmware.slice(i, i + UPGRADE_CHUNK_SIZE);
      await downloadFirmwareData(chunk, SEND_SIZE, 0x02, firmware);

      downloadLen += chunk.length;
      const percentage = Math.floor((downloadLen / binLength) * 100);
      updateStatus(`${t("1232")}: ${downloadLen}/${binLength}`, percentage);
    }
    const finalResponse = await waitForAck(5000);
    if (finalResponse[0] !== 0xFF || finalResponse[1] !== 0x70 || finalResponse[2] !== 0x03) {
      throw new Error(t("1265") || "固件上传完成失败");
    }
    
    // 移除监听器
    remove8kUpgradeListener();
    
    updateStatus(t("1234"), 100, undefined, 'normal'); // "升级完成！"
  };

  // 开始升级
  const startUpgrade = async () => {
    if (!connectedKeyboard) {
      updateStatus(t("1261") || "设备未连接", 0, t("1266") || "请先连接设备", 'error');
      return;
    }

    try {
      setUpgradeState(prev => ({ ...prev, isUpgrading: true, error: undefined }));

      // 加载固件
      updateStatus(t("1254"), 5); // "加载固件文件..."
      const firmware = firmwareData || await loadFirmware();
      setFirmwareData(firmware);

      // 执行升级
      await upgradeProcess(firmware);

      // 升级成功，等待 2 秒后刷新页面
      await delay(2000);
      window.location.reload();

    } catch (error: any) {
      // 升级失败，移除监听器
      remove8kUpgradeListener();
      updateStatus(`${t("1235")}: ${error.message}`, 0, error.message, 'error'); // "升级失败"
    } finally {
      setUpgradeState(prev => ({ ...prev, isUpgrading: false }));
    }
  };

  const handleClose = () => {
    if (!upgradeState.isUpgrading) {
      onClose();
    }
  };

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
              ⌨️
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontSize: '20px', fontWeight: 600, mb: 0.3 }}>
                {t("1259") || "键盘固件升级"}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '11px' }}>
                {t("1260") || "基于 WebHID 的键盘固件升级工具"}
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
                border: `1px solid ${connectedKeyboard ? primaryColor : (isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)')}`,
                borderRadius: '12px',
                textAlign: 'center',
              }}
            >
              <Typography
                sx={{
                  color: connectedKeyboard ? primaryColor : 'text.disabled',
                  fontSize: '14px',
                  fontWeight: 600,
                  marginBottom: connectedKeyboard ? '16px !important' : '0',
                }}
              >
                {connectedKeyboard ? `✅ ${t("1258")}` : `⏳ ${t("1261") || "等待设备连接"}`}
              </Typography>

              {connectedKeyboard && (
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
                        {keyboard?.deviceName || connectedKeyboard.productName}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        VID:PID
                      </Typography>
                      <Typography sx={{ color: 'text.primary', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace' }}>
                        {keyboard?.deviceVID?.toString(16).toUpperCase().padStart(4, '0')}:
                        {keyboard?.devicePID?.toString(16).toUpperCase().padStart(4, '0')}
                      </Typography>
                    </Box>
                    {keyboard?.deviceVersion && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {t("1206")} {/* 当前版本 */}
                        </Typography>
                        <Typography sx={{ color: 'text.primary', fontSize: '12px', fontWeight: 600 }}>
                          v{keyboard.deviceVersion}
                        </Typography>
                      </Box>
                    )}
                    {keyboard?.deviceUpgradeVersion && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography sx={{ color: 'text.secondary', fontSize: '12px' }}>
                          {t("1207")} {/* 升级版本 */}
                        </Typography>
                        <Typography sx={{ color: primaryColor, fontSize: '13px', fontWeight: 700 }}>
                          v{keyboard.deviceUpgradeVersion}
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
              <AlertTitle sx={{ fontSize: '14px' }}>{t("1219")}</AlertTitle>
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
            disabled={upgradeState.isUpgrading || !connectedKeyboard}
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

export default KeyboardFirmwareUpgrade;
