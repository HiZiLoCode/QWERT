'use client';

import { Box, Paper, Typography, keyframes } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from '@/app/i18n';
import { ButtonRem } from '@/styled/ReconstructionRem';

/** 与 `UpgradeNotification` 浮动固件提示一致 */
const floatAnimation = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
`;

const shimmerAnimation = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: 200px 0; }
`;

export type FirmwareUpdatePromptVariant = 'screen' | 'keyboard';

export type FirmwareUpdatePromptCardProps = {
  variant: FirmwareUpdatePromptVariant;
  targetVersionLabel: string;
  currentVersionLabel: string;
  /** 例如同时存在键盘可升级时的补充说明 */
  extraHint?: string;
  onGoNow: () => void;
  onClose: () => void;
};

/**
 * 视觉与 `UpgradeNotification`（键盘固件升级浮动提示）保持一致：尺寸、描边、阴影、毛玻璃、浮动与扫光。
 */
export default function FirmwareUpdatePromptCard({
  variant,
  targetVersionLabel,
  currentVersionLabel,
  extraHint,
  onGoNow,
  onClose,
}: FirmwareUpdatePromptCardProps) {
  const theme = useTheme();
  const { t } = useTranslation('common');
  const primaryColor = theme.palette.primary.main;
  const isLightMode = theme.palette.mode === 'light';

  const titleKey = variant === 'screen' ? '2931' : '2935';

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'relative',
        width: '300px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: isLightMode
          ? 'rgba(245, 245, 250, 0.95)'
          : 'rgba(45, 45, 60, 0.92)',
        border: `1px solid ${primaryColor}`,
        borderRadius: '12px',
        boxShadow: isLightMode
          ? '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)'
          : '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
        backdropFilter: 'blur(20px)',
        animation: `${floatAnimation} 3s ease-in-out infinite`,
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          background: `linear-gradient(
              45deg,
              transparent 30%,
              ${primaryColor}20 50%,
              transparent 70%
            )`,
          backgroundSize: '200px 100%',
          animation: `${shimmerAnimation} 3s ease-in-out infinite`,
          pointerEvents: 'none',
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ position: 'relative', zIndex: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold" color="primary">
          {t(titleKey)}
        </Typography>

        <Typography variant="body2" sx={{ mb: '10px', fontSize: '16px' }}>
          {t('2932', { target: targetVersionLabel })}
        </Typography>

        <Typography variant="body2" color="text.secondary" fontSize="13px">
          {t('2933', { current: currentVersionLabel })}
        </Typography>

        {extraHint ? (
          <Typography variant="body2" color="text.secondary" fontSize="13px" sx={{ mt: '4px' }}>
            {extraHint}
          </Typography>
        ) : null}

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            mt: '10px',
          }}
        >
          <ButtonRem
            variant="contained"
            size="small"
            onClick={() => {
              onGoNow();
              onClose();
            }}
            sx={{
              fontWeight: 'bold',
              textTransform: 'none',
              boxShadow: `0 2px 8px ${primaryColor}30`,
              '&:hover': {
                boxShadow: `0 4px 12px ${primaryColor}40`,
                transform: 'translateY(-1px)',
              },
              '&:active': {
                transform: 'translateY(0)',
              },
            }}
          >
            {t('2934')}
          </ButtonRem>
        </Box>
      </Box>
    </Paper>
  );
}
