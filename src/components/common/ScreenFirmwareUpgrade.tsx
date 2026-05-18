'use client';

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from '@/app/i18n';
import { lightingPanelCardSx } from '@/constants/lightingPanelChrome';
import { WebHidUpgradeClient, type KeyboardLightOffCapable } from '@/lib/webhidScreenUpgrade';
import { connectScreenLcdWebHid } from '@/lib/screenLcdWebHidConnect';
import type { DeviceComm } from '@/LEDdevices/LCDScreenDevice';
import { MainContext } from '@/providers/MainProvider';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import type { KeyboardDevice } from '@/devices/KeyboardDevice';
import type { FilterDevice, ConnectScreenHidResult } from '@/types/types';


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
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation('common');
  const { setDownLoad, setIsDownloading, connectDevice, setScreenFirmwareOtaBlocking } =
    useContext(MainContext);
  const { showDialog, showMessage } = useSnackbarDialog();

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
      const result = await connectScreenLcdWebHid(
        connectDevice as (filter: FilterDevice[] | undefined) => Promise<ConnectScreenHidResult>,
        keyboardForScreen ?? null,
        {
          setOpening: setIsOpeningLcd,
          setConnecting: setIsConnectingLcd,
          onStartLightSequence: () => setOpeningDots(0),
        }
      );
      if (result.success) {
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
        error: t('2882'),
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

  const P = theme.palette.primary.main;
  const trackBg = isLightMode ? 'rgba(0, 0, 0, 0.06)' : alpha(theme.palette.common.white, 0.1);

  /** 与 OTA 流程阈值一致：≥34 为数据传输阶段；≥97 为收尾，展示「固件写入完成」 */
  const P_PREP_END = 34;
  const P_FINAL = 97;

  const progressHeadlineLeft = useMemo(() => {
    if (upgradeState.statusType === 'error') return upgradeState.status;
    if (upgradeState.isUpgrading) {
      const p = Math.round(upgradeState.progress);
      if (p >= 100 || p >= P_FINAL) return t('2884');
      if (p >= P_PREP_END) return t('2848');
      return upgradeState.status;
    }
    return t('1208');
  }, [
    upgradeState.isUpgrading,
    upgradeState.progress,
    upgradeState.status,
    upgradeState.statusType,
    t,
  ]);

  const progressRowTextColor =
    upgradeState.statusType === 'error'
      ? 'error.main'
      : upgradeState.statusType === 'warning'
        ? 'warning.main'
        : 'text.secondary';

  const progressAccentColor =
    upgradeState.statusType === 'error' ? theme.palette.error.main : P;

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
          bgcolor: theme.palette.background.paper,
          backdropFilter: isLightMode ? 'blur(20px)' : 'none',
          border: `1px solid ${
            isDark ? alpha(P, 0.48) : 'rgba(15, 23, 42, 0.08)'
          }`,
          borderRadius: '18px',
          p: '32px !important',
          boxShadow: isLightMode
            ? '0 24px 64px rgba(15, 23, 42, 0.12)'
            : '0 24px 64px rgba(0, 0, 0, 0.55)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: '24px',
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
            {t('2800')}
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
                flexShrink: 0,
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
          {!lcdConnected ? (
            <Alert
              severity="warning"
              sx={{
                borderRadius: '12px',
                ...(isDark
                  ? {
                      bgcolor: alpha(theme.palette.warning.main, 0.12),
                      border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                      color: alpha(theme.palette.common.white, 0.88),
                      '& .MuiAlert-icon': { color: theme.palette.warning.main },
                    }
                  : {}),
              }}
            >
              <AlertTitle sx={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.4 }}>{t('1210')}</AlertTitle>
              <Typography sx={{ fontSize: '14px', lineHeight: 1.7, mb: 1.25, color: 'text.secondary' }}>
                {t('2856', { connect: t('16') })}
              </Typography>
              <ButtonRem
                type="button"
                onClick={handleConnectLcd}
                disabled={upgradeState.isUpgrading || isConnectingLcd || isOpeningLcd}
                sx={{
                  textTransform: 'none',
                  minHeight: '40px',
                  px: '22px',
                  fontSize: '15px',
                  fontWeight: 600,
                  color: theme.palette.primary.contrastText,
                  bgcolor: P,
                  border: `1px solid ${P}`,
                  borderRadius: '8px',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: theme.palette.primary.dark, borderColor: theme.palette.primary.dark },
                  '&.Mui-disabled': {
                    color: alpha(theme.palette.primary.contrastText, 0.75),
                    bgcolor: isDark ? alpha(P, 0.45) : '#93c5fd',
                    borderColor: isDark ? alpha(P, 0.45) : '#93c5fd',
                  },
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
                ...lightingPanelCardSx(theme),
                ...(lcdConnected
                  ? {}
                  : {
                      border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.55 : 0.45)}`,
                    }),
              }}
            >
              <Typography
                sx={{
                  color: lcdConnected ? 'primary.main' : 'warning.main',
                  fontSize: '15px',
                  fontWeight: 600,
                  lineHeight: 1.45,
                  textAlign: 'center',
                  mb: deviceInfo?.currentVersion || deviceInfo?.upgradeVersion ? '16px' : 0,
                }}
              >
                {lcdConnected ? t('2854') : t('2855', { connect: t('16') })}
              </Typography>
              {(deviceInfo?.currentVersion || deviceInfo?.upgradeVersion) && (
                <Stack
                  spacing={1}
                  sx={{
                    pt: '16px',
                    borderTop: `1px solid ${
                      isDark ? alpha(theme.palette.common.white, 0.1) : 'rgba(0,0,0,0.08)'
                    }`,
                  }}
                >
                  {deviceInfo?.currentVersion ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                        {t('1206')}
                      </Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'text.primary', letterSpacing: '0.02em' }}>
                        v{deviceInfo.currentVersion}
                      </Typography>
                    </Box>
                  ) : null}
                  {deviceInfo?.upgradeVersion ? (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                      <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                        {t('1207')}
                      </Typography>
                      <Typography sx={{ fontSize: '14px', fontWeight: 700, color: 'primary.main', letterSpacing: '0.02em' }}>
                        v{deviceInfo.upgradeVersion}
                      </Typography>
                    </Box>
                  ) : null}
                </Stack>
              )}
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
            {upgradeState.isUpgrading ? (
              <Typography
                sx={{
                  fontSize: '20px',
                  fontWeight: 500,
                  lineHeight: 1.55,
                  color: 'text.secondary',
                }}
              >
                {t('2883')}
              </Typography>
            ) : null}
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', minHeight: 44 }}>
              <Box
                sx={{
                  width: 3,
                  flexShrink: 0,
                  borderRadius: '0 2px 2px 0',
                }}
              />
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
                    color: progressRowTextColor,
                    fontSize: '20px',
                    fontWeight: 500,
                    lineHeight: 1.45,
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {progressHeadlineLeft}
                </Typography>
                <Typography
                  sx={{
                    color: progressRowTextColor,
                    fontSize: '20px',
                    fontWeight: 500,
                    lineHeight: 1.45,
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {Math.min(100, Math.max(0, Math.round(upgradeState.progress)))}%
                </Typography>
              </Box>
            </Box>
            <Box sx={{ px: '14px', mt: '12px' }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, Math.max(0, upgradeState.progress))}
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
                          : P,
                    borderRadius: '999px',
                  },
                }}
              />
            </Box>
          </Box>

          {upgradeState.error ? (
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
              <AlertTitle sx={{ fontSize: '15px', fontWeight: 700 }}>{t('1219')}</AlertTitle>
              <Typography sx={{ fontSize: '14px', lineHeight: 1.65, color: 'text.secondary' }}>
                {upgradeState.error}
              </Typography>
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
                {t('2920')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('2921')}
              </Typography>
              <Typography sx={{ color: 'error.main', fontSize: '14px', lineHeight: 1.7, fontWeight: 600 }}>
                {t('2922')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('2923')}
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', lineHeight: 1.7, fontWeight: 400 }}>
                {t('2924')}
              </Typography>
            </Stack>
          </Paper>

          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={upgradeState.done ? handleClose : runUpgrade}
            disabled={upgradeState.isUpgrading || !firmwareBytes || !lcdConnected}
            sx={{
              py: '13px',
              minHeight: 48,
              textTransform: 'none',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '16px',
              lineHeight: 1.35,
              borderRadius: '12px',
              boxShadow: `0 8px 24px ${alpha(P, 0.35)}`,
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
            {upgradeState.done ? t('1218') : t('1217')}
          </Button>
        </Stack>
      </Paper>
    </Modal>
  );
}
