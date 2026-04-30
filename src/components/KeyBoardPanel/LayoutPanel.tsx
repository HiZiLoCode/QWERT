'use client';

import { Box, Divider, Typography } from '@mui/material';
import { useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import ToggleSlider from '@/components/common/ToggleSlider';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { useLayoutConfig, type LayoutOptionKey } from '@/providers/LayoutProvider';
import type { LayoutKey } from '@/types/types_v1';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';

const layoutCards: {
    titleKey: string;
    options: { labelKey: string; key: LayoutOptionKey }[];
}[] = [
        {
            titleKey: '1693',
            options: [
                { labelKey: '1694', key: 'backspaceAnsi' },
                { labelKey: '1695', key: 'backspaceIso' },
            ],

        },
        {
            titleKey: '1696',
            options: [
                { labelKey: '1697', key: 'enterSplit' },
                { labelKey: '1698', key: 'enterNormal' },
            ],
        },
        {
            titleKey: '1699',
            options: [
                { labelKey: '1694', key: 'rshiftSplit' },
                { labelKey: '1695', key: 'rshiftNormal' },
            ],
        },
        {
            titleKey: '1700',
            options: [
                { labelKey: '1701', key: 'space625' },
                { labelKey: '1702', key: 'space7' },
            ],
        },
    ];

const cardSx = {
    borderRadius: '0.875rem',
    border: '0.0625rem solid rgba(217,226,240,0.95)',
    background: 'rgba(255,255,255,0.36)',
    boxShadow: '0 0 1.5rem rgba(176, 206, 255, 0.20)',
    backdropFilter: 'blur(0.5rem)',
};

function applyLayoutPreview(
    keys: LayoutKey[],
    layoutState: ReturnType<typeof useLayoutConfig>['layoutState'],
    optionKeys?: any
) {
    const nextKeys = keys.map((key) => ({ ...key }));

    const keyId = (key: LayoutKey, idx: number) => key.index ?? idx;
    const originals = new Map<number, LayoutKey>();
    nextKeys.forEach((key, idx) => {
        originals.set(keyId(key, idx), { ...key });
    });

    const normalize = (value: string | undefined) => (value ?? '').trim().toLowerCase();
    const isNamedAs = (key: LayoutKey, names: string[]) => names.some((name) => normalize(key.name) === name.toLowerCase());
    const restore = (key: LayoutKey, idx: number) => {
        const raw = originals.get(keyId(key, idx));
        if (!raw) return;
        Object.assign(key, raw);
        delete (key as LayoutKey & { w2?: number }).w2;
        delete (key as LayoutKey & { h2?: number }).h2;
        delete (key as LayoutKey & { x2?: number }).x2;
        delete (key as LayoutKey & { y2?: number }).y2;
    };
    const addVirtualSplitKey = (
        base: LayoutKey,
        x: number,
        w: number,
        name: string,
        extra?: Partial<LayoutKey>
    ) => {
        const virtualKey: LayoutKey = {
            ...base,
            x,
            w,
            h: 1,
            name,
            index: 9000 + nextKeys.length,
            ...extra,
        };
        nextKeys.push(virtualKey);
    };
    const findByIndex = (index: number) => nextKeys.find((key) => key.index === index);
    const backspaceCfg = optionKeys?.backspaceIso;
    const backspaceIndex =
        typeof backspaceCfg?.baseIndex === 'number'
            ? nextKeys.findIndex((key) => key.index === backspaceCfg.baseIndex)
            : nextKeys.findIndex((key) => isNamedAs(key, ['backspace', 'back', 'backsp']));
    if (backspaceIndex >= 0) {
        const backspaceKey = nextKeys[backspaceIndex];
        restore(backspaceKey, backspaceIndex);
        if (layoutState.backspaceIso) {
            const originalWidth = backspaceKey.w;
            const splitWidth = backspaceCfg?.splitWidth ?? 1;
            backspaceKey.w = splitWidth;
            if (backspaceCfg?.extraKey) {
                const extra = backspaceCfg.extraKey;
                addVirtualSplitKey(backspaceKey, extra.x, extra.w, extra.name || '', extra);
            } else {
                addVirtualSplitKey(backspaceKey, backspaceKey.x + backspaceKey.w, Math.max(1, originalWidth - backspaceKey.w), '');
            }
        } else {
            backspaceKey.w = 2;
        }
    }

    const enterIndex = nextKeys.findIndex((key) => isNamedAs(key, ['enter']) && key.x < 18);
    const slashIndex = nextKeys.findIndex((key) => {
        const normalizedName = normalize(key.name);
        return ['\\', '|', '\\ |', '| \\'].includes(normalizedName) && key.x > 12 && key.x < 16 && key.y < 3;
    });
    if (enterIndex >= 0) {
        const enterKey = nextKeys[enterIndex];
        restore(enterKey, enterIndex);

        if (layoutState.enterSplit) {
            enterKey.w = 2.25;
            enterKey.h = 1;
        } else if (slashIndex >= 0) {
            const slashKey = nextKeys[slashIndex];
            restore(slashKey, slashIndex);
            const enterCfg = optionKeys?.enterIso;
            const ansiEnterX = enterKey.x;
            const ansiEnterY = enterKey.y;
            const enterShape = enterCfg?.enterShape;
            const slashShape = enterCfg?.slashShape;

            enterKey.x = enterShape?.x ?? slashKey.x;
            enterKey.y = enterShape?.y ?? slashKey.y;
            enterKey.w = enterShape?.w ?? 1.25;
            enterKey.h = enterShape?.h ?? 2;
            (enterKey as LayoutKey & { w2?: number; h2?: number; x2?: number; y2?: number }).w2 = enterShape?.w2 ?? 1.5;
            (enterKey as LayoutKey & { w2?: number; h2?: number; x2?: number; y2?: number }).h2 = enterShape?.h2 ?? 1;
            (enterKey as LayoutKey & { w2?: number; h2?: number; x2?: number; y2?: number }).x2 = enterShape?.x2 ?? 0;
            (enterKey as LayoutKey & { w2?: number; h2?: number; x2?: number; y2?: number }).y2 = enterShape?.y2 ?? 0;

            slashKey.x = slashShape?.x ?? ansiEnterX;
            slashKey.y = slashShape?.y ?? ansiEnterY;
            slashKey.w = slashShape?.w ?? 1;
            slashKey.h = slashShape?.h ?? 1;
        } else {
            enterKey.w = 1.5;
            enterKey.h = 2;
        }
    }

    const rightShiftCandidates = nextKeys
        .map((key, idx) => ({ key, idx }))
        .filter(({ key }) => isNamedAs(key, ['r-shift', 'right shift', 'shift']) && key.y > 3);
    if (rightShiftCandidates.length > 0) {
        const rightShift = rightShiftCandidates.sort((a, b) => b.key.x - a.key.x)[0];
        restore(rightShift.key, rightShift.idx);
        if (layoutState.rshiftNormal) {
            const splitCfg = optionKeys?.rightShiftSplit;
            const originalWidth = rightShift.key.w;
            const splitWidth = splitCfg?.splitWidth ?? 1.75;
            rightShift.key.w = splitWidth;
            if (splitCfg?.extraKey) {
                const extra = splitCfg.extraKey;
                addVirtualSplitKey(rightShift.key, extra.x, extra.w, extra.name || '', extra);
            } else {
                addVirtualSplitKey(
                    rightShift.key,
                    rightShift.key.x + rightShift.key.w,
                    Math.max(0.75, originalWidth - rightShift.key.w),
                    ''
                );
            }
        } else {
            rightShift.key.w = 2.75;
        }
    }

    const spaceIndex = nextKeys.findIndex((key) => isNamedAs(key, ['space']));
    if (spaceIndex >= 0) {
        const spaceKey = nextKeys[spaceIndex];
        restore(spaceKey, spaceIndex);
        const bottomCfg = optionKeys?.bottomRow7u;
        if (layoutState.space7) {
            spaceKey.w = bottomCfg?.spaceWidth ?? 7;
            if (Array.isArray(bottomCfg?.resizeKeys)) {
                bottomCfg.resizeKeys.forEach((item: { index: number; w: number }) => {
                    const target = findByIndex(item.index);
                    if (!target) return;
                    target.w = item.w;
                });
            }
        } else {
            spaceKey.w = 6.25;
        }
    }

    return nextKeys;
}

type LayoutPanelProps = {
    onKeyboardScaleChange?: (ratio: number) => void;
};

export default function LayoutPanel({ onKeyboardScaleChange }: LayoutPanelProps = {}) {
    const { t } = useTranslation('common');
    const { keyboard, keyboardLayout } = useContext(ConnectKbContext);
    const { layoutState, setLayoutOption } = useLayoutConfig();

    const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
    const userKeys = keyboard?.userKeys?.[keyboard?.layer ?? 0] ?? [];
    const selectedIndex = keyboard?.selectIndex ?? -1;

    const mappedLayoutKeys = useMemo(() => {
        const baseKeys = mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeys);
        return applyLayoutPreview(baseKeys, layoutState, keyboardLayout?.layouts?.optionKeys);
    }, [layoutKeys, userKeys, layoutState, keyboardLayout?.layouts?.optionKeys]);

    const handleExclusiveToggle = (key: LayoutOptionKey) => {
        const groups: LayoutOptionKey[][] = [
            ['enterSplit', 'enterNormal'],
            ['backspaceAnsi', 'backspaceIso'],
            ['lshiftSplit', 'lshiftNormal'],
            ['rshiftSplit', 'rshiftNormal'],
            ['space625', 'space7'],
        ];

        const currentGroup = groups.find((group) => group.includes(key));
        if (!currentGroup) return;

        currentGroup.forEach((groupKey) => {
            setLayoutOption(groupKey, groupKey === key);
        });
    };

    return (
        <Box
            sx={{
                width: '70%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                minHeight: 0,
                margin: '0 auto',
            }}
        >
            <Box
                sx={{
                    height: '50%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                }}
            >
                <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <TravelVirtualKeyboard
                        layoutKeys={mappedLayoutKeys}
                        travelKeys={[]}
                        selectedKeys={selectedIndex >= 0 ? [selectedIndex] : []}
                        travelValue={0}
                        showActuation={false}
                        onToggleKey={(keyIndex: number) => keyboard?.setSelectIndex?.(keyIndex)}
                        patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
                        onScaleRatioChange={onKeyboardScaleChange}
                    />
                </Box>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: '1.25rem',
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                }}
            >
                {layoutCards.map((card) => (
                    <Box
                        key={card.titleKey}
                        sx={{
                            ...cardSx,
                            minHeight: '20rem',
                            px: '1.75rem',
                            py: '1.55rem',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: '1rem',
                                color: 'rgba(100, 116, 139, 1)',
                                lineHeight: 1.2,
                                fontWeight: 400,
                                mb: '0.95rem',
                            }}
                        >
                            {t(card.titleKey)}
                        </Typography>

                        <Divider sx={{ borderColor: 'rgba(203, 213, 225, 0.85)', mb: '1.4rem' }} />

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.35rem' }}>
                            {card.options.map((option) => (
                                <Box
                                    key={option.key}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 2,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '1rem',
                                            lineHeight: 1.2,
                                            fontWeight: 400,
                                            color: 'rgba(100, 116, 139, 1)',
                                        }}
                                    >
                                        {t(option.labelKey)}
                                    </Typography>

                                    <ToggleSlider
                                        checked={layoutState[option.key]}
                                        onChange={() => handleExclusiveToggle(option.key)}
                                        ariaLabel={t(option.labelKey)}
                                    />
                                </Box>
                            ))}
                        </Box>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
