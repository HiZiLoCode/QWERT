
import { Box } from "@mui/material";
import Sidebar from "./Sidebar";
import { useContext, useEffect, useMemo } from "react";
import KeyboardPanel from "./Panel/KeyboardPanel";
import { EditorContext } from "@/providers/EditorProvider";
import SettingPanel from "./Panel/SettingPanel";
import { MainContext } from "@/providers/MainProvider";
import UpgradeNotification from "@/components/UpgradeNotification";
export default function Main() {
    const { setQgifModule } = useContext(MainContext);
    const { currentTab, onChangeTab } = useContext(EditorContext);
    const tabs = useMemo(() => {
        const tableList = [
            { key: "keyboard", name: "键值", lang: "50", component: <KeyboardPanel /> },
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

    return (
        <Box sx={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f3f3f3',
        }}>
            <Box sx={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                opacity: 0.3,
                background: "url(/assets/cfg-bg-LnUK4o-L.webp) center center / cover no-repeat"
            }}></Box>
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
                <UpgradeNotification />
            </Box>
        </Box>
    )
}