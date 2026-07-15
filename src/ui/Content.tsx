'use client';

import HeroSection from '@/components/HeroSection';
import Main from '@/components/Main';
import { Box, Typography } from '@mui/material';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { useViewportMask } from '@/hooks/useViewportMask';
import { useTranslation } from '@/app/i18n';
import { startMonitoring, usbDetect } from "@/keyboard/usb-hid";
import {
  isKeyboardAuthorizePickerOpen,
  releaseKeyboardHidSessionForDisconnect,
} from '@/utils/keyboardHidSession';
import { hidDeviceMatchesConnectedKeyboard } from '@/devices/WebHid';
import { MainContext } from '@/providers/MainProvider';
import { VIEWPORT_HOME_COPY_REM } from '@/constants/viewportHomeCopyRem';
import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { CRITICAL_UI_ICON_PATHS, KEY_TYPE_ICON_PATHS } from '@/constants/publicAssetIconPaths';
import { preloadPublicAssets } from '@/utils/preloadPublicAssets';

/** 视窗过小提示标题中的产品名（与首页品牌一致） */
const VIEWPORT_MASK_APP_NAME = 'QWERTYKEYS';

function ViewportKeycap({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: '0.5rem',
        py: '0.125rem',
        mx: '0.2rem',
        borderRadius: '0.25rem',
        border: '1px solid rgba(255, 255, 255, 0.42)',
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        color: '#fff',
        fontSize: VIEWPORT_HOME_COPY_REM.keycap,
        fontWeight: 600,
        lineHeight: 1.25,
        verticalAlign: 'middle',
        fontFamily:
          'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      }}
    >
      {children}
    </Box>
  );
}

export default function Content() {
  const { t } = useTranslation('common');
  const { screenFirmwareOtaBlocking } = useContext(MainContext);
  const {
    loading,
    initDataLoaded,
    updateMode,
    setKeyboardData,
    connectedKeyboard,
    disconnectCurrentKeyboardAndReturnHome,
    isUpgradeWindowOpen,
  } = useContext(ConnectKbContext);
  const updateRef = useRef<boolean>(false);
  const { onChangeTab, currentTab } = useContext(EditorContext);
  const upgradeWindowRef = useRef<boolean>(false);
  const connectedKeyboardRef = useRef(connectedKeyboard);
  const disconnectHomeRef = useRef(disconnectCurrentKeyboardAndReturnHome);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const viewportMask = useViewportMask({
    containerRef: contentRef,
    isAuthView: false,
    enabled: true,
    homeContentOverflowMode: loading || currentTab === 'settings',
  });
  const changeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startMonitoring();
  }, []);

  useEffect(() => {
    const handleUsbChange = async () => {
      if (isKeyboardAuthorizePickerOpen()) {
        return;
      }
      if (upgradeWindowRef.current) {
        console.log('[USB Change] 升级窗口已打开，跳过设备连接处理');
        return;
      }

      if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);
      changeTimeoutRef.current = setTimeout(async () => {
        changeTimeoutRef.current = null;
      }, 300);
    };

    const handleUsbRemove = (device: HIDDevice | { _device?: HIDDevice; _address?: string }) => {
      if (isKeyboardAuthorizePickerOpen()) {
        console.log('[USB Remove] 授权弹窗等待中，跳过断开处理');
        return;
      }
      if (upgradeWindowRef.current) {
        console.log('[USB Remove] 升级窗口已打开，跳过设备断开处理');
        return;
      }
      if (screenFirmwareOtaBlocking) {
        console.log('[USB Remove] 屏幕固件 OTA 进行中，跳过 remove 对键盘列表的处理');
        return;
      }
      if (updateRef.current) return;

      const physical = ('_device' in device && device._device) ? device._device : device as HIDDevice;
      const connected = connectedKeyboardRef.current;
      const connectedAddress = connected?.api?.address ?? null;

      console.log('[USB Remove] 设备断开:', physical?.productName, physical?.vendorId, physical?.productId);

      releaseKeyboardHidSessionForDisconnect(physical);

      const isCurrentKeyboardRemoved = hidDeviceMatchesConnectedKeyboard(
        physical,
        connectedAddress,
        connected?.vendorId,
        connected?.productId,
      );

      const removedAddress =
        (physical as { _address?: string })._address
        ?? (('_address' in device) ? device._address : undefined);

      setKeyboardData((prevData: any[]) => {
        const index = removedAddress
          ? prevData.findIndex((item: any) => item.address === removedAddress)
          : prevData.findIndex(
            (item: any) =>
              physical
              && item.vendorId === physical.vendorId
              && item.productId === physical.productId,
          );

        if (index === -1) {
          if (isCurrentKeyboardRemoved) {
            disconnectHomeRef.current();
          }
          return prevData;
        }

        const newData = [...prevData];
        newData.splice(index, 1);

        if (isCurrentKeyboardRemoved) {
          disconnectHomeRef.current();
        }

        return newData;
      });
    };

    usbDetect.on('change', handleUsbChange);
    usbDetect.on('remove', handleUsbRemove);

    return () => {
      if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);
      usbDetect.off('remove', handleUsbRemove);
      usbDetect.off('change', handleUsbChange);
    };
  }, [setKeyboardData, screenFirmwareOtaBlocking]);

  updateRef.current = updateMode;
  upgradeWindowRef.current = isUpgradeWindowOpen;
  connectedKeyboardRef.current = connectedKeyboard;
  disconnectHomeRef.current = disconnectCurrentKeyboardAndReturnHome;

  useEffect(() => {
    if (loading || !initDataLoaded) onChangeTab('keyboard');
  }, [loading, initDataLoaded]);

  const showMain = !loading && initDataLoaded;

  useEffect(() => {
    const run = () =>
      preloadPublicAssets(KEY_TYPE_ICON_PATHS, {
        priority: CRITICAL_UI_ICON_PATHS,
        concurrency: 8,
      });

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }

    const timer = window.setTimeout(run, 50);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Box ref={contentRef} sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: 'background.default' }}>
      {showMain ? <Main /> : <HeroSection />}
      {viewportMask.show ? (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 1400,
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            bgcolor: '#000',
            px: 'clamp(1rem, 4vw, 2rem)',
            gap: VIEWPORT_HOME_COPY_REM.stackGap,
          }}
        >
          <Typography
            sx={{
              color: '#fff',
              fontSize: VIEWPORT_HOME_COPY_REM.titleClamp,
              fontWeight: 700,
              lineHeight: 1.3,
              textAlign: 'center',
            }}
          >
            {t('2593', { name: VIEWPORT_MASK_APP_NAME })}
          </Typography>
          <Typography
            component="div"
            sx={{
              color: '#fff',
              fontSize: VIEWPORT_HOME_COPY_REM.body,
              fontWeight: 400,
              lineHeight: 1.65,
              textAlign: 'center',
              maxWidth: 'min(66rem, 92vw)',
            }}
          >
            <Box component="span" sx={{ whiteSpace: 'normal' }}>
              {t('2594a')}
            </Box>
            <ViewportKeycap>L Ctrl</ViewportKeycap>
            <ViewportKeycap>-</ViewportKeycap>
            <Box component="span" sx={{ whiteSpace: 'normal' }}>
              {t('2594b')}
            </Box>
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
