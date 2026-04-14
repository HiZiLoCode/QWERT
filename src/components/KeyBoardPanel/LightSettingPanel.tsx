'use client';

import { Box, Typography } from '@mui/material';
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

  const lightType = forcedLightType ?? keyboard?.lightType ?? 'backlight';
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
  const canEnableColorful = openLight && Boolean(currentLightInfo?.color);
  const isCustomEffect = selectedEffect >= 253;
  const canCustomPaint = !isQMK && lightType === 'backlight' && openLight && isCustomEffect;
  const keyColors: string[] = keyboard?.keysColor ?? [];
  const lightMatrix: number[] = keyboard?.lightMatrix ?? [];

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

    setOpenLight((info[`${legacyPrefix}Switch`] ?? 0) === 0);

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
  }, [keyboard?.deviceFuncInfo, legacyPrefix, maxBrightness]);

  useEffect(() => {
    if (isQMK) return;
    if (currentLightInfo?.color !== false) return;
    if (singleColorMode) return;

    setSingleColorMode(true);
    updateFuncInfo({ [`${legacyPrefix}MixColor`]: 0 });
  }, [isQMK, currentLightInfo?.color, singleColorMode, legacyPrefix]);

  useEffect(() => {
    if (!canCustomPaint) return;
    void syncCustomKeyColors(selectedEffect);
  }, [canCustomPaint, selectedEffect]);

  useEffect(() => {
    return () => {
      paintKeyColorDebounceRef.current.forEach((timer) => clearTimeout(timer));
      paintKeyColorDebounceRef.current.clear();
    };
  }, []);

  const toggleKey = (keyIndex: number) => {
    if (canCustomPaint) {
      paintCustomKey(keyIndex, selectedColor);
      return;
    }

    setSelectedKeys((prev) =>
      prev.includes(keyIndex) ? prev.filter((k) => k !== keyIndex) : [...prev, keyIndex]
    );
  };

  const paintKeyColorDebounceRef = useRef(
    new Map<number, ReturnType<typeof setTimeout>>()
  );

  const updateFuncInfo = (patch: Record<string, unknown>) => {
    const next = { ...(keyboard?.deviceFuncInfo ?? {}), ...patch };
    keyboard?.setDeviceFuncInfo?.(next);
    connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
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

    const customIndex = selectedEffect - 253;
    const currentColor = keyColors[keyIndex] || '';
    const color = currentColor.toUpperCase() === hex.toUpperCase() ? '#000000' : hex;

    keyboard?.setKeysColor?.((prev: string[]) => {
      const next = [...(Array.isArray(prev) ? prev : [])];
      next[keyIndex] = color;
      return next;
    });

    const pending = paintKeyColorDebounceRef.current.get(keyIndex);
    if (pending) {
      clearTimeout(pending);
    }

    const timer = setTimeout(() => {
      void connectedKeyboard?.setUserKeyColor?.(customIndex, lightIndex, color);
      paintKeyColorDebounceRef.current.delete(keyIndex);
    }, 180);

    paintKeyColorDebounceRef.current.set(keyIndex, timer);
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
      const rgbData = await connectedKeyboard?.setUserLightInfo?.(
        next,
        effectId - 253,
        keyboard?.deviceBaseInfo?.protocolVer
      );
      if (Array.isArray(rgbData)) {
        const mapped = new Array(128).fill('#000000').map((_, index) => {
          const li = lightMatrix[index];
          return li != null && li < rgbData.length ? rgbData[li] || '#000000' : '#000000';
        });
        keyboard?.setKeysColor?.(mapped);
      } else {
        await syncCustomKeyColors(effectId);
      }
      return;
    }

    connectedKeyboard?.setFuncInfo?.(next, keyboard?.deviceBaseInfo?.protocolVer);
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

  if (isMatrixOnly) {
    return <Matrix />;
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        minHeight: 0,
        margin: '0 auto',
      }}
    >
      <Box sx={{ height: '50%', minHeight: 0, display: 'flex', flexDirection: 'column', width: '100%' }}>
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
          />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: '20rem', display: 'grid', gridTemplateColumns: '1.6fr 1fr 0.95fr', gap: '1rem' }}>
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
              <Typography sx={{ fontSize: '1.125rem',fontWeight: "400", color: "rgba(100, 116, 139, 1)", mb: 11, letterSpacing: '0.4px' }}>
                {group.title}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
                {group.items.map((item) => {
                  const active = selectedEffect === item.value;
                  return (
                    <ButtonRem
                      key={item.value}
                      onClick={() => handleEffectChange(item.value)}
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
            borderRadius: '0.875rem',
            border: '0.0625rem solid rgba(153,169,191,0.22)',
            background: 'rgba(255,255,255,0.42)',
            backdropFilter: 'blur(0.375rem)',
            p: 20,
          }}
        >
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

          <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t('1678')}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <ButtonRem
              variant="text"
              sx={{
                height: '2.25rem',
                borderRadius: '0.55rem',
                fontSize: '.95rem',
                textTransform: 'none',
                color: '#fff',
                backgroundColor: '#3B82F6',
                '&:hover': { border: '0.0625rem solid #3B82F6', boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)', },
              }}
            >
              {t('1617')}
            </ButtonRem>
            <ButtonRem
              variant="text"
              sx={{
                height: '2.25rem',
                borderRadius: '0.55rem',
                fontSize: '.95rem',
                textTransform: 'none',
                color: '#5f7089',
                '&:hover': { border: '0.0625rem solid #3B82F6', boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)', },
              }}
            >
              {t('1615')}
            </ButtonRem>
          </Box>

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
    </Box>
  );
}
