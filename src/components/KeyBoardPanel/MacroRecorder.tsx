'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useContext } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import { Box, TextField, Typography, Snackbar, Alert } from '@mui/material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import type { MacroProfile as V1MacroProfile, MacroAction as V1MacroAction } from '@/types/types_v1';
import { useTranslation } from '@/app/i18n';

// ─── 本地 UI 类型（与原来保持一致）───────────────────────────────────────────
interface MacroAction {
    id: string;
    type: 'keyboard' | 'mouse' | 'delay';
    key: string;
    hasUpArrow: boolean;
    hasDownArrow: boolean;
    webCode?: string; // keyboard 用 e.code，mouse 用 button index 字符串
}

interface MacroProfile {
    index: number;
    name: string;
    actions: MacroAction[];
    loopType: 0 | 1 | 2;
    loopCount: number;
}

type DndDropResult = {
    source: { index: number };
    destination?: { index: number } | null;
};

const DELAY_MIN = 10;
const DELAY_MAX = 255;

function clampDelayValue(raw: string, fallback: number = DELAY_MIN): number {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(DELAY_MAX, Math.max(DELAY_MIN, parsed));
}

// ─── 格式转换工具 ─────────────────────────────────────────────────────────────
// 将本地 MacroProfile[] 转为 types_v1 MacroProfile[]（用于写入键盘）
function toV1Profiles(localMacros: MacroProfile[]): V1MacroProfile[] {
    return localMacros.map((m) => ({
        name: m.name,
        key: m.index,
        type: m.loopType,
        replayCnt: m.loopCount,
        list: toV1Actions(m.actions),
    }));
}

function toV1Actions(actions: MacroAction[]): V1MacroAction[] {
    return actions.map((a, i) => ({
        key: a.key,
        type: a.type as any,
        hasUpArrow: a.hasUpArrow,
        hasDownArrow: a.hasDownArrow,
        showAddButtons: false,
        index: i,
        hasError: false,
        webCode: a.webCode ?? '',
    }));
}

