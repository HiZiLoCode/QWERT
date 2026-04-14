import type { LayoutKey } from "@/types/types_v1";

/** 用于屏幕主题演示：左 Shift 橙色高亮（优先最靠左的 Shift） */
export function findLeftShiftKeyIndex(layoutKeys: LayoutKey[]): number {
  let bestIdx = -1;
  let bestX = Infinity;
  layoutKeys.forEach((k, idx) => {
    const raw = (k.name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
    if (!raw.includes("shift")) return;
    if (raw.includes("right") || raw === "rshift" || raw.startsWith("r shift")) return;
    const x = k.x ?? 0;
    if (x < bestX) {
      bestX = x;
      bestIdx = k.index ?? idx;
    }
  });
  return bestIdx;
}
