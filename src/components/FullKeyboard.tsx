'use client';

import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Box, styled } from '@mui/material';
import type { LayoutKey, KeyboardKey } from '@/types/types_v1';
import keyboardLayout from '@/data/keyboardLayout/full_keyboard.json';
import keyboardLayoutDe from '@/data/keyboardLayout/full_keyboard_de.json';
import { getKeyByKeyNameValue, getKeyName } from '@/keyboard/keycode';
import UnifiedTooltip from '@/components/common/UnifiedTooltip';

const KEY_UNIT_REM = 3.5;
const KEY_GAP_REM = 0.2;

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
  width: ${(props) => props.width}rem;
  height: ${(props) => props.height}rem;
  left: ${(props) => props.left}rem;
  top: ${(props) => props.top}rem;
  padding: 0.125rem;
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

  const boardRem = useMemo(() => {
    const width = boardBounds.maxX * KEY_UNIT_REM + Math.max(boardBounds.maxX - 1, 0) * KEY_GAP_REM;
    const height = boardBounds.maxY * KEY_UNIT_REM + Math.max(boardBounds.maxY - 1, 0) * KEY_GAP_REM;

    return {
      width: width || 1,
      height: height || 1,
    };
  }, [boardBounds]);

  const scale = useMemo(() => {
    if (!containerSize.width || !containerSize.height || typeof window === 'undefined') return 1;

    const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const boardWidthPx = boardRem.width * rootFontSize;
    const boardHeightPx = boardRem.height * rootFontSize;

    if (!boardWidthPx || !boardHeightPx) return 1;

    return Math.min(containerSize.width / boardWidthPx, containerSize.height / boardHeightPx);
  }, [boardRem, containerSize]);

  const getKeyLabel = (index: number) => currentLayout.codes?.[index]?.name || '';
  const isImageIcon = (value: string) => {
    const normalized = String(value || '').trim();
    return normalized.includes('/KeyType/') || normalized.endsWith('.svg') || normalized.endsWith('.png');
  };
  const getKeyCodeLabel = (index: number) => {
    const key = currentLayout.codes?.[index];
    if (!key) return '';
    const value = getKeyName(key);
    const matchedKey = getKeyByKeyNameValue(value);
    return matchedKey || value || key.name || '';
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
            width: `${boardRem.width}rem`,
            height: `${boardRem.height}rem`,
            transform: `scale(${scale * 1})`,
            transformOrigin: 'top left',
          }}
        >
          {currentLayout.keys?.map((keyItem: LayoutKey, index: number) => {
            const keyLabel = getKeyLabel(index);
            const keyCodeLabel = getKeyCodeLabel(index);
            const keyWidth = (keyItem.w ?? 1) * KEY_UNIT_REM + ((keyItem.w ?? 1) - 1) * KEY_GAP_REM;
            const keyHeight = (keyItem.h ?? 1) * KEY_UNIT_REM + ((keyItem.h ?? 1) - 1) * KEY_GAP_REM;
            const keyLeft = (keyItem.x ?? 0) * (KEY_UNIT_REM + KEY_GAP_REM);
            const keyTop = (keyItem.y ?? 0) * (KEY_UNIT_REM + KEY_GAP_REM);

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
                      borderRadius: '0.25rem',
                      border: '0.0625rem solid #d2dae7',
                      background: '#fbfcff',
                      color: '#68798f',
                      fontSize: '0.75rem',
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
                    }}
                  >
                    {isImageIcon(keyLabel) ? (
                      <Box
                        component="img"
                        src={String(keyLabel).trim()}
                        alt={keyCodeLabel || keyLabel}
                        sx={{ width: '1.35rem', height: '1.35rem', objectFit: 'contain' }}
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
