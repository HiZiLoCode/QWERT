import type { SxProps, Theme } from "@mui/material/styles";
import { screenThemeColors } from "./theme";

/** 药丸形圆角（足够大以保证常见高度下呈胶囊形） */
export const screenThemePillRadius = "12px";

const primary = screenThemeColors.primary;

/** 描边药丸：白底、主色描边、深灰字；悬停浅蓝光晕 */
export const screenThemeOutlinedPillButtonSx: SxProps<Theme> = {
  textTransform: "none",
  borderRadius: screenThemePillRadius,
  minHeight: "36px",
  px: "20px",
  fontSize: "14px",
  fontWeight: 500,
  lineHeight: 1.2,
  color: screenThemeColors.textDark,
  boxShadow: "none",
  "&:hover": {
    border: `1px solid ${primary}`,
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
  minHeight: "36px",
  px: "20px",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1.2,
  color: "#fff",
  backgroundColor: primary,
  border: `1px solid ${primary}`,
  boxShadow: "0 4px 12px rgba(0, 102, 255, 0.38)",
  "&:hover": {
    backgroundColor: "rgba(0, 102, 255, 0.92)",
    borderColor: "rgba(0, 102, 255, 0.92)",
    boxShadow: "0 5px 14px rgba(0, 102, 255, 0.45)",
  },
};
