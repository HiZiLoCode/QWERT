'use client';

import { Box, Typography } from '@mui/material';
import type { LayoutKey } from '@/types/types_v1';
import type { CompositeLayoutKey, PatternKey } from './types';
import { getActuationLabel, getCompositeKeyClipPath, getNameColor, renderPattern } from './render';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';
import customKeys from '@/data/customkeys.json';
import { useTranslation } from '@/app/i18n';
import { alpha, useTheme } from '@mui/material/styles';
import { KEY_TYPE_ICON_BOX_PX } from '@/constants/keyTypeIconDisplay';
import PublicAssetImage from '@/components/common/PublicAssetImage';

const iconPathToNameMap: Record<string, string> = (customKeys as any[])
    .flatMap((group) => group?.keycodes ?? [])
    .reduce((acc: Record<string, string>, item: any) => {
        const icon = typeof item?.icon === 'string' ? item.icon.trim() : '';
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        if (icon && name) acc[icon] = name;
        return acc;
    }, {});

/** icon / emoji → common.json 键：优先条目 `langid`，否则 type 80 自定义键用 `900` + 两位 code1 */
const iconPathToI18nKey: Record<string, string> = (customKeys as any[])
    .flatMap((group) => group?.keycodes ?? [])
    .reduce((acc: Record<string, string>, item: any) => {
        const icon = typeof item?.icon === 'string' ? item.icon.trim() : '';
        if (!icon) return acc;
        const langid = typeof item?.langid === 'string' ? item.langid.trim() : '';
        if (langid) {
            acc[icon] = langid;
            return acc;
        }
        if (item?.type === 80 && typeof item?.code1 === 'number' && item.code1 >= 0) {
            acc[icon] = `900${String(item.code1).padStart(2, '0')}`;
        }
        return acc;
    }, {});

function isAssetPath(value: string): boolean {
    return value.includes('/KeyType/') || value.endsWith('.svg') || value.endsWith('.png');
}

function pathToFallbackLabel(pathValue: string): string {
    const fileName = pathValue.split('/').pop() ?? pathValue;
    return fileName
        .replace(/\.(svg|png)$/i, '')
        .replace(/[_-]+/g, ' ')
        .trim();
}

type KeyboardKeysProps = {
    layoutKeys: LayoutKey[];
    underPatterns: PatternKey[];
    overPatterns: PatternKey[];
    travelKeys: any[];
    selectedKeys: number[];
    travelValue: number;
    onToggleKey: (keyIndex: number) => void;
    onMouseDown?: (keyIndex: number, button?: number, clientX?: number, clientY?: number) => void;
    onMouseEnter?: (keyIndex: number) => void;
    onMouseUp?: () => void;
    showActuation?: boolean;
    colorMode?: boolean;
    keyColors?: string[];
    ku: number;
    kg: number;
    keyboardStyle: { width: string; height: string };
    demoHighlightKeyIndex?: number;
    demoHighlightTitle?: string;
    keyBadges?: Record<number, string | number>;
    disableKeyHoverScale?: boolean;
};

