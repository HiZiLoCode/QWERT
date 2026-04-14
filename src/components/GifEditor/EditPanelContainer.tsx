"use client";

import { Box, Text, VStack, Icon } from "@chakra-ui/react";
import { MdEdit } from "react-icons/md";
import { EditMode, GifEditState, DrawingTool } from "./types";
import ColorAdjustPanel from "./ColorAdjustPanel";
import TextEditPanel from "./TextEditPanel";
import DrawingPanel from "./DrawingPanel";
import { useCallback, useEffect } from "react";

interface EditPanelContainerProps {
  selectedScreen: number | null;
  editMode: EditMode;
  editStates: GifEditState[];
  drawingTool: DrawingTool;
  brushColor: string;
  brushSize: number;
  newText: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textDirection: 'horizontal' | 'vertical';
  onUpdateEditState: (screenIdx: number, updates: Partial<GifEditState>) => void;
  onDrawingToolChange: (tool: DrawingTool) => void;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onNewTextChange: (text: string) => void;
  onTextColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onTextDirectionChange: (direction: 'horizontal' | 'vertical') => void;
  onAddText: () => void;
  onDeleteText: (textId: string) => void;
  onClearDrawings: () => void;
  t: (key: string) => string;
}

export default function EditPanelContainer({
  selectedScreen,
  editMode,
  editStates,
  drawingTool,
  brushColor,
  brushSize,
  newText,
  textColor,
  fontSize,
  fontFamily,
  textDirection,
  onUpdateEditState,
  onDrawingToolChange,
  onBrushColorChange,
  onBrushSizeChange,
  onNewTextChange,
  onTextColorChange,
  onFontSizeChange,
  onFontFamilyChange,
  onTextDirectionChange,
  onAddText,
  onDeleteText,
  onClearDrawings,
  t
}: EditPanelContainerProps) {
  let currentEditState = selectedScreen !== null ? editStates[selectedScreen] : null;
  return (
    <Box
      p={4}
      borderRadius="12px"
      border="1px solid rgba(100, 150, 255, 0.1)"
      h="calc(100% - 60px)"
      
      overflowY="auto"
      css={{
        '&::-webkit-scrollbar': {
          width: '4px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'rgba(0, 0, 0, 0.1)',
          borderRadius: '2px',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'rgba(100, 150, 255, 0.3)',
          borderRadius: '2px',
        },
      }}
    >
      {selectedScreen === null ? (
        <VStack spacing={3} justify="center" h="100%">
          <Icon as={MdEdit} boxSize={24} />
          <Text fontSize="sm" textAlign="center">
            {t('290')}
          </Text>
        </VStack>
      ) : (
        <>
          {/* 调色调整模式 */}
          {editMode === 'resize' && currentEditState && (
            <ColorAdjustPanel
              selectedScreen={selectedScreen}
              editState={currentEditState}
              onUpdateEditState={(updates) => onUpdateEditState(selectedScreen, updates)}
              t={t}
            />
          )}

          {/* 文字模式 */}
          {editMode === 'text' && currentEditState && (
            <TextEditPanel
              selectedScreen={selectedScreen}
              texts={currentEditState.texts}
              newText={newText}
              textColor={textColor}
              fontSize={fontSize}
              fontFamily={fontFamily}
              textDirection={textDirection}
              onNewTextChange={onNewTextChange}
              onTextColorChange={onTextColorChange}
              onFontSizeChange={onFontSizeChange}
              onFontFamilyChange={onFontFamilyChange}
              onTextDirectionChange={onTextDirectionChange}
              onAddText={onAddText}
              onDeleteText={onDeleteText}
              t={t}
            />
          )}

          {/* 绘画模式 */}
          {editMode === 'draw' && (
            <DrawingPanel
              drawingTool={drawingTool}
              brushColor={brushColor}
              brushSize={brushSize}
              onDrawingToolChange={onDrawingToolChange}
              onBrushColorChange={onBrushColorChange}
              onBrushSizeChange={onBrushSizeChange}
              onClearDrawings={onClearDrawings}
              t={t}
            />
          )}
        </>
      )}
    </Box>
  );
} 