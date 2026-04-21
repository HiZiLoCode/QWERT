'use client';

import { Box, Button, Popover, Stack, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useCallback, useContext, useEffect, useMemo, useState, type MouseEvent } from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import MacroTravelAdjustView from '@/components/MacroTravelAdjustView';
import LightSettingPanel from '@/components/KeyBoardPanel/LightSettingPanel';
import KeyMappingPanel from '@/components/KeyBoardPanel/KeyMappingPanel';
import LayoutPanel from '@/components/KeyBoardPanel/LayoutPanel';
import { throttle } from 'lodash';
import { QMK_KeyboardDevice } from '@/devices/QMK/QMK_KeyboardDevice';
import { KeyboardDevice } from '@/devices/KeyboardDevice';
import { KeyboardAPI } from '@/devices/KeyboardAPI';
import { ScreenThemePage } from '@/components/ScreenTheme';
import HomePage from '@/components/GIFHome/HomePage';
import { EditorContext } from '@/providers/EditorProvider';
import { deviceInfo, isDeviceInDeviceInfo } from '@/config/deviceInfo';
import { MainContext } from '@/providers/MainProvider';
import { useTranslation } from '@/app/i18n';

/** 对齐 ticktype0407CodeNew `keyboard.tsx` + `common/layout` SidePanel + `common/menu` Submenu（本文件使用 px） */
const KP = {
    /** 与主内容区间距截图：约 24–32px */
    containerGap: 28,
    mainPaddingRight: 0,
    sideWidth: 250,
    sideWidthMd: 200,
    sideBreakpoint: 1700,
    sideColumnGap: 24,
    radiusDefault: 14,
    overlayBg: 'rgba(230, 230, 230, 0.5)',
    overlayBlur: '10px',
    titleFont: { fontSize: 14, fontWeight: 500 as const },
    titleColor: '#64748b',
    tipsFont: { fontSize: 14, fontWeight: 400 as const },
    tipsColor: '#91a1b8',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    submenuItemHeight: 48,
    submenuPaddingX: 20,
    submenuGap: 20,
    submenuContainerPaddingY: 20,
    submenuContainerPaddingX: 10,
    submenuContainerGap: 25,
    cardPadding: 20,
    cardInnerGap: 15,
    previewMinHeight: 42,
    popoverWidth: 320,
    dotSize: 8,
} as const;

const sidePanelSx = {
    position: 'relative' as const,
    borderRadius: `${KP.radiusDefault}px`,
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
    border: '1px solid #e5edf7',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
};

interface KeyboardPanelProps {
    onSelectKeyboard?: (keyboard: string) => void;
    onSelectConfig?: () => void;
    onKeyboardSettings?: () => void;
}

