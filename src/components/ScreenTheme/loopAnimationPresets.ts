/** 内置循环动画（`public/screen-theme/`） */
export type LoopAnimationPresetId = "unicorn" | "red-black" | "gradient" | "coming-soon";

export type LoopAnimationPreset = {
  id: LoopAnimationPresetId;
  labelKey: string;
  /** `public/` 下 GIF 路径；`coming-soon` 无资源 */
  gifPath: string | null;
  disabled?: boolean;
};

export const LOOP_ANIMATION_PRESETS: LoopAnimationPreset[] = [
  { id: "unicorn", labelKey: "2943", gifPath: "/screen-theme/独角兽.gif" },
  { id: "red-black", labelKey: "2944", gifPath: "/screen-theme/红与黑.gif" },
  { id: "gradient", labelKey: "2945", gifPath: "/screen-theme/幻变.gif" },
  { id: "coming-soon", labelKey: "2946", gifPath: null, disabled: true },
];

export const DEFAULT_LOOP_ANIMATION_ID: LoopAnimationPresetId = "unicorn";

export function getLoopAnimationPresetById(id: LoopAnimationPresetId): LoopAnimationPreset | undefined {
  return LOOP_ANIMATION_PRESETS.find((p) => p.id === id);
}
