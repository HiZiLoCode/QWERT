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
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { MainContext } from '@/providers/MainProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import ResetProgress from '../ResetProgress';
import WebDriverChangelogSection from './WebDriverChangelogSection';
import FirmwareChangelogSection from './FirmwareChangelogSection';
import ScreenFirmwareChangelogSection from './ScreenFirmwareChangelogSection';
import { getScreenFirmwareFile, getScreenImageFile, getScreenUpgradeVersion } from '@/config/deviceInfo';
import FirmwareUpgrade from '@/components/common/FirmwareUpgrade';
import ScreenFirmwareUpgrade from '@/components/common/ScreenFirmwareUpgrade';
import DongleFirmwareUpgrade from '@/components/common/DongleFirmwareUpgrade';
import KeyboardFirmwareUpgrade from '@/components/common/KeyboardFirmwareUpgrade';
import ToggleSlider from '@/components/common/ToggleSlider';
import { useTranslation } from '@/app/i18n';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';

/** 与 KeyboardDevice 中扩展功能区 PID 一致，用于设置项显隐 */
const PID_EXTENDED_FUNC_LAYOUT = 0x3059;

type SettingTab = 'settings' | 'firmware';

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
    const { showMessage } = useSnackbarDialog();
    const [tab, setTab] = useState<SettingTab>('settings');
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
        screenUpgradeVersionCfg &&
            screenDeviceVersion &&
            parseInt(screenDeviceVersion, 10) < parseInt(screenUpgradeVersionCfg, 10)
    );

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [checkingForUpdates, setCheckingForUpdates] = useState(false);
    const [upgradeStepDialogOpen, setUpgradeStepDialogOpen] = useState(false);
    const [screenUpdateDialogOpen, setScreenUpdateDialogOpen] = useState(false);
    const [isScreenUpgradeOpen, setIsScreenUpgradeOpen] = useState(false);
    const [checkingScreenUpdates, setCheckingScreenUpdates] = useState(false);

    const upgradeSteps = [
        t("727"),
        t("728"),
        t("730")
    ];

    const checkForUpdates = () => {
        if (deviceNeedsUpgrade) {
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
        if (screenNeedsUpgrade) {
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
        setUpdateDialogOpen(false);
        setIsUpgradeWindowOpen?.(true);
    };

    const handleScreenDownloadUpdate = () => {
        setScreenUpdateDialogOpen(false);
        setIsScreenUpgradeOpen(true);
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

    const supportsNumLockMode =
        (connectedKeyboard?.productId ?? productId ?? 0) === PID_EXTENDED_FUNC_LAYOUT;

    const selectSx = {
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
        '& .MuiSelect-icon': {
            color: '#3b82f6',
            right: '8px',
        },
    } as const;

    const selectMenuProps = {
        PaperProps: {
            sx: {
                mt: '4px',
                borderRadius: '8px',
                border: '1px solid rgba(22, 108, 230, 0.35)',
                boxShadow: '0 6px 18px rgba(15, 23, 42, 0.12)',
                overflow: 'hidden',
            },
        },
        MenuListProps: {
            sx: {
                py: 0,
            },
        },
    } as const;

    const selectItemSx = {
        fontSize: '14px',
        color: '#64748b',
        minHeight: '36px',
        backgroundColor: '#ffffff',
        '&:hover': {
            border: '1px solid rgb(22, 109, 230)',
        },
        '&.Mui-selected': {
            bgcolor: '#3b82f6',
            color: '#fff',
        },
        '&.Mui-selected:hover': {
            border: '1px solid rgb(22, 109, 230)',
            color: '#fff',
        },
    } as const;

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
            <Box
                sx={{
                    width: '250px',
                    border: '1px solid rgba(153,169,191,.25)',
                    borderRadius: '12px',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                    boxShadow: 'rgba(176, 206, 255, 0.5) 0px 0px 21px',
                    p: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8.8px',
                    height: '100%',
                }}
            >
                <ButtonRem
                    data-setting-tab="settings"
                    onClick={() => setTab('settings')}
                    sx={{
                        textTransform: 'none',
                        borderRadius: '7.2px',
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: tab === 'settings' ? '#fff' : '#596d88',
                        bgcolor: tab === 'settings' ? '#3B82F6' : 'transparent',
                        border: '1px solid',
                        borderColor: tab === 'settings' ? '#3B82F6' : 'transparent',
                        '&:hover': {
                            bgcolor: tab === 'settings' ? '#2f70dc' : 'rgba(59,130,246,0.08)',
                        },
                    }}
                >
                    {t('2500')}
                </ButtonRem>
                <ButtonRem
                    data-setting-tab="firmware"
                    onClick={() => setTab('firmware')}
                    sx={{
                        textTransform: 'none',
                        borderRadius: '7.2px',
                        height: '48px',
                        fontSize: '16px',
                        fontWeight: 600,
                        color: tab === 'firmware' ? '#fff' : '#596d88',
                        bgcolor: tab === 'firmware' ? '#3B82F6' : 'transparent',
                        border: '1px solid',
                        borderColor: tab === 'firmware' ? '#3B82F6' : 'transparent',
                        '&:hover': {
                            bgcolor: tab === 'firmware' ? '#2f70dc' : 'rgba(59,130,246,0.08)',
                        },
                    }}
                >
                    {t('2501')}
                </ButtonRem>
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
                }}
            >
                {tab === 'settings' ? (
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
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <FirmwareCard
                            title={t('710')}
                            lines={[t('2507')]}
                            action={
                                <ButtonRem
                                    onClick={() => setResetConfirmOpen(true)}
                                    sx={{
                                        textTransform: 'none',
                                        height: '36px',
                                        px: '20px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: '#64748b',
                                        bgcolor: ' rgba(255, 255, 255, 1)',
                                        border: '1px solid rgba(148, 163, 184, 0.55)',
                                        borderRadius: '8px',
                                        boxShadow: 'none',
                                        '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                                    }}
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
                            deviceNeedsUpgrade={Boolean(deviceNeedsUpgrade)}
                            onCheckUpdates={checkForUpdates}
                            checkingForUpdates={checkingForUpdates}
                            demoSession={isDemoFirmwareSession}
                        />
                        {screenFwPath ? (
                            <ScreenFirmwareChangelogSection
                                vendorId={fwVid}
                                productId={fwPid}
                                keySegment={firmwareChangelogKeySegment}
                                deviceVersion={screenDeviceVersion}
                                deviceUpgradeVersion={screenUpgradeVersionCfg || undefined}
                                deviceNeedsUpgrade={screenNeedsUpgrade}
                                onCheckUpdates={checkScreenForUpdates}
                                checkingForUpdates={checkingScreenUpdates}
                                demoSession={isDemoFirmwareSession}
                                lcdReady={lcdReady}
                                keyboardForScreen={connectedKeyboard}
                            />
                        ) : null}
                        <WebDriverChangelogSection />
                    </Box>
                )}
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
                <DialogTitle sx={{ textAlign: 'center', pb: 0, pt: '24px', fontSize: '20px', fontWeight: 700, color: '#5d6f8a' }}>
                    {t("712")}
                </DialogTitle>
                <DialogContent sx={{ px: '24px', pt: '12px', pb: '8px' }}>
                    <Typography variant="body2" component="div" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center' }}>
                        {t('2730')}
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            {t('2731')}
                        </Box>
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
                        {t('2732')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
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
                        sx={{
                            minWidth: '96px',
                            height: '35.2px',
                            bgcolor: '#3B82F6',
                            color: '#fff',
                            fontSize: '18px',
                            '&:hover': { bgcolor: '#2f70dc' }
                        }}
                    >
                        {t('2735')}
                    </ButtonRem>
                    <ButtonRem
                        variant="outlined"
                        onClick={() => setUpdateDialogOpen(false)}
                        sx={{
                            minWidth: '96px',
                            height: '35.2px',
                            borderColor: 'rgba(148, 163, 184, 0.65)',
                            color: '#64748b',
                            fontSize: '18px',
                            '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(148, 163, 184, 0.06)' }
                        }}
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
                <DialogTitle sx={{ textAlign: 'center', pb: 0, pt: '24px', fontSize: '20px', fontWeight: 700, color: '#5d6f8a' }}>
                    {t('2800')}
                </DialogTitle>
                <DialogContent sx={{ px: '24px', pt: '12px', pb: '8px' }}>
                    <Typography variant="body2" component="div" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center' }}>
                        {t('2730')}
                        <Box component="span" sx={{ color: 'primary.main', fontWeight: 600 }}>
                            {t('2731')}
                        </Box>
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
                        {t('2732')}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#334155', fontSize: '16px', lineHeight: 1.75, textAlign: 'center', mt: '4px' }}>
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
                        sx={{
                            minWidth: '96px',
                            height: '35.2px',
                            bgcolor: '#3B82F6',
                            color: '#fff',
                            fontSize: '18px',
                            '&:hover': { bgcolor: '#2f70dc' }
                        }}
                    >
                        {t('2735')}
                    </ButtonRem>
                    <ButtonRem
                        variant="outlined"
                        onClick={() => setScreenUpdateDialogOpen(false)}
                        sx={{
                            minWidth: '96px',
                            height: '35.2px',
                            borderColor: 'rgba(148, 163, 184, 0.65)',
                            color: '#64748b',
                            fontSize: '18px',
                            '&:hover': { borderColor: '#94a3b8', bgcolor: 'rgba(148, 163, 184, 0.06)' }
                        }}
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

            {deviceType === 'keyboard' ? (
                <FirmwareUpgrade
                    isOpen={isUpgradeWindowOpen}
                    onClose={handleCloseUpgrade}
                    deviceInfo={{
                        vendorId: vendorId || 0,
                        productId: productId || 0,
                        firmwareFile: deviceUpgradeFile,
                        currentVersion: deviceVersion,
                        upgradeVersion: deviceUpgradeVersion,
                    }}
                />
            ) : deviceType === 'keyboard-8k' ? (
                <KeyboardFirmwareUpgrade
                    isOpen={isUpgradeWindowOpen}
                    onClose={handleCloseUpgrade}
                />
            ) : (
                <DongleFirmwareUpgrade
                    isOpen={isUpgradeWindowOpen}
                    onClose={handleCloseUpgrade}
                    deviceInfo={{
                        firmwareFile: deviceUpgradeFile,
                        currentVersion: deviceVersion,
                        upgradeVersion: deviceUpgradeVersion,
                    }}
                />
            )}
            {screenFwPath ? (
                <ScreenFirmwareUpgrade
                    isOpen={isScreenUpgradeOpen}
                    onClose={() => setIsScreenUpgradeOpen(false)}
                    lcdConnected={Boolean(deviceComm && deviceStatus)}
                    screenDeviceComm={deviceComm}
                    keyboardHidForExit={connectedKeyboard?.api?.getHID()?.getWebHidDevice?.()}
                    keyboardForLightOff={connectedKeyboard}
                    keyboardForScreen={connectedKeyboard ?? undefined}
                    deviceInfo={{
                        firmwareFile: screenFwPath,
                        imageFile: screenImagePath || undefined,
                        currentVersion: screenDeviceVersion || undefined,
                        upgradeVersion: screenUpgradeVersionCfg || undefined,
                        vendorId: fwVid,
                        productId: fwPid,
                    }}
                />
            ) : null}
        </Box>
    );
}

function SettingCard({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                borderRadius: '20px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                border: '1px solid rgba(255, 255, 255, 1)',
                px: '20px',
                py: '16px',
            }}
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
    return (
        <Box
            sx={{
                background: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                border: '1px solid rgba(255, 255, 255, 1)',
                px: '20px',
                py: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '15px', color: '#334155', mb: lines.length ? '5.6px' : 0, fontWeight: 600 }}>
                    {title}
                </Typography>
                {lines.map((line, idx) => (
                    <Typography key={idx} sx={{ fontSize: '13px', color: '#64748b', lineHeight: 1.55 }}>
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
    return (
        <Box
            sx={{
                minHeight: '60.8px',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
                py: '10.4px',
                background:"linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)"
            }}
        >
            <Box sx={{ flex: 1, pr: '16px' }}>
                <Typography sx={{ fontSize: '18px', color: '#5d6f8a', mb: '3.2px', fontWeight: 600 }}>
                    {title}
                </Typography>
                {description.map((line, idx) => (
                    <Typography key={idx} sx={{ fontSize: '14px', color: '#8a98ad', lineHeight: 1.55 }}>
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
