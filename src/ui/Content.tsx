'use client';

import HeroSection from '@/components/HeroSection';
import Main from '@/components/Main';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { EditorContext } from '@/providers/EditorProvider';
import { startMonitoring, usbDetect } from "@/keyboard/usb-hid";
import { useContext, useEffect, useRef } from 'react';

export default function Content() {
  const {
    loading,
    setLoading,
    updateMode,
    initState,
    keyboardData,
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
  // 避免不必要的触发
  const changeTimeoutRef = useRef(null);
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
    const handleUsbRemove = (device) => {
      // 🔑 关键：升级窗口打开时，不处理设备断开事件
      if (upgradeWindowRef.current) {
        console.log('[USB Remove] 升级窗口已打开，跳过设备断开处理');
        return;
      }

      if (updateRef.current) return; 
      console.log('[USB Remove] 设备断开:', device);
      // 如果设备断开，清除连接状态
      setKeyboardData((prevData) => {
        const index = prevData.findIndex(
          (item) => item.address === device._address
        );
        if (index !== -1) {
          const newData = [...prevData];
          console.log(newData,device._address,prevData[index]?.address);

          if (prevData[index]?.address === device._address) {
            setConnectState(true);
            setConnectedKeyboard(null)
          }
          newData.splice(index, 1);

          if (newData.length === 0) {
            setLoading(true);
            setConnectedKeyboard(null)
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
  useEffect(() => {
    if (loading) onChangeTab("keyboard");
  }, [loading]);
  return loading ? <HeroSection /> : <Main />;
}
