import type { KeyboardKey, LayoutKey } from "@/types/types_v1";

/** 将当前层的 userKeys 名称合并进布局键，供 TravelVirtualKeyboard 等与改键界面一致展示 */
export function mergeLayoutKeysWithUserKeyNames(
  layoutKeys: LayoutKey[],
  userKeys: KeyboardKey[] | undefined | null,
): LayoutKey[] {
  if (!layoutKeys.length || !userKeys?.length) return layoutKeys;
  return layoutKeys.map((k, idx) => {
    const keyIndex = k.index ?? idx;
    const userKey = userKeys[keyIndex] as (KeyboardKey & { icon?: string }) | undefined;
    const name = userKey?.name;
    const icon = userKey?.icon;
    return {
      ...k,
      name: name || k.name || "",
      icon: icon || k.icon || "",
    };
  });
}
