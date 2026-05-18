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
import packageJson from '../../../package.json';
import {
    WEB_DRIVER_RELEASES,
    type WebDriverRelease,
} from '@/config/webDriverChangelog';

function pickChanges(release: WebDriverRelease, lang: string): string[] {
    if (lang.startsWith('en')) return release.changes.en.length ? release.changes.en : release.changes.zh;
    return release.changes.zh.length ? release.changes.zh : release.changes.en;
}

export default function WebDriverChangelogSection() {
    const { t, i18n } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [historyOpen, setHistoryOpen] = useState(false);

    const appVersion = packageJson.version;
    const lang = i18n.resolvedLanguage ?? i18n.language ?? 'zh';

    const currentRelease = useMemo(
        () => WEB_DRIVER_RELEASES.find((r) => r.version === appVersion),
        [appVersion]
    );

    const currentItems = currentRelease ? pickChanges(currentRelease, lang) : [];

    const cardSx = useMemo(() => settingsFirmwareCardSx(theme), [theme]);

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

    return (
        <>
            <Box sx={cardSx}>
                <Typography sx={{ ...getSettingsRowTitleSx(theme), mb: '5.6px' }}>{t('2512')}</Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '8px' }}>
                    {t('2521')}: V{appVersion}
                    {currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ ...getSettingsRowDescriptionSx(theme), mb: '5.6px' }}>{t('2522')}</Typography>
                {currentItems.length > 0 ? (
                    <Box component="ul" sx={{ ...getSettingsRowListUlSx(theme) }}>
                        {currentItems.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ ...getSettingsRowDescriptionSx(theme) }}>{t('2526')}</Typography>
                )}
                {WEB_DRIVER_RELEASES.length > 0 && (
                    <Box sx={{ mt: '16px' }}>
                        <ButtonRem type="button" onClick={() => setHistoryOpen(true)} sx={historyLinkBtnSx}>
                            {t('2523')}
                        </ButtonRem>
                    </Box>
                )}
            </Box>

            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '12px' } }}
            >
                <DialogTitle sx={{ ...getSettingsRowTitleSx(theme), pb: 10 }}>{t('2524')}</DialogTitle>
                <DialogContent dividers sx={{ maxHeight: '50vh' }}>
                    {WEB_DRIVER_RELEASES.map((release) => {
                        const items = pickChanges(release, lang);
                        const isCurrent = release.version === appVersion;
                        return (
                            <Accordion
                                key={release.version}
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
