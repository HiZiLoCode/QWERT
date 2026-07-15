'use client';

import {
    Box,
    Button,
    FormControl,
    IconButton,
    MenuItem,
    Popover,
    Select,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import ChevronLeftOutlinedIcon from '@mui/icons-material/ChevronLeftOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent,
} from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import MacroTravelAdjustView from '@/components/MacroTravelAdjustView';
import LightSettingPanel from '@/components/KeyBoardPanel/LightSettingPanel';
import KeyMappingPanel from '@/components/KeyBoardPanel/KeyMappingPanel';
import LayoutPanel from '@/components/KeyBoardPanel/LayoutPanel';
import BindTest from '@/components/common/BindTest';
import { throttle } from 'lodash';
import { QMK_KeyboardDevice, resolveQmkKeyboardApiDeviceMode } from '@/devices/QMK/QMK_KeyboardDevice';
import { KeyboardDevice } from '@/devices/KeyboardDevice';
import { KeyboardAPI } from '@/devices/KeyboardAPI';
import { ScreenThemePage } from '@/components/ScreenTheme';
import HomePage from '@/components/GIFHome/HomePage';
import { EditorContext } from '@/providers/EditorProvider';
import { deviceInfo, deviceInfoKey, isDeviceInDeviceInfo } from '@/config/deviceInfo';
import {
    buildQmkLightingSidebarTabs,
    getLogoLightingTabI18nKey,
    isPickupLightingDevice,
    parseQmkLightTabId,
} from '@/utils/qmkLightingBridge';
import {
    getDevicePreviewSkinOptions,
    normalizeKeyboardSkinOptions,
    pickValidDeviceSkin,
    resolveDeviceKeyboardPreviewSrc,
    type KeyboardSkinOption,
} from '@/utils/keyboardPreviewRegistry';
import { MainContext } from '@/providers/MainProvider';
import { useTranslation } from '@/app/i18n';
import { getComfortableScrollbarSx } from '@/utils/comfortableScrollbarSx';
import PublicAssetImage from '@/components/common/PublicAssetImage';
import { alpha, useTheme } from '@mui/material/styles';

const failedKeyboardPreviewSrcs = new Set<string>();

function markKeyboardPreviewFailed(src: string) {
    if (!src || failedKeyboardPreviewSrcs.has(src)) return false;
    failedKeyboardPreviewSrcs.add(src);
    return true;
}

function isKeyboardPreviewAvailable(src: string): boolean {
    return Boolean(src) && !failedKeyboardPreviewSrcs.has(src);
}

/** 来自 `图标.zip` →「机械轴驱动示例 (4)」，见 `public/sidebar/setting-*.svg` */
const KP_SETTING_ICON_SRC: Record<string, string> = {
    keypress: '/sidebar/setting-keypress.svg',
    layout: '/sidebar/setting-layout.svg',
    lighting: '/sidebar/setting-lighting.svg',
    logolighting: '/sidebar/setting-logolighting.svg',
    Led: '/sidebar/setting-led.svg',
    matrix: '/sidebar/setting-matrix.svg',
    test: '/sidebar/setting-test.svg',
};

function KeyboardPanelSettingIcon({
    id,
    iconId,
    active,
    collapsed,
    isDark,
}: {
    id: string;
    iconId?: string;
    active: boolean;
    collapsed: boolean;
    isDark: boolean;
}) {
    const src = KP_SETTING_ICON_SRC[iconId ?? id];
    if (!src) return null;
    const size = collapsed ? 20 : 18;
    return (
        <PublicAssetImage
            src={src}
            alt=""
            aria-hidden
            sx={{
                width: `${size}px`,
                height: `${size}px`,
                objectFit: 'contain',
                display: 'block',
                flexShrink: 0,
                filter:
                    active || isDark ? 'brightness(0) invert(1)' : 'none',
                transition: 'filter 0.2s ease-out',
            }}
        />
    );
}

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
    titleColor: 'rgb(120, 137, 161)',
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

function getKeyboardSkinOptionLabel(
    option: KeyboardSkinOption,
    t: (key: string, options?: { defaultValue?: string }) => string,
): string {
    if (option.lang) {
        return t(option.lang, { defaultValue: option.label ?? option.value });
    }
    return option.label ?? option.value;
}

const KEYBOARD_SKIN_BY_DEVICE_STORAGE_KEY = 'keyboard-panel:skin-by-device';
const LEGACY_KEYBOARD_SKIN_STORAGE_KEY = 'keyboard-panel:skin-option';
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

