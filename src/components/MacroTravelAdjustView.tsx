'use client';

import { Box, Button, Slider, Typography } from '@mui/material';
import { useContext, useMemo, useState } from 'react';
import { ConnectKbContext } from '@/providers/ConnectKbProvider';
import type { LayoutKey } from '@/types/types_v1';
import TravelVirtualKeyboard from '@/components/TravelVirtualKeyboard';
import { mergeLayoutKeysWithUserKeyNames } from '@/utils/mergeLayoutKeysWithUserKeyNames';

export default function MacroTravelAdjustView() {
    const { keyboard } = useContext(ConnectKbContext);
    const layoutKeys: LayoutKey[] = keyboard?.layoutKeys ?? [];
    const travelKeys = keyboard?.travelKeys ?? [];
    const currentLayer = keyboard?.layer ?? 0;
    const userKeysRow = keyboard?.userKeys?.[currentLayer] ?? [];
    const displayLayoutKeys = useMemo(
        () => mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeysRow),
        [layoutKeys, userKeysRow],
    );

    const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
    const [travelValue, setTravelValue] = useState<number>(1.5);

    const toggleKey = (keyIndex: number) => {
        setSelectedKeys((prev) =>
            prev.includes(keyIndex) ? prev.filter((k) => k !== keyIndex) : [...prev, keyIndex]
        );
    };

    const selectAll = () => {
        setSelectedKeys(layoutKeys.map((key, idx) => key.index ?? idx));
    };

    const clearAll = () => {
        setSelectedKeys([]);
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, flex: 1 }}>
            <TravelVirtualKeyboard
                layoutKeys={displayLayoutKeys}
                travelKeys={travelKeys}
                selectedKeys={selectedKeys}
                travelValue={travelValue}
                onToggleKey={toggleKey}
                showActuation
            />
            <Box
                sx={{
                    width: '80%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    minHeight: 0,
                    margin: '0 auto',
                }}
            >


                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }}>
                    <Button onClick={selectAll} sx={{ minWidth: '5.25rem', height: '1.875rem', borderRadius: '0.5rem', background: 'rgba(225,234,247,.85)', color: '#6f7f96', textTransform: 'none' }}>
                        全选
                    </Button>
                    <Button onClick={clearAll} sx={{ minWidth: '5.75rem', height: '1.875rem', borderRadius: '0.5rem', background: 'rgba(225,234,247,.85)', color: '#6f7f96', textTransform: 'none' }}>
                        取消选择
                    </Button>
            <Typography sx={{ fontSize: '0.875rem', color: '#7c8ca5', mb: 0 }}>已选 {selectedKeys.length} 个键位</Typography>
                </Box>

                <Box sx={{ flex: 1, minHeight: 220, display: 'flex', gap: 2 }}>
                    <Box
                        sx={{
                            width: '11.875rem',
                            borderRadius: '0rem',
                            border: '0.0625rem solid rgba(153,169,191,.25)',
                            background: 'rgba(255,255,255,.44)',
                            p: 2,
                        }}
                    >
                        <Typography sx={{ color: '#60718a', fontWeight: 700, mb: 1.5 }}>按键测试</Typography>
                        <Box sx={{ height: '10rem', borderRadius: '0rem', border: '0.0625rem dashed rgba(140,158,181,.35)', background: 'rgba(255,255,255,.4)' }} />
                    </Box>

                    <Box
                        sx={{
                            flex: 1,
                            borderRadius: '0rem',
                            border: '0.0625rem solid rgba(153,169,191,.25)',
                            background: 'rgba(255,255,255,.44)',
                            p: 2.5,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                        }}
                    >
                        <Typography sx={{ color: '#60718a', fontWeight: 700 }}>触发演示</Typography>
                        <Typography sx={{ color: '#60718a', fontWeight: 700 }}>设置触发键程</Typography>
                        <Typography sx={{ color: '#7e8da5', fontSize: '0.8125rem' }}>
                            设置触发键程后，轴体按压到指定深度才会被触发。
                        </Typography>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Slider
                                min={0}
                                max={4.5}
                                step={0.05}
                                value={travelValue}
                                onChange={(_, value) => setTravelValue(value as number)}
                                sx={{
                                    color: '#3B82F6',
                                    '& .MuiSlider-thumb': { width: 18, height: 18, border: '0.1875rem solid #fff' },
                                }}
                            />
                            <Typography sx={{ width: '5rem', textAlign: 'right', color: '#5f7089', fontWeight: 700 }}>
                                {travelValue.toFixed(2)} MM
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>

    );
}
