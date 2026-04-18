'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useContext } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import {
    Box,
    TextField,
    Typography,
    Snackbar,
    Alert,
} from '@mui/material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { ButtonRem } from '@/styled/ReconstructionRem';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import type { MacroProfile as V1MacroProfile, MacroAction as V1MacroAction } from '@/types/types_v1';
import { useTranslation } from 'react-i18next';

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
        <Box sx={{ display: 'flex', gap: '1rem', height: '100%', width: '100%', p: '2rem', flexDirection: 'column' }}>
            {/* 主容器 */}
            <Box sx={{ display: 'flex', gap: '1rem', height: '100%', flex: 1 }}>
                {/* 左侧 M0-M15 按钮 4x4 网格 */}
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem" }}>
                    <Typography sx={{ fontSize: '1rem', color: '#5f7089' }}>
                        {t('1679')}
                    </Typography>
                    <Box
                        sx={{
                            width: '17rem',
                            border: '0.0625rem solid rgba(153,169,191,.25)',
                            background: 'rgba(255,255,255,.42)',
                            p: 10,
                            borderRadius: '0.75rem',
                            boxShadow: 'rgba(176, 206, 255, 0.5) 0rem 0rem 1.3125rem',
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            overflow: 'auto',
                        }}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '0.75rem',
                            }}
                        >
                            {macros.map(macro => (
                                <ButtonRem
                                    key={macro.index}
                                    onClick={() => handleSelectMacro(macro.index)}
                                    sx={{
                                        borderRadius: '0.375rem',
                                        textTransform: 'none',
                                        fontSize: '0.75rem',
                                        height: '2.25rem',
                                        padding: '0.375rem 0.75rem',
                                        minWidth: 'unset',
                                        color: selectedMacroIndex === macro.index ? '#fff' : '#66778f',
                                        background: selectedMacroIndex === macro.index ? '#3B82F6' : 'transparent',
                                        border: `0.0625rem solid ${selectedMacroIndex === macro.index ? '#3B82F6' : 'rgba(153,169,191,.25)'}`,
                                        fontWeight: 500,
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            background: selectedMacroIndex === macro.index ? '#2f70dc' : 'rgba(59,130,246,.10)',
                                            color: selectedMacroIndex === macro.index ? '#fff' : '#3B82F6',
                                            borderColor: '#3B82F6',
                                        },
                                    }}
                                >
                                    {macro.name}
                                </ButtonRem>
                            ))}
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {/* 顶部操作栏：导入/导出/保存到键盘 */}
                    <Box sx={{ display: 'flex', gap: '0.5rem', width: '100%', mb: "1rem", alignItems: 'center' }}>
                        <ButtonRem
                            onClick={handleImport}
                            sx={{
                                borderRadius: '0.375rem',
                                textTransform: 'none',
                                fontSize: '0.7rem',
                                height: '1.75rem',
                                bgcolor: '#f0f0f0',
                                color: '#5f7089',
                                border: '0.0625rem solid rgba(153,169,191,.25)',
                                fontWeight: 500,
                                '&:hover': { bgcolor: '#e8e8e8' },
                            }}
                        >
                            {t('1680')}
                        </ButtonRem>
                        <ButtonRem
                            onClick={handleExport}
                            sx={{
                                borderRadius: '0.375rem',
                                textTransform: 'none',
                                fontSize: '0.7rem',
                                height: '1.75rem',
                                bgcolor: '#f0f0f0',
                                color: '#5f7089',
                                border: '0.0625rem solid rgba(153,169,191,.25)',
                                fontWeight: 500,
                                '&:hover': { bgcolor: '#e8e8e8' },
                            }}
                        >
                            {t('1681')}
                        </ButtonRem>
                        {/* {connectedKeyboard && (
                            <Typography sx={{ fontSize: '0.65rem', color: '#22c55e', ml: '0.25rem' }}>
                                ● 已连接
                            </Typography>
                        )} */}
                    </Box>

                    {/* 编辑面板 */}
                    <Box sx={{ flex: 1, display: 'flex' }}>
                        {/* 工具栏 */}
                        <Box
                            sx={{
                                gap: '.5rem',
                                overflow: 'auto',
                                border: '0.0625rem solid rgba(153,169,191,.25)',
                                background: 'rgba(255,255,255,.42)',
                                borderRadius: '0.75rem',
                                boxShadow: 'rgba(176, 206, 255, 0.5) 0rem 0rem 1.3125rem',
                                px: '0.75rem',
                                py: '1rem',
                                width: "11rem",
                                display: 'flex',
                                flexDirection: 'column',
                            }}
                        >
                            {/* 自定义延迟 / 录制延迟 切换 */}
                            <Box sx={{
                                width: "100%",
                                padding: "0.5rem 0.425rem",
                                borderRadius: "1rem",
                                display: "flex",
                                flexDirection: "column",
                                color: "#64748b",
                                border: "0.0625rem solid #64748b",
                                gap: ".5rem"
                            }}>
                                <Box>
                                    <ButtonRem
                                        onClick={() => setStandardDelay(true)}
                                        disabled={isRecording}
                                        sx={{
                                            fontSize: '0.65rem',
                                            height: '1.5rem',
                                            px: '0.5rem',
                                            minWidth: 'unset',
                                            textTransform: 'none',
                                            borderRadius: '0.3rem',
                                            fontWeight: 500,
                                            color: standardDelay ? '#fff' : '#5f7089',
                                            bgcolor: standardDelay ? '#3B82F6' : 'transparent',
                                            border: `0.0625rem solid ${standardDelay ? '#3B82F6' : 'rgba(153,169,191,.35)'}`,
                                            '&:hover': { bgcolor: standardDelay ? '#2f70dc' : 'rgba(59,130,246,.08)' },
                                        }}
                                    >
                                        {t('1682')}
                                    </ButtonRem>
                                    <ButtonRem
                                        onClick={() => setStandardDelay(false)}
                                        disabled={isRecording}
                                        sx={{
                                            fontSize: '0.65rem',
                                            height: '1.5rem',
                                            px: '0.5rem',
                                            minWidth: 'unset',
                                            textTransform: 'none',
                                            borderRadius: '0.3rem',
                                            fontWeight: 500,
                                            color: !standardDelay ? '#fff' : '#5f7089',
                                            bgcolor: !standardDelay ? '#3B82F6' : 'transparent',
                                            border: `0.0625rem solid ${!standardDelay ? '#3B82F6' : 'rgba(153,169,191,.35)'}`,
                                            '&:hover': { bgcolor: !standardDelay ? '#2f70dc' : 'rgba(59,130,246,.08)' },
                                        }}
                                    >
                                        {t('1683')}
                                    </ButtonRem>
                                </Box>
                                <Box sx={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', visibility: standardDelay ? 'visible' : 'hidden', height: '1.5rem', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '0.65rem', color: '#5f7089', whiteSpace: 'nowrap' }}>
                                        {t('1684')}
                                    </Typography>
                                    <TextField
                                        size="small"
                                        value={delayValue}
                                        onChange={(e) => setDelayValue(e.target.value)}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val === '') { setDelayValue('10'); return; }
                                            const num = parseInt(val, 10);
                                            if (isNaN(num)) { setDelayValue('10'); return; }
                                            setDelayValue(String(Math.min(255, Math.max(10, num))));
                                        }}
                                        disabled={isRecording}
                                        inputProps={{ min: 10, max: 255 }}
                                        sx={{
                                            width: '3.5rem',
                                            '& .MuiInputBase-input': { fontSize: '0.65rem', p: '0.2rem 0.3rem' },
                                            '& .MuiOutlinedInput-root': { height: '1.5rem' },
                                        }}
                                    />
                                    <Typography sx={{ fontSize: '0.65rem', color: '#5f7089' }}>ms</Typography>
                                </Box>
                            </Box>

                            {/* 删除宏 / 保存撤销 */}
                            {pendingActions !== null ? (
                                <>
                                    <ButtonRem
                                        onClick={() => {
                                            pushToKeyboard(macros);
                                            setPendingActions(null);
                                        }}
                                        sx={{
                                            fontSize: '0.65rem', height: '1.5rem', px: '0.5rem', minWidth: 'unset',
                                            textTransform: 'none', color: '#16a34a',
                                            border: '0.0625rem solid rgba(22,163,74,0.35)', borderRadius: '0.3rem',
                                            bgcolor: 'rgba(22,163,74,0.06)', '&:hover': { bgcolor: 'rgba(22,163,74,0.14)' },
                                        }}
                                    >
                                        {t('1685')}
                                    </ButtonRem>
                                    <ButtonRem
                                        onClick={() => {
                                            if (pendingActions === null) return;
                                            setMacros(macros.map((m, i) =>
                                                i === selectedMacroIndex ? { ...m, actions: pendingActions } : m
                                            ));
                                            setPendingActions(null);
                                        }}
                                        sx={{
                                            fontSize: '0.65rem', height: '1.5rem', px: '0.5rem', minWidth: 'unset',
                                            textTransform: 'none', color: '#f59e0b',
                                            border: '0.0625rem solid rgba(245,158,11,0.35)', borderRadius: '0.3rem',
                                            bgcolor: 'rgba(245,158,11,0.06)', '&:hover': { bgcolor: 'rgba(245,158,11,0.14)' },
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
                                            i === selectedMacroIndex ? { ...m, actions: [] } : m
                                        );
                                        setMacros(updated);
                                        pushToKeyboard(updated);
                                    }}
                                    sx={{
                                        fontSize: '0.65rem', height: '1.5rem', px: '0.5rem', minWidth: 'unset',
                                        textTransform: 'none', color: '#e05555',
                                        border: '0.0625rem solid rgba(224,85,85,0.35)', borderRadius: '0.3rem',
                                        bgcolor: 'rgba(224,85,85,0.06)', '&:hover': { bgcolor: 'rgba(224,85,85,0.14)' },
                                    }}
                                >
                                    {t('603')}
                                </ButtonRem>
                            )}

                            {/* 开始/停止录制按钮 */}
                            <Box>
                                <ButtonRem
                                    variant="contained"
                                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    sx={{
                                        fontSize: '0.65rem', height: '1.5rem', px: '0.625rem',
                                        minWidth: '100%', textTransform: 'none', borderRadius: '0.3rem', fontWeight: 500,
                                        bgcolor: isRecording ? '#e05555' : '#3B82F6',
                                        '&:hover': { bgcolor: isRecording ? '#c94444' : '#2f70dc' },
                                    }}
                                >
                                    {isRecording
                                        ? <><StopRoundedIcon sx={{ fontSize: '0.85rem', mr: '0.25rem' }} />{t('563')}</>
                                        : <><PlayArrowRoundedIcon sx={{ fontSize: '0.85rem', mr: '0.25rem' }} />{t('564')}</>
                                    }
                                </ButtonRem>
                            </Box>
                        </Box>

                        {/* 右侧 宏动作序列 */}
                        {selectedMacro && (
                            <Box
                                ref={scrollContainerRef}
                                sx={{
                                    flex: 1,
                                    border: '0.0625rem solid rgba(153,169,191,.25)',
                                    background: 'rgba(255,255,255,.42)',
                                    borderRadius: '0.75rem',
                                    boxShadow: 'rgba(176, 206, 255, 0.5) 0rem 0rem 1.3125rem',
                                    p: '1rem',
                                    overflow: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    '&::-webkit-scrollbar': { width: '0.375rem' },
                                    '&::-webkit-scrollbar-thumb': { backgroundColor: '#ddd', borderRadius: '0.25rem' },
                                    '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
                                }}
                            >
                                {selectedMacro.actions.length === 0 ? (
                                    <Typography color="text.secondary" sx={{ textAlign: 'center', fontSize: '0.75rem', py: 2 }}>
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
                                                        gap: '0.5rem',
                                                        alignItems: 'center',
                                                        alignContent: 'flex-start',
                                                        p: '0.25rem',
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
                                                                        gap: '0.15rem',
                                                                        p: '0.3rem 0.4rem',
                                                                        borderRadius: '0.375rem',
                                                                        border: action.type === 'delay' ? '0.0625rem solid #d9d9d9' : '0.0625rem solid #e2e8f0',
                                                                        bgcolor: action.type === 'delay' ? '#d9d9d9' : '#f8fafc',
                                                                        cursor: 'grab',
                                                                        opacity: snapshot.isDragging ? 0.75 : 1,
                                                                        boxShadow: snapshot.isDragging ? '0 4px 12px rgba(59,130,246,0.2)' : '0 1px 2px rgba(0,0,0,0.06)',
                                                                        transform: snapshot.isDragging ? 'scale(1.06) rotate(1deg)' : 'scale(1)',
                                                                        transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                                                                        minWidth: '2.5rem',
                                                                        minHeight: '.75rem',
                                                                        '&:hover': {
                                                                            borderColor: action.type === 'delay' ? '#93c5fd' : '#cbd5e1',
                                                                            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                                                                            '& .delete-btn': { opacity: 1 },
                                                                        },
                                                                    }}
                                                                >
                                                                    {/* 单个删除按钮 */}
                                                                    <Box
                                                                        className="delete-btn"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (!selectedMacro) return;
                                                                            setPendingActions(selectedMacro.actions);
                                                                            const updated = macros.map((m, mi) =>
                                                                                mi === selectedMacroIndex
                                                                                    ? { ...m, actions: m.actions.filter((_, ai) => ai !== index) }
                                                                                    : m
                                                                            );
                                                                            setMacros(updated);
                                                                        }}
                                                                        sx={{
                                                                            position: 'absolute',
                                                                            top: '-0.35rem',
                                                                            right: '-0.35rem',
                                                                            width: '0.875rem',
                                                                            height: '0.875rem',
                                                                            borderRadius: '50%',
                                                                            bgcolor: '#ef4444',
                                                                            color: '#fff',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontSize: '0.55rem',
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
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
                                                                            <Box
                                                                                component="input"
                                                                                type="number"
                                                                                value={action.key}
                                                                                onClick={(e: any) => e.stopPropagation()}
                                                                                onMouseDown={(e: any) => e.stopPropagation()}
                                                                                onChange={(e: any) => {
                                                                                    const val = e.target.value;
                                                                                    setMacros(prev => prev.map((m, mi) =>
                                                                                        mi === selectedMacroIndex
                                                                                            ? { ...m, actions: m.actions.map((a, ai) => ai === index ? { ...a, key: val } : a) }
                                                                                            : m
                                                                                    ));
                                                                                }}
                                                                                sx={{
                                                                                    width: '1.75rem',
                                                                                    height: '.75rem',
                                                                                    border: 'none',
                                                                                    outline: 'none',
                                                                                    background: 'transparent',
                                                                                    fontSize: '0.6rem',
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
                                                                            <Typography sx={{ fontSize: '0.45rem', color: '#93c5fd', lineHeight: 1, fontWeight: 600, letterSpacing: '0.03em' }}>
                                                                                ms
                                                                            </Typography>
                                                                        </Box>
                                                                    ) : (
                                                                        <Typography
                                                                            sx={{
                                                                                fontSize: '0.7rem',
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
                                                                                gap: '0.1rem',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'center',
                                                                                minHeight: '0.7rem',
                                                                                mt: '0.1rem',
                                                                            }}
                                                                        >
                                                                            {action.hasDownArrow && (
                                                                                <Typography sx={{ fontSize: '0.6rem', color: '#fb7185', lineHeight: 1, fontWeight: 700 }}>↓</Typography>
                                                                            )}
                                                                            {action.hasUpArrow && (
                                                                                <Typography sx={{ fontSize: '0.6rem', color: '#60a5fa', lineHeight: 1, fontWeight: 700 }}>↑</Typography>
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
            </Box>

            {/* Toast 提示 */}
            <Snackbar
                open={toast.open}
                autoHideDuration={3000}
                onClose={() => setToast(t => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity={toast.severity} onClose={() => setToast(t => ({ ...t, open: false }))}>
                    {toast.msg}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default MacroRecorder;

