'use client';

import { Box, Button, Typography } from '@mui/material';
import { useContext, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import { isHidWriteNotAllowedError } from '@/lib/hidOutputWriteLock';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import FullKeyboard from '@/components/FullKeyboard';
import CombinationKeyBoard from '@/components/CombinationKeyBoard';
import MacroRecorder from '@/components/KeyBoardPanel/MacroRecorder';
import QMKAnyKeycodeDialog from '@/components/KeyBoardPanel/QMKAnyKeycodeDialog';
import customKeys from '@/data/customkeys.json';
import type { LayoutKey } from '@/types/types_v1';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';
import { mergePhysicalLayoutWithQmkLayer, qmkLayerToLayoutKeys, resolveQMKDisplayLayoutKeys } from '@/utils/qmkLayoutBridge';
import {
    buildQMKCustomKeycodes,
    buildQMKKeycodeMenus,
    codeToNumber,
    getQMKPoolForCategory,
    getSelectedQMKKeyInfo,
    hidModMaskToQmkKeycode,
    qmkKeycodeToDisplayName,
    reReadAllQMKLayers,
    type QMKPanelCategory,
} from '@/utils/qmkKeyCodeApply';
import type { IKeycode } from '@/utils/key-to-byte/qmk_keyCode';
import { getBasicKeyDict } from '@/utils/key-to-byte/dictionary-store';
import { KEY_TYPE_ICON_BOX_PX } from '@/constants/keyTypeIconDisplay';
import { expandKeyedPool, type KeyPoolItem } from '@/utils/customkeysUiLayout';
import {
    isPickupLightingDevice,
    resolveLogoLightKeyLangKey,
    resolveLogoLightingLangKey,
} from '@/utils/qmkLightingBridge';
import { EditorContext } from '@/providers/EditorProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import {
    hiddenAnyMacrosFromMap,
    isValidVendorAnyInput,
    isVendorAnyKeyType,
    mergeMacroProfilesForDevice,
    parseVendorAnyInput,
    readVendorAnyMacroMap,
    resolveVendorAnyMacroSlot,
    toDeviceKeyType,
    VENDOR_KEY_TYPE_ANY,
    writeVendorAnyMacroMap,
} from '@/utils/vendor91683AnyKey';
import type { MacroProfile } from '@/types/types_v1';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';
import PublicAssetImage from '@/components/common/PublicAssetImage';

/**
 * 与配置页截图：侧栏约为主键盘区宽度的 15%–20%；大块留白与浅灰底卡片。
 */
const MAP = {
    /** LAYER 列与白卡左缘的间距；白卡内还有内边距，见 TravelVirtualKeyboard */
    columnGapMain: 69,
    sectionGapVertical: 24,
    /** 侧栏占该行宽约 18%，并限制在常见屏宽下的像素范围 */
    sideColumnFlex: '0 0 18%',
    sideColumnMinWidth: 264,
    sideColumnMaxWidth: 264,
    layerTitleSize: 16,
    layerBtnHeight: 28,
    layerBtnRadius: 12,
    layerBtnGap: 5,
    layerFontSize: 12,
    sectionShellPadding: 0,
    sectionShellRadius: 0,
    sectionShellBg: 'transparent',
    sectionShellBorder: 'none',
    sectionShellShadow: 'none',
    categoryPadding: 22,
    categoryRadius: 12,
    categoryTitleSize: 15,
    categoryItemHeight: 38,
    categoryItemRadius: 26,
    categoryGap: 6,
    contentPadding: 24,
    contentRadius: 12,
    cardBorder: '1px solid #e5e7eb',
    cardShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
    primary: '#4a86f7',
    primaryHover: '#3b78f0',
    textMuted: '#64748b',
    textTitle: '#5f7089',
    /** 仅限制顶部区域最小高度，避免键盘被压扁；略小以贴近设计稿比例 */
    topAreaMinHeight: 300,
    /** 媒体 / 功能 / 自定义等 Tab 下图标键位池每行个数 */
    keyPoolIconColumns: 12,
    keyPoolIconGridGap: 6,
} as const;

type DeviceLightCaps = {
    hasBacklight: boolean;
    hasLogoLight: boolean;
    hasSideLight: boolean;
    hasMatrixLight: boolean;
};

function isCustomKeyVisibleForDevice(item: KeyItem, caps: DeviceLightCaps): boolean {
    const code = String(item.code || '').toUpperCase();
    const isBacklightKey = code.startsWith('KEY_LIGHT_') || code.startsWith('BL_');
    const isLogoKey = code.startsWith('LOGO_LIGHT_') || code.startsWith('LG_');
    const isSideKey = code.startsWith('SIDE_LIGHT_') || code.startsWith('SD_');
    const isMatrixKey = code.startsWith('MATRIX_LIGHT_') || code.startsWith('MATRIX_');

    if (isBacklightKey && !caps.hasBacklight) return false;
    if (isLogoKey && !caps.hasLogoLight) return false;
    if (isSideKey && !caps.hasSideLight) return false;
    if (isMatrixKey && !caps.hasMatrixLight) return false;
    return true;
}

function isSectionPoolItem(
    item: KeyPoolItem,
): item is { isSectionHeader: true; sectionTitleKey: string; code: string } {
    return 'isSectionHeader' in item && item.isSectionHeader === true;
}

/** 功能池仅展示 SVG 图标键，过滤 emoji 占位（避免缩成小点）。 */
function isSvgPoolIcon(icon: string | undefined): boolean {
    const value = String(icon ?? '').trim();
    return value.startsWith('/KeyType/') || value.endsWith('.svg') || value.endsWith('.png');
}

