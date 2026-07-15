import { deviceInfoKey } from '@/config/deviceInfo';
import { hsvaToHex } from '@uiw/color-convert';

export type QmkLightingGroupType = 'backlight' | 'logo' | 'audio' | 'unknown';

export type QmkLightingGroup = {
  label: string;
  groupType: QmkLightingGroupType;
};

const PICKUP_LIGHTING_DEVICE_KEYS = new Set([
  '0x36B0_0x3081_0',
  '0x36B0_0x3059_0',
]);

/** 91683 / QMK：仅 0x36B0_0x3059_0、0x36B0_0x3081_0 为拾音灯，其余 logo 区为 LOGO 灯 */
export function isPickupLightingDevice(
  vendorId?: number,
  productId?: number,
  devMode = 0,
): boolean {
  if (typeof vendorId !== 'number' || typeof productId !== 'number') return false;
  return PICKUP_LIGHTING_DEVICE_KEYS.has(deviceInfoKey(vendorId, productId, devMode));
}

/** @deprecated 使用 isPickupLightingDevice */
export const isQmkPickupLightingDevice = isPickupLightingDevice;

export function getLogoLightingTabI18nKey(isPickupDevice: boolean): '2705' | '2955' {
  return isPickupDevice ? '2705' : '2955';
}

/** 拾音灯文案 → LOGO 灯（非拾音设备） */
const LOGO_LIGHT_LANG_ALIASES: Record<string, string> = {
  '7731': '2956',
  '90024': '2957',
  '90025': '2958',
  '90026': '2959',
  '90027': '2960',
  '90028': '2961',
  '90029': '2962',
  '90030': '2963',
  '90031': '2964',
  '90032': '2965',
  '90141': '2966',
  '90142': '2967',
  '90143': '2968',
  '90144': '2969',
  '90145': '2970',
  '90146': '2971',
  '90147': '2972',
  '90148': '2973',
  '90149': '2974',
};

const LOGO_LIGHT_CUSTOM_KEY_CODES = new Set([
  'LOGO_LIGHT_TOGGLE',
  'LOGO_LIGHT_MODE_PLUS',
  'LOGO_LIGHT_MODE_MINUS',
  'LOGO_LIGHT_HUE_PLUS',
  'LOGO_LIGHT_HUE_MINUS',
  'LOGO_LIGHT_BRIGHT_PLUS',
  'LOGO_LIGHT_BRIGHT_MINUS',
  'LOGO_LIGHT_SPEED_PLUS',
  'LOGO_LIGHT_SPEED_MINUS',
  'LG_TOG',
  'LG_MOD',
  'LG_RMOD',
  'LG_HUI',
  'LG_HUD',
  'LG_VAI',
  'LG_VAD',
  'LG_SPI',
  'LG_SPD',
]);

export function isLogoLightCustomKeyCode(code: string | undefined): boolean {
  if (!code) return false;
  return LOGO_LIGHT_CUSTOM_KEY_CODES.has(code.toUpperCase());
}

export function resolveLogoLightingLangKey(
  langKey: string | undefined,
  isPickupDevice: boolean,
): string | undefined {
  if (!langKey || isPickupDevice) return langKey;
  return LOGO_LIGHT_LANG_ALIASES[langKey] ?? langKey;
}

export function resolveLogoLightKeyLangKey(
  keyItem: { code?: string; langid?: string; type?: number; code1?: number },
  isPickupDevice: boolean,
): string | undefined {
  const explicit = resolveLogoLightingLangKey(keyItem.langid, isPickupDevice);
  if (keyItem.langid) return explicit;
  if (
    keyItem.type === 80 &&
    typeof keyItem.code1 === 'number' &&
    keyItem.code1 > 0 &&
    isLogoLightCustomKeyCode(keyItem.code)
  ) {
    return resolveLogoLightingLangKey(String(90000 + keyItem.code1), isPickupDevice);
  }
  return explicit;
}

export function getGroupTypeByContentId(contentId: string): QmkLightingGroupType | null {
  if (contentId.startsWith('id_qmk_rgb_matrix_')) return 'backlight';
  if (contentId.startsWith('id_qmk_rgblight_')) return 'logo';
  if (contentId.startsWith('id_qmk_audio_')) return 'audio';
  return null;
}

