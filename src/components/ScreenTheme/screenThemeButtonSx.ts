import type { SxProps, Theme } from "@mui/material/styles";
import type { ScreenThemeVisualColors } from "./theme";

/** 药丸形圆角（足够大以保证常见高度下呈胶囊形） */
export const screenThemePillRadius = "12px";

/** 描边药丸：底/字随令牌；悬停主色描边 + 光晕 */
export function getScreenThemeOutlinedPillButtonSx(
  sv: ScreenThemeVisualColors
): SxProps<Theme> {
  return {
    textTransform: "none",
    borderRadius: screenThemePillRadius,
    minHeight: "36px",
    px: "20px",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.2,
    color: sv.textDark,
    backgroundColor: sv.pillOutlinedBg,
    border: `1px solid ${sv.borderLight}`,
    boxShadow: "none",
    "&:hover": {
      border: `1px solid ${sv.primary}`,
      borderColor: sv.primary,
    },
    "&.Mui-disabled": {
      borderColor: sv.primarySoft,
      color: sv.textMuted,
    },
  };
}

/** 实心药丸：主色底、白字、主色投影 */
export function getScreenThemeFilledPillButtonSx(
  sv: ScreenThemeVisualColors
): SxProps<Theme> {
  return {
    textTransform: "none",
    borderRadius: screenThemePillRadius,
    minHeight: "36px",
    px: "20px",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.2,
    color: "#fff",
    backgroundColor: sv.primary,
    border: `1px solid ${sv.primary}`,
    boxShadow: sv.filledShadow,
    "&:hover": {
      backgroundColor: sv.primaryHover,
      borderColor: sv.primaryHover,
      boxShadow: sv.filledShadowHover,
    },
  };
}
