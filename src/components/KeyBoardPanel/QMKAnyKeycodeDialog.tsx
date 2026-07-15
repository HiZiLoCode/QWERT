'use client';

import { useMemo, useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    useTheme,
} from '@mui/material';
import {
    buildAnyKeycodeOptions,
    filterAnyKeycodeOptions,
    isValidAnyKeycodeInput,
    keycodeFromAnyInput,
} from '@/utils/qmkAnyKeycode';

export interface QMKAnyKeycodeDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (code: string, keycode: number) => void;
    fullDict: Record<string, number>;
    customKeycodes?: Array<{ name: string; title: string; shortName: string }>;
    /** 自定义校验（91683 ANY 和弦语法等） */
    isInputValid?: (input: string) => boolean;
    /** 传入时直接回传原始输入，不走 QMK keycode 解析 */
    onConfirmRaw?: (input: string) => void;
    placeholder?: string;
}

export default function QMKAnyKeycodeDialog({
    open,
    onClose,
    onConfirm,
    fullDict,
    customKeycodes,
    isInputValid,
    onConfirmRaw,
    placeholder,
}: QMKAnyKeycodeDialogProps) {
    const theme = useTheme();
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState(false);

    const allOptions = useMemo(
        () => buildAnyKeycodeOptions(customKeycodes),
        [customKeycodes],
    );

    const options = useMemo(
        () => filterAnyKeycodeOptions(allOptions, inputValue),
        [allOptions, inputValue],
    );

    const isValid = isInputValid
        ? isInputValid(inputValue)
        : isValidAnyKeycodeInput(inputValue, fullDict);

    const handleConfirm = () => {
        if (onConfirmRaw) {
            if (!isValid) {
                setError(true);
                return;
            }
            onConfirmRaw(inputValue.trim());
            setInputValue('');
            setError(false);
            onClose();
            return;
        }

        const parsed = keycodeFromAnyInput(inputValue, fullDict);
        if (!parsed) {
            setError(true);
            return;
        }
        onConfirm(parsed.code, parsed.keycode);
        setInputValue('');
        setError(false);
        onClose();
    };

    const handleClose = () => {
        setInputValue('');
        setError(false);
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            PaperProps={{
                sx: {
                    width: '28rem',
                    borderRadius: '0.75rem',
                    backgroundColor: theme.palette.background.paper,
                },
            }}
        >
            <DialogTitle sx={{ pb: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>
                Any
            </DialogTitle>
            <DialogContent sx={{ pb: '0.5rem' }}>
                <Autocomplete
                    freeSolo
                    options={options}
                    getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.code)}
                    inputValue={inputValue}
                    onInputChange={(_, val) => {
                        setInputValue(val);
                        setError(false);
                    }}
                    onChange={(_, val) => {
                        if (val && typeof val !== 'string') {
                            setInputValue(val.code);
                            setError(false);
                        }
                    }}
                    filterOptions={(x) => x}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            autoFocus
                            size="small"
                            placeholder={placeholder ?? 'KC_NO, LCTL(KC_C), MO(1), 0xFF...'}
                            error={error}
                            helperText={error ? '无效的 keycode' : ''}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && isValid) handleConfirm();
                            }}
                        />
                    )}
                    renderOption={(props, opt) => (
                        <Box
                            component="li"
                            {...props}
                            key={opt.code}
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                fontSize: '0.8125rem',
                            }}
                        >
                            <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{opt.code}</span>
                            <span style={{ color: theme.palette.text.secondary }}>{opt.label}</span>
                        </Box>
                    )}
                />
            </DialogContent>
            <DialogActions sx={{ px: '1.5rem', pb: '1rem' }}>
                <Button onClick={handleClose} size="small">
                    取消
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    size="small"
                    disabled={!isValid}
                >
                    确认
                </Button>
            </DialogActions>
        </Dialog>
    );
}
