'use client';

import { useContext, useEffect, useState } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { MainContext } from '@/providers/MainProvider';
import { useTranslation } from '@/app/i18n';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { connectScreenLcdWebHid } from '@/lib/screenLcdWebHidConnect';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { notifyFirmwareUpdateAfterScreenConnect } from '@/utils/postScreenConnectFirmwareHint';
import type { ConnectScreenHidResult, FilterDevice } from '@/types/types';

/** 直接 PNG：<img> 加载带外链的 SVG 时内嵌图常被浏览器拦截 */
const KEYBOARD_IMG = '/screen-auth-keyboard-source.png';
/** 与 `screen-auth-keyboard-source.png` 像素尺寸一致（避免 flex 挤压导致「看起来没变」） */
const KEYBOARD_W = 751;
const KEYBOARD_H = 466;

type HomePageProps = {
    onAuthorized?: () => void;
};

export default function HomePage({ onAuthorized }: HomePageProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { connectDevice } = useContext(MainContext);
    const { onChangeTab, requestSettingsFirmwareTab } = useContext(EditorContext);
    const { t } = useTranslation('common');
    const { connectedKeyboard, keyboard } = useContext(ConnectKbContext);
    const { showFirmwareUpdateCard } = useSnackbarDialog();

    const [isConnecting, setIsConnecting] = useState(false);
    const [isOpeningDevice, setIsOpeningDevice] = useState(false);
    const [openingDots, setOpeningDots] = useState(0);

    useEffect(() => {
        if (!isOpeningDevice) return;
        const timer = setInterval(() => {
            setOpeningDots((prev) => (prev + 1) % 3);
        }, 500);
        return () => clearInterval(timer);
    }, [isOpeningDevice]);

    const connect = async () => {
        if (isConnecting || isOpeningDevice || !connectedKeyboard) return;
        const result = await connectScreenLcdWebHid(
            connectDevice as (filter: FilterDevice[] | undefined) => Promise<ConnectScreenHidResult>,
            connectedKeyboard,
            {
                setOpening: setIsOpeningDevice,
                setConnecting: setIsConnecting,
                onStartLightSequence: () => setOpeningDots(0),
            },
        );
        if (!result.success) return;
        onAuthorized?.();
        const demo = connectedKeyboard.api?.address === 'demo';
        notifyFirmwareUpdateAfterScreenConnect({
            screenInfo: result.screenInfo,
            fwVid: connectedKeyboard.vendorId ?? 0,
            fwPid: connectedKeyboard.productId ?? 0,
            firmwareChangelogKeySegment: keyboard?.deviceBaseInfo?.keyboardID ?? 0,
            keyboardNeedsUpgrade: keyboard?.deviceNeedsUpgrade,
            keyboardDeviceVersion: keyboard?.deviceVersion,
            keyboardUpgradeVersion: keyboard?.deviceUpgradeVersion,
            demoSession: demo,
            showFirmwareUpdateCard,
            onNavigateToSettingsFirmware: () => {
                onChangeTab('settings');
                requestSettingsFirmwareTab();
            },
            t,
        });
    };

    const connectLabel = isConnecting
        ? '连接中...'
        : isOpeningDevice
          ? `${t('2725')}${'.'.repeat(openingDots + 1)}`
          : t('16');

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                py: 2,
            }}
        >
            {/* 整体卡片：浅灰底 + 轻阴影 + 圆角（与参考图一致） */}
            <Box
                sx={{
                    width: '100%',
                    maxWidth: 'min(1120px, calc(100vw - 32px))',
                    mx: 3,
                    borderRadius: '16px',
                    p: '20px',
                    boxSizing: 'border-box',
                    ...(isDark
                        ? {
                              background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha('#131316', 1)} 100%)`,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                              boxShadow: `0 4px 28px ${alpha('#000', 0.45)}`,
                          }
                        : {
                              background: 'linear-gradient(180deg, #FAFBFC 0%, #F2F4F7 48%, #EEF1F4 100%)',
                              border: '1px solid rgba(226, 232, 240, 0.85)',
                              boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
                          }),
                }}
            >
                {/* 上：键盘区（固定 751×466，不被 flex 压缩）+ 渐变卡 */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: { xs: '16px', sm: '24px' },
                        minHeight: `${KEYBOARD_H}px`,
                        width: '100%',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        boxSizing: 'border-box',
                        justifyContent: 'space-around',
                    }}
                >
                    <Box
                        sx={{
                            flex: '0 0 auto',
                            width: `${KEYBOARD_W}px`,
                            height: `${KEYBOARD_H}px`,
                            borderRadius: '14px',
                            boxSizing: 'border-box',
                            ...(isDark
                                ? {
                                      bgcolor: alpha(theme.palette.common.white, 0.06),
                                      boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.12)}, inset 0 1px 0 ${alpha(theme.palette.common.white, 0.04)}`,
                                  }
                                : {
                                      bgcolor: 'rgba(255, 255, 255, 0.72)',
                                      boxShadow:
                                          'inset 0 0 0 1px #E8ECF0, inset 0 1px 0 rgba(255, 255, 255, 0.95)',
                                  }),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Box
                            component="img"
                            src={KEYBOARD_IMG}
                            alt=""
                            aria-hidden
                            width={KEYBOARD_W}
                            height={KEYBOARD_H}
                            sx={{
                                width: `${KEYBOARD_W}px`,
                                height: `${KEYBOARD_H}px`,
                                display: 'block',
                                objectFit: 'contain',
                                userSelect: 'none',
                                pointerEvents: 'none',
                                outline: 'none',
                                border: 0,
                                verticalAlign: 'top',
                                filter: isDark ? 'brightness(0.88) contrast(1.08)' : 'none',
                            }}
                        />
                    </Box>

                    <Box
                        sx={{
                            position: 'relative',
                            flexShrink: 0,
                            width: '244px',
                            height: '466px',
                            borderRadius: '22px',
                            overflow: 'hidden',
                            ...(isDark
                                ? {
                                      border: `1px solid ${alpha(theme.palette.common.white, 0.14)}`,
                                      boxShadow: `0 12px 40px ${alpha('#000', 0.5)}`,
                                      background:
                                          'linear-gradient(145deg, #4a6bb8 0%, #2d3340 32%, #8b5348 55%, #1e1e24 72%, #3d5588 100%)',
                                  }
                                : {
                                      border: '1px solid rgba(255, 255, 255, 0.95)',
                                      boxShadow: '0 10px 36px rgba(100, 116, 139, 0.2)',
                                      background:
                                          'linear-gradient(145deg, #6B93F0 0%, #E8ECF4 28%, #F6A08E 52%, #FDFDFE 68%, #5A82E8 100%)',
                                  }),
                        }}
                    >
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                opacity: isDark ? 0.32 : 0.38,
                                backgroundImage:
                                    'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                                mixBlendMode: isDark ? 'soft-light' : 'overlay',
                                pointerEvents: 'none',
                            }}
                        />
                    </Box>
                </Box>

                {/* 下：略缩进白底条 + 轻阴影（相对主卡片左右留一点边） */}
                <Box
                    sx={{
                        mt: '14px',
                        mx: '2px',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: '12px',
                        px: '20px',
                        py: '14px',
                        boxSizing: 'border-box',
                        ...(isDark
                            ? {
                                  bgcolor: theme.palette.background.paper,
                                  border: `1px solid ${alpha(theme.palette.common.white, 0.1)}`,
                                  boxShadow: `0 2px 16px ${alpha('#000', 0.35)}`,
                              }
                            : {
                                  bgcolor: '#FFFFFF',
                                  boxShadow: '0 2px 14px rgba(15, 23, 42, 0.05)',
                              }),
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '20px',
                            fontWeight: 500,
                            color: isDark ? theme.palette.text.secondary : '#5F6368',
                            lineHeight: 1.35,
                            letterSpacing: '0.01em',
                        }}
                    >
                        {t('10')}
                    </Typography>

                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => void connect()}
                        disabled={isConnecting || isOpeningDevice || !connectedKeyboard}
                        sx={{
                            minWidth: '213px',
                            height: '36px',
                            px: '22px',
                            py: 0,
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontSize: '14px',
                            fontWeight: 500,
                            bgcolor: isDark ? theme.palette.primary.main : '#4A90E2',
                            color: theme.palette.primary.contrastText,
                            boxShadow: 'none',
                            '&:hover': {
                                bgcolor: isDark ? theme.palette.primary.dark : '#3d7fd4',
                                boxShadow: 'none',
                            },
                            '&.Mui-disabled': {
                                bgcolor: isDark
                                    ? alpha(theme.palette.primary.main, 0.4)
                                    : 'rgba(74, 144, 226, 0.45)',
                                color: alpha(theme.palette.common.white, 0.9),
                            },
                        }}
                    >
                        {connectLabel}
                    </Button>
                </Box>
            </Box>
        </Box>
    );
}
