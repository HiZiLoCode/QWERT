import React, {
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Paper,
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
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); } /* -5px */
  100% { transform: translateY(0px); }
`;

/* 渐变闪烁动画 */
const shimmerAnimation = keyframes`
  0% { background-position: -200px 0; }   /* -200px */
  100% { background-position: 200px 0; }  /* 200px */
`;

const UpgradeNotification: React.FC = () => {
  const theme = useTheme();
  const { keyboard, connectState, connectedKeyboard } = useContext(ConnectKbContext);
  const { onChangeTab } = useContext(EditorContext);
  const { deviceNeedsUpgrade, deviceVersion, deviceUpgradeVersion } = keyboard;

  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { t } = useTranslation('common');
  const connectedDeviceKey = useMemo(() => {
    if (typeof connectedKeyboard?.vendorId !== 'number' || typeof connectedKeyboard?.productId !== 'number') {
      return '';
    }
    return `${connectedKeyboard.vendorId}_${connectedKeyboard.productId}_${connectedKeyboard.productName ?? ''}`;
  }, [connectedKeyboard?.vendorId, connectedKeyboard?.productId, connectedKeyboard?.productName]);

  /** 启动自动隐藏计时器 */
  const startAutoHideTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, AUTO_HIDE_DELAY);
  }, []);

  useEffect(() => {
    setVisible(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [connectedDeviceKey]);

  useEffect(() => {
    if (connectState || keyboard.keyboardType === "QMK") {
      setVisible(false);
      return;
    }

    if (deviceNeedsUpgrade) {
      setVisible(true);
      startAutoHideTimer();
    } else {
      setVisible(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [deviceNeedsUpgrade, connectState, startAutoHideTimer, keyboard.keyboardType, connectedDeviceKey]);

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
          width: '300px', // 300px
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: isLightMode
            ? 'rgba(245, 245, 250, 0.95)'
            : 'rgba(45, 45, 60, 0.92)',
          border: `1px solid ${primaryColor}`, // 1px
          borderRadius: '12px', // 12px
          boxShadow: isLightMode
            ? '0 20px 40px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.1)'
            : '0 20px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)', // 20px
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
            backgroundSize: '200px 100%', // 200px
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

          <Typography variant="body2" sx={{ mb: '10px', fontSize: '16px' }}>
            {t('1245')}: v{deviceUpgradeVersion}，{t('1246')}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            fontSize="13px"
          >
            {t('1247')}: v{deviceVersion}
          </Typography>

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
              onClick={handleUpgradeClick}
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
              {t('1248')}
            </ButtonRem>
          </Box>
        </Box>
      </Paper>
    </Slide>
  );
};

export default UpgradeNotification;