/** Fn1–Fn3 无图标，以文字展示，需保留在功能 Tab。 */
function isFnLayerPoolKey(code: string | undefined): boolean {
    return /^FN_[1-3]$/.test(String(code || '').toUpperCase());
}

function filterFunctionPoolItems(items: KeyPoolItem[]): KeyPoolItem[] {
    return items.filter((item) => {
        if (isSectionPoolItem(item)) return true;
        const key = item as KeyItem;
        if (isFnLayerPoolKey(key.code)) return true;
        if (key.type === 80) return isSvgPoolIcon(key.icon);
        return isSvgPoolIcon(key.icon) || !key.icon;
    });
}

type KeyItem = {
    name: string;
    code: string;
    type: number;
    code1: number;
    code2: number;
    code3?: number;
    langid?: string;
    /** 若存在，悬停提示用该文案；按钮上仍用 `langid` / 90000+code1 / `name` */
    tooltipLangid?: string;
    icon?: string;
    /** QMK 键码池：使用正常字号展示，避免 scale(0.6) 过小 */
    isQmkPoolKey?: boolean;
};

const KeyButton = ({
    keyItem,
    onSelectKey,
    isPickupDevice,
}: {
    keyItem: KeyItem;
    onSelectKey?: (key: KeyItem) => void;
    isPickupDevice: boolean;
}) => {
    const [hover, setHover] = useState(false);
    const { t } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const dragStart = (evt: DragEvent) => {
        evt.dataTransfer.setData('keyCode', JSON.stringify(keyItem));
    };

    const changeKey = () => {
        if (onSelectKey) onSelectKey(keyItem);
    };

    const displayLangId =
        resolveLogoLightKeyLangKey(keyItem, isPickupDevice)
        ?? (keyItem.type === 80 && !keyItem.langid && keyItem.code1 > 0
            ? String(90000 + keyItem.code1)
            : keyItem.langid);
    const tooltipLangId = resolveLogoLightingLangKey(keyItem.tooltipLangid, isPickupDevice);
    const translatedByLangid = displayLangId ? t(displayLangId) : '';
    const displayLabel =
        (translatedByLangid && translatedByLangid !== displayLangId ? translatedByLangid : '') ||
        keyItem.name;
    const tooltipFromId = tooltipLangId ? t(tooltipLangId) : '';
    const tooltipTitle =
        tooltipLangId && tooltipFromId && tooltipFromId !== tooltipLangId
            ? tooltipFromId
            : displayLabel;
    const iconValue = keyItem.icon ?? '';
    const isImageIcon =
        typeof iconValue === 'string' &&
        (iconValue.startsWith('/KeyType/') || iconValue.endsWith('.svg') || iconValue.endsWith('.png'));

    const codeUpper = String(keyItem.code || '').toUpperCase();
    /** Fn0–3 短标签：与设计稿一致用正文字号，不再整体 scale(0.6) */
    const isCompactFnLayerText =
        !keyItem.icon && /^FN_[0-3]$/.test(codeUpper);
    const useFullSizeLabel = Boolean(keyItem.isQmkPoolKey || isCompactFnLayerText);

    return (
        <Box sx={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <UnifiedTooltip title={tooltipTitle} arrow placement="top">
                <ButtonRem
                    variant="text"
                    onMouseEnter={() => setHover(true)}
                    onMouseLeave={() => setHover(false)}
                    draggable
                    onDragStart={dragStart}
                    sx={{
                        width: '100%',
                        minWidth: 0,
                        maxWidth: '100%',
                        height: '56px',
                        borderRadius: '10px',
                        textTransform: 'none',
                        fontSize: '14px',
                        fontWeight: 600,
                        wordBreak: 'keep-all',
                        overflowWrap: 'break-word',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        padding: '6px 8px',
                        ...(isDark
                            ? {
                                  border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                                  color: hover ? theme.palette.primary.light : theme.palette.text.primary,
                                  backgroundColor: hover
                                      ? alpha(theme.palette.primary.main, 0.22)
                                      : theme.palette.customed1.main,
                                  boxShadow: hover
                                      ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)} inset`
                                      : '0 2px 8px rgba(0,0,0,0.25)',
                                  '&:hover': {
                                      borderColor: alpha(theme.palette.primary.main, 0.55),
                                      backgroundColor: alpha(theme.palette.primary.main, 0.18),
                                  },
                              }
                            : {
                                  border: '1px solid #cfe0ff',
                                  color: hover ? '#2f6fe8' : '#2d4a75',
                                  backgroundColor: hover ? '#f2f7ff' : '#ffffff',
                                  boxShadow: hover ? '0 0 0 1px #9fc2ff inset' : '0 2px 6px rgba(63, 115, 197, 0.06)',
                                  '&:hover': {
                                      borderColor: '#9fc2ff',
                                      backgroundColor: '#f7fbff',
                                  },
                              }),
                    }}
                    onClick={changeKey}
                >
                    {keyItem.icon ? (
                        isImageIcon ? (
                            <Box
                                sx={{
                                    width: KEY_TYPE_ICON_BOX_PX,
                                    height: KEY_TYPE_ICON_BOX_PX,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                <PublicAssetImage
                                    src={iconValue}
                                    alt={displayLabel}
                                    sx={{
                                        width: KEY_TYPE_ICON_BOX_PX,
                                        height: KEY_TYPE_ICON_BOX_PX,
                                        objectFit: 'contain',
                                        filter:
                                            isDark && isImageIcon
                                                ? 'brightness(0) invert(1)'
                                                : 'none',
                                    }}
                                />
                            </Box>
                        ) : (
                            <span style={{ transform: 'scale(0.6)', display: 'inline-flex' }}>{keyItem.icon}</span>
                        )
                    ) : useFullSizeLabel ? (
                        <Box
                            component="span"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                fontSize: keyItem.isQmkPoolKey ? '12px' : '14px',
                                fontWeight: 600,
                                lineHeight: 1.25,
                                whiteSpace: keyItem.isQmkPoolKey ? 'normal' : 'nowrap',
                                wordBreak: 'break-word',
                                textAlign: 'center',
                                px: '2px',
                            }}
                        >
                            {displayLabel}
                        </Box>
                    ) : (
                        <span style={{ transform: 'scale(0.6)', width: '128px', whiteSpace: 'pre-wrap', display: 'flex' }}>
                            {displayLabel}
                        </span>
                    )}
                </ButtonRem>
            </UnifiedTooltip>
        </Box>
    );
};

type CategoryId =
    | 'basic'
    | 'media'
    | 'shortcut'
    | 'custom'
    | 'macro'
    | 'combination'
    | 'layers'
    | 'special'
    | 'lighting';

type Category = {
    id: CategoryId;
    labelKey: string;
};

const CATEGORIES: Category[] = [
    { id: 'basic', labelKey: '1500' },
    { id: 'media', labelKey: '1501' },
    { id: 'custom', labelKey: '104' },
    { id: 'shortcut', labelKey: '103' },
    { id: 'macro', labelKey: '105' },
    { id: 'combination', labelKey: '106' },
];

const QMK_CATEGORY_BASE: Category[] = [
    { id: 'basic', labelKey: '1500' },
    { id: 'media', labelKey: '1501' },
    { id: 'macro', labelKey: '1502' },
    { id: 'layers', labelKey: '1503' },
    { id: 'special', labelKey: '1504' },
    { id: 'lighting', labelKey: '1505' },
];

function qmkKeycodeToPoolItem(kc: IKeycode): KeyItem {
    return {
        name: qmkKeycodeToDisplayName(kc),
        code: kc.code,
        type: 0,
        code1: 0,
        code2: 0,
        tooltipLangid: kc.title,
        isQmkPoolKey: true,
    };
}

type KeyMappingPanelProps = {
    onKeyboardScaleChange?: (ratio: number) => void;
};

export default function KeyMappingPanel({ onKeyboardScaleChange }: KeyMappingPanelProps = {}) {
    const { connectedKeyboard, keyboard, macroList, keyboardLayout, keyboardData, isKeyboardSwitching } = useContext(ConnectKbContext);
    const { macroProfiles } = macroList;
    const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
    const currentLayer = keyboard?.layer ?? 0;
    const selectedIndex = keyboard?.selectIndex ?? -1;
    const userKeys = keyboard?.userKeys?.[currentLayer] ?? [];
    const { selectedSetting } = useContext(EditorContext);
    const { t } = useTranslation('common');
    const { showMessage } = useSnackbarDialog();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [category, setCategory] = useState<CategoryId>('basic');
    const [anyDialogOpen, setAnyDialogOpen] = useState(false);
    const [vendorAnyDialogOpen, setVendorAnyDialogOpen] = useState(false);
    const isQMK = keyboard?.keyboardType === 'QMK';

    const devMode = useMemo(() => {
        const current = keyboardData.find((item: { productName?: string; devMode?: number }) => item.productName === connectedKeyboard?.productName);
        return current?.devMode ?? 0;
    }, [keyboardData, connectedKeyboard?.productName]);
    const isPickupDevice = useMemo(
        () => isPickupLightingDevice(connectedKeyboard?.vendorId, connectedKeyboard?.productId, devMode),
        [connectedKeyboard?.vendorId, connectedKeyboard?.productId, devMode],
    );

    const qmkDict = useMemo(
        () => getBasicKeyDict(keyboard?.version ?? 10) as Record<string, number>,
        [keyboard?.version],
    );

    const qmkMenus = useMemo(() => {
        const custom = buildQMKCustomKeycodes(keyboardLayout?.customKeycodes);
        return buildQMKKeycodeMenus(custom);
    }, [keyboardLayout?.customKeycodes]);

    const qmkCategories = useMemo(() => {
        const categories = [...QMK_CATEGORY_BASE];
        if ((keyboardLayout?.customKeycodes?.length ?? 0) > 0) {
            categories.push({ id: 'custom', labelKey: '1506' });
        }
        return categories;
    }, [keyboardLayout?.customKeycodes]);

    const visibleCategories = isQMK ? qmkCategories : CATEGORIES;

    useEffect(() => {
        if (!isQMK) return;
        if (!qmkCategories.some((c) => c.id === category)) {
            setCategory('basic');
        }
    }, [isQMK, qmkCategories, category]);

    const qmkLayerCount = keyboard?.allQMKLayers?.length || 4;

    const basicList = useMemo(() => {
        const item = (customKeys as any[]).find((g) => g.label === 'Basic');
        return (item?.keycodes ?? []) as KeyItem[];
    }, []);

    const mediaList = useMemo(() => {
        const item = (customKeys as any[]).find((g) => g.label === 'Media');
        return (item?.keycodes ?? []) as KeyItem[];
    }, []);

    const mouseList = useMemo(() => {
        const item = (customKeys as any[]).find((g) => g.label === 'Mouse');
        return (item?.keycodes ?? []) as KeyItem[];
    }, []);

    const shortcutList = useMemo(() => {
        const item = (customKeys as any[]).find((g) => g.label === 'Shortcut');
        return (item?.keycodes ?? []) as KeyItem[];
    }, []);

    const rawCustomList = useMemo(() => {
        const item = (customKeys as any[]).find((g) => g.label === 'Custom');
        return (item?.keycodes ?? []) as KeyItem[];
    }, []);

    const deviceLightCaps = useMemo((): DeviceLightCaps => {
        const lighting = keyboardLayout?.lighting;
        const baseInfo = keyboard?.deviceBaseInfo ?? connectedKeyboard?.deviceBaseInfo;
        const hasRuntimeCapability = !!baseInfo;

        return {
            hasBacklight: hasRuntimeCapability
                ? Boolean(baseInfo?.showLight)
                : Array.isArray(lighting?.backlight) && lighting.backlight.length > 0,
            hasLogoLight: hasRuntimeCapability
                ? Boolean(baseInfo?.showLogoLight)
                : Array.isArray(lighting?.logolight) && lighting.logolight.length > 0,
            hasSideLight: hasRuntimeCapability
                ? Boolean(baseInfo?.showLightSideLight)
                : Array.isArray(lighting?.sidelight) && lighting.sidelight.length > 0,
            hasMatrixLight: hasRuntimeCapability
                ? Boolean(baseInfo?.matrixScreen)
                : Array.isArray(lighting?.matrixlight) && lighting.matrixlight.length > 0,
        };
    }, [keyboardLayout, keyboard?.deviceBaseInfo, connectedKeyboard?.deviceBaseInfo]);

    const refPools = useMemo(
        () => ({
            Custom: rawCustomList,
            Shortcut: shortcutList,
            Media: mediaList,
            Mouse: mouseList,
        }),
        [rawCustomList, shortcutList, mediaList, mouseList],
    );

    /** 灯光：仅 CustomUiLayout 分区，不再追加 Custom 全表尾部（避免侧灯/常亮/层切换等混入）。 */
    const customDisplayList = useMemo(
        () =>
            expandKeyedPool({
                data: customKeys as unknown[],
                layoutLabel: 'CustomUiLayout',
                pools: refPools,
                tailList: [],
                itemFilter: (k) => isCustomKeyVisibleForDevice(k, deviceLightCaps),
            }),
        [refPools, deviceLightCaps],
    );

    /** 功能：仅 ShortcutUiLayout（已在布局中的组合键 + 设备功能），不追加尾部列表。 */
    const shortcutDisplayList = useMemo(
        () =>
            filterFunctionPoolItems(
                expandKeyedPool({
                    data: customKeys as unknown[],
                    layoutLabel: 'ShortcutUiLayout',
                    pools: refPools,
                    tailList: [],
                    itemFilter: (k) =>
                        k.type === 80 ? isCustomKeyVisibleForDevice(k, deviceLightCaps) : true,
                }),
            ),
        [refPools, deviceLightCaps],
    );

    const mediaDisplayList = useMemo(
        () =>
            expandKeyedPool({
                data: customKeys as unknown[],
                layoutLabel: 'MediaUiLayout',
                pools: refPools,
                tailList: mediaList,
                itemFilter: () => true,
            }),
        [mediaList, refPools],
    );

    const macroListItems = useMemo<KeyItem[]>(() => {
        if (Array.isArray(macroProfiles) && macroProfiles.length > 0) {
            return macroProfiles.map((profile: any, index: number) => ({
                name: profile.name || `M${index}`,
                code: `MACRO(${index})`,
                type: 0x60,
                code1: profile.key,
                code2: profile.type,
                code3: profile.replayCnt,
            }));
        }
        const item = (customKeys as any[]).find((g) => g.label === 'Macro');
        return (item?.keycodes ?? []) as KeyItem[];
    }, [macroProfiles]);

    const selectedPool = useMemo(() => {
        if (isQMK) {
            if (category === 'basic' || category === 'macro') return [];
            return getQMKPoolForCategory(category as QMKPanelCategory, qmkMenus).map(qmkKeycodeToPoolItem);
        }
        switch (category) {
            case 'basic':
                return basicList;
            case 'media':
                return mediaDisplayList;
            case 'shortcut':
                return shortcutDisplayList;
            case 'custom':
                return customDisplayList;
            case 'macro':
                return macroListItems;
            case 'combination':
                return [];
            default:
                return [];
        }
    }, [isQMK, category, qmkMenus, basicList, mediaDisplayList, shortcutDisplayList, customDisplayList, macroListItems]);

    const mappedLayoutKeys = useMemo(() => {
        if (keyboard?.keyboardType === 'QMK') {
            return resolveQMKDisplayLayoutKeys(
                layoutKeys,
                keyboard.allQMKLayers,
                currentLayer,
            );
        }
        return mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeys);
    }, [keyboard?.keyboardType, keyboard?.allQMKLayers, currentLayer, layoutKeys, userKeys]);

    const writeQMKKey = async (
        keyInfo: NonNullable<ReturnType<typeof getSelectedQMKKeyInfo>>,
        keycode: number,
        displayName: string,
        code?: string,
    ) => {
        if (isKeyboardSwitching) {
            showMessage({ message: t('2975'), type: 'warning', duration: 4000 });
            return false;
        }

        const qmkKeyboard = connectedKeyboard as {
            setKey?: (layer: number, row: number, col: number, val: number) => Promise<number>;
            getKey?: (layer: number, row: number, col: number) => Promise<number>;
        } | undefined;

        if (!qmkKeyboard?.setKey) {
            showMessage({ message: t('2996'), type: 'error', duration: 8000 });
            return false;
        }

        try {
            const written = await qmkKeyboard.setKey(
                currentLayer,
                keyInfo.row,
                keyInfo.col,
                keycode,
            );
            let verified = written === keycode;
            if (!verified && qmkKeyboard.getKey) {
                const readback = await qmkKeyboard.getKey(currentLayer, keyInfo.row, keyInfo.col);
                verified = readback === keycode;
            }
            if (!verified) {
                throw new Error(
                    `QMK keymap verify failed at layer=${currentLayer} row=${keyInfo.row} col=${keyInfo.col}: expected 0x${keycode.toString(16)}, got 0x${(written ?? 0).toString(16)}`,
                );
            }

            keyboard?.updateQMKKey?.(currentLayer, selectedIndex, {
                ...keyInfo,
                code: code ?? keyInfo.code,
                name: displayName,
            });
            return true;
        } catch (error) {
            console.error('[KeyMappingPanel] QMK 改键写入失败:', error);
            showMessage({
                message: t(isHidWriteNotAllowedError(error) ? '2996' : '2997'),
                type: 'error',
                duration: 8000,
            });
            return false;
        }
    };

    const applyQMKKeycode = async (code: string, displayName: string) => {
        if (selectedIndex < 0) return;
        const keyInfo = getSelectedQMKKeyInfo(
            keyboard?.allQMKLayers,
            currentLayer,
            selectedIndex,
            layoutKeys,
        );
        if (!keyInfo) return;
        const keycode = codeToNumber(code, qmkDict);
        if (keycode === 0 && code !== 'KC_NO') return;
        await writeQMKKey(keyInfo, keycode, displayName, code);
    };

    const handleAnyConfirm = async (code: string, keycode: number) => {
        if (selectedIndex < 0) return;
        const keyInfo = getSelectedQMKKeyInfo(
            keyboard?.allQMKLayers,
            currentLayer,
            selectedIndex,
            layoutKeys,
        );
        if (!keyInfo) return;
        await writeQMKKey(keyInfo, keycode, code, code);
    };

    const handleAnyButtonClick = () => {
        if (selectedIndex < 0) return;
        setAnyDialogOpen(true);
    };

    const handleVendorAnyButtonClick = () => {
        if (selectedIndex < 0) return;
        setVendorAnyDialogOpen(true);
    };

    const handleVendorAnyConfirm = async (code: string) => {
        if (selectedIndex < 0 || isQMK || !connectedKeyboard) return;

        const parsed = parseVendorAnyInput(code, qmkDict);
        if (!parsed) return;

        const macroSlot = resolveVendorAnyMacroSlot(selectedIndex);
        const anyMap = readVendorAnyMacroMap(keyboard?.version);
        anyMap[macroSlot] = {
            webCode: parsed.webCode,
            displayName: parsed.displayName,
            code: parsed.code,
            macroActions: parsed.macroActions,
        };
        writeVendorAnyMacroMap(keyboard?.version, anyMap);

        const userMacros = (macroProfiles ?? []) as MacroProfile[];
        const merged = mergeMacroProfilesForDevice(userMacros, hiddenAnyMacrosFromMap(anyMap));

        try {
            await connectedKeyboard.setAllMacroDataV2?.(merged);
            await connectedKeyboard.setKeyMatrixData?.(currentLayer, selectedIndex, 0x60, macroSlot, 0);
            keyboard?.updateUserKey?.(
                {
                    name: parsed.displayName,
                    code: parsed.code,
                    type: VENDOR_KEY_TYPE_ANY,
                    code1: macroSlot,
                    code2: 0,
                    code3: 1,
                },
                selectedIndex,
                0,
                currentLayer,
            );
            keyboard?.saveUserKeys?.();
        } catch (e) {
            console.error('[KeyMappingPanel] ANY 键下发失败:', e);
        }
    };

    const applyQMKFullKey = async (key: { code1?: number; code2?: number; name?: string }) => {
        if (selectedIndex < 0) return;
        const keyInfo = getSelectedQMKKeyInfo(
            keyboard?.allQMKLayers,
            currentLayer,
            selectedIndex,
            layoutKeys,
        );
        if (!keyInfo) return;
        let keycode = (key.code2 ?? 0) as number;
        if (key.code1 && key.code1 !== 0) {
            keycode = hidModMaskToQmkKeycode(key.code1 & 0xff, keycode);
        }
        await writeQMKKey(keyInfo, keycode, key.name ?? keyInfo.name);
    };

    const applyKey = async (key: KeyItem) => {
        if (selectedIndex < 0) return;

        if (isQMK) {
            await applyQMKKeycode(key.code, key.name);
            return;
        }

        keyboard?.updateUserKey?.(key, selectedIndex, 0, currentLayer);

        if (isVendorAnyKeyType(key.type)) {
            await connectedKeyboard?.setKeyMatrixData?.(
                currentLayer,
                selectedIndex,
                toDeviceKeyType(key.type),
                key.code1,
                key.code2,
            );
            keyboard?.saveUserKeys?.();
            return;
        }

        if (key.type === 0x60) {
            const macroIndex = macroProfiles.findIndex((macro: any) => macro.key === key.code1);
            if (macroIndex !== -1) {
                if (key.code2 === 0x00 && (key.code3 ?? 0) > 1) {
                    await connectedKeyboard?.setKeyMatrixData?.(currentLayer, selectedIndex, 0x61, macroIndex, key.code3 ?? 0);
                } else {
                    await connectedKeyboard?.setKeyMatrixData?.(currentLayer, selectedIndex, 0x60, macroIndex, key.code2);
                }
                keyboard?.saveUserKeys?.();
            }
            return;
        }

        await connectedKeyboard?.setKeyMatrixData?.(
            currentLayer,
            selectedIndex,
            toDeviceKeyType(key.type),
            key.code1,
            key.code2,
        );
        keyboard?.saveUserKeys?.();
    };

    const applyCombination = async ({
        modifierMask,
        mainKeyCode,
        mainKey,
        combinationText,
    }: {
        modifierMask: number;
        mainKeyCode: number;
        mainKey: string;
        combinationText: string;
    }) => {
        if (selectedIndex < 0 || mainKeyCode === 0) return;

        if (isQMK) {
            const keyInfo = getSelectedQMKKeyInfo(
                keyboard?.allQMKLayers,
                currentLayer,
                selectedIndex,
                layoutKeys,
            );
            if (!keyInfo) return;
            const name = combinationText || `${modifierMask ? t('1671') : ''}${mainKey}`;
            const keycode = hidModMaskToQmkKeycode(modifierMask, mainKeyCode);
            await writeQMKKey(keyInfo, keycode, name);
            return;
        }

        const name = combinationText || `${modifierMask ? t('1671') : ''}${mainKey}`;
        const key = {
            type: 0x12,
            code1: modifierMask,
            code2: mainKeyCode,
            code3: 0,
            code: `COMBO_${modifierMask}_${mainKeyCode}`,
            name,
        };

        keyboard?.updateUserKey?.(key, selectedIndex, 0, currentLayer);
        await connectedKeyboard?.setKeyMatrixData?.(currentLayer, selectedIndex, 0x12, modifierMask, mainKeyCode);
        keyboard?.saveUserKeys?.();
    };

    const handleRestoreKey = async () => {
        if (isQMK) {
            const device = connectedKeyboard as {
                clearAllKeymaps?: () => Promise<void>;
                readRawMatrix?: (matrix: { rows: number; cols: number }, layer: number) => Promise<number[]>;
            } | null | undefined;
            if (!device?.clearAllKeymaps || !device.readRawMatrix || !keyboardLayout?.matrix || !keyboardLayout?.layouts?.keymap) {
                return;
            }
            try {
                await device.clearAllKeymaps();
                await new Promise((r) => setTimeout(r, 300));
                const numberOfLayers = qmkLayerCount;
                const newAllLayers = await reReadAllQMKLayers(
                    device as { readRawMatrix: (matrix: { rows: number; cols: number }, layer: number) => Promise<number[]> },
                    keyboardLayout,
                    numberOfLayers,
                );
                keyboard?.setAllQMKLayers?.(newAllLayers);
                if (newAllLayers[0]?.length) {
                    const baseLayout = keyboard?.layoutKeys ?? [];
                    keyboard?.initLayoutKeys?.(
                        baseLayout.length
                            ? mergePhysicalLayoutWithQmkLayer(baseLayout, newAllLayers[0])
                            : qmkLayerToLayoutKeys(newAllLayers[0]),
                    );
                }
                keyboard?.setSelectIndex?.(-1);
            } catch {
                // ignore
            }
            return;
        }

        /** 整层恢复：不依赖选中键（刷新后 selectIndex 常为 -1）。读固件默认矩阵后 setRestoreDefaultKeys。 */
        const device = connectedKeyboard as {
            test?: boolean;
            startComm?: () => Promise<unknown>;
            getDefaultKeyMatrixData?: (layer: number) => Promise<any[]>;
            setRestoreDefaultKeys?: (layer: number, defaultKeys: any[]) => Promise<unknown>;
        } | null | undefined;

        if (
            !device ||
            device.test === true ||
            typeof device.getDefaultKeyMatrixData !== 'function' ||
            typeof device.setRestoreDefaultKeys !== 'function'
        ) {
            return;
        }

        try {
            if (typeof device.startComm === 'function') {
                await device.startComm();
            }
            const freshDefaults = await device.getDefaultKeyMatrixData(currentLayer);
            if (!Array.isArray(freshDefaults) || freshDefaults.length === 0) return;

            await device.setRestoreDefaultKeys(currentLayer, freshDefaults);
            keyboard?.updateUserKeys?.(freshDefaults, 0, currentLayer);
            keyboard?.saveUserKeys?.();
        } catch {
            // 读默认矩阵或整层下发失败则忽略
        }
    };

    return (
        <Box
            sx={{
                flex: 1,
                width: '100%',
                minWidth: 0,
                minHeight: 0,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: `${MAP.sectionGapVertical}px`,
                justifyContent: 'space-between'
            }}
        >
            <Box
                sx={{
                    height: "50%",
                    width: "100%",
                    minHeight: `${MAP.topAreaMinHeight}px`,
                    margin: "0 auto",
                    display: "flex",
                    p: `${MAP.sectionShellPadding}px`,
                    borderRadius: isDark ? '8px' : `${MAP.sectionShellRadius}px`,
                    backgroundColor: MAP.sectionShellBg,
                    boxShadow: MAP.sectionShellShadow,
                    gap: 69,
                    alignItems: 'stretch',
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <TravelVirtualKeyboard
                        layoutKeys={mappedLayoutKeys}
                        patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
                        travelKeys={[]}
                        selectedKeys={selectedIndex >= 0 ? [selectedIndex] : []}
                        travelValue={0}
                        showActuation={false}
                        showLayerOverlay={selectedSetting === 'keypress'}
                        layerCount={isQMK ? qmkLayerCount : 4}
                        currentLayer={currentLayer}
                        onSelectLayer={(i: number) => keyboard?.setLayer?.(i)}
                        onRestoreDefault={() => void handleRestoreKey()}
                        onToggleKey={(keyIndex: number) => {
                            keyboard?.setSelectIndex?.(keyIndex);
                        }}
                        onScaleRatioChange={onKeyboardScaleChange}
                    />
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    p: `${MAP.sectionShellPadding}px`,
                    borderRadius: isDark ? '8px' : `${MAP.sectionShellRadius}px`,
                    backgroundColor: MAP.sectionShellBg,
                    boxShadow: MAP.sectionShellShadow,
                    alignItems: "center",
                    maxWidth: 1800,
                    minWidth: 1200,
                    maxHeight: 500,
                    height: '100%',
                    width: '100%',
                    margin: '0 auto',
                    minHeight: 0,
                }}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flex: 1,
                        minHeight: "300px",
                        width: "100%",
                    }}
                >
                    <Box sx={{ display: 'flex', gap: '20px', width: '100%', height: '100%' }}>
                        <Box
                            sx={{
                                flex: MAP.sideColumnFlex,
                                minWidth: `${MAP.sideColumnMinWidth}px`,
                                maxWidth: `${MAP.sideColumnMaxWidth}px`,
                                '@media (max-width: 1700px)': {
                                    width: '220px',
                                    minWidth: '220px',
                                    maxWidth: '220px',
                                    flex: '0 0 220px',
                                },
                                border: isDark ? `1px solid ${theme.palette.primary.main}` : MAP.cardBorder,
                                background: isDark ? theme.palette.background.paper : 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                                p: `${MAP.categoryPadding}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: `${MAP.categoryGap}px`,
                                borderRadius: `${MAP.categoryRadius}px`,
                                boxShadow: isDark ? 'none' : MAP.cardShadow,
                                overflow: 'auto',
                                '&::-webkit-scrollbar': { width: '8px' },
                                '&::-webkit-scrollbar-thumb': {
                                    background: isDark
                                        ? alpha(theme.palette.common.white, 0.15)
                                        : 'rgba(122,142,170,.42)',
                                    borderRadius: '8px',
                                },
                                '&::-webkit-scrollbar-track': {
                                    background: isDark ? alpha(theme.palette.common.white, 0.05) : 'rgba(209,222,242,.35)',
                                    borderRadius: '8px',
                                },
                            }}
                        >
                            <Typography
                                sx={{
                                    fontSize: `${MAP.categoryTitleSize}px`,
                                    color: isDark ? theme.palette.text.primary : MAP.textTitle,
                                    fontWeight: 700,
                                    mb: '4px',
                                }}
                            >
                                {t('1670')}
                            </Typography>
                            {visibleCategories.map((c) => {
                                const active = c.id === category;
                                return (
                                    <Button
                                        key={c.id}
                                        fullWidth
                                        onClick={() => setCategory(c.id)}
                                        sx={{
                                            height: `${MAP.categoryItemHeight}px`,
                                            borderRadius: `${MAP.categoryItemRadius}px`,
                                            textTransform: 'none',
                                            justifyContent: 'center',
                                            fontSize: '14px',
                                            fontWeight: active ? 600 : 500,
                                            color: active
                                                ? theme.palette.primary.contrastText
                                                : isDark
                                                  ? theme.palette.text.secondary
                                                  : '#66778f',
                                            background: active ? theme.palette.primary.main : 'transparent',
                                            transition:
                                                'background-color 0.2s ease-out, color 0.2s ease-out, transform 0.2s ease-out',
                                            '&:hover': {
                                                background: active
                                                    ? theme.palette.primary.dark
                                                    : isDark
                                                      ? alpha(theme.palette.primary.main, 0.12)
                                                      : 'rgba(59,130,246,.10)',
                                                color: active
                                                    ? theme.palette.primary.contrastText
                                                    : isDark
                                                      ? theme.palette.text.primary
                                                      : MAP.primary,
                                                transform: active ? 'scale(1)' : 'scale(1.05)',
                                            },
                                            '&:active': {
                                                backgroundColor: active
                                                    ? theme.palette.primary.dark
                                                    : isDark
                                                      ? alpha(theme.palette.primary.main, 0.18)
                                                      : 'rgba(59, 130, 246, 0.08)',
                                                transform: active ? 'scale(1)' : 'scale(.95)',
                                                transition: 'transform 0.12s cubic-bezier(0.2, 0, 0, 1)',
                                            },
                                        }}
                                    >
                                        {t(c.labelKey)}
                                    </Button>
                                );
                            })}
                        </Box>

                        <Box
                            sx={{
                                width: "100%",
                                border: isDark ? `1px solid ${theme.palette.primary.main}` : MAP.cardBorder,
                                background: isDark ? theme.palette.background.paper : 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                                p: `${MAP.contentPadding}px`,
                                overflow: 'auto',
                                borderRadius: `${MAP.contentRadius}px`,
                                boxShadow: isDark ? 'none' : MAP.cardShadow,
                                '&::-webkit-scrollbar': { width: '8px' },
                                '&::-webkit-scrollbar-thumb': {
                                    background: isDark
                                        ? alpha(theme.palette.common.white, 0.12)
                                        : 'rgba(122,142,170,.35)',
                                    borderRadius: '8px',
                                },
                            }}
                        >
                            {category === 'basic' ? (
                                <FullKeyboard
                                    disabled={selectedIndex < 0}
                                    onSelectKey={isQMK ? (applyQMKFullKey as any) : (applyKey as any)}
                                />
                            ) : category === 'combination' ? (
                                <CombinationKeyBoard disabled={selectedIndex < 0} onSave={applyCombination} />
                            ) : category === 'macro' ? (
                                <Box sx={{ width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}>
                                    <MacroRecorder />
                                </Box>
                            ) : (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: `repeat(${MAP.keyPoolIconColumns}, minmax(0, 1fr))`,
                                        gap: `${MAP.keyPoolIconGridGap}px`,
                                        alignContent: 'start',
                                    }}
                                >
                                    {(selectedPool as KeyPoolItem[]).map((item, idx) =>
                                        isSectionPoolItem(item) ? (
                                            <Typography
                                                key={`${item.code}-${idx}`}
                                                sx={{
                                                    gridColumn: '1 / -1',
                                                    fontSize: '14px',
                                                    fontWeight: 700,
                                                    color: isDark ? theme.palette.text.secondary : MAP.textTitle,
                                                    py: '6px',
                                                    pl: '4px',
                                                    mt: idx > 0 ? '8px' : 0,
                                                }}
                                            >
                                                {t(resolveLogoLightingLangKey(item.sectionTitleKey, isPickupDevice) ?? item.sectionTitleKey)}
                                            </Typography>
                                        ) : (
                                            <KeyButton
                                                key={`${(item as KeyItem).code}-${idx}`}
                                                keyItem={item as KeyItem}
                                                isPickupDevice={isPickupDevice}
                                                onSelectKey={(k) => void applyKey(k)}
                                            />
                                        ),
                                    )}
                                    {!isQMK && category === 'shortcut' && (
                                        <Box sx={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                                            <ButtonRem
                                                variant="text"
                                                title="Any keycode"
                                                disabled={selectedIndex < 0}
                                                onClick={handleVendorAnyButtonClick}
                                                sx={{
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    height: '56px',
                                                    borderRadius: '10px',
                                                    textTransform: 'none',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    ...(isDark
                                                        ? {
                                                              border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                                                              color: selectedIndex < 0
                                                                  ? theme.palette.text.disabled
                                                                  : theme.palette.text.primary,
                                                              backgroundColor: theme.palette.customed1.main,
                                                          }
                                                        : {
                                                              border: '1px solid #cfe0ff',
                                                              color: selectedIndex < 0 ? '#94a3b8' : '#2d4a75',
                                                              backgroundColor: '#ffffff',
                                                          }),
                                                    '&:hover': selectedIndex < 0
                                                        ? {}
                                                        : isDark
                                                          ? {
                                                                borderColor: alpha(theme.palette.primary.main, 0.55),
                                                                backgroundColor: alpha(theme.palette.primary.main, 0.18),
                                                            }
                                                          : {
                                                                borderColor: '#9fc2ff',
                                                                backgroundColor: '#f7fbff',
                                                            },
                                                }}
                                            >
                                                Any
                                            </ButtonRem>
                                        </Box>
                                    )}
                                    {isQMK && category === 'special' && (
                                        <Box sx={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                                            <ButtonRem
                                                variant="text"
                                                title="Any keycode"
                                                disabled={selectedIndex < 0}
                                                onClick={handleAnyButtonClick}
                                                sx={{
                                                    width: '100%',
                                                    minWidth: 0,
                                                    maxWidth: '100%',
                                                    height: '56px',
                                                    borderRadius: '10px',
                                                    textTransform: 'none',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    ...(isDark
                                                        ? {
                                                              border: `1px solid ${alpha(theme.palette.common.white, 0.12)}`,
                                                              color: selectedIndex < 0
                                                                  ? theme.palette.text.disabled
                                                                  : theme.palette.text.primary,
                                                              backgroundColor: theme.palette.customed1.main,
                                                          }
                                                        : {
                                                              border: '1px solid #cfe0ff',
                                                              color: selectedIndex < 0 ? '#94a3b8' : '#2d4a75',
                                                              backgroundColor: '#ffffff',
                                                          }),
                                                    '&:hover': selectedIndex < 0
                                                        ? {}
                                                        : isDark
                                                          ? {
                                                                borderColor: alpha(theme.palette.primary.main, 0.55),
                                                                backgroundColor: alpha(theme.palette.primary.main, 0.18),
                                                            }
                                                          : {
                                                                borderColor: '#9fc2ff',
                                                                backgroundColor: '#f7fbff',
                                                            },
                                                }}
                                            >
                                                Any
                                            </ButtonRem>
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
            {isQMK ? (
                <QMKAnyKeycodeDialog
                    open={anyDialogOpen}
                    onClose={() => setAnyDialogOpen(false)}
                    onConfirm={(code, keycode) => void handleAnyConfirm(code, keycode)}
                    fullDict={qmkDict}
                    customKeycodes={keyboardLayout?.customKeycodes}
                />
            ) : (
                <QMKAnyKeycodeDialog
                    open={vendorAnyDialogOpen}
                    onClose={() => setVendorAnyDialogOpen(false)}
                    onConfirm={() => {}}
                    onConfirmRaw={(raw) => void handleVendorAnyConfirm(raw)}
                    isInputValid={(input) => isValidVendorAnyInput(input, qmkDict)}
                    fullDict={qmkDict}
                    placeholder="KC_A, A(KC_A,KC_B,KC_C), 0x04..."
                />
            )}
        </Box >
    );
}
