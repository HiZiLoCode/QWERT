import type { KeyboardKey, LayoutKey } from "@/types/types_v1";

/** 将当前层的 userKeys 名称合并进布局键，供 TravelVirtualKeyboard 等与改键界面一致展示 */
export function mergeLayoutKeysWithUserKeyNames(
  layoutKeys: LayoutKey[],
  userKeys: KeyboardKey[] | undefined | null,
): LayoutKey[] {
  if (!layoutKeys.length || !userKeys?.length) return layoutKeys;
  return layoutKeys.map((k, idx) => {
    const keyIndex = k.index ?? idx;
    const name = userKeys[keyIndex]?.name;
    return {
      ...k,
      name: name || k.name || "",
    };
  });
}
