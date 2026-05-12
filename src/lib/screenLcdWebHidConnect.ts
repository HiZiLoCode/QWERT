import type { FilterDevice } from '@/types/types';

/** 与动效页 HomePage、设置页 ScreenFirmwareChangelogSection 一致 */
export const SCREEN_LCD_WEBHID_FILTER: FilterDevice[] = [{ usagePage: 0x00ff, usage: 0x0001 }];

export type KeyboardForScreenLcdConnect = {
  checkLightStatus(): Promise<{ status?: boolean } | null | undefined>;
  lightOn(): void | Promise<unknown>;
};

export type ScreenLcdConnectUi = {
  setOpening?: (opening: boolean) => void;
  setConnecting?: (connecting: boolean) => void;
  /** 进入亮屏等待前调用（如重置「正在打开设备…」动画点） */
  onStartLightSequence?: () => void;
};

/**
 * 先读亮屏状态；已亮则直接 WebHID 连屏；否则 lightOn + 等待 2s 再连（与 HomePage / 固件说明区相同）。
 */
export async function connectScreenLcdWebHid(
  connectDevice: (filter: FilterDevice[] | undefined) => Promise<boolean>,
  keyboard?: KeyboardForScreenLcdConnect | null,
  ui?: ScreenLcdConnectUi
): Promise<boolean> {
  const runHid = async () => {
    ui?.setConnecting?.(true);
    try {
      return await connectDevice(SCREEN_LCD_WEBHID_FILTER);
    } finally {
      ui?.setConnecting?.(false);
    }
  };
  if (keyboard) {
    try {
      const status = await keyboard.checkLightStatus();
      if (status?.status) return await runHid();
    } catch {
      /* 读失败则走亮屏流程 */
    }
    ui?.onStartLightSequence?.();
    ui?.setOpening?.(true);
    try {
      void keyboard.lightOn();
      await new Promise<void>((r) => setTimeout(r, 2000));
      return await runHid();
    } finally {
      ui?.setOpening?.(false);
    }
  }
  return await runHid();
}
