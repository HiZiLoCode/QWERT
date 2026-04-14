import React, { useCallback, useContext } from "react";
import { bgcolor, styled } from "@mui/system";
import { useTranslation } from "@/app/i18n";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import { Button, ButtonProps } from "@mui/material";
import { purple } from '@mui/material/colors';
import { color } from "framer-motion";
import { hexToRgba } from "@uiw/color-convert";
import { ButtonRem } from "@/styled/ReconstructionRem";
// MUI System Styled
const Flex = styled("div")({
  display: "flex",
  alignItems: "center",
  height: "28.125rem",
});

const Container = styled("div")({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
  gap: "5.3125rem",
});

const Matrix = styled("div")({
  display: "grid",
  gridTemplateRows: "repeat(7, 2.75rem)", // 44px → 2.75rem
  gridAutoRows: "3rem", // 48px → 3rem
  gap: "0.25rem", // 4px → 0.25rem
});

const Row = styled("div")({
  display: "flex",
});

const Cell = styled("div")(({ color }) => ({
  width: "3rem", // 48px → 3rem
  height: "3rem", // 48px → 3rem
  borderRadius: "0.25rem", // 4px → 0.25rem
  transition: "background-color 0.2s",
  backgroundColor: color || "#000000",
  cursor: "pointer",
  border: "0.0625rem solid #fff", // 1px → 0.0625rem
}));

const ControlPanel = styled("div")({
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
});

const DirectionControls = styled("div")({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.5rem",
});

const HorizontalControls = styled("div")({
  display: "flex",
  gap: "1rem",
});

const ActionControls = styled("div")({
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
});
const ColorButton = styled(Button)<ButtonProps>(({ theme }) => ({
  color: theme.palette.getContrastText(purple[500]),
  backgroundColor: purple[500],
  '&:hover': {
    backgroundColor: purple[700],
  },
}));