export default function KeyboardKeys({
    layoutKeys,
    underPatterns,
    overPatterns,
    travelKeys,
    selectedKeys,
    travelValue,
    onToggleKey,
    onMouseDown,
    onMouseEnter,
    onMouseUp,
    showActuation = false,
    colorMode = false,
    keyColors = [],
    ku,
    kg,
    keyboardStyle,
    demoHighlightKeyIndex,
    demoHighlightTitle,
    keyBadges,
    disableKeyHoverScale = false,
}: KeyboardKeysProps) {
    const { t } = useTranslation('common');
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const isImageIcon = (value: string) => {
        const normalized = String(value || '').trim();
        return normalized.includes('/KeyType/') || normalized.endsWith('.svg') || normalized.endsWith('.png');
    };

    /** 是否为「以图标为主展示」的键位（含 SVG/PNG 路径、emoji、且能在 customkeys 中解析到说明） */
    const isIconPrimaryDisplay = (keyDisplay: string) => {
        const d = String(keyDisplay || '').trim();
        if (!d) return false;
        if (isImageIcon(d)) return true;
        return Boolean(iconPathToI18nKey[d] || iconPathToNameMap[d]);
    };

    const resolveIconTooltipTitle = (keyDisplay: string, keyName: string): string | undefined => {
        if (!isIconPrimaryDisplay(keyDisplay)) return undefined;
        const iconKey = keyDisplay.trim();
        const i18nLookup = iconPathToI18nKey[iconKey];
        if (i18nLookup) {
            const translated = t(i18nLookup);
            if (translated && translated !== i18nLookup) return translated;
        }
        if (!isAssetPath(keyName) && keyName) return keyName;
        return iconPathToNameMap[iconKey] || pathToFallbackLabel(keyDisplay);
    };

    return (
        <Box sx={{ position: 'relative', ...keyboardStyle, transition: 'none', animation: 'none' }}>
            {underPatterns.map((pattern, idx) => renderPattern(pattern, idx, ku, kg, isDark ? 'dark' : 'light'))}
            {layoutKeys.map((key, idx) => {
                const composite = key as CompositeLayoutKey;
                const keyIndex = key.index ?? idx;
                const selected = selectedKeys.includes(keyIndex);
                const allowHoverScale = !selected && !disableKeyHoverScale;
                const isDemoHighlight =
                    typeof demoHighlightKeyIndex === 'number' &&
                    demoHighlightKeyIndex >= 0 &&
                    keyIndex === demoHighlightKeyIndex;
                const actuation = travelKeys[keyIndex]?.actuation;
                const keyBg = colorMode
                    ? keyColors[keyIndex] || '#000000'
                    : isDark
                      ? theme.palette.customed1.main
                      : 'rgba(255,255,255,1)';
                const nameColor = getNameColor(colorMode, colorMode ? keyBg : undefined, isDark ? 'dark' : 'light');
                const keyWidth = Math.max(key.w ?? 1, (composite.w2 ?? 0) + (composite.x2 ?? 0));
                const keyHeight = Math.max(key.h ?? 1, (composite.h2 ?? 0) + (composite.y2 ?? 0));
                const clipPath = getCompositeKeyClipPath(composite);
                const border = isDemoHighlight
                    ? '2px solid #ff9100'
                    : selected
                      ? `2px solid ${isDark ? theme.palette.primary.main : '#4A86F7'}`
                      : isDark
                        ? `1px solid var(--border-default)`
                        : '1px solid #e5e7eb';

                const keyName = String(key.name ?? '').trim();
                const keyDisplay = String(key.icon || key.name || keyIndex + 1);
                // 图标型按键：优先 common.json（langid / 900xx），再退回英文名或文件名
                const iconTooltipTitle = resolveIconTooltipTitle(keyDisplay, keyName);
                const keyEl = (
                    <Box
                        onClick={colorMode ? undefined : () => onToggleKey(keyIndex)}
                        onMouseDown={(e) => {
                            if (colorMode && e.button === 0) {
                                e.preventDefault();
                                onMouseDown?.(keyIndex, e.button, e.clientX, e.clientY);
                                return;
                            }
                            if (e.button === 2) {
                                e.preventDefault();
                                onMouseDown?.(keyIndex, e.button, e.clientX, e.clientY);
                            }
                        }}
                        onMouseEnter={() => onMouseEnter?.(keyIndex)}
                        onMouseUp={() => onMouseUp?.()}
                        onContextMenu={(e) => e.preventDefault()}
                        sx={{
                            position: 'absolute',
                            left: `${(key.x ?? 0) * (ku + kg)}px`,
                            top: `${(key.y ?? 0) * (ku + kg)}px`,
                            width: `${keyWidth * ku + (keyWidth - 1) * kg}px`,
                            height: `${keyHeight * ku + (keyHeight - 1) * kg}px`,
                            borderRadius: '6px',
                            border,
                            background: keyBg,
                            clipPath: clipPath ?? undefined,
                            color: nameColor,
                            cursor: colorMode ? 'inherit' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: allowHoverScale ? 'transform 0.15s ease-out' : 'none',
                            animation: 'none',
                            userSelect: 'none',
                            transformOrigin: 'center center',
                            ...(allowHoverScale
                                ? {
                                      '&:hover': {
                                          transform: 'scale(0.9)',
                                          zIndex: 1,
                                      },
                                  }
                                : {}),
                            ...(isDemoHighlight
                                ? { boxShadow: '0 0 0 1px rgba(255, 145, 0, 0.35), 0 2px 8px rgba(255, 145, 0, 0.2)' }
                                : {}),
                        }}
                    >
                        {keyBadges && keyBadges[keyIndex] != null && String(keyBadges[keyIndex]) !== '0' && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    right: '3px',
                                    bottom: '2px',
                                    minWidth: '12px',
                                    height: '12px',
                                    px: '2px',
                                    borderRadius: '10px',
                                    bgcolor: theme.palette.primary.main,
                                    color: '#fff',
                                    fontSize: '9px',
                                    fontWeight: 700,
                                    lineHeight: '12px',
                                    textAlign: 'center',
                                    pointerEvents: 'none',
                                }}
                            >
                                {String(keyBadges[keyIndex])}
                            </Box>
                        )}
                        {isImageIcon(keyDisplay) ? (
                            <Box
                                sx={{
                                    width: KEY_TYPE_ICON_BOX_PX,
                                    height: KEY_TYPE_ICON_BOX_PX,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    mb: showActuation ? '4px' : 0,
                                }}
                            >
                                <PublicAssetImage
                                    src={keyDisplay.trim()}
                                    alt={keyName || keyDisplay}
                                    sx={{
                                        width: KEY_TYPE_ICON_BOX_PX,
                                        height: KEY_TYPE_ICON_BOX_PX,
                                        objectFit: 'contain',
                                        filter: isDark && isImageIcon(keyDisplay) ? 'brightness(0) invert(1)' : 'none',
                                    }}
                                />
                            </Box>
                        ) : (
                            <Typography
                                sx={{
                                    fontSize: '13px',
                                    fontWeight: 'bold',
                                    lineHeight: 1,
                                    mb: showActuation ? '4px' : 0,
                                    color: nameColor,
                                    textAlign: 'center',
                                    maxWidth: '100%',
                                    px: '2px',
                                    whiteSpace: 'normal',
                                    wordBreak: 'keep-all',
                                    overflowWrap: 'normal',
                                }}
                            >
                                {keyDisplay}
                            </Typography>
                        )}
                        {showActuation && (
                            <Typography sx={{ fontSize: '12px', lineHeight: 1, color: theme.palette.primary.main, fontWeight: 700 }}>
                                {getActuationLabel(actuation, travelValue)}
                            </Typography>
                        )}
                    </Box>
                );

                const rowKey = `${key.row ?? 0}-${key.col ?? 0}-${idx}`;
                if (isDemoHighlight && demoHighlightTitle) {
                    return (
                        <UnifiedTooltip key={rowKey} title={demoHighlightTitle} placement="top" arrow>
                            {keyEl}
                        </UnifiedTooltip>
                    );
                }
                if (iconTooltipTitle) {
                    return (
                        <UnifiedTooltip
                            key={rowKey}
                            title={iconTooltipTitle}
                            placement="top"
                            arrow
                        >
                            {keyEl}
                        </UnifiedTooltip>
                    );
                }
                return (
                    <Box key={rowKey} sx={{ position: 'static' }}>
                        {keyEl}
                    </Box>
                );
            })}
            {overPatterns.map((pattern, idx) =>
                renderPattern(pattern, idx + underPatterns.length, ku, kg, isDark ? 'dark' : 'light'),
            )}
        </Box>
    );
}
