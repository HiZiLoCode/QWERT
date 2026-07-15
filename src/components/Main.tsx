
import { Box, useTheme } from "@mui/material";
import Sidebar from "./Sidebar";
import { useContext, useEffect, useMemo } from "react";
import KeyboardPanel from "./Panel/KeyboardPanel";
import { EditorContext } from "@/providers/EditorProvider";
import SettingPanel from "./Panel/SettingPanel";
import { MainContext } from "@/providers/MainProvider";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import UpgradeNotification from "@/components/UpgradeNotification";
import { listenToUpgradeNavigation } from "@/utils/eventBus";
import { FirmwareUpdatePromptLayer, useSnackbarDialog } from "@/providers/useSnackbarProvider";
import KeyboardSwitchOverlay from "@/components/common/KeyboardSwitchOverlay";
export default function Main() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { setQgifModule } = useContext(MainContext);
    const {
        keyboard,
        connectedKeyboard,
        isKeyboardSwitching,
        keyboardSwitchProgress,
        keyboardSwitchLabel,
        setIsUpgradeWindowOpen,
        pendingOpenUpgradeAfterBootConnect,
        setPendingOpenUpgradeAfterBootConnect,
        loading,
        connectState,
    } = useContext(ConnectKbContext);
    const { currentTab, onChangeTab, requestSettingsFirmwareTab } = useContext(EditorContext);
    const { dismissFirmwareUpdatePrompt } = useSnackbarDialog();
    const isQMK = keyboard?.keyboardType === 'QMK';
    const connectedDeviceKey = useMemo(() => {
        if (typeof connectedKeyboard?.vendorId !== 'number' || typeof connectedKeyboard?.productId !== 'number') {
            return '';
        }
        return `${connectedKeyboard.vendorId}_${connectedKeyboard.productId}_${connectedKeyboard.productName ?? ''}`;
    }, [connectedKeyboard?.vendorId, connectedKeyboard?.productId, connectedKeyboard?.productName]);
    const tabs = useMemo(() => {
        const tableList = [
            { key: "keyboard", name: "键值", lang: "50", component: <KeyboardPanel /> },
            { key: "test", name: "测试键盘", lang: "1300", component: <KeyboardPanel onlyTestMode /> },
            { key: "settings", name: "设置", lang: "50", component: <SettingPanel /> },
        ]
        return tableList
    }, [])
    // 加载qgif.js和gifuct-js
    useEffect(() => {
        // 加载gifuct-js
        const loadGifuct = async () => {
            if (!window.gifuct) {
                try {
                    const gifuct = await import('gifuct-js');
                    window.gifuct = gifuct;
                    console.log('gifuct-js 加载成功');
                } catch (error) {
                    console.error('gifuct-js 加载失败:', error);
                }
            }
        };

        loadGifuct();

        // 加载gif.js
        if (!window.GIFEncoder) {
            const script = document.createElement('script');
            script.src = 'https://jsd.cdn.zzko.cn/npm/gif.js@0.2.0/dist/gif.js';
            script.onload = () => { };
            document.body.appendChild(script);
        }

        // 加载qgif.js
        if (!window.createModule) {
            const script = document.createElement('script');
            script.src = '/qgif.js';
            script.onload = async () => {
                // @ts-ignore
                const m = await window.createModule();
                setQgifModule(m);
            };
            document.body.appendChild(script);
        } else {
            // @ts-ignore
            window.createModule().then((m: any) => setQgifModule(m));
        }
    }, []);

    useEffect(() => {
        return listenToUpgradeNavigation(() => {
            onChangeTab('settings');
            requestSettingsFirmwareTab();
        });
    }, [onChangeTab, requestSettingsFirmwareTab]);

    useEffect(() => {
        if (!pendingOpenUpgradeAfterBootConnect || loading || connectState) return;
        setPendingOpenUpgradeAfterBootConnect(false);
        setIsUpgradeWindowOpen(true);
        onChangeTab('settings');
        requestSettingsFirmwareTab();
    }, [
        pendingOpenUpgradeAfterBootConnect,
        loading,
        connectState,
        setPendingOpenUpgradeAfterBootConnect,
        setIsUpgradeWindowOpen,
        onChangeTab,
        requestSettingsFirmwareTab,
    ]);

    useEffect(() => {
        if (currentTab !== 'settings') {
            dismissFirmwareUpdatePrompt();
        }
    }, [currentTab, dismissFirmwareUpdatePrompt]);

    useEffect(() => {
        if (isQMK) {
            dismissFirmwareUpdatePrompt();
        }
    }, [isQMK, dismissFirmwareUpdatePrompt]);

    useEffect(() => {
        dismissFirmwareUpdatePrompt();
    }, [connectedDeviceKey, dismissFirmwareUpdatePrompt]);

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: theme.palette.background.default,
        }}>
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'stretch',
                    opacity: isKeyboardSwitching ? 0 : 1,
                    pointerEvents: isKeyboardSwitching ? 'none' : 'auto',
                    transition: 'opacity 220ms ease',
                }}
            >
            {!isDark ? (
                <Box
                    aria-hidden
                    sx={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'none',
                        opacity: 0.3,
                        background: "url(/assets/cfg-bg-LnUK4o-L.webp) center center / cover no-repeat",
                    }}
                />
            ) : null}
            <Sidebar />
            <Box sx={{
                width: "calc(100% - 80px)",
                height: '100%',
                display: "flex",
                alignItems: "center",
                padding: "30px 32px",
                boxSizing: "border-box",
            }}>
                {tabs.find(tab => tab.key === currentTab)?.component}
            </Box>
            <Box
                sx={{
                    position: 'fixed',
                    top: '60px',
                    right: '20px',
                    zIndex: 1300,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: '12px',
                    pointerEvents: 'none',
                    '& > *': { pointerEvents: 'auto' },
                }}
            >
                <UpgradeNotification />
                {currentTab === 'settings' && !isQMK ? <FirmwareUpdatePromptLayer /> : null}
            </Box>
            </Box>
            <KeyboardSwitchOverlay
                open={isKeyboardSwitching}
                progress={keyboardSwitchProgress}
                deviceName={keyboardSwitchLabel}
            />
        </Box>
    )
}