// 将 types_v1 MacroProfile[] 还原为本地 MacroProfile[]
function fromV1Profiles(v1: V1MacroProfile[]): MacroProfile[] {
    return v1.map((p) => ({
        index: p.key ?? 0,
        name: p.name,
        loopType: (p.type ?? 0) as 0 | 1 | 2,
        loopCount: p.replayCnt ?? 1,
        actions: (p.list ?? []).map((a, i) => ({
            id: `${Date.now()}-${i}-${Math.random()}`,
            type: a.type as 'keyboard' | 'mouse' | 'delay',
            key: a.key,
            hasUpArrow: a.hasUpArrow,
            hasDownArrow: a.hasDownArrow,
            webCode: a.webCode ?? '',
        })),
    }));
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────
const MacroRecorder: React.FC = () => {
    const { t } = useTranslation('common');

    // 接入 ConnectKbContext
    const { connectedKeyboard, keyboard, macroList } = useContext(ConnectKbContext);
    const { macroProfiles: v1Profiles, setMacroProfiles: setV1Profiles } = macroList ?? {};

    const [macros, setMacros] = useState<MacroProfile[]>([]);
    const [selectedMacroIndex, setSelectedMacroIndex] = useState<number>(0);
    const [isRecording, setIsRecording] = useState(false);
    const [standardDelay, setStandardDelay] = useState(true);
    const [delayValue, setDelayValue] = useState('50');
    const [pendingActions, setPendingActions] = useState<MacroAction[] | null>(null);
    const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
        open: false, msg: '', severity: 'success',
    });

    const pressedKeysRef = useRef(new Set<string>());
    const lastEventTimeRef = useRef(Date.now());
    const isFirstEventRef = useRef(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const selectedMacro = macros[selectedMacroIndex];
    /** 与设计稿一致：浅灰底、白卡、弱阴影（不用主色光晕） */
    const surfaceCardSx = {
        border: '1px solid #e5e7eb',
        bgcolor: '#ffffff',
        borderRadius: '14px',
        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.05)',
    } as const;
    const macroBlue = '#4a86f7';
    const macroBlueHover = '#3b78f0';

    // localStorage key（与 ConnectKbProvider 保持一致）
    const storageKey = `macro_profile_${keyboard?.version ?? 'default'}`;

    // ─── 初始化：优先从键盘读取，其次 ConnectKbContext，其次 localStorage，最后默认 ──
    useEffect(() => {
        const loadFromKeyboard = async () => {
            if (connectedKeyboard && typeof connectedKeyboard.getAllMacroDataV2 === 'function') {
                try {
                    const result = await connectedKeyboard.getAllMacroDataV2();
                    if (result && result.length > 0) {
                        const local = fromV1Profiles(result);
                        setMacros(local);
                        if (setV1Profiles) setV1Profiles(result);
                        localStorage.setItem(storageKey, JSON.stringify(result));
                        return;
                    }
                } catch (e) {
                    console.warn('[MacroRecorder] 从键盘读取宏失败，降级到本地:', e);
                }
            }
            // 降级：从 ConnectKbContext
            if (v1Profiles && v1Profiles.length > 0) {
                const local = fromV1Profiles(v1Profiles);
                setMacros(local);
                return;
            }
            // 降级：从 localStorage
            try {
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    const parsed: V1MacroProfile[] = JSON.parse(saved);
                    if (parsed.length > 0) {
                        const local = fromV1Profiles(parsed);
                        setMacros(local);
                        if (setV1Profiles) setV1Profiles(parsed);
                        return;
                    }
                }
            } catch { /* ignore */ }
            // 最后：创建初始 16 个空槽
            const initial: MacroProfile[] = Array.from({ length: 16 }, (_, i) => ({
                index: i,
                name: `M${i}`,
                actions: [],
                loopType: 0,
                loopCount: 1,
            }));
            setMacros(initial);
        };
        loadFromKeyboard();
    }, [connectedKeyboard]);

    // ─── 将本地 macros 同步到 ConnectKbContext + localStorage ──────────────
    const syncToContext = (updated: MacroProfile[]) => {
        const v1 = toV1Profiles(updated);
        if (setV1Profiles) setV1Profiles(v1);
        localStorage.setItem(storageKey, JSON.stringify(v1));
    };

    const handleSelectMacro = async (index: number) => {
        setSelectedMacroIndex(index);
        setIsRecording(false);
        setPendingActions(null);

        // 如果键盘上有按键被选中，则将该宏映射到选中的按键
        const selectedKeyIndex = keyboard?.selectIndex ?? -1;
        const currentLayer = keyboard?.layer ?? 0;
        if (selectedKeyIndex >= 0 && connectedKeyboard) {
            const macro = macros[index];
            if (!macro) return;
            const macroKey = macro.index;
            const macroType = macro.loopType;
            const macroReplay = macro.loopCount;
            try {
                if (macroType === 0 && macroReplay > 1) {
                    await connectedKeyboard.setKeyMatrixData?.(currentLayer, selectedKeyIndex, 0x61, macroKey, macroReplay);
                } else {
                    await connectedKeyboard.setKeyMatrixData?.(currentLayer, selectedKeyIndex, 0x60, macroKey, macroType);
                }
                keyboard?.updateUserKey?.(
                    { name: macro.name, code: `MACRO(${index})`, type: 0x60, code1: macroKey, code2: macroType, code3: macroReplay },
                    selectedKeyIndex, 0, currentLayer
                );
                keyboard?.saveUserKeys?.();
            } catch (e) {
                console.error(t('1703'), e);
            }
        }
    };

    const handleStartRecording = () => {
        setMacros(prev => prev.map((m, i) =>
            i === selectedMacroIndex ? { ...m, actions: [] } : m
        ));
        setIsRecording(true);
        pressedKeysRef.current.clear();
        lastEventTimeRef.current = Date.now();
        isFirstEventRef.current = true;
    };

    // ─── 下发宏数据到键盘 ──────────────────────────────────────────────────
    const pushToKeyboard = async (updated: MacroProfile[]) => {
        syncToContext(updated);
        if (!connectedKeyboard) return;
        try {
            await connectedKeyboard.setAllMacroDataV2(toV1Profiles(updated));
        } catch (e) {
            console.error(t('1704'), e);
        }
    };

    const handleStopRecording = () => {
        setIsRecording(false);
        // 停止录制时自动下发到键盘
        pushToKeyboard(macros);
    };

    const handleDragEnd = (result: DndDropResult) => {
        if (!result.destination || !selectedMacro) return;
        const { source, destination } = result;
        if (source.index === destination.index) return;
        const newActions = Array.from(selectedMacro.actions);
        const [removed] = newActions.splice(source.index, 1);
        newActions.splice(destination.index, 0, removed);
        const updated = macros.map((m, i) =>
            i === selectedMacroIndex ? { ...m, actions: newActions } : m
        );
        setMacros(updated);
        pushToKeyboard(updated);
    };

    // ─── 录制事件监听 ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (pressedKeysRef.current.has(e.key)) return;
            e.preventDefault();
            pressedKeysRef.current.add(e.key);

            const currentTime = Date.now();
            const delay = standardDelay
                ? Number(delayValue)
                : currentTime - lastEventTimeRef.current;

            const newActions: MacroAction[] = [];
            if (!isFirstEventRef.current) {
                newActions.push({
                    id: `delay-${Date.now()}-${Math.random()}`,
                    type: 'delay',
                    key: String(delay),
                    hasUpArrow: false,
                    hasDownArrow: false,
                    webCode: '',
                });
            }
            isFirstEventRef.current = false;

            let keyName = e.key.toUpperCase();
            switch (e.key) {
                case 'Control': keyName = 'CTRL'; break;
                case 'Escape': keyName = 'ESC'; break;
                case 'ArrowUp': keyName = 'UP'; break;
                case 'ArrowDown': keyName = 'DOWN'; break;
                case 'ArrowLeft': keyName = 'LEFT'; break;
                case 'ArrowRight': keyName = 'RIGHT'; break;
                case ' ': keyName = 'SPACE'; break;
            }

            newActions.push({
                id: `key-${Date.now()}-${Math.random()}`,
                type: 'keyboard',
                key: keyName,
                hasUpArrow: false,
                hasDownArrow: true,
                webCode: e.code,
            });

            setMacros(prev => prev.map((m, i) =>
                i === selectedMacroIndex
                    ? { ...m, actions: [...m.actions, ...newActions] }
                    : m
            ));
            lastEventTimeRef.current = currentTime;
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (!pressedKeysRef.current.has(e.key)) return;
            e.preventDefault();
            pressedKeysRef.current.delete(e.key);

            const currentTime = Date.now();
            const delay = standardDelay
                ? Number(delayValue)
                : currentTime - lastEventTimeRef.current;

            let keyName = e.key.toUpperCase();
            switch (e.key) {
                case 'Control': keyName = 'CTRL'; break;
                case 'Escape': keyName = 'ESC'; break;
                case 'ArrowUp': keyName = 'UP'; break;
                case 'ArrowDown': keyName = 'DOWN'; break;
                case 'ArrowLeft': keyName = 'LEFT'; break;
                case 'ArrowRight': keyName = 'RIGHT'; break;
                case ' ': keyName = 'SPACE'; break;
            }

            const newActions: MacroAction[] = [
                {
                    id: `delay-${Date.now()}-${Math.random()}`,
                    type: 'delay',
                    key: String(delay),
                    hasUpArrow: false,
                    hasDownArrow: false,
                    webCode: '',
                },
                {
                    id: `key-${Date.now()}-${Math.random()}`,
                    type: 'keyboard',
                    key: keyName,
                    hasUpArrow: true,
                    hasDownArrow: false,
                    webCode: e.code,
                },
            ];

            setMacros(prev => prev.map((m, i) =>
                i === selectedMacroIndex
                    ? { ...m, actions: [...m.actions, ...newActions] }
                    : m
            ));
            lastEventTimeRef.current = currentTime;
        };

        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keyup', handleKeyUp, true);
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('keyup', handleKeyUp, true);
        };
    }, [isRecording, selectedMacroIndex, standardDelay, delayValue]);

    useLayoutEffect(() => {
        if (!isRecording || !selectedMacro) return;
        const el = scrollContainerRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [selectedMacro, selectedMacro?.actions, isRecording]);

    const handleExport = () => {
        const v1 = toV1Profiles(macros);
        const blob = new Blob([JSON.stringify(v1, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'macros.json';
        link.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event: any) => {
                    try {
                        const parsed = JSON.parse(event.target.result);
                        // 兼容两种格式：V1 格式（有 key/list 字段）和本地格式（有 index/actions 字段）
                        let local: MacroProfile[];
                        if (parsed[0]?.list !== undefined) {
                            // V1 格式
                            local = fromV1Profiles(parsed);
                            if (setV1Profiles) setV1Profiles(parsed);
                            localStorage.setItem(storageKey, JSON.stringify(parsed));
                        } else {
                            // 本地格式（旧版导出）
                            local = parsed as MacroProfile[];
                            syncToContext(local);
                        }
                        setMacros(local);
                        setToast({ open: true, msg: t('1689'), severity: 'success' });
                    } catch (error) {
                        console.error(t('1705'), error);
                        setToast({ open: true, msg: t('1692'), severity: 'error' });
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                minHeight: 0,
                gap: 0,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'stretch',
                    gap: '24px',
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                }}
            >
                {/* 左：宏槽位 M0–M15（示意：未选为白底浅灰边，选中为蓝底白字） */}
                <Box
                    sx={{
                        flex: '0 0 256px',
                        width: 256,
                        maxWidth: 256,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        gap: '10px',
                        minHeight: 0,
                    }}
                >

                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 0,
                            ...surfaceCardSx,
                            p: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'auto',
                        }}
                    >
                        <Typography sx={{ fontSize: '13px', color: '#64748b', fontWeight: 500, lineHeight: 1.45, letterSpacing: '0.01em', textAlign: 'center',pb: 18 }}>
                            {t('1679')}
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '12px',
                            }}
                        >
                            {macros.map((macro) => {
                                const active = selectedMacroIndex === macro.index;
                                return (
                                    <ButtonRem
                                        key={macro.index}
                                        onClick={() => handleSelectMacro(macro.index)}
                                        sx={{
                                            borderRadius: '10px',
                                            textTransform: 'none',
                                            fontSize: active ? '14px' : '12px',
                                            height: '44px',
                                            minHeight: '44px',
                                            padding: '2px 4px',
                                            minWidth: 0,
                                            color: active ? '#ffffff' : '#94a3b8',
                                            background: active ? macroBlue : '#ffffff',
                                            border: `1px solid ${active ? macroBlue : '#e8edf3'}`,
                                            fontWeight: active ? 600 : 500,
                                            boxShadow: active ? 'none' : 'inset 0 1px 0 rgba(255,255,255,1)',
                                            transition: 'background 0.18s, color 0.18s, border-color 0.18s',
                                            '&:hover': {
                                                background: active ? macroBlueHover : '#f8fafc',
                                                color: active ? '#ffffff' : macroBlue,
                                                borderColor: active ? macroBlueHover : macroBlue,
                                            },
                                        }}
                                    >
                                        {macro.name}
                                    </ButtonRem>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>

                {/* 中：延迟、删除、录制、导入导出 */}
                <Box
                    sx={{
                        flex: '0 0 272px',
                        width: 272,
                        maxWidth: 272,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0,
                        minHeight: 0,
                    }}
                >
                    <Box
                        sx={{
                            ...surfaceCardSx,
                            p: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '14px',
                            flex: 1,
                            minHeight: 0,
                        }}
                    >
                        <Box
                            sx={{
                                width: '100%',
                                p: '12px',
                                borderRadius: '12px',
                                border: '1px solid #e8edf3',
                                bgcolor: '#f8fafc',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }}
                        >
                            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', width: '100%' }}>
                                <ButtonRem
                                    onClick={() => setStandardDelay(true)}
                                    disabled={isRecording}
                                    sx={{
                                        flex: 1,
                                        fontSize: '13px',
                                        minHeight: '38px',
                                        px: '6px',
                                        textTransform: 'none',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        color: standardDelay ? '#ffffff' : '#64748b',
                                        bgcolor: standardDelay ? macroBlue : '#ffffff',
                                        border: `1px solid ${standardDelay ? macroBlue : '#e2e8f0'}`,
                                        '&:hover': {
                                            bgcolor: standardDelay ? macroBlueHover : '#f1f5f9',
                                        },
                                    }}
                                >
                                    {t('1682')}
                                </ButtonRem>
                                <ButtonRem
                                    onClick={() => setStandardDelay(false)}
                                    disabled={isRecording}
                                    sx={{
                                        flex: 1,
                                        fontSize: '13px',
                                        minHeight: '38px',
                                        px: '6px',
                                        textTransform: 'none',
                                        borderRadius: '10px',
                                        fontWeight: 600,
                                        color: !standardDelay ? '#ffffff' : '#64748b',
                                        bgcolor: !standardDelay ? macroBlue : '#ffffff',
                                        border: `1px solid ${!standardDelay ? macroBlue : '#e2e8f0'}`,
                                        '&:hover': {
                                            bgcolor: !standardDelay ? macroBlueHover : '#f1f5f9',
                                        },
                                    }}
                                >
                                    {t('1683')}
                                </ButtonRem>
                            </Box>
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    visibility: standardDelay ? 'visible' : 'hidden',
                                    minHeight: standardDelay ? undefined : 0,
                                    height: standardDelay ? undefined : 0,
                                    overflow: 'hidden',
                                }}
                            >
                                <Typography sx={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                    {t('1684')}
                                </Typography>
                                <TextField
                                    size="small"
                                    value={delayValue}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        if (!/^\d*$/.test(raw)) return;
                                        setDelayValue(raw);
                                    }}
                                    onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setDelayValue(String(DELAY_MIN));
                                            return;
                                        }
                                        setDelayValue(String(clampDelayValue(val)));
                                    }}
                                    disabled={isRecording}
                                    inputProps={{ min: DELAY_MIN, max: DELAY_MAX }}
                                    sx={{
                                        width: '68px',
                                        '& .MuiInputBase-input': { fontSize: '13px', py: '7px', fontWeight: 600 },
                                        '& .MuiOutlinedInput-root': {
                                            height: '38px',
                                            bgcolor: '#ffffff',
                                            borderRadius: '8px',
                                        },
                                    }}
                                />
                                <Typography sx={{ fontSize: '13px', color: '#94a3b8', fontWeight: 500 }}>ms</Typography>
                            </Box>
                        </Box>

                        {pendingActions !== null ? (
                            <>
                                <ButtonRem
                                    onClick={() => {
                                        pushToKeyboard(macros);
                                        setPendingActions(null);
                                    }}
                                    sx={{
                                        width: '100%',
                                        minHeight: '42px',
                                        fontSize: '13px',
                                        textTransform: 'none',
                                        color: '#16a34a',
                                        border: '1px solid rgba(22,163,74,0.45)',
                                        borderRadius: '10px',
                                        bgcolor: '#f0fdf4',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: '#dcfce7' },
                                    }}
                                >
                                    {t('1685')}
                                </ButtonRem>
                                <ButtonRem
                                    onClick={() => {
                                        if (pendingActions === null) return;
                                        setMacros(
                                            macros.map((m, i) =>
                                                i === selectedMacroIndex ? { ...m, actions: pendingActions } : m,
                                            ),
                                        );
                                        setPendingActions(null);
                                    }}
                                    sx={{
                                        width: '100%',
                                        minHeight: '42px',
                                        fontSize: '13px',
                                        textTransform: 'none',
                                        color: '#d97706',
                                        border: '1px solid rgba(245,158,11,0.5)',
                                        borderRadius: '10px',
                                        bgcolor: '#fffbeb',
                                        fontWeight: 600,
                                        '&:hover': { bgcolor: '#fef3c7' },
                                    }}
                                >
                                    {t('1686')}
                                </ButtonRem>
                            </>
                        ) : (
                            <ButtonRem
                                onClick={() => {
                                    if (!selectedMacro) return;
                                    const updated = macros.map((m, i) =>
                                        i === selectedMacroIndex ? { ...m, actions: [] } : m,
                                    );
                                    setMacros(updated);
                                    pushToKeyboard(updated);
                                }}
                                sx={{
                                    width: '100%',
                                    minHeight: '44px',
                                    fontSize: '14px',
                                    textTransform: 'none',
                                    color: '#dc2626',
                                    border: '1px solid rgba(220,38,38,0.45)',
                                    borderRadius: '10px',
                                    bgcolor: '#ffffff',
                                    fontWeight: 600,
                                    '&:hover': { bgcolor: '#fef2f2' },
                                }}
                            >
                                {t('603')}
                            </ButtonRem>
                        )}

                        <ButtonRem
                            variant="contained"
                            onClick={isRecording ? handleStopRecording : handleStartRecording}
                            sx={{
                                width: '100%',
                                minHeight: '46px',
                                fontSize: '14px',
                                textTransform: 'none',
                                borderRadius: '10px',
                                fontWeight: 600,
                                bgcolor: isRecording ? '#ef4444' : macroBlue,
                                color: '#fff !important',
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: isRecording ? '#dc2626' : macroBlueHover,
                                    boxShadow: 'none',
                                },
                            }}
                        >
                            {isRecording ? (
                                <>
                                    <StopRoundedIcon sx={{ fontSize: '20px', mr: '6px' }} />
                                    {t('563')}
                                </>
                            ) : (
                                <>
                                    <PlayArrowRoundedIcon sx={{ fontSize: '20px', mr: '6px' }} />
                                    {t('564')}
                                </>
                            )}
                        </ButtonRem>

                        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '10px', width: '100%', pt: '2px' }}>
                            <ButtonRem
                                onClick={handleImport}
                                sx={{
                                    flex: 1,
                                    minHeight: '42px',
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    bgcolor: '#ffffff',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
                                }}
                            >
                                {t('1680')}
                            </ButtonRem>
                            <ButtonRem
                                onClick={handleExport}
                                sx={{
                                    flex: 1,
                                    minHeight: '42px',
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    bgcolor: '#ffffff',
                                    color: '#64748b',
                                    border: '1px solid #e2e8f0',
                                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' },
                                }}
                            >
                                {t('1681')}
                            </ButtonRem>
                        </Box>
                    </Box>
                </Box>

                {/* 右：宏序列（示意：大块浅灰底，约占剩余宽度一半以上） */}
                <Box
                    sx={{
                        flex: '1 1 48%',
                        minWidth: 0,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {selectedMacro && (
                        <Box
                            ref={scrollContainerRef}
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                ...surfaceCardSx,
                                p: '18px',
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                bgcolor: '#f1f4f9',
                                border: '1px solid #e2e8f0',
                                '&::-webkit-scrollbar': { width: '6px' },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: 'rgba(100,116,139,0.35)',
                                    borderRadius: '4px',
                                },
                                '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                            }}
                        >
                            {selectedMacro.actions.length === 0 ? (
                                <Typography sx={{ textAlign: 'center', fontSize: '13px', py: 6, color: '#94a3b8', fontWeight: 500 }}>
                                    {isRecording ? t('1687') : t('1688')}
                                </Typography>
                            ) : (
                                <DragDropContext onDragEnd={handleDragEnd}>
                                    <Droppable droppableId="macro-actions" direction="horizontal">
                                        {(provided: any) => (
                                            <Box
                                                ref={provided.innerRef}
                                                {...provided.droppableProps}
                                                sx={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '8px',
                                                    alignItems: 'center',
                                                    alignContent: 'flex-start',
                                                    p: '4px',
                                                }}
                                            >
                                                {selectedMacro.actions.map((action, index) => (
                                                    <Draggable key={action.id} draggableId={action.id} index={index}>
                                                        {(provided: any, snapshot: any) => (
                                                            <Box
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                sx={{
                                                                    position: 'relative',
                                                                    display: 'flex',
                                                                    flexDirection: 'column',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    gap: '2.4px',
                                                                    p: '4.8px 6.4px',
                                                                    borderRadius: '6px',
                                                                    border:
                                                                        action.type === 'delay'
                                                                            ? '1px solid #d9d9d9'
                                                                            : '1px solid #e2e8f0',
                                                                    bgcolor: action.type === 'delay' ? '#d9d9d9' : '#f8fafc',
                                                                    cursor: 'grab',
                                                                    opacity: snapshot.isDragging ? 0.75 : 1,
                                                                    boxShadow: snapshot.isDragging
                                                                        ? '0 4px 12px rgba(59,130,246,0.2)'
                                                                        : '0 1px 2px rgba(0,0,0,0.06)',
                                                                    transform: snapshot.isDragging ? 'scale(1.06) rotate(1deg)' : 'scale(1)',
                                                                    transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                                                                    minWidth: '48px',
                                                                    minHeight: '16px',
                                                                    '&:hover': {
                                                                        borderColor: action.type === 'delay' ? '#93c5fd' : '#cbd5e1',
                                                                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                                                        '& .delete-btn': { opacity: 1 },
                                                                    },
                                                                }}
                                                            >
                                                                <Box
                                                                    className="delete-btn"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        if (!selectedMacro) return;
                                                                        setPendingActions(selectedMacro.actions);
                                                                        const updated = macros.map((m, mi) =>
                                                                            mi === selectedMacroIndex
                                                                                ? { ...m, actions: m.actions.filter((_, ai) => ai !== index) }
                                                                                : m,
                                                                        );
                                                                        setMacros(updated);
                                                                    }}
                                                                    sx={{
                                                                        position: 'absolute',
                                                                        top: '-5.6px',
                                                                        right: '-5.6px',
                                                                        width: '14px',
                                                                        height: '14px',
                                                                        borderRadius: '50%',
                                                                        bgcolor: '#ef4444',
                                                                        color: '#fff',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        fontSize: '14px',
                                                                        fontWeight: 700,
                                                                        cursor: 'pointer',
                                                                        opacity: 0,
                                                                        transition: 'opacity 0.15s ease',
                                                                        lineHeight: 1,
                                                                        zIndex: 10,
                                                                        '&:hover': { bgcolor: '#dc2626' },
                                                                    }}
                                                                >
                                                                    ×
                                                                </Box>
                                                                {action.type === 'delay' ? (
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '2.4px' }}>
                                                                        <Box
                                                                            component="input"
                                                                            type="number"
                                                                            value={action.key}
                                                                            onClick={(e: any) => e.stopPropagation()}
                                                                            onMouseDown={(e: any) => e.stopPropagation()}
                                                                            onChange={(e: any) => {
                                                                                const val = e.target.value as string;
                                                                                if (!/^\d*$/.test(val)) return;
                                                                                setMacros((prev) =>
                                                                                    prev.map((m, mi) =>
                                                                                        mi === selectedMacroIndex
                                                                                            ? {
                                                                                                ...m,
                                                                                                actions: m.actions.map((a, ai) =>
                                                                                                    ai === index ? { ...a, key: val } : a,
                                                                                                ),
                                                                                            }
                                                                                            : m,
                                                                                    ),
                                                                                );
                                                                            }}
                                                                            onBlur={(e: any) => {
                                                                                const val = e.target.value as string;
                                                                                const normalized = String(clampDelayValue(val));
                                                                                setMacros((prev) =>
                                                                                    prev.map((m, mi) =>
                                                                                        mi === selectedMacroIndex
                                                                                            ? {
                                                                                                ...m,
                                                                                                actions: m.actions.map((a, ai) =>
                                                                                                    ai === index ? { ...a, key: normalized } : a,
                                                                                                ),
                                                                                            }
                                                                                            : m,
                                                                                    ),
                                                                                );
                                                                            }}
                                                                            min={DELAY_MIN}
                                                                            max={DELAY_MAX}
                                                                            sx={{
                                                                                width: '28px',
                                                                                height: '12px',
                                                                                border: 'none',
                                                                                outline: 'none',
                                                                                background: 'transparent',
                                                                                fontSize: '10px',
                                                                                fontWeight: 700,
                                                                                color: '#3B82F6',
                                                                                textAlign: 'center',
                                                                                lineHeight: 1,
                                                                                p: 0,
                                                                                cursor: 'text',
                                                                                '&::-webkit-inner-spin-button': { display: 'none' },
                                                                                '&::-webkit-outer-spin-button': { display: 'none' },
                                                                                MozAppearance: 'textfield',
                                                                            }}
                                                                        />
                                                                        <Typography
                                                                            sx={{
                                                                                fontSize: '7px',
                                                                                color: '#93c5fd',
                                                                                lineHeight: 1,
                                                                                fontWeight: 600,
                                                                                letterSpacing: '0.03em',
                                                                            }}
                                                                        >
                                                                            ms
                                                                        </Typography>
                                                                    </Box>
                                                                ) : (
                                                                    <Typography
                                                                        sx={{
                                                                            fontSize: '11px',
                                                                            fontWeight: 700,
                                                                            color: '#334155',
                                                                            lineHeight: 1,
                                                                            textAlign: 'center',
                                                                            letterSpacing: '0.02em',
                                                                        }}
                                                                    >
                                                                        {action.key}
                                                                    </Typography>
                                                                )}
                                                                {action.type !== 'delay' && (
                                                                    <Box
                                                                        sx={{
                                                                            display: 'flex',
                                                                            gap: '1.6px',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            minHeight: '11.2px',
                                                                            mt: '1.6px',
                                                                        }}
                                                                    >
                                                                        {action.hasDownArrow && (
                                                                            <Typography
                                                                                sx={{
                                                                                    fontSize: '10px',
                                                                                    color: '#fb7185',
                                                                                    lineHeight: 1,
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            >
                                                                                ↓
                                                                            </Typography>
                                                                        )}
                                                                        {action.hasUpArrow && (
                                                                            <Typography
                                                                                sx={{
                                                                                    fontSize: '10px',
                                                                                    color: '#60a5fa',
                                                                                    lineHeight: 1,
                                                                                    fontWeight: 700,
                                                                                }}
                                                                            >
                                                                                ↑
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                            </Box>
                                        )}
                                    </Droppable>
                                </DragDropContext>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast((x) => ({ ...x, open: false }))}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={toast.severity} onClose={() => setToast((x) => ({ ...x, open: false }))}>
                    {toast.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default MacroRecorder;