export function parseQmkLightingGroups(menus: any[] | undefined): QmkLightingGroup[] {
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  if (!lightingMenu) return [];
  return (lightingMenu.content ?? []).map((group: any) => {
    const items: any[] = group.content ?? [];
    const probe = items.find(
      (i: any) => Array.isArray(i.content) && i.content.length >= 3 && typeof i.content[0] === 'string',
    );
    let groupType: QmkLightingGroupType = 'unknown';
    if (probe) {
      groupType = getGroupTypeByContentId(probe.content[0] as string) ?? 'unknown';
    }
    return { label: String(group.label ?? ''), groupType };
  });
}

export function findQmkLightingGroup(
  menus: any[] | undefined,
  groupLabel: string,
): QmkLightingGroup | null {
  return parseQmkLightingGroups(menus).find((g) => g.label === groupLabel) ?? null;
}

/** 与 PARSE_MENUS_TO_LIGHTING_EFFECTS 写入 lighting.effects 的 key 保持一致 */
export function resolveQmkEffectsStorageKey(group: QmkLightingGroup): string {
  if (group.groupType === 'backlight') return 'backlight';
  if (group.groupType === 'logo') return 'logo';
  return group.label;
}

export function resolveQmkEffectsKeyForLabel(
  menus: any[] | undefined,
  groupLabel: string,
): string {
  const group = findQmkLightingGroup(menus, groupLabel);
  if (!group) return groupLabel;
  return resolveQmkEffectsStorageKey(group);
}

/** deviceFuncInfo 字段前缀：light / logoLight / latticeLight … */
export function resolveQmkFuncInfoPrefix(group: QmkLightingGroup): string {
  if (group.groupType === 'backlight') return 'light';
  if (group.groupType === 'logo') return 'logoLight';
  const slug = group.label.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase() || 'qmk';
  return `${slug}Light`;
}

export function resolveQmkFuncInfoPrefixForLabel(
  menus: any[] | undefined,
  groupLabel: string,
): string {
  const group = findQmkLightingGroup(menus, groupLabel);
  if (!group) {
    const slug = groupLabel.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase() || 'qmk';
    return `${slug}Light`;
  }
  return resolveQmkFuncInfoPrefix(group);
}

export function getQmkLightingGroupDisplayLabel(
  group: QmkLightingGroup,
  isPickupDevice: boolean,
): string {
  if (group.groupType === 'logo') {
    return isPickupDevice ? '拾音灯' : 'LOGO灯';
  }
  return group.label;
}

export const QMK_LIGHT_TAB_PREFIX = 'qmk-light:';

export function qmkLightTabId(groupLabel: string): string {
  return `${QMK_LIGHT_TAB_PREFIX}${encodeURIComponent(groupLabel)}`;
}

export function parseQmkLightTabId(tabId: string): string | null {
  if (!tabId.startsWith(QMK_LIGHT_TAB_PREFIX)) return null;
  return decodeURIComponent(tabId.slice(QMK_LIGHT_TAB_PREFIX.length));
}

export type QmkLightingSidebarTab = {
  id: string;
  label: string;
  groupLabel: string;
  iconId: 'lighting' | 'logolighting';
};

/** 将 VIA JSON 灯光分组展开为侧边栏 Tab（轴灯调节 / LOGO灯光 / 拾音灯 等） */
export function buildQmkLightingSidebarTabs(
  menus: any[] | undefined,
  isPickupDevice: boolean,
): QmkLightingSidebarTab[] {
  return parseQmkLightingGroups(menus).map((group) => ({
    id: qmkLightTabId(group.label),
    label: getQmkLightingGroupDisplayLabel(group, isPickupDevice),
    groupLabel: group.label,
    iconId: group.groupType === 'logo' ? 'logolighting' : 'lighting',
  }));
}

/** 读取 VIA 分组内亮度/速度/颜色控件是否存在（不含 showIf 运行时判断） */
export function getQmkLightingGroupControls(
  menus: any[] | undefined,
  groupLabel: string,
): { hasBrightness: boolean; hasSpeed: boolean; hasColor: boolean } {
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  const group = (lightingMenu?.content ?? []).find(
    (g: any) => String(g.label ?? '') === groupLabel,
  );
  const items: any[] = group?.content ?? [];
  return {
    hasBrightness: items.some((i) => i.type === 'range' && i.label === 'Brightness'),
    hasSpeed: items.some((i) => i.type === 'range' && i.label === 'Effect Speed'),
    hasColor: items.some((i) => i.type === 'color'),
  };
}