function readDeviceSkinsFromStorage(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = window.localStorage.getItem(KEYBOARD_SKIN_BY_DEVICE_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>).filter(
                ([, value]) => typeof value === 'string',
            ),
        ) as Record<string, string>;
    } catch {
        return {};
    }
}

function writeDeviceSkinsToStorage(skins: Record<string, string>) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(KEYBOARD_SKIN_BY_DEVICE_STORAGE_KEY, JSON.stringify(skins));
}

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
    const qmkLightGroupLabel = parseQmkLightTabId(selectedSetting);
    if (selectedSetting === 'macro') {
        return <MacroTravelAdjustView onKeyboardScaleChange={onKeyboardScaleChange} />;
    } else if (qmkLightGroupLabel) {
        return (
            <LightSettingPanel
                qmkLightGroupLabel={qmkLightGroupLabel}
                onKeyboardScaleChange={onKeyboardScaleChange}
            />
        );
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
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const panelCardSx = useMemo(
        () => ({
            position: 'relative' as const,
            borderRadius: `${KP.radiusDefault}px`,
            ...(isDark
                ? {
                      bgcolor: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.primary.main}`,
                      boxShadow: '0 2px 14px rgba(0,0,0,0.45)',
                  }
                : {
                      background:
                          'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
                      border: '1px solid #e5edf7',
                      boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
                  }),
        }),
        [isDark, theme],
    );
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [deviceSkins, setDeviceSkins] = useState<Record<string, string>>({});
    const [deviceSkinsHydrated, setDeviceSkinsHydrated] = useState(false);
    const [settingsMenuCollapsed, setSettingsMenuCollapsed] = useState(false);
    const [settingsMenuCollapsedHydrated, setSettingsMenuCollapsedHydrated] = useState(false);
    const [currentKeyboardScaleRatio, setCurrentKeyboardScaleRatio] = useState<number | null>(null);
    const [settingsMenuScaleLocked, setSettingsMenuScaleLocked] = useState(false);
    /** 因缩放自动收起后：禁止主动展开、换页不展开，直到窗口/视口发生 resize */
    const [sidebarAutoStashUntilResize, setSidebarAutoStashUntilResize] = useState(false);
    const lastScaleZoneRef = useRef<'below' | 'above' | null>(null);
    const { keyboardData, connectedKeyboard, keyboard, keyboardLayout, connectKeyboard, setConnectKeyboardStauts, initDataLoaded, beginKeyboardSwitch, abortKeyboardSwitch, refreshAuthorizedKeyboardList } =
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
    const [, setPreviewImageTick] = useState(0);

    const connectKeyboardNext = useCallback(async () => {
        try {
            await connectKeyboard('tryConnect', true, true);
        } catch (error) {
            console.error(t('2701'), error);
        }
    }, [connectKeyboard, t]);

    const handleSettingSelect = (settingId: string) => {
        const qmkGroupLabel = parseQmkLightTabId(settingId);
        if (qmkGroupLabel) {
            keyboard?.setLightType?.(qmkGroupLabel);
        }
        setSelectedSetting(settingId);
        onKeyboardSettings?.();
    };

    const handleOpenMenu = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
        void refreshAuthorizedKeyboardList();
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

                    const isDeviceSwitch = initDataLoaded && !!connectedKeyboard;
                    if (isDeviceSwitch) {
                        beginKeyboardSwitch(item?.productName ?? '');
                    }

                    if (item.devMode === 0 && item.productId === 12290) {
                        if (isDeviceSwitch) abortKeyboardSwitch();
                        return;
                    }
                    let device: any = new QMK_KeyboardDevice(
                        new KeyboardAPI(item.address, resolveQmkKeyboardApiDeviceMode(item.productId)),
                    );
                    let kbType: 'QMK' | '91683' = '91683';
                    try {
                        const version = await device.getProtocolVersion();
                        if (version !== -1 && version) {
                            kbType = 'QMK';
                        } else {
                            device = new KeyboardDevice(new KeyboardAPI(item.address, item.productId === 12290 ? 1 : 0));
                        }
                        await setConnectKeyboardStauts(device, item, kbType);
                    } catch (error) {
                        if (isDeviceSwitch) abortKeyboardSwitch();
                        throw error;
                    }
                },
                1000,
                { trailing: false },
            ),
        [setConnectKeyboardStauts, onSelectKeyboard, keyboard, initDataLoaded, connectedKeyboard, beginKeyboardSwitch, abortKeyboardSwitch],
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
        const isQMK = keyboard?.keyboardType === 'QMK';
        const isPickupDevice = isPickupLightingDevice(vid, pid, devMode);
        const qmkLightingTabs = isQMK
            ? buildQmkLightingSidebarTabs(keyboardLayout?.menus, isPickupDevice)
            : [];

        const lightSettingTabs = isQMK
            ? (qmkLightingTabs.length
                ? qmkLightingTabs.map((tab) => ({
                    id: tab.id,
                    label: tab.label,
                    iconId: tab.iconId,
                    keyboardType: true,
                }))
                : [{ id: 'lighting', label: t('2704'), keyboardType: true }])
            : [
                { id: 'lighting', label: t('2704'), keyboardType: true },
                { id: 'logolighting', label: t(getLogoLightingTabI18nKey(isPickupDevice)), keyboardType: true },
            ];

        const tabs = [
            { id: 'keypress', label: t('2702'), keyboardType: true },
            { id: 'Led', label: t('2706'), keyboardType: !!deviceBaseInfo?.isLed },
            ...lightSettingTabs,
            { id: 'layout', label: t('2703'), keyBoardLayer },
            { id: 'matrix', label: t('2707'), keyboardType: !!deviceBaseInfo?.matrixScreen },
        ];
        return tabs.filter((tab) => {
            if (tab.keyboardType === false) return false;
            if ('keyBoardLayer' in tab && !tab.keyBoardLayer) return false;
            return true;
        });
    }, [connectedKeyboard, keyboardData, deviceBaseInfo, keyboard?.keyboardType, keyboardLayout?.menus, t, onlyTestMode]);

    const connectedKeyboardDevMode = useMemo(() => {
        const currentKeyboard = keyboardData.find((item: any) => item.productName === connectedKeyboard?.productName);
        return currentKeyboard?.devMode ?? 0;
    }, [connectedKeyboard, keyboardData]);

    const connectedDeviceKey = useMemo(() => {
        if (typeof connectedKeyboard?.vendorId !== 'number' || typeof connectedKeyboard?.productId !== 'number') {
            return '';
        }
        return deviceInfoKey(connectedKeyboard.vendorId, connectedKeyboard.productId, connectedKeyboardDevMode);
    }, [connectedKeyboard?.vendorId, connectedKeyboard?.productId, connectedKeyboardDevMode]);

    const keyboardSkinOptions = useMemo(() => {
        const fromLayout = normalizeKeyboardSkinOptions(
            (keyboardLayout as { previewSkins?: unknown } | undefined)?.previewSkins,
        );
        if (
            Array.isArray((keyboardLayout as { previewSkins?: unknown } | undefined)?.previewSkins)
            && (keyboardLayout as { previewSkins?: unknown[] }).previewSkins!.length > 0
        ) {
            return fromLayout;
        }
        return getDevicePreviewSkinOptions(
            connectedKeyboard?.vendorId,
            connectedKeyboard?.productId,
            connectedKeyboardDevMode,
        );
    }, [
        keyboardLayout,
        connectedKeyboard?.vendorId,
        connectedKeyboard?.productId,
        connectedKeyboardDevMode,
    ]);

    const keyboardSkin = useMemo(
        () => pickValidDeviceSkin(
            connectedDeviceKey ? deviceSkins[connectedDeviceKey] : undefined,
            keyboardSkinOptions,
        ),
        [connectedDeviceKey, deviceSkins, keyboardSkinOptions],
    );

    const setKeyboardSkinForDevice = useCallback((deviceKey: string, skin: string, options: KeyboardSkinOption[]) => {
        const nextSkin = pickValidDeviceSkin(skin, options);
        setDeviceSkins((prev) => ({ ...prev, [deviceKey]: nextSkin }));
    }, []);

    /** Popover 中只展示 deviceInfo 已登记的设备 */
    const keyboardDataInConfig = useMemo(
        () =>
            keyboardData.filter((kb: any) =>
                isDeviceInDeviceInfo(kb.vendorId, kb.productId, kb.devMode ?? 0),
            ),
        [keyboardData],
    );

    const keyboardPreviewWithSkinSrc = useMemo(() => {
        if (typeof connectedKeyboard?.vendorId !== 'number' || typeof connectedKeyboard?.productId !== 'number') {
            return '';
        }
        return resolveDeviceKeyboardPreviewSrc(
            connectedKeyboard.vendorId,
            connectedKeyboard.productId,
            connectedKeyboardDevMode,
            keyboardSkin,
        );
    }, [
        connectedKeyboard?.vendorId,
        connectedKeyboard?.productId,
        connectedKeyboardDevMode,
        keyboardSkin,
    ]);
    const showKeyboardPreviewImage = isKeyboardPreviewAvailable(keyboardPreviewWithSkinSrc);

    const handleKeyboardPreviewError = useCallback(() => {
        if (markKeyboardPreviewFailed(keyboardPreviewWithSkinSrc)) {
            setPreviewImageTick((prev) => prev + 1);
        }
    }, [keyboardPreviewWithSkinSrc]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        setDeviceSkins(readDeviceSkinsFromStorage());
        setDeviceSkinsHydrated(true);
    }, []);

    useEffect(() => {
        if (!deviceSkinsHydrated || !connectedDeviceKey) return;
        const legacy = window.localStorage.getItem(LEGACY_KEYBOARD_SKIN_STORAGE_KEY);
        if (!legacy) return;
        setDeviceSkins((prev) => {
            if (prev[connectedDeviceKey]) return prev;
            return { ...prev, [connectedDeviceKey]: legacy };
        });
    }, [deviceSkinsHydrated, connectedDeviceKey]);

    useEffect(() => {
        if (!deviceSkinsHydrated) return;
        writeDeviceSkinsToStorage(deviceSkins);
    }, [deviceSkins, deviceSkinsHydrated]);

    useEffect(() => {
        if (!connectedDeviceKey) return;
        setDeviceSkins((prev) => {
            const current = prev[connectedDeviceKey];
            const valid = pickValidDeviceSkin(current, keyboardSkinOptions);
            if (current === valid) return prev;
            return { ...prev, [connectedDeviceKey]: valid };
        });
    }, [connectedDeviceKey, keyboardSkinOptions]);

    useEffect(() => {
        if (!keyboardSettings.length) return;
        const isValid = keyboardSettings.some((item) => item.id === selectedSetting);
        if (isValid) return;

        const firstLightTab = keyboardSettings.find(
            (item) =>
                item.id === 'lighting'
                || item.id === 'logolighting'
                || item.id.startsWith('qmk-light:'),
        );
        setSelectedSetting(firstLightTab?.id ?? keyboardSettings[0].id);
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
                            background: isDark ? 'rgba(0,0,0,0.55)' : KP.overlayBg,
                            backdropFilter: KP.overlayBlur,
                        }}
                    />
                )}

                <Box
                    sx={{
                        ...panelCardSx,
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
                                    color: isDark ? theme.palette.text.primary : '#7d93b0',
                                    border: isDark
                                        ? `1px solid ${alpha(theme.palette.primary.main, 0.45)}`
                                        : '1px solid rgba(125,147,176,0.35)',
                                    '&:hover': {
                                        color: isDark ? theme.palette.primary.main : '#4a86f7',
                                        borderColor: isDark ? theme.palette.primary.main : '#9fc2ff',
                                        backgroundColor: isDark
                                            ? alpha(theme.palette.primary.main, 0.12)
                                            : 'rgba(74,134,247,0.08)',
                                    },
                                }}
                            >
                                <ChevronRightOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                        ) : (
                            <>
                                <Typography sx={{ ...KP.titleFont, color: isDark ? theme.palette.text.primary : KP.titleColor }}>
                                    {t('2708')}
                                </Typography>
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
                                        color: isDark ? theme.palette.text.primary : '#7d93b0',
                                        border: isDark
                                            ? `1px solid ${alpha(theme.palette.primary.main, 0.45)}`
                                            : '1px solid rgba(125,147,176,0.35)',
                                        '&:hover': {
                                            color: isDark ? theme.palette.primary.main : '#4a86f7',
                                            borderColor: isDark ? theme.palette.primary.main : '#9fc2ff',
                                            backgroundColor: isDark
                                                ? alpha(theme.palette.primary.main, 0.12)
                                                : 'rgba(74,134,247,0.08)',
                                        },
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
                            ...(isDark
                                ? {
                                      background: `linear-gradient(180deg, ${theme.palette.customed1.main} 0%, ${theme.palette.background.paper} 100%)`,
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                                  }
                                : {
                                      background: 'linear-gradient(180deg, #f8fbff 0%, #f1f6fd 100%)',
                                      border: '1px solid #dbe7f6',
                                  }),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#8ea3bd',
                            fontSize: '11px',
                            overflow: 'hidden',
                            ...(settingsMenuCollapsed ? { cursor: 'pointer' } : {}),
                        }}
                    >
                        {showKeyboardPreviewImage ? (
                            <Box
                                component="img"
                                src={keyboardPreviewWithSkinSrc}
                                alt={t('2712')}
                                onError={handleKeyboardPreviewError}
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
                                    backgroundColor: isDark ? theme.palette.customed1.main : '#fff',
                                }}
                            />
                        )}
                    </Box>
                    {!settingsMenuCollapsed ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <Typography
                                sx={{
                                    fontSize: '18px',
                                    lineHeight: 1.1,
                                    color: isDark ? theme.palette.text.primary : '#5f7da3',
                                    fontWeight: 600,
                                }}
                            >
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
                            mt: '8px',
                            width: `${KP.popoverWidth}px`,
                            cursor: 'default',
                            ...(isDark
                                ? {
                                      border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                                      background: theme.palette.background.paper,
                                      boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
                                  }
                                : {
                                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
                                      border: '1px solid #91a1b8',
                                      background:
                                          'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3);',
                                  }),
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
                                color: theme.palette.primary.contrastText,
                                mb: '10px',
                                background: theme.palette.primary.main,
                                width: '100%',
                                textTransform: 'none',
                                borderRadius: `${KP.radiusDefault}px`,
                                py: '10px',
                                '&:hover': { background: theme.palette.primary.dark },
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
                                const kbDevMode = kb.devMode ?? 0;
                                const kbDeviceKey = deviceInfoKey(kb.vendorId, kb.productId, kbDevMode);
                                const kbSkinOptions = getDevicePreviewSkinOptions(kb.vendorId, kb.productId, kbDevMode);
                                const kbSkin = pickValidDeviceSkin(deviceSkins[kbDeviceKey], kbSkinOptions);
                                const kbPreviewWithSkinSrc = resolveDeviceKeyboardPreviewSrc(
                                    kb.vendorId,
                                    kb.productId,
                                    kbDevMode,
                                    kbSkin,
                                );
                                const showKbPreviewImage = isKeyboardPreviewAvailable(kbPreviewWithSkinSrc);
                                const showKbSkinSelect = kbSkinOptions.length > 1;
                                return (
                                    <Box
                                        key={kb.id || kb.address || `${kb.productName}-${index}`}
                                        onClick={() => handleSelectKeyboard(kb)}
                                        sx={{
                                            p: '10px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            backgroundColor: active
                                                ? theme.palette.primary.main
                                                : 'transparent',
                                            transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
                                            '&:hover': {
                                                backgroundColor: active
                                                    ? theme.palette.primary.main
                                                    : isDark
                                                      ? alpha(theme.palette.primary.main, 0.08)
                                                      : 'rgba(241, 245, 249, 0.9)',
                                            },
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Box
                                                sx={{
                                                    width: '48px',
                                                    height: '40px',
                                                    backgroundColor: isDark ? theme.palette.customed1.main : '#fff',
                                                    borderRadius: '6px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden',
                                                }}
                                            >
                                                {showKbPreviewImage ? (
                                                    <Box
                                                        component="img"
                                                        src={kbPreviewWithSkinSrc}
                                                        alt={kb.productName || t('2713')}
                                                        onError={() => {
                                                            if (markKeyboardPreviewFailed(kbPreviewWithSkinSrc)) {
                                                                setPreviewImageTick((prev) => prev + 1);
                                                            }
                                                        }}
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
                                                            backgroundColor: isDark ? theme.palette.customed1.main : '#fff',
                                                        }}
                                                    />
                                                )}
                                            </Box>

                                            <Box sx={{ flex: 1, mx: '10px', minWidth: 0 }}>
                                                <Typography
                                                    sx={{
                                                        fontSize: KP.titleFont.fontSize,
                                                        fontWeight: KP.titleFont.fontWeight,
                                                        color: active
                                                            ? theme.palette.primary.contrastText
                                                            : isDark
                                                              ? theme.palette.text.primary
                                                              : '#0f172a',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                    }}
                                                >
                                                    {kb.productName}
                                                </Typography>

                                                {showKbSkinSelect ? (
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mt: '6px' }}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onMouseDown={(event) => event.stopPropagation()}
                                                    >
                                                        <Select
                                                            variant="outlined"
                                                            value={kbSkin}
                                                            displayEmpty
                                                            renderValue={(value) => {
                                                                const opt = kbSkinOptions.find(
                                                                    (o) => o.value === value,
                                                                );
                                                                return opt ? getKeyboardSkinOptionLabel(opt, t) : '';
                                                            }}
                                                            inputProps={{
                                                                'aria-label': t('2712'),
                                                            }}
                                                            onChange={(event: SelectChangeEvent<string>) => {
                                                                setKeyboardSkinForDevice(
                                                                    kbDeviceKey,
                                                                    event.target.value,
                                                                    kbSkinOptions,
                                                                );
                                                            }}
                                                            onClick={(event) => event.stopPropagation()}
                                                            MenuProps={{
                                                                disableAutoFocusItem: true,
                                                                marginThreshold: 0,
                                                                PaperProps: {
                                                                    sx: {
                                                                        mt: '-1px',
                                                                        py: '4px',
                                                                        px: '4px',
                                                                        borderRadius: '0 0 4px 4px',
                                                                        border: '1px solid #DCDFE6',
                                                                        borderTop: 'none',
                                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                                                                        bgcolor: '#fff',
                                                                        '& .MuiMenuItem-root': {
                                                                            fontSize: 14,
                                                                            fontWeight: 400,
                                                                            color: '#606266',
                                                                            minHeight: 36,
                                                                            borderRadius: '4px',
                                                                            border: '1px solid transparent',
                                                                            bgcolor: 'transparent',
                                                                            mx: 0,
                                                                            my: '2px',
                                                                        },
                                                                        '& .MuiMenuItem-root:hover': {
                                                                            bgcolor: 'transparent !important',
                                                                            color: '#606266',
                                                                            borderColor: '#3B82F6',
                                                                        },
                                                                        '& .MuiMenuItem-root.Mui-selected': {
                                                                            bgcolor: '#3B82F6 !important',
                                                                            color: '#fff !important',
                                                                            borderColor: 'transparent',
                                                                        },
                                                                        '& .MuiMenuItem-root.Mui-selected:hover': {
                                                                            bgcolor: '#2563EB !important',
                                                                            color: '#fff !important',
                                                                        },
                                                                        '& .MuiMenuItem-root.Mui-focusVisible': {
                                                                            bgcolor: 'transparent',
                                                                        },
                                                                    },
                                                                },
                                                            }}
                                                            sx={{
                                                                height: 32,
                                                                borderRadius: '4px',
                                                                fontSize: 14,
                                                                fontWeight: 400,
                                                                color: '#606266',
                                                                bgcolor: '#fff',
                                                                transition:
                                                                    'border-color 0.15s ease, box-shadow 0.15s ease, border-radius 0.15s ease',
                                                                '& legend': { display: 'none' },
                                                                '& fieldset': { top: 0 },
                                                                '& .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: '#DCDFE6',
                                                                },
                                                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: '#C0C4CC',
                                                                },
                                                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: '#3B82F6',
                                                                    borderWidth: '1px',
                                                                },
                                                                '&.Mui-expanded': {
                                                                    borderRadius: '4px 4px 0 0',
                                                                },
                                                                '&.Mui-expanded .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: '#3B82F6',
                                                                },
                                                                '& .MuiSelect-select': {
                                                                    py: 0,
                                                                    px: '10px',
                                                                    pr: '28px !important',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    minHeight: 'unset',
                                                                },
                                                                '& .MuiSvgIcon-root': {
                                                                    color: '#9EC5FE',
                                                                    right: 6,
                                                                    transition: 'color 0.15s ease',
                                                                },
                                                                '&:hover .MuiSvgIcon-root': {
                                                                    color: '#7CB6FD',
                                                                },
                                                                '&.Mui-focused .MuiSvgIcon-root, &.Mui-expanded .MuiSvgIcon-root':
                                                                {
                                                                    color: '#3B82F6',
                                                                },
                                                            }}
                                                        >
                                                            {kbSkinOptions.map((option) => (
                                                                <MenuItem
                                                                    key={option.value}
                                                                    value={option.value}
                                                                    dense
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                >
                                                                    {getKeyboardSkinOptionLabel(option, t)}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
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
                        ...panelCardSx,
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        padding: `${KP.submenuContainerPaddingY}px ${KP.submenuContainerPaddingX}px`,
                        gap: `${KP.submenuContainerGap}px`,
                        transition: 'padding 0.2s ease-out, gap 0.2s ease-out',
                    }}
                >
                    {!settingsMenuCollapsed ? (
                        <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', height: 30 }}>
                                <Typography
                                    sx={{
                                        ...KP.titleFont,
                                        color: isDark ? theme.palette.text.primary : KP.titleColor,
                                        fontSize: '20px',
                                        fontWeight: 400,
                                        p: '0px 10px',
                                    }}
                                >
                                    {t('2711')}
                                </Typography>
                            </Box>
                            <Typography
                                sx={{
                                    ...KP.tipsFont,
                                    color: isDark ? theme.palette.text.secondary : KP.tipsColor,
                                    mt: '6px',
                                    fontSize: '16px',
                                    fontWeight: 400,
                                    lineHeight: 1.4,
                                    p: '0px 10px',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {t('2710')}
                            </Typography>
                        </Box>
                    ) : null}

                    <Stack
                        spacing={0}
                        sx={{
                            gap: `${KP.submenuGap}px`,
                            flex: 1,
                            minHeight: 0,
                            overflow: 'hidden',
                            overflowY: 'auto',
                            alignItems: 'center',
                            ...getComfortableScrollbarSx(isDark),
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
                                        aria-label={setting.label}
                                        onClick={() => handleSettingSelect(setting.id)}
                                        startIcon={
                                            <KeyboardPanelSettingIcon
                                                id={setting.id}
                                                iconId={'iconId' in setting ? setting.iconId : undefined}
                                                active={active}
                                                collapsed={settingsMenuCollapsed}
                                                isDark={isDark}
                                            />
                                        }
                                        sx={{
                                            minWidth: 0,
                                            width: settingsMenuCollapsed ? 44 : '100%',
                                            height: '42px',
                                            px: settingsMenuCollapsed ? 0 : `${KP.submenuPaddingX}px`,
                                            borderRadius: active && isDark ? '999px' : '10px',
                                            justifyContent: settingsMenuCollapsed ? 'center' : 'flex-start',
                                            gap: settingsMenuCollapsed ? 0 : '10px',
                                            fontSize: '16px',
                                            fontWeight: active ? 600 : 500,
                                            textTransform: 'none',
                                            color: active
                                                ? theme.palette.primary.contrastText
                                                : isDark
                                                  ? theme.palette.text.primary
                                                  : '#7d93b0',
                                            backgroundColor: active ? theme.palette.primary.main : 'transparent',
                                            transition:
                                                'background-color 0.2s ease-out, color 0.2s ease-out, width 0.2s ease-out, border-radius 0.2s ease-out',
                                            '& .MuiButton-startIcon': {
                                                mr: settingsMenuCollapsed ? 0 : 1,
                                                ml: 0,
                                                '& svg': { fontSize: settingsMenuCollapsed ? 20 : 18 },
                                                '& img': {
                                                    width: settingsMenuCollapsed ? 20 : 18,
                                                    height: settingsMenuCollapsed ? 20 : 18,
                                                },
                                            },
                                            '&:hover': {
                                                backgroundColor: active
                                                    ? theme.palette.primary.dark
                                                    : isDark
                                                      ? alpha(theme.palette.primary.main, 0.14)
                                                      : 'rgba(74, 134, 247, 0.08)',
                                                color: active
                                                    ? theme.palette.primary.contrastText
                                                    : isDark
                                                      ? theme.palette.text.primary
                                                      : '#4a86f7',
                                                transform: active ? 'scale(1)' : 'scale(1.05)',
                                            },
                                            '&:active': {
                                                backgroundColor: active
                                                    ? theme.palette.primary.dark
                                                    : isDark
                                                      ? alpha(theme.palette.primary.main, 0.2)
                                                      : 'rgba(59, 130, 246, 0.08)',
                                                transform: active ? 'scale(1)' : 'scale(.95)',
                                                transition: 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
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
            <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', paddingBottom: 43, justifyContent: "space-between" }}>
                <SettingsContent
                    selectedSetting={selectedSetting}
                    deviceAuthorized={Boolean(deviceStatus)}
                    onKeyboardScaleChange={handleKeyboardScaleChange}
                />
            </Box>
        </Box>
    );
}
