import type { SxProps, Theme } from "@mui/material/styles";
import { screenThemeColors } from "./theme";

export const SCREEN_THEME_SELECT_CORNER = "8px";

const SELECT_GLOW = "0 0 0 3px rgba(0, 102, 255, 0.22)";
const primary = screenThemeColors.primary;

export const screenThemeSelectSx: SxProps<Theme> = {
  borderRadius: SCREEN_THEME_SELECT_CORNER,
  fontSize: "14px",
  minHeight: "36px",
  color: screenThemeColors.textDark,
  backgroundColor: "#ffffff",
  transition: "box-shadow 0.2s ease, border-color 0.2s ease",
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: screenThemeColors.borderLight,
    borderWidth: "1px",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  },
  "&:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: primary,
    boxShadow: SELECT_GLOW,
  },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: primary,
    borderWidth: "1px",
    boxShadow: SELECT_GLOW,
  },
  "& .MuiSelect-select": {
    py: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },
  "& .MuiSelect-icon": {
    color: "rgba(100, 116, 139, 0.75)",
    transition: "color 0.2s ease",
  },
  "&:hover .MuiSelect-icon": {
    color: "rgba(0, 102, 255, 0.65)",
  },
  "&.Mui-focused .MuiSelect-icon": {
    color: primary,
  },
};

export const screenThemeSelectMenuPaperSx: SxProps<Theme> = {
  mt: 0.5,
  borderRadius: `0 0 ${SCREEN_THEME_SELECT_CORNER} ${SCREEN_THEME_SELECT_CORNER}`,
  border: `1px solid ${primary}`,
  borderTop: "none",
  boxShadow: "0 4px 14px rgba(15, 23, 42, 0.1)",
  bgcolor: "#fff",
  overflow: "hidden",
  "& .MuiMenu-list": { py: 0.5, px: 0.375 },
};

export const screenThemeSelectMenuProps = {
  PaperProps: { sx: screenThemeSelectMenuPaperSx },
  anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
  transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
};

export const screenThemeSelectMenuItemSx: SxProps<Theme> = {
  fontSize: "14px",
  minHeight: "32px",
  mx: 0.25,
  my: 0.125,
  borderRadius: SCREEN_THEME_SELECT_CORNER,
  color: screenThemeColors.textDark,
  bgcolor: "#ffffff",
  transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
  "&:hover": {
    bgcolor: "#ffffff",
    boxShadow: `inset 0 0 0 1px ${primary}`,
  },
  "&.Mui-selected": {
    bgcolor: primary,
    color: "#ffffff",
    "&:hover": {
      bgcolor: "rgba(0, 102, 255, 0.92)",
      color: "#ffffff",
      boxShadow: "none",
    },
  },
  "&.Mui-focusVisible": {
    bgcolor: "rgba(0, 102, 255, 0.08)",
  },
};
