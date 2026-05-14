'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Box, styled } from '@mui/material';
import type { LayoutKey, KeyboardKey } from '@/types/types_v1';
import keyboardLayout from '@/data/keyboardLayout/full_keyboard.json';
import keyboardLayoutDe from '@/data/keyboardLayout/full_keyboard_de.json';
import { getKeyByKeyNameValue, getKeyName } from '@/keyboard/keycode';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';

const KEY_UNIT_PX = 3.5 * 16;
const KEY_GAP_PX = 0.2 * 16;

const StyledKeyboardWrapper = styled(Box)`
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
`;

const StyledKeyWrapper = styled('div')<{
  width: number;
  height: number;
  left: number;
  top: number;
}>`
  position: absolute;
  width: ${(props) => `${props.width}px`};
  height: ${(props) => `${props.height}px`};
  left: ${(props) => `${props.left}px`};
  top: ${(props) => `${props.top}px`};
  padding: 2px;
  box-sizing: border-box;
`;

interface FullKeyboardProps {
  disabled?: boolean;
  onSelectKey?: (key: KeyboardKey) => void | Promise<void>;
}

const FullKeyboard: FC<FullKeyboardProps> = ({ disabled = false, onSelectKey }) => {
  const currentLanguage =
    (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || 'zh';
  const isGerman = currentLanguage.startsWith('de');
  const currentLayout: any = isGerman ? keyboardLayoutDe : keyboardLayout;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      setContainerSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const boardBounds = useMemo(() => {
    const keys: LayoutKey[] = currentLayout.keys ?? [];
    if (!keys.length) return { maxX: 0, maxY: 0 };

    const maxX = Math.max(...keys.map((key) => (key.x ?? 0) + (key.w ?? 1)));
    const maxY = Math.max(...keys.map((key) => (key.y ?? 0) + (key.h ?? 1)));

    return { maxX, maxY };
  }, [currentLayout]);

  const boardPx = useMemo(() => {
    const width = boardBounds.maxX * KEY_UNIT_PX + Math.max(boardBounds.maxX - 1, 0) * KEY_GAP_PX;
    const height = boardBounds.maxY * KEY_UNIT_PX + Math.max(boardBounds.maxY - 1, 0) * KEY_GAP_PX;

    return {
      width: width || 1,
      height: height || 1,
    };
  }, [boardBounds]);

  const scale = useMemo(() => {
    if (!containerSize.width || !containerSize.height || typeof window === 'undefined') return 1;

    const boardWidthPx = boardPx.width;
    const boardHeightPx = boardPx.height;

    if (!boardWidthPx || !boardHeightPx) return 1;

    return Math.min(containerSize.width / boardWidthPx, containerSize.height / boardHeightPx);
  }, [boardPx, containerSize]);

  const getKeyLabel = (index: number) => currentLayout.codes?.[index]?.name || '';
  const isImageIcon = (value: string) => {
    const normalized = String(value || '').trim();
    return normalized.includes('/KeyType/') || normalized.endsWith('.svg') || normalized.endsWith('.png');
  };
  const getKeyCodeLabel = (index: number) => {
    const key = currentLayout.codes?.[index];
    if (!key) return '';
    const { name } = getKeyName(key);
    const matchedKey = getKeyByKeyNameValue(name);
    return matchedKey || name || key.name || '';
  };

  const handleSelect = (index: number) => {
    if (disabled || !onSelectKey) return;
    const key = { ...(currentLayout.codes?.[index] || {}) };
    if (!key || key.type === undefined) return;
    if (key.code1 === 0xff) {
      key.type = 0xf0;
    }
    void onSelectKey(key);
  };

  return (
    <Box className="full-keyboard" ref={containerRef} sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <StyledKeyboardWrapper>
        <Box
          sx={{
            position: 'relative',
            width: `${boardPx.width}px`,
            height: `${boardPx.height}px`,
            transform: `scale(${scale * 1})`,
            transformOrigin: 'top left',
          }}
        >
          {currentLayout.keys?.map((keyItem: LayoutKey, index: number) => {
            const keyLabel = getKeyLabel(index);
            const keyCodeLabel = getKeyCodeLabel(index);
            const keyWidth = (keyItem.w ?? 1) * KEY_UNIT_PX + ((keyItem.w ?? 1) - 1) * KEY_GAP_PX;
            const keyHeight = (keyItem.h ?? 1) * KEY_UNIT_PX + ((keyItem.h ?? 1) - 1) * KEY_GAP_PX;
            const keyLeft = (keyItem.x ?? 0) * (KEY_UNIT_PX + KEY_GAP_PX);
            const keyTop = (keyItem.y ?? 0) * (KEY_UNIT_PX + KEY_GAP_PX);

            return (
              <StyledKeyWrapper
                key={index}
                width={keyWidth}
                height={keyHeight}
                left={keyLeft}
                top={keyTop}
                onClick={() => handleSelect(index)}
                style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
              >
                <UnifiedTooltip title={keyCodeLabel || keyLabel}>
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '4px',
                      border: '1px solid #d2dae7',
                      transition: 'background-color 0.2s ease',
                      color: '#68798f',
                      fontSize: '12px',
                      lineHeight: 1.1,
                      textAlign: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: 0.5,
                      overflow: 'hidden',
                      whiteSpace: 'normal',
                      wordBreak: 'keep-all',
                      overflowWrap: 'normal',
                      '&:hover': {
                        background: disabled ? '' : '#ffffff',
                      },
                    }}
                  >
                    {isImageIcon(keyLabel) ? (
                      <Box
                        component="img"
                        src={String(keyLabel).trim()}
                        alt={keyCodeLabel || keyLabel}
                        sx={{ width: '21.6px', height: '21.6px', objectFit: 'contain' }}
                      />
                    ) : (
                      keyLabel
                    )}
                  </Box>
                </UnifiedTooltip>
              </StyledKeyWrapper>
            );
          })}
        </Box>
      </StyledKeyboardWrapper>
    </Box>
  );
};

export default FullKeyboard;
