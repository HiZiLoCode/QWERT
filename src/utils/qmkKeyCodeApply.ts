import { getKeycodes, type IKeycode } from '@/utils/key-to-byte/qmk_keyCode';
import type { MatrixKeyInfo } from '@/utils/keyLabelUtils';
import { buildMatrixKeyInfo, setCustomKeycodes } from '@/utils/keyLabelUtils';
import { keycodeFromAnyInput } from '@/utils/qmkAnyKeycode';

/** code 字符串 → 16-bit QMK keycode（与 VIA getByteForCode / ANY 弹窗一致） */
export function codeToNumber(code: string, keyDict: Record<string, number>): number {
  return keycodeFromAnyInput(code, keyDict)?.keycode ?? 0;
}

export function hidModMaskToQmkKeycode(modifierMask: number, mainKeyCode: number): number {
  let qmkMod = 0;
  if (modifierMask & 0x01) qmkMod |= 0x0100;
  if (modifierMask & 0x02) qmkMod |= 0x0200;
  if (modifierMask & 0x04) qmkMod |= 0x0400;
  if (modifierMask & 0x08) qmkMod |= 0x0800;
  if (modifierMask & 0x10) qmkMod |= 0x1100;
  if (modifierMask & 0x20) qmkMod |= 0x1200;
  if (modifierMask & 0x40) qmkMod |= 0x1400;
  if (modifierMask & 0x80) qmkMod |= 0x1800;
  return qmkMod | (mainKeyCode & 0xff);
}

import type { LayoutKey } from '@/types/types_v1';
import { findQmkKeyInLayer, resolveLayoutKeyAtSelectIndex } from '@/utils/qmkLayoutBridge';

export function getSelectedQMKKeyInfo(
  allQMKLayers: MatrixKeyInfo[][] | undefined | null,
  layer: number,
  selectIndex: number,
  layoutKeys?: LayoutKey[] | null,
): MatrixKeyInfo | null {
  if (selectIndex < 0) return null;
  const qmkLayer = allQMKLayers?.[layer];
  if (!qmkLayer?.length) return null;

  const layoutKey = resolveLayoutKeyAtSelectIndex(layoutKeys ?? [], selectIndex);
  return findQmkKeyInLayer(qmkLayer, layoutKey, selectIndex);
}

export function buildQMKCustomKeycodes(
  customKeycodes: Array<{ name: string; title: string; shortName: string }> | undefined,
): IKeycode[] {
  return (customKeycodes ?? []).map((k, i) => ({
    name: k.shortName ?? k.name,
    shortName: k.shortName ?? k.name,
    code: `CUSTOM(${i})`,
    title: k.title ?? k.name,
  }));
}

/** 构建 QMK 键码菜单（与 drive_app QMKKeyCodeSetting 一致） */
export function buildQMKKeycodeMenus(customKeycodes: IKeycode[]) {
  const base = getKeycodes(16).filter((m) => {
    if (m.id === 'wt_lighting') return false;
    if (m.id === 'custom') return false;
    return true;
  });
  if (customKeycodes.length > 0) {
    base.push({ id: 'custom', label: 'Custom', keycodes: customKeycodes });
  }
  return base;
}

export function flattenQMKKeycodes(menus: ReturnType<typeof buildQMKKeycodeMenus>, menuIds: string[]): IKeycode[] {
  const result: IKeycode[] = [];
  for (const id of menuIds) {
    const menu = menus.find((m) => m.id === id);
    if (!menu) continue;
    result.push(...menu.keycodes.filter((k) => k.type !== 'container'));
  }
  return result;
}

/** QMK KeyMappingPanel 侧栏分类（与 drive_app QMKKeyCodeSetting 一致） */
export type QMKPanelCategory =
  | 'basic'
  | 'media'
  | 'macro'
  | 'layers'
  | 'special'
  | 'lighting'
  | 'custom';

export function getQMKPoolForCategory(
  category: QMKPanelCategory,
  menus: ReturnType<typeof buildQMKKeycodeMenus>,
): IKeycode[] {
  switch (category) {
    case 'media':
      return flattenQMKKeycodes(menus, ['media']);
    case 'layers':
      return flattenQMKKeycodes(menus, ['layers']);
    case 'special':
      return flattenQMKKeycodes(menus, ['special']);
    case 'lighting':
      return flattenQMKKeycodes(menus, ['qmk_lighting']);
    case 'custom':
      return flattenQMKKeycodes(menus, ['custom']);
    case 'macro':
      return flattenQMKKeycodes(menus, ['macro']);
    case 'basic':
    default:
      return [];
  }
}

export function qmkKeycodeToDisplayName(kc: IKeycode): string {
  return (kc.shortName ?? kc.name).replace(/\n/g, ' ');
}

export async function reReadAllQMKLayers(
  connectedKeyboard: {
    readRawMatrix: (matrix: { rows: number; cols: number }, layer: number) => Promise<number[]>;
  },
  keyboardLayout: {
    matrix: { rows: number; cols: number };
    layouts: { keymap: unknown[][] };
    customKeycodes?: Array<{ name: string; title: string; shortName: string }>;
  },
  numberOfLayers: number,
): Promise<MatrixKeyInfo[][]> {
  setCustomKeycodes(keyboardLayout.customKeycodes ?? []);
  const allLayers: MatrixKeyInfo[][] = [];
  for (let li = 0; li < numberOfLayers; li++) {
    const rawKeycodes = await connectedKeyboard.readRawMatrix(keyboardLayout.matrix, li);
    allLayers.push(
      buildMatrixKeyInfo(rawKeycodes, keyboardLayout.layouts.keymap, keyboardLayout.matrix),
    );
  }
  return allLayers;
}
