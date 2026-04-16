'use client';

import { Box, Switch, Typography } from '@mui/material';
import { useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import { useTranslation } from '@/app/i18n';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import type { LayoutKey } from '@/types/types_v1';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import ColorPicker from '@/components/ColorPicker';
import { ButtonRem, SliderRem } from '@/styled/ReconstructionRem';
import Matrix from '@/components/Matrix';

type EffectItem = {
  value: number;
  label: string;
};

type EffectGroup = {
  title: string;
  items: EffectItem[];
};

function getGroupTypeByContentId(contentId: string): 'backlight' | 'logo' | null {
  if (contentId.startsWith('id_qmk_rgb_matrix_')) return 'backlight';
  if (contentId.startsWith('id_qmk_rgblight_')) return 'logo';
  return null;
}

function findMenuContentId(
  menus: any[] | undefined,
  lightType: string,
  matcher: (item: any) => boolean
): [number, number] | null {
  const lightingMenu = menus?.find((m: any) => m.label === 'Lighting');
  if (!lightingMenu) return null;

  const targetType = lightType === 'backlight' ? 'backlight' : 'logo';

  for (const group of lightingMenu.content ?? []) {
    const allItems: any[] = group.content ?? [];
    const probe = allItems.find(
      (i: any) => Array.isArray(i.content) && i.content.length >= 3 && typeof i.content[0] === 'string'
    );
    if (!probe) continue;

    const groupType = getGroupTypeByContentId(probe.content[0] as string);
    if (groupType !== targetType) continue;

    const item = allItems.find(matcher);
    if (!item || !Array.isArray(item.content) || item.content.length < 3) return null;
    return [item.content[1] as number, item.content[2] as number];
  }

  return null;
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

type LightSettingPanelProps = {
  forcedLightType?: 'backlight' | 'logolight' | 'sidelight' | 'matrixlight';
};

export default function LightSettingPanel({ forcedLightType }: LightSettingPanelProps = {}) {
  const { t } = useTranslation('common');
  const isMatrixOnly = forcedLightType === 'matrixlight';

  const { connectedKeyboard, keyboard, keyboardLayout } = useContext(ConnectKbContext);

  const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
  const travelKeys = keyboard?.travelKeys ?? [];

  const isQMK = keyboard?.keyboardType === 'QMK';
  const menus: any[] | undefined = keyboardLayout?.menus;

  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [openLight, setOpenLight] = useState(true);
  const [brightness, setBrightness] = useState(100);
  const [brightnessInput, setBrightnessInput] = useState('100');
  const [speed, setSpeed] = useState(40);
  const [singleColorMode, setSingleColorMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FF0000');
  const [playDirection, setPlayDirection] = useState<0 | 1>(0);

  const lightType = forcedLightType ?? keyboard?.lightType ?? 'backlight';
  const isPickupLightingModule = forcedLightType === 'logolight';
  const legacyPrefix = lightType === 'logolight' ? 'logoLight' : lightType === 'sidelight' ? 'sideLight' : 'light';
  const qmkGroupType = lightType === 'backlight' ? 'backlight' : 'logo';

  const maxBrightness = useMemo(() => {
    if (isQMK) {
      return keyboardLayout?.lighting?.maxBrightness?.[qmkGroupType]?.[1] ?? keyboard?.deviceBaseInfo?.lightMaxBrightness ?? 255;
    }
    return keyboard?.deviceBaseInfo?.lightMaxBrightness ?? 255;
  }, [isQMK, keyboardLayout, keyboard?.deviceBaseInfo?.lightMaxBrightness, qmkGroupType]);

  const maxSpeed = useMemo(() => {
    if (isQMK) {
      return keyboardLayout?.lighting?.maxSpeed?.[qmkGroupType]?.[1] ?? keyboard?.deviceBaseInfo?.lightMaxSpeed ?? 255;
    }
    return keyboard?.deviceBaseInfo?.lightMaxSpeed ?? 255;
  }, [isQMK, keyboardLayout, keyboard?.deviceBaseInfo?.lightMaxSpeed, qmkGroupType]);

  const lightEffects = useMemo(() => {
    if (isQMK) {
      const effects = keyboardLayout?.lighting?.effects?.[qmkGroupType] ?? [];
      return effects.map((effect: any, idx: number) => ({
        ...effect,
        value: effect.value ?? idx,
        label: effect.name || effect.lang || `Effect ${idx + 1}`,
      }));
    }

    const list = keyboardLayout?.lighting?.[lightType] ?? [];
    return list.map((effect: any, idx: number) => ({
      ...effect,
      value: effect.value ?? idx,
      label: effect.name || effect.lang || `Effect ${idx + 1}`,
    }));
  }, [isQMK, keyboardLayout, qmkGroupType, lightType]);

  const selectedEffect = useMemo(() => {
    const mode = keyboard?.deviceFuncInfo?.[`${legacyPrefix}Mode`] ?? 0;
    const custom = keyboard?.deviceFuncInfo?.lightCustomIndex ?? 0;
    return mode + custom;
  }, [keyboard?.deviceFuncInfo, legacyPrefix]);

  const currentLightInfo = useMemo<any>(() => {
    return lightEffects.find((effect: any) => effect.value === selectedEffect) ?? null;
  }, [lightEffects, selectedEffect]);

  const canAdjustBrightness = openLight && Boolean(currentLightInfo?.brightness);
  const canAdjustSpeed = openLight && Boolean(currentLightInfo?.speed);
  const canAdjustDirection = openLight && Boolean(currentLightInfo?.direction);
  const canEnableColorful = openLight && Boolean(currentLightInfo?.color);
  const isCustomEffect = selectedEffect >= 253;
  const canCustomPaint = !isQMK && lightType === 'backlight' && openLight && isCustomEffect;
  const switchingCustomEffectRef = useRef(false);
  const customPaintDragRef = useRef(false);
  const customPaintDragColorRef = useRef<string | null>(null);
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

    const staticEffectsRaw = lightEffects.filter((e: any) => {
      const isOff = e.value === 0 || (typeof e.label === 'string' && e.label.includes(t('1675')));
      return e.color === false || isOff;
    });
    const hasOff = staticEffectsRaw.some((e: any) => e.value === 0 || (typeof e.label === 'string' && e.label.includes(t('1675'))));
    const staticEffects = hasOff ? staticEffectsRaw : [{ value: 0, label: t('1675') }, ...staticEffectsRaw];
    const dynamicEffects = lightEffects.filter((e: any) => {
      const isOff = e.value === 0 || (typeof e.label === 'string' && e.label.includes(t('1675')));
      return !(e.color === false || isOff);
    });

    return [
      { title: t('1672'), items: staticEffects.length ? staticEffects : lightEffects.slice(0, 1) },
      { title: t('1674'), items: dynamicEffects },
    ];
  }, [lightEffects, t]);

  useEffect(() => {
    const info = keyboard?.deviceFuncInfo;
    if (!info) return;

    const lightSwitchRaw = Number(
      isPickupLightingModule
        ? info.pickupLightEffectSwitch ?? 0
        : info[`${legacyPrefix}Switch`] ?? 0
    );
    setOpenLight(lightSwitchRaw === 0);

    const rawBrightness = info[`${legacyPrefix}Brightness`] ?? 0;
    const nextBrightness = Math.round((rawBrightness / (maxBrightness || 1)) * 100);
    setBrightness(Number.isFinite(nextBrightness) ? nextBrightness : 0);
    setBrightnessInput(String(Number.isFinite(nextBrightness) ? nextBrightness : 0));

    const rawSpeed = info[`${legacyPrefix}Speed`] ?? 0;
    setSpeed(rawSpeed);

    setSingleColorMode((info[`${legacyPrefix}MixColor`] ?? 1) === 0);

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
  }, [keyboard?.deviceFuncInfo, isPickupLightingModule, legacyPrefix, maxBrightness]);

  useEffect(() => {
    if (isQMK) return;
    if (currentLightInfo?.color !== false) return;
    if (singleColorMode) return;

    setSingleColorMode(true);
    updateFuncInfo({ [`${legacyPrefix}MixColor`]: 0 });
  }, [isQMK, currentLightInfo?.color, singleColorMode, legacyPrefix]);

  useEffect(() => {
    if (!canCustomPaint) return;
    if (switchingCustomEffectRef.current) return;
    void syncCustomKeyColors(selectedEffect);
  }, [canCustomPaint, selectedEffect]);

  useEffect(() => {
    latestKeyColorsRef.current = keyColors;
  }, [keyColors]);

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
      customPaintDragRef.current = false;
      customPaintDragColorRef.current = null;
    };
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('blur', endDrag);
    return () => {
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('blur', endDrag);
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
    connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
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
    void connectedKeyboard?.setUserAllKeyColorByLight?.(customIndex, fullLightColors);
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
    if (isQMK || lightType !== 'backlight' || effectId < 253) return;
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

    if (isQMK) {
      const ci = findMenuContentId(menus, qmkGroupType, (i) => i.type === 'range' && i.label === 'Brightness');
      if (ci) await connectedKeyboard?.setLightingValue(ci[0], ci[1], raw);
      return;
    }

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

    if (isQMK) {
      const ci = findMenuContentId(menus, qmkGroupType, (i) => i.type === 'range' && i.label === 'Effect Speed');
      if (ci) await connectedKeyboard?.setLightingValue(ci[0], ci[1], v);
      return;
    }

    updateFuncInfo({ [`${legacyPrefix}Speed`]: v });
  };

  const handleEffectChange = async (effectId: number) => {
    if (isQMK) {
      const ci = findMenuContentId(menus, qmkGroupType, (i) => i.type === 'dropdown');
      if (ci) await connectedKeyboard?.setLightingValue(ci[0], ci[1], effectId);
      keyboard?.setDeviceFuncInfo?.({
        ...(keyboard?.deviceFuncInfo ?? {}),
        [`${legacyPrefix}Mode`]: effectId,
        lightCustomIndex: 0,
      });
      return;
    }

    const patch = {
      [`${legacyPrefix}Mode`]: effectId >= 253 ? 253 : effectId,
      lightCustomIndex: effectId >= 253 ? effectId - 253 : 0,
    };

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

    if (isQMK) {
      const ci = findMenuContentId(menus, qmkGroupType, (i) => i.type === 'color');
      if (ci) await connectedKeyboard?.setLightingValue(ci[0], ci[1], r, g, b);
      return;
    }

    updateFuncInfo({
      [`${legacyPrefix}RValue`]: r,
      [`${legacyPrefix}GValue`]: g,
      [`${legacyPrefix}BValue`]: b,
    });
  };

  const handleColorfulSwitch = async (checked: boolean) => {
    if (!canEnableColorful) return;

    setSingleColorMode(!checked);

    if (isQMK) return;

    updateFuncInfo({
      [`${legacyPrefix}MixColor`]: checked ? 1 : 0,
    });
  };

  const handleDirectionChange = async (dir: 0 | 1) => {
    if (!canAdjustDirection) return;
    setPlayDirection(dir);
    if (isQMK) return;
    const firmwareDir = isPickupLightingModule ? (dir === 1 ? 0 : 1) : dir;
    updateFuncInfo({
      ...(isPickupLightingModule
        ? { pickupLightEffectDirection: firmwareDir }
        : { lightEffectDirection: firmwareDir }),
    });
  };

  const handlePickupAudioSwitch = async (checked: boolean) => {
    setOpenLight(checked);
    if (isQMK) return;
    // 固件语义：0=开，1=关
    const switchByte = checked ? 0 : 1;
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
          gap: '1.25rem',
          minHeight: 0,
          margin: '0 auto',
          justifyContent: "center"
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <TravelVirtualKeyboard
              layoutKeys={layoutKeys}
              travelKeys={travelKeys}
              selectedKeys={selectedKeys}
              travelValue={1.5}
              onToggleKey={toggleKey}
              colorMode={canCustomPaint}
              keyColors={keyColors}
              patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
              onMouseDown={
                canCustomPaint
                  ? (keyIndex) => {
                      const currentColor = keyColors[keyIndex] || '';
                      const dragColor =
                        currentColor.toUpperCase() === selectedColor.toUpperCase() ? '#000000' : selectedColor;
                      customPaintDragRef.current = true;
                      customPaintDragColorRef.current = dragColor;
                      paintCustomKeyWithColor(keyIndex, dragColor);
                    }
                  : undefined
              }
              onMouseEnter={
                canCustomPaint
                  ? (keyIndex) => {
                      if (customPaintDragRef.current) {
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
                      customPaintDragRef.current = false;
                      customPaintDragColorRef.current = null;
                    }
                  : undefined
              }
            />
          </Box>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minHeight: '20rem', display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.95fr', gap: '1rem', mx: 167, width: '80%' }}>
        <Box
          sx={{
            borderRadius: '0.875rem',
            border: '0.0625rem solid rgba(153,169,191,0.22)',
            background: 'rgba(255,255,255,0.42)',
            backdropFilter: 'blur(0.375rem)',
            p: 20,
          }}
        >
          {effectGroups.map((group) => (
            <Box key={group.title} sx={{ mb: 10 }}>
              <Typography sx={{ fontSize: '1.125rem', fontWeight: "400", color: "rgba(100, 116, 139, 1)", mb: 11, letterSpacing: '0.4px' }}>
                {group.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                {group.items.map((item) => {
                  const active = selectedEffect === item.value;
                  return (
                    <ButtonRem
                      key={item.value}
                      onClick={() => debouncedHandleEffectChange(item.value)}
                      variant="text"

                      sx={{
                        height: '2.125rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        textTransform: 'none',
                        color: active ? '#fff' : '#5f7089',
                        backgroundColor: active ? '#3B82F6' : '',
                        '&:hover': {
                          border: '0.0625rem solid #3B82F6',
                          boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                        },
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
            minWidth: 0,
            borderRadius: '0.875rem',
            border: '0.0625rem solid rgba(153,169,191,0.22)',
            background: 'rgba(255,255,255,0.42)',
            backdropFilter: 'blur(0.375rem)',
            p: 20,
          }}
        >

          {isPickupLightingModule ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 12 }}>
              <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700 }}>
                {t('1305')}
              </Typography>
              <Switch
                checked={openLight}
                onChange={(_, checked) => {
                  void handlePickupAudioSwitch(checked);
                }}
              />
            </Box>
          ) : null}
          <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t('1676')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <SliderRem
              value={brightness}
              min={0}
              max={100}
              disabled={!canAdjustBrightness}
              onChange={(_, v) => setBrightness(Array.isArray(v) ? v[0] : v)}
              onChangeCommitted={handleBrightnessCommit}
              sx={{
                color: '#3B82F6',
                '& .MuiSlider-rail': { backgroundColor: '#ECEFF4', opacity: 1, height: '0.75rem', borderRadius: '999px' },
                '& .MuiSlider-track': { height: '0.75rem', borderRadius: '999px', border: 'none' },
                '& .MuiSlider-thumb': {
                  width: '2rem',
                  height: '2rem',
                  border: '0.25rem solid #fff',
                  boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                },
              }}
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
              sx={{
                ml: 10,
                width: '3.125rem',
                height: '2rem',
                borderRadius: '0.5rem',
                border: '0.0625rem solid #E2E8F0',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '.95rem',
                fontWeight: 600,
                outline: 'none',
                backgroundColor: '#fff',
              }}
            />
            <Typography sx={{ color: '#94A3B8', fontSize: '1.25rem', fontWeight: 600 }}>%</Typography>
          </Box>


          <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t('1677')}</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3.5 }}>
            <SliderRem
              value={speed}
              min={0}
              max={maxSpeed}
              disabled={!canAdjustSpeed}
              onChange={(_, v) => setSpeed(Array.isArray(v) ? v[0] : v)}
              onChangeCommitted={handleSpeedCommit}
              sx={{
                color: '#3B82F6',
                '& .MuiSlider-rail': { backgroundColor: '#ECEFF4', opacity: 1, height: '0.75rem', borderRadius: '999px' },
                '& .MuiSlider-track': { height: '0.75rem', borderRadius: '999px', border: 'none' },
                '& .MuiSlider-thumb': {
                  width: '1.9rem',
                  height: '2rem',
                  border: '0.25rem solid #fff',
                  boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                },
              }}
            />
            <Box sx={{ width: '3.125rem', height: '2rem' }} />
            <Typography sx={{ color: 'transparent', fontSize: '1.25rem', fontWeight: 600, userSelect: 'none' }}>%</Typography>
          </Box>

          {canAdjustDirection ? (
            <>
              <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t('1678')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <ButtonRem
                  variant="text"
                  onClick={() => void handleDirectionChange(0)}
                  sx={{
                    height: '2.25rem',
                    borderRadius: '0.55rem',
                    fontSize: '.95rem',
                    textTransform: 'none',
                    color: playDirection === 0 ? '#fff' : '#5f7089',
                    backgroundColor: playDirection === 0 ? '#3B82F6' : 'rgba(255,255,255,.35)',
                    '&:hover': { border: '0.0625rem solid #3B82F6', boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)', },
                  }}
                >
                  {t(directionLabels[0])}
                </ButtonRem>
                <ButtonRem
                  variant="text"
                  onClick={() => void handleDirectionChange(1)}
                  sx={{
                    height: '2.25rem',
                    borderRadius: '0.55rem',
                    fontSize: '.95rem',
                    textTransform: 'none',
                    color: playDirection === 1 ? '#fff' : '#5f7089',
                    backgroundColor: playDirection === 1 ? '#3B82F6' : 'rgba(255,255,255,.35)',
                    '&:hover': { border: '0.0625rem solid #3B82F6', boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)', },
                  }}
                >
                  {t(directionLabels[1])}
                </ButtonRem>
              </Box>
            </>
          ) : null}

          <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mt: 14, mb: 8 }}>{t('206')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ButtonRem
              disabled={!canEnableColorful}
              onClick={() => void handleColorfulSwitch(false)}
              variant="text"
              sx={{
                height: '2.25rem',
                borderRadius: '0.55rem',
                fontSize: '.95rem',
                textTransform: 'none',
                color: singleColorMode ? '#fff' : '#5f7089',
                backgroundColor: singleColorMode ? '#3B82F6' : 'rgba(255,255,255,.35)',
                '&:hover': {
                  border: '0.0625rem solid #3B82F6',
                  boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                },
              }}
            >
              {t('1690')}
            </ButtonRem>
            <ButtonRem
              disabled={!canEnableColorful}
              onClick={() => void handleColorfulSwitch(true)}
              variant="text"
              sx={{
                height: '2.25rem',
                borderRadius: '0.55rem',
                fontSize: '.95rem',
                textTransform: 'none',
                color: !singleColorMode ? '#fff' : '#5f7089',
                backgroundColor: !singleColorMode ? '#3B82F6' : 'rgba(255,255,255,.35)',
                '&:hover': {
                  border: '0.0625rem solid #3B82F6',
                  boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                },
              }}
            >
              {t('1691')}
            </ButtonRem>
          </Box>
        </Box>

        <Box
          sx={{
            minWidth: 0,
            borderRadius: '0.875rem',
            border: '0.0625rem solid rgba(153,169,191,0.22)',
            background: 'rgba(255,255,255,0.42)',
            backdropFilter: 'blur(0.375rem)',
            p: 20,
          }}
        >
          <ColorPicker
            disabled={!openLight || !singleColorMode}
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
