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
        height: '2.5rem',
        fontSize: '0.875rem',
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
        padding: '0.5rem 0.75rem',
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
            { label: `${t('1717')} (${t('1715')})`, value: 0x01 },
            { label: `${t('1718')} (${t('1715')})`, value: 0x02 },
            { label: `${t('1720')} (${t('1715')})`, value: 0x04 },
            { label: `${t('1719')} (${t('1715')})`, value: 0x08 },
            { label: `${t('1717')} (${t('1716')})`, value: 0x10 },
            { label: `${t('1718')} (${t('1716')})`, value: 0x20 },
            { label: `${t('1720')} (${t('1716')})`, value: 0x40 },
            { label: `${t('1719')} (${t('1716')})`, value: 0x80 },
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
                mt: '0.25rem',
                p: '1rem',
                borderRadius: '0.875rem',
                border: '0.0625rem solid rgba(99, 116, 145, 0.25)',
                background: 'linear-gradient(160deg, rgba(245,250,255,0.95) 0%, rgba(236,243,255,0.8) 100%)',
                boxShadow: '0 0.625rem 1.875rem rgba(52, 90, 160, 0.10)',
            }}
        >
            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#3a4a63', mb: '0.75rem' }}>{t('1711')}</Typography>

            <Box
                sx={{
                    mb: '0.75rem',
                    px: '0.75rem',
                    py: '0.6rem',
                    borderRadius: '0.625rem',
                    border: '0.0625rem solid rgba(88, 119, 170, 0.25)',
                    background: 'rgba(255,255,255,0.72)',
                    color: combinationText ? '#2d3e57' : '#8090a8',
                    minHeight: '2.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 600,
                    letterSpacing: '0.0125rem',
                }}
            >
                {combinationText || t('1712')}
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', mb: '0.75rem' }}>
                {modifierKeys.map((item) => {
                    const active = (modifierMask & item.value) !== 0;
                    return (
                        <ButtonRem
                            key={item.value}
                            onClick={() => setModifierMask((prev) => (prev & item.value ? prev & ~item.value : prev | item.value))}
                            sx={{
                                minWidth: '5.375rem',
                                height: '2.125rem',
                                borderRadius: '62.4375rem',
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                border: '0.0625rem solid',
                                borderColor: active ? 'rgba(30,86,180,0.7)' : 'rgba(120,145,186,0.35)',
                                color: active ? '#fff' : '#4b607f',
                                background: active
                                    ? 'linear-gradient(135deg, #3f8cff 0%, #356df0 100%)'
                                    : 'rgba(255,255,255,0.85)',
                                boxShadow: active ? '0 0.375rem 1rem rgba(59,130,246,0.25)' : 'none',
                                '&:hover': {
                                    background: active
                                        ? 'linear-gradient(135deg, #337ef0 0%, #2d62de 100%)'
                                        : 'rgba(236,244,255,0.95)',
                                },
                            }}
                        >
                            {item.label}
                        </ButtonRem>
                    );
                })}
            </Box>

            <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                        minWidth: '6.75rem',
                        height: '2.5rem',
                        borderRadius: '0.625rem',
                        textTransform: 'none',
                        whiteSpace: 'nowrap',
                        lineHeight: 1,
                        px: '1rem',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        color: '#fff',
                        background: 'linear-gradient(135deg, #3f8cff 0%, #356df0 100%)',
                        boxShadow: '0 0.5rem 1.25rem rgba(59,130,246,0.25)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #337ef0 0%, #2d62de 100%)',
                        },
                    }}
                >
                    {t('1714')}
                </ButtonRem>
            </Box>
        </Box>
    );
}
