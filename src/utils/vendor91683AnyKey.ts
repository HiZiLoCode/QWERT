import { keycodeFromAnyInput } from '@/utils/qmkAnyKeycode';
import { hidKeycode2EventCode } from '@/keyboard/keycode';
import type { MacroAction, MacroProfile } from '@/types/types_v1';

/** 91683 ANY 键使用的隐藏宏槽起始索引（M16 = index 16，不在宏录制 UI 展示） */
export const VENDOR_ANY_MACRO_BASE_INDEX = 16;

/** UI 层 ANY 键类型（仅内存/本地配置；下发设备仍为 0x60） */
export const VENDOR_KEY_TYPE_ANY = 0x62;

const ANY_MACRO_STORAGE_PREFIX = 'vendor91683_any_macros_';
const VENDOR_ANY_DELAY_MS = 10;

/** 修饰键前缀：A=Alt, C=Ctrl, S=Shift, W/G=Win */
const CHORD_MODIFIER_MAP: Record<string, { webCode: string; label: string }> = {
  A: { webCode: 'AltLeft', label: 'Alt' },
  C: { webCode: 'ControlLeft', label: 'Ctrl' },
  S: { webCode: 'ShiftLeft', label: 'Shift' },
  W: { webCode: 'MetaLeft', label: 'Win' },
  G: { webCode: 'MetaLeft', label: 'Win' },
};

const CHORD_INPUT_RE = /^([ACSWG])\s*\(([^)]+)\)\s*$/i;

export type VendorAnyMacroEntry = {
  webCode: string;
  displayName: string;
  code: string;
  /** 和弦/多键 ANY 的完整宏动作；单键时可省略 */
  macroActions?: MacroAction[];
};

export type VendorAnyParsed = {
  displayName: string;
  code: string;
  webCode: string;
  macroActions: MacroAction[];
};

export function vendorAnyMacroStorageKey(version: string | number | undefined): string {
  return `${ANY_MACRO_STORAGE_PREFIX}${version ?? 'default'}`;
}

