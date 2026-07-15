import { keycodesList } from '@/keyboard/key-code/key2code';
import { advancedStringToKeycode } from '@/keyboard/key-code/advanced_keys';
import type { IKeycode } from '@/utils/key-to-byte/qmk_keyCode';

export interface AnyKeycodeOption {
  code: string;
  label: string;
}

function isHex(input: string): boolean {
  const lowercased = input.toLowerCase();
  const parsed = parseInt(lowercased, 16);
  return `0x${parsed.toString(16).toLowerCase()}` === lowercased;
}

function normalizeAnyKeycodeInput(input: string): string {
  let code = input.trim().toUpperCase();
  if (/^[A-Z]$/.test(code)) code = `KC_${code}`;
  else if (/^[0-9]$/.test(code)) code = `KC_${code}`;
  else if (/^F(\d{1,2})$/.test(code)) code = `KC_${code}`;
  return code;
}

export function inputIsBasicKeycode(
  input: string,
  basicKeyToByte: Record<string, number>,
): boolean {
  return normalizeAnyKeycodeInput(input) in basicKeyToByte;
}

export function basicKeycodeFromInput(
  input: string,
  basicKeyToByte: Record<string, number>,
): number {
  return basicKeyToByte[normalizeAnyKeycodeInput(input)];
}

export function inputIsAdvancedKeycode(
  input: string,
  basicKeyToByte: Record<string, number>,
): boolean {
  return advancedStringToKeycode(normalizeAnyKeycodeInput(input), basicKeyToByte) !== 0;
}

export function advancedKeycodeFromInput(
  input: string,
  basicKeyToByte: Record<string, number>,
): number {
  return advancedStringToKeycode(normalizeAnyKeycodeInput(input), basicKeyToByte);
}

export function inputIsHexKeycode(input: string): boolean {
  return isHex(input.trim());
}

export function hexKeycodeFromInput(input: string): number {
  return parseInt(input.trim().toLowerCase(), 16);
}

/** 与 VIA custom-keycode-modal 一致的合法性判断 */
export function isValidAnyKeycodeInput(
  input: string,
  basicKeyToByte: Record<string, number>,
): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  return (
    inputIsBasicKeycode(trimmed, basicKeyToByte) ||
    inputIsAdvancedKeycode(trimmed, basicKeyToByte) ||
    inputIsHexKeycode(trimmed)
  );
}

/** 将 ANY 输入解析为 QMK keycode 数值；无法解析时返回 null */
export function keycodeFromAnyInput(
  input: string,
  basicKeyToByte: Record<string, number>,
): { code: string; keycode: number } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (inputIsBasicKeycode(trimmed, basicKeyToByte)) {
    const code = normalizeAnyKeycodeInput(trimmed);
    return { code, keycode: basicKeycodeFromInput(trimmed, basicKeyToByte) };
  }

  if (inputIsAdvancedKeycode(trimmed, basicKeyToByte)) {
    const code = normalizeAnyKeycodeInput(trimmed);
    return { code, keycode: advancedKeycodeFromInput(trimmed, basicKeyToByte) };
  }

  if (inputIsHexKeycode(trimmed)) {
    const code = trimmed.toLowerCase();
    return { code, keycode: hexKeycodeFromInput(trimmed) };
  }

  return null;
}

function keycodeToOption(kc: IKeycode): AnyKeycodeOption | null {
  if (!kc.code || kc.type === 'container' || kc.type === 'text') return null;
  const label = (kc.title ?? kc.shortName ?? kc.name).replace(/\n/g, ' ');
  if (!label) return null;
  return { code: kc.code, label };
}

/** 构建 ANY 自动补全列表：QMK 全量键码 + 设备自定义键 */
export function buildAnyKeycodeOptions(
  customKeycodes?: Array<{ name: string; title: string; shortName: string }>,
): AnyKeycodeOption[] {
  const customItems: AnyKeycodeOption[] = (customKeycodes ?? []).map((k, i) => ({
    code: `CUSTOM(${i})`,
    label: k.title ?? k.name,
  }));

  const baseItems = keycodesList
    .map(keycodeToOption)
    .filter((item): item is AnyKeycodeOption => item !== null);

  const seen = new Set<string>();
  const merged: AnyKeycodeOption[] = [];
  for (const item of [...baseItems, ...customItems]) {
    if (seen.has(item.code)) continue;
    seen.add(item.code);
    merged.push(item);
  }

  return merged.sort((a, b) => a.code.localeCompare(b.code));
}

/** 与 VIA 一致的模糊搜索 */
export function filterAnyKeycodeOptions(
  items: AnyKeycodeOption[],
  query: string,
  limit = 80,
): AnyKeycodeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);
  return items
    .filter(({ label, code }) =>
      [label, code]
        .flatMap((s) => s.split(/\s+/))
        .map((s) => s.toLowerCase())
        .some((s) => s.startsWith(q)),
    )
    .slice(0, limit);
}
