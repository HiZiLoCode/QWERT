'use client';

import { Box, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ColorizeOutlinedIcon from '@mui/icons-material/ColorizeOutlined';
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useTranslation } from '@/app/i18n';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import type { LayoutKey } from '@/types/types_v1';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import ColorPicker from '@/components/ColorPicker';
import { ButtonRem, SliderRem } from '@/styled/ReconstructionRem';
import Matrix from '@/components/Matrix';
import ToggleSlider from '@/components/common/ToggleSlider';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';
import { useSnackbarDialog } from '@/providers/useSnackbarProvider';
import {
  lightingBrightnessInputSx,
  lightingEffectButtonSx,
  lightingGroupTitleSx,
  lightingPanelCardSx,
  lightingPercentMutedSx,
  lightingSectionLabelSx,
  lightingSliderSx,
  lightingToggleGridButtonSx,
} from '@/constants/lightingPanelChrome';

type EffectItem = {
  value: number;
  label: string;
};

type EffectGroup = {
  title: string;
  items: EffectItem[];
};

/** 布局 JSON `lighting.backlight[].effectCategory`，用于静态 / 动态 / 互动 三栏分组 */
function backlightHasExplicitCategories(effects: any[]): boolean {
  return effects.some(
    (e: any) =>
      e?.effectCategory === 'static' ||
      e?.effectCategory === 'dynamic' ||
      e?.effectCategory === 'interactive',
  );
}

/** 动态 + 互动：拾音等逻辑里与「非静态灯效」一致处理 */
function isAnimatedEffectCategory(effect: any): boolean {
  const c = effect?.effectCategory;
  return c === 'dynamic' || c === 'interactive';
}

function resolveLightEffectLabel(
  effect: any,
  fallbackIndex: number,
  t: (key: string) => string
): string {
  const langKey = typeof effect?.lang === 'string' ? effect.lang : '';
  if (langKey) {
    const translated = t(langKey);
    if (translated && translated !== langKey) return translated;
  }

  const name = typeof effect?.name === 'string' ? effect.name : '';
  if (name) {
    const translatedName = t(name);
    if (translatedName && translatedName !== name) return translatedName;
    return name;
  }

  if (langKey) return langKey;
  return `Effect ${fallbackIndex + 1}`;
}


