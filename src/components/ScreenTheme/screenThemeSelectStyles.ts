import type { SxProps, Theme } from "@mui/material/styles";
import type { ScreenThemeVisualColors } from "./theme";

export const SCREEN_THEME_SELECT_CORNER = "8px";

function selectGlow(sv: ScreenThemeVisualColors) {
  return `0 0 0 3px ${sv.primaryGlow}`;
}

export function getScreenThemeSelectSx(sv: ScreenThemeVisualColors): SxProps<Theme> {
  const glow = selectGlow(sv);
  return {
    borderRadius: SCREEN_THEME_SELECT_CORNER,
    fontSize: "14px",
    minHeight: "36px",
    color: sv.textDark,
    backgroundColor: sv.selectBg,
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: sv.borderLight,
      borderWidth: "1px",
      transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    },
    "&:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: sv.primary,
      boxShadow: glow,
    },
    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: sv.primary,
      borderWidth: "1px",
      boxShadow: glow,
    },
    "& .MuiSelect-select": {
      py: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    },
    "& .MuiSelect-icon": {
      color: sv.textMuted,
      transition: "color 0.2s ease",
    },
    "&:hover .MuiSelect-icon": {
      color: sv.primary,
    },
    "&.Mui-focused .MuiSelect-icon": {
      color: sv.primary,
    },
  };
}

export function getScreenThemeSelectMenuPaperSx(
  sv: ScreenThemeVisualColors
): SxProps<Theme> {
  return {
    mt: 0.5,
    borderRadius: `0 0 ${SCREEN_THEME_SELECT_CORNER} ${SCREEN_THEME_SELECT_CORNER}`,
    border: `1px solid ${sv.primary}`,
    borderTop: "none",
    boxShadow: "0 4px 14px rgba(15, 23, 42, 0.12)",
    bgcolor: sv.selectBg,
    overflow: "hidden",
    "& .MuiMenu-list": { py: 0.5, px: 0.375 },
  };
}

export function getScreenThemeSelectMenuProps(sv: ScreenThemeVisualColors) {
  return {
    PaperProps: { sx: getScreenThemeSelectMenuPaperSx(sv) },
    anchorOrigin: { vertical: "bottom" as const, horizontal: "left" as const },
    transformOrigin: { vertical: "top" as const, horizontal: "left" as const },
  };
}

export function getScreenThemeSelectMenuItemSx(
  sv: ScreenThemeVisualColors
): SxProps<Theme> {
  return {
    fontSize: "14px",
    minHeight: "32px",
    mx: 0.25,
    my: 0.125,
    borderRadius: SCREEN_THEME_SELECT_CORNER,
    color: sv.textDark,
    bgcolor: sv.selectBg,
    transition:
      "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
    "&:hover": {
      bgcolor: sv.selectBg,
      boxShadow: `inset 0 0 0 1px ${sv.primary}`,
    },
    "&.Mui-selected": {
      bgcolor: sv.primary,
      color: "#ffffff",
      "&:hover": {
        bgcolor: sv.primaryHover,
        color: "#ffffff",
        boxShadow: "none",
      },
    },
    "&.Mui-focusVisible": {
      bgcolor: sv.selectFocusBg,
    },
  };
}
