import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

/**
 * 设置页「系统设置」里 Row 的标题/说明样式；「固件升级」Tab 下卡片与之对齐。
 * 浅色为固定色；深色用主题白字透明度，与灯光/点阵面板一致。
 */
const LIGHT_TITLE = { fontSize: '18px', color: '#5d6f8a', fontWeight: 600 } as const;
const LIGHT_DESC = { fontSize: '14px', color: '#8a98ad', lineHeight: 1.55 } as const;
const LIGHT_LIST = { m: 0, pl: '20px', color: '#8a98ad', fontSize: '14px', lineHeight: 1.55 } as const;

export const settingsRowTitleSx = LIGHT_TITLE;
export const settingsRowDescriptionSx = LIGHT_DESC;
export const settingsRowListUlSx = LIGHT_LIST;

export function getSettingsRowTitleSx(theme: Theme) {
    return theme.palette.mode === 'dark'
        ? { fontSize: '18px', color: alpha(theme.palette.common.white, 0.88), fontWeight: 600 }
        : LIGHT_TITLE;
}

export function getSettingsRowDescriptionSx(theme: Theme) {
    return theme.palette.mode === 'dark'
        ? { fontSize: '14px', color: alpha(theme.palette.common.white, 0.55), lineHeight: 1.55 }
        : LIGHT_DESC;
}

export function getSettingsRowListUlSx(theme: Theme) {
    return theme.palette.mode === 'dark'
        ? { m: 0, pl: '20px', color: alpha(theme.palette.common.white, 0.55), fontSize: '14px', lineHeight: 1.55 }
        : LIGHT_LIST;
}
