'use client';

import { Box, Button, Typography } from '@mui/material';
import { useContext, useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { alpha, useTheme } from '@mui/material/styles';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import FullKeyboard from '@/components/FullKeyboard';
import CombinationKeyBoard from '@/components/CombinationKeyBoard';
import MacroRecorder from '@/components/KeyBoardPanel/MacroRecorder';
import customKeys from '@/data/customkeys.json';
import type { LayoutKey } from '@/types/types_v1';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';
import { KEY_TYPE_ICON_BOX_PX } from '@/constants/keyTypeIconDisplay';
import { expandKeyedPool, type KeyPoolItem } from '@/utils/customkeysUiLayout';
import { EditorContext } from '@/providers/EditorProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';

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

/** 灯光键位池：轴灯分区外的「尾部」里不再展示这些键（与产品稿红框一致）。 */
function isHiddenFromCustomLightingKeyedPool(item: KeyItem): boolean {
    const c = String(item.code || '');
    if (c.startsWith('FN_')) return true;
    if (c.startsWith('TO_')) return true;
    if (c.startsWith('CUSTOM_LIGHT_') && c !== 'CUSTOM_LIGHT_1') return true;
    if (c === 'COLOR_BOARD') return true;
    if (c.startsWith('SIDE_LIGHT_')) return true;
    if (c === 'RESET') return true;
    if (c.startsWith('BLE_MODE_')) return true;
    if (c === 'MODE_24G' || c === 'USB_MODE' || c === 'BATTERY_STATUS') return true;
    if (
        c === 'NK_TOGGLE' ||
        c === 'MACWIN_TOGGLE' ||
        c === 'WIN_LOCK_TOGGLE' ||
        c === 'WASD_TOGGLE' ||
        c === 'KEY_DELAY_TOGGLE' ||
        c === 'FROW_MODE_TOGGLE' ||
        c === 'WHEEL_FUNCTION_TOGGLE' ||
        c === 'ALL_POWER_TOGGLE'
    ) {
        return true;
    }
    if (c.startsWith('LCD_')) return true;
    if (c === 'WHEEL_LEFT' || c === 'WHEEL_RIGHT' || c === 'WHEEL_CONFIRM') return true;
    if (c === 'TEST_MODE') return true;
    return false;
}

function isSectionPoolItem(
    item: KeyPoolItem,
): item is { isSectionHeader: true; sectionTitleKey: string; code: string } {
    return 'isSectionHeader' in item && item.isSectionHeader === true;
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
};

const KeyButton = ({
    keyItem,
    onSelectKey,
}: {
    keyItem: KeyItem;
    onSelectKey?: (key: KeyItem) => void;
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

    const customFallbackLangId =
        keyItem.type === 80 && !keyItem.langid && keyItem.code1 > 0 ? String(90000 + keyItem.code1) : undefined;
    const translatedByLangid = keyItem.langid ? t(keyItem.langid) : '';
    const translatedByFallback = customFallbackLangId ? t(customFallbackLangId) : '';
    const displayLabel =
        (translatedByLangid && translatedByLangid !== keyItem.langid ? translatedByLangid : '') ||
        (translatedByFallback && translatedByFallback !== customFallbackLangId ? translatedByFallback : '') ||
        keyItem.name;
    const tooltipFromId = keyItem.tooltipLangid ? t(keyItem.tooltipLangid) : '';
    const tooltipTitle =
        keyItem.tooltipLangid && tooltipFromId && tooltipFromId !== keyItem.tooltipLangid
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
                                <Box
                                    component="img"
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
                    ) : isCompactFnLayerText ? (
                        <Box
                            component="span"
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                fontSize: '14px',
                                fontWeight: 600,
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
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

type CategoryId = 'basic' | 'media' | 'shortcut' | 'custom' | 'macro' | 'combination';

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

const LAYER_COUNT = 4;

type KeyMappingPanelProps = {
    onKeyboardScaleChange?: (ratio: number) => void;
};

export default function KeyMappingPanel({ onKeyboardScaleChange }: KeyMappingPanelProps = {}) {
    const { connectedKeyboard, keyboard, macroList, keyboardLayout } = useContext(ConnectKbContext);
    const { macroProfiles } = macroList;
    const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
    const currentLayer = keyboard?.layer ?? 0;
    const selectedIndex = keyboard?.selectIndex ?? -1;
    const userKeys = keyboard?.userKeys?.[currentLayer] ?? [];
    const { selectedSetting } = useContext(EditorContext);
    const { t } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [category, setCategory] = useState<CategoryId>('basic');

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

    const filteredCustomList = useMemo(
        () => rawCustomList.filter((item) => isCustomKeyVisibleForDevice(item, deviceLightCaps)),
        [rawCustomList, deviceLightCaps],
    );

    const refPools = useMemo(
        () => ({
            Custom: rawCustomList,
            Shortcut: shortcutList,
            Media: mediaList,
            Mouse: mouseList,
        }),
        [rawCustomList, shortcutList, mediaList, mouseList],
    );

    const customDisplayList = useMemo(
        () =>
            expandKeyedPool({
                data: customKeys as unknown[],
                layoutLabel: 'CustomUiLayout',
                pools: refPools,
                tailList: filteredCustomList,
                itemFilter: (k) =>
                    isCustomKeyVisibleForDevice(k, deviceLightCaps) &&
                    !isHiddenFromCustomLightingKeyedPool(k),
            }),
        [filteredCustomList, refPools, deviceLightCaps],
    );

    const shortcutDisplayList = useMemo(
        () =>
            expandKeyedPool({
                data: customKeys as unknown[],
                layoutLabel: 'ShortcutUiLayout',
                pools: refPools,
                tailList: shortcutList,
                itemFilter: (k) => isCustomKeyVisibleForDevice(k, deviceLightCaps),
            }),
        [shortcutList, refPools, deviceLightCaps],
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
    }, [category, basicList, mediaDisplayList, shortcutDisplayList, customDisplayList, macroListItems]);

    const mappedLayoutKeys = useMemo(
        () => mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeys),
        [layoutKeys, userKeys],
    );

    const applyKey = async (key: KeyItem) => {
        if (selectedIndex < 0) return;

        keyboard?.updateUserKey?.(key, selectedIndex, 0, currentLayer);

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

        await connectedKeyboard?.setKeyMatrixData?.(currentLayer, selectedIndex, key.type, key.code1, key.code2);
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
                        layerCount={LAYER_COUNT}
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
                            {CATEGORIES.map((c) => {
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
                                <FullKeyboard disabled={selectedIndex < 0} onSelectKey={applyKey as any} />
                            ) : category === 'combination' ? (
                                <CombinationKeyBoard disabled={selectedIndex < 0} onSave={applyCombination} />
                            ) : category === 'macro' ? (
                                <Box sx={{ width: '100%', height: '100%' }}>
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
                                                {t(item.sectionTitleKey)}
                                            </Typography>
                                        ) : (
                                            <KeyButton
                                                key={`${(item as KeyItem).code}-${idx}`}
                                                keyItem={item as KeyItem}
                                                onSelectKey={(k) => void applyKey(k)}
                                            />
                                        ),
                                    )}
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box >
    );
}
