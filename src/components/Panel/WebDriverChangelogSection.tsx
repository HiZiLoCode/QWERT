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
    const [historyOpen, setHistoryOpen] = useState(false);

    const appVersion = packageJson.version;
    const lang = i18n.resolvedLanguage ?? i18n.language ?? 'zh';

    const currentRelease = useMemo(
        () => WEB_DRIVER_RELEASES.find((r) => r.version === appVersion),
        [appVersion]
    );

    const currentItems = currentRelease ? pickChanges(currentRelease, lang) : [];

    return (
        <>
            <Box
                sx={{
                    bgcolor: 'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%);',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
                    border: '0.0625rem solid rgba(255, 255, 255, 1)',
                    px: '1.25rem',
                    py: '1.125rem',
                }}
            >
                <Typography sx={{ fontSize: '0.95rem', color: '#334155', fontWeight: 600, mb: '0.35rem' }}>
                    {t('2512')}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mb: '0.5rem' }}>
                    {t('2521')}: V{appVersion}
                    {currentRelease?.date ? ` · ${currentRelease.date}` : null}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mb: '0.35rem' }}>
                    {t('2522')}
                </Typography>
                {currentItems.length > 0 ? (
                    <Box component="ul" sx={{ m: 0, pl: '1.25rem', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.6 }}>
                        {currentItems.map((line, idx) => (
                            <li key={idx}>{line}</li>
                        ))}
                    </Box>
                ) : (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', lineHeight: 1.55 }}>
                        {t('2526')}
                    </Typography>
                )}
                {WEB_DRIVER_RELEASES.length > 0 && (
                    <Box sx={{ mt: '1rem' }}>
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
                    </Box>
                )}
            </Box>

            <Dialog
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '0.75rem' } }}
            >
                <DialogTitle sx={{ fontSize: '1rem', fontWeight: 600, color: '#334155', pb: 10 }}>
                    {t('2524')}
                </DialogTitle>
                <DialogContent dividers sx={{ maxHeight: '50vh' }}>
                    {WEB_DRIVER_RELEASES.map((release) => {
                        const items = pickChanges(release, lang);
                        const isCurrent = release.version === appVersion;
                        return (
                            <Accordion
                                key={release.version}
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
                                        <Box component="ul" sx={{ m: 0, pl: '1.25rem', color: '#475569', fontSize: '0.8125rem', lineHeight: 1.6 }}>
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
