'use client';

import HeroSection from '@/components/HeroSection';
import Main from '@/components/Main';
import { Box, Typography } from '@mui/material';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { useViewportMask } from '@/hooks/useViewportMask';
import { useTranslation } from '@/app/i18n';
import { startMonitoring, usbDetect } from "@/keyboard/usb-hid";
import { useContext, useEffect, useRef } from 'react';

export default function Content() {
  const { t } = useTranslation('common');
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
  const { onChangeTab } = useContext(EditorContext);
  // 升级窗口状态的 ref
  const upgradeWindowRef = useRef<boolean>(false);
  // 当前已连接键盘地址（仅此设备断开时回到首页）
  const connectedKeyboardAddressRef = useRef<string | null>(null);
  const demoKeyboardRef = useRef(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const showViewportMask = useViewportMask({ containerRef: contentRef, isAuthView: loading, enabled: !loading });
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
  }, [setLoading]);
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
  return (
    <Box ref={contentRef} sx={{ width: '100%', height: '100%', position: 'relative' }}>
      {loading ? <HeroSection /> : <Main />}
      {!loading && showViewportMask ? (
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
            background: "url(/assets/cfg-bg-LnUK4o-L.webp) center top / cover no-repeat",
            backdropFilter: 'blur(3px)',
            gap: '0.75rem',
            px: '1.25rem',
          }}
        >
          <Box
            component="img"
            src="/window-too-small-cat.svg"
            alt={t('2595')}
            sx={{
              width: 'min(42rem, 82vw)',
              maxHeight: '58vh',
              objectFit: 'contain',
              opacity: 0.92,
              userSelect: 'none',
            }}
          />
          <Typography sx={{ color: '#64748b', fontSize: '2rem', fontWeight: 600, lineHeight: 1.2 }}>
            {t('2593')}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '1rem', lineHeight: 1.5 }}>
            {t('2594')}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
