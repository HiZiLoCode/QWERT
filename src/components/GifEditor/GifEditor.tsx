"use client";

import { Box, Text, useToast } from "@chakra-ui/react";
import React, { useState, useCallback, useRef, useContext, useEffect } from "react";
import { GifEditState, EditMode, DrawingTool, DrawingElement, TextElement } from "./types";
import { TransferProgress } from "@/components/GifConverter";
import GifUploadPanel from "./GifUploadPanel";
import EditCanvas from "./EditCanvas";
import EditToolbar from "./EditToolbar";
import EditPanelContainer from "./EditPanelContainer";
import TimeSync from "./TimeSync";
import ActionButtons from "./ActionButtons";
import { MainContext } from "@/providers/MainProvider";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";

interface GifEditorProps {
  gifFiles: (File | null)[];
  gifPreviews: (string | null)[];
  appliedEditStates: GifEditState[];
  onGifUpload: (screenIdx: number, file: File) => void;
  onAppliedEditStatesChange: (states: GifEditState[]) => void;
  onGifFilesChange: (files: (File | null)[]) => void;
  onGifPreviewsChange: (previews: (string | null)[]) => void;
  onSyncTime: () => void;
  onClearData: () => void;
  onDownloadToDevice: () => void;
  isDownloading?: boolean;
  downloadProgress?: TransferProgress | null;
  screenWidth: number;
  screenHeight: number;
  t: (key: string) => string;
}

