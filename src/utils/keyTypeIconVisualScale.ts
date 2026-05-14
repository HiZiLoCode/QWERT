/**
 * 部分 `/KeyType/*.svg` 与 matrix 系列同尺寸 viewBox，但内绘比例偏小，在键帽/键池里会显得更小。
 * 返回略大于 1 的 scale，在渲染时用 `transform: scale(...)` 与 matrix 类图标对齐视觉重量。
 */
export function keyTypeIconVisualScale(iconSrc: string): number {
    const path = iconSrc.split('?')[0].split('#')[0];
    if (path.endsWith('/custom_batt_status.svg')) return 1.1;
    if (path.endsWith('/custom_kye_six_nch.svg')) return 1.1;
    if (path.endsWith('/custom_kye_macwin_toggle.svg')) return 1.1;
    if (path.endsWith('/custom_kye_win_lock_set.svg')) return 1.1;
    if (path.endsWith('/custom_kye_wasd_set.svg')) return 1.1;
    if (path.endsWith('/custom_kye_scak_delay_set.svg')) return 1.1;
    if (path.endsWith('/custom_toggle_wasd.svg')) return 1.1;
    if (path.endsWith('/custom_toggle_key_delay.svg')) return 1.1;
    if (path.endsWith('/custom_toggle_frow.svg')) return 1.1;
    return 1;
}
