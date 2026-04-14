import { useState, useCallback, useContext, useEffect } from "react";
import { KeyboardDevice } from "../devices/KeyboardDevice";
import { FilterDevice } from "@/types/types";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";

const useMatrix = () => {
    // 从设备信息获取矩阵尺寸，默认为7x7
    const [rows, setRows] = useState<number>(7);
    const [cols, setCols] = useState<number>(7);

    const [matrix, setMatrix] = useState<Array<Array<string>>>(Array(rows).fill(null).map(() => Array(cols).fill("")));
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [selectedColor, setSelectedColor] = useState<string>("#ff0000");
    const [device, setDevice] = useState<FilterDevice | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [LightMode, setLightMode] = useState<number>(1);
    const [brightnessValue, setBrightnessValue] = useState<number>(0);
    const [speedValue, setSpeedValue] = useState<number>(0);
    const [switchValue, setSwitchValue] = useState<boolean>(false);
    const [maxLightSpeed, setMaxLightSpeed] = useState<number>(0);
    const [rainDropActive, setRainDropActive] = useState<boolean>(false);

    // hexToRgb 函数
    const hexToRgb = (color: string): [number, number, number] => {
        if (color.startsWith("rgb")) {
            const result = color.match(/\d+/g);
            if (result && result.length >= 3) {
                return [
                    parseInt(result[0]),
                    parseInt(result[1]),
                    parseInt(result[2]),
                ];
            }
            return [0, 0, 0];
        }
        color = color.replace(/^#/, "");
        if (color.length === 3) {
            color = color.split("").map((c) => c + c).join("");
        }
        if (color.length !== 6) return [0, 0, 0];

        const r = parseInt(color.slice(0, 2), 16);
        const g = parseInt(color.slice(2, 4), 16);
        const b = parseInt(color.slice(4, 6), 16);

        return [r, g, b];
    };

    // toggleCell 函数
    const toggleCell = useCallback(async (index: number) => {
        // const row = index % cols;
        // const col = Math.floor(index / cols);
        // if (row >= rows || col >= cols) return;
        // // 拷贝 selectedCells，保持不可变性
        // const updatedCells = new Set(selectedCells);

        // // 更新矩阵
        // const newMatrix = matrix.map((r, ri) =>
        //     r.map((c, ci) => {
        //         if (ri === row && ci === col) {
        //             const key = `${row},${col}`;
        //             const currentColor = c;
        //             const newColor = selectedColor;

        //             if (!currentColor) {
        //                 updatedCells.add(key);
        //                 return newColor;
        //             } else if (currentColor === newColor) {
        //                 updatedCells.delete(key);
        //                 return "";
        //             } else {
        //                 updatedCells.add(key);
        //                 return newColor;
        //             }
        //         }
        //         return c;
        //     })
        // );

        // // 更新状态
        // setMatrix(newMatrix);
        // setSelectedIndex(row * cols + col);
        const flatRGB  = null
        // // ✅ 生成扁平 RGB 数组
        // const flatRGB = newMatrix
        //     .flat()
        //     .map(color => {
        //         if (!color) return [0, 0, 0];
        //         const hex = color.replace("#", "");
        //         const bigint = parseInt(hex, 16);
        //         return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
        //     })
        //     .flat();

        // console.log(flatRGB);

        return flatRGB;
    }, [matrix, selectedColor, selectedIndex, device, cols, rows, selectedCells]);

    // fillFrame 函数
    const fillFrame = useCallback(async () => {
        setMatrix(Array(rows).fill(null).map(() => Array(cols).fill(selectedColor)));
        setSelectedCells(new Set(
            Array.from({ length: rows * cols }).map((_, idx) => `${Math.floor(idx / cols)},${idx % cols}`)
        ));
        const [r, g, b] = hexToRgb(selectedColor);
        if (device && typeof device.setLighttMatrixCustomData === 'function') {
            await device.setLighttMatrixCustomData(r, g, b, rows, cols);
        }
    }, [rows, cols, selectedColor, device]);

    // resetMatrix 函数
    const resetMatrix = useCallback(async () => {
        setMatrix(Array(rows).fill(null).map(() => Array(cols).fill("")));
        setSelectedCells(new Set());
        if (device && typeof device.resetDevice === 'function') {
            await device.resetDevice();
        }
        setSwitchValue(true);
        setLightMode(0);
    }, [rows, cols, device]);
    useEffect(() => {
        if(selectedIndex !== 5) return
        if (device && typeof device.setLighttMatrixCustomData === 'function') {
            device.setLighttMatrixCustomData(0, 0, 0, rows, cols);
        }
    },[selectedIndex])
    return {
        matrix,
        selectedCells,
        selectedColor,
        selectedIndex,
        LightMode,
        brightnessValue,
        speedValue,
        switchValue,
        maxLightSpeed,
        rainDropActive,
        toggleCell,
        fillFrame,
        resetMatrix,
        setMatrix,
        hexToRgb,
        setRows,
        setCols,
        setSelectedColor,
        setLightMode,
        setSwitchValue,
        setBrightnessValue,
        setSpeedValue,
        setMaxLightSpeed,
        setRainDropActive,
        setSelectedIndex,
        setDevice,
        setSelectedCells,
    };
};

export default useMatrix;
