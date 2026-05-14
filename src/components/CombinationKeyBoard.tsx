'use client';

import { Box, Typography, styled, TextField } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getKeyCodeFromWebCode } from '@/keyboard/keycode';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { useTranslation } from '@/app/i18n';

type CombinationKeyBoardProps = {
    disabled: boolean;
    onSave: (params: { modifierMask: number; mainKeyCode: number; mainKey: string; combinationText: string }) => void | Promise<void>;
};

const KeyInput = styled(TextField)({
    '& .MuiOutlinedInput-root': {
        height: '40px',
        fontSize: '14px',
        '& fieldset': {
            borderColor: '#ccc',
        },
        '&:hover fieldset': {
            borderColor: '#999',
        },
        '&.Mui-focused fieldset': {
            borderColor: '#1976d2',
        },
    },
    '& .MuiOutlinedInput-input': {
        padding: '8px 12px',
    },
});

const getDisplayKeyFromCode = (code: string) => {
    if (code.startsWith('Key')) return code.slice(3).toUpperCase();
    if (code.startsWith('Digit')) return code.slice(5);
    return code;
};

export default function CombinationKeyBoard({ disabled, onSave }: CombinationKeyBoardProps) {
    const { t } = useTranslation('common');
    const [modifierMask, setModifierMask] = useState(0);
    const [mainKey, setMainKey] = useState('');
    const [mainKeyCode, setMainKeyCode] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const modifierKeys = useMemo(
        () => [
            { label: `L${t('1717')}`, value: 0x01 },
            { label: `L${t('1718')}`, value: 0x02 },
            { label: `L${t('1720')}`, value: 0x04 },
            { label: `L${t('1719')}`, value: 0x08 },
            { label: `R${t('1717')}`, value: 0x10 },
            { label: `R${t('1718')}`, value: 0x20 },
            { label: `R${t('1720')}`, value: 0x40 },
            { label: `R${t('1719')}`, value: 0x80 },
        ],
        [t]
    );

    useEffect(() => {
        const input = inputRef.current
        if (!input) return

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore IME composition events (e.g. Chinese Pinyin) to avoid showing "Process".
            if (e.isComposing || e.key === 'Process' || e.keyCode === 229) return;
            e.preventDefault()
            e.stopPropagation()

            if (['Control', 'Shift', 'Alt', 'Meta', ' '].includes(e.key)) return
            if (!e.code || e.code === 'Unidentified') return

            const key = getKeyCodeFromWebCode("key", e.code)
            if (!key) return;
            setMainKeyCode(key)
            setMainKey(getDisplayKeyFromCode(e.code))
        }

        input.addEventListener('keydown', handleKeyDown)
        return () => input.removeEventListener('keydown', handleKeyDown)
    }, [])

    const activeModifiers = useMemo(
        () => modifierKeys.filter((item) => (modifierMask & item.value) !== 0).map((item) => item.label),
        [modifierKeys, modifierMask]
    );

    const combinationText = useMemo(
        () => [...activeModifiers, mainKey].filter(Boolean).join(' + '),
        [activeModifiers, mainKey]
    );

    return (
        <Box
            sx={{
                mt: '4px',
                p: '16px',
                borderRadius: '14px',
                border: '1px solid rgba(99, 116, 145, 0.25)',
                background: 'linear-gradient(160deg, rgba(245,250,255,0.95) 0%, rgba(236,243,255,0.8) 100%)',
                boxShadow: '0 10px 30px rgba(52, 90, 160, 0.10)',
            }}
        >
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: '#3a4a63', mb: '12px' }}>{t('1711')}</Typography>

            <Box
                sx={{
                    mb: '12px',
                    px: '12px',
                    py: '9.6px',
                    borderRadius: '10px',
                    border: '1px solid rgba(88, 119, 170, 0.25)',
                    background: 'rgba(255,255,255,0.72)',
                    color: combinationText ? '#2d3e57' : '#8090a8',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 600,
                    letterSpacing: '0.2px',
                }}
            >
                {combinationText || t('1712')}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '8px', mb: '12px' }}>
                {modifierKeys.map((item) => {
                    const active = (modifierMask & item.value) !== 0;
                    return (
                        <ButtonRem
                            key={item.value}
                            onClick={() => setModifierMask((prev) => (prev & item.value ? prev & ~item.value : prev | item.value))}
                            sx={{
                                minWidth: '88px',
                                height: '44px',
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontSize: '14px',
                                fontWeight: 600,
                                border: '1px solid #cfe0ff',
                                color: active ? '#2f6fe8' : '#2d4a75',
                                backgroundColor: active ? '#f2f7ff' : '#ffffff',
                                boxShadow: active ? '0 0 0 1px #9fc2ff inset' : '0 2px 6px rgba(63, 115, 197, 0.06)',
                                '&:hover': {
                                    borderColor: '#9fc2ff',
                                    backgroundColor: '#f7fbff',
                                },
                            }}
                        >
                            {item.label}
                        </ButtonRem>
                    );
                })}
            </Box>

            <Box sx={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <KeyInput
                    id='mainKey'
                    inputRef={inputRef}
                    value={mainKey}
                    placeholder={t('1713')}
                    variant="outlined"
                    size="small"
                    sx={{ flex: 1 }}
                />
                <ButtonRem
                    variant="contained"
                    onClick={() => void onSave({ modifierMask, mainKeyCode, mainKey, combinationText })}
                    disabled={disabled || mainKeyCode === 0}
                    sx={{
                        flexShrink: 0,
                        minWidth: '108px',
                        height: '40px',
                        borderRadius: '10px',
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                        px: '16px',
                        fontWeight: 700,
                        fontSize: '14px',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #3f8cff 0%, #356df0 100%)',
                        boxShadow: '0 8px 20px rgba(59,130,246,0.25)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #337ef0 0%, #2d62de 100%)',
                        },
                        '&.Mui-disabled': {
                            color: '#fff',
                        },
                    }}
                >
                    {t('1714')}
                </ButtonRem>
            </Box>
        </Box>
    );
}
