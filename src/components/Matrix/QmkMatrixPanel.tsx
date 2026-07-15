import React, { useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import ColorPicker from '../ColorPicker';
import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import { debounce } from 'lodash';
import { ButtonRem, SliderRem } from '@/styled/ReconstructionRem';
import TravelVirtualKeyboard from '../TravelVirtualKeyboard';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';
import {
  lightingEffectButtonSx,
  lightingGroupTitleSx,
  lightingPanelCardSx,
  lightingPercentMutedSx,
  lightingSectionLabelSx,
  lightingSliderSx,
  lightingBrightnessInputSx,
} from '@/constants/lightingPanelChrome';
import { getComfortableScrollbarSx } from '@/utils/comfortableScrollbarSx';
import type { MatrixScreenProtocol } from '@/config/deviceInfo';
import {
  findMenuContentIdByGroupLabel,
  hexToQmkHueSatBytes,
  qmkHueSatBytesToHex,
  resolveQmkFuncInfoPrefixForLabel,
} from '@/utils/qmkLightingBridge';
import type { MatrixLightMeta } from '@/utils/matrixLightConfig';
import type { LatticeScreenComm } from '@/devices/lattice/LatticeScreenDevice';

const rgbToHex = (r: number, g: number, b: number) => {
  const rr = Math.max(0, Math.min(255, r));
  const gg = Math.max(0, Math.min(255, g));
  const bb = Math.max(0, Math.min(255, b));
  return `#${rr.toString(16).padStart(2, '0')}${gg
    .toString(16)
    .padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`.toUpperCase();
};

function resolveEffectLabel(effect: { lang?: string; name?: string }, t: (key: string) => string): string {
  const langKey = typeof effect?.lang === 'string' ? effect.lang : '';
  if (langKey) {
    const translated = t(langKey);
    if (translated && translated !== langKey) return translated;
  }
  return effect?.name ?? langKey;
}

export default function QmkMatrixPanel() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { matrixData, keyboard, keyboardLayout, connectedKeyboard } = useContext(ConnectKbContext);
  const { t } = useTranslation();

  const {
    LightMode,
    selectedColor,
    setSelectedColor,
    setLightMode,
    brightnessValue,
    setBrightnessValue,
    speedValue,
    setSpeedValue,
    latticeDevice,
  } = matrixData;

  const deviceBaseInfo = keyboard?.deviceBaseInfo;
  const deviceFuncInfo = keyboard?.deviceFuncInfo;
  const matrixLightList = keyboardLayout?.lighting?.matrixlight ?? [];
  const matrixLightMeta: MatrixLightMeta | undefined = (keyboardLayout?.lighting as any)?.matrixLightMeta;
  const qmkMenus: any[] | undefined = keyboardLayout?.menus;
  const protocol: MatrixScreenProtocol = deviceBaseInfo?.matrixScreenProtocol ?? 'qmk-via';
  const groupLabel: string = deviceBaseInfo?.matrixLightGroupLabel ?? 'Lattice';
  const closeMode = matrixLightMeta?.close ?? deviceBaseInfo?.matrixScreenLightSize ?? 0;
  const legacyPrefix = resolveQmkFuncInfoPrefixForLabel(qmkMenus, groupLabel);

  const layoutKeys = keyboard?.layoutKeys ?? [];
  const travelKeys = keyboard?.travelKeys ?? [];
  const defaultLayerUserKeys = keyboard?.userKeys?.[0] ?? [];
  const displayLayoutKeys = useMemo(
    () => mergeLayoutKeysWithUserKeyNames(layoutKeys, defaultLayerUserKeys),
    [layoutKeys, defaultLayerUserKeys],
  );

  const [brightnessInput, setBrightnessInput] = useState('0');
  const matrixSpeedMax = Math.max(deviceBaseInfo?.matrixScreenLightMaxSpeed || 4, 1);
  const brightnessMax = Math.max(deviceBaseInfo?.matrixScreenLightMaxBrightness || 130, 1);

  const currentEffect = useMemo(
    () => matrixLightList.find((item: any) => item.value === LightMode),
    [matrixLightList, LightMode],
  );
  const showBrightness = currentEffect?.brightness !== false && LightMode !== closeMode;
  const showSpeed = currentEffect?.speed !== false && LightMode !== closeMode;
  const showColor = currentEffect?.color !== false && LightMode !== closeMode;

  useEffect(() => {
    if (!deviceBaseInfo || !deviceFuncInfo) return;

    matrixData.setRows(deviceBaseInfo.matrixScreenLightRows || 7);
    matrixData.setCols(deviceBaseInfo.matrixScreenLightColumns || 7);

    if (protocol === 'lattice-hid') return;

    const mode = deviceFuncInfo[`${legacyPrefix}Mode`] ?? deviceFuncInfo.matrixScreenLightMode ?? 0;
    setLightMode(mode);

    const rawBrightness =
      deviceFuncInfo[`${legacyPrefix}Brightness`] ?? deviceFuncInfo.matrixScreenLightBrightness ?? 0;
    setBrightnessValue(Math.max(5, Math.round((rawBrightness / brightnessMax) * 100)));

    const rawSpeed = deviceFuncInfo[`${legacyPrefix}Speed`] ?? deviceFuncInfo.matrixScreenLightSpeed ?? 0;
    setSpeedValue(Math.max(0, Math.min(matrixSpeedMax, matrixSpeedMax - rawSpeed)));

    const hue = deviceFuncInfo[`${legacyPrefix}RValue`] ?? deviceFuncInfo.matrixScreenLightRValue ?? 0;
    const sat = deviceFuncInfo[`${legacyPrefix}GValue`] ?? deviceFuncInfo.matrixScreenLightGValue ?? 0;
    if (protocol === 'qmk-via') {
      setSelectedColor(qmkHueSatBytesToHex(hue, sat));
    } else {
      setSelectedColor(rgbToHex(hue, sat, deviceFuncInfo.matrixScreenLightBValue ?? 0));
    }
  }, [deviceBaseInfo, deviceFuncInfo, matrixSpeedMax, brightnessMax, legacyPrefix, protocol]);

  useEffect(() => {
    if (protocol !== 'lattice-hid' || !latticeDevice || !deviceBaseInfo) return;

    void (async () => {
      try {
        const dev = latticeDevice as LatticeScreenComm;
        const modeRes = await dev.getLightMode();
        const brightRes = await dev.getLightBrightness();
        const speedRes = await dev.getLightSpeed();
        setLightMode(modeRes.lightMode);
        setBrightnessValue(
          Math.max(5, Math.round((brightRes.brightness / (dev.maxLightBrightness || 100)) * 100)),
        );
        setSpeedValue(Math.max(0, Math.min(matrixSpeedMax, matrixSpeedMax - speedRes.speed)));
      } catch (error) {
        console.warn('[QmkMatrix] 读取点阵屏状态失败:', error);
      }
    })();
  }, [latticeDevice, protocol, deviceBaseInfo, matrixSpeedMax]);

  useEffect(() => {
    setBrightnessInput(String(brightnessValue || 0));
  }, [brightnessValue]);

  const patchFuncInfo = (patch: Record<string, unknown>) => {
    const base = keyboard?.deviceFuncInfo ?? deviceFuncInfo ?? {};
    keyboard?.setDeviceFuncInfo({ ...base, ...patch });
  };

  const debouncedUpdateLightSpeed = useRef(
    debounce(async (uiSpeed: number, prefix: string, menus: any[], label: string, proto: MatrixScreenProtocol, dev: LatticeScreenComm | null, kb: any, speedMax: number) => {
      const firmwareSpeed = Math.max(0, Math.min(speedMax, speedMax - uiSpeed));
      if (proto === 'lattice-hid' && dev) {
        await dev.setLightSpeed(firmwareSpeed);
        patchFuncInfo({ matrixScreenLightSpeed: firmwareSpeed });
        return;
      }
      const ci = findMenuContentIdByGroupLabel(menus, label, (i) => i.type === 'range' && i.label === 'Effect Speed');
      if (ci) await kb?.setLightingValue?.(ci[0], ci[1], firmwareSpeed);
      patchFuncInfo({
        [`${prefix}Speed`]: firmwareSpeed,
        matrixScreenLightSpeed: firmwareSpeed,
      });
    }, 200),
  ).current;

  const debouncedUpdateLightBrightness = useRef(
    debounce(async (brightness: number, prefix: string, menus: any[], label: string, proto: MatrixScreenProtocol, dev: LatticeScreenComm | null, kb: any, maxBright: number) => {
      const normalizedBrightness = Math.max(5, Math.min(100, brightness));
      const raw = Math.round(maxBright * (normalizedBrightness / 100));
      if (proto === 'lattice-hid' && dev) {
        await dev.setLightBrightness(normalizedBrightness);
        patchFuncInfo({ matrixScreenLightBrightness: raw });
        return;
      }
      const ci = findMenuContentIdByGroupLabel(menus, label, (i) => i.type === 'range' && i.label === 'Brightness');
      if (ci) await kb?.setLightingValue?.(ci[0], ci[1], raw);
      patchFuncInfo({
        [`${prefix}Brightness`]: raw,
        matrixScreenLightBrightness: raw,
      });
    }, 200),
  ).current;

  const handleQmkViaMode = async (value: number) => {
    const ci = findMenuContentIdByGroupLabel(qmkMenus, groupLabel, (i) => i.type === 'dropdown');
    if (ci) await connectedKeyboard?.setLightingValue?.(ci[0], ci[1], value);
    setLightMode(value);
    patchFuncInfo({
      [`${legacyPrefix}Mode`]: value,
      matrixScreenLightMode: value,
    });
  };

  const handleLatticeHidMode = async (value: number) => {
    const dev = latticeDevice as LatticeScreenComm | null;
    if (!dev) return;
    await dev.setLightMode(value);
    setLightMode(value);
    patchFuncInfo({ matrixScreenLightMode: value });
    if (value === matrixLightMeta?.custom) {
      try {
        const rows = deviceBaseInfo?.matrixScreenLightRows || 7;
        const cols = deviceBaseInfo?.matrixScreenLightColumns || 7;
        await dev.readCustomLightColor(rows, cols);
      } catch (error) {
        console.warn('[QmkMatrix] 回读自定义点阵失败:', error);
      }
    }
  };

  const handleLightModeToggle = async (value: number) => {
    if (!connectedKeyboard && protocol !== 'lattice-hid') return;
    if (protocol === 'lattice-hid') {
      await handleLatticeHidMode(value);
      return;
    }
    if (protocol === 'qmk-via') {
      await handleQmkViaMode(value);
      return;
    }
  };

  const handleSpeedChange = (newValue: number) => {
    const normalized = Math.max(0, Math.min(matrixSpeedMax, newValue));
    setSpeedValue(normalized);
    debouncedUpdateLightSpeed(
      normalized,
      legacyPrefix,
      qmkMenus,
      groupLabel,
      protocol,
      latticeDevice,
      connectedKeyboard,
      matrixSpeedMax,
    );
  };

  const handleBrightnessChange = (newValue: number) => {
    const normalized = Math.max(5, Math.min(100, newValue));
    setBrightnessValue(normalized);
    debouncedUpdateLightBrightness(
      normalized,
      legacyPrefix,
      qmkMenus,
      groupLabel,
      protocol,
      latticeDevice,
      connectedKeyboard,
      brightnessMax,
    );
  };

  const handleColorChange = async (color: string) => {
    if (!color?.startsWith('#')) return;
    setSelectedColor(color);
    if (protocol === 'qmk-via') {
      const { hByte, sByte } = hexToQmkHueSatBytes(color);
      const ci = findMenuContentIdByGroupLabel(qmkMenus, groupLabel, (i) => i.type === 'color');
      if (ci) await connectedKeyboard?.setLightingValue?.(ci[0], ci[1], hByte, sByte);
      patchFuncInfo({
        [`${legacyPrefix}RValue`]: hByte,
        [`${legacyPrefix}GValue`]: sByte,
      });
    }
  };

  const commitBrightnessInput = () => {
    const parsed = Number.parseInt(brightnessInput || '0', 10);
    if (Number.isNaN(parsed)) {
      setBrightnessInput(String(brightnessValue || 0));
      return;
    }
    handleBrightnessChange(parsed);
  };

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
          width: '100%',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
            <TravelVirtualKeyboard
              layoutKeys={displayLayoutKeys}
              travelKeys={travelKeys}
              patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
              selectedKeys={[]}
              travelValue={1.5}
              onToggleKey={() => {}}
              disableKeyHoverScale
              colorMode={false}
              keyColors={[]}
            />
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: '16px',
          maxWidth: '1800px',
          minWidth: '1200px',
          maxHeight: '500px',
          height: '100%',
          width: '100%',
          margin: '0 auto',
          minHeight: 0,
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '550px',
            minWidth: '450px',
            ...lightingPanelCardSx(theme),
            p: 20,
            boxSizing: 'border-box',
            overflow: 'auto',
            ...getComfortableScrollbarSx(isDark),
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, mb: 2 }}>
            <Typography sx={{ ...lightingGroupTitleSx(theme), mb: 11 }}>{t('1001')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', overflowY: 'auto' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32%', flexBasis: '32%', flexGrow: 0, pt: '5.2px' }}>
              <ButtonRem
                onClick={() => handleLightModeToggle(closeMode)}
                fullWidth
                variant="text"
                sx={{
                  ...lightingEffectButtonSx(theme, closeMode === LightMode),
                }}
              >
                {t('1675')}
              </ButtonRem>
            </Box>
            {matrixLightList.map((item: any, index: number) => (
              <Box
                key={`${item.value}-${index}`}
                sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '32%', flexBasis: '32%', flexGrow: 0, pt: '5.2px' }}
              >
                <ButtonRem
                  onClick={() => handleLightModeToggle(item.value)}
                  fullWidth
                  variant="text"
                  sx={{
                    ...lightingEffectButtonSx(theme, LightMode === item.value),
                  }}
                >
                  {resolveEffectLabel(item, t)}
                </ButtonRem>
              </Box>
            ))}
          </Box>
        </Box>

        {(showBrightness || showSpeed) && (
          <Box
            sx={{
              width: '400px',
              minWidth: '350px',
              ...lightingPanelCardSx(theme),
              p: 20,
              boxSizing: 'border-box',
              overflow: 'auto',
              ...getComfortableScrollbarSx(isDark),
            }}
          >
            {showBrightness ? (
              <>
                <Typography sx={{ ...lightingSectionLabelSx(theme), mb: 8 }}>{t('1676')}</Typography>
                <Box sx={{ mb: 3 }}>
                  <SliderBlock>
                    <SliderRem
                      value={brightnessValue}
                      min={5}
                      max={100}
                      step={1}
                      onChange={(_, newValue) => handleBrightnessChange(newValue as number)}
                      sx={lightingSliderSx(theme)}
                    />
                    <Box
                      component="input"
                      value={brightnessInput}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const onlyDigits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                        setBrightnessInput(onlyDigits);
                      }}
                      onBlur={commitBrightnessInput}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur();
                        }
                      }}
                      sx={{ ...lightingBrightnessInputSx(theme), ml: 0, marginLeft: '10px' }}
                    />
                    <Typography sx={lightingPercentMutedSx(theme)}>%</Typography>
                  </SliderBlock>
                </Box>
              </>
            ) : null}
            {showSpeed ? (
              <>
                <Typography sx={{ ...lightingSectionLabelSx(theme), mb: 8 }}>{t('1677')}</Typography>
                <SliderBlock>
                  <SliderRem
                    value={speedValue}
                    min={0}
                    max={matrixSpeedMax}
                    step={1}
                    onChange={(_, newValue) => handleSpeedChange(newValue as number)}
                    sx={lightingSliderSx(theme, { thumbWidth: 30.4 })}
                  />
                  <Box sx={{ width: '50px', height: '32px' }} />
                  <Typography sx={{ color: 'transparent', fontSize: '20px', fontWeight: 600, userSelect: 'none' }}>%</Typography>
                </SliderBlock>
              </>
            ) : null}
          </Box>
        )}

        {showColor ? (
          <Box
            sx={{
              width: '350px',
              minWidth: '350px',
              ...lightingPanelCardSx(theme),
              p: 20,
              boxSizing: 'border-box',
              overflow: 'auto',
              ...getComfortableScrollbarSx(isDark),
            }}
          >
            <ColorPicker
              selectColor={selectedColor}
              setSelectColor={handleColorChange}
              hueSatOnly={protocol === 'qmk-via'}
            />
          </Box>
        ) : null}
      </Box>
    </>
  );
}

function SliderBlock({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 9, mb: 3.5 }}>
      {children}
    </Box>
  );
}
