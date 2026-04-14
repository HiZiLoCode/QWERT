'use client';

import { Box, Button, Divider, Typography } from '@mui/material';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import KeyboardKeys from './keys';
import type { CompositeLayoutKey, TravelVirtualKeyboardProps } from './types';
import {
    BOARD_EDGE_PAD_PX,
    DEFAULT_KEY_GAP_PX,
    DEFAULT_KEY_UNIT_PX,
    getKeyVisualBoundsPx,
    getPatternVisualBoundsPx,
    KEYBOARD_CARD_BORDER_PX,
    KEYBOARD_CARD_PADDING_PX,
} from './render';

const OUTER_GUTTER_PX = 19;

/**
 * 缩放：用 fitScale 乘在 ku/kg 上重算整盘像素，不用 CSS transform（避免「改了代码观感不变」、双重量纲混乱）。
 * 1. 先按基准 ku/kg 算卡片自然宽高（含白边 padding/border）。
 * 2. fitScale = min(可用宽/自然宽, 可用高/自然高, scaleMax)；视口来自 viewportRef，首帧 0 则用 window.inner* 兜底。
 * 3. 再用 ku*fitScale、kg*fitScale 算 boardSizePx 与 KeyboardKeys，布局尺寸即最终所见。
 */
function computeFitScaleOnly(params: {
    naturalW: number;
    naturalH: number;
    viewportW: number;
    viewportH: number;
    scalePaddingLeft: number;
    scalePaddingRight: number;
    scaleMax: number;
}): number {
    const { naturalW, naturalH, viewportW, viewportH, scalePaddingLeft, scalePaddingRight, scaleMax } = params;
    if (naturalW <= 0 || naturalH <= 0) return 1;
    if (viewportW <= 0 || viewportH <= 0) return 1;
    const availableW = Math.max(1, viewportW - scalePaddingLeft - scalePaddingRight);
    const availableH = Math.max(1, viewportH);
    const raw = Math.min(availableW / naturalW, availableH / naturalH, scaleMax);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

function computeBoardSize(
    layoutKeys: TravelVirtualKeyboardProps['layoutKeys'],
    patternKeys: TravelVirtualKeyboardProps['patternKeys'],
    ku: number,
    kg: number
): { width: number; height: number } {
    if (!layoutKeys.length) {
        const w = 90.25 * ku + 89.25 * kg;
        const h = 29.75 * ku + 28.75 * kg;
        return { width: w + BOARD_EDGE_PAD_PX, height: h + BOARD_EDGE_PAD_PX };
    }
    let maxRight = 0;
    let maxBottom = 0;
    layoutKeys.forEach((key) => {
        const { right, bottom } = getKeyVisualBoundsPx(key as CompositeLayoutKey, ku, kg);
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    (patternKeys ?? []).forEach((pattern) => {
        const { right, bottom } = getPatternVisualBoundsPx(pattern, ku, kg);
        if (right > maxRight) maxRight = right;
        if (bottom > maxBottom) maxBottom = bottom;
    });
    return { width: maxRight + BOARD_EDGE_PAD_PX, height: maxBottom + BOARD_EDGE_PAD_PX };
}

function cardOuterSize(board: { width: number; height: number }): { w: number; h: number } {
    const p = KEYBOARD_CARD_PADDING_PX;
    const b = KEYBOARD_CARD_BORDER_PX;
    return { w: board.width + 2 * p + 2 * b, h: board.height + 2 * p + 2 * b };
}

export default function TravelVirtualKeyboard({
    layoutKeys,
    patternKeys = [],
    travelKeys,
    selectedKeys,
    travelValue,
    onToggleKey,
    keyUnitPx = DEFAULT_KEY_UNIT_PX,
    keyGapPx = DEFAULT_KEY_GAP_PX,
    alignTop = false,
    colorMode = false,
    keyColors = [],
    showActuation = false,
    onMouseDown,
    onMouseEnter,
    onMouseUp,
    fitToContainer = true,
    scalePaddingLeft = 0,
    scalePaddingRight = 0,
    scaleMax = 2,
    scaleMin: _scaleMin = 0.2,
    showLayerOverlay = false,
    layerCount = 4,
    currentLayer = 0,
    onSelectLayer,
    onRestoreDefault,
}: TravelVirtualKeyboardProps) {
    void _scaleMin;

    const ku = keyUnitPx;
    const kg = keyGapPx;
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
    const [windowViewport, setWindowViewport] = useState({ innerWidth: 0, innerHeight: 0 });

    const boardUnscaled = useMemo(() => computeBoardSize(layoutKeys, patternKeys, ku, kg), [layoutKeys, patternKeys, ku, kg]);
    const naturalUnscaled = useMemo(() => cardOuterSize(boardUnscaled), [boardUnscaled]);

    useLayoutEffect(() => {
        const syncWindow = () => {
            setWindowViewport({
                innerWidth: window.innerWidth || 0,
                innerHeight: window.innerHeight || 0,
            });
        };

        if (!fitToContainer) {
            syncWindow();
            window.addEventListener('resize', syncWindow);
            return () => window.removeEventListener('resize', syncWindow);
        }

        const el = viewportRef.current;
        if (!el) {
            syncWindow();
            window.addEventListener('resize', syncWindow);
            return () => window.removeEventListener('resize', syncWindow);
        }

        const read = () => {
            syncWindow();
            setViewportSize({
                width: Math.max(0, el.clientWidth),
                height: Math.max(0, el.clientHeight),
            });
        };

        read();
        const ro = new ResizeObserver(read);
        ro.observe(el);
        window.addEventListener('resize', read);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', read);
        };
    }, [fitToContainer]);

    const fitScale = useMemo(() => {
        if (!fitToContainer) return 1;
        const measuredWidth = viewportSize.width > 0 ? viewportSize.width : windowViewport.innerWidth;
        const measuredHeight = viewportSize.height > 0 ? viewportSize.height : windowViewport.innerHeight;
        return computeFitScaleOnly({
            naturalW: naturalUnscaled.w,
            naturalH: naturalUnscaled.h,
            viewportW: measuredWidth,
            viewportH: measuredHeight,
            scalePaddingLeft,
            scalePaddingRight,
            scaleMax,
        });
    }, [fitToContainer, naturalUnscaled, viewportSize, windowViewport, scalePaddingLeft, scalePaddingRight, scaleMax]);

    const scaledKu = ku * fitScale;
    const scaledKg = kg * fitScale;

    const boardSizePx = useMemo(
        () => computeBoardSize(layoutKeys, patternKeys, scaledKu, scaledKg),
        [layoutKeys, patternKeys, scaledKu, scaledKg]
    );

    const keyboardStyle = useMemo(
        () => ({ width: `${boardSizePx.width}px`, height: `${boardSizePx.height}px`, maxWidth: '100%' }),
        [boardSizePx]
    );

    const contentShiftX = (scalePaddingLeft - scalePaddingRight) / 2;

    const underPatterns = useMemo(() => patternKeys.filter((p) => (p.layer ?? 'under') === 'under'), [patternKeys]);
    const overPatterns = useMemo(() => patternKeys.filter((p) => p.layer === 'over'), [patternKeys]);

    return (
        <Box
            sx={{
                p: `${OUTER_GUTTER_PX}px`,
                position: 'relative',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'stretch',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
            }}
        >
            {showLayerOverlay && (
                <Box
                    sx={{
                        width: '144px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        zIndex: 2,
                        marginRight: '39px',
                    }}
                >
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#94a3b8', mb: '10px', width: '100%', letterSpacing: '0.06em' }}>
                        LAYER
                    </Typography>
                    {Array.from({ length: layerCount }).map((_, i) => {
                        const active = currentLayer === i;
                        return (
                            <Button
                                key={i}
                                onClick={() => onSelectLayer?.(i)}
                                sx={{
                                    width: '144px',
                                    minWidth: '100%',
                                    height: '36px',
                                    mb: '5px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    color: active ? '#fff' : '#64748b',
                                    background: active ? '#4a86f7' : '#ffffff',
                                    border: active ? '1px solid transparent' : '1px solid rgba(203,213,225,0.65)',
                                    boxShadow: active ? '0 1px 3px rgba(74, 134, 247, 0.25)' : '0 1px 2px rgba(0,0,0,0.06)',
                                    '&:hover': { background: active ? '#3b78f0' : '#f8fafc' },
                                }}
                            >
                                {i === 0 ? '默认层' : `层${i}`}
                            </Button>
                        );
                    })}
                    <Divider sx={{ borderColor: 'rgba(203, 213, 225, 0.85)', my: '13px' }} />
                    <Button
                        variant="contained"
                        disableElevation
                        onClick={() => onRestoreDefault?.()}
                        sx={{
                            width: '144px',
                            minWidth: '100%',
                            height: '36px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            textTransform: 'none',
                            color: '#64748b',
                            background: '#ffffff',
                            border: '1px solid rgba(203,213,225,0.65)',
                            '&:hover': {
                                background: '#f1f5f9',
                                border: '1px solid rgba(203,213,225,0.85)',
                            },
                        }}
                    >
                        恢复默认
                    </Button>
                </Box>
            )}
            <Box
                ref={viewportRef}
                sx={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 0,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: alignTop ? 'flex-start' : 'center',
                }}
            >
                <Box
                    sx={{
                        flex: '0 0 auto',
                        marginLeft: `${contentShiftX}px`,
                        animation: 'var(--anim-fade-in)',
                        filter: 'drop-shadow(0 2px 4px rgba(176, 206, 255, 0.25))',
                    }}
                >
                    <Box
                        onMouseUp={() => onMouseUp?.()}
                        onMouseLeave={() => onMouseUp?.()}
                        sx={{
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            p: `${KEYBOARD_CARD_PADDING_PX}px`,
                            boxSizing: 'border-box',
                        }}
                    >
                        <KeyboardKeys
                            layoutKeys={layoutKeys}
                            underPatterns={underPatterns}
                            overPatterns={overPatterns}
                            travelKeys={travelKeys}
                            selectedKeys={selectedKeys}
                            travelValue={travelValue}
                            onToggleKey={onToggleKey}
                            onMouseDown={onMouseDown}
                            onMouseEnter={onMouseEnter}
                            onMouseUp={onMouseUp}
                            showActuation={showActuation}
                            colorMode={colorMode}
                            keyColors={keyColors}
                            ku={scaledKu}
                            kg={scaledKg}
                            keyboardStyle={keyboardStyle}
                        />
                        {!layoutKeys.length && (
                            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography sx={{ color: '#7c8ca5' }}>暂无键盘布局数据</Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