function SettingsContent({
    selectedSetting,
    deviceAuthorized,
}: {
    selectedSetting: string;
    deviceAuthorized: boolean;
}) {
    const { t } = useTranslation('common');
    if (selectedSetting === 'macro') {
        return <MacroTravelAdjustView />;
    } else if (selectedSetting === 'lighting') {
        return <LightSettingPanel />;
    } else if (selectedSetting === 'logolighting') {
        return <LightSettingPanel forcedLightType="logolight" />;
    } else if (selectedSetting === 'matrix') {
        return <LightSettingPanel forcedLightType="matrixlight" />;
    } else if (selectedSetting === 'keypress') {
        return <KeyMappingPanel />;
    } else if (selectedSetting === 'layout') {
        return <LayoutPanel />;
    } else if (selectedSetting === 'Led') {
        return deviceAuthorized ? <ScreenThemePage /> : <HomePage />;
    }
    return (
        <Box
            sx={{
                flex: 1,
                borderRadius: `${KP.radiusDefault}px`,
                border: '1px solid rgba(153, 169, 191, 0.25)',
                background: 'rgba(255, 255, 255, 0.42)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Typography sx={{ color: '#71839b' }}>{t('2700')}</Typography>
        </Box>
    );
}

export default function KeyboardPanel({ onSelectKeyboard, onKeyboardSettings }: KeyboardPanelProps) {
    const { t } = useTranslation('common');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const { keyboardData, connectedKeyboard, keyboard, connectKeyboard, setConnectKeyboardStauts } =
        useContext(ConnectKbContext);
    const { deviceStatus } = useContext(MainContext);
    const { selectedSetting, setSelectedSetting } = useContext(EditorContext);
    const { deviceBaseInfo } = keyboard;
    const [previewCandidateIndex, setPreviewCandidateIndex] = useState(0);

    const connectKeyboardNext = useCallback(async () => {
        try {
            await connectKeyboard('tryConnect', true, true);
        } catch (error) {
            console.error(t('2701'), error);
        }
    }, [connectKeyboard, t]);

    const handleSettingSelect = (settingId: string) => {
        setSelectedSetting(settingId);
        onKeyboardSettings?.();
    };

    const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    const handleSelectKeyboard = useMemo(
        () =>
            throttle(
                async (item: any) => {
                    handleCloseMenu();
                    onSelectKeyboard?.(item.id || item.address || item.productName);

                    if (item.devMode === 0 && item.productId === 12290) return;
                    let device: any = new QMK_KeyboardDevice(new KeyboardAPI(item.address, 1));
                    // await device.getProtocolVersion();
                    const version = await device.getProtocolVersion();
                    if (version !== -1 && version) {
                        await keyboard.setKeyboardType('QMK');
                        keyboard.keyboardType = 'QMK';
                    } else {
                        device = new KeyboardDevice(new KeyboardAPI(item.address, item.productId === 12290 ? 1 : 0));
                        await keyboard.setKeyboardType('91683');
                        keyboard.keyboardType = '91683';
                    }
                    await setConnectKeyboardStauts(device, item);
                },
                1000,
                { trailing: false },
            ),
        [setConnectKeyboardStauts, onSelectKeyboard, keyboard],
    );

    const keyboardSettings = useMemo(() => {
        const currentKeyboard = keyboardData.find((item: any) => item.productName === connectedKeyboard?.productName);
        const devMode = currentKeyboard?.devMode ?? 0;
        const vid = connectedKeyboard?.vendorId;
        const pid = connectedKeyboard?.productId;
        const key =
            typeof vid === 'number' && typeof pid === 'number'
                ? `${`0x${vid.toString(16).toUpperCase()}`}_${`0x${pid.toString(16).toUpperCase()}`}_${devMode}`
                : '';
        const keyBoardLayer = key ? !!deviceInfo[key]?.keyBoardLayer : false;

        const tabs = [
            { id: 'keypress', label: t('2702'), keyboardType: true },
            { id: 'layout', label: t('2703'), keyBoardLayer },
            { id: 'lighting', label: t('2704'), keyboardType: true },
            { id: 'logolighting', label: t('2705'), keyboardType: true },
            { id: 'Led', label: t('2706'), keyboardType: !!deviceBaseInfo?.isLed },
            { id: 'matrix', label: t('2707'), keyboardType: !!deviceBaseInfo?.matrixScreen },
        ];
        return tabs.filter((tab) => (tab.keyboardType ?? true) && (tab.keyBoardLayer ?? true));
    }, [connectedKeyboard, keyboardData, deviceBaseInfo, t]);

    const getKeyboardPreviewCandidates = useCallback((vid?: number, pid?: number, devMode: number = 0) => {
        if (typeof vid !== 'number' || typeof pid !== 'number') return [];
        const vidHexUpper = `0x${vid.toString(16).toUpperCase()}`;
        const pidHexUpper = `0x${pid.toString(16).toUpperCase()}`;
        const vidHexLower = `0x${vid.toString(16).toLowerCase()}`;
        const pidHexLower = `0x${pid.toString(16).toLowerCase()}`;
        const vidRawUpper = vid.toString(16).toUpperCase();
        const pidRawUpper = pid.toString(16).toUpperCase();
        const vidRawLower = vid.toString(16).toLowerCase();
        const pidRawLower = pid.toString(16).toLowerCase();
        const candidates = [
            `/keyboard/${vidHexUpper}_${pidHexUpper}_${devMode}.png`,
            `/keyboard/${vidHexUpper}_${pidHexUpper}.png`,
            `/keyboard/${vidHexLower}_${pidHexLower}_${devMode}.png`,
            `/keyboard/${vidHexLower}_${pidHexLower}.png`,
            `/keyboard/${vidRawUpper}_${pidRawUpper}_${devMode}.png`,
            `/keyboard/${vidRawUpper}_${pidRawUpper}.png`,
            `/keyboard/${vidRawLower}_${pidRawLower}_${devMode}.png`,
            `/keyboard/${vidRawLower}_${pidRawLower}.png`,
        ];
        return [...new Set(candidates)];
    }, []);

    const keyboardPreviewCandidates = useMemo(() => {
        const currentKeyboard = keyboardData.find((item: any) => item.productName === connectedKeyboard?.productName);
        const devMode = currentKeyboard?.devMode ?? 0;
        const vid = connectedKeyboard?.vendorId;
        const pid = connectedKeyboard?.productId;
        return getKeyboardPreviewCandidates(vid, pid, devMode);
    }, [connectedKeyboard, keyboardData, getKeyboardPreviewCandidates]);

    /** Popover 中只展示 deviceInfo 已登记的设备 */
    const keyboardDataInConfig = useMemo(
        () =>
            keyboardData.filter((kb: any) =>
                isDeviceInDeviceInfo(kb.vendorId, kb.productId, kb.devMode ?? 0),
            ),
        [keyboardData],
    );

    const keyboardPreviewSrc = keyboardPreviewCandidates[previewCandidateIndex] ?? '';

    useEffect(() => {
        setPreviewCandidateIndex(0);
    }, [keyboardPreviewCandidates]);

    useEffect(() => {
        if (!keyboardSettings.length) return;
        if (!keyboardSettings.some((item) => item.id === selectedSetting)) {
            setSelectedSetting(keyboardSettings[0].id);
        }
    }, [keyboardSettings, selectedSetting, setSelectedSetting]);

    const open = Boolean(anchorEl);

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'stretch',
                gap: `${KP.containerGap}px`,
                pr: `${KP.mainPaddingRight}px`,
                boxSizing: 'border-box',
                minHeight: 0,
            }}
        >
            <Box
                sx={{
                    width: `${KP.sideWidth}px`,
                    flexShrink: 0,
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${KP.sideColumnGap}px`,
                    [`@media (max-width: ${KP.sideBreakpoint}px)`]: {
                        width: `${KP.sideWidthMd}px`,
                    },
                }}
            >
                {anchorEl && (
                    <Box
                        sx={{
                            position: 'fixed',
                            zIndex: 10,
                            pointerEvents: 'all',
                            inset: 0,
                            background: KP.overlayBg,
                            backdropFilter: KP.overlayBlur,
                        }}
                    />
                )}

                <Box
                    sx={{
                        ...sidePanelSx,
                        p: `${KP.cardPadding}px`,
                        cursor: 'pointer',
                        zIndex: 11,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: `${KP.cardInnerGap}px`,
                    }}
                    onClick={handleOpenMenu}
                >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <Typography sx={{ ...KP.titleFont, color: KP.titleColor }}>{t('2708')}</Typography>
                        <ChevronRightOutlinedIcon sx={{ color: '#94a3b8', fontSize: 24 }} />
                    </Box>

                    <Box
                        sx={{
                            width: '100%',
                            height: '84px',
                            borderRadius: '8px',
                            background: 'linear-gradient(180deg, #f8fbff 0%, #f1f6fd 100%)',
                            border: '1px solid #dbe7f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#8ea3bd',
                            fontSize: '11px',
                            overflow: 'hidden',
                        }}
                    >
                        {keyboardPreviewSrc ? (
                            <Box
                                component="img"
                                src={keyboardPreviewSrc}
                                alt={t('2712')}
                                onError={() => setPreviewCandidateIndex((prev) => prev + 1)}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: '#fff',
                                }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Typography sx={{ fontSize: '12px', lineHeight: 1.1, color: '#5f7da3', fontWeight: 600 }}>
                            {connectedKeyboard?.productName || 'QK100 MKII'}
                        </Typography>
                        <Box
                            sx={{
                                width: `${KP.dotSize}px`,
                                height: `${KP.dotSize}px`,
                                borderRadius: '50%',
                                backgroundColor: '#35c27b',
                            }}
                        />
                    </Box>
                </Box>

                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleCloseMenu}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                        sx: {
                            borderRadius: `${KP.radiusDefault}px`,
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                            mt: '8px',
                            width: `${KP.popoverWidth}px`,
                            border: '1px solid #91a1b8',
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
                            cursor: 'default',
                        },
                    }}
                >
                    <Box sx={{ p: '16px' }}>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={connectKeyboardNext}
                            sx={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#ffffff',
                                mb: '10px',
                                background: KP.primary,
                                width: '100%',
                                textTransform: 'none',
                                borderRadius: `${KP.radiusDefault}px`,
                                py: '10px',
                                '&:hover': { background: KP.primaryHover },
                            }}
                        >
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <AddRoundedIcon sx={{ fontSize: 18 }} />
                                {t('2709')}
                            </Box>
                        </Button>

                        <Stack spacing={0} sx={{ gap: '10px' }}>
                            {keyboardDataInConfig.map((kb: any, index: number) => {
                                const active = (connectedKeyboard?.productName || '') === kb.productName;
                                const kbPreviewSrc = getKeyboardPreviewCandidates(kb.vendorId, kb.productId, kb.devMode ?? 0)[0] ?? '';
                                return (
                                    <Box
                                        key={kb.id || kb.address || `${kb.productName}-${index}`}
                                        onClick={() => handleSelectKeyboard(kb)}
                                        sx={{
                                            p: '10px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: active ? KP.primary : 'rgba(241, 245, 249, 0.9)',
                                            transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Box
                                                sx={{
                                                    width: '48px',
                                                    height: '40px',
                                                    backgroundColor: '#fff',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {kbPreviewSrc ? (
                                                    <Box
                                                        component="img"
                                                        src={kbPreviewSrc}
                                                        alt={kb.productName || t('2713')}
                                                        sx={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            display: 'block',
                                                        }}
                                                    />
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            width: '100%',
                                                            height: '100%',
                                                            backgroundColor: '#fff',
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            <Box sx={{ flex: 1, mx: '10px', minWidth: 0 }}>
                                                <Typography
                                                    sx={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        color: active ? '#fff' : '#0f172a',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {kb.productName}
                                                </Typography>
                                                <Typography
                                                    sx={{
                                                        fontSize: 12,
                                                        color: active ? 'rgba(255,255,255,0.95)' : '#64748b',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {kb.productName}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    width: `${KP.dotSize}px`,
                                                    height: `${KP.dotSize}px`,
                                                    m: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#10b981',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                </Popover>

                <Box
                    sx={{
                        ...sidePanelSx,
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: `${KP.submenuContainerPaddingY}px ${KP.submenuContainerPaddingX}px`,
                        gap: `${KP.submenuContainerGap}px`,
                    }}
                >
                    <Box sx={{ width: '100%' }}>
                        <Typography sx={{ ...KP.titleFont, color: KP.titleColor }}>{t('2710')}</Typography>
                        <Typography sx={{ ...KP.tipsFont, color: KP.tipsColor, mt: '6px' }}>
                            {t('2711')}
                        </Typography>
                    </Box>

                    <Stack
                        spacing={0}
                        sx={{
                            gap: `${KP.submenuGap}px`,
                            flex: 1,
                            minHeight: 0,
                            overflow: 'auto',
                        }}
                    >
                        {keyboardSettings.map((setting) => {
                            const active = selectedSetting === setting.id;
                            return (
                                <Button
                                    key={setting.id}
                                    fullWidth
                                    onClick={() => handleSettingSelect(setting.id)}
                                    sx={{
                                        height: '42px',
                                        px: `${KP.submenuPaddingX}px`,
                                        borderRadius: '10px',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        fontWeight: active ? 600 : 500,
                                        textTransform: 'none',
                                        color: active ? '#ffffff' : '#7d93b0',
                                        backgroundColor: active ? '#4a86f7' : 'transparent',
                                        transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
                                        '&:hover': {
                                            backgroundColor: active ? '#3b78f0' : 'rgba(74, 134, 247, 0.08)',
                                            color: active ? '#ffffff' : '#4a86f7',
                                        },
                                    }}
                                >
                                    {setting.label}
                                </Button>
                            );
                        })}
                    </Stack>
                </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom:43 }}>
                <SettingsContent
                    selectedSetting={selectedSetting}
                    deviceAuthorized={Boolean(deviceStatus)}
                />
            </Box>
        </Box>
    );
}
