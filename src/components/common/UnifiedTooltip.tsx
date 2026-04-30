import { Tooltip, type TooltipProps } from '@mui/material';
import type { ReactElement, ReactNode } from 'react';

export type UnifiedTooltipProps = {
  title: ReactNode;
  children: ReactElement;
  placement?: TooltipProps['placement'];
  enterDelay?: number;
  disableInteractive?: boolean;
  arrow?: boolean;
};

const tooltipSx = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#6f84a8',
  px: 16,
  py: 12,
  borderRadius: '0.75rem',
  border: '0.0625rem solid rgba(197,211,232,0.9)',
  bgcolor: 'rgba(255,255,255,0.98)',
  boxShadow: '0 0.25rem 0.875rem rgba(128,155,197,0.24)',
} as const;

export default function UnifiedTooltip({
  title,
  children,
  placement = 'top',
  enterDelay = 180,
  disableInteractive = true,
  arrow = false,
}: UnifiedTooltipProps) {
  return (
    <Tooltip
      placement={placement}
      title={title}
      enterDelay={enterDelay}
      disableInteractive={disableInteractive}
      arrow={arrow}
      slotProps={{
        tooltip: {
          sx: tooltipSx,
        },
      }}
    >
      {children}
    </Tooltip>
  );
}

