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
};

export type CompositeLayoutKey = LayoutKey & {
    w2?: number;
    h2?: number;
    x2?: number;
    y2?: number;
};
