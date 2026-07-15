'use client';

import { Box, Typography } from '@mui/material';
import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react';
import Saturation from '@uiw/react-color-saturation';
import Alpha from '@uiw/react-color-alpha';
import Swatch from '@uiw/react-color-swatch';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';

type ColorPickerProps = {
  disabled?: boolean;
  /** QMK VIA 仅支持 Hue+Sat，不含明度(V) */
  hueSatOnly?: boolean;
  /** 为 true 时禁用底部预设色块（Swatch），主色盘与 HEX 仍可用 */
  swatchDisabled?: boolean;
  selectColor: string;
  setSelectColor: (value: string) => void | Promise<void>;
};

function SwatchCheckedBorder({ checked }: { checked?: boolean }) {
  if (!checked) return null;
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
        borderRadius: 1,
        border: '0rem solid',
        borderColor: 'primary.main',
      }}
    />
  );
}

function SaturationPointer({ top, left, color }: { top: number | string; left: number | string; color: string }) {
  return (
    <Box
      sx={{
        width: '1.5rem',
        height: '1.5rem',
        borderRadius: '50%',
        border: '0.1875rem solid #fff',
        boxShadow: '0 0 0 0.0625rem rgba(15,23,42,0.08)',
        position: 'absolute',
        top,
        left,
        backgroundColor: color,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function HuePointer({ left, bg }: { left: number | string; bg: string }) {
  return (
    <Box
      sx={{
        width: '1.25rem',
        height: '1.25rem',
        borderRadius: '50%',
        border: '0.1875rem solid #fff',
        boxShadow: '0 0 0 0.0625rem rgba(15,23,42,0.08)',
        position: 'absolute',
        left,
        top: '50%',
        backgroundColor: bg,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function HueSatPlane({
  hsva,
  disabled,
  onChange,
}: {
  hsva: { h: number; s: number; v: number; a: number };
  disabled?: boolean;
  onChange: (next: { h: number; s: number; v: number; a: number }) => void;
}) {
  const planeRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const pickAt = (clientX: number, clientY: number) => {
    const el = planeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = clamp01((clientX - rect.left) / rect.width);
    const y = clamp01((clientY - rect.top) / rect.height);
    onChange({
      h: x * 360,
      s: (1 - y) * 100,
      v: 100,
      a: 1,
    });
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    pickAt(e.clientX, e.clientY);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || disabled) return;
    pickAt(e.clientX, e.clientY);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const left = `${(hsva.h / 360) * 100}%`;
  const top = `${(1 - hsva.s / 100) * 100}%`;

  return (
    <Box
      ref={planeRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      sx={{
        width: '100%',
        height: '216px',
        borderRadius: '8px',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'crosshair',
        touchAction: 'none',
        backgroundImage: [
          'linear-gradient(to bottom, rgba(255,255,255,0), #ffffff)',
          'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
        ].join(', '),
        backgroundColor: '#ff0000',
      }}
    >
      <SaturationPointer top={top} left={left} color={hsvaToHex({ ...hsva, v: 100, a: 1 }) || '#FF0000'} />
    </Box>
  );
}

export default function ColorPicker({ disabled, hueSatOnly = false, swatchDisabled = false, selectColor, setSelectColor }: ColorPickerProps) {
  const [hsva, setHsva] = useState(() => hexToHsva(selectColor || '#ff0000'));
  const [hexInput, setHexInput] = useState((selectColor || '#ff0000').toUpperCase());

  useEffect(() => {
    setHsva(hexToHsva(selectColor || '#ff0000'));
    setHexInput((selectColor || '#ff0000').toUpperCase());
  }, [selectColor]);

  const changeColor = (value: string) => {
    setSelectColor(value);
  };

  return (
    <Box sx={{ position: 'relative', p: 0, mt: 0, overflow: 'visible',m: 10 }}>
      {disabled && (
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            opacity: 0.5,
            backgroundColor: 'grey.200',
            zIndex: 20,
            cursor: 'not-allowed',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
        />
      )}
      <Box sx={{ width: '100%' }}>
        {hueSatOnly ? (
          <HueSatPlane
            hsva={hsva}
            disabled={disabled}
            onChange={(next) => {
              changeColor(hsvaToHex(next));
              setHsva({ ...hsva, ...next, v: 100, a: 1 });
              setHexInput(hsvaToHex(next).toUpperCase());
            }}
          />
        ) : (
          <Saturation
            hsva={hsva}
            style={{ width: '100%', height: '216px', borderRadius: '8px', zIndex: 10 }}
            pointer={({ top, left }) => <SaturationPointer top={top ?? 0} left={left ?? 0} color={hsvaToHex({ ...hsva, a: 1 }) || '#FF0000'} />}
            onChange={(newColor) => {
              changeColor(hsvaToHex(newColor));
              setHsva({ ...hsva, ...newColor, a: hsva.a });
            }}
          />
        )}

        <Alpha
          width={"100%"}
          height={"1rem"}
          radius={999}
          direction="horizontal"
          style={{ zIndex: 10, marginTop: 16 }}
          background="linear-gradient(to right, rgb(255, 0, 0) 0%, rgb(255, 0, 255) 17%, rgb(0, 0, 255) 33%, rgb(0, 255, 255) 50%, rgb(0, 255, 0) 67%, rgb(255, 255, 0) 83%, rgb(255, 0, 0) 100%)"
          hsva={{ h: hsva.h, s: 100, v: 100, a: 1 - hsva.h / 360 }}
          pointer={({ left }) => <HuePointer left={left ?? 0} bg={hsvaToHex({ ...hsva, s: 100, v: 100, a: 1 }) || '#FF0000'} />}
          onChange={(_, interaction) => {
            const newHsva = { ...hsva, h: 360 * (1 - (interaction.left ?? 0)) };
            changeColor(hsvaToHex(newHsva));
            setHsva(newHsva);
            setHexInput(hsvaToHex(newHsva).toUpperCase());
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 30  }}>
        <Typography sx={{ minWidth: '2.5rem', color: '#7C8CA5', fontWeight: 700, letterSpacing: '0.4px',fontSize: '16px' }}>HEX:</Typography>
        <Box
          component="input"
          value={hexInput}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const input = e.target.value.trim();
            if (!input) {
              setHexInput('#');
              return;
            }
            const candidate = (input.startsWith('#') ? input : `#${input}`).toUpperCase();
            if (!/^#([0-9A-F]{0,6})$/.test(candidate)) return;
            setHexInput(candidate);
            if (candidate.length !== 7) return;
            try {
              const newHsva = hexToHsva(candidate);
              changeColor(candidate);
              setHsva({ ...hsva, ...newHsva });
            } catch {
              // ignore invalid hex while typing
            }
          }}
          onBlur={() => {
            const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
            if (/^#([0-9A-F]{6})$/.test(normalized)) {
              setHexInput(normalized);
              return;
            }
            setHexInput(hsvaToHex(hsva).toUpperCase());
          }}
          sx={{
            flex: 1,
            height: '32px',
            borderRadius: '0.5rem',
            border: '0.0625rem solid #E2E8F0',
            backgroundColor: '#fff',
            textAlign: 'center',
            color: '#64748B',
            fontWeight: 600,
            outline: 'none',
            px: '0.625rem',
            width: '100%',
          }}
        />
      </Box>
      <Box
        sx={{
          position: 'relative',
          marginTop: 18,
          ...(swatchDisabled
            ? {
                  pointerEvents: 'none',
                  opacity: 0.45,
                  userSelect: 'none',
              }
            : {}),
        }}
      >
        <Swatch
          colors={['#FF1C1C', '#0047FF', '#00B7FF', '#63F200', '#D8EA00', '#FF8A00', '#C96A6A']}
          color={hsvaToHex(hsva)}
          style={{ justifyContent: 'space-between' }}
          rectProps={{
            children: <SwatchCheckedBorder />,
            style: {
              width: '1.5rem',
              height: '1.5rem',
              borderRadius: '50%',
            },
          }}
          onChange={(hsvColor) => {
            if (swatchDisabled) return;
            changeColor(hsvaToHex(hsvColor));
            setHsva({ ...hsva, ...hsvColor });
            setHexInput(hsvaToHex(hsvColor).toUpperCase());
          }}
        />
      </Box>
    </Box>
  );
}



