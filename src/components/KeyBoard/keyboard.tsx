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

/** LAYER 列宽 144 + marginRight 39 */
const LAYER_COLUMN_RESERVE_W = 183;

function minPositive(...vals: number[]): number {
    const ok = vals.filter((v) => Number.isFinite(v) && v > 0);
    return ok.length ? Math.min(...ok) : 0;
}

/**
 * 与 ticktype `keyboard.tsx` 一致：`ratio = min(scaleMax, budgetW/naturalW, budgetH/naturalH)`。
 * budget为 min(父级 viewport、root、inner/visualViewport/docClient)，保证页面缩放或窄窗时不会超出可视区域。
 * 可选 `fitWidthReferencePx`：横向分母改为 max(naturalW,该值)，用于特殊布局。
 */
function computeContainerRatio(params: {
    naturalW: number;
    naturalH: number;
    parentW: number;
    parentH: number;
    rootW: number;
    rootH: number;
    innerW: number;
    innerH: number;
    visualW: number;
    visualH: number;
    docClientW: number;
    docClientH: number;
    scalePaddingLeft: number;
    scalePaddingRight: number;
    scaleMax: number;
    layerReserveW: number;
    fitWidthReferencePx?: number;
}): number {
    const {
        naturalW,
        naturalH,
        parentW,
        parentH,
        rootW,
        rootH,
        innerW,
        innerH,
        visualW,
        visualH,
        docClientW,
        docClientH,
        scalePaddingLeft,
        scalePaddingRight,
        scaleMax,
        layerReserveW,
        fitWidthReferencePx,
    } = params;
    if (naturalW <= 0 || naturalH <= 0) return 1;
    if (parentW <= 0 || parentH <= 0) return 1;

    const parentAvailW = Math.max(1, parentW - scalePaddingLeft - scalePaddingRight);
    const parentAvailH = Math.max(1, parentH);

    const innerCapW = minPositive(innerW, visualW, docClientW) || parentAvailW;
    const innerCapH = minPositive(innerH, visualH, docClientH) || parentAvailH;

    const rootBudgetW =
        rootW > 0 ? Math.max(1, rootW - 2 * OUTER_GUTTER_PX - layerReserveW) : parentAvailW;
    const rootBudgetH = rootH > 0 ? Math.max(1, rootH - 2 * OUTER_GUTTER_PX) : parentAvailH;

    const budgetW = Math.min(parentAvailW, rootBudgetW, innerCapW);
    const budgetH = Math.min(parentAvailH, rootBudgetH, innerCapH);

    const nw = Math.max(1, naturalW);
    const nh = Math.max(1, naturalH);

    const wRat = budgetW / nw;
    const hRat = budgetH / nh;

    let raw: number;
    if (fitWidthReferencePx != null && fitWidthReferencePx > 0) {
        const denom = Math.max(nw, fitWidthReferencePx);
        raw = Math.min(scaleMax, budgetW / denom, hRat);
    } else {
        raw = Math.min(scaleMax, wRat, hRat);
    }

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
    alignTop: _alignTop = false,
    colorMode = false,
    keyColors = [],
    showActuation = false,
    onMouseDown,
    onMouseEnter,
    onMouseUp,
    fitToContainer = true,
    fitWidthReferencePx,
    scalePaddingLeft = 0,
    scalePaddingRight = 0,
    scaleMax = 1,
    scaleMin: _scaleMin = 0.2,
    showLayerOverlay = false,
    layerCount = 4,
    currentLayer = 0,
    onSelectLayer,
    onRestoreDefault,
}: TravelVirtualKeyboardProps) {
    void _scaleMin;
    void _alignTop;

    const ku = keyUnitPx;
    const kg = keyGapPx;
    const rootRef = useRef<HTMLDivElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [layoutSize, setLayoutSize] = useState({
        rootW: 0,
        rootH: 0,
        parentW: 0,
        parentH: 0,
        innerW: 0,
        innerH: 0,
        visualW: 0,
        visualH: 0,
        docClientW: 0,
        docClientH: 0,
    });

    const boardSizePx = useMemo(() => computeBoardSize(layoutKeys, patternKeys, ku, kg), [layoutKeys, patternKeys, ku, kg]);
    const naturalCard = useMemo(() => cardOuterSize(boardSizePx), [boardSizePx]);

    useLayoutEffect(() => {
        if (!fitToContainer) return;

        const root = rootRef.current;
        const el = viewportRef.current;
        const read = () => {
            const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
            const de = typeof document !== 'undefined' ? document.documentElement : undefined;
            const parentW = el ? Math.max(0, el.clientWidth) : 0;
            const innerW = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
            const visualW = vv?.width ?? 0;
            const docClientW = de?.clientWidth ?? 0;
            const rootW0 = root ? Math.max(0, root.clientWidth) : 0;
            setLayoutSize({
                rootW: rootW0,
                rootH: root ? Math.max(0, root.clientHeight) : 0,
                parentW,
                parentH: el ? Math.max(0, el.clientHeight) : 0,
                innerW,
                innerH: typeof window !== 'undefined' ? window.innerHeight || 0 : 0,
                visualW,
                visualH: vv?.height ?? 0,
                docClientW,
                docClientH: de?.clientHeight ?? 0,
            });
        };

        read();
        window.addEventListener('resize', read);
        const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
        vv?.addEventListener('resize', read);
        vv?.addEventListener('scroll', read);

        if (!root && !el) {
            return () => {
                window.removeEventListener('resize', read);
                vv?.removeEventListener('resize', read);
                vv?.removeEventListener('scroll', read);
            };
        }
        const ro = new ResizeObserver(read);
        if (root) ro.observe(root);
        if (el) ro.observe(el);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', read);
            vv?.removeEventListener('resize', read);
            vv?.removeEventListener('scroll', read);
        };
    }, [fitToContainer, scalePaddingLeft, scalePaddingRight]);

    const ratio = useMemo(() => {
        if (!fitToContainer) return 1;
        return computeContainerRatio({
            naturalW: naturalCard.w,
            naturalH: naturalCard.h,
            parentW: layoutSize.parentW,
            parentH: layoutSize.parentH,
            rootW: layoutSize.rootW,
            rootH: layoutSize.rootH,
            innerW: layoutSize.innerW,
            innerH: layoutSize.innerH,
            visualW: layoutSize.visualW,
            visualH: layoutSize.visualH,
            docClientW: layoutSize.docClientW,
            docClientH: layoutSize.docClientH,
            scalePaddingLeft,
            scalePaddingRight,
            scaleMax,
            layerReserveW: showLayerOverlay ? LAYER_COLUMN_RESERVE_W : 0,
            fitWidthReferencePx,
        });
    }, [
        fitToContainer,
        naturalCard,
        layoutSize,
        scalePaddingLeft,
        scalePaddingRight,
        scaleMax,
        showLayerOverlay,
        fitWidthReferencePx,
    ]);

    /** ticktype：`translateX((left - right) / 2 / ratio)` */
    const translateX = ratio > 0 ? (scalePaddingLeft - scalePaddingRight) / 2 / ratio : 0;
    const scaleTransform =
        ratio !== 1 || translateX !== 0 ? `scale(${ratio}, ${ratio}) translateX(${translateX}px)` : undefined;

    const keyboardStyle = useMemo(
        () => ({ width: `${boardSizePx.width}px`, height: `${boardSizePx.height}px` }),
        [boardSizePx]
    );

    const underPatterns = useMemo(() => patternKeys.filter((p) => (p.layer ?? 'under') === 'under'), [patternKeys]);
    const overPatterns = useMemo(() => patternKeys.filter((p) => p.layer === 'over'), [patternKeys]);

    return (
        <Box
            ref={rootRef}
            sx={{
                p: `${OUTER_GUTTER_PX}px`,
                position: 'relative',
                boxSizing: 'border-box',
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'stretch',
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: 0,
                maxWidth: '100%',
                overflow: 'hidden',
                transition: 'none',
                animation: 'none',
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
                        justifyContent: 'center',
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
                    maxWidth: '100%',
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    transition: 'none',
                    animation: 'none',
                }}
            >
                <Box
                    sx={{
                        flex: '0 0 auto',
                        flexShrink: 0,
                        transform: scaleTransform,
                        transformOrigin: 'left center',
                        backfaceVisibility: 'hidden',
                        WebkitBackfaceVisibility: 'hidden',
                        ...(scaleTransform ? { willChange: 'transform' } : {}),
                        transition: 'none',
                        animation: 'none',
                    }}
                >
                    <Box
                        onMouseUp={() => onMouseUp?.()}
                        onMouseLeave={() => onMouseUp?.()}
                        sx={{
                            position: 'relative',
                            borderRadius: '12px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            p: `${KEYBOARD_CARD_PADDING_PX}px`,
                            boxSizing: 'border-box',
                            transition: 'none',
                            animation: 'none',
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
                            ku={ku}
                            kg={kg}
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
