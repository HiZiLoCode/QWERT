import { ButtonBase, type SxProps, type Theme } from '@mui/material';

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
        border: checked ? '1px solid #3B82F6' : '1px solid transparent',
        background: checked
          ? 'linear-gradient(180deg, #4D91FF 0%, #3B82F6 100%)'
          : 'linear-gradient(180deg, #E6E8EC 0%, #D9DDE2 100%)',
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
          backgroundColor: checked ? '#FFFFFF' : '#3B82F6',
          boxShadow: checked
            ? '0 1px 2px rgba(15, 23, 42, 0.16)'
            : '0 1px 2px rgba(59, 130, 246, 0.24)',
          transition: 'all 0.2s ease',
        },
        '&:hover': {
          borderColor: '#3B82F6',
          boxShadow: checked ? '0 0 0 2px rgba(59, 130, 246, 0.18) inset' : 'none',
          '&::before': {
            backgroundColor: checked ? '#FFFFFF' : '#3B82F6',
          },
        },
        '&:focus-visible': {
          outline: '2px solid #3B82F6',
          outlineOffset: '2px',
        },
        ...sx,
      }}
    />
  );
}

