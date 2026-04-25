import { Box, Tooltip, Typography } from '@mui/material';
import type { LayoutKey } from '@/types/types_v1';
import type { CompositeLayoutKey, PatternKey } from './types';
import { getActuationLabel, getCompositeKeyClipPath, getNameColor, renderPattern } from './render';

type KeyboardKeysProps = {
    layoutKeys: LayoutKey[];
    underPatterns: PatternKey[];
    overPatterns: PatternKey[];
    travelKeys: any[];
    selectedKeys: number[];
    travelValue: number;
    onToggleKey: (keyIndex: number) => void;
    onMouseDown?: (keyIndex: number) => void;
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

                const keyDisplay = String(key.name || keyIndex + 1);
                const keyEl = (
                    <Box
                        onClick={colorMode ? undefined : () => onToggleKey(keyIndex)}
                        onMouseDown={(e) => {
                            if (colorMode && e.button === 0) {
                                e.preventDefault();
                                onMouseDown?.(keyIndex);
                                return;
                            }
                            if (e.button === 2) {
                                e.preventDefault();
                                onMouseDown?.(keyIndex);
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
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'none',
                            animation: 'none',
                            userSelect: 'none',
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
                                alt={keyDisplay}
                                sx={{ width: '1.1rem', height: '1.1rem', objectFit: 'contain', mb: showActuation ? '4px' : 0 }}
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
                        <Tooltip key={rowKey} title={demoHighlightTitle} arrow placement="top">
                            {keyEl}
                        </Tooltip>
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
