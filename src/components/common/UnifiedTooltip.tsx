'use client';

import { Tooltip, type TooltipProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ReactElement, ReactNode } from 'react';

export type UnifiedTooltipProps = {
    title: ReactNode;
    children: ReactElement;
    placement?: TooltipProps['placement'];
    enterDelay?: number;
    disableInteractive?: boolean;
    arrow?: boolean;
};

const lightTooltipSx = {
    fontSize: '15px',
    fontWeight: 600,
    color: '#6f84a8',
    px: 16,
    py: 12,
    borderRadius: '12px',
    border: '1px solid rgba(197,211,232,0.9)',
    bgcolor: 'rgba(255,255,255,0.98)',
    boxShadow: '0 4px 14px rgba(128,155,197,0.24)',
    textAlign: 'center',
    lineHeight: 1.45,
    maxWidth: 280,
} as const;

export default function UnifiedTooltip({
    title,
    children,
    placement = 'top',
    enterDelay = 180,
    disableInteractive = true,
    arrow = false,
}: UnifiedTooltipProps) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const tooltipSx = isDark
        ? {
              fontSize: '15px',
              fontWeight: 600,
              color: theme.palette.primary.contrastText,
              px: 16,
              py: 12,
              borderRadius: '8px',
              border: 'none',
              bgcolor: theme.palette.primary.main,
              boxShadow: 'none',
              textAlign: 'center',
              lineHeight: 1.45,
              maxWidth: 280,
          }
        : lightTooltipSx;

    const arrowSx = {
        color: isDark ? theme.palette.primary.main : 'rgba(255,255,255,0.98)',
    };

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
                ...(arrow ? { arrow: { sx: arrowSx } } : {}),
            }}
        >
            {children}
        </Tooltip>
    );
}
