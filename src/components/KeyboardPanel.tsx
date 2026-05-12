'use client';

import { Box, Button, Stack, Typography, Popover } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ChevronRightOutlinedIcon from '@mui/icons-material/ChevronRightOutlined';
import Image from 'next/image';
import { useCallback, useContext, useMemo, useState } from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';

interface KeyboardPanelProps {
    onSelectKeyboard?: (keyboard: string) => void;
    onSelectConfig?: () => void;
    onKeyboardSettings?: () => void;
}



export default function KeyboardPanel({
    onSelectKeyboard,
    onSelectConfig,
    onKeyboardSettings,
}: KeyboardPanelProps) {
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const { keyboardData, connectedKeyboard, connectKeyboard, setConnectKeyboardStauts, keyboard } = useContext(ConnectKbContext);

    const [selectedKeyboard, setSelectedKeyboard] = useState<any>(connectedKeyboard ?? {
        
        productName: 'NAVA 68',

    });
    const imagePaths = useMemo(() => {
        return keyboardData.reduce((acc: any, item: any) => {
            acc[item.address] = `./keyboard/${item.productId === 12290 ? item.devVID : item.vendorId}_${item.productId === 12290 ? item.devPID : item.productId}.png`;
            return acc;
        }, {} as Record<string, string>);
    }, [keyboardData]);
    const connectKeyboardNext = useCallback(async () => {
        try {
            const result = await connectKeyboard("tryConnect", true, true);
            if (result) console.log("连接成功");
        } catch (error) {
            console.error("连接失败", error);
        }
    }, [connectKeyboard]);
    const keyboards: any[] = [
        {
            id: 'nava68',
            name: 'NAVA 68',
            model: 'NAVA 68',
            status: 'connected',
        },
        {
            id: 'nava68',
            name: 'NAVA 68',
            model: 'NAVA 68',
            status: 'connected',
        },
        {
            id: 'nava68',
            name: 'NAVA 68',
            model: 'NAVA 68',
            status: 'connected',
        },
    ];

    const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
    };

    const handleSelectKeyboard = (keyboard: any) => {
        setSelectedKeyboard(keyboard);
        handleCloseMenu();
        onSelectKeyboard?.(keyboard.id);
    };

    const open = Boolean(anchorEl);

    const keyboardSettings = [
        { id: 'macro', label: t('macro') || '键程调节' },
        { id: 'lighting', label: t('lighting') || '灯光调节' },
        { id: 'keypress', label: t('keypress') || '按键映射' },
        { id: 'advanced', label: t('advanced') || '高级按键' },
    ];

    return (
        <Box
            sx={{
                width: '250px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                p: 2,
                flexShrink: "0",
                height: '100%',
            }}
        >
            {
                anchorEl && <Box sx={{
                    position: 'fixed',
                    zIndex: '10',
                    pointerEvents: 'all',
                    inset: '0px',
                    cursor: 'default',
                    background: "rgba(230, 230, 230, .5)",
                    backdropFilter: "blur(10px)",
                }}>
                </Box>
            }
            {/* Select Keyboard Section */}
            <Box
                sx={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    p: '16px',
                    cursor: 'pointer',
                    zIndex: '11',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    },
                }}
                onClick={handleOpenMenu}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: '12px',
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#1e293b',
                        }}
                    >
                        {t('selectKeyboard') || '选择键盘'}
                    </Typography>
                    <ChevronRightOutlinedIcon sx={{ color: '#94a3b8' }} />
                </Box>

                {/* Keyboard Display */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '12px',
                        py: '12px',
                    }}
                    className="bg"
                >
                    <Box
                        sx={{
                            width: '100%',
                            height: '80px',
                            backgroundColor: '#f1f5f9',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                        }}
                    >
                        <Image
                            src="/assets/keyboard-preview.png"
                            alt="Keyboard"
                            width={160}
                            height={60}
                            style={{ objectFit: 'contain' }}
                        />
                    </Box>

                    <Box sx={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '16px',
                    }}>
                        <Typography
                            sx={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#0f172a',
                                letterSpacing: '0.5px',
                                display: 'flex',
                            }}
                        >
                            {selectedKeyboard.name}
                        </Typography>
                        <Box
                            sx={{

                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: selectedKeyboard.status === 'connected' ? '#10b981' : '#94a3b8',
                            }}
                        />
                    </Box>
                </Box>
            </Box>

            {/* Keyboard Selection Popover */}
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleCloseMenu}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        borderRadius: '12px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        mt: 1,
                        minWidth: '280px',
                    },
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Button

                        sx={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#ffffff',
                            mb: 1,
                            background: "#3B82F6",
                            width: '100%',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                        }}
                    >
                        {t('selectKeyboard') || '选择键盘'}
                    </Button>
                    <Stack spacing={1}>
                        {keyboardData.map((keyboard: any) => (
                            <Box
                                i
                                key={keyboard.id}
                                onClick={() => handleSelectKeyboard(keyboard)}
                                sx={{
                                    p: '12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    backgroundColor: selectedKeyboard.productName === keyboard.productName ? '#2196F3' : '#f1f5f9',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: selectedKeyboard.productName === keyboard.productName ? '#1976D2' : '#e2e8f0',
                                    },
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <Box
                                        sx={{
                                            width: '48px',
                                            height: '40px',
                                            backgroundColor: '#fff',
                                            borderRadius: '6px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <Image
                                            src="/assets/keyboard-preview.png"
                                            alt={imagePaths[keyboard.address]}
                                            width={40}
                                            height={30}
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography
                                            sx={{
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                color: selectedKeyboard.productName === keyboard.productName ? '#fff' : '#0f172a',
                                            }}
                                        >
                                            {keyboard.name}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: '12px',
                                                color: selectedKeyboard.productName === keyboard.productName ? 'rgba(255,255,255,0.7)' : '#64748b',
                                            }}
                                        >
                                            {keyboard.model}
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: selectedKeyboard.productName === keyboard.productName ? '#10b981' : '#94a3b8',
                                        }}
                                    />
                                </Box>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Popover>

            {/* Select Config Section */}
            <Box
                sx={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    p: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    },
                }}
                onClick={onSelectConfig}
            >
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: '12px',
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#1e293b',
                        }}
                    >
                        {t('selectConfig') || '选择配置'}
                    </Typography>
                    <ChevronRightOutlinedIcon sx={{ color: '#94a3b8' }} />
                </Box>

                <Typography
                    sx={{
                        fontSize: '13px',
                        color: '#64748b',
                        mb: '12px',
                    }}
                >
                    {t('currentConfig') || '当前使用中的配置'}
                </Typography>

                <Button
                    fullWidth
                    variant="contained"
                    sx={{
                        backgroundColor: '#2196F3',
                        color: '#fff',
                        py: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: '8px',
                        '&:hover': {
                            backgroundColor: '#1976D2',
                        },
                    }}
                >
                    {t('customMacro') || '自定义宏设1'}
                </Button>
            </Box>

            {/* Keyboard Settings Section */}
            <Box
                sx={{
                    backgroundColor: '#fff',
                    borderRadius: '12px',
                    p: '16px',
                    flex: 1,
                }}
            >
                <Typography
                    sx={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#1e293b',
                        mb: '8px',
                    }}
                >
                    {t('keyboardSettings') || '设置键盘'}
                </Typography>

                <Typography
                    sx={{
                        fontSize: '13px',
                        color: '#64748b',
                        mb: '16px',
                    }}
                >
                    {t('settingsDesc') || '设置仅对当前配置生效'}
                </Typography>

                <Button
                    fullWidth
                    variant="contained"
                    sx={{
                        backgroundColor: '#2196F3',
                        color: '#fff',
                        py: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: '8px',
                        mb: '12px',
                        '&:hover': {
                            backgroundColor: '#1976D2',
                        },
                    }}
                    onClick={onKeyboardSettings}
                >
                    {t('keyboardSettings') || '键程调节'}
                </Button>

                <Stack spacing={2}>
                    {keyboardSettings.map((setting) => (
                        <Typography
                            key={setting.id}
                            sx={{
                                fontSize: '13px',
                                color: '#64748b',
                                textAlign: 'center',
                                py: '8px',
                                cursor: 'pointer',
                                transition: 'color 0.2s ease',
                                '&:hover': {
                                    color: '#2196F3',
                                },
                            }}
                        >
                            {setting.label}
                        </Typography>
                    ))}
                </Stack>
            </Box>
        </Box >
    );
}

