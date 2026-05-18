import type { SxProps, Theme } from "@mui/material/styles";

/**
 * 加宽 WebKit 滚动条、配 Firefox scrollbar-color，避免系统「极细条」难拖。
 * 用于设置侧栏、屏幕主题工作区等纵向滚动容器。
 */
export function getComfortableScrollbarSx(isDark: boolean): SxProps<Theme> {
  const thumb = isDark ? "rgba(249, 115, 22, 0.55)" : "rgba(90, 115, 150, 0.45)";
  const thumbHover = isDark ? "rgba(251, 146, 60, 0.85)" : "rgba(55, 85, 130, 0.6)";
  const track = isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(15, 23, 42, 0.06)";

  return {
    scrollbarGutter: "stable",
    /** Firefox：不用 thin，保留系统默认宽度更易点 */
    scrollbarWidth: "auto",
    scrollbarColor: `${thumb} ${track}`,
    WebkitOverflowScrolling: "touch",
    "&::-webkit-scrollbar": {
      width: 14,
      height: 14,
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: track,
      borderRadius: 10,
      marginBlock: 4,
    },
    "&::-webkit-scrollbar-thumb": {
      borderRadius: 10,
      backgroundColor: thumb,
      /** 透明边扩大可拖动热区（视觉上仍较圆） */
      border: "3px solid transparent",
      backgroundClip: "content-box",
      minHeight: 40,
    },
    "&::-webkit-scrollbar-thumb:hover": {
      backgroundColor: thumbHover,
    },
    "&::-webkit-scrollbar-corner": {
      backgroundColor: "transparent",
    },
  };
}
