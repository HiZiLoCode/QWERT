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
import { useMemo, useState } from 'react';
import { useTranslation } from '@/app/i18n';
import { ButtonRem } from '@/styled/ReconstructionRem';
import {
    findFirmwareRelease,
    getFirmwareReleasesForDevice,
    type FirmwareRelease,
} from '@/config/firmwareChangelog';

function pickChanges(release: FirmwareRelease, lang: string): string[] {
    if (lang.startsWith('en')) return release.changes.en.length ? release.changes.en : release.changes.zh;
    return release.changes.zh.length ? release.changes.zh : release.changes.en;
}

export type FirmwareChangelogSectionProps = {
    vendorId: number;
    productId: number;
    /** 与 deviceInfo key 第三段一致，一般为 deviceBaseInfo.keyboardID */
    keySegment: number;
    deviceVersion: string;
    deviceUpgradeVersion?: string;
    deviceNeedsUpgrade?: boolean;
    onCheckUpdates: () => void;
    checkingForUpdates: boolean;
};

export default function FirmwareChangelogSection({
    vendorId,
    productId,
    keySegment,
    deviceVersion,
    deviceUpgradeVersion,
    deviceNeedsUpgrade,
    onCheckUpdates,
    checkingForUpdates,
}: FirmwareChangelogSectionProps) {
    const { t, i18n } = useTranslation('common');
    const [historyOpen, setHistoryOpen] = useState(false);
    const lang = i18n.resolvedLanguage ?? i18n.language ?? 'zh';

    const releases = useMemo(
        () => getFirmwareReleasesForDevice(vendorId, productId, keySegment),
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

    const connected = vendorId > 0 && productId > 0;

    const cardSx = {
        background: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
        border: '0.0625rem solid rgba(255, 255, 255, 1)',
        px: '1.25rem',
        py: '1.125rem',
        
    } as const;

    if (!connected) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ fontSize: '0.95rem', color: '#334155', fontWeight: 600, mb: '0.5rem' }}>
                    {t('2508')}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.55 }}>{t('2527')}</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={cardSx}>
                <Typography sx={{ fontSize: '0.95rem', color: '#334155', fontWeight: 600, mb: '0.35rem' }}>
                    {t('2508')}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: '0.5rem' }}>
                    {t('2521')}: V{deviceVersion || '—'}
                    {currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: '0.35rem' }}>{t('2522')}</Typography>
                {releases.length === 0 ? (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.55 }}>{t('2531')}</Typography>
                ) : currentItems.length > 0 ? (
                    <Box
                        component="ul"
                        sx={{ m: 0, pl: '1.25rem', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.6 }}
                    >
                        {currentItems.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.55 }}>{t('2526')}</Typography>
                )}

                {deviceNeedsUpgrade && deviceUpgradeVersion && (
                    <Box sx={{ mt: '1.25rem', pt: '1rem', borderTop: '1px solid rgba(148, 163, 184, 0.2)' }}>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: '0.5rem' }}>
                            {t('2533')}: V{deviceVersion || '—'}
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#b45309', fontWeight: 600, mb: '0.35rem' }}>
                            {t('2509')}: V{deviceUpgradeVersion}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: '0.35rem' }}>{t('2529')}</Typography>
                        {upgradeItems.length > 0 ? (
                            <Box
                                component="ul"
                                sx={{ m: 0, pl: '1.25rem', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.6 }}
                            >
                                {upgradeItems.map((line, idx) => (
                                    <li key={idx}>{line}</li>
                                ))}
                            </Box>
                        ) : (
                            <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{t('2532')}</Typography>
                        )}
                    </Box>
                )}

                <Box sx={{ mt: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <ButtonRem
                        type="button"
                        onClick={onCheckUpdates}
                        disabled={checkingForUpdates}
                        sx={{
                            textTransform: 'none',
                            height: '2.25rem',
                            px: '1.25rem',
                            fontSize: '0.875rem',
                            fontWeight: 500,
                            color: '#64748b',
                            background: ' rgba(255, 255, 255, 1)',
                            border: '0.0625rem solid rgba(148, 163, 184, 0.55)',
                            borderRadius: '0.5rem',
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
                                height: '2rem',
                                px: '1rem',
                                fontSize: '0.8125rem',
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
                </Box>
            </Box>

            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '0.75rem' } }}
            >
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600, color: '#334155', pb: 10 }}>
                    {t('2530')}
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
                                    borderRadius: '0.5rem !important',
                                    mb: 10,
                                    '&:before': { display: 'none' },
                                    overflow: 'hidden',
                                    padding: '0.75rem',
                                }}
                            >
                                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />}>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.25 }}>
                                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>
                                            V{release.version}
                                            {isCurrent ? ` · ${t('2521')}` : ''}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{release.date}</Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ pt: 0 }}>
                                    {items.length > 0 ? (
                                        <Box
                                            component="ul"
                                            sx={{ m: 0, pl: '1.25rem', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.6 }}
                                        >
                                            {items.map((line, idx) => (
                                                <li key={idx}>{line}</li>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{t('2526')}</Typography>
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
