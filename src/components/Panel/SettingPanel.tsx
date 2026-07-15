'use client';

import {
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    MenuItem,
    Select,
    Typography,
    Stepper,
    Step,
    StepLabel,
    IconButton,

} from '@mui/material';
import LightMode from '@mui/icons-material/LightMode';
import DarkMode from '@mui/icons-material/DarkMode';
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { MainContext } from '@/providers/MainProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import ResetProgress from '../ResetProgress';
import WebDriverChangelogSection from './WebDriverChangelogSection';
import FirmwareChangelogSection from './FirmwareChangelogSection';
import ScreenFirmwareChangelogSection from './ScreenFirmwareChangelogSection';
import {
    getScreenFirmwareFile,
    getScreenImageFile,
    getScreenUpgradeVersion,
    isKeyboardDriverUpgradeDisabled,
    isScreenDriverUpgradeDisabled,
} from '@/config/deviceInfo';
import {
    isFirmwareVersionBehind,
} from '@/utils/firmwareVersionCompare';
import {
    canInitiateKeyboardFirmwareUpgrade,
    canInitiateScreenFirmwareUpgrade,
    canUpgradeToKeyboardRelease,
    canUpgradeToScreenRelease,
    isKeyboardFirmwarePackageConfigured,
} from '@/utils/firmwareUpgradeReadiness';
import { isActiveFirmwareUpgradeState, readFirmwareUpgradeState, resolveKeyboardUpgradeCurrentVersion } from '@/utils/firmwareUpgradeState';
import FirmwareUpgrade from '@/components/common/FirmwareUpgrade';
import ScreenFirmwareUpgrade from '@/components/common/ScreenFirmwareUpgrade';
import DongleFirmwareUpgrade from '@/components/common/DongleFirmwareUpgrade';
import KeyboardFirmwareUpgrade from '@/components/common/KeyboardFirmwareUpgrade';
import ToggleSlider from '@/components/common/ToggleSlider';
import { useTranslation } from '@/app/i18n';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { useThemeMode } from '@/providers/ThemeContextProvider';
import { getSettingsRowDescriptionSx, getSettingsRowTitleSx } from '@/constants/settingsPanelTypography';
import { lightingPanelCardSx } from '@/constants/lightingPanelChrome';
import { getComfortableScrollbarSx } from '@/utils/comfortableScrollbarSx';
import { usesExtendedFuncInfoLayout } from '@/devices/KeyboardDevice';

import QmkLayoutPanel from './QmkLayoutPanel';

type SettingTab = 'settings' | 'interface' | 'firmware' | 'layout';

