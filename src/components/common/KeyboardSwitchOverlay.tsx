'use client';

import { Box, Fade, LinearProgress, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from '@/app/i18n';

type KeyboardSwitchOverlayProps = {
  open: boolean;
  progress: number;
  deviceName?: string;
};

export default function KeyboardSwitchOverlay({
  open,
  progress,
  deviceName,
}: KeyboardSwitchOverlayProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const isDark = theme.palette.mode === 'dark';
  const primaryColor = theme.palette.primary.main;
  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <Fade in={open} timeout={{ enter: 220, exit: 280 }} unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'auto',
          bgcolor: isDark ? alpha('#000', 0.55) : alpha('#f8fafc', 0.72),
          backdropFilter: 'blur(10px)',
        }}
      >
        <Box
          sx={{
            width: 'min(420px, calc(100vw - 48px))',
            px: '28px',
            py: '24px',
            borderRadius: '16px',
            border: `1px solid ${alpha(primaryColor, isDark ? 0.45 : 0.28)}`,
            bgcolor: isDark ? alpha(theme.palette.background.paper, 0.92) : 'rgba(255,255,255,0.96)',
            boxShadow: isDark
              ? '0 18px 48px rgba(0,0,0,0.45)'
              : '0 16px 40px rgba(15,23,42,0.12)',
          }}
        >
          <Typography sx={{ fontSize: '18px', fontWeight: 700, color: 'text.primary', mb: '6px' }}>
            {t('2975')}
          </Typography>
          <Typography sx={{ fontSize: '14px', color: 'text.secondary', mb: '18px', lineHeight: 1.5 }}>
            {deviceName
              ? t('2976', { name: deviceName })
              : t('2977')}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '10px' }}>
            <Typography sx={{ fontSize: '13px', color: 'text.secondary' }}>
              {t('2978')}
            </Typography>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: primaryColor }}>
              {Math.round(clampedProgress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={clampedProgress}
            sx={{
              height: 8,
              borderRadius: '6px',
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: '6px',
                bgcolor: primaryColor,
                transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)',
              },
            }}
          />
        </Box>
      </Box>
    </Fade>
  );
}