const GifEditor = ({
  gifFiles,
  gifPreviews,
  appliedEditStates,
  onGifUpload,
  onAppliedEditStatesChange,
  onGifFilesChange,
  onGifPreviewsChange,
  onSyncTime,
  onClearData,
  onDownloadToDevice,
  isDownloading,
  downloadProgress,
  screenWidth,
  screenHeight,
  t
}: GifEditorProps) => {
  const toast = useToast();
  const { showMessage,showDialog } = useSnackbarDialog()
  const { selectedScreen, setSelectedScreen } = useContext(MainContext)

  const [editStates, setEditStates] = useState<GifEditState[]>([
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
    { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] }
  ]);
  const [editMode, setEditMode] = useState<EditMode>('resize');

  // 绘画工具状态
  const [drawingTool, setDrawingTool] = useState<DrawingTool>('brush');
  const [brushColor, setBrushColor] = useState('linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)');
  const [brushSize, setBrushSize] = useState(3);

  // 文字编辑状态
  const [textColor, setTextColor] = useState('linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%), rgba(255, 255, 255, 0.3)');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [textDirection, setTextDirection] = useState<'horizontal' | 'vertical'>('horizontal');
  const [newText, setNewText] = useState('');

  // 文字拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (appliedEditStates) {
      setEditStates(appliedEditStates);
    }
  }, [appliedEditStates, selectedScreen])
  // 更新编辑状态
  const handleUpdateEditState = useCallback((screenIdx: number, updates: Partial<GifEditState>) => {
    console.log('=== handleUpdateEditState ===');
    console.log('screenIdx:', screenIdx);
    console.log('updates:', updates);

    setEditStates(prev => {
      const newStates = [...prev];
      const oldState = newStates[screenIdx];
      newStates[screenIdx] = { ...newStates[screenIdx], ...updates };

      console.log('旧editState绘画数组长度:', oldState.drawings.length);
      console.log('新editState绘画数组长度:', newStates[screenIdx].drawings.length);

      if (updates.drawings) {
        console.log('绘画更新详情:', updates.drawings);
      }

      return newStates;
    });
  }, []);

  // 重置编辑状态
  const handleResetEditState = useCallback((screenIdx: number) => {
    setEditStates(prev => {
      const newStates = [...prev];
      newStates[screenIdx] = {
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hue: 0,
        scale: 100,
        rotation: 0,
        flipX: false,
        flipY: false,
        texts: [],
        drawings: [],
        isHue: 0
      };
      return newStates;
    });
    console.log(editStates, screenIdx);

  }, [editStates]);

  // 重置已应用的编辑状态
  const handleResetAppliedEditState = useCallback((screenIdx: number, toastState: boolean = true) => {

    const newStates = [...appliedEditStates];
    newStates[screenIdx] = {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      hue: 0,
      scale: 100,
      rotation: 0,
      flipX: false,
      flipY: false,
      texts: [],
      drawings: [],
      isHue: 0,
    };
    onAppliedEditStatesChange(newStates);
    if (toastState) {
      showMessage({
        title: t('400'),
        message: `${t('401')} ${screenIdx + 1} ${t('402')}`,
        type: 'success'
      });
    }

  }, [appliedEditStates, onAppliedEditStatesChange, toast]);

  // 删除GIF
  const handleDeleteGif = useCallback((screenIdx: number) => {
    // 清理localStorage中的GIF文件数据
    try {
      const savedFiles = JSON.parse(localStorage.getItem('gifFilesData') || '[]');
      savedFiles[screenIdx] = null;
      localStorage.setItem('gifFilesData', JSON.stringify(savedFiles));
    } catch (error) {
      console.error('清理本地GIF文件数据失败:', error);
    }

    const newFiles = [...gifFiles];
    newFiles[screenIdx] = null;
    onGifFilesChange(newFiles);

    const newPreviews = [...gifPreviews];
    if (newPreviews[screenIdx]) {
      URL.revokeObjectURL(newPreviews[screenIdx]!);
      newPreviews[screenIdx] = null;
    }
    onGifPreviewsChange(newPreviews);

    // 重置编辑状态
    handleResetEditState(screenIdx);
    handleResetAppliedEditState(screenIdx);
    if (selectedScreen === screenIdx) {
      setSelectedScreen(null);
    }
  }, [gifFiles, gifPreviews, selectedScreen, onGifFilesChange, onGifPreviewsChange, handleResetEditState, handleResetAppliedEditState]);

  // 应用编辑
  const handleApplyEdit = useCallback(() => {
    if (selectedScreen === null || !gifFiles[selectedScreen] || !gifPreviews[selectedScreen]) {
      showMessage({
        title: t('403'),
        message: t('404'),
        type: 'warning'
      });
      return;
    }

    // const editState = editStates[selectedScreen];
    // const appliedEditState= appliedEditStates[selectedScreen];
    // const hasEdits =
    //   editState.brightness !== 100 ||
    //   editState.contrast !== 100 ||
    //   editState.saturation !== 100 ||
    //   editState.hue !== 0 ||
    //   editState.scale !== 100 ||
    //   editState.rotation !== 0 ||
    //   editState.flipX ||
    //   editState.flipY ||
    //   editState.texts.length > 0 ||
    //   editState.drawings.length > 0;
    const editState = editStates[selectedScreen];
    const appliedEditState = appliedEditStates[selectedScreen];
    console.log(editState, 'editState');

    const hasEdits = JSON.stringify(editState) !== JSON.stringify(appliedEditState);
    if (!hasEdits) {
      showMessage({
        title: t('405'),
        message: t('406'),
        type: 'info'
      });
      return;
    }

    try {
      // 将当前编辑状态保存到appliedEditStates
      const newAppliedStates = [...appliedEditStates];
      newAppliedStates[selectedScreen] = { ...editState };
      console.log(newAppliedStates);

      onAppliedEditStatesChange(newAppliedStates);

      // 重置编辑状态
      // handleResetEditState(selectedScreen);
    } catch (error) {
      console.error('应用编辑失败:', error);
    }
  }, [selectedScreen, gifFiles, gifPreviews, editStates, appliedEditStates, onAppliedEditStatesChange, handleResetEditState, toast]);

  // 添加文字
  const handleAddText = useCallback(() => {
    if (selectedScreen === null || !newText.trim()) return;

    const textObject: TextElement = {
      id: Date.now().toString(),
      text: newText.trim(), 
      x: 120, // 默认居中位置
      y: 68,  // 默认居中位置
      color: textColor,
      fontSize: fontSize,
      fontFamily: fontFamily,
      fontWeight: 'normal',
      direction: textDirection
    };

    handleUpdateEditState(selectedScreen, {
      texts: [...editStates[selectedScreen].texts, textObject]
    });

    setNewText('');
  }, [selectedScreen, newText, textColor, fontSize, fontFamily, textDirection, editStates, handleUpdateEditState]);

  // 删除文字
  const handleDeleteText = useCallback((textId: string) => {
    if (selectedScreen === null) return;

    const newTexts = editStates[selectedScreen].texts.filter(text => text.id !== textId);
    handleUpdateEditState(selectedScreen, { texts: newTexts });
  }, [selectedScreen, editStates, handleUpdateEditState]);

  // 清空绘画
  const handleClearDrawings = useCallback(() => {
    if (selectedScreen !== null) {
      handleUpdateEditState(selectedScreen, { drawings: [] });
    }
  }, [selectedScreen, handleUpdateEditState]);

  // Canvas事件处理 - 简化版本，实际处理在EditCanvas中
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // 实际处理在EditCanvas中
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('=== GifEditor handleCanvasMouseDown ===');
    console.log('editMode:', editMode);
    console.log('selectedScreen:', selectedScreen);
    // 实际处理在EditCanvas中
  }, [editMode, selectedScreen]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // 实际处理在EditCanvas中
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    // 实际处理在EditCanvas中
  }, []);


  const hasValidGifs = gifFiles.some(file => file !== null);
  const handleGifUpload = useCallback(async (screenIdx: number, file: File) => {

    // 上传GIF文件
    onGifUpload(screenIdx, file);

    // 上传后重置 editStates
    handleResetEditState(screenIdx);

    // 也可以重置 appliedEditStates，防止残留
    handleResetAppliedEditState(screenIdx, false);
    
  }, [onGifUpload, handleResetEditState, handleResetAppliedEditState]);
  return (
    <>
      <Box
        w="100%"
        h="100%"
        position="relative"
        overflow="hidden"
        role="main"
        aria-label={t('410')}
      >
        {/* GIF上传面板 */}
        <GifUploadPanel
          gifFiles={gifFiles}
          gifPreviews={gifPreviews}
          appliedEditStates={appliedEditStates}
          selectedScreen={selectedScreen}
          onGifUpload={handleGifUpload}
          onScreenSelect={setSelectedScreen}
          onResetAppliedEdit={handleResetAppliedEditState}
          onDeleteGif={handleDeleteGif}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          t={t}
        />

        {/* 中央编辑区域 */}
        <Box
          position="absolute"
          left="360px"
          w="calc(100% - 720px)"
          h="calc(100% - 30px)"
          backdropFilter="blur(12px)"
          borderRight="1px dashed rgba(100, 150, 255, 0.1)"
          borderLeft="1px dashed rgba(100, 150, 255, 0.1)"
          p={5}
          overflowY="auto"
          role="region"
          aria-label="编辑区域"
          tabIndex={0}
        >
          <Text
            mb={4}
            fontWeight="700"
            textAlign="center"
            fontSize="1.125rem"
            textShadow="0 2px 4px rgba(0, 0, 0, 0.3)"
            as="h2"
          >
            {t('411')}
          </Text>

          {/* 编辑工具栏 */}
          <EditToolbar
            editMode={editMode}
            selectedScreen={selectedScreen}
            onEditModeChange={setEditMode}
            t={t}
          />

          {/* 编辑画布 */}
          <EditCanvas
            selectedScreen={selectedScreen}
            gifPreviews={gifPreviews}
            editStates={editStates}
            appliedEditStates={appliedEditStates}
            editMode={editMode}
            drawingTool={drawingTool}
            brushColor={brushColor}
            brushSize={brushSize}
            onCanvasClick={handleCanvasClick}
            onCanvasMouseDown={handleCanvasMouseDown}
            onCanvasMouseMove={handleCanvasMouseMove}
            onCanvasMouseUp={handleCanvasMouseUp}
            onUpdateEditState={handleUpdateEditState}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            t={t}
          />

          {/* 操作按钮 */}
          <ActionButtons
            selectedScreen={selectedScreen}
            hasValidGifs={hasValidGifs}
            onApplyEdit={handleApplyEdit}
            onResetEdit={() => selectedScreen !== null && handleResetEditState(selectedScreen)}
            onDownloadToDevice={onDownloadToDevice}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            t={t}
          />
        </Box>

        {/* 时间同步组件 */}
        <TimeSync
          onSyncTime={onSyncTime}
          onClearData={onClearData}
          t={t}
        />

        {/* 右侧编辑工具面板 */}
        <Box
          position="absolute"
          top="260px"
          right="20px"
          w="320px"
          h="calc(100% - 305px)"
          backdropFilter="blur(12px)"
          borderRadius="20px"
          border="1px solid rgba(100, 150, 255, 0.2)"
          p={5}
          overflowY="auto"
          role="complementary"
          aria-label="编辑工具面板"
          tabIndex={0}
        >
          <Text
            fontWeight="700"
            fontSize="lg"
            textAlign="center"
            mb={4}
            textShadow="0 2px 4px rgba(0, 0, 0, 0.3)"
            as="h3"
          >
            {t('212')}
          </Text>

          <EditPanelContainer
            selectedScreen={selectedScreen}
            editMode={editMode}
            editStates={editStates}
            drawingTool={drawingTool}
            brushColor={brushColor}
            brushSize={brushSize}
            newText={newText}
            textColor={textColor}
            fontSize={fontSize}
            fontFamily={fontFamily}
            textDirection={textDirection}
            onUpdateEditState={handleUpdateEditState}
            onDrawingToolChange={setDrawingTool}
            onBrushColorChange={setBrushColor}
            onBrushSizeChange={setBrushSize}
            onNewTextChange={setNewText}
            onTextColorChange={setTextColor}
            onFontSizeChange={setFontSize}
            onFontFamilyChange={setFontFamily}
            onTextDirectionChange={setTextDirection}
            onAddText={handleAddText}
            onDeleteText={handleDeleteText}
            onClearDrawings={handleClearDrawings}
            t={t}
          />
        </Box>
      </Box>
    </>
  );
};

export default React.memo(GifEditor); 