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
    Switch,
    Typography,
    Snackbar,
    Stepper,
    Step,
    StepLabel,
    IconButton,

} from '@mui/material';
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import ResetProgress from '../ResetProgress';
import WebDriverChangelogSection from './WebDriverChangelogSection';
import FirmwareChangelogSection from './FirmwareChangelogSection';
import FirmwareUpgrade from '@/components/common/FirmwareUpgrade';
import DongleFirmwareUpgrade from '@/components/common/DongleFirmwareUpgrade';
import KeyboardFirmwareUpgrade from '@/components/common/KeyboardFirmwareUpgrade';
import { useTranslation } from '@/app/i18n';

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
    const [tab, setTab] = useState<SettingTab>('settings');
    const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

    const [nkroEnabled, setNkroEnabled] = useState(false);
    const [winDisabled, setWinDisabled] = useState(false);
    const [macMode, setMacMode] = useState(false);
    const [keyWasd, setKeyWasd] = useState(false);
    const [snapTap, setSnapTap] = useState(false);
    const [, setFMode] = useState(false);
    const [, setScrollMode] = useState(false);
    const [numLockInvert, setNumLockInvert] = useState(false);

    const [keyDelay, setKeyDelay] = useState(0);
    const [sleepMinutes, setSleepMinutes] = useState(5);
    const [deepSleepMinutes, setDeepSleepMinutes] = useState(30);
    const sleepOptions = [1, 3, 5, 10, 20, 30, 45, 60];
    const [showResetProgress, setShowResetProgress] = useState(false);

    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');

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

    const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
    const [checkingForUpdates, setCheckingForUpdates] = useState(false);
    const [upgradeStepDialogOpen, setUpgradeStepDialogOpen] = useState(false);

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
                setSnackbarOpen(true);
                setSnackbarMessage(t("731"));
            }, 1000);
        }
    };

    const handleDownloadUpdate = () => {
        setUpdateDialogOpen(false);
        setIsUpgradeWindowOpen?.(true);
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
        setSnackbarOpen(true);
        setSnackbarMessage(t("732"));
    };

    const normalizeSleepMinute = (value: number, fallback: number) => {
        if (sleepOptions.includes(value)) return value;
        return fallback;
    };

    const isDemoMode = Boolean(connectedKeyboard?.api?.test);
    const funcInfo = keyboard?.deviceFuncInfo ?? {};

    useEffect(() => {
        setNkroEnabled((funcInfo?.sixKeysOrAllKeys ?? 0) === 1);
        setWinDisabled((funcInfo?.winLock ?? 0) === 1);
        setMacMode((funcInfo?.maxOrWin ?? 0) === 1);
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

    const switchSx = {
        '& .MuiSwitch-switchBase.Mui-checked': { color: '#fff' },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
            backgroundColor: '#3b82f6',
            opacity: 1,
        },
        '& .MuiSwitch-track': { backgroundColor: '#e2e8f0', opacity: 1 },
    } as const;

    const selectSx = {
        minWidth: '7.5rem',
        height: '2.25rem',
        fontSize: '0.875rem',
        color: '#64748b',
        bgcolor: 'rgba(255, 255, 255, 1)',
        borderRadius: '0.5rem',
        transition: 'all 0.18s ease',
        '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255, 255, 255, 1)' },
        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#93a5be' },
        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#3b82f6',
            borderWidth: '1px',
        },
        '& .MuiSelect-select': {
            py: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pr: '1.75rem',
        },
        '& .MuiSelect-icon': {
            color: '#3b82f6',
            right: '0.5rem',
        },
    } as const;

    const selectMenuProps = {
        PaperProps: {
            sx: {
                mt: '0.25rem',
                borderRadius: '0.5rem',
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
        fontSize: '0.875rem',
        color: '#64748b',
        minHeight: '2.25rem',
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
            gap: '1rem',
            p: '1rem',
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
                    width: '14.25rem',
                    minWidth: '14.25rem',
                    border: '0.0625rem solid rgba(153,169,191,.25)',
                    borderRadius: '0.75rem',
                    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                    boxShadow: 'rgba(176, 206, 255, 0.5) 0rem 0rem 1.3125rem',
                    p: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.55rem',
                    height: '100%',
                }}
            >
                <ButtonRem
                    data-setting-tab="settings"
                    onClick={() => setTab('settings')}
                    sx={{
                        textTransform: 'none',
                        borderRadius: '0.45rem',
                        height: '3rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: tab === 'settings' ? '#fff' : '#596d88',
                        bgcolor: tab === 'settings' ? '#3B82F6' : 'transparent',
                        border: '0.0625rem solid',
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
                        borderRadius: '0.45rem',
                        height: '3rem',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: tab === 'firmware' ? '#fff' : '#596d88',
                        bgcolor: tab === 'firmware' ? '#3B82F6' : 'transparent',
                        border: '0.0625rem solid',
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
                    borderRadius: '0.75rem',
                    p: '1.25rem',
                    minHeight: 0,
                    m: '0 auto',
                    width: '100%',
                    maxWidth: '75%',
                    overflowY: 'auto',
                }}
            >
                {tab === 'settings' ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <SettingCard>
                            <Row
                                title={t('770')}
                                description={[t('771'), t('1492')]}
                                right={
                                    <Switch
                                        checked={nkroEnabled}
                                        onChange={(_, checked) => {
                                            setNkroEnabled(checked);
                                            updateFuncInfo({ sixKeysOrAllKeys: checked ? 1 : 0 });
                                        }}
                                        sx={switchSx}
                                    />
                                }
                            />
                        </SettingCard>

                        <SettingCard>
                            <Row
                                title={t('772')}
                                description={[t('773')]}
                                right={
                                    <Switch
                                        checked={winDisabled}
                                        disabled={macMode}
                                        onChange={(_, checked) => {
                                            setWinDisabled(checked);
                                            updateFuncInfo({ winLock: checked ? 1 : 0 });
                                        }}
                                        sx={switchSx}
                                    />
                                }
                            />
                        </SettingCard>

                        {supportsNumLockMode && (
                            <SettingCard>
                                <Row
                                    title={t('2502')}
                                    description={[t('2503')]}
                                    right={
                                        <Switch
                                            checked={numLockInvert}
                                            onChange={(_, checked) => {
                                                setNumLockInvert(checked);
                                                updateFuncInfo({ numLockMode: checked ? 1 : 0 });
                                            }}
                                            sx={switchSx}
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
                                    <Switch
                                        checked={snapTap}
                                        onChange={(_, checked) => {
                                            setSnapTap(checked);
                                            updateFuncInfo({ snapTap: checked ? 1 : 0 });
                                        }}
                                        sx={switchSx}
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
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <FirmwareCard
                            title={t('710')}
                            lines={[t('2507')]}
                            action={
                                <ButtonRem
                                    onClick={() => setResetConfirmOpen(true)}
                                    sx={{
                                        textTransform: 'none',
                                        height: '2.25rem',
                                        px: '1.25rem',
                                        fontSize: '0.875rem',
                                        fontWeight: 500,
                                        color: '#64748b',
                                        bgcolor: ' rgba(255, 255, 255, 1)',
                                        border: '0.0625rem solid rgba(148, 163, 184, 0.55)',
                                        borderRadius: '0.5rem',
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
                        />
                        <WebDriverChangelogSection />
                    </Box>
                )}
            </Box>
            <Dialog onClose={() => setResetConfirmOpen(false)} open={resetConfirmOpen}>
                <DialogTitle>{t("712")}</DialogTitle>
                <IconButton
                    aria-label="close"
                    onClick={() => setResetConfirmOpen(false)}
                    sx={{ position: 'absolute', right: '0.0625rem', top: '0.0625rem', color: 'grey.500' }}
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
                        width: '22.5rem',
                        height: '12.5rem',
                        maxWidth: '22.5rem',
                        maxHeight: '12.5rem',
                        borderRadius: '0.75rem',
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center', pb: 0, pt: '1.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#5d6f8a' }}>{t("720")}</DialogTitle>
                <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', px: '1.5rem' }}>
                    <Typography variant="body1" align="center" sx={{ color: '#7a8ca7', fontSize: '0.9rem' }}>
                        {t("722")} v{deviceUpgradeVersion}?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: '1.5rem', gap: '1rem' }}>
                    <ButtonRem
                        variant="contained"
                        onClick={handleDownloadUpdate}
                        sx={{
                            minWidth: '6rem',
                            height: '2.2rem',
                            bgcolor: '#3B82F6',
                            color: '#fff',
                            fontSize: '0.85rem',
                            '&:hover': { bgcolor: '#2f70dc' }
                        }}
                    >
                        {t("723")}
                    </ButtonRem>
                    <ButtonRem
                        variant="outlined"
                        onClick={() => setUpdateDialogOpen(false)}
                        sx={{
                            minWidth: '6rem',
                            height: '2.2rem',
                            borderColor: '#3B82F6',
                            color: '#3B82F6',
                            fontSize: '0.85rem',
                            '&:hover': { borderColor: '#2f70dc', bgcolor: 'rgba(59,130,246,0.04)' }
                        }}
                    >
                        {t("724")}
                    </ButtonRem>
                </DialogActions>
            </Dialog>

            {/* 升级步骤提示对话框 */}
            <Dialog
                open={upgradeStepDialogOpen}
                onClose={() => setUpgradeStepDialogOpen(false)}
                PaperProps={{
                    sx: {
                        width: '28.125rem',
                        maxWidth: '95vw',
                        borderRadius: '0.75rem',
                        p: '0.125rem'
                    }
                }}
            >
                <DialogTitle sx={{ textAlign: 'center' }}>
                    {t("725")}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: '0.75rem', textAlign: 'center' }}>
                        {t("726")}
                    </Typography>

                    <Box sx={{ width: '100%', my: '0.75rem' }}>
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

                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: '0.75rem' }}>
                        <ButtonRem
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleFirmwareDownload}
                            sx={{
                                minWidth: '12.5rem',
                                py: '0.0625rem',
                                fontWeight: 'bold'
                            }}
                        >
                            {t("740")}
                        </ButtonRem>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: '0.75rem', textAlign: 'center' }}>
                        {t("741")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', pb: '0.125rem' }}>
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
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={3000}
                onClose={() => setSnackbarOpen(false)}
                message={snackbarMessage}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            />
        </Box>
    );
}

