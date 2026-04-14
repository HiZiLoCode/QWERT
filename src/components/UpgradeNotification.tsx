import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import {
  Paper,
  Button,
  Typography,
  Box,
  useTheme,
  Slide,
  keyframes,
} from '@mui/material';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { NavigationEvents } from '@/utils/eventBus';
import { useTranslation } from 'react-i18next';
import { ButtonRem } from '@/styled/ReconstructionRem';

const AUTO_HIDE_DELAY = 60000; // 1 分钟自动隐藏

/* 浮动动画 */
const floatAnimation = keyframes`
  0% { transform: translateY(0rem); }
  50% { transform: translateY(-0.3125rem); } /* -5px */
  100% { transform: translateY(0rem); }
`;

/* 渐变闪烁动画 */
const shimmerAnimation = keyframes`
  0% { background-position: -12.5rem 0; }   /* -200px */
  100% { background-position: 12.5rem 0; }  /* 200px */
`;

const UpgradeNotification: React.FC = () => {
  const theme = useTheme();
  const { keyboard, connectState } = useContext(ConnectKbContext);
  const { onChangeTab } = useContext(EditorContext);
  const { deviceNeedsUpgrade, deviceVersion, deviceUpgradeVersion } = keyboard;

  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation('common');

  /** 启动自动隐藏计时器 */
  const startAutoHideTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  useEffect(() => {
    if (connectState || keyboard.keyboardType === "QMK") {
      setVisible(false);
      return;
    }

    if (deviceNeedsUpgrade) {
      setVisible(true);
      startAutoHideTimer();
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [deviceNeedsUpgrade, connectState, startAutoHideTimer,keyboard.keyboardType]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleMouseLeave = () => {
    startAutoHideTimer();
  };

  const handleUpgradeClick = () => {
    NavigationEvents.navigateToUpgrade();
    onChangeTab('settings');

    setTimeout(() => {
      const firmwareTabButton = document.querySelector(
        '[data-setting-tab="firmware"]'
      ) as HTMLElement | null;

      firmwareTabButton?.click();
      setVisible(false);
    }, 0);
  };

  const primaryColor = theme.palette.primary.main;
  const isLightMode = theme.palette.mode === 'light';

  return (
    <Slide direction="down" in={visible} mountOnEnter unmountOnExit>
      <Paper
        elevation={3}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          position: 'fixed',
          top: '3.75rem', // 60px
          right: '1.25rem', // 20px
          width: '18.75rem', // 300px
          padding: '1rem',
          zIndex: 1300,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          backgroundColor: isLightMode
            ? 'rgba(245, 245, 250, 0.95)'
            : 'rgba(45, 45, 60, 0.92)',
          border: `0.0625rem solid ${primaryColor}`, // 1px
          borderRadius: '0.75rem', // 12px
          boxShadow: isLightMode
            ? '0 1.25rem 2.5rem rgba(0,0,0,0.1), 0 0 0 0.0625rem rgba(0,0,0,0.1)'
            : '0 1.25rem 2.5rem rgba(0,0,0,0.3), 0 0 0 0.0625rem rgba(255,255,255,0.1)',
          backdropFilter: 'blur(1.25rem)', // 20px
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
            backgroundSize: '12.5rem 100%', // 200px
            animation: `${shimmerAnimation} 3s ease-in-out infinite`,
            pointerEvents: 'none',
            zIndex: 0,
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            color="primary"
          >
            {t('1244')}
          </Typography>

          <Typography variant="body2" sx={{ mb: '0.625rem' }}>
            {t('1245')}: v{deviceUpgradeVersion}，{t('1246')}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="0.8rem"
          >
            {t('1247')}: v{deviceVersion}
          </Typography>

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mt: '0.625rem',
            }}
          >
            <ButtonRem
              variant="contained"
              size="small"
              onClick={handleUpgradeClick}
              sx={{
                fontWeight: 'bold',
                textTransform: 'none',
                boxShadow: `0 0.125rem 0.5rem ${primaryColor}30`,
                '&:hover': {
                  boxShadow: `0 0.25rem 0.75rem ${primaryColor}40`,
                  transform: 'translateY(-0.0625rem)',
                },
                '&:active': {
                  transform: 'translateY(0)',
                },
              }}
            >
              {t('1248')}
            </ButtonRem>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default UpgradeNotification;