'use client';

import { Box, Button, IconButton, Popover, Stack, Tooltip, Typography } from '@mui/material';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import KeyboardOutlinedIcon from '@mui/icons-material/KeyboardOutlined';
import AppsOutlinedIcon from '@mui/icons-material/AppsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HighlightOutlinedIcon from '@mui/icons-material/HighlightOutlined';
import TvOutlinedIcon from '@mui/icons-material/TvOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import {
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
    type ReactNode,
} from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import MacroTravelAdjustView from '@/components/MacroTravelAdjustView';
import LightSettingPanel from '@/components/KeyBoardPanel/LightSettingPanel';
import KeyMappingPanel from '@/components/KeyBoardPanel/KeyMappingPanel';
import LayoutPanel from '@/components/KeyBoardPanel/LayoutPanel';
import BindTest from '@/components/common/BindTest';
import { throttle } from 'lodash';
import { QMK_KeyboardDevice } from '@/devices/QMK/QMK_KeyboardDevice';
import { KeyboardDevice } from '@/devices/KeyboardDevice';
import { KeyboardAPI } from '@/devices/KeyboardAPI';
import { ScreenThemePage } from '@/components/ScreenTheme';
import HomePage from '@/components/GIFHome/HomePage';
import { EditorContext } from '@/providers/EditorProvider';
import { deviceInfo, isDeviceInDeviceInfo } from '@/config/deviceInfo';
import { MainContext } from '@/providers/MainProvider';
import { useTranslation } from '@/app/i18n';

/** 对齐 ticktype0407CodeNew `keyboard.tsx` + `common/layout` SidePanel + `common/menu` Submenu（本文件使用 px） */
const KP = {
    /** 与主内容区间距截图：约 24–32px */
    containerGap: 28,
    mainPaddingRight: 0,
    sideWidth: 250,
    sideWidthMd: 200,
    sideCollapsedWidth: 92,
    sideBreakpoint: 1700,
    sideColumnGap: 24,
    radiusDefault: 14,
    overlayBg: 'rgba(230, 230, 230, 0.5)',
    overlayBlur: '10px',
    titleFont: { fontSize: 18, fontWeight: 400 as const },
    titleColor: '#64748b',
    tipsFont: { fontSize: 16, fontWeight: 400 as const },
    tipsColor: '#91a1b8',
    primary: '#3b82f6',
    primaryHover: '#2563eb',
    submenuItemHeight: 48,
    submenuPaddingX: 20,
    submenuGap: 20,
    submenuContainerPaddingY: 20,
    submenuContainerPaddingX: 10,
    submenuContainerGap: 25,
    cardPadding: 20,
    cardInnerGap: 15,
    previewMinHeight: 42,
    popoverWidth: 320,
    dotSize: 12,
} as const;

const DEFAULT_KEYBOARD_SKIN_OPTIONS = [
    { value: 'blackWarrior', label: '黑武士', suffix: '', image: '' },
    { value: 'lightShine', label: '浅闪闪', suffix: '_lightShine', image: '' },
    { value: 'strawberryPink', label: '草莓粉', suffix: '_strawberryPink', image: '' },
    { value: 'sapphireBlue', label: '蓝宝石', suffix: '_sapphireBlue', image: '' },
] as const;

type KeyboardSkinOption = {
    value: string;
    label: string;
    suffix: string;
    image?: string;
};

const KEYBOARD_SKIN_STORAGE_KEY = 'keyboard-panel:skin-option';
const SETTINGS_MENU_COLLAPSED_STORAGE_KEY_MAIN = 'keyboard-panel:settings-menu-collapsed:main';
const SETTINGS_MENU_COLLAPSED_STORAGE_KEY_TEST = 'keyboard-panel:settings-menu-collapsed:test';

function readSettingsMenuCollapsedFromStorage(onlyTestMode: boolean): boolean {
    if (typeof window === 'undefined') return false;
    const key = onlyTestMode ? SETTINGS_MENU_COLLAPSED_STORAGE_KEY_TEST : SETTINGS_MENU_COLLAPSED_STORAGE_KEY_MAIN;
    return window.localStorage.getItem(key) === '1';
}

function writeSettingsMenuCollapsedToStorage(onlyTestMode: boolean, collapsed: boolean) {
    if (typeof window === 'undefined') return;
    const key = onlyTestMode ? SETTINGS_MENU_COLLAPSED_STORAGE_KEY_TEST : SETTINGS_MENU_COLLAPSED_STORAGE_KEY_MAIN;
    window.localStorage.setItem(key, collapsed ? '1' : '0');
}