/** 按 VIA group.label 精确匹配控件 channel/id */
export function findMenuContentIdByGroupLabel(
  menus: any[] | undefined,
  groupLabel: string,
  matcher: (item: any) => boolean,
): [number, number] | null {
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  if (!lightingMenu) return null;

  for (const group of lightingMenu.content ?? []) {
    if (String(group.label ?? '') !== groupLabel) continue;
    const allItems: any[] = group.content ?? [];
    const item = allItems.find(matcher);
    if (!item || !Array.isArray(item.content) || item.content.length < 3) return null;
    return [item.content[1] as number, item.content[2] as number];
  }
  return null;
}

/** @deprecated 请使用 findMenuContentIdByGroupLabel */
export function findMenuContentId(
  menus: any[] | undefined,
  groupType: QmkLightingGroupType,
  matcher: (item: any) => boolean,
): [number, number] | null {
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  if (!lightingMenu) return null;

  const targetType = groupType === 'backlight' ? 'backlight' : 'logo';

  for (const group of lightingMenu.content ?? []) {
    const allItems: any[] = group.content ?? [];
    const probe = allItems.find(
      (i: any) => Array.isArray(i.content) && i.content.length >= 3 && typeof i.content[0] === 'string',
    );
    if (!probe) continue;
    const detected = getGroupTypeByContentId(probe.content[0] as string);
    if (detected !== targetType) continue;

    const item = allItems.find(matcher);
    if (!item || !Array.isArray(item.content) || item.content.length < 3) return null;
    return [item.content[1] as number, item.content[2] as number];
  }
  return null;
}

/** 从设备灯光状态构建 deviceFuncInfo patch（每个 VIA 分组独立字段） */
export function buildQmkLightingFuncPatch(
  menus: any[] | undefined,
  lightState: Record<string, number>,
): Record<string, number> {
  const funcPatch: Record<string, number> = {};
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  if (!lightingMenu) return funcPatch;

  for (const groupMeta of parseQmkLightingGroups(menus)) {
    const group = (lightingMenu.content ?? []).find(
      (g: any) => String(g.label ?? '') === groupMeta.label,
    );
    if (!group) continue;

    const items: any[] = group.content ?? [];
    const prefix = resolveQmkFuncInfoPrefix(groupMeta);
    const effectItem = items.find((i: any) => i.type === 'dropdown');
    const brightItem = items.find((i: any) => i.type === 'range' && i.label === 'Brightness');
    const speedItem = items.find((i: any) => i.type === 'range' && i.label === 'Effect Speed');
    const colorItem = items.find((i: any) => i.type === 'color');

    const effectId = effectItem?.content?.[0] as string | undefined;
    const brightId = brightItem?.content?.[0] as string | undefined;
    const speedId = speedItem?.content?.[0] as string | undefined;
    const colorId = colorItem?.content?.[0] as string | undefined;

    if (effectId) funcPatch[`${prefix}Mode`] = lightState[effectId] ?? 0;
    if (brightId) funcPatch[`${prefix}Brightness`] = lightState[brightId] ?? 0;
    if (speedId) funcPatch[`${prefix}Speed`] = lightState[speedId] ?? 0;
    if (colorId) {
      funcPatch[`${prefix}RValue`] = lightState[`${colorId}_hue`] ?? lightState[colorId] ?? 0;
      funcPatch[`${prefix}GValue`] = lightState[`${colorId}_sat`] ?? 0;
    }
    funcPatch[`${prefix}Switch`] = (lightState[brightId ?? ''] ?? 0) > 0 ? 0 : 1;
    funcPatch[`${prefix}MixColor`] = 1;
  }

  funcPatch.lightCustomIndex = 0;
  return funcPatch;
}

/** QMK VIA 颜色控件：hue/sat 均为 0–255 字节 */
export function qmkHueSatBytesToHex(hueByte: number, satByte: number): string {
  const hex = hsvaToHex({
    h: (hueByte / 255) * 360,
    s: (satByte / 255) * 100,
    v: 100,
    a: 1,
  });
  return (hex || '#FF0000').toUpperCase();
}

export function hexToQmkHueSatBytes(hex: string): { hByte: number; sByte: number } {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(value, 16);
  const rn = ((num >> 16) & 255) / 255;
  const gn = ((num >> 8) & 255) / 255;
  const bn = (num & 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;
  if (delta > 0) {
    if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
    else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
    else hue = 60 * ((rn - gn) / delta + 4);
    if (hue < 0) hue += 360;
  }
  const sat = max === 0 ? 0 : delta / max;
  return {
    hByte: Math.round((hue / 360) * 255),
    sByte: Math.round(sat * 255),
  };
}