const DotMatrix = () => {
  const { t } = useTranslation();
  const { matrixData } = useContext(ConnectKbContext);
  // 状态分解成多个 useState
  const { keyboard, connectedKeyboard } = useContext(ConnectKbContext)
  const { deviceBaseInfo } = keyboard
  const { matrixScreenLightRows, matrixScreenLightColumns } = deviceBaseInfo
  const { toggleCell, setSelectedCells, LightMode, resetMatrix, selectedColor, matrix, selectedIndex, setSelectedIndex, setMatrix, selectedCells } = matrixData;
  const isEditable = LightMode === 5;
  console.log(isEditable);

  const handleCellClick = async (row, col) => {
    if (!isEditable) return;
    const index = col * 7 + row;
    const data = await toggleCell(index);
    connectedKeyboard.setLighttMatrixCustomData(data)
  };
  const fillFrame = useCallback(async () => {
    const rows = deviceBaseInfo.matrixScreenLightRows;
    const cols = deviceBaseInfo.matrixScreenLightColumns;

    // ✅ 生成全填充矩阵
    const newMatrix = Array(rows)
      .fill(null)
      .map(() => Array(cols).fill(selectedColor));

    // ✅ 设置矩阵状态
    setMatrix(newMatrix);

    // ✅ 更新所有选中单元格
    setSelectedCells(
      new Set(
        Array.from({ length: rows * cols }).map((_, idx) => {
          const r = Math.floor(idx / cols);
          const c = idx % cols;
          return `${r},${c}`;
        })
      )
    ); 
    console.log(newMatrix);

    // ✅ 生成扁平 RGB 数组（保持与其他函数一致）
    const flatRGB = newMatrix
      .flat()
      .map(color => {
        if (!color) return [0, 0, 0];
        const hex = color.replace("#", "");
        const bigint = parseInt(hex, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
      })
      .flat();

    console.log(flatRGB);

    // ✅ 同步到设备
    if (
      connectedKeyboard &&
      typeof connectedKeyboard.setLighttMatrixCustomData === "function"
    ) {
      try {
        await connectedKeyboard.setLighttMatrixCustomData(flatRGB);
        console.log("✅ 已全填充灯光矩阵并同步设备");
      } catch (err) {
        console.error("❌ 填充矩阵发送失败:", err);
      }
    }
  }, [
    deviceBaseInfo.matrixScreenLightRows,
    deviceBaseInfo.matrixScreenLightColumns,
    selectedColor,
    connectedKeyboard,
  ]);
  const moveMatrix = useCallback(async (direction: "up" | "down" | "left" | "right") => {
    if (!connectedKeyboard || selectedIndex === null) return;

    const row = Math.floor(selectedIndex / matrixScreenLightColumns);
    const col = selectedIndex % matrixScreenLightColumns;

    let newRow = row;
    let newCol = col;

    switch (direction) {
      case "up": newRow--; break;
      case "down": newRow++; break;
      case "left": newCol--; break;
      case "right": newCol++; break;
    }

    if (
      newRow < 0 ||
      newRow >= matrixScreenLightRows ||
      newCol < 0 ||
      newCol >= matrixScreenLightColumns
    ) return;

    const newIndex = newRow * matrixScreenLightColumns + newCol;
    const newKey = `${newCol},${newRow}`;
    const oldKey = `${col},${row}`;
    const color = matrix[row][col];

    if (!color) return;

    // 更新矩阵
    const newMatrix = matrix.map((r, ri) =>
      r.map((c, ci) => {
        if (ri === row && ci === col) return "";
        if (ri === newRow && ci === newCol) return color;
        return c;
      })
    );

    // 更新状态
    setMatrix(newMatrix);
    setSelectedIndex(newIndex);

    // ✅ 生成扁平 RGB 数组（与 toggleCell 一样）
    const flatRGB = newMatrix
      .flat()
      .map(color => {
        if (!color) return [0, 0, 0];
        const hex = color.replace("#", "");
        const bigint = parseInt(hex, 16);
        return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
      })
      .flat();

    console.log(flatRGB);

    // ✅ 同步到设备
    if (connectedKeyboard && typeof connectedKeyboard.setLighttMatrixCustomData === "function") {
      try {
        await connectedKeyboard.setLighttMatrixCustomData(flatRGB);
        console.log("✅ 灯光矩阵已发送到设备");
      } catch (err) {
        console.error("❌ 发送矩阵数据失败:", err);
      }
    }

    return flatRGB;
  }, [
    matrix,
    selectedIndex,
    connectedKeyboard,
    matrixScreenLightColumns,
    matrixScreenLightRows,
  ]);
  const clearFrame = useCallback(async () => {
    // 生成空矩阵
    const newMatrix = Array(matrixScreenLightRows)
      .fill(null)
      .map(() => Array(matrixScreenLightColumns).fill(""));
    console.log(newMatrix);

    // 清空状态
    setMatrix(newMatrix);
    setSelectedCells(new Set());

    // ✅ 生成扁平 RGB 数组（全黑）
    const flatRGB = newMatrix
      .flat()
      .map(() => [0, 0, 0]) // 清空时全部为黑色
      .flat();

    console.log(flatRGB);

    // ✅ 同步到设备
    if (
      connectedKeyboard &&
      typeof connectedKeyboard.setLighttMatrixCustomData === "function"
    ) {
      try {

        await connectedKeyboard.setLighttMatrixCustomData(flatRGB);
        console.log("✅ 已清空灯光矩阵并同步设备");
      } catch (err) {
        console.error("❌ 清空矩阵发送失败:", err);
      }
    }
  }, [matrixScreenLightRows, matrixScreenLightColumns, connectedKeyboard]);
  return (
    <Flex>
      <Container>
        <Matrix>
          {Array.from({ length: deviceBaseInfo.matrixScreenLightRows || 7 }).map((_, rowIndex) => (
            <Row key={rowIndex}>
              {Array.from({ length: deviceBaseInfo.matrixScreenLightColumns || 7 }).map((_, colIndex) => (
                <Cell
                  key={colIndex}
                  color={matrix[rowIndex][colIndex]}
                  data-row={rowIndex}
                  data-col={colIndex}
                  onClick={() => handleCellClick(rowIndex, colIndex)}
                  style={{ cursor: isEditable ? "pointer" : "not-allowed", opacity: isEditable ? 1 : 0.6 }}
                />
              ))}
            </Row>
          ))}
        </Matrix>
        <ControlPanel>
          <DirectionControls>
            <ColorButton disabled={LightMode !== 5} variant="contained" onClick={() => moveMatrix("up")}>↑ {t("900")}</ColorButton>
            <HorizontalControls>
              <ColorButton disabled={LightMode !== 5} variant="contained" onClick={() => moveMatrix("left")}>← {t("901")}</ColorButton>
              <ColorButton disabled={LightMode !== 5} variant="contained" onClick={() => moveMatrix("right")}>→ {t("902")}</ColorButton>
            </HorizontalControls>
            <ColorButton disabled={LightMode !== 5} variant="contained" onClick={() => moveMatrix("down")}>↓ {t("903")}</ColorButton>
          </DirectionControls>
          <ActionControls>
            {/* 填满 */}
            <ButtonRem
              onClick={() => fillFrame()}
              disabled={LightMode !== 5}
              sx={
                {
                  bgcolor: selectedColor,
                  color: "white"
                }
              }
            >
              {t("904")}
              {/* 清空 */}
            </ButtonRem>
            <ButtonRem disabled={LightMode !== 5} onClick={() => clearFrame()} color="info">
              {t("905")}
            </ButtonRem>
            {/* 复位 */}
            <ButtonRem disabled={LightMode !== 5} onClick={() => resetMatrix()} variant="contained">
              {t("906")}
            </ButtonRem>
          </ActionControls>
        </ControlPanel>
      </Container>
    </Flex>
  );
};

export default DotMatrix;
