'use client';

import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from '@/app/i18n';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { MainContext } from '@/providers/MainProvider';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import {
    getSettingsRowDescriptionSx,
    getSettingsRowListUlSx,
    getSettingsRowTitleSx,
} from '@/constants/settingsPanelTypography';
import { settingsFirmwareCardSx } from '@/constants/lightingPanelChrome';
import {
    findFirmwareRelease,
    getScreenFirmwareReleasesForDevice,
    type FirmwareRelease,
} from '@/config/firmwareChangelog';
import type { KeyboardDevice } from '@/devices/KeyboardDevice';
import { connectScreenLcdWebHid } from '@/lib/screenLcdWebHidConnect';
import { notifyFirmwareUpdateAfterScreenConnect } from '@/utils/postScreenConnectFirmwareHint';
import type { ConnectScreenHidResult, FilterDevice } from '@/types/types';

function pickChanges(release: FirmwareRelease, lang: string): string[] {
    if (lang.startsWith('en')) return release.changes.en.length ? release.changes.en : release.changes.zh;
    return release.changes.zh.length ? release.changes.zh : release.changes.en;
}

export type ScreenFirmwareChangelogSectionProps = {
    vendorId: number;
    productId: number;
    keySegment: number;
    deviceVersion: string;
    deviceUpgradeVersion?: string;
    deviceNeedsUpgrade?: boolean;
    onCheckUpdates: () => void;
    checkingForUpdates: boolean;
    demoSession?: boolean;
    /** 已在设置页连接 LCD 并可读取 getScreenSize */
    lcdReady: boolean;
    /** 与动效页一致：通过键盘协议亮屏后再接 WebHID 屏幕 */
    keyboardForScreen?: KeyboardDevice;
};

