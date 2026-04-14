import { Box } from '@mui/material';
import type { CompositeLayoutKey, PatternKey } from './types';

export const DEFAULT_KEY_UNIT_PX = 64;
export const DEFAULT_KEY_GAP_PX = 2;
export const BOARD_EDGE_PAD_PX = 6;
export const KEYBOARD_CARD_PADDING_PX = 12;
export const KEYBOARD_CARD_BORDER_PX = 1;

const FUNCTION_PANEL_CIRCLE_ROW_REM = 0.5;
const FUNCTION_PANEL_CIRCLE_GAP_REM = 0.15;

export function legacyRemToPx(rem: number) {
    return Math.round(rem * 16);
}

function getFunctionPanelCircleSizeRem(pattern: PatternKey) {
    return pattern.style?.panelCircleSizeRem ?? FUNCTION_PANEL_CIRCLE_ROW_REM;
}

function getFunctionPanelCircleGapRem(pattern: PatternKey) {
    return pattern.style?.panelCircleGapRem ?? FUNCTION_PANEL_CIRCLE_GAP_REM;
}

function getFunctionPanelCirclesExtraRem(pattern: PatternKey) {
    if (pattern.type !== 'functionPanel') return 0;
    const count = pattern.style?.smallCircleCount ?? 0;
    if (count <= 0 || pattern.style?.circlesOutside === false) return 0;
    return getFunctionPanelCircleSizeRem(pattern) + getFunctionPanelCircleGapRem(pattern);
}

export function getActuationLabel(rawValue: unknown, fallback: number) {
    if (typeof rawValue !== 'number') return fallback.toFixed(1);
    const value = rawValue > 10 ? rawValue / 100 : rawValue;
    return value.toFixed(1);
}

