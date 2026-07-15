import type { LayoutKey } from '@/types/types_v1';
import type { MatrixKeyInfo } from '@/utils/keyLabelUtils';
import { qmkCodeStringToHidUsage } from '@/utils/keyLabelUtils';

const VISUAL_X_EPS = 0.02;
const VISUAL_Y_EPS = 0.5;

/** 91683 物理布局 row/col 与 QMK 矩阵坐标不同，用 x/y/w 对齐 */
export function findQmkKeyByVisualPosition(
  qmkLayer: MatrixKeyInfo[],
  layoutKey: Pick<LayoutKey, 'x' | 'y' | 'w' | 'h'>,
): MatrixKeyInfo | null {
  const x = layoutKey.x ?? 0;
  const y = layoutKey.y ?? 0;
  const w = layoutKey.w ?? 1;

  let best: MatrixKeyInfo | null = null;
  let bestScore = Infinity;

  for (const k of qmkLayer) {
    if (Math.abs(k.x - x) > VISUAL_X_EPS) continue;
    const score = Math.abs(k.y - y) + Math.abs(k.w - w) * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }

  if (best && bestScore <= VISUAL_Y_EPS + Math.abs(w - 1) * 0.05) {
    return best;
  }
  return null;
}

function resolveQmkKeyForLayoutKey(
  qmkLayer: MatrixKeyInfo[],
  layoutKey: Pick<LayoutKey, 'row' | 'col' | 'x' | 'y' | 'w' | 'h'>,
): MatrixKeyInfo | null {
  if (layoutKey.x != null && layoutKey.y != null) {
    const byVisual = findQmkKeyByVisualPosition(qmkLayer, layoutKey);
    if (byVisual) return byVisual;
  }
  if (layoutKey.row != null && layoutKey.col != null) {
    return qmkLayer.find((k) => k.row === layoutKey.row && k.col === layoutKey.col) ?? null;
  }
  return null;
}

/** 加载 91683 物理布局（含 HID code），供 QMK 测试按键使用 */
export async function loadPhysicalLayoutKeys(layoutStem: string): Promise<LayoutKey[]> {
  const stem = layoutStem.trim();
  if (!stem) return [];
  try {
    const mod = await import(`@/data/keyboardLayout/${stem}.json`);
    const keys = (mod.default?.layouts?.keys ?? mod.layouts?.keys) as LayoutKey[] | undefined;
    return Array.isArray(keys) ? keys : [];
  } catch {
    return [];
  }
}

/** 保留物理布局的 code/index/几何，叠加 QMK 层 0 键名 */
export function mergePhysicalLayoutWithQmkLayer(
  physicalKeys: LayoutKey[],
  qmkLayer: MatrixKeyInfo[],
): LayoutKey[] {
  if (!physicalKeys.length) return physicalKeys;
  return physicalKeys.map((pk, idx) => {
    const qmk = resolveQmkKeyForLayoutKey(qmkLayer, pk);
    return {
      ...pk,
      index: pk.index ?? idx,
      name: qmk?.name || qmk?.code || pk.name || '',
    };
  });
}

/** 将 QMK 单层按键（buildMatrixKeyInfo 输出）转为 TravelVirtualKeyboard 使用的 LayoutKey */
export function qmkLayerToLayoutKeys(layerKeys: MatrixKeyInfo[]): LayoutKey[] {
  return layerKeys.map((k, idx) => {
    const hid = qmkCodeStringToHidUsage(k.code);
    return {
      x: k.x,
      y: k.y,
      w: k.w,
      h: k.h,
      row: k.row,
      col: k.col,
      index: idx,
      name: k.name || k.code || '',
      ...(hid != null ? { code: hid } : {}),
    };
  });
}

/** 切层时同步键帽显示文字（几何不变，按 row/col 对齐 QMK 层） */
export function syncLayoutKeyNamesFromQMKLayer(
  layoutKeys: LayoutKey[],
  qmkLayer: MatrixKeyInfo[],
): LayoutKey[] {
  if (!layoutKeys.length || !qmkLayer.length) return layoutKeys;
  return layoutKeys.map((k) => {
    const qmk = resolveQmkKeyForLayoutKey(qmkLayer, k);
    return {
      ...k,
      name: qmk?.name || qmk?.code || k.name || '',
    };
  });
}

/** 按选中 index 解析布局键（91683 物理布局 index 与数组下标常不一致） */
export function resolveLayoutKeyAtSelectIndex(
  layoutKeys: LayoutKey[],
  selectIndex: number,
): LayoutKey | null {
  if (selectIndex < 0 || !layoutKeys.length) return null;
  const byIndexField = layoutKeys.find((k) => k.index === selectIndex);
  if (byIndexField) return byIndexField;
  if (selectIndex < layoutKeys.length) return layoutKeys[selectIndex];
  return null;
}

/** 按物理布局键位 row/col 在 QMK 层中查找（避免 layout index 与 QMK 数组下标不一致） */
export function findQmkKeyInLayer(
  qmkLayer: MatrixKeyInfo[] | undefined | null,
  layoutKey: Pick<LayoutKey, 'row' | 'col' | 'x' | 'y' | 'w' | 'h'> | undefined | null,
  fallbackIndex?: number,
): MatrixKeyInfo | null {
  if (!qmkLayer?.length || !layoutKey) return null;

  const hit = resolveQmkKeyForLayoutKey(qmkLayer, layoutKey);
  if (hit) return hit;

  if (
    fallbackIndex != null &&
    fallbackIndex >= 0 &&
    fallbackIndex < qmkLayer.length
  ) {
    return qmkLayer[fallbackIndex];
  }
  return null;
}

export function findQmkKeyIndexInLayer(
  qmkLayer: MatrixKeyInfo[] | undefined | null,
  row: number,
  col: number,
): number {
  if (!qmkLayer?.length) return -1;
  return qmkLayer.findIndex((k) => k.row === row && k.col === col);
}

/** QMK 模式下解析供 UI 展示的 layoutKeys */
export function resolveQMKDisplayLayoutKeys(
  layoutKeys: LayoutKey[],
  allQMKLayers: MatrixKeyInfo[][] | undefined | null,
  layer: number,
): LayoutKey[] {
  if (!layoutKeys.length) return layoutKeys;
  return syncLayoutKeyNamesFromQMKLayer(layoutKeys, allQMKLayers?.[layer] ?? []);
}
