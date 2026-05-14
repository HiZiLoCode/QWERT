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
import { useTranslation } from '@/app/i18n';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { MainContext } from '@/providers/MainProvider';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import {
    findFirmwareRelease,
    getScreenFirmwareReleasesForDevice,
    type FirmwareRelease,
} from '@/config/firmwareChangelog';
import type { KeyboardDevice } from '@/devices/KeyboardDevice';
import { connectScreenLcdWebHid } from '@/lib/screenLcdWebHidConnect';
import type { FilterDevice } from '@/types/types';

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
    const { connectDevice } = useContext(MainContext);
    const { showMessage } = useSnackbarDialog();
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
            const ok = await connectScreenLcdWebHid(
                connectDevice as (filter: FilterDevice[] | undefined) => Promise<boolean>,
                keyboardForScreen,
                {
                    setOpening: setIsOpeningDevice,
                    setConnecting: setIsConnecting,
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
    }, [connectDevice, keyboardForScreen, showMessage, t]);

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

    const cardSx = {
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        border: '1px solid rgba(255, 255, 255, 1)',
        px: '20px',
        py: '18px',
    } as const;

    if (demoSession) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ fontSize: '15px', color: '#334155', fontWeight: 600, mb: '8px' }}>
                    {t('2800')}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55 }}>{t('2596')}</Typography>
            </Box>
        );
    }

    if (!keyboardConnected) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ fontSize: '15px', color: '#334155', fontWeight: 600, mb: '8px' }}>
                    {t('2800')}
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55 }}>{t('2527')}</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={cardSx}>
                <Typography sx={{ fontSize: '15px', color: '#334155', fontWeight: 600, mb: '5.6px' }}>
                    {t('2800')}
                </Typography>
                {!lcdReady ? (
                    <Typography sx={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55, mb: '8px' }}>
                        {t('2841')}
                    </Typography>
                ) : null}
                <Typography sx={{ fontSize: '13px', color: '#64748b', mb: '8px' }}>
                    {t('2521')}: V{deviceVersion || '—'}
                    {lcdReady && currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#94a3b8', mb: '5.6px' }}>{t('2522')}</Typography>
                {releases.length === 0 ? (
                    <Typography sx={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55 }}>{t('2843')}</Typography>
                ) : currentItems.length > 0 ? (
                    <Box
                        component="ul"
                        sx={{ m: 0, pl: '20px', color: '#475569', fontSize: '13px', lineHeight: 1.6 }}
                    >
                        {currentItems.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.55 }}>{t('2526')}</Typography>
                )}

                {deviceNeedsUpgrade && deviceUpgradeVersion && (
                    <Box sx={{ mt: '20px', pt: '16px', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                        <Typography sx={{ fontSize: '13px', color: '#64748b', mb: '8px' }}>
                            {t('2533')}: V{deviceVersion || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '13px', color: '#b45309', fontWeight: 600, mb: '5.6px' }}>
                            {t('2509')}: V{deviceUpgradeVersion}
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#94a3b8', mb: '5.6px' }}>{t('2529')}</Typography>
                        {upgradeItems.length > 0 ? (
                            <Box
                                component="ul"
                                sx={{ m: 0, pl: '20px', color: '#475569', fontSize: '13px', lineHeight: 1.6 }}
                            >
                                {upgradeItems.map((line, idx) => (
                                    <li key={idx}>{line}</li>
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ fontSize: '13px', color: '#94a3b8' }}>{t('2532')}</Typography>
                        )}
                    </Box>
                )}

                <Box sx={{ mt: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {!lcdReady ? (
                        <ButtonRem
                            type="button"
                            onClick={handleConnectLcd}
                            disabled={isConnecting || isOpeningDevice}
                            sx={{
                                textTransform: 'none',
                                height: '36px',
                                px: '20px',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#fff',
                                bgcolor: '#3B82F6',
                                border: '1px solid #3B82F6',
                                borderRadius: '8px',
                                boxShadow: 'none',
                                '&:hover': { bgcolor: '#2f70dc', borderColor: '#2f70dc' },
                                '&.Mui-disabled': { color: 'rgba(255,255,255,0.75)', bgcolor: '#93c5fd', borderColor: '#93c5fd' },
                            }}
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
                                sx={{
                                    textTransform: 'none',
                                    height: '36px',
                                    px: '20px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    color: '#64748b',
                                    background: ' rgba(255, 255, 255, 1)',
                                    border: '1px solid rgba(148, 163, 184, 0.55)',
                                    borderRadius: '8px',
                                    boxShadow: 'none',
                                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                                    '&.Mui-disabled': { color: '#94a3b8', borderColor: '#e2e8f0' },
                                }}
                            >
                                {checkingForUpdates ? t('733') : t('2514')}
                            </ButtonRem>
                            {releases.length > 0 && (
                                <ButtonRem
                                    type="button"
                                    onClick={() => setHistoryOpen(true)}
                                    sx={{
                                        textTransform: 'none',
                                        height: '32px',
                                        px: '16px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        color: '#3b82f6',
                                        bgcolor: 'transparent',
                                        border: 'none',
                                        '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.08)' },
                                    }}
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
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#334155', pb: 10 }}>
                    {t('2842')}
                </DialogTitle>
                <DialogContent dividers sx={{ maxHeight: '50vh' }}>
                    {releases.map((release) => {
                        const items = pickChanges(release, lang);
                        const isCurrent = release.version.toUpperCase() === deviceVersion.trim().toUpperCase();
                        return (
                            <Accordion
                                key={`${release.version}-${release.date}`}
                                disableGutters
                                elevation={0}
                                sx={{
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    borderRadius: '8px !important',
                                    mb: 10,
                                    '&:before': { display: 'none' },
                                    overflow: 'hidden',
                                    padding: '12px',
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                                            V{release.version}
                                            {isCurrent ? ` · ${t('2521')}` : ''}
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#94a3b8' }}>{release.date}</Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    {items.length > 0 ? (
                                        <Box
                                            component="ul"
                                            sx={{ m: 0, pl: '20px', color: '#475569', fontSize: '13px', lineHeight: 1.6 }}
                                        >
                                            {items.map((line, idx) => (
                                                <li key={idx}>{line}</li>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: '13px', color: '#94a3b8' }}>{t('2526')}</Typography>
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
