import type { Theme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";

/** 灯光 / 点阵屏三栏玻璃卡：浅色保持原样，深色为纸色底 + primary 橙描边 */
export function lightingPanelCardSx(theme: Theme) {
  const isDark = theme.palette.mode === "dark";
  if (!isDark) {
    return {
      borderRadius: "14px",
      border: "1px solid rgba(153,169,191,0.22)",
      background: "rgba(255,255,255,0.42)",
      backdropFilter: "blur(6px)",
      boxSizing: "border-box" as const,
    };
  }
  return {
    borderRadius: "14px",
    border: `1px solid ${alpha(theme.palette.primary.main, 0.48)}`,
    background: theme.palette.background.paper,
    backdropFilter: "none",
    boxSizing: "border-box" as const,
  };
}

/** 设置页固件 / 驱动 / 屏幕固件说明卡片（与灯光卡同系，圆角略小） */
export function settingsFirmwareCardSx(theme: Theme) {
  const isDark = theme.palette.mode === "dark";
  const base = lightingPanelCardSx(theme);
  return {
    ...base,
    borderRadius: "12px",
    px: "20px",
    py: "18px",
    boxShadow: isDark ? "0 1px 12px rgba(0,0,0,0.35)" : "0 1px 3px rgba(15, 23, 42, 0.06)",
  };
}

export function lightingGroupTitleSx(theme: Theme) {
  return theme.palette.mode === "dark"
    ? {
        fontSize: "18px",
        fontWeight: 500,
        color: alpha(theme.palette.common.white, 0.62),
        letterSpacing: "0.4px",
      }
    : {
        fontSize: "18px",
        fontWeight: 500,
        color: "rgba(100, 116, 139, 1)",
        letterSpacing: "0.4px",
      };
}

export function lightingSectionLabelSx(theme: Theme) {
  return theme.palette.mode === "dark"
    ? { fontSize: "16px", color: alpha(theme.palette.common.white, 0.78), fontWeight: 700 }
    : { fontSize: "16px", color: "#5f7089", fontWeight: 700 };
}

export function lightingSliderSx(theme: Theme, opts?: { thumbWidth?: number }) {
  const P = theme.palette.primary.main;
  const isDark = theme.palette.mode === "dark";
  const rail = isDark ? alpha("#fff", 0.12) : "#ECEFF4";
  const thumbBorder = isDark ? theme.palette.background.paper : "#fff";
  const w = opts?.thumbWidth ?? 32;
  return {
    color: P,
    "& .MuiSlider-rail": {
      backgroundColor: rail,
      opacity: 1,
      height: "12px",
      borderRadius: "999px",
    },
    "& .MuiSlider-track": { height: "12px", borderRadius: "999px", border: "none" },
    "&:hover .MuiSlider-track, &.Mui-focusVisible .MuiSlider-track, & .MuiSlider-thumb.Mui-active + .MuiSlider-track": {
      border: `1px solid ${P}`,
    },
    "& .MuiSlider-thumb": {
      width: `${w}px`,
      height: "32px",
      border: `4px solid ${thumbBorder}`,
      boxShadow: `0 2px 8px ${alpha(P, 0.45)}`,
    },
  };
}

export function lightingEffectButtonSx(theme: Theme, active: boolean) {
  const P = theme.palette.primary.main;
  const isDark = theme.palette.mode === "dark";
  const inactiveColor = isDark ? alpha(theme.palette.common.white, 0.72) : "#5f7089";
  const inactiveBg = isDark ? alpha("#fff", 0.06) : "transparent";
  return {
    height: "34px",
    borderRadius: "8px",
    fontSize: "15px",
    textTransform: "none" as const,
    fontWeight: 500,
    color: active ? "#fff" : inactiveColor,
    backgroundColor: active ? P : inactiveBg,
    "&:hover": {
      border: `1px solid ${P}`,
      boxShadow: `0 2px 8px ${alpha(P, 0.35)}`,
    },
  };
}

export function lightingToggleGridButtonSx(theme: Theme, active: boolean) {
  const P = theme.palette.primary.main;
  const isDark = theme.palette.mode === "dark";
  const inactiveColor = isDark ? alpha(theme.palette.common.white, 0.72) : "#5f7089";
  const inactiveBg = isDark ? alpha("#fff", 0.08) : "rgba(255,255,255,.35)";
  return {
    height: "36px",
    borderRadius: "8.8px",
    fontSize: "15px",
    textTransform: "none" as const,
    color: active ? "#fff" : inactiveColor,
    backgroundColor: active ? P : inactiveBg,
    "&:hover": {
      border: `1px solid ${P}`,
      boxShadow: `0 2px 8px ${alpha(P, 0.35)}`,
    },
  };
}

export function lightingPercentMutedSx(theme: Theme) {
  return theme.palette.mode === "dark"
    ? { color: alpha(theme.palette.common.white, 0.45), fontSize: "20px", fontWeight: 600 }
    : { color: "#94A3B8", fontSize: "20px", fontWeight: 600 };
}

export function lightingBrightnessInputSx(theme: Theme) {
  const isDark = theme.palette.mode === "dark";
  return {
    ml: 10,
    width: "50px",
    height: "32px",
    borderRadius: "8px",
    border: isDark ? `1px solid ${alpha(theme.palette.primary.main, 0.35)}` : "1px solid #E2E8F0",
    textAlign: "center",
    color: isDark ? alpha(theme.palette.common.white, 0.88) : "#64748b",
    fontSize: "15px",
    fontWeight: 600,
    outline: "none",
    backgroundColor: isDark ? theme.palette.background.paper : "#fff",
  };
}
