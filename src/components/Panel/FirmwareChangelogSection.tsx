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
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from '@/app/i18n';
import { ButtonRem } from '@/styled/ReconstructionRem';
import {
    getSettingsRowDescriptionSx,
    getSettingsRowListUlSx,
    getSettingsRowTitleSx,
} from '@/constants/settingsPanelTypography';
import { settingsFirmwareCardSx } from '@/constants/lightingPanelChrome';
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
    /** 演示模式：不展示按 VID/PID 查到的量产固件说明（避免误以为来自真实设备） */
    demoSession?: boolean;
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
    demoSession = false,
}: FirmwareChangelogSectionProps) {
    const { t, i18n } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
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
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '8px' }}>{t('737')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2596')}</Typography>
            </Box>
        );
    }

    if (!connected) {
        return (
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '8px' }}>{t('2508')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2527')}</Typography>
            </Box>
        );
    }

    return (
        <>
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '5.6px' }}>{t('2508')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '8px' }}>
                    {t('2521')}: V{deviceVersion || '—'}
                    {currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '5.6px' }}>{t('2522')}</Typography>
                {releases.length === 0 ? (
                    <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2531')}</Typography>
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
                </Box>
            </Box>

            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '12px' } }}
            >
                <DialogTitle sx={{ ...getSettingsRowTitleSx(theme), pb: 10 }}>{t('2530')}</DialogTitle>
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
