import type { KeyboardKey, LayoutKey } from "@/types/types_v1";

function isAssetIconPath(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  return v.includes("/KeyType/") || v.endsWith(".svg") || v.endsWith(".png");
}

/** 将当前层的 userKeys 名称合并进布局键，供 TravelVirtualKeyboard 等与改键界面一致展示 */
export function mergeLayoutKeysWithUserKeyNames(
  layoutKeys: LayoutKey[],
  userKeys: KeyboardKey[] | undefined | null,
): LayoutKey[] {
  if (!layoutKeys.length || !userKeys?.length) return layoutKeys;
  return layoutKeys.map((k, idx) => {
    const keyIndex = k.index ?? idx;
    const userKey = userKeys[keyIndex] as (KeyboardKey & { icon?: string }) | undefined;
    const rawName = userKey?.name;
    const rawIcon = userKey?.icon;
    const nameIsIconPath = isAssetIconPath(rawName);
    const icon = rawIcon || (nameIsIconPath ? rawName : "");
    const name = nameIsIconPath ? "" : rawName;
    return {
      ...k,
      name: name || k.name || "",
      icon: icon || k.icon || "",
    };
  });
}