function SettingCard({ children }: { children: ReactNode }) {
    return (
        <Box
            sx={{
                bgcolor: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                borderRadius: '1.25rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                border: '0.0625rem solid rgba(255, 255, 255, 1)',
                px: '1.25rem',
                py: '1rem',
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
                bgcolor: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
                borderRadius: '0.75rem',
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                border: '0.0625rem solid rgba(255, 255, 255, 1)',
                px: '1.25rem',
                py: '1.125rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
            }}
        >
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '0.95rem', color: '#334155', mb: lines.length ? '0.35rem' : 0, fontWeight: 600 }}>
                    {title}
                </Typography>
                {lines.map((line, idx) => (
                    <Typography key={idx} sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55 }}>
                        {line}
                    </Typography>
                ))}
            </Box>
            {action ? <Box sx={{ flexShrink: 0, pt: '0.125rem' }}>{action}</Box> : null}
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
    right: React.ReactNode;
}) {
    return (
        <Box
            sx={{
                minHeight: '3.8rem',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                py: '0.65rem',
                bgColor:"linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)"
            }}
        >
            <Box sx={{ flex: 1, pr: '1rem' }}>
                <Typography sx={{ fontSize: '0.95rem', color: '#5d6f8a', mb: '0.2rem', fontWeight: 600 }}>
                    {title}
                </Typography>
                {description.map((line, idx) => (
                    <Typography key={idx} sx={{ fontSize: '0.73rem', color: '#8a98ad', lineHeight: 1.55 }}>
                        {line}
                    </Typography>
                ))}
            </Box>
            <Box sx={{ minWidth: '8rem', display: 'flex', justifyContent: 'flex-end', pt: '0.15rem' }}>{right}</Box>
        </Box>
    );
}
