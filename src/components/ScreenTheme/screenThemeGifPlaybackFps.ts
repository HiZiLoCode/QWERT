/** 与 ScreenTheme 视频设置 VIDEO_SPEED_OPTIONS 的 value 对齐（不含 native，见 canvas 播放器） */
export function getScreenThemeGifPlaybackFps(speed: string): number {
  switch (speed) {
    case "15":
      return 15;
    case "30":
      return 30;
    case "60":
      return 60;
    case "typing":
      return 8;
    default:
      return 15;
  }
}

export function isNativeGifPlaybackSpeed(speed: string): boolean {
  return speed === "native";
}