export default function SettingPanel() {
    const { t } = useTranslation("common");
    const {
        keyboard,
        connectedKeyboard,
        resetKeyboard,
        keyboardLayout,
        isUpgradeWindowOpen,
        setIsUpgradeWindowOpen
    } = useContext(ConnectKbContext);
    const { deviceComm, deviceStatus, screenInfo } = useContext(MainContext);
    const { settingsFirmwareTabRequestSeq } = useContext(EditorContext);
    const { showMessage } = useSnackbarDialog();
    const { mode, setThemeMode } = useThemeMode();
    const theme = useTheme();
    const [tab, setTab] = useState<SettingTab>('settings');
    const lastSettingsFwSeqRef = useRef(0);
    const isQMK = keyboard?.keyboardType === 'QMK';

    useEffect(() => {
        if (isQMK) {
            setTab('interface');
        }
    }, [isQMK]);

    useEffect(() => {
        if (isQMK) return;
        if (settingsFirmwareTabRequestSeq > lastSettingsFwSeqRef.current) {
            lastSettingsFwSeqRef.current = settingsFirmwareTabRequestSeq;
            setTab('firmware');
        }
    }, [settingsFirmwareTabRequestSeq, isQMK]);

    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

    const [nkroEnabled, setNkroEnabled] = useState(false);
    const [winDisabled, setWinDisabled] = useState(false);
    const [platformIndicator, setPlatformIndicator] = useState<'win' | 'mac'>('win');
    const [_keyWasd, setKeyWasd] = useState(false);
    const [snapTap, setSnapTap] = useState(false);
    const [, setFMode] = useState(false);
    const [, setScrollMode] = useState(false);
    const [numLockInvert, setNumLockInvert] = useState(false);

    const [keyDelay, setKeyDelay] = useState(0);
    const [sleepMinutes, setSleepMinutes] = useState(5);
    const [deepSleepMinutes, setDeepSleepMinutes] = useState(30);
    const sleepOptions = [1, 3, 5, 10, 20, 30, 45, 60];
    const [showResetProgress, setShowResetProgress] = useState(false);
    const [lcdVersionHex, setLcdVersionHex] = useState('');

    const { vendorId, productId } = connectedKeyboard || {};
    const {
        deviceUpgradeFile,
        deviceUpgradeVersion,
        deviceVersion,
        deviceVID,
        devicePID,
        deviceBaseInfo,
        deviceNeedsUpgrade,
    } = keyboard || {};

    const firmwareChangelogKeySegment = deviceBaseInfo?.keyboardID ?? 0;
    const isDemoFirmwareSession = connectedKeyboard?.api?.address === 'demo';

    const fwVid = connectedKeyboard?.vendorId ?? vendorId ?? deviceVID ?? 0;
    const fwPid = connectedKeyboard?.productId ?? productId ?? devicePID ?? 0;
    const screenFwPath = useMemo(
        () => (fwVid && fwPid ? getScreenFirmwareFile(fwVid, fwPid, firmwareChangelogKeySegment) : ''),
        [fwVid, fwPid, firmwareChangelogKeySegment]
    );
    const screenImagePath = useMemo(
        () => (fwVid && fwPid ? getScreenImageFile(fwVid, fwPid, firmwareChangelogKeySegment) : ''),
        [fwVid, fwPid, firmwareChangelogKeySegment]
    );
    const screenUpgradeVersionCfg = useMemo(
        () => (fwVid && fwPid ? getScreenUpgradeVersion(fwVid, fwPid, firmwareChangelogKeySegment) : ''),
        [fwVid, fwPid, firmwareChangelogKeySegment]
    );
    const screenVerFromContext = useMemo(() => {
        if (screenInfo?.firmware_version == null) return '';
        return Number(screenInfo.firmware_version).toString(16).toUpperCase();
    }, [screenInfo]);
    const screenDeviceVersion = lcdVersionHex || screenVerFromContext;
    const lcdReady = Boolean(deviceComm && deviceStatus && screenDeviceVersion);
    const screenNeedsUpgrade = Boolean(
        !isScreenDriverUpgradeDisabled(fwVid, fwPid, firmwareChangelogKeySegment) &&
        screenUpgradeVersionCfg &&
        screenDeviceVersion &&
        isFirmwareVersionBehind(screenDeviceVersion, screenUpgradeVersionCfg),
    );
    const keyboardUpgradeReady = isKeyboardFirmwarePackageConfigured({
        targetVersion: deviceUpgradeVersion,
        firmwareFile: deviceUpgradeFile,
        vendorId: fwVid,
        productId: fwPid,
        keySegment: firmwareChangelogKeySegment,
    }) || isActiveFirmwareUpgradeState({
        vendorId: fwVid || deviceVID,
        productId: fwPid || devicePID,
        currentUpgradeVersion: deviceUpgradeVersion,
    });
    const persistedUpgrade = useMemo(
        () => (isUpgradeWindowOpen ? readFirmwareUpgradeState() : null),
        [isUpgradeWindowOpen],
    );
    const keyboardUpgradeCurrentVersion = useMemo(
        () => resolveKeyboardUpgradeCurrentVersion({
            deviceVersion,
            persistedCurrentVersion: persistedUpgrade?.deviceInfo?.currentVersion,
            upgradeStep: persistedUpgrade?.step,
        }),
        [deviceVersion, persistedUpgrade?.deviceInfo?.currentVersion, persistedUpgrade?.step],
    );
    const keyboardCanReflash = canInitiateKeyboardFirmwareUpgrade({
        currentVersion: deviceVersion,
        targetVersion: deviceUpgradeVersion,
        firmwareFile: deviceUpgradeFile,
        vendorId: fwVid,
        productId: fwPid,
        keySegment: firmwareChangelogKeySegment,
    });
    const screenCanReflash = canInitiateScreenFirmwareUpgrade({
        currentVersion: screenDeviceVersion,
        targetVersion: screenUpgradeVersionCfg,
        firmwareFile: screenFwPath,
        vendorId: fwVid,
        productId: fwPid,
        keySegment: firmwareChangelogKeySegment,
    });
    const screenUpgradePackageReady = Boolean(
        screenFwPath?.trim() &&
        screenUpgradeVersionCfg?.trim() &&
        !isScreenDriverUpgradeDisabled(fwVid, fwPid, firmwareChangelogKeySegment),
    );

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [checkingForUpdates, setCheckingForUpdates] = useState(false);
    const [upgradeStepDialogOpen, setUpgradeStepDialogOpen] = useState(false);
    const [screenUpdateDialogOpen, setScreenUpdateDialogOpen] = useState(false);
    const [isScreenUpgradeOpen, setIsScreenUpgradeOpen] = useState(false);
    const [checkingScreenUpdates, setCheckingScreenUpdates] = useState(false);
    const [screenUpgradeTarget, setScreenUpgradeTarget] = useState<{
        version: string;
        firmwareFile: string;
        imageFile?: string;
    } | null>(null);
    const [keyboardUpgradeTarget, setKeyboardUpgradeTarget] = useState<{
        version: string;
        firmwareFile: string;
    } | null>(null);

    const upgradeSteps = [
        t("727"),
        t("728"),
        t("730")
    ];

    const checkForUpdates = () => {
        if (!keyboardUpgradeReady) {
            showMessage({
                message: t('1240'),
                type: 'warning',
            });
            return;
        }
        if (keyboardCanReflash) {
            setUpdateDialogOpen(true);
        } else {
            setCheckingForUpdates(true);
            setTimeout(() => {
                setCheckingForUpdates(false);
                showMessage({
                    message: t("731"),
                    type: "info",
                });
            }, 1000);
        }
    };

    const checkScreenForUpdates = () => {
        if (!screenFwPath?.trim() || !screenUpgradeVersionCfg?.trim()) {
            showMessage({
                message: t('1240'),
                type: 'warning',
            });
            return;
        }
        if (screenCanReflash) {
            setScreenUpdateDialogOpen(true);
        } else {
            setCheckingScreenUpdates(true);
            setTimeout(() => {
                setCheckingScreenUpdates(false);
                showMessage({
                    message: t("731"),
                    type: "info",
                });
            }, 1000);
        }
    };

    const handleDownloadUpdate = () => {
        if (!keyboardUpgradeReady) {
            showMessage({ message: t('1240'), type: 'warning' });
            return;
        }
        setUpdateDialogOpen(false);
        setKeyboardUpgradeTarget(null);
        setIsUpgradeWindowOpen?.(true);
    };

    const handleKeyboardUpgradeToVersion = (params: { version: string; firmwareFile: string }) => {
        if (
            isKeyboardDriverUpgradeDisabled(fwVid, fwPid, firmwareChangelogKeySegment) ||
            !canUpgradeToKeyboardRelease({
                ...params,
                vendorId: fwVid,
                productId: fwPid,
                keySegment: firmwareChangelogKeySegment,
            })
        ) {
            showMessage({ message: t('1240'), type: 'warning' });
            return;
        }
        setKeyboardUpgradeTarget(params);
        setIsUpgradeWindowOpen?.(true);
    };

    const handleScreenDownloadUpdate = () => {
        if (!screenFwPath?.trim() || !screenUpgradeVersionCfg?.trim()) {
            showMessage({ message: t('1240'), type: 'warning' });
            return;
        }
        setScreenUpdateDialogOpen(false);
        setScreenUpgradeTarget(null);
        setIsScreenUpgradeOpen(true);
    };

    const handleScreenUpgradeToVersion = (params: {
        version: string;
        firmwareFile: string;
        imageFile?: string;
    }) => {
        if (
            isScreenDriverUpgradeDisabled(fwVid, fwPid, firmwareChangelogKeySegment) ||
            !canUpgradeToScreenRelease({
                ...params,
                screenFirmwareFile: params.firmwareFile,
                vendorId: fwVid,
                productId: fwPid,
                keySegment: firmwareChangelogKeySegment,
            })
        ) {
            showMessage({ message: t('1240'), type: 'warning' });
            return;
        }
        setScreenUpgradeTarget(params);
        setIsScreenUpgradeOpen(true);
    };

    const handleCloseScreenUpgrade = () => {
        setIsScreenUpgradeOpen(false);
        setScreenUpgradeTarget(null);
    };

    const getDeviceType = () => {
        const vid = connectedKeyboard?.vendorId || deviceVID || vendorId || 0;
        const pid = connectedKeyboard?.productId || devicePID || productId || 0;
        const keyboardID = deviceBaseInfo?.keyboardID || 0;

        if (vid === 0x36B0 && pid === 0x3002) {
            return 'dongle';
        }
        if (keyboardID >= 0x30 && keyboardID <= 0x3F) {
            return 'keyboard-8k';
        }
        return 'keyboard';
    };

    const deviceType = getDeviceType();

    const handleCloseUpgrade = () => {
        setIsUpgradeWindowOpen?.(false);
        setKeyboardUpgradeTarget(null);
    };

    const handleFirmwareDownload = () => {
        const firmwareFile = deviceUpgradeFile;
        if (!firmwareFile) return;
        const downloadLink = document.createElement('a');
        downloadLink.href = firmwareFile;
        downloadLink.download = firmwareFile.split('/').pop() || 'firmware.bin';
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        showMessage({
            message: t("732"),
            type: "success",
        });
    };

    const normalizeSleepMinute = (value: number, fallback: number) => {
        if (sleepOptions.includes(value)) return value;
        return fallback;
    };

    const isDemoMode = Boolean(connectedKeyboard?.api?.test);
    const funcInfo = keyboard?.deviceFuncInfo ?? {};

    useEffect(() => {
        if (tab !== 'firmware' || !deviceComm) {
            if (tab !== 'firmware') setLcdVersionHex('');
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const s = await deviceComm.getScreenSize();
                console.log(s, 's');

                if (!cancelled && s?.firmware_version != null) {
                    setLcdVersionHex(Number(s.firmware_version).toString(16).toUpperCase());
                }
            } catch {
                if (!cancelled) setLcdVersionHex('');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [tab, deviceComm]);

    useEffect(() => {
        setNkroEnabled((funcInfo?.sixKeysOrAllKeys ?? 0) === 1);
        setWinDisabled((funcInfo?.winLock ?? 0) === 1);
        setPlatformIndicator((funcInfo?.maxOrWin ?? 0) === 1 ? 'mac' : 'win');
        setKeyWasd((funcInfo?.keyWasd ?? 0) === 1);
        setSnapTap((funcInfo?.snapTap ?? 0) === 1 || funcInfo?.snapTap === true);
        setFMode((funcInfo?.fSwitch ?? 0) === 1 || funcInfo?.fSwitch === true);
        setScrollMode((funcInfo?.wheelDefaultMode ?? 0) === 1 || funcInfo?.wheelDefaultMode === true);

        setKeyDelay(Number(funcInfo?.scanDelay ?? 0));

        const sleepSec = Number(funcInfo?.sleepTime ?? 300);
        const deepSleepSec = Number(funcInfo?.deepSleepTime ?? 1800);

        const sleepMin = Math.min(60, Math.max(1, Math.round(sleepSec / 60) || 5));
        const deepSleepMin = Math.min(60, Math.max(1, Math.round(deepSleepSec / 60) || 30));

        setSleepMinutes(normalizeSleepMinute(sleepMin, 5));
        setDeepSleepMinutes(normalizeSleepMinute(deepSleepMin, 30));
        setNumLockInvert((funcInfo?.numLockMode ?? 0) === 1);
    }, [funcInfo]);

    const supportsNumLockMode = usesExtendedFuncInfoLayout(
        connectedKeyboard?.productId ?? productId ?? 0,
    );

    const isDarkMode = theme.palette.mode === 'dark';

    const selectSx = useMemo(() => {
        const P = theme.palette.primary.main;
        if (isDarkMode) {
            return {
                minWidth: '120px',
                height: '36px',
                fontSize: '14px',
                color: alpha(theme.palette.common.white, 0.82),
                bgcolor: theme.palette.background.paper,
                borderRadius: '8px',
                transition: 'all 0.18s ease',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: alpha(P, 0.35) },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(P, 0.55) },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: P,
                    borderWidth: '1px',
                },
                '& .MuiSelect-select': {
                    py: '5.6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pr: '28px',
                },
                '& .MuiSelect-icon': { color: P, right: '8px' },
            };
        }
        return {
            minWidth: '120px',
            height: '36px',
            fontSize: '14px',
            color: '#64748b',
            bgcolor: 'rgba(255, 255, 255, 1)',
            borderRadius: '8px',
            transition: 'all 0.18s ease',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 1)' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#93a5be' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: '#3b82f6',
                borderWidth: '1px',
            },
            '& .MuiSelect-select': {
                py: '5.6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pr: '28px',
            },
            '& .MuiSelect-icon': { color: '#3b82f6', right: '8px' },
        };
    }, [theme, isDarkMode]);

    const selectMenuProps = useMemo(
        () => ({
            PaperProps: {
                sx: {
                    mt: '4px',
                    borderRadius: '8px',
                    border: isDarkMode
                        ? `1px solid ${alpha(theme.palette.primary.main, 0.35)}`
                        : '1px solid rgba(22, 108, 230, 0.35)',
                    boxShadow: isDarkMode
                        ? '0 8px 24px rgba(0,0,0,0.45)'
                        : '0 6px 18px rgba(15, 23, 42, 0.12)',
                    overflow: 'hidden',
                    ...(isDarkMode ? { bgcolor: theme.palette.background.paper } : {}),
                },
            },
            MenuListProps: { sx: { py: 0 } },
        }),
        [theme, isDarkMode]
    );

    const selectItemSx = useMemo(() => {
        const P = theme.palette.primary.main;
        const Pd = theme.palette.primary.dark;
        if (isDarkMode) {
            return {
                fontSize: '14px',
                color: alpha(theme.palette.common.white, 0.85),
                minHeight: '36px',
                backgroundColor: theme.palette.background.paper,
                '&:hover': { backgroundColor: alpha(P, 0.08) },
                '&.Mui-selected': { bgcolor: P, color: '#fff' },
                '&.Mui-selected:hover': { bgcolor: Pd, color: '#fff' },
            };
        }
        return {
            fontSize: '14px',
            color: '#64748b',
            minHeight: '36px',
            backgroundColor: '#ffffff',
            '&:hover': { border: '1px solid rgb(22, 109, 230)' },
            '&.Mui-selected': { bgcolor: '#3b82f6', color: '#fff' },
            '&.Mui-selected:hover': { border: '1px solid rgb(22, 109, 230)', color: '#fff' },
        };
    }, [theme, isDarkMode]);

    const settingsSidebarSx = useMemo(
        () => ({
            width: '250px',
            ...lightingPanelCardSx(theme),
            borderRadius: '12px',
            p: '24px',
            display: 'flex',
            flexDirection: 'column' as const,
            gap: '8.8px',
            height: '100%',
            ...(isDarkMode
                ? { boxShadow: '0 0 24px rgba(0,0,0,0.35)' }
                : { boxShadow: 'rgba(176, 206, 255, 0.5) 0px 0px 21px' }),
        }),
        [theme, isDarkMode]
    );

    const settingTabBtnSx = (active: boolean) => {
        const P = theme.palette.primary.main;
        const Pd = theme.palette.primary.dark;
        return {
            textTransform: 'none' as const,
            borderRadius: '7.2px',
            height: '48px',
            fontSize: '16px',
            fontWeight: 600,
            color: active ? '#fff' : isDarkMode ? alpha(theme.palette.common.white, 0.65) : '#596d88',
            bgcolor: active ? P : 'transparent',
            border: '1px solid',
            borderColor: active ? P : 'transparent',
            '&:hover': {
                bgcolor: active ? Pd : alpha(P, 0.12),
            },
        };
    };

    const updateDialogTitleSx = useMemo(
        () => ({
            textAlign: 'center' as const,
            pb: 0,
            pt: '24px',
            fontSize: '20px',
            fontWeight: 700,
            color: isDarkMode ? alpha(theme.palette.common.white, 0.88) : '#5d6f8a',
        }),
        [theme, isDarkMode]
    );

    const updateDialogBodySx = useMemo(
        () => ({
            color: isDarkMode ? alpha(theme.palette.common.white, 0.72) : '#334155',
            fontSize: '16px',
            lineHeight: 1.75,
            textAlign: 'center' as const,
        }),
        [theme, isDarkMode]
    );

    const updateDialogPrimaryBtnSx = useMemo(
        () => ({
            minWidth: '96px',
            height: '35.2px',
            bgcolor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            fontSize: '18px',
            '&:hover': { bgcolor: theme.palette.primary.dark },
        }),
        [theme]
    );

    const updateDialogOutlinedBtnSx = useMemo(
        () => ({
            minWidth: '96px',
            height: '35.2px',
            borderColor: isDarkMode ? alpha(theme.palette.common.white, 0.22) : 'rgba(148, 163, 184, 0.65)',
            color: isDarkMode ? alpha(theme.palette.common.white, 0.72) : '#64748b',
            fontSize: '18px',
            '&:hover': {
                borderColor: isDarkMode ? alpha(theme.palette.primary.main, 0.45) : '#94a3b8',
                bgcolor: isDarkMode ? alpha(theme.palette.common.white, 0.06) : 'rgba(148, 163, 184, 0.06)',
            },
        }),
        [theme, isDarkMode]
    );

    const firmwareResetOutlineBtnSx = useMemo(
        () => ({
            textTransform: 'none' as const,
            height: '36px',
            px: '20px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
            boxShadow: 'none',
            ...(isDarkMode
                ? {
                    color: alpha(theme.palette.common.white, 0.78),
                    bgcolor: theme.palette.background.paper,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                    '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                        borderColor: alpha(theme.palette.primary.main, 0.5),
                    },
                }
                : {
                    color: '#64748b',
                    bgcolor: 'rgba(255, 255, 255, 1)',
                    border: '1px solid rgba(148, 163, 184, 0.55)',
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                }),
        }),
        [theme, isDarkMode]
    );

    const panelBaseSx = useMemo(
        () => ({
            width: '100%',
            height: '100%',
            display: 'flex',
            gap: '16px',
            p: '16px',
            minHeight: 0,
        }),
        []
    );

    const updateFuncInfo = async (patch: Record<string, number | boolean>) => {
        const next = { ...(keyboard?.deviceFuncInfo ?? {}), ...patch };
        keyboard?.setDeviceFuncInfo?.(next);

        if (!isDemoMode) {
            await connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
        }
    };
    const resetKb = () => {
        setResetConfirmOpen(false);
        setShowResetProgress(true);
        resetKeyboard();
    };

    return (
        <Box sx={panelBaseSx}>
            <Box sx={settingsSidebarSx}>
                {!isQMK && (
                    <ButtonRem
                        data-setting-tab="settings"
                        onClick={() => setTab('settings')}
                        sx={settingTabBtnSx(tab === 'settings')}
                    >
                        {t('2500')}
                    </ButtonRem>
                )}
                <ButtonRem
                    data-setting-tab="interface"
                    onClick={() => setTab('interface')}
                    sx={settingTabBtnSx(tab === 'interface')}
                >
                    {t('1491')}
                </ButtonRem>
                {isQMK && (
                    <ButtonRem
                        data-setting-tab="layout"
                        onClick={() => setTab('layout')}
                        sx={settingTabBtnSx(tab === 'layout')}
                    >
                        {t('2703')}
                    </ButtonRem>
                )}
                {!isQMK && (
                    <ButtonRem
                        data-setting-tab="firmware"
                        onClick={() => setTab('firmware')}
                        sx={settingTabBtnSx(tab === 'firmware')}
                    >
                        {t('2501')}
                    </ButtonRem>
                )}
            </Box>

            <Box
                sx={{
                    borderRadius: '12px',
                    p: '20px',
                    minHeight: 0,
                    m: '0 auto',
                    width: '100%',
                    maxWidth: '75%',
                    overflowY: 'auto',
                    ...getComfortableScrollbarSx(isDarkMode),
                }}
            >
                {tab === 'settings' && !isQMK ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <SettingCard>
                            <Row
                                title={t('770')}
                                description={[t('771'), t('1492')]}
                                right={
                                    <ToggleSlider
                                        checked={nkroEnabled}
                                        onChange={(checked) => {
                                            setNkroEnabled(checked);
                                            updateFuncInfo({ sixKeysOrAllKeys: checked ? 1 : 0 });
                                        }}
                                        ariaLabel={t('770')}
                                    />
                                }
                            />
                        </SettingCard>

                        <SettingCard>
                            <Row
                                title={t('772')}
                                description={[t('773')]}
                                right={
                                    <ToggleSlider
                                        checked={winDisabled}
                                        disabled={platformIndicator === 'mac'}
                                        onChange={(checked) => {
                                            setWinDisabled(checked);
                                            updateFuncInfo({ winLock: checked ? 1 : 0 });
                                        }}
                                        ariaLabel={t('772')}
                                    />
                                }
                            />
                        </SettingCard>
                        {/* <SettingCard>
                            <Row
                                title={t('2585', { mode: platformIndicator === 'mac' ? 'MAC' : 'WIN' })}
                                description={[t('2578')]}
                            />
                        </SettingCard> */}

                        {supportsNumLockMode && (
                            <SettingCard>
                                <Row
                                    title={t('2502')}
                                    description={[t('2503')]}
                                    right={
                                        <ToggleSlider
                                            checked={numLockInvert}
                                            onChange={(checked) => {
                                                setNumLockInvert(checked);
                                                updateFuncInfo({ numLockMode: checked ? 1 : 0 });
                                            }}
                                            ariaLabel={t('2502')}
                                        />
                                    }
                                />
                            </SettingCard>
                        )}

                        <SettingCard>
                            <Row
                                title={t('798')}
                                description={[t('2515')]}
                                right={
                                    <ToggleSlider
                                        checked={snapTap}
                                        onChange={(checked) => {
                                            setSnapTap(checked);
                                            updateFuncInfo({ snapTap: checked ? 1 : 0 });
                                        }}
                                        ariaLabel={t('798')}
                                    />
                                }
                            />
                        </SettingCard>

                        {keyboardLayout?.keyboardMode !== 0 && (
                            <>
                                <SettingCard>
                                    <Row
                                        title={t('780')}
                                        description={[t('2504')]}
                                        right={
                                            <FormControl size="small">
                                                <Select
                                                    value={sleepMinutes}
                                                    onChange={(e) => {
                                                        const minutes = Number(e.target.value);
                                                        setSleepMinutes(minutes);
                                                        updateFuncInfo({ sleepTime: minutes * 60 });
                                                    }}
                                                    sx={selectSx}
                                                    MenuProps={selectMenuProps}
                                                >
                                                    {sleepOptions.map((m) => (
                                                        <MenuItem key={m} value={m} sx={selectItemSx}>
                                                            {m}
                                                            {t('787')}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        }
                                    />
                                </SettingCard>
                                <SettingCard>
                                    <Row
                                        title={t('784')}
                                        description={[t('2505')]}
                                        right={
                                            <FormControl size="small">
                                                <Select
                                                    value={deepSleepMinutes}
                                                    onChange={(e) => {
                                                        const minutes = Number(e.target.value);
                                                        setDeepSleepMinutes(minutes);
                                                        updateFuncInfo({ deepSleepTime: minutes * 60 });
                                                    }}
                                                    sx={selectSx}
                                                    MenuProps={selectMenuProps}
                                                >
                                                    {sleepOptions.map((m) => (
                                                        <MenuItem key={m} value={m} sx={selectItemSx}>
                                                            {m}
                                                            {t('787')}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        }
                                    />
                                </SettingCard>
                            </>
                        )}

                        <SettingCard>
                            <Row
                                title={t('776')}
                                description={[t('2506')]}
                                right={
                                    <FormControl size="small">
                                        <Select
                                            value={keyDelay}
                                            onChange={(e) => {
                                                const v = Number(e.target.value);
                                                setKeyDelay(v);
                                                updateFuncInfo({ scanDelay: v });
                                            }}
                                            sx={selectSx}
                                            MenuProps={selectMenuProps}
                                        >
                                            {(['2516', '2517', '2518', '2519'] as const).map((key, v) => (
                                                <MenuItem key={v} value={v} sx={selectItemSx}>
                                                    {t(key)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                }
                            />
                        </SettingCard>
                    </Box>
                ) : tab === 'layout' && isQMK ? (
                    <QmkLayoutPanel />
                ) : tab === 'interface' ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <SettingCard>
                            <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '16px' }}>{t('2597')}</Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                                <ButtonRem
                                    type="button"
                                    onClick={() => setThemeMode('light')}
                                    sx={{
                                        width: '218px',
                                        minHeight: '46px',
                                        borderRadius: '999px',
                                        textTransform: 'none',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: 'none',
                                        '& .MuiSvgIcon-root': {
                                            color: 'currentColor',
                                        },
                                        ...(mode === 'light'
                                            ? {
                                                color: theme.palette.primary.contrastText,
                                                bgcolor: theme.palette.primary.main,
                                                border: `1px solid ${theme.palette.primary.main}`,
                                                '&:hover': {
                                                    bgcolor: theme.palette.primary.dark,
                                                    borderColor: theme.palette.primary.dark,
                                                },
                                            }
                                            : {
                                                color: theme.palette.text.secondary,
                                                bgcolor:
                                                    theme.palette.mode === 'light'
                                                        ? theme.palette.customed2.main
                                                        : theme.palette.background.paper,
                                                border: `1px solid ${theme.palette.divider}`,
                                                '&:hover': {
                                                    bgcolor: theme.palette.action.hover,
                                                    borderColor: theme.palette.divider,
                                                },
                                            }),
                                    }}
                                >
                                    <LightMode sx={{ fontSize: 22 }} />
                                    {t('2598')}
                                </ButtonRem>
                                <ButtonRem
                                    type="button"
                                    onClick={() => setThemeMode('dark')}
                                    sx={{
                                        width: '218px',
                                        minHeight: '46px',
                                        borderRadius: '999px',
                                        textTransform: 'none',
                                        fontSize: '16px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        boxShadow: 'none',
                                        '& .MuiSvgIcon-root': {
                                            color: 'currentColor',
                                        },
                                        ...(mode === 'dark'
                                            ? {
                                                color: theme.palette.primary.contrastText,
                                                bgcolor: theme.palette.primary.main,
                                                border: `1px solid ${theme.palette.primary.main}`,
                                                '&:hover': {
                                                    bgcolor: theme.palette.primary.dark,
                                                    borderColor: theme.palette.primary.dark,
                                                },
                                            }
                                            : {
                                                color: theme.palette.text.secondary,
                                                bgcolor:
                                                    theme.palette.mode === 'light'
                                                        ? theme.palette.customed2.main
                                                        : theme.palette.background.paper,
                                                border: `1px solid ${theme.palette.divider}`,
                                                '&:hover': {
                                                    bgcolor: theme.palette.action.hover,
                                                    borderColor: theme.palette.divider,
                                                },
                                            }),
                                    }}
                                >
                                    <DarkMode sx={{ fontSize: 22 }} />
                                    {t('2599')}
                                </ButtonRem>
                            </Box>
                        </SettingCard>
                    </Box>
                ) : tab === 'firmware' && !isQMK ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <FirmwareCard
                            title={t('710')}
                            lines={[t('2507')]}
                            action={
                                <ButtonRem
                                    onClick={() => setResetConfirmOpen(true)}
                                    sx={firmwareResetOutlineBtnSx}
                                >
                                    {t('710')}
                                </ButtonRem>
                            }
                        />
                        <FirmwareChangelogSection
                            vendorId={connectedKeyboard?.vendorId ?? vendorId ?? deviceVID ?? 0}
                            productId={connectedKeyboard?.productId ?? productId ?? devicePID ?? 0}
                            keySegment={firmwareChangelogKeySegment}
                            deviceVersion={deviceVersion || ''}
                            deviceUpgradeVersion={deviceUpgradeVersion || undefined}
                            deviceNeedsUpgrade={Boolean(deviceNeedsUpgrade) && keyboardUpgradeReady}
                            onCheckUpdates={checkForUpdates}
                            checkingForUpdates={checkingForUpdates}
                            upgradePackageReady={keyboardUpgradeReady}
                            demoSession={isDemoFirmwareSession}
                            onUpgradeToVersion={handleKeyboardUpgradeToVersion}
                        />
                        {screenUpgradePackageReady ? (
                            <ScreenFirmwareChangelogSection
                                vendorId={fwVid}
                                productId={fwPid}
                                keySegment={firmwareChangelogKeySegment}
                                deviceVersion={screenDeviceVersion}
                                deviceUpgradeVersion={screenUpgradeVersionCfg || undefined}
                                deviceNeedsUpgrade={screenNeedsUpgrade}
                                onCheckUpdates={checkScreenForUpdates}
                                checkingForUpdates={checkingScreenUpdates}
                                upgradePackageReady={screenUpgradePackageReady}
                                demoSession={isDemoFirmwareSession}
                                lcdReady={lcdReady}
                                keyboardForScreen={connectedKeyboard}
                                onUpgradeToVersion={handleScreenUpgradeToVersion}
                            />
                        ) : null}
                        <WebDriverChangelogSection />
                    </Box>
                ) : null}
            </Box>
            <Dialog onClose={() => setResetConfirmOpen(false)} open={resetConfirmOpen}>
                <DialogTitle>{t("712")}</DialogTitle>
                <IconButton
                    aria-label={t("742")}
                    onClick={() => setResetConfirmOpen(false)}
                    sx={{ position: 'absolute', right: '1px', top: '1px', color: 'grey.500' }}
                />
                <DialogContent dividers>
                    <Typography gutterBottom>{t("713")}</Typography>
                </DialogContent>
                <DialogActions>
                    <ButtonRem color="error" variant="contained" autoFocus onClick={resetKb}>{t("710")}</ButtonRem>
                    <ButtonRem variant="outlined" onClick={() => setResetConfirmOpen(false)}>{t("714")}</ButtonRem>
                </DialogActions>
            </Dialog>
            {showResetProgress && <ResetProgress onComplete={setShowResetProgress} />}

            <Dialog
                open={updateDialogOpen}
                onClose={() => setUpdateDialogOpen(false)}
                PaperProps={{
                    sx: {
                        width: '642px',
                        maxWidth: '95vw',
                        borderRadius: '12px',
                    }
                }}
            >
                <DialogTitle sx={updateDialogTitleSx}>
                    {t("712")}
                </DialogTitle>
                <DialogContent sx={{ px: '24px', pt: '12px', pb: '8px' }}>
                    <Typography variant="body2" component="div" sx={updateDialogBodySx}>
                        {/* {t('2730')} */}
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            {t('2731')}
                        </Box>
                    </Typography>
                    <Typography variant="body2" sx={{ ...updateDialogBodySx, mt: '4px' }}>
                        {t('2732')}
                    </Typography>
                    <Typography variant="body2" sx={{ ...updateDialogBodySx, mt: '4px' }}>
                        {t('2737')}
                    </Typography>
                    {/* <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
                        {t('2734')}
                    </Typography> */}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: '24px', gap: '16px', px: '24px' }}>
                    <ButtonRem
                        variant="contained"
                        onClick={handleDownloadUpdate}
                        sx={updateDialogPrimaryBtnSx}
                    >
                        {t('2735')}
                    </ButtonRem>
                    <ButtonRem
                        variant="outlined"
                        onClick={() => setUpdateDialogOpen(false)}
                        sx={updateDialogOutlinedBtnSx}
                    >
                        {t("714")}
                    </ButtonRem>
                </DialogActions>
            </Dialog>

            <Dialog
                open={screenUpdateDialogOpen}
                onClose={() => setScreenUpdateDialogOpen(false)}
                PaperProps={{
                    sx: {
                        width: '642px',
                        maxWidth: '95vw',
                        borderRadius: '12px',
                    }
                }}
            >
                <DialogTitle sx={updateDialogTitleSx}>
                    {t('2800')}
                </DialogTitle>
                <DialogContent sx={{ px: '24px', pt: '12px', pb: '8px' }}>
                    <Typography variant="body2" component="div" sx={updateDialogBodySx}>
                        {/* {t('2730')} */}
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            {t('2731')}
                        </Box>
                    </Typography>
                    <Typography variant="body2" sx={{ ...updateDialogBodySx, mt: '4px' }}>
                        {t('2732')}
                    </Typography>
                    <Typography variant="body2" sx={{ ...updateDialogBodySx, mt: '4px' }}>
                        {t('2737')}
                    </Typography>
                    {/* <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
                        {t('2734')}
                    </Typography> */}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: '24px', gap: '16px', px: '24px' }}>
                    <ButtonRem
                        variant="contained"
                        onClick={handleScreenDownloadUpdate}
                        sx={updateDialogPrimaryBtnSx}
                    >
                        {t('2735')}
                    </ButtonRem>
                    <ButtonRem
                        variant="outlined"
                        onClick={() => setScreenUpdateDialogOpen(false)}
                        sx={updateDialogOutlinedBtnSx}
                    >
                        {t("714")}
                    </ButtonRem>
                </DialogActions>
            </Dialog>

            {/* 升级步骤提示对话框 */}
            <Dialog
                open={upgradeStepDialogOpen}
                onClose={() => setUpgradeStepDialogOpen(false)}
                PaperProps={{
                    sx: {
                        width: '450px',
                        maxWidth: '95vw',
                        borderRadius: '12px',
                        p: '2px'
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center' }}>
                    {t("725")}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: '12px', textAlign: 'center' }}>
                        {t("726")}
                    </Typography>

                    <Box sx={{ width: '100%', my: '12px' }}>
                        <Stepper activeStep={-1} orientation="vertical">
                            {upgradeSteps.map((label, index) => (
                                <Step key={label} completed={false}>
                                    <StepLabel>
                                        <Typography variant="body1">
                                            {`${index + 1}. ${label}`}
                                        </Typography>
                                    </StepLabel>
                                </Step>
                            ))}
                        </Stepper>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: '12px' }}>
                        <ButtonRem
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleFirmwareDownload}
                            sx={{
                                minWidth: '200px',
                                py: '1px',
                                fontWeight: 'bold'
                            }}
                        >
                            {t("740")}
                        </ButtonRem>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: '12px', textAlign: 'center' }}>
                        {t("741")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: '2px' }}>
                    <ButtonRem onClick={() => setUpgradeStepDialogOpen(false)} color="inherit">
                        {t("742")}
                    </ButtonRem>
                </DialogActions>
            </Dialog>

            {!isQMK && (deviceType === 'keyboard' ? (
                <FirmwareUpgrade
                    isOpen={isUpgradeWindowOpen && keyboardUpgradeReady}
                    onClose={handleCloseUpgrade}
                    deviceInfo={{
                        vendorId: fwVid || persistedUpgrade?.deviceInfo?.vendorId || deviceVID || 0,
                        productId: fwPid || persistedUpgrade?.deviceInfo?.productId || devicePID || 0,
                        firmwareFile:
                            keyboardUpgradeTarget?.firmwareFile
                            ?? deviceUpgradeFile
                            ?? persistedUpgrade?.deviceInfo?.firmwareFile,
                        currentVersion: keyboardUpgradeCurrentVersion,
                        upgradeVersion: keyboardUpgradeTarget?.version ?? deviceUpgradeVersion,
                    }}
                />
            ) : deviceType === 'keyboard-8k' ? (
                <KeyboardFirmwareUpgrade
                    isOpen={isUpgradeWindowOpen && keyboardUpgradeReady}
                    onClose={handleCloseUpgrade}
                />
            ) : (
                <DongleFirmwareUpgrade
                    isOpen={isUpgradeWindowOpen && keyboardUpgradeReady}
                    onClose={handleCloseUpgrade}
                    deviceInfo={{
                        firmwareFile: keyboardUpgradeTarget?.firmwareFile ?? deviceUpgradeFile,
                        currentVersion: deviceVersion,
                        upgradeVersion: keyboardUpgradeTarget?.version ?? deviceUpgradeVersion,
                    }}
                />
            ))}
            {!isQMK && screenUpgradePackageReady ? (
                <ScreenFirmwareUpgrade
                    isOpen={isScreenUpgradeOpen}
                    onClose={handleCloseScreenUpgrade}
                    lcdConnected={Boolean(deviceComm && deviceStatus)}
                    screenDeviceComm={deviceComm}
                    keyboardHidForExit={connectedKeyboard?.api?.getHID()?.getWebHidDevice?.()}
                    keyboardForLightOff={connectedKeyboard}
                    keyboardForScreen={connectedKeyboard ?? undefined}
                    deviceInfo={{
                        firmwareFile: screenUpgradeTarget?.firmwareFile ?? screenFwPath,
                        imageFile: screenUpgradeTarget?.imageFile ?? (screenImagePath || undefined),
                        currentVersion: screenDeviceVersion || undefined,
                        upgradeVersion: screenUpgradeTarget?.version ?? (screenUpgradeVersionCfg || undefined),
                        vendorId: fwVid,
                        productId: fwPid,
                    }}
                />
            ) : null}
        </Box>
    );
}

