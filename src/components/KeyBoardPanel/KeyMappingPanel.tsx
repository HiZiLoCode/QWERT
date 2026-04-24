'use client';

import { Box, Button, Tooltip, Typography } from '@mui/material';
import { useContext, useEffect, useMemo, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import FullKeyboard from '@/components/FullKeyboard';
import CombinationKeyBoard from '@/components/CombinationKeyBoard';
import MacroRecorder from '@/components/KeyBoardPanel/MacroRecorder';
import customKeys from '@/data/customkeys.json';
import type { LayoutKey } from '@/types/types_v1';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';
import { EditorContext } from '@/providers/EditorProvider';
import { ButtonRem } from '@/styled/ReconstructionRem';

/**
 * 与配置页截图：侧栏约为主键盘区宽度的 15%–20%；大块留白与浅灰底卡片。
 */
const MAP = {
    /** LAYER 列与白卡左缘的间距；白卡内还有内边距，见 TravelVirtualKeyboard */
    columnGapMain: 69,
    sectionGapVertical: 24,
    /** 侧栏占该行宽约 18%，并限制在常见屏宽下的像素范围 */
    sideColumnFlex: '0 0 18%',
    sideColumnMinWidth: 100,
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
    categoryItemRadius: 8,
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
} as const;

type KeyItem = {
    name: string;
    code: string;
    type: number;
    code1: number;
    code2: number;
    code3?: number;
    langid?: string;
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
    const iconValue = keyItem.icon ?? '';
    const isImageIcon =
        typeof iconValue === 'string' &&
        (iconValue.startsWith('/KeyType/') || iconValue.endsWith('.svg') || iconValue.endsWith('.png'));

    return (
        <Box sx={{ display: 'inline-block', m: '4px' }}>
            <Tooltip title={displayLabel} arrow placement="top">
            <ButtonRem
                variant="text"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
                draggable
                onDragStart={dragStart}
                sx={{
                    width: '80px',
                    minWidth: '44px',
                    height: '56px',
                    borderRadius: '0.625rem',
                    textTransform: 'none',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    border: '0.0625rem solid #cfe0ff',
                    color: hover ? '#2f6fe8' : '#2d4a75',
                    backgroundColor: hover ? '#f2f7ff' : '#ffffff',
                    boxShadow: hover ? '0 0 0 0.0625rem #9fc2ff inset' : '0 0.125rem 0.375rem rgba(63, 115, 197, 0.06)',
                    wordBreak: 'keep-all',
                    overflowWrap: 'break-word',
                    whiteSpace: 'nowrap',
                    padding: '6px 12px',
                    '&:hover': {
                        borderColor: '#9fc2ff',
                        backgroundColor: '#f7fbff',
                    },
                }}
                onClick={changeKey}
            >
                {keyItem.icon ? (
                    isImageIcon ? (
                        <Box
                            component="img"
                            src={iconValue}
                            alt={displayLabel}
                            sx={{ width: 28, height: 28, objectFit: 'contain' }}
                        />
                    ) : (
                        <span style={{ transform: 'scale(0.6)', display: 'inline-flex' }}>{keyItem.icon}</span>
                    )
                ) : (
                    <span style={{ transform: 'scale(0.6)', width: '128px', whiteSpace: 'pre-wrap', display: 'flex' }}>
                        {displayLabel}
                    </span>
                )}
            </ButtonRem>
            </Tooltip>
        </Box>
    );
};

type CategoryId = 'basic' | 'media' | 'mouse' | 'shortcut' | 'custom' | 'macro' | 'combination';

type Category = {
    id: CategoryId;
    labelKey: string;
};

const CATEGORIES: Category[] = [
    { id: 'basic', labelKey: '1500' },
    { id: 'media', labelKey: '1501' },
    { id: 'mouse', labelKey: '102' },
    { id: 'shortcut', labelKey: '103' },
    { id: 'custom', labelKey: '104' },
    { id: 'macro', labelKey: '105' },
    { id: 'combination', labelKey: '106' },
];

const LAYER_COUNT = 4;

export default function KeyMappingPanel() {
    const { connectedKeyboard, keyboard, macroList, keyboardLayout } = useContext(ConnectKbContext);
    const { macroProfiles } = macroList;
    const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
    const currentLayer = keyboard?.layer ?? 0;
    const selectedIndex = keyboard?.selectIndex ?? -1;
    const userKeys = keyboard?.userKeys?.[currentLayer] ?? [];
    const { selectedSetting } = useContext(EditorContext);
    const { t } = useTranslation('common');
    const [category, setCategory] = useState<CategoryId>('basic');
    const [originalKeys, setOriginalKeys] = useState<Map<number, any>>(new Map());

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
                return mediaList;
            case 'mouse':
                return mouseList;
            case 'shortcut':
                return shortcutList;
            case 'custom':
                return rawCustomList;
            case 'macro':
                return macroListItems;
            case 'combination':
                return [];
            default:
                return [];
        }
    }, [category, basicList, mediaList, mouseList, shortcutList, rawCustomList, macroListItems]);

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

    useEffect(() => {
        const initial = new Map<number, any>();
        layoutKeys.forEach((key, idx) => {
            const keyIndex = key.index ?? idx;
            initial.set(keyIndex, userKeys?.[keyIndex]);
        });
        setOriginalKeys(initial);
    }, [layoutKeys, userKeys]);

    const handleRestoreKey = async () => {
        if (selectedIndex < 0) return;

        const defaultLayerKeys = (keyboard as any)?.defaultKeys?.[currentLayer];
        if (defaultLayerKeys) {
            await (connectedKeyboard as any)?.setRestoreDefaultKeys?.(currentLayer, defaultLayerKeys);
            keyboard?.updateUserKeys?.(defaultLayerKeys, 0, currentLayer);
            keyboard?.saveUserKeys?.();
            return;
        }

        const originalKey = originalKeys.get(selectedIndex);
        if (!originalKey) return;

        keyboard?.updateUserKey?.(originalKey, selectedIndex, 0, currentLayer);
        await connectedKeyboard?.setKeyMatrixData?.(
            currentLayer,
            selectedIndex,
            originalKey.type,
            originalKey.code1,
            originalKey.code2
        );
        keyboard?.saveUserKeys?.();
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

            }}
        >
            <Box
                sx={{
                    height: "50%",
                    minHeight: `${MAP.topAreaMinHeight}px`,
                    margin: "0 auto",
                    display: "flex",
                    p: `${MAP.sectionShellPadding}px`,
                    borderRadius: `${MAP.sectionShellRadius}px`,
                    backgroundColor: MAP.sectionShellBg,
                    border: MAP.sectionShellBorder,
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
                />
                </Box>
            </Box>

            <Box
                sx={{
                    flex: 1,
                    mx: 167,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    p: `${MAP.sectionShellPadding}px`,
                    borderRadius: `${MAP.sectionShellRadius}px`,
                    backgroundColor: MAP.sectionShellBg,
                    border: MAP.sectionShellBorder,
                    boxShadow: MAP.sectionShellShadow,
                }}
            >
                <Box
                    sx={{
                        flex: 1,
                        display: 'flex',
                        gap: `25px`,
                        minHeight: 0,
                        alignItems: 'stretch',
                    }}
                >
                    <Box
                        sx={{
                            flex: MAP.sideColumnFlex,
                            minWidth: `${MAP.sideColumnMinWidth}px`,
                            maxWidth: `${MAP.sideColumnMaxWidth}px`,
                            border: MAP.cardBorder,
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                            p: `${MAP.categoryPadding}px`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: `${MAP.categoryGap}px`,
                            borderRadius: `${MAP.categoryRadius}px`,
                            boxShadow: MAP.cardShadow,
                            overflow: 'auto',
                            '&::-webkit-scrollbar': { width: '8px' },
                            '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(122,142,170,.42)',
                                borderRadius: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                                background: 'rgba(209,222,242,.35)',
                                borderRadius: '8px',
                            },
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: `${MAP.categoryTitleSize}px`,
                                color: MAP.textTitle,
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
                                        color: active ? '#fff' : '#66778f',
                                        background: active ? MAP.primary : 'transparent',
                                        '&:hover': {
                                            background: active ? MAP.primaryHover : 'rgba(59,130,246,.10)',
                                            color: active ? '#fff' : MAP.primary,
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
                            flex: 1,
                            minWidth: 0,
                            width: "70%",
                            border: MAP.cardBorder,
                            background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)',
                            p: `${MAP.contentPadding}px`,
                            overflow: 'auto',
                            borderRadius: `${MAP.contentRadius}px`,
                            boxShadow: MAP.cardShadow,
                            '&::-webkit-scrollbar': { width: '8px' },
                            '&::-webkit-scrollbar-thumb': {
                                background: 'rgba(122,142,170,.35)',
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
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '4px' }}>
                                {selectedPool.map((key, idx) => (
                                    <KeyButton
                                        key={`${key.code}-${idx}`}
                                        keyItem={key}
                                        onSelectKey={(item) => void applyKey(item)}
                                    />
                                ))}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
