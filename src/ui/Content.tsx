'use client';

import HeroSection from '@/components/HeroSection';
import Main from '@/components/Main';
import { Box, Typography } from '@mui/material';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { useViewportMask } from '@/hooks/useViewportMask';
import { useTranslation } from '@/app/i18n';
import { startMonitoring, usbDetect } from "@/keyboard/usb-hid";
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
    setLoading,
    updateMode,
    setKeyboardData,
    connectedKeyboard,
    setConnectedKeyboard,
    setConnectState,
    // 获取升级窗口状态
    isUpgradeWindowOpen,
  } = useContext(ConnectKbContext);
  const updateRef = useRef<boolean>(false);
  const { onChangeTab, currentTab } = useContext(EditorContext);
  // 升级窗口状态的 ref
  const upgradeWindowRef = useRef<boolean>(false);
  // 当前已连接键盘地址（仅此设备断开时回到首页）
  const connectedKeyboardAddressRef = useRef<string | null>(null);
  const demoKeyboardRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  /** 首页（未连接）与「设置」页：同一套 visualViewport / inner 最小宽高阈值（见 useViewportMask） */
  const viewportMask = useViewportMask({
    containerRef: contentRef,
    isAuthView: false,
    enabled: true,
    homeContentOverflowMode: loading || currentTab === 'settings',
  });
  // 避免不必要的触发
  const changeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const init = async () => {
      // await initState();
      startMonitoring();
    };

    init();

    const handleUsbChange = async () => {
      // 🔑 关键：升级窗口打开时，不处理设备连接事件
      if (upgradeWindowRef.current) {
        console.log('[USB Change] 升级窗口已打开，跳过设备连接处理');
        return;
      }

      if (changeTimeoutRef.current) clearTimeout(changeTimeoutRef.current);
      changeTimeoutRef.current = setTimeout(async () => {
        // await initState();
        changeTimeoutRef.current = null;
      }, 300);
    };

    // 监听 USB 设备移除事件
    const handleUsbRemove = (device: any) => {
      // 🔑 关键：升级窗口打开时，不处理设备断开事件
      if (upgradeWindowRef.current) {
        console.log('[USB Remove] 升级窗口已打开，跳过设备断开处理');
        return;
      }
      if (screenFirmwareOtaBlocking) {
        console.log('[USB Remove] 屏幕固件 OTA 进行中，跳过 remove 对键盘列表的处理（避免与 MainProvider 误清空叠加）');
        return;
      }

      if (updateRef.current) return;
      console.log('[USB Remove] 设备断开:', device);
      const removedAddress = device?._address;
      const isCurrentKeyboardRemoved =
        !!removedAddress &&
        connectedKeyboardAddressRef.current != null &&
        connectedKeyboardAddressRef.current === removedAddress;
      // 如果设备断开，清除连接状态
      setKeyboardData((prevData: any[]) => {
        const index = prevData.findIndex(
          (item: any) => item.address === removedAddress
        );
        if (index !== -1) {
          const newData = [...prevData];
          console.log(newData, removedAddress, prevData[index]?.address);

          if (isCurrentKeyboardRemoved && !demoKeyboardRef.current) {
            setConnectState(true);
            setConnectedKeyboard(null);
          }
          newData.splice(index, 1);

          // 仅“当前连接键盘”断开时才回 HeroSection；屏幕设备断开不影响 loading。
          if (isCurrentKeyboardRemoved && !demoKeyboardRef.current) {
            setLoading(true);
            setConnectedKeyboard(null);
          }

          return newData;
        }
        return prevData;
      });
    };

    usbDetect.on('change', handleUsbChange)
    usbDetect.on("remove", handleUsbRemove);

    return () => {
      usbDetect.off("remove", handleUsbRemove);
      usbDetect.off('change', handleUsbChange)
    };
  }, [setLoading, screenFirmwareOtaBlocking]);
  updateRef.current = updateMode;
  upgradeWindowRef.current = isUpgradeWindowOpen;
  connectedKeyboardAddressRef.current = connectedKeyboard?.api?.address ?? null;
  demoKeyboardRef.current = !!(
    connectedKeyboard?.test ||
    connectedKeyboard?.api?.address === 'demo'
  );
  useEffect(() => {
    if (loading) onChangeTab("keyboard");
  }, [loading]);

  // 应用启动后即预加载图标（含连接前首页），减轻首屏 / 键位池图标空白
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
      {loading ? <HeroSection /> : <Main />}
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
