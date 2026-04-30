import React, { useContext, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import ColorPicker from "../ColorPicker";
import { useTranslation } from "react-i18next";
import { Box, Typography } from "@mui/material";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import { debounce } from "lodash";
import { FunInfo } from "@/types/types_v1";
import { ButtonRem, SliderRem } from "@/styled/ReconstructionRem";
import TravelVirtualKeyboard from "../TravelVirtualKeyboard";
import { mergeLayoutKeysWithUserKeyNames } from "@/utils/mergeLayoutKeysWithUserKeyNames";

const rgbToHex = (r: number, g: number, b: number) => {
    const rr = Math.max(0, Math.min(255, r));
    const gg = Math.max(0, Math.min(255, g));
    const bb = Math.max(0, Math.min(255, b));
    return `#${rr.toString(16).padStart(2, "0")}${gg
        .toString(16)
        .padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`.toUpperCase();
};

const Matrix = () => {
    const { matrixData, keyboard, keyboardLayout, connectedKeyboard } = useContext(ConnectKbContext);
    const { t } = useTranslation();

    const {
        LightMode,
        selectedColor,
        setSelectedColor,
        setLightMode,
        brightnessValue,
        setBrightnessValue,
        speedValue,
        setSpeedValue,
    } = matrixData;

    const deviceBaseInfo = keyboard?.deviceBaseInfo;
    const deviceFuncInfo = keyboard?.deviceFuncInfo;
    const matrixLightList = keyboardLayout?.lighting?.matrixlight ?? [];
    const layoutKeys = keyboard?.layoutKeys ?? [];
    const travelKeys = keyboard?.travelKeys ?? [];
    const currentLayer = keyboard?.layer ?? 0;
    const userKeysRow = keyboard?.userKeys?.[currentLayer] ?? [];
    const displayLayoutKeys = useMemo(
        () => mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeysRow),
        [layoutKeys, userKeysRow],
    );
    const [brightnessInput, setBrightnessInput] = useState('0');
    const matrixSpeedMax = Math.max(deviceBaseInfo?.matrixScreenLightMaxSpeed || 4, 1);

    useEffect(() => {
        if (!deviceBaseInfo || !deviceFuncInfo) return;

        matrixData.setRows(deviceBaseInfo.matrixScreenLightRows || 7);
        matrixData.setCols(deviceBaseInfo.matrixScreenLightColumns || 7);
        setLightMode(deviceFuncInfo.matrixScreenLightMode);

        const maxBrightness = Math.max(deviceBaseInfo.matrixScreenLightMaxBrightness || 1, 1);
        setBrightnessValue(Math.max(5, Math.round((deviceFuncInfo.matrixScreenLightBrightness / maxBrightness) * 100)));
        // 固件速度值越大越慢；UI 侧约定“越往右越快”，因此做反向映射。
        setSpeedValue(Math.max(0, Math.min(matrixSpeedMax, matrixSpeedMax - (deviceFuncInfo.matrixScreenLightSpeed || 0))));
        setSelectedColor(
            rgbToHex(
                deviceFuncInfo.matrixScreenLightRValue,
                deviceFuncInfo.matrixScreenLightGValue,
                deviceFuncInfo.matrixScreenLightBValue
            )
        );
    }, [deviceBaseInfo, deviceFuncInfo, matrixSpeedMax]);

    useEffect(() => {
        setBrightnessInput(String(brightnessValue || 0));
    }, [brightnessValue]);

    const handleColorChange = async (color: string) => {
        if (!connectedKeyboard || !deviceBaseInfo || !deviceFuncInfo || !color?.startsWith("#")) return;

        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        if ([r, g, b].some(Number.isNaN)) return;

        setSelectedColor(color);

        const lightInfo = {
            ...deviceFuncInfo,
            matrixScreenLightRValue: r,
            matrixScreenLightGValue: g,
            matrixScreenLightBValue: b,
        };

        keyboard?.setDeviceFuncInfo(lightInfo);
        await connectedKeyboard.setFuncInfo(lightInfo, deviceBaseInfo.protocolVer);
    };

    const handleLightModeToggle = async (value: number) => {
        if (!deviceBaseInfo || !deviceFuncInfo || !connectedKeyboard) return;

        const lightInfo = {
            ...deviceFuncInfo,
            matrixScreenLightMode: value,
        };

        if (value !== deviceBaseInfo.matrixScreenLightSize) {
            setLightMode(value);
        }

        keyboard?.setDeviceFuncInfo(lightInfo);
        await connectedKeyboard.setFuncInfo(lightInfo, deviceBaseInfo.protocolVer);
    };

    const debouncedUpdateLightSpeed = useRef(
        debounce(async (uiSpeed: number, info: FunInfo) => {
            if (!connectedKeyboard || !deviceBaseInfo) return;
            const speedMax = Math.max(deviceBaseInfo.matrixScreenLightMaxSpeed || 4, 1);
            const firmwareSpeed = Math.max(0, Math.min(speedMax, speedMax - uiSpeed));
            const lightInfo = { ...info, matrixScreenLightSpeed: firmwareSpeed };
            connectedKeyboard.setFuncInfo(lightInfo, deviceBaseInfo.protocolVer);
            keyboard?.setDeviceFuncInfo(lightInfo);
        }, 200)
    ).current;

    const debouncedUpdateLightBrightness = useRef(
        debounce(async (brightness: number, info: FunInfo) => {
            if (!connectedKeyboard || !deviceBaseInfo) return;
            const normalizedBrightness = Math.max(5, Math.min(100, brightness));
            const lightInfo = {
                ...info,
                matrixScreenLightBrightness: Math.round(
                    (deviceBaseInfo.matrixScreenLightMaxBrightness || 100) * (normalizedBrightness / 100)
                ),
            };
            connectedKeyboard.setFuncInfo(lightInfo, deviceBaseInfo.protocolVer);
            keyboard?.setDeviceFuncInfo(lightInfo);
        }, 200)
    ).current;

    const handleSpeedChange = (newValue: number) => {
        if (!deviceFuncInfo) return;
        const normalized = Math.max(0, Math.min(matrixSpeedMax, newValue));
        setSpeedValue(normalized);
        debouncedUpdateLightSpeed(normalized, { ...deviceFuncInfo });
    };

    const handleBrightnessChange = (newValue: number) => {
        if (!deviceFuncInfo) return;
        const normalized = Math.max(5, Math.min(100, newValue));
        setBrightnessValue(normalized);
        debouncedUpdateLightBrightness(normalized, { ...deviceFuncInfo });
    };

    const commitBrightnessInput = () => {
        const parsed = Number.parseInt(brightnessInput || '0', 10);
        if (Number.isNaN(parsed)) {
            setBrightnessInput(String(brightnessValue || 0));
            return;
        }
        const normalized = Math.max(5, Math.min(100, parsed));
        setBrightnessInput(String(normalized));
        handleBrightnessChange(normalized);
    };

    return (
        <>
            <Box
                sx={{
                    height: '50%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    minHeight: 0,
                    margin: '0 auto',
                    width: "100%",
                    justifyContent: "center"
                }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', width: '100%' }}>
                    <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column' }}>
                        <TravelVirtualKeyboard
                            layoutKeys={displayLayoutKeys}
                            travelKeys={travelKeys}
                            patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
                            selectedKeys={[]}
                            travelValue={1.5}
                            onToggleKey={() => { }}
                            colorMode={false}
                            keyColors={[]}
                        />
                    </Box>
                </Box>
            </Box>
            <Box sx={{ flex: 1, minHeight: '20rem', display: 'grid', mx: 167, gridTemplateColumns: '1.6fr 1fr 0.95fr', gap: '1rem' }}>
                <Box sx={{ borderRadius: '0.875rem', border: '0.0625rem solid rgba(153,169,191,0.22)', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(0.375rem)', p: 20 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, mb: 2 }}>
                        <Typography sx={{ fontSize: '1.125rem', fontWeight: "400", color: "rgba(100, 116, 139, 1)", mb: 11 }}>{t("1001")}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.625rem", overflowY: "auto" }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "32%", flexBasis: "32%", flexGrow: 0, pt: "0.325rem" }}>
                            <ButtonRem
                                onClick={() => handleLightModeToggle(deviceBaseInfo?.matrixScreenLightSize || 0)}
                                fullWidth
                                variant="text"
                                sx={{
                                    height: '2.125rem',
                                    borderRadius: '0.5rem',
                                    fontSize: '0.875rem',
                                    textTransform: 'none',
                                    color: (deviceBaseInfo?.matrixScreenLightSize || 0) === LightMode ? '#fff' : '#5f7089',
                                    backgroundColor: (deviceBaseInfo?.matrixScreenLightSize || 0) === LightMode ? '#3B82F6' : '',
                                    '&:hover': {
                                        border: '0.0625rem solid #3B82F6',
                                        boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                                    },
                                }}
                            >
                                {t("1675")}
                            </ButtonRem>
                        </Box>
                        {matrixLightList.map((item: any, index: number) =>
                            item.brightness ? (
                                <Box key={index} sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: "32%", flexBasis: "32%", flexGrow: 0, pt: "0.325rem" }}>
                                    <ButtonRem
                                        onClick={() => handleLightModeToggle(item.value)}
                                        fullWidth
                                        variant="text"
                                        sx={{
                                            height: '2.125rem',
                                            borderRadius: '0.5rem',
                                            fontSize: '0.875rem',
                                            textTransform: 'none',
                                            color: LightMode === item.value ? '#fff' : '#5f7089',
                                            backgroundColor: LightMode === item.value ? '#3B82F6' : '',
                                            '&:hover': {
                                                border: '0.0625rem solid #3B82F6',
                                                boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                                            },
                                        }}
                                    >
                                        {t(item.lang)}
                                    </ButtonRem>
                                </Box>
                            ) : null
                        )}
                    </Box>
                </Box>

                <Box sx={{ borderRadius: '0.875rem', border: '0.0625rem solid rgba(153,169,191,0.22)', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(0.375rem)', p: 20 }}>
                    <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t("1676")}</Typography>
                    <Box sx={{ mb: 3 }}>
                        <SliderBlock>
                            <SliderRem
                                value={brightnessValue}
                                min={5}
                                max={100}
                                step={1}
                                onChange={(_, newValue) => handleBrightnessChange(newValue as number)}
                                sx={{
                                    color: '#3B82F6',
                                    '& .MuiSlider-rail': { backgroundColor: '#ECEFF4', opacity: 1, height: '0.75rem', borderRadius: '999px' },
                                    '& .MuiSlider-track': { height: '0.75rem', borderRadius: '999px', border: 'none' },
                                    '& .MuiSlider-thumb': {
                                        width: '2rem',
                                        height: '2rem',
                                        border: '0.25rem solid #fff',
                                        boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                                    },
                                }}
                            />
                            <Box
                                component="input"
                                value={brightnessInput}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                    const onlyDigits = e.target.value.replace(/[^\d]/g, '').slice(0, 3);
                                    setBrightnessInput(onlyDigits);
                                }}
                                onBlur={commitBrightnessInput}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                    if (e.key === 'Enter') {
                                        e.currentTarget.blur();
                                    }
                                }}
                                sx={valueInputSx}
                            />
                            <Typography sx={{ color: '#94A3B8', fontSize: '1.25rem', fontWeight: 600 }}>%</Typography>
                        </SliderBlock>
                    </Box>
                    <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 8 }}>{t("1677")}</Typography>
                    <SliderBlock>
                        <SliderRem
                            value={speedValue}
                            min={0}
                            max={matrixSpeedMax}
                            step={1}
                            onChange={(_, newValue) => handleSpeedChange(newValue as number)}
                            sx={{
                                color: '#3B82F6',

                                '& .MuiSlider-rail': { backgroundColor: '#ECEFF4', opacity: 1, height: '0.75rem', borderRadius: '999px' },
                                '& .MuiSlider-track': { height: '0.75rem', borderRadius: '999px', border: 'none' },
                                '& .MuiSlider-thumb': {
                                    width: '1.9rem',
                                    height: '2rem',
                                    border: '0.25rem solid #fff',
                                    boxShadow: '0 0.125rem 0.5rem rgba(59,130,246,0.35)',
                                },
                            }}
                        />
                        <Box sx={{ width: '3.125rem', height: '2rem' }} />
                        <Typography sx={{ color: 'transparent', fontSize: '1.25rem', fontWeight: 600, userSelect: 'none' }}>%</Typography>
                    </SliderBlock>
                </Box>

                <Box sx={{ borderRadius: '0.875rem', border: '0.0625rem solid rgba(153,169,191,0.22)', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(0.375rem)', p: 20 }}>
                    <Typography sx={{ fontSize: '1rem', color: '#5f7089', fontWeight: 700, mb: 2, borderBottom: '1px solid rgba(226,232,240,1)', pb: 1 }}>{t("1003")}</Typography>
                    <ColorPicker
                        selectColor={selectedColor}
                        setSelectColor={handleColorChange}
                    />
                </Box>
            </Box>
        </>

    );
};

export default Matrix;

function SliderBlock({ children }: { children: React.ReactNode }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 9, mb: 3.5 }}>
            {children}
        </Box>
    );
}

const valueInputSx = {
    width: '3.125rem',
    height: '2rem',
    borderRadius: '0.5rem',
    border: '0.0625rem solid #E2E8F0',
    textAlign: 'center',
    color: '#64748b',
    fontSize: '.95rem',
    fontWeight: 600,
    backgroundColor: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    outline: 'none',
    marginLeft: '10px',
} as const;

export { Matrix };
