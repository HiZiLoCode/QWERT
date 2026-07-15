import { deviceInfo, deviceInfoKey } from '@/config/deviceInfo';
import layout3059 from '@/data/keyboardLayout/36B0_3059_0.json';
import layout307E from '@/data/keyboardLayout/36B0_307E_0.json';
import layout307F from '@/data/keyboardLayout/36B0_307F_0.json';
import layout3081 from '@/data/keyboardLayout/36B0_3081_0.json';
import preview31BA from '@/data/keyboardPreview/36B0_31BA_0.json';
import preview314D from '@/data/keyboardPreview/36B0_314D_0.json';
import preview314F from '@/data/keyboardPreview/36B0_314F_0.json';
export type KeyboardSkinOption = {
  value: string;
  lang?: string;
  label?: string;
  suffix: string;
  image?: string;
};

export const DEFAULT_KEYBOARD_SKIN_OPTIONS: KeyboardSkinOption[] = [
  { value: 'blackWarrior', lang: '2890', label: '黑武士', suffix: '', image: '' },
  { value: 'lightShine', lang: '2891', label: '银闪闪', suffix: '_lightShine', image: '' },
  { value: 'strawberryPink', lang: '2892', label: '草莓粉', suffix: '_strawberryPink', image: '' },
  { value: 'sapphireBlue', lang: '2893', label: '蓝宝石', suffix: '_sapphireBlue', image: '' },
];

const PREVIEW_SKINS_BY_LAYOUT: Record<string, unknown> = {
  '36B0_3059_0': layout3059.previewSkins,
  '36B0_307E_0': layout307E.previewSkins,
  '36B0_307F_0': layout307F.previewSkins,
  '36B0_3081_0': layout3081.previewSkins,
  '36B0_31BA_0': preview31BA.previewSkins,
  '36B0_314D_0': preview314D.previewSkins,
  '36B0_314F_0': preview314F.previewSkins,
};

export function normalizeKeyboardSkinOptions(input: unknown): KeyboardSkinOption[] {
  if (!Array.isArray(input)) return [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
  const parsed = input.filter(
    (item): item is KeyboardSkinOption =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as { value?: unknown }).value === 'string' &&
      typeof (item as { suffix?: unknown }).suffix === 'string' &&
      (typeof (item as { label?: unknown }).label === 'string' ||
        typeof (item as { lang?: unknown }).lang === 'string') &&
      (typeof (item as { image?: unknown }).image === 'string' ||
        typeof (item as { image?: unknown }).image === 'undefined'),
  );
  return parsed.length ? parsed : [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
}

export function getKeyboardPreviewPath(vid?: number, pid?: number, devMode = 0): string {
  if (typeof vid !== 'number' || typeof pid !== 'number') return '';
  const key = deviceInfoKey(vid, pid, devMode);
  const layout = deviceInfo[key]?.layout;
  if (typeof layout === 'string' && layout) {
    return `/keyboard/${layout}.png`;
  }
  const vidHex = vid.toString(16).toUpperCase();
  const pidHex = pid.toString(16).toUpperCase();
  return `/keyboard/${vidHex}_${pidHex}_${devMode}.png`;
}

export function resolveKeyboardPreviewBySkin(
  src: string,
  skin: string,
  options: KeyboardSkinOption[],
): string {
  const option = options.find((item) => item.value === skin);
  if (option?.image) return option.image;
  if (!option || !option.suffix) return src;
  const dotIndex = src.lastIndexOf('.');
  if (dotIndex <= 0) return src;
  return `${src.slice(0, dotIndex)}${option.suffix}${src.slice(dotIndex)}`;
}

export function getDevicePreviewSkinOptions(
  vendorId?: number,
  productId?: number,
  devMode = 0,
): KeyboardSkinOption[] {
  if (typeof vendorId !== 'number' || typeof productId !== 'number') {
    return [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
  }
  const layout = deviceInfo[deviceInfoKey(vendorId, productId, devMode)]?.layout;
  if (typeof layout !== 'string' || !layout) {
    return [...DEFAULT_KEYBOARD_SKIN_OPTIONS];
  }
  return normalizeKeyboardSkinOptions(PREVIEW_SKINS_BY_LAYOUT[layout]);
}

export function resolveDeviceKeyboardPreviewSrc(
  vendorId: number,
  productId: number,
  devMode: number,
  skin: string,
): string {
  const options = getDevicePreviewSkinOptions(vendorId, productId, devMode);
  const base = getKeyboardPreviewPath(vendorId, productId, devMode);
  if (!base) return '';
  const effectiveSkin = options.some((item) => item.value === skin)
    ? skin
    : (options[0]?.value ?? skin);
  return resolveKeyboardPreviewBySkin(base, effectiveSkin, options);
}

export function pickValidDeviceSkin(
  skin: string | undefined,
  options: KeyboardSkinOption[],
): string {
  if (skin && options.some((item) => item.value === skin)) return skin;
  return options[0]?.value ?? DEFAULT_KEYBOARD_SKIN_OPTIONS[0].value;
}
