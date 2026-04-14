'use client';

import { Box, Typography } from '@mui/material';
import { useEffect, useState, type ChangeEvent } from 'react';
import Saturation from '@uiw/react-color-saturation';
import Alpha from '@uiw/react-color-alpha';
import Swatch from '@uiw/react-color-swatch';
import { hsvaToHex, hexToHsva } from '@uiw/color-convert';

type ColorPickerProps = {
  disabled?: boolean;
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

export default function ColorPicker({ disabled, selectColor, setSelectColor }: ColorPickerProps) {
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
    <Box sx={{ position: 'relative', p: 0, mt: 0 }}>
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
          }}
        />
      )}
      <Box sx={{ width: '100%' }}>
        <Saturation
          hsva={hsva}
          style={{ width: '100%', height: '13.5rem', borderRadius: '0.5rem', zIndex: 10 }}
          pointer={({ top, left }) => <SaturationPointer top={top ?? 0} left={left ?? 0} color={hsvaToHex({ ...hsva, a: 1 }) || '#FF0000'} />}
          onChange={(newColor) => {
            changeColor(hsvaToHex(newColor));
            setHsva({ ...hsva, ...newColor, a: hsva.a });
          }}
        />

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
        <Typography sx={{ minWidth: '2.5rem', color: '#7C8CA5', fontWeight: 700, letterSpacing: '0.4px' }}>HEX:</Typography>
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
            height: '2rem',
            borderRadius: '0.5rem',
            border: '0.0625rem solid #E2E8F0',
            backgroundColor: '#fff',
            textAlign: 'center',
            color: '#64748B',
            fontWeight: 600,
            outline: 'none',
            px: '0.625rem',
          }}
        />
      </Box>
      <Swatch
        colors={['#FF1C1C', '#0047FF', '#00B7FF', '#63F200', '#D8EA00', '#FF8A00', '#C96A6A']}
        color={hsvaToHex(hsva)}
        style={{ justifyContent: 'space-between', marginTop: 18 }}
        rectProps={{
          children: <SwatchCheckedBorder />,
          style: {
            width: '1.5rem',
            height: '1.5rem',
            borderRadius: '50%',
          },
        }}
        onChange={(hsvColor) => {
          changeColor(hsvaToHex(hsvColor));
          setHsva({ ...hsva, ...hsvColor });
          setHexInput(hsvaToHex(hsvColor).toUpperCase());
        }}
      />
    </Box>
  );
}



