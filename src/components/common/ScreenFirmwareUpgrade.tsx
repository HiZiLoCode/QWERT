'use client';

import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Modal,
  Paper,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '@/app/i18n';
import { WebHidUpgradeClient, type KeyboardLightOffCapable } from '@/lib/webhidScreenUpgrade';
import { connectScreenLcdWebHid } from '@/lib/screenLcdWebHidConnect';
import type { DeviceComm } from '@/LEDdevices/LCDScreenDevice';
import { MainContext } from '@/providers/MainProvider';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import type { KeyboardDevice } from '@/devices/KeyboardDevice';
import type { FilterDevice } from '@/types/types';

declare global {
  interface Navigator {
    hid?: HID;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface UpgradeState {
  isUpgrading: boolean;
  progress: number;
  status: string;
  /** 副标题：当前子阶段、百分比等 */
  detail?: string;
  error?: string;
  statusType?: 'normal' | 'warning' | 'error';
  done: boolean;
}

export interface ScreenFirmwareUpgradeProps {
  isOpen: boolean;
  onClose: () => void;
  /** 与动效页「立即连接」一致：已建立 deviceComm 且设备在线 */
  lcdConnected: boolean;
  deviceInfo?: {
    firmwareFile: string;
    /** 若配置且能成功下载则与固件一并升级；否则仅升固件 */
    imageFile?: string;
    currentVersion?: string;
    upgradeVersion?: string;
    vendorId?: number;
    productId?: number;
  };
  /** 已连接的屏幕 HID：有则经 deviceComm 进入 OTA，不再系统弹窗选择键盘 */
  screenDeviceComm?: DeviceComm;
  /** 退出 OTA 时 0xe1 发往键盘 HID（与屏幕 deviceComm 分离） */
  keyboardHidForExit?: HIDDevice;
  /** 退出时灭屏：KeyboardDevice.lightOff */
  keyboardForLightOff?: KeyboardLightOffCapable;
  /** 与设置页固件说明区一致：弹窗内「立即连接」走 checkLightStatus / lightOn + WebHID */
  keyboardForScreen?: KeyboardDevice;
}

export default function ScreenFirmwareUpgrade({
  isOpen,
  onClose,
  lcdConnected,
  deviceInfo,
  screenDeviceComm,
  keyboardHidForExit,
  keyboardForLightOff,
  keyboardForScreen,
}: ScreenFirmwareUpgradeProps) {
  const theme = useTheme();
  const isLightMode = theme.palette.mode === 'light';
  const { t } = useTranslation('common');
  const { setDownLoad, setIsDownloading, connectDevice, setScreenFirmwareOtaBlocking } =
    useContext(MainContext);
  const { showDialog, showMessage } = useSnackbarDialog();
  const primaryColor = theme.palette.primary.main;

  const clientRef = useRef<WebHidUpgradeClient | null>(null);
  const lcdConnectLockRef = useRef(false);
  const [isConnectingLcd, setIsConnectingLcd] = useState(false);
  const [isOpeningLcd, setIsOpeningLcd] = useState(false);
  const [openingDots, setOpeningDots] = useState(0);

  const [upgradeState, setUpgradeState] = useState<UpgradeState>({
    isUpgrading: false,
    progress: 0,
    status: t('1208'),
    detail: undefined,
    statusType: 'normal',
    done: false,
  });
  const [firmwareBytes, setFirmwareBytes] = useState<Uint8Array | null>(null);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);

  const resetState = useCallback(() => {
    setUpgradeState({
      isUpgrading: false,
      progress: 0,
      status: t('1208'),
      detail: undefined,
      statusType: 'normal',
      done: false,
    });
    setFirmwareBytes(null);
    setImageBytes(null);
  }, [t]);

  useEffect(() => {
    if (!isOpen) {
      clientRef.current?.closeAll();
      clientRef.current = null;
      return;
    }
    resetState();
    const fwPath = deviceInfo?.firmwareFile;
    const imgPath = deviceInfo?.imageFile?.trim();
    if (!fwPath) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(fwPath);
        if (!res.ok) throw new Error(`${t('1241')} ${fwPath.split('/').pop() || fwPath}`);
        const fw = new Uint8Array(await res.arrayBuffer());
        if (fw.length === 0) throw new Error(t('1242'));

        let img: Uint8Array | null = null;
        if (imgPath) {
          try {
            const ir = await fetch(imgPath);
            if (ir.ok) {
              const buf = new Uint8Array(await ir.arrayBuffer());
              if (buf.length > 0) img = buf;
            }
          } catch {
            img = null;
          }
        }

        if (!cancelled) {
          setFirmwareBytes(fw);
          setImageBytes(img);
          setUpgradeState((s) => ({
            ...s,
            status: img?.length ? t('2863') : t('2862'),
            statusType: 'normal',
            progress: 0,
          }));
        }
      } catch (e) {
        if (!cancelled) {
          setUpgradeState((s) => ({
            ...s,
            statusType: 'error',
            error: (e as Error).message,
            status: t('2850'),
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
      clientRef.current?.closeAll();
      clientRef.current = null;
    };
  }, [isOpen, deviceInfo?.firmwareFile, deviceInfo?.imageFile, resetState, t]);

  useEffect(() => {
    if (!isOpeningLcd) return;
    const timer = setInterval(() => {
      setOpeningDots((prev) => (prev + 1) % 3);
    }, 500);
    return () => clearInterval(timer);
  }, [isOpeningLcd]);

  const handleConnectLcd = useCallback(async () => {
    if (lcdConnectLockRef.current || upgradeState.isUpgrading) return;
    lcdConnectLockRef.current = true;
    try {
      const ok = await connectScreenLcdWebHid(
        connectDevice as (filter: FilterDevice[] | undefined) => Promise<boolean>,
        keyboardForScreen ?? null,
        {
          setOpening: setIsOpeningLcd,
          setConnecting: setIsConnectingLcd,
          onStartLightSequence: () => setOpeningDots(0),
        }
      );
      if (ok) {
        showMessage({ type: 'success', message: t('92') });
      } else {
        showMessage({ type: 'info', message: t('1253') });
      }
    } catch (e) {
      showMessage({
        type: 'error',
        message: e instanceof Error ? e.message : t('1662'),
      });
    } finally {
      lcdConnectLockRef.current = false;
    }
  }, [connectDevice, keyboardForScreen, showMessage, t, upgradeState.isUpgrading]);

  const handleClose = useCallback(() => {
    if (upgradeState.isUpgrading) return;
    clientRef.current?.closeAll();
    clientRef.current = null;
    onClose();
  }, [onClose, upgradeState.isUpgrading]);

  const runUpgrade = useCallback(async () => {
    if (!firmwareBytes?.length || !lcdConnected) return;

    const vid = deviceInfo?.vendorId && deviceInfo.vendorId > 0 ? deviceInfo.vendorId : undefined;
    const pid = deviceInfo?.productId && deviceInfo.productId > 0 ? deviceInfo.productId : undefined;
    const client = new WebHidUpgradeClient({
      ...(vid !== undefined && pid !== undefined ? { keyboardVid: vid, keyboardPid: pid } : {}),
      ...(screenDeviceComm
        ? { screenDeviceComm, keyboardHidForExit, keyboardForLightOff }
        : {}),
    });
    clientRef.current = client;

    const imgLen = imageBytes?.length ?? 0;
    const fwLen = firmwareBytes?.length ?? 0;
    const hasImg = imgLen > 0;
    const hasFwPayload = fwLen > 0;
    /** 预备阶段结束进度；之后为数据传输；再之后收尾 */
    const P_PREP_END = 34;
    const P_XFER_END = 93;
    const P_FINAL = 97;
    const mapXferProgress = (r01: number) =>
      Math.min(100, Math.round(P_PREP_END + Math.min(1, Math.max(0, r01)) * (P_XFER_END - P_PREP_END)));
    const xferDetail = (r01: number) => {
      const clamp01 = Math.min(1, Math.max(0, r01));
      if (hasImg && hasFwPayload) {
        if (clamp01 <= 0.5) {
          const sub = clamp01 / 0.5;
          return t('2875', { pct: Math.round(sub * 100) });
        }
        const sub = (clamp01 - 0.5) / 0.5;
        return t('2876', { pct: Math.round(sub * 100) });
      }
      if (hasImg) return t('2875', { pct: Math.round(clamp01 * 100) });
      return t('2876', { pct: Math.round(clamp01 * 100) });
    };

    // 同步 ref，早于 setState/setDownLoad，避免心跳 tick 与 OTA 抢同一 HID OUT 锁（bulk 前无 IN 属正常）
    setScreenFirmwareOtaBlocking?.(true);
    setDownLoad(true);
    setIsDownloading(true);
    setUpgradeState((s) => ({
      ...s,
      isUpgrading: true,
      error: undefined,
      statusType: 'normal',
      done: false,
      progress: 2,
      status: screenDeviceComm ? t('2871') : t('2844'),
      detail: screenDeviceComm ? t('2871') : t('2844'),
    }));

    // 与 ScreenTheme 一致：禁止 MainProvider 对 deviceComm 轮询 0x1C/0x1A，否则会与 OTA 同 HID 冲突导致失败
    try {
      if (!screenDeviceComm) {
        setUpgradeState((s) => ({ ...s, progress: 6, status: t('2870'), detail: t('2870') }));
        const kb = await client.requestKeyboardDevice();
        await client.open(kb);
        setUpgradeState((s) => ({ ...s, progress: 10, status: t('2871'), detail: t('2871') }));
      }
      await client.enterUpgradeMode();
      if (screenDeviceComm) {
        setUpgradeState((s) => ({ ...s, progress: 16, status: t('2871'), detail: t('2873') }));
        await sleep(200);
      } else {
        setUpgradeState((s) => ({ ...s, progress: 14, status: t('2871'), detail: t('2872') }));
        await sleep(2000);
        setUpgradeState((s) => ({ ...s, progress: 22, status: t('2873'), detail: t('2873') }));
      }
      await client.requestAndOpenOtaDevice();
      setUpgradeState((s) => ({ ...s, progress: 26, status: t('2873'), detail: t('2873') }));
      setUpgradeState((s) => ({ ...s, progress: 30, status: t('2874'), detail: t('2874') }));
      await client.sendOtaUpgradeCommand0xf0();
      client.startOtaScreenKeepalive();
      setUpgradeState((s) => ({
        ...s,
        progress: P_PREP_END,
        status: t('2848'),
        detail: hasImg && hasFwPayload ? t('2877') : hasImg ? t('2878') : t('2880'),
      }));
      if (hasImg || hasFwPayload) {
        await client.transferImageThenFirmware({
          image: hasImg ? imageBytes : null,
          firmware: firmwareBytes,
          onProgress: (r) => {
            setUpgradeState((s) => ({
              ...s,
              progress: mapXferProgress(r),
              status: t('2848'),
              detail: xferDetail(r),
            }));
          },
        });
      }
      setUpgradeState((s) => ({ ...s, progress: P_FINAL, status: t('2881'), detail: t('2881') }));
      await client.finalizeUpgradeSession();
      clientRef.current = null;
      setUpgradeState({
        isUpgrading: false,
        progress: 100,
        status: t('2849'),
        detail: undefined,
        statusType: 'normal',
        done: true,
      });
      onClose();
      showDialog({
        title: t('2849'),
        content: t('2867'),
        confirmText: t('1111'),
        onConfirm: () => {
          window.location.reload();
        },
        onCancel: () => {},
        confirmOnly: true,
      });
    } catch (e) {
      try {
        await client.finalizeUpgradeSession();
      } catch {
        /* */
      }
      client.closeAll();
      clientRef.current = null;
      setUpgradeState((s) => ({
        ...s,
        isUpgrading: false,
        statusType: 'error',
        error: (e as Error)?.message || String(e),
        status: t('2850'),
        detail: undefined,
        progress: 0,
      }));
    } finally {
      setScreenFirmwareOtaBlocking?.(false);
      setDownLoad(false);
      setIsDownloading(false);
    }
  }, [
    deviceInfo?.vendorId,
    deviceInfo?.productId,
    firmwareBytes,
    imageBytes,
    lcdConnected,
    screenDeviceComm,
    keyboardHidForExit,
    keyboardForLightOff,
    onClose,
    setDownLoad,
    setIsDownloading,
    setScreenFirmwareOtaBlocking,
    showDialog,
    t,
  ]);

  const borderMuted = isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
  const borderOk = 'rgba(76, 175, 80, 0.55)';
  const borderWarn = isLightMode ? 'rgba(245, 158, 11, 0.45)' : 'rgba(251, 191, 36, 0.35)';

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          maxHeight: '90vh',
          overflow: 'auto',
          bgcolor: isLightMode ? 'rgba(250, 250, 252, 0.98)' : 'rgba(40, 40, 52, 0.98)',
          backdropFilter: 'blur(20px)',
          border: `1px solid ${isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}`,
          borderRadius: '18px',
          p: '2rem !important',
          boxShadow: isLightMode
            ? '0 24px 64px rgba(15, 23, 42, 0.12)'
            : '0 24px 64px rgba(0, 0, 0, 0.45)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: '1.75rem',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, minWidth: 0 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.75rem',
                flexShrink: 0,
                background: isLightMode
                  ? 'linear-gradient(145deg, rgba(59,130,246,0.12), rgba(59,130,246,0.04))'
                  : 'linear-gradient(145deg, rgba(99,102,241,0.25), rgba(30,27,75,0.5))',
                border: `1px solid ${isLightMode ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              🖥
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 }}>
                {t('2800')}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.75rem', display: 'block', mt: 0.35 }}>
                WebHID OTA · 0x1919
              </Typography>
            </Box>
          </Box>
          {!upgradeState.isUpgrading && (
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{
                flexShrink: 0,
                '&:hover': {
                  bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.06)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          )}
        </Box>

        <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '1.5rem !important' } }}>
          {!lcdConnected ? (
            <Alert severity="warning" sx={{ borderRadius: '12px' }}>
              <AlertTitle sx={{ fontSize: '0.9rem', fontWeight: 700 }}>{t('1210')}</AlertTitle>
              <Typography sx={{ fontSize: '0.8125rem', lineHeight: 1.65, mb: 1.25 }}>
                {t('2856', { connect: t('16') })}
              </Typography>
              <ButtonRem
                type="button"
                onClick={handleConnectLcd}
                disabled={upgradeState.isUpgrading || isConnectingLcd || isOpeningLcd}
                sx={{
                  textTransform: 'none',
                  height: '2.25rem',
                  px: '1.25rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#fff',
                  bgcolor: '#3B82F6',
                  border: '0.0625rem solid #3B82F6',
                  borderRadius: '0.5rem',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#2f70dc', borderColor: '#2f70dc' },
                  '&.Mui-disabled': { color: 'rgba(255,255,255,0.75)', bgcolor: '#93c5fd', borderColor: '#93c5fd' },
                }}
              >
                {isConnectingLcd
                  ? t('151')
                  : isOpeningLcd
                    ? `${t('2725')}${'.'.repeat(openingDots + 1)}`
                    : t('16')}
              </ButtonRem>
            </Alert>
          ) : null}

          <Box>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: '0.75rem', color: 'text.primary' }}>
              📱 {t('1202')}
            </Typography>
            <Paper
              sx={{
                p: '1.25rem !important',
                bgcolor: isLightMode ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.28)',
                border: `1px solid ${lcdConnected ? borderOk : borderWarn}`,
                borderRadius: '14px',
              }}
            >
              <Typography
                sx={{
                  color: lcdConnected ? 'success.main' : 'warning.main',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  mb: deviceInfo?.currentVersion || deviceInfo?.upgradeVersion ? '1rem' : 0,
                }}
              >
                {lcdConnected ? `✅ ${t('2854')}` : `⚠️ ${t('2855', { connect: t('16') })}`}
              </Typography>
              {(deviceInfo?.currentVersion || deviceInfo?.upgradeVersion) && (
                <Stack
                  spacing={1}
                  sx={{
                    pt: '1rem',
                    borderTop: `1px solid ${isLightMode ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {deviceInfo?.currentVersion ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{t('1206')}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>v{deviceInfo.currentVersion}</Typography>
                    </Box>
                  ) : null}
                  {deviceInfo?.upgradeVersion ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{t('1207')}</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: primaryColor }}>
                        v{deviceInfo.upgradeVersion}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              )}
            </Paper>
          </Box>

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '0.75rem' }}>
              <Typography
                sx={{
                  color:
                    upgradeState.statusType === 'error'
                      ? 'error.main'
                      : upgradeState.statusType === 'warning'
                        ? 'warning.main'
                        : 'text.primary',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                }}
              >
                {upgradeState.status}
              </Typography>
              <Typography sx={{ color: primaryColor, fontSize: '0.875rem', fontWeight: 700 }}>
                {Math.min(100, Math.max(0, Math.round(upgradeState.progress)))}%
              </Typography>
            </Box>
            {upgradeState.isUpgrading && upgradeState.detail ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  mb: '0.65rem',
                  color: 'text.secondary',
                  fontSize: '0.72rem',
                  lineHeight: 1.55,
                  opacity: 0.92,
                }}
              >
                {upgradeState.detail}
              </Typography>
            ) : null}
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, upgradeState.progress))}
              sx={{
                height: 9,
                borderRadius: '8px',
                bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
                '& .MuiLinearProgress-bar': {
                  bgcolor:
                    upgradeState.statusType === 'error'
                      ? 'error.main'
                      : upgradeState.statusType === 'warning'
                        ? 'warning.main'
                        : primaryColor,
                  borderRadius: '8px',
                },
              }}
            />
          </Box>

          {upgradeState.error ? (
            <Alert severity="error" sx={{ borderRadius: '12px' }}>
              <AlertTitle sx={{ fontSize: '0.9rem' }}>{t('1219')}</AlertTitle>
              <Typography sx={{ fontSize: '0.8125rem' }}>{upgradeState.error}</Typography>
            </Alert>
          ) : null}

          <Paper
            sx={{
              p: '1.25rem !important',
              bgcolor: isLightMode ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.28)',
              border: `1px solid ${borderMuted}`,
              borderRadius: '14px',
            }}
          >
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, mb: '1rem !important', color: 'text.primary' }}>
              ⚠️ {t('1210')}
            </Typography>
            <Stack sx={{ '& > *:not(:last-child)': { marginBottom: '0.75rem !important' } }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.65 }}>
                {t('1211')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.65 }}>
                {t('1212')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.65 }}>
                {t('1213')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.65 }}>
                {t('1214')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.75rem', lineHeight: 1.65 }}>
                {t('2733')}
              </Typography>
            </Stack>
          </Paper>

          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={upgradeState.done ? handleClose : runUpgrade}
            disabled={upgradeState.isUpgrading || !firmwareBytes || !lcdConnected}
            sx={{
              py: 1.35,
              textTransform: 'none',
              bgcolor: upgradeState.done ? '#4caf50' : primaryColor,
              color: '#000 !important',
              fontWeight: 700,
              fontSize: '0.9375rem',
              borderRadius: '12px',
              boxShadow: upgradeState.done
                ? '0 6px 20px rgba(76, 175, 80, 0.35)'
                : `0 8px 24px ${primaryColor}40`,
              '&:hover': {
                bgcolor: upgradeState.done ? '#43a047' : primaryColor,
                filter: 'brightness(1.04)',
              },
              '&:disabled': {
                bgcolor: isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                color: `${isLightMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)'} !important`,
                boxShadow: 'none',
              },
            }}
          >
            {upgradeState.done ? `✅ ${t('1218')}` : `🚀 ${t('1217')}`}
          </Button>
        </Stack>
      </Paper>
    </Modal>
  );
}