export function readVendorAnyMacroMap(version: string | number | undefined): Record<number, VendorAnyMacroEntry> {
  try {
    const raw = localStorage.getItem(vendorAnyMacroStorageKey(version));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, VendorAnyMacroEntry>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<number, VendorAnyMacroEntry> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const slot = Number(k);
      if (Number.isFinite(slot) && (v?.displayName || v?.webCode)) out[slot] = v;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeVendorAnyMacroMap(
  version: string | number | undefined,
  map: Record<number, VendorAnyMacroEntry>,
): void {
  try {
    localStorage.setItem(vendorAnyMacroStorageKey(version), JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** 每个键位独占一个隐藏宏槽：16 + keyIndex */
export function resolveVendorAnyMacroSlot(keyIndex: number): number {
  return VENDOR_ANY_MACRO_BASE_INDEX + keyIndex;
}

export function isHiddenVendorAnyMacroSlot(slot: number): boolean {
  return slot >= VENDOR_ANY_MACRO_BASE_INDEX;
}

export function isDeviceAnyMacroKey(key: { type?: number; code1?: number }): boolean {
  return (
    (key.type === 0x60 || key.type === 0x61) &&
    isHiddenVendorAnyMacroSlot(key.code1 ?? -1)
  );
}

export function isVendorAnyKeyType(type?: number): boolean {
  return type === VENDOR_KEY_TYPE_ANY;
}

/** 下发设备时将 UI 类型 ANY 转回宏类型 0x60 */
export function toDeviceKeyType(type: number): number {
  if (type === VENDOR_KEY_TYPE_ANY) return 0x60;
  return type;
}

export function resolveVendorAnyDisplayName(
  macroSlot: number,
  version?: string | number,
): string {
  const entry = readVendorAnyMacroMap(version)[macroSlot];
  if (entry?.displayName) return entry.displayName;
  if (typeof window !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const storageKey = localStorage.key(i);
      if (!storageKey?.startsWith(ANY_MACRO_STORAGE_PREFIX)) continue;
      try {
        const map = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<
          string,
          VendorAnyMacroEntry
        >;
        if (map[String(macroSlot)]?.displayName) return map[String(macroSlot)].displayName;
      } catch {
        /* ignore */
      }
    }
  }
  return 'ANY';
}

/** 从设备读到的 0x60+M16 转为 UI 层 ANY 键 */
export function toVendorAnyUserKey(
  key: Record<string, unknown>,
  version?: string | number,
): Record<string, unknown> {
  if (!isDeviceAnyMacroKey(key as { type?: number; code1?: number })) return key;

  const macroSlot = (key.code1 as number) ?? 0;
  const anyMap = readVendorAnyMacroMap(version);
  const entry = anyMap[macroSlot];

  return {
    ...key,
    type: VENDOR_KEY_TYPE_ANY,
    name: entry?.displayName ?? resolveVendorAnyDisplayName(macroSlot, version),
    code: entry?.code ?? 'ANY',
    code1: macroSlot,
    code2: key.code2 ?? 0,
    code3: key.code3 ?? 1,
  };
}

/** 容错：kc_a / ka_b / kc-c → KC_A */
function normalizeAnyKeyToken(raw: string): string {
  let token = raw.trim();
  if (!token) return '';

  token = token.replace(/^kc-/i, 'kc_').replace(/^ka_/i, 'kc_');

  if (/^kc_[a-z0-9]+$/i.test(token)) {
    const suffix = token.slice(3).replace(/-/g, '_').toUpperCase();
    return `KC_${suffix}`;
  }

  if (/^[a-z0-9]+$/i.test(token) && token.length <= 3) {
    return `KC_${token.toUpperCase()}`;
  }

  return token.toUpperCase();
}

function splitChordKeyTokens(inner: string): string[] {
  return inner
    .split(',')
    .map((part) => normalizeAnyKeyToken(part))
    .filter(Boolean);
}

/** QMK / 十六进制输入 → 91683 宏所需的 webCode */
export function qmkAnyInputToWebCode(
  input: string,
  basicDict: Record<string, number>,
): { webCode: string; displayName: string; code: string } | null {
  const parsed = keycodeFromAnyInput(input, basicDict);
  if (!parsed) return null;

  let hidByte = parsed.keycode;
  if (hidByte > 0xff) {
    hidByte = basicDict[parsed.code] ?? hidByte & 0xff;
  }
  if (hidByte <= 0 || hidByte > 0xff) return null;

  const { eventCode, displayName } = hidKeycode2EventCode(hidByte);
  if (!eventCode) return null;

  return { webCode: eventCode, displayName: displayName || parsed.code, code: parsed.code };
}

function makeDelayAction(ms: number, index: number): MacroAction {
  return {
    type: 'delay',
    key: String(ms),
    webCode: '',
    hasUpArrow: false,
    hasDownArrow: false,
    showAddButtons: false,
    index,
    hasError: false,
  };
}

function makeKeyAction(
  webCode: string,
  label: string,
  down: boolean,
  index: number,
): MacroAction {
  return {
    type: 'keyboard',
    key: label,
    webCode,
    hasUpArrow: !down,
    hasDownArrow: down,
    showAddButtons: false,
    index,
    hasError: false,
  };
}

function buildSingleKeyMacroActions(
  webCode: string,
  displayName: string,
): MacroAction[] {
  return [
    makeDelayAction(VENDOR_ANY_DELAY_MS, 0),
    makeKeyAction(webCode, displayName, true, 1),
    makeKeyAction(webCode, displayName, false, 2),
  ];
}

function buildChordMacroActions(
  modifier: { webCode: string; label: string },
  keys: Array<{ webCode: string; displayName: string }>,
): MacroAction[] {
  const actions: MacroAction[] = [];
  let idx = 0;

  actions.push(makeDelayAction(VENDOR_ANY_DELAY_MS, idx++));
  actions.push(makeKeyAction(modifier.webCode, modifier.label, true, idx++));
  actions.push(makeDelayAction(VENDOR_ANY_DELAY_MS, idx++));

  for (const key of keys) {
    actions.push(makeKeyAction(key.webCode, key.displayName, true, idx++));
    actions.push(makeKeyAction(key.webCode, key.displayName, false, idx++));
    actions.push(makeDelayAction(VENDOR_ANY_DELAY_MS, idx++));
  }

  actions.push(makeKeyAction(modifier.webCode, modifier.label, false, idx++));
  return actions;
}

function parseChordAnyInput(
  input: string,
  basicDict: Record<string, number>,
): VendorAnyParsed | null {
  const match = input.trim().match(CHORD_INPUT_RE);
  if (!match) return null;

  const modifier = CHORD_MODIFIER_MAP[match[1].toUpperCase()];
  if (!modifier) return null;

  const keyTokens = splitChordKeyTokens(match[2]);
  if (keyTokens.length === 0) return null;

  const resolvedKeys: Array<{ webCode: string; displayName: string; code: string }> = [];
  for (const token of keyTokens) {
    const mapped = qmkAnyInputToWebCode(token, basicDict);
    if (!mapped) return null;
    resolvedKeys.push(mapped);
  }

  const displayName = modifier.label + resolvedKeys.map((k) => k.displayName).join('');
  const macroActions = buildChordMacroActions(modifier, resolvedKeys);

  return {
    code: input.trim(),
    displayName,
    webCode: resolvedKeys[0].webCode,
    macroActions,
  };
}

/** 解析 91683 ANY 输入：支持和弦 A(KC_A,KC_B) 与单键 KC_A / 0x04 */
export function parseVendorAnyInput(
  input: string,
  basicDict: Record<string, number>,
): VendorAnyParsed | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const chord = parseChordAnyInput(trimmed, basicDict);
  if (chord) return chord;

  const single = qmkAnyInputToWebCode(trimmed, basicDict);
  if (!single) return null;

  return {
    code: single.code,
    displayName: single.displayName,
    webCode: single.webCode,
    macroActions: buildSingleKeyMacroActions(single.webCode, single.displayName),
  };
}

export function isValidVendorAnyInput(input: string, basicDict: Record<string, number>): boolean {
  return parseVendorAnyInput(input, basicDict) !== null;
}

/** 构建 ANY 隐藏宏：默认 10ms 延迟，执行一次 */
export function buildVendorAnyMacroProfile(
  macroSlot: number,
  entry: Pick<VendorAnyMacroEntry, 'displayName' | 'webCode' | 'macroActions'>,
): MacroProfile {
  const list = entry.macroActions?.length
    ? entry.macroActions
    : entry.webCode
      ? buildSingleKeyMacroActions(entry.webCode, entry.displayName)
      : [];

  return {
    name: `__any_${macroSlot}`,
    key: macroSlot,
    type: 0,
    replayCnt: 1,
    list,
  };
}

/** 合并用户宏 (0–15) 与 ANY 隐藏宏后下发到设备 */
export function mergeMacroProfilesForDevice(
  userMacros: MacroProfile[],
  hiddenAnyMacros: MacroProfile[],
): MacroProfile[] {
  const maxSlot = Math.max(
    15,
    ...hiddenAnyMacros.map((m) => m.key ?? 0),
    ...userMacros.map((m) => m.key ?? 0),
  );

  const bySlot = new Map<number, MacroProfile>();
  for (const m of userMacros) {
    const slot = m.key ?? 0;
    if (slot < VENDOR_ANY_MACRO_BASE_INDEX) bySlot.set(slot, m);
  }
  for (const m of hiddenAnyMacros) {
    bySlot.set(m.key ?? 0, m);
  }

  const merged: MacroProfile[] = [];
  for (let i = 0; i <= maxSlot; i++) {
    merged.push(
      bySlot.get(i) ?? {
        name: `M${i}`,
        key: i,
        type: 0,
        replayCnt: 1,
        list: [],
      },
    );
  }
  return merged;
}

export function hiddenAnyMacrosFromMap(
  map: Record<number, VendorAnyMacroEntry>,
): MacroProfile[] {
  return Object.entries(map).map(([slot, entry]) =>
    buildVendorAnyMacroProfile(Number(slot), entry),
  );
}
