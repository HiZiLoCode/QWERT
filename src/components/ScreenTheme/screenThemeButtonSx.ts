import type { SxProps, Theme } from "@mui/material/styles";
import { screenThemeColors } from "./theme";

/** 药丸形圆角（足够大以保证常见高度下呈胶囊形） */
export const screenThemePillRadius = ".75rem";

const primary = screenThemeColors.primary;

/** 描边药丸：白底、主色描边、深灰字；悬停浅蓝光晕 */
export const screenThemeOutlinedPillButtonSx: SxProps<Theme> = {
  textTransform: "none",
  borderRadius: screenThemePillRadius,
  minHeight: "2.25rem",
  px: "1.25rem",
  fontSize: "0.875rem",
  fontWeight: 500,
  lineHeight: 1.2,
  color: screenThemeColors.textDark,
  boxShadow: "none",
  "&:hover": {
    border: `0.0625rem solid ${primary}`,
    borderColor: primary,
  },
  "&.Mui-disabled": {
    borderColor: "rgba(0, 102, 255, 0.35)",
    color: screenThemeColors.textMuted,
  },
};

/** 实心药丸：主色底、白字、蓝色投影（选中 / 完成态） */
export const screenThemeFilledPillButtonSx: SxProps<Theme> = {
  textTransform: "none",
  borderRadius: screenThemePillRadius,
  minHeight: "2.25rem",
  px: "1.25rem",
  fontSize: "0.875rem",
  fontWeight: 600,
  lineHeight: 1.2,
  color: "#fff",
  backgroundColor: primary,
  border: `0.0625rem solid ${primary}`,
  boxShadow: "0 0.25rem 0.75rem rgba(0, 102, 255, 0.38)",
  "&:hover": {
    backgroundColor: "rgba(0, 102, 255, 0.92)",
    borderColor: "rgba(0, 102, 255, 0.92)",
    boxShadow: "0 0.3125rem 0.875rem rgba(0, 102, 255, 0.45)",
  },
};