function toRgb(hex: string) {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = Number.parseInt(value, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}

/** 自定义灯色点涂提示：左/右键高亮的小鼠标图标 */
function CustomPaintMouseHintIcon({
  activeButton,
  accent = '#14b8a6',
  outline = '#94a3b8',
}: {
  activeButton: 'left' | 'right';
  accent?: string;
  outline?: string;
}) {
  const line = outline;
  const isLeft = activeButton === 'left';
  return (
    <Box
      component="svg"
      viewBox="0 0 20 24"
      aria-hidden
      sx={{ width: '18px', height: '22px', flexShrink: 0, display: 'block' }}
    >
      {isLeft ? (
        <path d="M10 2.5C6.2 2.5 3 5.2 3 9v1.2h7V2.6c0-.04 0-.08.02-.1z" fill={accent} />
      ) : (
        <path d="M10 2.5c3.8 0 7 2.7 7 6.5v1.2h-7V2.6c0-.04 0-.08-.02-.1z" fill={accent} />
      )}
      <path
        d="M10 2.5C5.8 2.5 2.5 5.8 2.5 10v7.5C2.5 21 5.5 23.5 10 23.5S17.5 21 17.5 17.5V10C17.5 5.8 14.2 2.5 10 2.5z"
        fill="none"
        stroke={line}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M10 2.5v9.2" stroke={line} strokeWidth="1" strokeLinecap="round" />
    </Box>
  );
}

const EYEDROPPER_LONG_PRESS_MS = 220;

type LightSettingPanelProps = {
  forcedLightType?: 'backlight' | 'logolight' | 'sidelight' | 'matrixlight';
  onKeyboardScaleChange?: (ratio: number) => void;
};

export default function LightSettingPanel({ forcedLightType, onKeyboardScaleChange }: LightSettingPanelProps = {}) {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const { showDialog, showMessage } = useSnackbarDialog();
  const isMatrixOnly = forcedLightType === 'matrixlight';

  const { connectedKeyboard, keyboard, keyboardLayout } = useContext(ConnectKbContext);

  const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
  const travelKeys = keyboard?.travelKeys ?? [];
  const defaultLayerUserKeys = keyboard?.userKeys?.[0] ?? [];
  const displayLayoutKeys = useMemo(
    () => mergeLayoutKeysWithUserKeyNames(layoutKeys, defaultLayerUserKeys),
    [layoutKeys, defaultLayerUserKeys],
  );

  const isQMK = keyboard?.keyboardType === 'QMK';

  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [openLight, setOpenLight] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [brightnessInput, setBrightnessInput] = useState('100');
  const [speed, setSpeed] = useState(40);
  const [singleColorMode, setSingleColorMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [playDirection, setPlayDirection] = useState<0 | 1>(0);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const latestMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseMoveRafRef = useRef<number | null>(null);

  // 右键长按吸色时：用图标跟随鼠标显示，避免浏览器/React cursor 兼容问题
  useEffect(() => {
    if (!eyedropperActive) return;

    const onMove = (e: MouseEvent) => {
      latestMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (mouseMoveRafRef.current != null) return;
      mouseMoveRafRef.current = requestAnimationFrame(() => {
        mouseMoveRafRef.current = null;
        setMousePos(latestMousePosRef.current);
      });
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (mouseMoveRafRef.current != null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = null;
      }
    };
  }, [eyedropperActive]);

  const lightType = forcedLightType ?? keyboard?.lightType ?? 'backlight';
  const isPickupLightingModule = forcedLightType === 'logolight';
  const legacyPrefix = lightType === 'logolight' ? 'logoLight' : lightType === 'sidelight' ? 'sideLight' : 'light';
  const maxBrightness = useMemo(() => keyboard?.deviceBaseInfo?.lightMaxBrightness ?? 255, [keyboard?.deviceBaseInfo?.lightMaxBrightness]);

  const maxSpeed = useMemo(() => keyboard?.deviceBaseInfo?.lightMaxSpeed ?? 255, [keyboard?.deviceBaseInfo?.lightMaxSpeed]);

  const lightEffects = useMemo(() => {
    const list = keyboardLayout?.lighting?.[lightType] ?? [];
    return list.map((effect: any, idx: number) => ({
      ...effect,
      value: effect.value ?? idx,
      label: resolveLightEffectLabel(effect, idx, t),
    }));
  }, [keyboardLayout, lightType, t]);

  const selectedEffect = useMemo(() => {
    const mode = keyboard?.deviceFuncInfo?.[`${legacyPrefix}Mode`] ?? 0;
    const custom = keyboard?.deviceFuncInfo?.lightCustomIndex ?? 0;
    return mode + custom;
  }, [keyboard?.deviceFuncInfo, legacyPrefix]);

  const currentLightInfo = useMemo<any>(() => {
    const found = lightEffects.find((effect: any) => effect.value === selectedEffect);
    if (found) return found;
    // 布局里未声明 value=0 的「全灭」时，effectGroups 仍会展示全灭项；这里占位避免判空导致拾音等逻辑异常
    if (selectedEffect === 0) {
      return {
        value: 0,
        brightness: false,
        speed: false,
        direction: false,
        color: false,
        effectCategory: 'static',
      };
    }
    return null;
  }, [lightEffects, selectedEffect]);

  /** 动态 + 互动灯效；有 `effectCategory` 时以字段为准，否则沿用 color 推断（兼容旧布局）。 */
  const isPickupDynamicLighting = useMemo(() => {
    if (!isPickupLightingModule || !currentLightInfo) return false;
    const isOff =
      currentLightInfo.value === 0 ||
      (typeof currentLightInfo.label === 'string' && currentLightInfo.label.includes(t('1675')));
    if (isOff) return false;
    if (
      currentLightInfo.effectCategory === 'static' ||
      currentLightInfo.effectCategory === 'dynamic' ||
      currentLightInfo.effectCategory === 'interactive'
    ) {
      return isAnimatedEffectCategory(currentLightInfo);
    }
    return !(currentLightInfo.color === false);
  }, [isPickupLightingModule, currentLightInfo, t]);

  /** 拾音「全灭」：与分组里全灭项一致（value=0 或文案含全灭）。 */
  const isPickupAllOff = useMemo(() => {
    if (!isPickupLightingModule || !currentLightInfo) return false;
    return (
      currentLightInfo.value === 0 ||
      (typeof currentLightInfo.label === 'string' && currentLightInfo.label.includes(t('1675')))
    );
  }, [isPickupLightingModule, currentLightInfo, t]);

  /** 拾音静态（非动态、非全灭）：禁用底部预设色块（Swatch），主色盘与 HEX 仍可用。 */
  const pickupStaticDisableSwatch =
    isPickupLightingModule && !isPickupAllOff && !isPickupDynamicLighting;
  /** 拾音静态（非动态、非全灭）：方向区显示/可用受音频开关控制。 */
  const isPickupStaticLighting =
    isPickupLightingModule && !isPickupAllOff && !isPickupDynamicLighting;

  /** 拾音模块下「音频响应」仅写 FUNCINFO 字节 63，不用于禁用亮度/速度/方向/彩色等；其它灯区仍用 openLight 作总开关。 */
  const lightGatesEffectControls = isPickupLightingModule || openLight;
  const canAdjustBrightness = lightGatesEffectControls && Boolean(currentLightInfo?.brightness);
  const canAdjustSpeed = lightGatesEffectControls && Boolean(currentLightInfo?.speed);
  const canAdjustDirection =
    Boolean(currentLightInfo?.direction) &&
    (isPickupStaticLighting ? openLight : lightGatesEffectControls);
  /** 是否允许切换到「彩色」：JSON color 为 true，或拾音静态带 palette 的例外 */
  const canEnableColorful =
    lightGatesEffectControls &&
    (Boolean(currentLightInfo?.color) ||
      (isPickupLightingModule &&
        !isPickupDynamicLighting &&
        Boolean(currentLightInfo?.palette)));
  /** JSON 可配置：singleColor=false 时该灯效禁用「单色」按钮，仅允许彩色。 */
  const canEnableSingleColor =
    lightGatesEffectControls &&
    currentLightInfo?.singleColor !== false;
  /** 单色模式下色板是否可用：color 为 false 时仍可选单色，仅禁止切到彩色（与 canEnableColorful 解耦） */
  const isAllOffLight =
    currentLightInfo?.value === 0 ||
    (typeof currentLightInfo?.label === 'string' && currentLightInfo.label.includes(t('1675')));
  const canPickSolidColorOnPalette =
    lightGatesEffectControls &&
    singleColorMode &&
    currentLightInfo?.palette !== false &&
    (canEnableColorful || (currentLightInfo?.color === false && !isAllOffLight));
  const isCustomEffect = selectedEffect >= 253;
  const canCustomPaint = !isQMK && lightType === 'backlight' && lightGatesEffectControls && isCustomEffect;
  const switchingCustomEffectRef = useRef(false);
  const customPaintDragRef = useRef(false);
  const customPaintDragColorRef = useRef<string | null>(null);
  const customPaintModeRef = useRef<'paint' | 'eyedropper' | null>(null);
  const eyedropperPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paintBatchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyColors: string[] = keyboard?.keysColor ?? [];
  const latestKeyColorsRef = useRef<string[]>(keyColors);
  const lightMatrix: number[] = keyboard?.lightMatrix ?? [];
  const directionLabels = useMemo<[string, string]>(() => {
    const raw = currentLightInfo?.directionDescription;
    if (Array.isArray(raw) && raw.length >= 2) {
      return [String(raw[0]), String(raw[1])];
    }
    return ['1617', '1618'];
  }, [currentLightInfo?.directionDescription]);

  const effectGroups = useMemo<EffectGroup[]>(() => {
    if (!lightEffects.length) {
      return [
        { title: t('1672'), items: [{ value: 253, label: t('1673') }] },
        { title: t('1674'), items: [] },
      ];
    }

    const isOffEntry = (e: any) =>
      e.value === 0 || (typeof e.label === 'string' && e.label.includes(t('1675')));

    if (lightType === 'backlight' && backlightHasExplicitCategories(lightEffects)) {
      const staticRaw = lightEffects.filter((e: any) => e.effectCategory === 'static');
      const dynamicRaw = lightEffects.filter((e: any) => e.effectCategory === 'dynamic');
      const interactiveRaw = lightEffects.filter((e: any) => e.effectCategory === 'interactive');
      const hasOffInStatic = staticRaw.some(isOffEntry);
      const staticEffects = hasOffInStatic
        ? staticRaw
        : [
          {
            value: 0,
            label: t('1675'),
            brightness: false,
            speed: false,
            direction: false,
            color: false,
            effectCategory: 'static',
          },
          ...staticRaw,
        ];
      return [
        { title: t('1672'), items: staticEffects.length ? staticEffects : lightEffects.slice(0, 1) },
        { title: t('1674'), items: dynamicRaw },
        { title: t('2736'), items: interactiveRaw },
      ];
    }

    const staticEffectsRaw = lightEffects.filter((e: any) => {
      const isOff = isOffEntry(e);
      return e.color === false || isOff;
    });
    const hasOff = staticEffectsRaw.some(isOffEntry);
    const staticEffects = hasOff ? staticEffectsRaw : [{ value: 0, label: t('1675') }, ...staticEffectsRaw];
    const dynamicEffects = lightEffects.filter((e: any) => {
      const isOff = isOffEntry(e);
      return !(e.color === false || isOff);
    });

    return [
      { title: t('1672'), items: staticEffects.length ? staticEffects : lightEffects.slice(0, 1) },
      { title: t('1674'), items: dynamicEffects },
    ];
  }, [lightEffects, lightType, t]);

  useEffect(() => {
    const info = keyboard?.deviceFuncInfo;
    if (!info) return;

    const lightSwitchRaw = Number(
      isPickupLightingModule
        ? info.pickupLightEffectSwitch ?? 0
        : info[`${legacyPrefix}Switch`] ?? 0
    );
    // 拾音/音频响应（FUNCINFO 字节 63）：固件为 1=开、0=关；普通灯带仍为 0=开、1=关。
    setOpenLight(isPickupLightingModule ? lightSwitchRaw === 1 : lightSwitchRaw === 0);

    const rawBrightness = info[`${legacyPrefix}Brightness`] ?? 0;
    const nextBrightness = Math.round((rawBrightness / (maxBrightness || 1)) * 100);
    setBrightness(Number.isFinite(nextBrightness) ? nextBrightness : 0);
    setBrightnessInput(String(Number.isFinite(nextBrightness) ? nextBrightness : 0));

    const rawSpeed = info[`${legacyPrefix}Speed`] ?? 0;
    setSpeed(rawSpeed);

    // 特例：singleColor=false 的灯效固定为彩色态，不跟随 MixColor 回读，避免状态来回抖动。
    if (currentLightInfo?.singleColor === false) {
      setSingleColorMode(false);
    } else {
      setSingleColorMode((info[`${legacyPrefix}MixColor`] ?? 1) === 0);
    }

    const r = info[`${legacyPrefix}RValue`] ?? 255;
    const g = info[`${legacyPrefix}GValue`] ?? 0;
    const b = info[`${legacyPrefix}BValue`] ?? 0;
    setSelectedColor(`#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase());

    // 普通灯效方向来源：功能区第 71 位；拾音灯方向来源：功能区第 73 位
    const dirRaw = Number(
      isPickupLightingModule
        ? info.pickupLightEffectDirection ?? 0
        : info.lightEffectDirection ?? 0
    );
    const normalizedDir = dirRaw === 1 ? 1 : 0;
    // 拾音灯固件方向位与 UI 方向按钮相反，这里做一次映射修正。
    setPlayDirection(isPickupLightingModule ? (normalizedDir === 1 ? 0 : 1) : normalizedDir);
  }, [keyboard?.deviceFuncInfo, isPickupLightingModule, legacyPrefix, maxBrightness, currentLightInfo?.singleColor]);

  useEffect(() => {
    if (isQMK) return;
    // 特例：singleColor=false 表示该灯效固定彩色，避免被 color=false 的通用规则强制切回单色。
    if (currentLightInfo?.singleColor === false) return;
    if (currentLightInfo?.color !== false) return;
    if (singleColorMode) return;

    setSingleColorMode(true);
    updateFuncInfo({ [`${legacyPrefix}MixColor`]: 0 });
  }, [isQMK, currentLightInfo?.singleColor, currentLightInfo?.color, singleColorMode, legacyPrefix]);

  useEffect(() => {
    if (currentLightInfo?.singleColor !== false) return;
    if (!singleColorMode) return;
    setSingleColorMode(false);
    if (!isQMK) {
      updateFuncInfo({ [`${legacyPrefix}MixColor`]: 1 });
    }
  }, [currentLightInfo?.singleColor, singleColorMode, isQMK, legacyPrefix]);

  /** 拾音静态：在需用取色器的灯效上强制单色，避免仍处彩色模式导致取色器不可用。
   * 与 JSON `singleColor: false`（仅彩色，如色阶）互斥，否则会反复写 MixColor 与回读状态导致界面抽搐。 */
  useEffect(() => {
    if (!isPickupLightingModule) return;
    if (isPickupAllOff || isPickupDynamicLighting) return;
    if (currentLightInfo?.singleColor === false) return;
    if (singleColorMode) return;
    if (isQMK) return;
    setSingleColorMode(true);
    updateFuncInfo({ [`${legacyPrefix}MixColor`]: 0 });
  }, [
    isPickupLightingModule,
    isPickupAllOff,
    isPickupDynamicLighting,
    currentLightInfo?.singleColor,
    singleColorMode,
    isQMK,
    legacyPrefix,
  ]);

  useEffect(() => {
    if (!canCustomPaint) return;
    if (switchingCustomEffectRef.current) return;
    void syncCustomKeyColors(selectedEffect);
  }, [canCustomPaint, selectedEffect]);

  useEffect(() => {
    latestKeyColorsRef.current = keyColors;
  }, [keyColors]);

  const tryPickColorFromKey = useCallback((keyIndex: number) => {
    const currentColor = (latestKeyColorsRef.current[keyIndex] || '').trim();
    if (!/^#([0-9A-Fa-f]{6})$/.test(currentColor)) return;
    setSelectedColor(currentColor.toUpperCase());
  }, []);

  useEffect(() => {
    if (!paintBatchDebounceRef.current) return;
    clearTimeout(paintBatchDebounceRef.current);
    paintBatchDebounceRef.current = null;
  }, [selectedEffect, canCustomPaint]);

  useEffect(() => {
    return () => {
      if (effectChangeDebounceRef.current) {
        clearTimeout(effectChangeDebounceRef.current);
        effectChangeDebounceRef.current = null;
      }
      if (paintBatchDebounceRef.current) {
        clearTimeout(paintBatchDebounceRef.current);
        paintBatchDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!canCustomPaint) return;
    const endDrag = () => {
      if (eyedropperPressTimerRef.current) {
        clearTimeout(eyedropperPressTimerRef.current);
        eyedropperPressTimerRef.current = null;
      }
      customPaintDragRef.current = false;
      customPaintDragColorRef.current = null;
      customPaintModeRef.current = null;
      setEyedropperActive(false);
    };
    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', endDrag);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [canCustomPaint]);

  const toggleKey = (keyIndex: number) => {
    if (canCustomPaint) {
      paintCustomKey(keyIndex, selectedColor);
      return;
    }

    setSelectedKeys((prev) =>
      prev.includes(keyIndex) ? prev.filter((k) => k !== keyIndex) : [...prev, keyIndex]
    );
  };

  const updateFuncInfo = (patch: Record<string, unknown>) => {
    const next = { ...(keyboard?.deviceFuncInfo ?? {}), ...patch };
    keyboard?.setDeviceFuncInfo?.(next);
    if (!connectedKeyboard?.test) {
      void connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
    }
  };

  const flushCustomColorsToDevice = (nextKeyColors: string[]) => {
    if (!canCustomPaint) return;
    const customIndex = selectedEffect - 253;
    if (customIndex < 0) return;

    const fullLightColors = new Array(128).fill('#000000');
    for (let keyIndex = 0; keyIndex < 128; keyIndex += 1) {
      const lightIndex = lightMatrix[keyIndex];
      if (lightIndex == null || lightIndex < 0 || lightIndex >= 128) continue;
      fullLightColors[lightIndex] = nextKeyColors[keyIndex] || '#000000';
    }
    if (!connectedKeyboard?.test) {
      void connectedKeyboard?.setUserAllKeyColorByLight?.(customIndex, fullLightColors);
    }
  };

  const scheduleCustomColorFlush = (nextKeyColors: string[]) => {
    if (paintBatchDebounceRef.current) {
      clearTimeout(paintBatchDebounceRef.current);
    }
    paintBatchDebounceRef.current = setTimeout(() => {
      flushCustomColorsToDevice(nextKeyColors);
      paintBatchDebounceRef.current = null;
    }, 120);
  };

  const syncCustomKeyColors = async (effectId: number) => {
    if (lightType !== 'backlight' || effectId < 253) return;
    const customIndex = effectId - 253;

    try {
      if (keyboard?.deviceBaseInfo?.keyboardID >= 21 && keyboard?.deviceBaseInfo?.keyboardID <= 30) {
        const rgbData = await connectedKeyboard?.getUserSingleAllKeyColor?.(customIndex);
        const rows = keyboardLayout?.matrix?.rows ?? 0;
        const cols = keyboardLayout?.matrix?.cols ?? 0;
        const bitData: number[] = Array.isArray(rgbData) ? rgbData : [];
        const colors = new Array(128).fill('#000000');

        for (let col = 0; col < cols; col += 1) {
          const mask = bitData[col] ?? 0;
          for (let row = 0; row < rows; row += 1) {
            const bit = 1 << (row + 1);
            if ((mask & bit) === 0) continue;
            const layoutKey = layoutKeys[row * cols + col];
            if (layoutKey?.index != null) {
              colors[layoutKey.index] = '#FFFFFF';
            }
          }
        }
        keyboard?.setKeysColor?.(colors);
        return;
      }

      const rgbData = await connectedKeyboard?.getUserAllKeyColor?.(customIndex);
      if (!Array.isArray(rgbData)) return;

      const mapped = new Array(128).fill('#000000').map((_, index) => {
        const li = lightMatrix[index];
        return li != null && li < rgbData.length ? rgbData[li] || '#000000' : '#000000';
      });
      keyboard?.setKeysColor?.(mapped);
    } catch (err) {
      console.error(t('1706'), err);
    }
  };

  const paintCustomKey = (keyIndex: number, hex: string) => {
    if (!canCustomPaint) return;
    const lightIndex = lightMatrix[keyIndex];
    if (lightIndex == null || lightIndex < 0) return;

    const currentColor = latestKeyColorsRef.current[keyIndex] || '';
    const color = currentColor.toUpperCase() === hex.toUpperCase() ? '#000000' : hex;
    paintCustomKeyWithColor(keyIndex, color);
  };

  const paintCustomKeyWithColor = (keyIndex: number, color: string) => {
    if (!canCustomPaint) return;
    const resolvedLightIndex = lightMatrix[keyIndex];
    if (resolvedLightIndex == null || resolvedLightIndex < 0) return;

    const next = [...latestKeyColorsRef.current];
    next[keyIndex] = color;
    latestKeyColorsRef.current = next;
    keyboard?.setKeysColor?.(next);
    scheduleCustomColorFlush(next);
  };

  const handleBrightnessCommit = async (_: Event | SyntheticEvent, value: number | number[]) => {
    const v = Math.max(0, Math.min(100, Array.isArray(value) ? value[0] : value));
    setBrightness(v);
    setBrightnessInput(String(v));
    const raw = Math.round((v / 100) * maxBrightness);

    updateFuncInfo({ [`${legacyPrefix}Brightness`]: raw });
  };

  const commitBrightnessInput = async () => {
    const parsed = Number.parseInt(brightnessInput, 10);
    const clamped = Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : brightness;
    await handleBrightnessCommit({} as Event, clamped);
  };

  const handleSpeedCommit = async (_: Event | SyntheticEvent, value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setSpeed(v);

    updateFuncInfo({ [`${legacyPrefix}Speed`]: v });
  };

  const handleEffectChange = async (effectId: number) => {
    // 拾音灯：动态灯效或全灭时关闭音频响应（字节 63 = 0）
    const effectMeta = effectId >= 253 ? null : lightEffects.find((e: any) => e.value === effectId);
    let closePickupAudio = false;
    if (isPickupLightingModule) {
      if (effectId === 0 && !effectMeta) {
        closePickupAudio = true;
      } else if (effectMeta) {
        const isOff =
          effectMeta.value === 0 ||
          (typeof effectMeta.label === 'string' && effectMeta.label.includes(t('1675')));
        const isDynamicEffect =
          effectMeta.effectCategory === 'static' ||
            effectMeta.effectCategory === 'dynamic' ||
            effectMeta.effectCategory === 'interactive'
            ? isAnimatedEffectCategory(effectMeta)
            : !(effectMeta.color === false || isOff);
        if (isDynamicEffect || isOff) closePickupAudio = true;
      }
    }

    const isAllOff = effectId === 0;
    const patch = {
      [`${legacyPrefix}Switch`]: isAllOff ? 1 : 0,
      [`${legacyPrefix}Mode`]: isAllOff ? 0 : effectId >= 253 ? 253 : effectId,
      lightCustomIndex: effectId >= 253 ? effectId - 253 : 0,
      ...(closePickupAudio ? { pickupLightEffectSwitch: 0 } : {}),
    };

    if (closePickupAudio) {
      setOpenLight(false);
    }

    const next = { ...(keyboard?.deviceFuncInfo ?? {}), ...patch };
    keyboard?.setDeviceFuncInfo?.(next);

    if (lightType === 'backlight' && effectId >= 253) {
      switchingCustomEffectRef.current = true;
      try {
        // 自定义灯光切换时也必须下发“功能区”完整长度（布局 71 需要 128 字节）
        // 颜色表会在拖拽/涂色或 syncCustomKeyColors() 中按自定义槽位读取/下发。
        await connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);

        // 同步当前自定义槽位的 128 键颜色到界面
        await syncCustomKeyColors(effectId);
      } finally {
        switchingCustomEffectRef.current = false;
      }
      return;
    }

    connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
  };

  const debouncedHandleEffectChange = (effectId: number) => {
    if (effectChangeDebounceRef.current) {
      clearTimeout(effectChangeDebounceRef.current);
    }
    effectChangeDebounceRef.current = setTimeout(() => {
      void handleEffectChange(effectId);
      effectChangeDebounceRef.current = null;
    }, 180);
  };

  const handleColorChange = async (hex: string) => {
    setSelectedColor(hex);

    const { r, g, b } = toRgb(hex);

    updateFuncInfo({
      [`${legacyPrefix}RValue`]: r,
      [`${legacyPrefix}GValue`]: g,
      [`${legacyPrefix}BValue`]: b,
    });
  };

  const handleColorfulSwitch = async (checked: boolean) => {
    if (!lightGatesEffectControls) return;
    if (!checked && !canEnableSingleColor) return;
    if (checked && !canEnableColorful) return;

    setSingleColorMode(!checked);


    updateFuncInfo({
      [`${legacyPrefix}MixColor`]: checked ? 1 : 0,
    });
  };

  const handleDirectionChange = async (dir: 0 | 1) => {
    if (!canAdjustDirection) return;
    setPlayDirection(dir);
    const firmwareDir = isPickupLightingModule ? (dir === 1 ? 0 : 1) : dir;
    updateFuncInfo({
      ...(isPickupLightingModule
        ? { pickupLightEffectDirection: firmwareDir }
        : { lightEffectDirection: firmwareDir }),
    });
  };

  /** 自定义灯效：将所有键的自定义点亮设为灭并立即下发到当前自定义槽位 */
  const handleCustomKeyLightsResetAllOff = () => {
    if (!canCustomPaint) return;
    if (paintBatchDebounceRef.current) {
      clearTimeout(paintBatchDebounceRef.current);
      paintBatchDebounceRef.current = null;
    }
    const allOff = new Array(128).fill('#000000');
    latestKeyColorsRef.current = allOff;
    keyboard?.setKeysColor?.(allOff);
    flushCustomColorsToDevice(allOff);
    showMessage({
      message: t('2727'),
      type: 'success',
      duration: 3000,
    });
  };

  const handlePickupAudioSwitch = async (checked: boolean) => {
    if (isPickupLightingModule && (isPickupDynamicLighting || isPickupAllOff)) return;
    setOpenLight(checked);
    const switchByte = isPickupLightingModule
      ? (checked ? 1 : 0) // 拾音：1=开，0=关
      : checked
        ? 0
        : 1; // 普通灯带：0=开，1=关
    updateFuncInfo({
      ...(isPickupLightingModule
        ? { pickupLightEffectSwitch: switchByte }
        : { [`${legacyPrefix}Switch`]: switchByte }),
    });
  };

  if (isMatrixOnly) {
    return <Matrix />;
  }

  return (
    <>
      <Box
        sx={{
          height: '50%',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: 0,
          margin: '0 auto',
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              cursor: canCustomPaint && eyedropperActive ? 'none' : 'default',
            }}
          >
            <TravelVirtualKeyboard
              layoutKeys={displayLayoutKeys}
              travelKeys={travelKeys}
              selectedKeys={selectedKeys}
              travelValue={1.5}
              onToggleKey={toggleKey}
              disableKeyHoverScale
              colorMode={canCustomPaint}
              keyColors={keyColors}
              patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
              onMouseDown={
                canCustomPaint
                  ? (keyIndex, button = 0, clientX?: number, clientY?: number) => {
                    if (typeof clientX === 'number' && typeof clientY === 'number') {
                      latestMousePosRef.current = { x: clientX, y: clientY };
                      setMousePos({ x: clientX, y: clientY });
                    }
                    if (eyedropperPressTimerRef.current) {
                      clearTimeout(eyedropperPressTimerRef.current);
                      eyedropperPressTimerRef.current = null;
                    }
                    if (button === 2) {
                      customPaintModeRef.current = null;
                      eyedropperPressTimerRef.current = setTimeout(() => {
                        customPaintModeRef.current = 'eyedropper';
                        setEyedropperActive(true);
                        tryPickColorFromKey(keyIndex);
                      }, EYEDROPPER_LONG_PRESS_MS);
                      return;
                    }
                    const currentColor = keyColors[keyIndex] || '';
                    const dragColor =
                      currentColor.toUpperCase() === selectedColor.toUpperCase() ? '#000000' : selectedColor;
                    customPaintModeRef.current = 'paint';
                    customPaintDragRef.current = true;
                    customPaintDragColorRef.current = dragColor;
                    paintCustomKeyWithColor(keyIndex, dragColor);
                  }
                  : undefined
              }
              onMouseEnter={
                canCustomPaint
                  ? (keyIndex) => {
                    if (customPaintModeRef.current === 'eyedropper') {
                      tryPickColorFromKey(keyIndex);
                      return;
                    }
                    if (customPaintModeRef.current === 'paint' && customPaintDragRef.current) {
                      const dragColor = customPaintDragColorRef.current;
                      if (dragColor) {
                        paintCustomKeyWithColor(keyIndex, dragColor);
                      }
                    }
                  }
                  : undefined
              }
              onMouseUp={
                canCustomPaint
                  ? () => {
                    if (eyedropperPressTimerRef.current) {
                      clearTimeout(eyedropperPressTimerRef.current);
                      eyedropperPressTimerRef.current = null;
                    }
                    customPaintDragRef.current = false;
                    customPaintDragColorRef.current = null;
                    customPaintModeRef.current = null;
                    setEyedropperActive(false);
                  }
                  : undefined
              }
              onScaleRatioChange={onKeyboardScaleChange}
            />
            {canCustomPaint && eyedropperActive ? (
              <Box
                sx={{
                  position: 'fixed',
                  left: mousePos.x,
                  top: mousePos.y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 99999,
                  pointerEvents: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor:
                    theme.palette.mode === 'dark'
                      ? alpha(theme.palette.background.paper, 0.96)
                      : 'rgba(255,255,255,0.97)',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.22)}`,
                  color: theme.palette.primary.main,
                }}
              >
                <ColorizeOutlinedIcon sx={{ fontSize: 20 }} />
              </Box>
            ) : null}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          mx: 167,
          width: '50%',
          alignSelf: 'center',
          py: 10,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'flex-end',

        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: '20px',
            rowGap: '6px',
            justifyContent: 'flex-end',
            visibility: canCustomPaint ? 'visible' : 'hidden',
            userSelect: canCustomPaint ? 'text' : 'none',
          }}
        >
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
            <CustomPaintMouseHintIcon
              activeButton="left"
              accent={theme.palette.primary.main}
              outline={theme.palette.mode === 'dark' ? 'rgba(248, 250, 252, 0.5)' : '#94a3b8'}
            />
            <Typography
              component="span"
              sx={{
                fontSize: '13px',
                lineHeight: 1.65,
                color: theme.palette.mode === 'dark' ? 'rgba(248, 250, 252, 0.88)' : 'rgba(40, 44, 52, 1)',
                fontWeight: 600
              }}
            >
              {t('7040')}
            </Typography>
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '8px', maxWidth: '100%' }}>
            <CustomPaintMouseHintIcon
              activeButton="right"
              accent={theme.palette.primary.main}
              outline={theme.palette.mode === 'dark' ? 'rgba(248, 250, 252, 0.5)' : '#94a3b8'}
            />
            <Typography
              component="span"
              sx={{
                fontSize: '13px',
                lineHeight: 1.65,
                color: theme.palette.mode === 'dark' ? 'rgba(226, 232, 240, 0.78)' : '#64748b',
                fontWeight: 600
              }}
            >
              {t('7041')}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Box sx={{
        flex: 1, display: 'flex', justifyContent: "center", gap: '16px', maxWidth: "1800px",
        minWidth: "1200px",
        maxHeight: "500px",
        height: '100%',
        width: '100%',
        margin: '0 auto',
        minHeight: 0,
      }}>
        <Box
          sx={{
            width: "550px",
            minWidth: "450px",
            ...lightingPanelCardSx(theme),
            p: 20,
            overflow: "auto"
          }}
        >
          {effectGroups.map((group) => (
            <Box key={group.title} sx={{ mb: 10 }}>
              <Typography sx={{ ...lightingGroupTitleSx(theme), mb: 11 }}>
                {group.title}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: isPickupLightingModule
                    ? 'repeat(3, minmax(0, 1fr))'
                    : 'repeat(4, minmax(0, 1fr))',
                  gap: 8,
                }}
              >
                {group.items.map((item) => {
                  const active = selectedEffect === item.value;
                  return (
                    <ButtonRem
                      key={item.value}
                      onClick={() => debouncedHandleEffectChange(item.value)}
                      variant="text"

                      sx={{
                        ...lightingEffectButtonSx(theme, active),
                      }}
                    >
                      {item.label}
                    </ButtonRem>
                  );
                })}
              </Box>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            width: "400px", minWidth: "350px",
            ...lightingPanelCardSx(theme),
            p: 20,
            overflow: "auto",
          }}
        >

          {isPickupLightingModule ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 12 }}>
              <Typography sx={lightingSectionLabelSx(theme)}>
                {t('1305')}
              </Typography>
              <ToggleSlider
                disabled={isPickupDynamicLighting || isPickupAllOff}
                checked={isPickupDynamicLighting || isPickupAllOff ? false : openLight}
                onChange={(checked) => {
                  void handlePickupAudioSwitch(checked);
                }}
                ariaLabel={t('1305')}
              />
            </Box>
          ) : null}
          <Typography sx={{ ...lightingSectionLabelSx(theme), mb: 8 }}>{t('1676')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <SliderRem
              value={brightness}
              min={0}
              max={100}
              disabled={!canAdjustBrightness}
              onChange={(_, v) => setBrightness(Array.isArray(v) ? v[0] : v)}
              onChangeCommitted={handleBrightnessCommit}
              sx={lightingSliderSx(theme)}
            />
            <Box
              component="input"
              value={brightnessInput}
              disabled={!canAdjustBrightness}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const onlyDigits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                setBrightnessInput(onlyDigits);
              }}
              onBlur={() => { void commitBrightnessInput(); }}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              sx={lightingBrightnessInputSx(theme)}
            />
            <Typography sx={lightingPercentMutedSx(theme)}>%</Typography>
          </Box>


          <Typography sx={{ ...lightingSectionLabelSx(theme), mb: 8 }}>{t('1677')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 9, mb: 3.5 }}>
            <SliderRem
              value={speed}
              min={0}
              max={maxSpeed}
              disabled={!canAdjustSpeed}
              onChange={(_, v) => setSpeed(Array.isArray(v) ? v[0] : v)}
              onChangeCommitted={handleSpeedCommit}
              sx={lightingSliderSx(theme)}
            />
            <Box sx={{ width: '50px', height: '32px' }} />
            <Typography sx={{ color: 'transparent', fontSize: '20px', fontWeight: 600, userSelect: 'none' }}>%</Typography>
          </Box>

          {canAdjustDirection ? (
            <>
              <Typography sx={{ ...lightingSectionLabelSx(theme), mb: 8 }}>{t('1678')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ButtonRem
                  variant="text"
                  onClick={() => void handleDirectionChange(0)}
                  sx={lightingToggleGridButtonSx(theme, playDirection === 0)}
                >
                  {t(directionLabels[0])}
                </ButtonRem>
                <ButtonRem
                  variant="text"
                  onClick={() => void handleDirectionChange(1)}
                  sx={lightingToggleGridButtonSx(theme, playDirection === 1)}
                >
                  {t(directionLabels[1])}
                </ButtonRem>
              </Box>
            </>
          ) : null}

          <Typography sx={{ ...lightingSectionLabelSx(theme), mt: 14, mb: 8 }}>{t('206')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ButtonRem
              disabled={pickupStaticDisableSwatch || !canEnableSingleColor}
              onClick={() => void handleColorfulSwitch(false)}
              variant="text"
              sx={lightingToggleGridButtonSx(theme, singleColorMode)}
            >
              {t('1690')}
            </ButtonRem>
            <ButtonRem
              disabled={!canEnableColorful || pickupStaticDisableSwatch}
              onClick={() => void handleColorfulSwitch(true)}
              variant="text"
              sx={lightingToggleGridButtonSx(theme, !singleColorMode)}
            >
              {t('1691')}
            </ButtonRem>
          </Box>

          {canCustomPaint ? (
            <ButtonRem
              variant="text"
              fullWidth
              onClick={() => {
                showDialog({
                  title: t('631'),
                  content: t('2719'),
                  confirmText: t('1111'),
                  cancelText: t('635'),
                  onConfirm: () => handleCustomKeyLightsResetAllOff(),
                  onCancel: () => { },
                });
              }}
              sx={{
                mt: 14,
                height: '36px',
                borderRadius: '8.8px',
                fontSize: '15px',
                textTransform: 'none',
                ...(theme.palette.mode === 'dark'
                  ? {
                      color: 'rgba(248, 250, 252, 0.75)',
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.42)}`,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      '&:hover': {
                        borderColor: theme.palette.primary.main,
                        color: theme.palette.primary.main,
                        backgroundColor: 'rgba(249, 115, 22, 0.12)',
                      },
                    }
                  : {
                      color: '#5f7089',
                      border: '1px solid rgba(148,163,184,0.55)',
                      backgroundColor: 'rgba(255,255,255,.45)',
                      '&:hover': {
                        borderColor: '#3B82F6',
                        color: '#3B82F6',
                        backgroundColor: 'rgba(59,130,246,.08)',
                      },
                    }),
              }}
            >
              {t('610')}
            </ButtonRem>
          ) : null}
        </Box>

        <Box
          sx={{
            width: "350px",
            minWidth: "350px",
            ...lightingPanelCardSx(theme),
            overflow: "auto",
            p: 20,
          }}
        >
          <ColorPicker
            disabled={!singleColorMode || !canPickSolidColorOnPalette}
            selectColor={selectedColor}
            setSelectColor={(hex) => {
              void handleColorChange(hex);
            }}
          />
        </Box>
      </Box>
    </>
  );
}