export function getNameColor(colorMode: boolean, bgColor: string | undefined) {
    if (!colorMode || !bgColor) return '#6f7f96';
    const hex = bgColor.trim();
    const fullHex = hex.startsWith('#') ? hex.slice(1) : hex;
    if (fullHex.length !== 6) return '#ffffff';
    const r = Number.parseInt(fullHex.slice(0, 2), 16);
    const g = Number.parseInt(fullHex.slice(2, 4), 16);
    const b = Number.parseInt(fullHex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return '#ffffff';
    return (r * 299 + g * 587 + b * 114) / 1000 >= 185 ? '#111111' : '#ffffff';
}

export function getCompositeKeyClipPath(key: CompositeLayoutKey): string | null {
    if (key.w2 === undefined || key.h2 === undefined) return null;
    const x = key.x ?? 0;
    const y = key.y ?? 0;
    const x2 = key.x2 ?? 0;
    const y2 = key.y2 ?? 0;
    const w = key.w ?? 1;
    const h = key.h ?? 1;
    const w2 = key.w2 ?? 1;
    const h2 = key.h2 ?? 1;
    const boundingWidth = Math.max(w, w2);
    const boundingHeight = Math.max(h, h2);
    const minX = Math.min(x, x + x2);
    const minY = Math.min(y, y + y2);
    const [nx, nx2, ny, ny2, nw, nw2, nh, nh2] =
        w === boundingWidth
            ? [x + x2 - minX, x - minX, y + y2 - minY, y - minY, w2, w, h2, h]
            : [x - minX, x + x2 - minX, y - minY, y + y2 - minY, w, w2, h, h2];
    const corners = [
        [nx2 / boundingWidth, ny2 / boundingHeight], [nx / boundingWidth, ny2 / boundingHeight],
        [nx / boundingWidth, ny / boundingHeight], [(nx + nw) / boundingWidth, ny / boundingHeight],
        [(nx + nw) / boundingWidth, ny2 / boundingHeight], [(nx2 + nw2) / boundingWidth, ny2 / boundingHeight],
        [(nx2 + nw2) / boundingWidth, (ny2 + nh2) / boundingHeight], [(nx + nw) / boundingWidth, (ny2 + nh2) / boundingHeight],
        [(nx + nw) / boundingWidth, (ny + nh) / boundingHeight], [nx / boundingWidth, (ny + nh) / boundingHeight],
        [nx / boundingWidth, (ny2 + nh2) / boundingHeight], [nx2 / boundingWidth, (ny2 + nh2) / boundingHeight],
    ]; 
    return `polygon(${corners.map((c) => `${c[0] * 100}% ${c[1] * 100}%`).join(',')})`;
}

export function getKeyVisualBoundsPx(key: CompositeLayoutKey, ku: number, kg: number) {
    const keyWidth = Math.max(key.w ?? 1, (key.w2 ?? 0) + (key.x2 ?? 0));
    const keyHeight = Math.max(key.h ?? 1, (key.h2 ?? 0) + (key.y2 ?? 0));
    const cell = ku + kg;
    const left = (key.x ?? 0) * cell;
    const top = (key.y ?? 0) * cell;
    const width = keyWidth * ku + (keyWidth - 1) * kg;
    const height = keyHeight * ku + (keyHeight - 1) * kg;
    return { right: left + width, bottom: top + height };
}

export function getPatternVisualBoundsPx(pattern: PatternKey, ku: number, kg: number) {
    const widthUnits = pattern.w ?? 1;
    const heightUnits = pattern.h ?? 1;
    const cell = ku + kg;
    const left = (pattern.x ?? 0) * cell;
    let top = (pattern.y ?? 0) * cell;
    const width = widthUnits * ku + (widthUnits - 1) * kg;
    let height = heightUnits * ku + (heightUnits - 1) * kg;
    const extraTopPx = legacyRemToPx(getFunctionPanelCirclesExtraRem(pattern));
    if (extraTopPx > 0) {
        top -= extraTopPx;
        height += extraTopPx;
    }
    return { right: left + width, bottom: top + height };
}

export function renderPattern(pattern: PatternKey, idx: number, ku: number, kg: number) {
    const left = `${(pattern.x ?? 0) * (ku + kg)}px`;
    const top = `${(pattern.y ?? 0) * (ku + kg)}px`;
    const width = `${(pattern.w ?? 1) * ku + ((pattern.w ?? 1) - 1) * kg}px`;
    const height = `${(pattern.h ?? 1) * ku + ((pattern.h ?? 1) - 1) * kg}px`;
    const key = `${pattern.id ?? pattern.type ?? 'pattern'}-${idx}`;

    const shellSx = {
        position: 'absolute' as const,
        left,
        top,
        width,
        height,
        borderRadius: '8px',
        border: '1px solid rgba(181,187,196,1)',
        background: 'rgba(240,240,240,1)',
        boxSizing: 'border-box' as const,
        pointerEvents: 'none' as const,
        zIndex: 0,
        overflow: 'hidden' as const,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)',
    };

    if (pattern.type === 'knob') {
        const lineY = pattern.style?.lineYPercent ?? 42;
        const circleSize = pattern.style?.circleSizePercent ?? 20;
        const circleLeft = pattern.style?.circleLeftPercent ?? 73;
        const circleTop = pattern.style?.circleTopPercent ?? 73;
        const innerSquare = pattern.style?.innerSquare !== false;
        return (
            <Box key={key} sx={shellSx}>
                {innerSquare && (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '14%',
                            top: '12%',
                            width: '44%',
                            height: '44%',
                            borderRadius: '5px',
                            background: 'linear-gradient(180deg, rgba(250,251,253,0.98) 0%, rgba(228,232,238,0.95) 100%)',
                            border: '1px solid rgba(181,187,196,0.55)',
                            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                        }}
                    />
                )}
                <Box sx={{ position: 'absolute', left: 0, right: 0, top: `${lineY}%`, height: '1px', background: 'rgba(181,187,196,1)', borderRadius: '3px' }} />
                <Box
                    sx={{
                        position: 'absolute',
                        width: `${circleSize}%`,
                        height: `${circleSize}%`,
                        borderRadius: '50%',
                        border: '1px solid #bfc6d0',
                        left: `${circleLeft}%`,
                        top: `${circleTop}%`,
                        transform: 'translate(-50%, -50%)',
                        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0%, rgba(240,242,246,1) 45%, rgba(220,224,232,1) 100%)',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)',
                    }}
                />
            </Box>
        );
    }

    if (pattern.type === 'volume') {
        const bars = Math.max(1, pattern.style?.barCount ?? 9);
        const buttons = pattern.style?.buttons ?? ['Vol -', 'Mute', 'Vol +'];
        return (
            <Box
                key={key}
                sx={{
                    ...shellSx,
                    p: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    justifyContent: 'flex-end',
                }}
            >
                <Box sx={{ display: 'flex', gap: '4px', mb: '8px', flexShrink: 0 }}>
                    {Array.from({ length: bars }).map((_, i) => (
                        <Box
                            key={i}
                            sx={{
                                minWidth: "11px",
                                height: '6px',
                                borderRadius: '3px',
                                background: 'rgba(255,255,255,1)',
                                boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,1)',
                            }}
                        />
                    ))}
                </Box>
                <Box sx={{ display: 'flex', minHeight: 0, alignItems: 'flex-end', gap: 0, height:"1.25rem"}}>
                    {buttons.map((label, i) => (
                        <Box
                            key={`${label}-${i}`}
                            sx={{
                                flex: 1,
                                minWidth: 0,
                                border: '1px solid rgba(181,187,196,1)',
                                background: 'rgba(255,255,255,1)',
                                borderRadius: i === 0 ? '4px 0 0 4px' : i === buttons.length - 1 ? '0 4px 4px 0' : '0',
                                marginLeft: i > 0 ? '-1px' : 0,
                                position: 'relative',
                                zIndex: i,
                                color: '#5f6c80',
                                fontSize: 'clamp(7px, 1.1vw, 9px)',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                lineHeight: 1,
                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
                                height:"1.25rem"
                            }}
                        >
                            {label}
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    if (pattern.type === 'scrollArea') {
        return (
            <Box
                key={key}
                sx={{
                    ...shellSx,
                    borderRadius: '16px',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -1px 0 rgba(0,0,0,0.03)',
                }}
            />
        );
    }

    if (pattern.type === 'functionPanel') {
        const cell = ku + kg;
        const wPx = (pattern.w ?? 1) * ku + ((pattern.w ?? 1) - 1) * kg;
        const hPx = (pattern.h ?? 1) * ku + ((pattern.h ?? 1) - 1) * kg;
        const leftPx = (pattern.x ?? 0) * cell;
        const topBasePx = (pattern.y ?? 0) * cell;
        const smallCircleCount = Math.max(0, pattern.style?.smallCircleCount ?? 2);
        const circlesOutside = pattern.style?.circlesOutside !== false;
        const extraTopPx =
            circlesOutside && smallCircleCount > 0 ? legacyRemToPx(getFunctionPanelCirclesExtraRem(pattern)) : 0;
        const topPx = topBasePx - extraTopPx;
        const totalHPx = hPx + extraTopPx;
        const circleSizePx = legacyRemToPx(getFunctionPanelCircleSizeRem(pattern));
        const circleGapPx = legacyRemToPx(getFunctionPanelCircleGapRem(pattern));
        const matrixRows = Math.max(1, pattern.style?.matrixRows ?? 6);
        const matrixCols = Math.max(1, pattern.style?.matrixCols ?? 6);
        const screenCount = Math.max(1, pattern.style?.screenCount ?? 1);
        const matrixAreaWidthPercent = Math.min(90, Math.max(35, pattern.style?.matrixAreaWidthPercent ?? 58));
        const matrixScreenWidthPercent = Math.min(100, Math.max(45, pattern.style?.matrixScreenWidthPercent ?? 100));
        const matrixDotGapPx = Math.max(1, legacyRemToPx(Math.max(0.02, pattern.style?.matrixDotGapRem ?? 0.0625)));
        const bottomButtonCount = Math.max(0, pattern.style?.bottomButtonCount ?? 1);
        const topBarW = Math.min(100, Math.max(20, pattern.style?.topBarWidthPercent ?? 66));

        return (
            <Box
                key={key}
                sx={{
                    position: 'absolute',
                    left: `${leftPx}px`,
                    top: `${topPx}px`,
                    width: `${wPx}px`,
                    height: `${totalHPx}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: extraTopPx > 0 ? `${circleGapPx}px` : 0,
                    pointerEvents: 'none',
                    zIndex: 0,
                    overflow: 'visible',
                }}
            >
                {circlesOutside && smallCircleCount > 0 ? (
                    <Box sx={{ display: 'flex', gap: '18px', justifyContent: 'center', alignItems: 'center', flexShrink: 0, height: `${circleSizePx}px` }}>
                        {Array.from({ length: smallCircleCount }).map((_, i) => (
                            <Box key={i} sx={{ width: `${circleSizePx}px`, height: `${circleSizePx}px`, borderRadius: '50%', background: 'linear-gradient(180deg, rgba(252,252,253,1) 0%, rgba(236,238,242,1) 100%)', border: '1px solid rgba(181,187,196,0.9)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)' }} />
                        ))}
                    </Box>
                ) : null}
                <Box sx={{ flex: 1, minHeight: 0, width: '100%', borderRadius: '8px', border: '1px solid rgba(181,187,196,1)', background: 'rgba(240,240,240,1)', boxSizing: 'border-box', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)', display: 'flex', flexDirection: 'column', p: '6px 5px', gap: '3px' }}>
                    <Box sx={{ position: 'relative', width: `${topBarW}%`, height: '5px', alignSelf: 'flex-start' }}>
                        <Box sx={{ width: '100%', height: '100%', borderRadius: '0 4px 0 0', background: 'rgba(240,240,240,1)', borderTop: '1px solid rgba(181,187,196,1)', borderRight: '1px solid rgba(181,187,196,1)' }} />
                        <Box sx={{ position: 'absolute', left: 0, bottom: '-2px', width: '108%', height: '1px', background: 'rgba(181,187,196,1)' }} />
                    </Box>
                    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row', gap: '2px' }}>
                        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }} />
                        <Box sx={{ width: `${matrixAreaWidthPercent}%`, maxWidth: `${matrixAreaWidthPercent}%`, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', gap: '2px' }}>
                            <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateRows: `repeat(${screenCount}, minmax(0,1fr))`, gap: '2px' }}>
                                {Array.from({ length: screenCount }).map((__, screenIdx) => (
                                    <Box key={screenIdx} sx={{ minHeight: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', py: 0 }}>
                                        <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${matrixCols}, .5fr)`, gap: `${matrixDotGapPx}px`, width: `${matrixScreenWidthPercent}%` }}>
                                            {Array.from({ length: matrixRows * matrixCols }).map((_, i) => (
                                                <Box key={`${screenIdx}-${i}`} sx={{ width: '100%', aspectRatio: '1 / 1', borderRadius: '2px', background: 'rgba(255,255,255,0.75)', border: '0.5px solid rgba(181,187,196,0.35)', boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.95)' }} />
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, pr: '1px' }}>
                                {Array.from({ length: bottomButtonCount }).map((_, i) => (
                                    <Box key={i} sx={{ width: '14px', height: '4px', borderRadius: '999px', border: '1px solid rgba(181,187,196,1)', background: 'rgba(252,252,253,0.95)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }} />
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Box key={key} sx={{ position: 'absolute', left, top, width, height, borderRadius: '8px', border: '1px solid rgba(181,187,196,1)', background: 'rgba(240,240,240,1)', boxSizing: 'border-box', pointerEvents: 'none', zIndex: 0 }} />
    );
}
