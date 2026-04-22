import type { LayoutKey } from '@/types/types_v1';

export type PatternKey = {
    id?: string;
    type?: 'knob' | 'volume' | 'scrollArea' | 'functionPanel';
    layer?: 'under' | 'over';
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    style?: {
        lineYPercent?: number;
        circleSizePercent?: number;
        circleLeftPercent?: number;
        circleTopPercent?: number;
        innerSquare?: boolean;
        barCount?: number;
        buttons?: string[];
        smallCircleCount?: number;
        circlesOutside?: boolean;
        panelCircleSizeRem?: number;
        panelCircleGapRem?: number;
        panelCircleBorderColor?: string;
        panelCircleBorderColors?: string[];
        topBarWidthPercent?: number;
        matrixRows?: number;
        matrixCols?: number;
        matrixAreaWidthPercent?: number;
        matrixScreenWidthPercent?: number;
        matrixDotGapRem?: number;
        screenCount?: number;
        bottomButtonCount?: number;
    };
};

export type TravelVirtualKeyboardProps = {
    layoutKeys: LayoutKey[];
    patternKeys?: PatternKey[];
    travelKeys: any[];
    selectedKeys: number[];
    travelValue: number;
    onToggleKey: (keyIndex: number) => void;
    keyUnitPx?: number;
    keyGapPx?: number;
    alignTop?: boolean;
    colorMode?: boolean;
    keyColors?: string[];
    showActuation?: boolean;
    onMouseDown?: (keyIndex: number) => void;
    onMouseEnter?: (keyIndex: number) => void;
    onMouseUp?: () => void;
    fitToContainer?: boolean;
    /**
     * 可选：横向分母改为 `max(键区外卡宽, fitWidthReferencePx)` 再参与 ticktype 式 `min(budgetW/denom, budgetH/naturalH, scaleMax)`。
     * 默认不传，与 ticktype 完全一致。
     */
    fitWidthReferencePx?: number;
    scalePaddingLeft?: number;
    scalePaddingRight?: number;
    scaleMax?: number;
    scaleMin?: number;
    fitByHeight?: boolean;
    showLayerOverlay?: boolean;
    layerCount?: number;
    currentLayer?: number;
    onSelectLayer?: (layer: number) => void;
    onRestoreDefault?: () => void;
    /** 屏幕主题等场景：指定键橙色高亮 + Tooltip */
    demoHighlightKeyIndex?: number;
    demoHighlightTitle?: string;
    /** 可选：按键右下角角标（如测试次数） */
    keyBadges?: Record<number, string | number>;
};

export type CompositeLayoutKey = LayoutKey & {
    w2?: number;
    h2?: number;
    x2?: number;
    y2?: number;
};