function SettingCard({ children }: { children: ReactNode }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    return (
        <Box
            sx={
                isDark
                    ? {
                        background: theme.palette.background.paper,
                        borderRadius: '20px',
                        boxShadow: '0 1px 12px rgba(0, 0, 0, 0.35)',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                        px: '20px',
                        py: '16px',
                    }
                    : {
                        background:
                            'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                        borderRadius: '20px',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                        border: '1px solid rgba(153,169,191,0.22)',
                        px: '20px',
                        py: '16px',
                        backdropFilter: "blur(6px)"
                    }
            }
        >
            {children}
        </Box>
    );
}

function FirmwareCard({
    title,
    lines,
    action,
}: {
    title: string;
    lines: string[];
    action?: ReactNode;
}) {
    const theme = useTheme();
    return (
        <Box
            sx={
                theme.palette.mode === 'dark'
                    ? {
                        background: theme.palette.background.paper,
                        borderRadius: '12px',
                        boxShadow: '0 1px 12px rgba(0, 0, 0, 0.35)',
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                        px: '20px',
                        py: '18px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                    }
                    : {
                        background:
                            'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                        borderRadius: '12px',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                        border: '1px solid rgba(153,169,191,0.22)',
                        px: '20px',
                        py: '18px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: '16px',
                        backdropFilter:"blur(6px)"
                    }
            }
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: lines.length ? '3.2px' : 0 }}>
                    {title}
                </Typography>
                {lines.map((line, idx) => (
                    <Typography key={idx} sx={{ ...getSettingsRowDescriptionSx(theme) }}>
                        {line}
                    </Typography>
                ))}
            </Box>
            {action ? <Box sx={{ flexShrink: 0, pt: '2px' }}>{action}</Box> : null}
        </Box>
    );
}

function Row({
    title,
    description,
    right,
}: {
    title: string;
    description: string[];
    right?: React.ReactNode;
}) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    return (
        <Box
            sx={{
                minHeight: '60.8px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                py: '10.4px',
                background: isDark
                    ? 'transparent'
                    : 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
            }}
        >
            <Box sx={{ flex: 1, pr: '16px' }}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '3.2px' }}>{title}</Typography>
                {description.map((line, idx) => (
                    <Typography key={idx} sx={{ ...getSettingsRowDescriptionSx(theme) }}>
                        {line}
                    </Typography>
                ))}
            </Box>
            {right ? (
                <Box sx={{ minWidth: '128px', display: 'flex', justifyContent: 'flex-end', pt: '2.4px' }}>{right}</Box>
            ) : null}
        </Box>
    );
}
