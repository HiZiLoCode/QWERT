/**
 * 预留：虚拟键盘缩放已改为与 ticktype 一致的 `min(budgetW/naturalW, budgetH/naturalH, scaleMax)`，
 * 本文件不再被 TravelVirtualKeyboard 引用。若日后要恢复按屏宽分档策略，可在此维护类型与常量。
 */
export type KeyboardFitWidthBreakpoint = {
    minWidth: number;
    scaleBelowWidth: number;
};

/** @deprecated 当前未接入组件 */
export const KEYBOARD_FIT_WIDTH_BREAKPOINTS: KeyboardFitWidthBreakpoint[] = [
    { minWidth: 3840, scaleBelowWidth: 2800 },
    { minWidth: 2560, scaleBelowWidth: 2200 },
    { minWidth: 1920, scaleBelowWidth: 1800 },
    { minWidth: 1600, scaleBelowWidth: 1480 },
    { minWidth: 1366, scaleBelowWidth: 1280 },
    { minWidth: 0, scaleBelowWidth: 1120 },
];
