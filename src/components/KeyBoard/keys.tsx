import { Box, Typography } from '@mui/material';
import type { LayoutKey } from '@/types/types_v1';
import type { CompositeLayoutKey, PatternKey } from './types';
import { getActuationLabel, getCompositeKeyClipPath, getNameColor, renderPattern } from './render';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';
import customKeys from '@/data/customkeys.json';

const iconPathToNameMap: Record<string, string> = (customKeys as any[])
    .flatMap((group) => group?.keycodes ?? [])
    .reduce((acc: Record<string, string>, item: any) => {
        const icon = typeof item?.icon === 'string' ? item.icon.trim() : '';
        const name = typeof item?.name === 'string' ? item.name.trim() : '';
        if (icon && name) acc[icon] = name;
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
    const isImageIcon = (value: string) => {
        const normalized = String(value || '').trim();
        return normalized.includes('/KeyType/') || normalized.endsWith('.svg') || normalized.endsWith('.png');
    };

    return (
        <Box sx={{ position: 'relative', ...keyboardStyle, transition: 'none', animation: 'none' }}>
            {underPatterns.map((pattern, idx) => renderPattern(pattern, idx, ku, kg))}
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
                const keyBg = colorMode ? (keyColors[keyIndex] || '#000000') : 'rgba(255,255,255,1)';
                const nameColor = getNameColor(colorMode, colorMode ? keyBg : undefined);
                const keyWidth = Math.max(key.w ?? 1, (composite.w2 ?? 0) + (composite.x2 ?? 0));
                const keyHeight = Math.max(key.h ?? 1, (composite.h2 ?? 0) + (composite.y2 ?? 0));
                const clipPath = getCompositeKeyClipPath(composite);
                const border = isDemoHighlight
                    ? '2px solid #ff9100'
                    : selected
                      ? '2px solid #4A86F7'
                      : '1px solid #e5e7eb';

                const keyName = String(key.name ?? '').trim();
                const keyDisplay = String(key.icon || key.name || keyIndex + 1);
                // 图标型按键：展示一个 hover 提示，避免只看到 icon 不知道含义
                const iconTooltipTitle = isImageIcon(keyDisplay)
                    ? (!isAssetPath(keyName) && keyName
                        ? keyName
                        : iconPathToNameMap[keyDisplay.trim()] || pathToFallbackLabel(keyDisplay))
                    : undefined;
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
                                    bgcolor: '#3b82f6',
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
                                component="img"
                                src={keyDisplay.trim()}
                                alt={keyName || keyDisplay}
                                sx={{ width: '32px', height: '32px', objectFit: 'contain', mb: showActuation ? '4px' : 0 }}
                            />
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
                            <Typography sx={{ fontSize: '12px', lineHeight: 1, color: '#4284ef', fontWeight: 700 }}>
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
            {overPatterns.map((pattern, idx) => renderPattern(pattern, idx + underPatterns.length, ku, kg))}
        </Box>
    );
}