export default function ScreenFirmwareChangelogSection({
    vendorId,
    productId,
    keySegment,
    deviceVersion,
    deviceUpgradeVersion,
    deviceNeedsUpgrade,
    onCheckUpdates,
    checkingForUpdates,
    demoSession = false,
    lcdReady,
    keyboardForScreen,
}: ScreenFirmwareChangelogSectionProps) {
    const { t, i18n } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { connectDevice } = useContext(MainContext);
    const { keyboard } = useContext(ConnectKbContext);
    const { onChangeTab, requestSettingsFirmwareTab } = useContext(EditorContext);
    const { showMessage, showFirmwareUpdateCard } = useSnackbarDialog();
    const [historyOpen, setHistoryOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isOpeningDevice, setIsOpeningDevice] = useState(false);
    const [openingDots, setOpeningDots] = useState(0);
    const lcdConnectLockRef = useRef(false);
    const lang = i18n.resolvedLanguage ?? i18n.language ?? 'zh';

    useEffect(() => {
        if (!isOpeningDevice) return;
        const timer = setInterval(() => {
            setOpeningDots((prev) => (prev + 1) % 3);
        }, 500);
        return () => clearInterval(timer);
    }, [isOpeningDevice]);

    const handleConnectLcd = useCallback(async () => {
        if (lcdConnectLockRef.current) return;
        lcdConnectLockRef.current = true;
        try {
            const result = await connectScreenLcdWebHid(
                connectDevice as (filter: FilterDevice[] | undefined) => Promise<ConnectScreenHidResult>,
                keyboardForScreen,
                {
                    setOpening: setIsOpeningDevice,
                    setConnecting: setIsConnecting,
                    onStartLightSequence: () => setOpeningDots(0),
                }
            );
            if (result.success) {
                const hinted = notifyFirmwareUpdateAfterScreenConnect({
                    screenInfo: result.screenInfo,
                    fwVid: vendorId,
                    fwPid: productId,
                    firmwareChangelogKeySegment: keySegment,
                    keyboardNeedsUpgrade: keyboard?.deviceNeedsUpgrade,
                    keyboardDeviceVersion: keyboard?.deviceVersion,
                    keyboardUpgradeVersion: keyboard?.deviceUpgradeVersion,
                    demoSession,
                    showFirmwareUpdateCard,
                    onNavigateToSettingsFirmware: () => {
                        onChangeTab('settings');
                        requestSettingsFirmwareTab();
                    },
                    t,
                });
                if (!hinted) {
                    showMessage({ type: 'success', message: t('92') });
                }
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
    }, [connectDevice, demoSession, keyboard?.deviceNeedsUpgrade, keyboard?.deviceUpgradeVersion, keyboard?.deviceVersion, keyboardForScreen, keySegment, onChangeTab, productId, requestSettingsFirmwareTab, showFirmwareUpdateCard, showMessage, t, vendorId]);

    const releases = useMemo(
        () => getScreenFirmwareReleasesForDevice(vendorId, productId, keySegment),
        [vendorId, productId, keySegment]
    );

    const currentRelease = useMemo(
        () => findFirmwareRelease(releases, deviceVersion),
        [releases, deviceVersion]
    );

    const upgradeRelease = useMemo(() => {
        if (!deviceNeedsUpgrade || !deviceUpgradeVersion) return undefined;
        return findFirmwareRelease(releases, deviceUpgradeVersion);
    }, [releases, deviceNeedsUpgrade, deviceUpgradeVersion]);

    const currentItems = currentRelease ? pickChanges(currentRelease, lang) : [];
    const upgradeItems = upgradeRelease ? pickChanges(upgradeRelease, lang) : [];

    const keyboardConnected = vendorId > 0 && productId > 0;

    const cardSx = useMemo(() => settingsFirmwareCardSx(theme), [theme]);

    const checkUpdatesBtnSx = useMemo(
        () => ({
            textTransform: 'none' as const,
            height: '36px',
            px: '20px',
            fontSize: '14px',
            fontWeight: 500,
            borderRadius: '8px',
            boxShadow: 'none',
            ...(isDark
                ? {
                      color: alpha(theme.palette.common.white, 0.78),
                      background: theme.palette.background.paper,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                      '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          borderColor: alpha(theme.palette.primary.main, 0.5),
                      },
                      '&.Mui-disabled': {
                          color: alpha(theme.palette.common.white, 0.35),
                          borderColor: alpha(theme.palette.common.white, 0.12),
                      },
                  }
                : {
                      color: '#64748b',
                      background: 'rgba(255, 255, 255, 1)',
                      border: '1px solid rgba(148, 163, 184, 0.55)',
                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                      '&.Mui-disabled': { color: '#94a3b8', borderColor: '#e2e8f0' },
                  }),
        }),
        [theme, isDark]
    );

    const connectLcdBtnSx = useMemo(
        () => ({
            textTransform: 'none' as const,
            height: '36px',
            px: '20px',
            fontSize: '14px',
            fontWeight: 600,
            color: theme.palette.primary.contrastText,
            bgcolor: theme.palette.primary.main,
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': { bgcolor: theme.palette.primary.dark, borderColor: theme.palette.primary.dark },
            '&.Mui-disabled': {
                color: alpha(theme.palette.primary.contrastText, 0.75),
                bgcolor: isDark ? alpha(theme.palette.primary.main, 0.45) : '#93c5fd',
                borderColor: isDark ? alpha(theme.palette.primary.main, 0.45) : '#93c5fd',
            },
        }),
        [theme, isDark]
    );

    const historyLinkBtnSx = useMemo(
        () => ({
            textTransform: 'none' as const,
            height: '32px',
            px: '16px',
            fontSize: '13px',
            fontWeight: 500,
            color: theme.palette.primary.main,
            bgcolor: 'transparent',
            border: 'none',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
        }),
        [theme]
    );

    const accordionSx = useMemo(
        () => ({
            border: `1px solid ${isDark ? alpha(theme.palette.primary.main, 0.22) : 'rgba(148, 163, 184, 0.25)'}`,
            borderRadius: '8px !important',
            mb: 10,
            '&:before': { display: 'none' },
            overflow: 'hidden',
            padding: '12px',
            ...(isDark ? { bgcolor: alpha(theme.palette.common.white, 0.03) } : {}),
        }),
        [theme, isDark]
    );

    if (demoSession) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '8px' }}>{t('2800')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2596')}</Typography>
            </Box>
        );
    }

    if (!keyboardConnected) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '8px' }}>{t('2800')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2527')}</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '5.6px' }}>{t('2800')}</Typography>
                {!lcdReady ? (
                    <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '8px' }}>{t('2841')}</Typography>
                ) : null}
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '8px' }}>
                    {t('2521')}: V{deviceVersion || '—'}
                    {lcdReady && currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '5.6px' }}>{t('2522')}</Typography>
                {releases.length === 0 ? (
                    <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2843')}</Typography>
                ) : currentItems.length > 0 ? (
                    <Box component="ul" sx={{ ...getSettingsRowListUlSx(theme) }}>
                        {currentItems.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2526')}</Typography>
                )}

                {deviceNeedsUpgrade && deviceUpgradeVersion && (
                    <Box
                        sx={{
                            mt: '20px',
                            pt: '16px',
                            borderTop: `1px solid ${isDark ? alpha(theme.palette.common.white, 0.12) : 'rgba(148, 163, 184, 0.2)'}`,
                        }}
                    >
                        <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '8px' }}>
                            {t('2533')}: V{deviceVersion || '—'}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: '14px',
                                color: theme.palette.warning.main,
                                fontWeight: 600,
                                mb: '5.6px',
                            }}
                        >
                            {t('2509')}: V{deviceUpgradeVersion}
                        </Typography>
                        <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '5.6px' }}>{t('2529')}</Typography>
                        {upgradeItems.length > 0 ? (
                            <Box component="ul" sx={{ ...getSettingsRowListUlSx(theme) }}>
                                {upgradeItems.map((line, idx) => (
                                    <li key={idx}>{line}</li>
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2532')}</Typography>
                        )}
                    </Box>
                )}

                <Box sx={{ mt: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {!lcdReady ? (
                        <ButtonRem
                            type="button"
                            onClick={handleConnectLcd}
                            disabled={isConnecting || isOpeningDevice}
                            sx={connectLcdBtnSx}
                        >
                            {isConnecting
                                ? t('151')
                                : isOpeningDevice
                                  ? `${t('2725')}${'.'.repeat(openingDots + 1)}`
                                  : t('16')}
                        </ButtonRem>
                    ) : null}
                    {lcdReady ? (
                        <>
                            <ButtonRem
                                type="button"
                                onClick={onCheckUpdates}
                                disabled={checkingForUpdates}
                                sx={checkUpdatesBtnSx}
                            >
                                {checkingForUpdates ? t('733') : t('2514')}
                            </ButtonRem>
                            {releases.length > 0 && (
                                <ButtonRem
                                    type="button"
                                    onClick={() => setHistoryOpen(true)}
                                    sx={historyLinkBtnSx}
                                >
                                    {t('2523')}
                                </ButtonRem>
                            )}
                        </>
                    ) : null}
                </Box>
            </Box>

            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '12px' } }}
            >
                <DialogTitle sx={{ ...getSettingsRowTitleSx(theme), pb: 10 }}>{t('2842')}</DialogTitle>
                <DialogContent dividers sx={{ maxHeight: '50vh' }}>
                    {releases.map((release) => {
                        const items = pickChanges(release, lang);
                        const isCurrent = release.version.toUpperCase() === deviceVersion.trim().toUpperCase();
                        return (
                            <Accordion
                                key={`${release.version}-${release.date}`}
                                disableGutters
                                elevation={0}
                                sx={accordionSx}
                            >
                                <AccordionSummary
                                    expandIcon={
                                        <ExpandMoreIcon
                                            sx={{ color: isDark ? alpha(theme.palette.common.white, 0.45) : '#64748b' }}
                                        />
                                    }
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
                                        <Typography sx={{ ...getSettingsRowTitleSx(theme) }}>
                                            V{release.version}
                                            {isCurrent ? ` · ${t('2521')}` : ''}
                                        </Typography>
                                        <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{release.date}</Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    {items.length > 0 ? (
                                        <Box component="ul" sx={{ ...getSettingsRowListUlSx(theme) }}>
                                            {items.map((line, idx) => (
                                                <li key={idx}>{line}</li>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2526')}</Typography>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        );
                    })}
                </DialogContent>
                <DialogActions sx={{ px: 2, pb: 2 }}>
                    <ButtonRem onClick={() => setHistoryOpen(false)} sx={{ textTransform: 'none' }}>
                        {t('2525')}
                    </ButtonRem>
                </DialogActions>
            </Dialog>
        </>
    );
}
