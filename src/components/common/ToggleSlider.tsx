'use client';

import { ButtonBase, type SxProps, type Theme } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

type ToggleSliderProps = {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  sx?: SxProps<Theme>;
};

const TRACK_W = 52;
const TRACK_H = 26;
const THUMB = 21;
const PADDING = 1.5;

export default function ToggleSlider({
  checked,
  onChange,
  disabled = false,
  ariaLabel = 'toggle',
  sx,
}: ToggleSliderProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const P = theme.palette.primary.main;
  const PDark = theme.palette.primary.dark;

  const trackUnchecked = isDark
    ? `linear-gradient(180deg, ${alpha('#fff', 0.08)} 0%, ${alpha('#000', 0.45)} 100%)`
    : 'linear-gradient(180deg, #E6E8EC 0%, #D9DDE2 100%)';
  const trackChecked = `linear-gradient(180deg, ${alpha(P, 0.98)} 0%, ${PDark} 100%)`;

  const borderUnchecked = isDark ? `1px solid ${alpha('#fff', 0.14)}` : '1px solid transparent';
  const borderChecked = `1px solid ${alpha(P, 0.85)}`;

  return (
    <ButtonBase
      focusRipple={false}
      disableRipple
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onChange?.(!checked)}
      sx={{
        width: `${TRACK_W}px`,
        height: `${TRACK_H}px`,
        borderRadius: `${TRACK_H / 2}px`,
        border: checked ? borderChecked : borderUnchecked,
        background: checked ? trackChecked : trackUnchecked,
        position: 'relative',
        transition: 'all 0.18s ease',
        opacity: disabled ? 0.45 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: `${PADDING}px`,
          left: checked ? `${TRACK_W - THUMB - PADDING}px` : `${PADDING}px`,
          width: `${THUMB}px`,
          height: `${THUMB}px`,
          borderRadius: '50%',
          backgroundColor: checked ? '#FFFFFF' : P,
          boxShadow: checked
            ? '0 1px 3px rgba(0, 0, 0, 0.35)'
            : `0 1px 2px ${alpha(P, 0.35)}`,
          transition: 'all 0.2s ease',
        },
        '&:hover': {
          borderColor: P,
          boxShadow: checked ? `0 0 0 2px ${alpha(P, 0.25)} inset` : 'none',
          '&::before': {
            backgroundColor: checked ? '#FFFFFF' : P,
          },
        },
        '&:focus-visible': {
          outline: `2px solid ${P}`,
          outlineOffset: '2px',
        },
        ...sx,
      }}
    />
  );
}
