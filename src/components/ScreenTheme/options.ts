import type { TransitionKind } from "./types";

export const TRANSITION_OPTIONS: { value: TransitionKind; labelKey: string }[] = [
  { value: "none", labelKey: "1614" },
  { value: "ttb", labelKey: "1615" },
  { value: "btt", labelKey: "1616" },
  { value: "ltr", labelKey: "1617" },
  { value: "rtl", labelKey: "1618" },
];

export const INTERVAL_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "3", labelKey: "2536" },
  { value: "5", labelKey: "1620" },
  { value: "10", labelKey: "1621" },
  { value: "30", labelKey: "1623" },
  { value: "60", labelKey: "2537" },
  { value: "180", labelKey: "2538" },
];

/** 导入视频：播放速度 / 帧率（native = 按 GIF 内嵌帧延时） */
export const VIDEO_SPEED_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "native", labelKey: "1642" },
  { value: "15", labelKey: "1638" },
  { value: "30", labelKey: "1639" },
  { value: "60", labelKey: "1640" },
];
