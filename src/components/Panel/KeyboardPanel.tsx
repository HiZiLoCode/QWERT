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
import { QMK_KeyboardDevice } from '@/devices/QMK/QMK_KeyboardDevice';
import { KeyboardDevice } from '@/devices/KeyboardDevice';
import { KeyboardAPI } from '@/devices/KeyboardAPI';
import { ScreenThemePage } from '@/components/ScreenTheme';
import HomePage from '@/components/GIFHome/HomePage';
import { EditorContext } from '@/providers/EditorProvider';
import { deviceInfo, isDeviceInDeviceInfo } from '@/config/deviceInfo';
import { MainContext } from '@/providers/MainProvider';
import { useTranslation } from '@/app/i18n';
import { getComfortableScrollbarSx } from '@/utils/comfortableScrollbarSx';
import { alpha, useTheme } from '@mui/material/styles';

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
    active,
    collapsed,
    isDark,
}: {
    id: string;
    active: boolean;
    collapsed: boolean;
    isDark: boolean;
}) {
    const src = KP_SETTING_ICON_SRC[id];
    if (!src) return null;
    const size = collapsed ? 20 : 18;
    return (
        <Box
            component="img"
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

type KeyboardSkinOption = {
    value: string;
    /** `common` 命名空间下的文案 key；优先于 `label` 展示 */
    lang?: string;
    /** 无翻译或未加载时的回退文案 */
    label?: string;
    suffix: string;
    image?: string;
};

function getKeyboardSkinOptionLabel(
    option: KeyboardSkinOption,
    t: (key: string, options?: { defaultValue?: string }) => string,
): string {
    if (option.lang) {
        return t(option.lang, { defaultValue: option.label ?? option.value });
    }
    return option.label ?? option.value;
}

const DEFAULT_KEYBOARD_SKIN_OPTIONS: KeyboardSkinOption[] = [
    { value: 'blackWarrior', lang: '2890', label: '黑武士', suffix: '', image: '' },
    { value: 'lightShine', lang: '2891', label: '银闪闪', suffix: '_lightShine', image: '' },
    { value: 'strawberryPink', lang: '2892', label: '草莓粉', suffix: '_strawberryPink', image: '' },
    { value: 'sapphireBlue', lang: '2893', label: '蓝宝石', suffix: '_sapphireBlue', image: '' },
];

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
            typeof (item as { suffix?: unknown }).suffix === 'string' &&
            (typeof (item as { label?: unknown }).label === 'string' ||
                typeof (item as { lang?: unknown }).lang === 'string') &&
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
                                            backgroundColor: active
                                                ? theme.palette.primary.main
                                                : isDark
                                                  ? alpha(theme.palette.primary.main, 0.08)
                                                  : 'rgba(241, 245, 249, 0.9)',
                                            transition: 'background-color 0.2s ease-out, color 0.2s ease-out',
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

                                                {active ? (
                                                    <FormControl
                                                        fullWidth
                                                        size="small"
                                                        sx={{ mt: '6px' }}
                                                        onClick={(event) => event.stopPropagation()}
                                                        onMouseDown={(event) => event.stopPropagation()}
                                                    >
                                                        <Select
                                                            variant="outlined"
                                                            value={keyboardSkin}
                                                            displayEmpty
                                                            renderValue={(value) => {
                                                                const opt = keyboardSkinOptions.find(
                                                                    (o) => o.value === value,
                                                                );
                                                                return opt ? getKeyboardSkinOptionLabel(opt, t) : '';
                                                            }}
                                                            inputProps={{
                                                                'aria-label': t('2712'),
                                                            }}
                                                            onChange={(event: SelectChangeEvent<string>) => {
                                                                setKeyboardSkin(event.target.value);
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
                                                            {keyboardSkinOptions.map((option) => (
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
                    <Box sx={{ width: '100%' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: settingsMenuCollapsed ? 'center' : 'flex-start', height: 30 }}>
                            <Typography
                                sx={{
                                    ...KP.titleFont,
                                    color: isDark ? theme.palette.text.primary : KP.titleColor,
                                    visibility: settingsMenuCollapsed ? 'hidden' : 'visible',
                                    fontSize: "20px",
                                    fontWeight: "400",
                                    p:"0px 10px"
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
                                height: '20px',
                                visibility: settingsMenuCollapsed ? 'hidden' : 'visible',
                                overflow: 'hidden',
                                fontSize: "16px",
                                fontWeight: "400",
                                p:"0px 10px"
                            }}
                        >
                            {t('2710')}
                        </Typography>
                    </Box>

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