/** 键盘缩放 ratio **低于**此值视为「空间紧」，自动收起侧栏（用户口述「阀值」指该边界） */
const SETTINGS_MENU_AUTO_COLLAPSE_SCALE = 0.72;
/** 滞回：离开低压区需 ratio 高于 `SCALE + HYSTERESIS`，避免在边界来回抖 */
const SETTINGS_MENU_SCALE_HYSTERESIS = 0.04;

function normalizeKeyboardSkinOptions(input: unknown): KeyboardSkinOption[] {
    if (!Array.isArray(input)) return [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
    const parsed = input.filter(
        (item): item is KeyboardSkinOption =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as { value?: unknown }).value === 'string' &&
            typeof (item as { label?: unknown }).label === 'string' &&
            typeof (item as { suffix?: unknown }).suffix === 'string' &&
            (typeof (item as { image?: unknown }).image === 'string' || typeof (item as { image?: unknown }).image === 'undefined'),
    );
    return parsed.length ? parsed : [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
}

function resolveKeyboardPreviewBySkin(src: string, skin: string, options: KeyboardSkinOption[]): string {
    const option = options.find((item) => item.value === skin);
    if (option?.image) return option.image;
    if (!option || !option.suffix) return src;
    const dotIndex = src.lastIndexOf('.');
    if (dotIndex <= 0) return src;
    return `${src.slice(0, dotIndex)}${option.suffix}${src.slice(dotIndex)}`;
}

const sidePanelSx = {
    position: 'relative' as const,
    borderRadius: `${KP.radiusDefault}px`,
    background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
    border: '1px solid #e5edf7',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
};

interface KeyboardPanelProps {
    onSelectKeyboard?: (keyboard: string) => void;
    onSelectConfig?: () => void;
    onKeyboardSettings?: () => void;
    onlyTestMode?: boolean;
}

function SettingsContent({
    selectedSetting,
    deviceAuthorized,
    onKeyboardScaleChange,
}: {
    selectedSetting: string;
    deviceAuthorized: boolean;
    onKeyboardScaleChange?: (ratio: number) => void;
}) {
    const { t } = useTranslation('common');
    if (selectedSetting === 'macro') {
        return <MacroTravelAdjustView onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (selectedSetting === 'lighting') {
        return <LightSettingPanel onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (selectedSetting === 'logolighting') {
        return <LightSettingPanel forcedLightType="logolight" onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (selectedSetting === 'matrix') {
        return <LightSettingPanel forcedLightType="matrixlight" />;
    } else if (selectedSetting === 'keypress') {
        return <KeyMappingPanel onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (selectedSetting === 'layout') {
        return <LayoutPanel onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (selectedSetting === 'test') {
        return (
            <Box
                sx={{
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <BindTest />
            </Box>
        );
    } else if (selectedSetting === 'Led') {
        return deviceAuthorized ? <ScreenThemePage /> : <HomePage />;
    }
    return (
        <Box
            sx={{
                flex: 1,
                borderRadius: `${KP.radiusDefault}px`,
                border: '1px solid rgba(153, 169, 191, 0.25)',
                background: 'rgba(255, 255, 255, 0.42)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Typography sx={{ color: '#71839b' }}>{t('2700')}</Typography>
        </Box>
    );
}

function exitDocumentFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
        void Promise.resolve(document.exitFullscreen()).catch(() => { });
    }
}

/** Chromium：全屏时可 Keyboard Lock，减少 Win/Meta 触发系统菜单（需 HTTPS，且因浏览器策略可能仍无法完全屏蔽 OS） */
type NavigatorWithKeyboard = Navigator & {
    keyboard?: {
        lock?: (keyCodes?: Iterable<string>) => Promise<void> | void;
        unlock?: () => Promise<void> | void;
    };
};

const BIND_TEST_WIN_KEY_CODES = ['MetaLeft', 'MetaRight'] as const;

function getNavigatorKeyboard() {
    if (typeof navigator === 'undefined') return undefined;
    return (navigator as NavigatorWithKeyboard).keyboard;
}

function unlockNavigatorKeyboard() {
    void Promise.resolve(getNavigatorKeyboard()?.unlock?.()).catch(() => { });
}

function lockNavigatorWinKeysWhenPageFullscreen() {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement !== document.documentElement) return;
    const keyboard = getNavigatorKeyboard();
    if (!keyboard?.lock) return;
    void Promise.resolve(keyboard.lock([...BIND_TEST_WIN_KEY_CODES])).catch(() => { });
}

function syncBindTestKeyboardLock(isBindTestView: boolean) {
    if (typeof document === 'undefined') return;
    const pageFullscreen = document.fullscreenElement === document.documentElement;
    if (isBindTestView && pageFullscreen) {
        lockNavigatorWinKeysWhenPageFullscreen();
        return;
    }
    unlockNavigatorKeyboard();
}

export default function KeyboardPanel({ onSelectKeyboard, onKeyboardSettings, onlyTestMode = false }: KeyboardPanelProps) {
    const { t } = useTranslation('common');
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [keyboardSkin, setKeyboardSkin] = useState<string>(DEFAULT_KEYBOARD_SKIN_OPTIONS[0].value);
    const [keyboardSkinHydrated, setKeyboardSkinHydrated] = useState(false);
    const [settingsMenuCollapsed, setSettingsMenuCollapsed] = useState(false);
    const [settingsMenuCollapsedHydrated, setSettingsMenuCollapsedHydrated] = useState(false);
    const [currentKeyboardScaleRatio, setCurrentKeyboardScaleRatio] = useState<number | null>(null);
    const [settingsMenuScaleLocked, setSettingsMenuScaleLocked] = useState(false);
    /** 因缩放自动收起后：禁止主动展开、换页不展开，直到窗口/视口发生 resize */
    const [sidebarAutoStashUntilResize, setSidebarAutoStashUntilResize] = useState(false);
    const lastScaleZoneRef = useRef<'below' | 'above' | null>(null);
    const { keyboardData, connectedKeyboard, keyboard, keyboardLayout, connectKeyboard, setConnectKeyboardStauts } =
        useContext(ConnectKbContext);
    const { deviceStatus } = useContext(MainContext);
    const { selectedSetting, setSelectedSetting } = useContext(EditorContext);
    const prevSelectedSettingRef = useRef(selectedSetting);
    const isBindTestView = onlyTestMode || selectedSetting === 'test';
    const isBindTestViewRef = useRef(isBindTestView);
    isBindTestViewRef.current = isBindTestView;

    useEffect(() => {
        if (isBindTestView) return;
        exitDocumentFullscreen();
        unlockNavigatorKeyboard();
    }, [isBindTestView]);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const onFullscreenChange = () => {
            syncBindTestKeyboardLock(isBindTestViewRef.current);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        onFullscreenChange();
        return () => {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            unlockNavigatorKeyboard();
        };
    }, []);

    useEffect(() => {
        syncBindTestKeyboardLock(isBindTestView);
    }, [isBindTestView]);

    useEffect(() => {
        if (!isBindTestView) return;
        const onKeyWinBlock = (e: KeyboardEvent) => {
            if (typeof document === 'undefined') return;
            if (document.fullscreenElement !== document.documentElement) return;
            if (e.code === 'MetaLeft' || e.code === 'MetaRight' || e.key === 'Meta') {
                e.preventDefault();
                e.stopPropagation();
            }
        };
        window.addEventListener('keydown', onKeyWinBlock, true);
        window.addEventListener('keyup', onKeyWinBlock, true);
        return () => {
            window.removeEventListener('keydown', onKeyWinBlock, true);
            window.removeEventListener('keyup', onKeyWinBlock, true);
        };
    }, [isBindTestView]);

    useLayoutEffect(() => {
        setSettingsMenuCollapsed(readSettingsMenuCollapsedFromStorage(onlyTestMode));
        setSettingsMenuCollapsedHydrated(true);
    }, [onlyTestMode]);

    useEffect(() => {
        if (!settingsMenuCollapsedHydrated) return;
        writeSettingsMenuCollapsedToStorage(onlyTestMode, settingsMenuCollapsed);
    }, [onlyTestMode, settingsMenuCollapsed, settingsMenuCollapsedHydrated]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!sidebarAutoStashUntilResize) return;
        const onViewportResize = () => {
            setSidebarAutoStashUntilResize(false);
        };
        window.addEventListener('resize', onViewportResize);
        window.visualViewport?.addEventListener('resize', onViewportResize);
        return () => {
            window.removeEventListener('resize', onViewportResize);
            window.visualViewport?.removeEventListener('resize', onViewportResize);
        };
    }, [sidebarAutoStashUntilResize]);

    useEffect(() => {
        if (prevSelectedSettingRef.current !== selectedSetting) {
            prevSelectedSettingRef.current = selectedSetting;
            setCurrentKeyboardScaleRatio(null);
            lastScaleZoneRef.current = null;
            if (sidebarAutoStashUntilResize) {
                setSettingsMenuCollapsed(true);
                setSettingsMenuScaleLocked(true);
            } else {
                setSettingsMenuScaleLocked(false);
            }
            return;
        }

        if (currentKeyboardScaleRatio == null) {
            if (!sidebarAutoStashUntilResize) {
                setSettingsMenuScaleLocked(false);
            }
            return;
        }

        const collapseTrigger = SETTINGS_MENU_AUTO_COLLAPSE_SCALE - SETTINGS_MENU_SCALE_HYSTERESIS;
        const expandTrigger = SETTINGS_MENU_AUTO_COLLAPSE_SCALE + SETTINGS_MENU_SCALE_HYSTERESIS;
        const currentZone = lastScaleZoneRef.current;

        let nextZone: 'below' | 'above' | null = currentZone;
        if (currentZone == null) {
            nextZone = currentKeyboardScaleRatio < SETTINGS_MENU_AUTO_COLLAPSE_SCALE ? 'below' : 'above';
        } else if (currentZone === 'above' && currentKeyboardScaleRatio < collapseTrigger) {
            nextZone = 'below';
        } else if (currentZone === 'below' && currentKeyboardScaleRatio > expandTrigger) {
            nextZone = 'above';
        }
        if (nextZone == null || nextZone === currentZone) {
            if (!sidebarAutoStashUntilResize) {
                if (currentKeyboardScaleRatio >= SETTINGS_MENU_AUTO_COLLAPSE_SCALE) {
                    setSettingsMenuScaleLocked(false);
                } else {
                    setSettingsMenuScaleLocked(true);
                }
            }
            return;
        }
        const previousZone = lastScaleZoneRef.current;
        lastScaleZoneRef.current = nextZone;

        if (nextZone === 'below') {
            setSettingsMenuCollapsed(true);
            setSettingsMenuScaleLocked(true);
            setSidebarAutoStashUntilResize(true);
            return;
        }

        // 经滞回从低压区回到安全区：自动展开（null→above 首帧不处理，避免覆盖 localStorage 的收起偏好）
        if (nextZone === 'above' && previousZone === 'below') {
            setSettingsMenuCollapsed(false);
            setSettingsMenuScaleLocked(false);
            setSidebarAutoStashUntilResize(false);
            return;
        }

        if (!sidebarAutoStashUntilResize) {
            if (currentKeyboardScaleRatio >= SETTINGS_MENU_AUTO_COLLAPSE_SCALE) {
                setSettingsMenuScaleLocked(false);
            }
        }
    }, [selectedSetting, currentKeyboardScaleRatio, sidebarAutoStashUntilResize]);

    const handleKeyboardScaleChange = useCallback((ratio: number) => {
        setCurrentKeyboardScaleRatio(ratio);
    }, []);

    useEffect(
        () => () => {
            unlockNavigatorKeyboard();
            if (typeof document === 'undefined') return;
            if (document.fullscreenElement === document.documentElement) {
                void Promise.resolve(document.exitFullscreen()).catch(() => { });
            }
        },
        [],
    );
    const { deviceBaseInfo } = keyboard;
    const [previewCandidateIndex, setPreviewCandidateIndex] = useState(0);

    const connectKeyboardNext = useCallback(async () => {
        try {
            await connectKeyboard('tryConnect', true, true);
        } catch (error) {
            console.error(t('2701'), error);
        }
    }, [connectKeyboard, t]);

    const handleSettingSelect = (settingId: string) => {
        setSelectedSetting(settingId);
        onKeyboardSettings?.();
    };

    const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    const handleSelectKeyboard = useMemo(
        () =>
            throttle(
                async (item: any) => {
                    handleCloseMenu();
                    onSelectKeyboard?.(item.id || item.address || item.productName);

                    if (item.devMode === 0 && item.productId === 12290) return;
                    let device: any = new QMK_KeyboardDevice(new KeyboardAPI(item.address, 1));
                    // await device.getProtocolVersion();
                    const version = await device.getProtocolVersion();
                    if (version !== -1 && version) {
                        await keyboard.setKeyboardType('QMK');
                        keyboard.keyboardType = 'QMK';
                    } else {
                        device = new KeyboardDevice(new KeyboardAPI(item.address, item.productId === 12290 ? 1 : 0));
                        await keyboard.setKeyboardType('91683');
                        keyboard.keyboardType = '91683';
                    }
                    await setConnectKeyboardStauts(device, item);
                },
                1000,
                { trailing: false },
            ),
        [setConnectKeyboardStauts, onSelectKeyboard, keyboard],
    );

    const keyboardSettings = useMemo(() => {
        if (onlyTestMode) {
            return [{ id: 'test', label: t('1300'), keyboardType: true }];
        }
        const currentKeyboard = keyboardData.find((item: any) => item.productName === connectedKeyboard?.productName);
        const devMode = currentKeyboard?.devMode ?? 0;
        const vid = connectedKeyboard?.vendorId;
        const pid = connectedKeyboard?.productId;
        const key =
            typeof vid === 'number' && typeof pid === 'number'
                ? `${`0x${vid.toString(16).toUpperCase()}`}_${`0x${pid.toString(16).toUpperCase()}`}_${devMode}`
                : '';
        const keyBoardLayer = key ? !!deviceInfo[key]?.keyBoardLayer : false;

        const tabs = [
            { id: 'keypress', label: t('2702'), keyboardType: true },
            { id: 'Led', label: t('2706'), keyboardType: !!deviceBaseInfo?.isLed },
            { id: 'lighting', label: t('2704'), keyboardType: true },
            { id: 'layout', label: t('2703'), keyBoardLayer },
            { id: 'logolighting', label: t('2705'), keyboardType: true },
            { id: 'matrix', label: t('2707'), keyboardType: !!deviceBaseInfo?.matrixScreen },
        ];
        return tabs.filter((tab) => (tab.keyboardType ?? true) && (tab.keyBoardLayer ?? true));
    }, [connectedKeyboard, keyboardData, deviceBaseInfo, t, onlyTestMode]);

    const settingIconMap: Record<string, ReactNode> = {
        keypress: <KeyboardOutlinedIcon sx={{ fontSize: 18 }} />,
        layout: <AppsOutlinedIcon sx={{ fontSize: 18 }} />,
        lighting: <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />,
        logolighting: <HighlightOutlinedIcon sx={{ fontSize: 18 }} />,
        Led: <TvOutlinedIcon sx={{ fontSize: 18 }} />,
        matrix: <GridViewOutlinedIcon sx={{ fontSize: 18 }} />,
        test: <ScienceOutlinedIcon sx={{ fontSize: 18 }} />,
    };

    const getKeyboardPreviewCandidates = useCallback((vid?: number, pid?: number, devMode: number = 0) => {
        if (typeof vid !== 'number' || typeof pid !== 'number') return [];
        const vidHexUpper = `0x${vid.toString(16).toUpperCase()}`;
        const pidHexUpper = `0x${pid.toString(16).toUpperCase()}`;
        const vidHexLower = `0x${vid.toString(16).toLowerCase()}`;
        const pidHexLower = `0x${pid.toString(16).toLowerCase()}`;
        const vidRawUpper = vid.toString(16).toUpperCase();
        const pidRawUpper = pid.toString(16).toUpperCase();
        const vidRawLower = vid.toString(16).toLowerCase();
        const pidRawLower = pid.toString(16).toLowerCase();
        const candidates = [
            `/keyboard/${vidHexUpper}_${pidHexUpper}_${devMode}.png`,
            `/keyboard/${vidHexUpper}_${pidHexUpper}.png`,
            `/keyboard/${vidHexLower}_${pidHexLower}_${devMode}.png`,
            `/keyboard/${vidHexLower}_${pidHexLower}.png`,
            `/keyboard/${vidRawUpper}_${pidRawUpper}_${devMode}.png`,
            `/keyboard/${vidRawUpper}_${pidRawUpper}.png`,
            `/keyboard/${vidRawLower}_${pidRawLower}_${devMode}.png`,
            `/keyboard/${vidRawLower}_${pidRawLower}.png`,
        ];
        return [...new Set(candidates)];
    }, []);

    const keyboardPreviewCandidates = useMemo(() => {
        const currentKeyboard = keyboardData.find((item: any) => item.productName === connectedKeyboard?.productName);
        const devMode = currentKeyboard?.devMode ?? 0;
        const vid = connectedKeyboard?.vendorId;
        const pid = connectedKeyboard?.productId;
        return getKeyboardPreviewCandidates(vid, pid, devMode);
    }, [connectedKeyboard, keyboardData, getKeyboardPreviewCandidates]);

    /** Popover 中只展示 deviceInfo 已登记的设备 */
    const keyboardDataInConfig = useMemo(
        () =>
            keyboardData.filter((kb: any) =>
                isDeviceInDeviceInfo(kb.vendorId, kb.productId, kb.devMode ?? 0),
            ),
        [keyboardData],
    );

    const keyboardPreviewSrc = keyboardPreviewCandidates[previewCandidateIndex] ?? '';
    const keyboardSkinOptions = useMemo(
        () => normalizeKeyboardSkinOptions((keyboardLayout as { previewSkins?: unknown } | undefined)?.previewSkins),
        [keyboardLayout],
    );
    const keyboardPreviewWithSkinSrc = keyboardPreviewSrc
        ? resolveKeyboardPreviewBySkin(keyboardPreviewSrc, keyboardSkin, keyboardSkinOptions)
        : '';

    useEffect(() => {
        setPreviewCandidateIndex(0);
    }, [keyboardPreviewCandidates]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const cached = window.localStorage.getItem(KEYBOARD_SKIN_STORAGE_KEY);
        if (cached) {
            const isValid = keyboardSkinOptions.some((item) => item.value === cached);
            if (isValid) {
                setKeyboardSkin(cached);
            }
        }
        setKeyboardSkinHydrated(true);
    }, [keyboardSkinOptions]);

    useEffect(() => {
        if (!keyboardSkinHydrated) return;
        if (typeof window === 'undefined') return;
        if (!keyboardSkinOptions.some((item) => item.value === keyboardSkin)) return;
        window.localStorage.setItem(KEYBOARD_SKIN_STORAGE_KEY, keyboardSkin);
    }, [keyboardSkin, keyboardSkinHydrated, keyboardSkinOptions]);

    useEffect(() => {
        if (!keyboardSkinOptions.some((item) => item.value === keyboardSkin)) {
            setKeyboardSkin(keyboardSkinOptions[0].value);
        }
    }, [keyboardSkinOptions, keyboardSkin]);

    useEffect(() => {
        if (!keyboardSettings.length) return;
        if (!keyboardSettings.some((item) => item.id === selectedSetting)) {
            setSelectedSetting(keyboardSettings[0].id);
        }
    }, [keyboardSettings, selectedSetting, setSelectedSetting]);

    const open = Boolean(anchorEl);

    if (onlyTestMode) {
        return (
            <Box
                sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    minHeight: 0,
                }}
            >
                <BindTest />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'stretch',
                gap: `${KP.containerGap}px`,
                pr: `${KP.mainPaddingRight}px`,
                boxSizing: 'border-box',
                minHeight: 0,
            }}
        >
            <Box
                sx={{
                    width: settingsMenuCollapsed ? `${KP.sideCollapsedWidth}px` : `${KP.sideWidth}px`,
                    flexShrink: 0,
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${KP.sideColumnGap}px`,
                    transition: 'width 0.2s ease-out',
                    [`@media (max-width: ${KP.sideBreakpoint}px)`]: {
                        width: settingsMenuCollapsed ? `${KP.sideCollapsedWidth}px` : `${KP.sideWidthMd}px`,
                    },
                }}
            >
                {anchorEl && (
                    <Box
                        sx={{
                            position: 'fixed',
                            zIndex: 10,
                            pointerEvents: 'all',
                            inset: 0,
                            background: KP.overlayBg,
                            backdropFilter: KP.overlayBlur,
                        }}
                    />
                )}

                <Box
                    sx={{
                        ...sidePanelSx,
                        p: `${KP.cardPadding}px`,
                        cursor: settingsMenuCollapsed ? 'default' : 'pointer',
                        zIndex: 11,
                        flexShrink: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: `${KP.cardInnerGap}px`,
                        transition: 'padding 0.2s ease-out',
                    }}
                    onClick={settingsMenuCollapsed ? undefined : handleOpenMenu}
                >
                    <Box sx={{ display: 'flex', justifyContent: settingsMenuCollapsed ? 'center' : 'space-between', alignItems: 'center', width: '100%', height: 30 }}>
                        {settingsMenuCollapsed ? (
                            <IconButton
                                size="small"
                                disabled={sidebarAutoStashUntilResize || settingsMenuScaleLocked}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setSettingsMenuCollapsed(false);
                                }}
                                sx={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: '8px',
                                    color: '#7d93b0',
                                    border: '1px solid rgba(125,147,176,0.35)',
                                    '&:hover': { color: '#4a86f7', borderColor: '#9fc2ff', backgroundColor: 'rgba(74,134,247,0.08)' },
                                }}
                            >
                                <ChevronRightOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        ) : (
                            <>
                                <Typography sx={{ ...KP.titleFont, color: KP.titleColor }}>{t('2708')}</Typography>
                                <IconButton
                                    size="small"
                                    disabled={settingsMenuScaleLocked}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setSettingsMenuCollapsed(true);
                                    }}
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: '8px',
                                        color: '#7d93b0',
                                        border: '1px solid rgba(125,147,176,0.35)',
                                        '&:hover': { color: '#4a86f7', borderColor: '#9fc2ff', backgroundColor: 'rgba(74,134,247,0.08)' },
                                    }}
                                >
                                    <ChevronLeftOutlinedIcon sx={{ fontSize: 18 }} />
                                </IconButton>
                            </>
                        )}
                    </Box>
                    <Box
                        onClick={settingsMenuCollapsed ? handleOpenMenu : undefined}
                        sx={{
                            width: '100%',
                            height: settingsMenuCollapsed ? '54px' : '84px',
                            borderRadius: '8px',
                            background: 'linear-gradient(180deg, #f8fbff 0%, #f1f6fd 100%)',
                            border: '1px solid #dbe7f6',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#8ea3bd',
                            fontSize: '11px',
                            overflow: 'hidden',
                            ...(settingsMenuCollapsed ? { cursor: 'pointer' } : {}),
                        }}
                    >
                        {keyboardPreviewWithSkinSrc ? (
                            <Box
                                component="img"
                                src={keyboardPreviewWithSkinSrc}
                                alt={t('2712')}
                                onError={() => setPreviewCandidateIndex((prev) => prev + 1)}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: '#fff',
                                }}
                            />
                        )}
                    </Box>
                    {!settingsMenuCollapsed ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Typography sx={{ fontSize: '18px', lineHeight: 1.1, color: '#5f7da3', fontWeight: 600 }}>
                                {connectedKeyboard?.productName || 'QK100 MKII'}
                            </Typography>
                            <Box
                                sx={{
                                    width: `${KP.dotSize}px`,
                                    height: `${KP.dotSize}px`,
                                    borderRadius: '50%',
                                    backgroundColor: '#35c27b',
                                }}
                            />
                        </Box>
                    ) : null}
                </Box>

                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleCloseMenu}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{
                        sx: {
                            borderRadius: `${KP.radiusDefault}px`,
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                            mt: '8px',
                            width: `${KP.popoverWidth}px`,
                            border: '1px solid #91a1b8',
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
                            cursor: 'default',
                        },
                    }}
                >
                    <Box sx={{ p: '16px' }}>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={connectKeyboardNext}
                            sx={{
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#ffffff',
                                mb: '10px',
                                background: KP.primary,
                                width: '100%',
                                textTransform: 'none',
                                borderRadius: `${KP.radiusDefault}px`,
                                py: '10px',
                                '&:hover': { background: KP.primaryHover },
                            }}
                        >
                            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <AddRoundedIcon sx={{ fontSize: 18 }} />
                                {t('2709')}
                            </Box>
                        </Button>

                        <Stack spacing={0} sx={{ gap: '10px' }}>
                            {keyboardDataInConfig.map((kb: any, index: number) => {
                                const active = (connectedKeyboard?.productName || '') === kb.productName;
                                const kbPreviewSrc = getKeyboardPreviewCandidates(kb.vendorId, kb.productId, kb.devMode ?? 0)[0] ?? '';
                                const kbPreviewWithSkinSrc = active
                                    ? resolveKeyboardPreviewBySkin(kbPreviewSrc, keyboardSkin, keyboardSkinOptions)
                                    : kbPreviewSrc;
                                return (
                                    <Box
                                        key={kb.id || kb.address || `${kb.productName}-${index}`}
                                        onClick={() => handleSelectKeyboard(kb)}
                                        sx={{
                                            p: '10px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: active ? KP.primary : 'rgba(241, 245, 249, 0.9)',
                                            transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Box
                                                sx={{
                                                    width: '48px',
                                                    height: '40px',
                                                    backgroundColor: '#fff',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {kbPreviewWithSkinSrc ? (
                                                    <Box
                                                        component="img"
                                                        src={kbPreviewWithSkinSrc}
                                                        alt={kb.productName || t('2713')}
                                                        sx={{
                                                            width: '100%',
                                                            height: '100%',
                                                            objectFit: 'contain',
                                                            display: 'block',
                                                        }}
                                                    />
                                                ) : (
                                                    <Box
                                                        sx={{
                                                            width: '100%',
                                                            height: '100%',
                                                            backgroundColor: '#fff',
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            <Box sx={{ flex: 1, mx: '10px', minWidth: 0 }}>
                                                <Typography
                                                    sx={{
                                                        fontSize: KP.titleFont.fontSize,
                                                        fontWeight: KP.titleFont.fontWeight,
                                                        color: active ? '#fff' : '#0f172a',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {kb.productName}
                                                </Typography>

                                                {active ? (
                                                    <Box
                                                        component="select"
                                                        value={keyboardSkin}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onMouseDown={(event) => event.stopPropagation()}
                                                        onChange={(event) => {
                                                            setKeyboardSkin(event.target.value);
                                                        }}
                                                        sx={{
                                                            mt: '6px',
                                                            width: '100%',
                                                            height: '28px',
                                                            px: '8px',
                                                            pr: '28px',
                                                            borderRadius: '8px',
                                                            border: '1px solid #3B82F6',
                                                            backgroundColor: '#fff',
                                                            color: '#334155',
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            outline: 'none',
                                                            appearance: 'none',
                                                            WebkitAppearance: 'none',
                                                            MozAppearance: 'none',
                                                            backgroundImage:
                                                                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' fill='none' stroke='%233B82F6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
                                                            backgroundRepeat: 'no-repeat',
                                                            backgroundPosition: 'right 8px center',
                                                            '&:focus': {
                                                                borderColor: '#2563EB',
                                                                boxShadow: '0 0 0 2px rgba(59,130,246,0.2)',
                                                            },
                                                        }}
                                                    >
                                                        {keyboardSkinOptions.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </Box>
                                                ) : null}
                                            </Box>

                                            <Box
                                                sx={{
                                                    width: `${KP.dotSize}px`,
                                                    height: `${KP.dotSize}px`,
                                                    m: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: '#10b981',
                                                    flexShrink: 0,
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                    </Box>
                </Popover>

                <Box
                    sx={{
                        ...sidePanelSx,
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: `${KP.submenuContainerPaddingY}px ${KP.submenuContainerPaddingX}px`,
                        gap: `${KP.submenuContainerGap}px`,
                        transition: 'padding 0.2s ease-out, gap 0.2s ease-out',
                    }}
                >
                    <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: settingsMenuCollapsed ? 'center' : 'flex-start', height: 30 }}>
                            <Typography
                                sx={{
                                    ...KP.titleFont,
                                    color: KP.titleColor,
                                    visibility: settingsMenuCollapsed ? 'hidden' : 'visible',
                                }}
                            >
                                {t('2710')}
                            </Typography>
                        </Box>
                        {/* <Typography
                            sx={{
                                ...KP.tipsFont,
                                color: KP.tipsColor,
                                mt: '6px',
                                height: '20px',
                                visibility: settingsMenuCollapsed ? 'hidden' : 'visible',
                                overflow: 'hidden',
                            }}
                        >
                            {t('2711')}
                        </Typography> */}
                    </Box>

                    <Stack
                        spacing={0}
                        sx={{
                            gap: `${KP.submenuGap}px`,
                            flex: 1,
                            minHeight: 0,
                            overflow: 'auto',
                            alignItems: 'center',
                        }}
                    >
                        {keyboardSettings.map((setting) => {
                            const active = selectedSetting === setting.id;
                            return (
                                <Tooltip
                                    key={setting.id}
                                    title={settingsMenuCollapsed ? setting.label : ''}
                                    placement="right"
                                    arrow
                                    disableHoverListener={!settingsMenuCollapsed}
                                    disableFocusListener={!settingsMenuCollapsed}
                                    disableTouchListener={!settingsMenuCollapsed}
                                    slotProps={{
                                        tooltip: {
                                            sx: {
                                                ml: '8px',
                                                px: '10px',
                                                py: '6px',
                                                borderRadius: '8px',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                color: '#ffffff',
                                                backgroundColor: 'rgba(15, 23, 42, 0.92)',
                                                boxShadow: '0 8px 20px rgba(15, 23, 42, 0.18)',
                                            },
                                        },
                                        arrow: {
                                            sx: {
                                                color: 'rgba(15, 23, 42, 0.92)',
                                            },
                                        },
                                    }}
                                >
                                    <Button
                                        fullWidth
                                        title={settingsMenuCollapsed ? undefined : setting.label}
                                        onClick={() => handleSettingSelect(setting.id)}
                                        startIcon={settingIconMap[setting.id]}
                                        sx={{
                                            minWidth: 0,
                                            width: settingsMenuCollapsed ? 44 : '100%',
                                            height: '42px',
                                            px: settingsMenuCollapsed ? 0 : `${KP.submenuPaddingX}px`,
                                            borderRadius: '10px',
                                            justifyContent: settingsMenuCollapsed ? 'center' : 'flex-start',
                                            gap: settingsMenuCollapsed ? 0 : '10px',
                                            fontSize: '16px',
                                            fontWeight: active ? 600 : 500,
                                            textTransform: 'none',
                                            color: active ? '#ffffff' : '#7d93b0',
                                            backgroundColor: active ? '#4a86f7' : 'transparent',
                                            transition: 'background-color 0.2s ease-out, color 0.2s ease-out, width 0.2s ease-out',
                                            '& .MuiButton-startIcon': {
                                                mr: settingsMenuCollapsed ? 0 : 1,
                                                ml: 0,
                                                '& svg': { fontSize: settingsMenuCollapsed ? 20 : 18 },
                                            },
                                            '&:hover': {
                                                backgroundColor: active ? '#3b78f0' : 'rgba(74, 134, 247, 0.08)',
                                                color: active ? '#ffffff' : '#4a86f7',
                                            },
                                        }}
                                    >
                                        {!settingsMenuCollapsed ? setting.label : null}
                                    </Button>
                                </Tooltip>
                            );
                        })}
                    </Stack>
                </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 43 }}>
                <SettingsContent
                    selectedSetting={selectedSetting}
                    deviceAuthorized={Boolean(deviceStatus)}
                    onKeyboardScaleChange={handleKeyboardScaleChange}
                />
            </Box>
        </Box>
    );
}
