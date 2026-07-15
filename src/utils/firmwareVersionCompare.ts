/**
 * 固件展示版本是否落后于目标包（仅用于更新提示、changelog 高亮等）。
 * 版本串为界面展示用十进制数字（屏：firmware_version 转 hex 后如 "114"、"118"；键盘同理）。
 */
export function isFirmwareVersionBehind(
  currentDisplay: string | undefined | null,
  targetDisplay: string | undefined | null,
): boolean {
  const cur = parseInt(String(currentDisplay ?? '').trim(), 10);
  const tgt = parseInt(String(targetDisplay ?? '').trim(), 10);
  if (!Number.isFinite(cur) || !Number.isFinite(tgt) || tgt <= 0) return false;
  return cur < tgt;
}

/**
 * 固件展示版本是否可 OTA 至目标包（设置页主动升级 / 同版本重刷）。
 * 当前 ≤ 目标时可升级，含同版本重刷（118 → 118）。
 */
export function isFirmwareVersionUpgradeable(
  currentDisplay: string | undefined | null,
  targetDisplay: string | undefined | null,
): boolean {
  const cur = parseInt(String(currentDisplay ?? '').trim(), 10);
  const tgt = parseInt(String(targetDisplay ?? '').trim(), 10);
  if (!Number.isFinite(cur) || !Number.isFinite(tgt) || tgt <= 0) return false;
  return cur <= tgt;
}
