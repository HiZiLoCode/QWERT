"use client";

import { Box, Text, VStack, Icon } from "@chakra-ui/react";
import { MdImage } from "react-icons/md";
import { useRef, useEffect, useCallback, useState } from "react";
import { GifEditState, EditMode, DrawingElement, DrawingTool } from "./types";

interface EditCanvasProps {
  selectedScreen: number | null;
  gifPreviews: (string | null)[];
  editStates: GifEditState[];
  appliedEditStates: GifEditState[];
  editMode: EditMode;
  drawingTool: DrawingTool;
  brushColor: string;
  brushSize: number;
  onCanvasClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: () => void;
  onUpdateEditState: (screenIdx: number, updates: Partial<GifEditState>) => void;
  screenWidth: number;
  screenHeight: number;
  t: (key: string) => string;
}

export default function EditCanvas({
  selectedScreen,
  gifPreviews,
  editStates,
  appliedEditStates,
  editMode,
  drawingTool,
  brushColor,
  brushSize,
  onCanvasClick,
  onCanvasMouseDown,
  onCanvasMouseMove,
  onCanvasMouseUp,
  onUpdateEditState,
  screenWidth,
  screenHeight,
  t
}: EditCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // 绘画状态
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingElement | null>(null);

  // 文字拖拽状态
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTextId, setDraggedTextId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  

  // 内部鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log('=== EditCanvas handleMouseDown ===');
    console.log('editMode:', editMode);
    console.log('selectedScreen:', selectedScreen);
    console.log('drawingTool:', drawingTool);

    if (editMode === 'text') {
      const canvas = canvasRef.current;
      if (!canvas || selectedScreen === null) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      // 检查是否点击了文字用于拖拽
      const editState = editStates[selectedScreen];
      const clickedText = editState.texts.find(text => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;

        if (text.direction === 'vertical') {
          // 竖向文字的碰撞检测
          const textHeight = text.text.length * text.fontSize;
          const textWidth = text.fontSize; // 竖向文字的宽度约等于字体大小
          return x >= text.x && x <= text.x + textWidth &&
            y >= text.y && y <= text.y + textHeight;
        } else {
          // 横向文字的碰撞检测
          const metrics = ctx.measureText(text.text);
          return x >= text.x && x <= text.x + metrics.width &&
            y >= text.y - text.fontSize && y <= text.y;
        }
      });

      if (clickedText) {
        setIsDragging(true);
        setDraggedTextId(clickedText.id);
        setDragOffset({
          x: x - clickedText.x,
          y: y - clickedText.y
        });
        e.stopPropagation();
      }
    } else if (editMode === 'draw') {
      console.log('开始绘画模式');
      setIsDrawing(true);
      const canvas = canvasRef.current;
      if (!canvas || selectedScreen === null) {
        console.log('canvas或selectedScreen为空:', { canvas: !!canvas, selectedScreen });
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      console.log('鼠标按下位置:', { x, y });
      console.log('画布尺寸:', { width: canvas.width, height: canvas.height });
      console.log('显示尺寸:', { width: rect.width, height: rect.height });

      setLastPoint({ x, y });

      // 为所有绘画工具创建新的绘画元素
      const newDrawing: DrawingElement = {
        id: Date.now().toString(),
        type: drawingTool,
        points: [{ x, y }],
        color: brushColor,
        lineWidth: brushSize
      };

      console.log('创建新绘画元素:', newDrawing);

      setCurrentDrawing(newDrawing);

      const currentEditState = editStates[selectedScreen];
      const updatedDrawings = [...currentEditState.drawings, newDrawing];

      console.log('当前绘画数组长度:', currentEditState.drawings.length);
      console.log('更新后绘画数组长度:', updatedDrawings.length);

      onUpdateEditState(selectedScreen, {
        drawings: updatedDrawings
      });
    } else {
      // 传递给父组件处理
      onCanvasMouseDown(e);
    }
  }, [editMode, selectedScreen, editStates, drawingTool, brushColor, brushSize, onUpdateEditState, onCanvasMouseDown]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editMode === 'text' && isDragging && draggedTextId && selectedScreen !== null) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      // 更新文字位置
      const newTexts = editStates[selectedScreen].texts.map(text =>
        text.id === draggedTextId
          ? { ...text, x: x - dragOffset.x, y: y - dragOffset.y }
          : text
      );

      onUpdateEditState(selectedScreen, { texts: newTexts });
    } else if (editMode === 'draw' && isDrawing && currentDrawing && selectedScreen !== null) {
      console.log('=== EditCanvas handleMouseMove (绘画) ===');
      const canvas = canvasRef.current;
      if (!canvas) {
        console.log('canvas为空');
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

      console.log('鼠标移动位置:', { x, y });
      console.log('isDrawing:', isDrawing);
      console.log('currentDrawing:', currentDrawing);

      if (lastPoint && currentDrawing && selectedScreen !== null) {
        let updatedDrawing: DrawingElement;

        if (drawingTool === 'brush') {
          // 画笔：连续添加点
          updatedDrawing = {
            ...currentDrawing,
            points: [...currentDrawing.points, { x, y }]
          };
          console.log('画笔更新，新增点数:', updatedDrawing.points.length);
        } else if (drawingTool === 'line') {
          // 直线：起点和终点
          updatedDrawing = {
            ...currentDrawing,
            points: [currentDrawing.points[0], { x, y }]
          };
          console.log('直线更新，点数:', updatedDrawing.points.length);
        } else if (drawingTool === 'rect') {
          // 矩形：起点和对角点
          updatedDrawing = {
            ...currentDrawing,
            points: [currentDrawing.points[0], { x, y }]
          };
          console.log('矩形更新，点数:', updatedDrawing.points.length);
        } else if (drawingTool === 'circle') {
          // 圆形：中心点和边缘点
          updatedDrawing = {
            ...currentDrawing,
            points: [currentDrawing.points[0], { x, y }]
          };
          console.log('圆形更新，点数:', updatedDrawing.points.length);
        } else {
          updatedDrawing = currentDrawing;
        }

        setCurrentDrawing(updatedDrawing);

        // 更新绘画数组中的最后一个元素
        const currentDrawings = [...editStates[selectedScreen].drawings];
        currentDrawings[currentDrawings.length - 1] = updatedDrawing;

        console.log('更新editStates，绘画数组长度:', currentDrawings.length);
        console.log('最后一个绘画元素点数:', updatedDrawing.points.length);

        onUpdateEditState(selectedScreen, { drawings: currentDrawings });
      }

      setLastPoint({ x, y });
    } else {
      // 传递给父组件处理
      onCanvasMouseMove(e);
    }
  }, [editMode, isDragging, draggedTextId, selectedScreen, editStates, isDrawing, currentDrawing, drawingTool, lastPoint, dragOffset, onUpdateEditState, onCanvasMouseMove]);

  const handleMouseUp = useCallback(() => {
    if (editMode === 'text') {
      setIsDragging(false);
      setDraggedTextId(null);
      setDragOffset({ x: 0, y: 0 });
    } else if (editMode === 'draw') {
      setIsDrawing(false);
      setCurrentDrawing(null);
      setLastPoint(null);
    } else {
      // 传递给父组件处理
      onCanvasMouseUp();
    }
  }, [editMode, onCanvasMouseUp]);

  // 更新Canvas显示
  const updateCanvasDisplay = useCallback(() => {
    console.log('=== updateCanvasDisplay ===');
    console.log('selectedScreen:', selectedScreen);
    console.log('editMode:', editMode);

    if (selectedScreen === null || !gifPreviews[selectedScreen]) {
      console.log('selectedScreen为null或没有gif预览');
      return;
    }

    const editState = editStates[selectedScreen];
    const appliedEditState = appliedEditStates[selectedScreen];

    console.log('editState绘画数组长度:', editState.drawings.length);
    console.log('appliedEditState绘画数组长度:', appliedEditState.drawings.length);

    // 更新主要的交互Canvas（文字和绘画模式）
    const canvas = canvasRef.current;
    if (canvas) {
      console.log('更新交互Canvas - editMode:', editMode);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        console.log('清空画布，尺寸:', canvas.width, 'x', canvas.height);

        // 绘制当前编辑状态的文字
        console.log('绘制文字数量:', editState.texts.length);
        editState.texts.forEach(text => {
          ctx.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
          ctx.fillStyle = text.color;

          if (text.direction === 'vertical') {
            // 竖向文字 - 逐个字符从上到下渲染
            const characters = text.text.split('');
            characters.forEach((char, index) => {
              ctx.fillText(char, text.x, text.y + (index * text.fontSize));
            });
          } else {
            // 横向文字 - 正常渲染
            ctx.fillText(text.text, text.x, text.y);
          }
        });

        // 绘制当前编辑状态的图形
        console.log('绘制图形数量:', editState.drawings.length);
        editState.drawings.forEach((drawing, index) => {
          console.log(`绘制第${index + 1}个图形:`, drawing);
          if (drawing.points.length > 0) {
            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (drawing.type === 'brush') {
              // 画笔：绘制连续路径
              console.log(`画笔绘制，点数: ${drawing.points.length}`);
              ctx.beginPath();
              drawing.points.forEach((point, pointIndex) => {
                if (pointIndex === 0) {
                  ctx.moveTo(point.x, point.y);
                  console.log(`移动到: (${point.x}, ${point.y})`);
                } else {
                  ctx.lineTo(point.x, point.y);
                  console.log(`连线到: (${point.x}, ${point.y})`);
                }
              });
              ctx.stroke();
              console.log('画笔绘制完成');
            } else if (drawing.type === 'line' && drawing.points.length === 2) {
              // 直线：两点连线
              console.log('绘制直线');
              ctx.beginPath();
              ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
              ctx.lineTo(drawing.points[1].x, drawing.points[1].y);
              ctx.stroke();
            } else if (drawing.type === 'rect' && drawing.points.length === 2) {
              // 矩形：起点和对角点
              console.log('绘制矩形');
              const width = drawing.points[1].x - drawing.points[0].x;
              const height = drawing.points[1].y - drawing.points[0].y;
              ctx.strokeRect(drawing.points[0].x, drawing.points[0].y, width, height);
            } else if (drawing.type === 'circle' && drawing.points.length === 2) {
              // 圆形：中心点和半径
              console.log('绘制圆形');
              const centerX = drawing.points[0].x;
              const centerY = drawing.points[0].y;
              const radius = Math.sqrt(
                Math.pow(drawing.points[1].x - centerX, 2) +
                Math.pow(drawing.points[1].y - centerY, 2)
              );
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.stroke();
            }
          } else {
            console.log(`图形${index + 1}没有点数据`);
          }
        });
      } else {
        console.log('无法获取canvas上下文');
      }
    } else {
      console.log('不是文字或绘画模式，或没有canvas');
    }

    // 更新预览Canvas（调色模式）
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas && editMode === 'resize') {
      console.log('更新预览Canvas');
      const ctx = previewCanvas.getContext('2d');
      if (ctx) {
        // 清空画布
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        // 绘制已应用的文字
        editState.texts.forEach(text => {
          ctx.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
          ctx.fillStyle = text.color;

          if (text.direction === 'vertical') {
            // 竖向文字 - 逐个字符从上到下渲染
            const characters = text.text.split('');
            characters.forEach((char, index) => {
              ctx.fillText(char, text.x, text.y + (index * text.fontSize));
            });
          } else {
            // 横向文字 - 正常渲染
            ctx.fillText(text.text, text.x, text.y);
          }
        });

        // 绘制已应用的图形
        editState.drawings.forEach(drawing => {
          if (drawing.points.length > 0) {
            ctx.strokeStyle = drawing.color;
            ctx.lineWidth = drawing.lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (drawing.type === 'brush') {
              // 画笔：绘制连续路径
              ctx.beginPath();
              drawing.points.forEach((point, index) => {
                if (index === 0) {
                  ctx.moveTo(point.x, point.y);
                } else {
                  ctx.lineTo(point.x, point.y);
                }
              });
              ctx.stroke();
            } else if (drawing.type === 'line' && drawing.points.length === 2) {
              // 直线：两点连线
              ctx.beginPath();
              ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
              ctx.lineTo(drawing.points[1].x, drawing.points[1].y);
              ctx.stroke();
            } else if (drawing.type === 'rect' && drawing.points.length === 2) {
              // 矩形：起点和对角点
              const width = drawing.points[1].x - drawing.points[0].x;
              const height = drawing.points[1].y - drawing.points[0].y;
              ctx.strokeRect(drawing.points[0].x, drawing.points[0].y, width, height);
            } else if (drawing.type === 'circle' && drawing.points.length === 2) {
              // 圆形：中心点和半径
              const centerX = drawing.points[0].x;
              const centerY = drawing.points[0].y;
              const radius = Math.sqrt(
                Math.pow(drawing.points[1].x - centerX, 2) +
                Math.pow(drawing.points[1].y - centerY, 2)
              );
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
              ctx.stroke();
            }
          }
        });
      }
    }

    console.log('updateCanvasDisplay 完成');
  }, [selectedScreen, editStates, appliedEditStates, gifPreviews, editMode]);

  // 监听屏幕切换，更新canvas显示
  useEffect(() => {
    if (selectedScreen !== null && gifPreviews[selectedScreen]) {
      updateCanvasDisplay();
    }
  }, [selectedScreen, gifPreviews, editStates, editMode, appliedEditStates, updateCanvasDisplay]);

  return (
    <Box
      w="100%"
      h="calc(100% - 200px)"
      borderRadius="12px"
      border="2px solid rgba(100, 150, 255, 0.1)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      position="relative"
      mb={4}
    >
      {selectedScreen !== null && gifPreviews[selectedScreen] ? (
        <Box position="relative"
          overflow="hidden"
          display="flex"
          justifyContent="center"
          alignContent="center"
          width={screenWidth}
          height={screenHeight}
          border="2px solid rgba(100, 200, 255, 0.5)"
          borderRadius="12px"
        >
          {/* 原始GIF动画显示 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gifPreviews[selectedScreen]!}
            alt={`GIF预览${selectedScreen + 1}`}
            style={{
              border: '2px solid rgba(100, 150, 255, 0.3)',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              display: 'block',
              objectFit: 'contain',
              // 应用调色调整滤镜效果（编辑模式下实时预览，否则显示已应用的效果）
              filter: editMode === 'resize' ? `
                brightness(${editStates[selectedScreen].brightness}%) 
                contrast(${editStates[selectedScreen].contrast}%) 
                saturate(${editStates[selectedScreen].saturation}%) 
                hue-rotate(${editStates[selectedScreen].hue}deg)
              ` : `
                brightness(${editStates[selectedScreen].brightness}%) 
                contrast(${editStates[selectedScreen].contrast}%) 
                saturate(${editStates[selectedScreen].saturation}%) 
                hue-rotate(${editStates[selectedScreen].hue}deg)
              `,
              // 应用变换效果
              transform: editMode === 'resize' ? `
                scale(${editStates[selectedScreen].scale / 100}) 
                rotate(${editStates[selectedScreen].rotation}deg) 
                scaleX(${editStates[selectedScreen].flipX ? -1 : 1}) 
                scaleY(${editStates[selectedScreen].flipY ? -1 : 1})
              ` : `
                scale(${editStates[selectedScreen].scale / 100}) 
                rotate(${editStates[selectedScreen].rotation}deg) 
                scaleX(${editStates[selectedScreen].flipX ? -1 : 1}) 
                scaleY(${editStates[selectedScreen].flipY ? -1 : 1})
              `,
              transformOrigin: 'center center',
              transition: 'filter 0.1s ease, transform 0.1s ease'
            }}
          />

          {/* 文字和绘画模式的交互Canvas */}
          <canvas
            ref={canvasRef}
            width={screenWidth}
            height={screenHeight}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              cursor: editMode === 'draw' ? 'crosshair' :
                editMode === 'text' ? 'pointer' : 'default',
              backgroundColor: 'transparent',
              filter: editStates[selectedScreen].isHue === 1 ? `
                brightness(${editStates[selectedScreen].brightness}%) 
                contrast(${editStates[selectedScreen].contrast}%) 
                saturate(${editStates[selectedScreen].saturation}%) 
                hue-rotate(${editStates[selectedScreen].hue}deg)
              ` : 'none',
              // 应用变换效果
              transform: editStates[selectedScreen].isHue === 1 ? `
                scale(${editStates[selectedScreen].scale / 100}) 
                rotate(${editStates[selectedScreen].rotation}deg) 
                scaleX(${editStates[selectedScreen].flipX ? -1 : 1}) 
                scaleY(${editStates[selectedScreen].flipY ? -1 : 1})
              ` : 'none',
            }}
            onClick={onCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          {/* 显示所有编辑效果的Canvas - 在所有模式下显示文字和绘画 */}
          {selectedScreen !== null &&
            (editStates[selectedScreen].texts.length > 0 ||
              editStates[selectedScreen].drawings.length > 0 ||
              editStates[selectedScreen].texts.length > 0 ||
              editStates[selectedScreen].drawings.length > 0) &&
            editMode !== 'text' && editMode !== 'draw' && (
              <canvas
                ref={previewCanvasRef}
                width={screenWidth}
                height={screenHeight}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  backgroundColor: 'transparent',
                  pointerEvents: 'none',
                  filter: editStates[selectedScreen].isHue === 1 ? `
                brightness(${editStates[selectedScreen].brightness}%) 
                contrast(${editStates[selectedScreen].contrast}%) 
                saturate(${editStates[selectedScreen].saturation}%) 
                hue-rotate(${editStates[selectedScreen].hue}deg)
              ` : 'none',
                  // 应用变换效果
                  transform: editStates[selectedScreen].isHue === 1 ? `
                scale(${editStates[selectedScreen].scale / 100}) 
                rotate(${editStates[selectedScreen].rotation}deg) 
                scaleX(${editStates[selectedScreen].flipX ? -1 : 1}) 
                scaleY(${editStates[selectedScreen].flipY ? -1 : 1})
              ` : 'none',
                }}
              />
            )}
        </Box>
      ) : (
        <VStack spacing={3}>
          <Icon as={MdImage} boxSize={48} />
          <Text color="rgba(100, 150, 255, 0.6)" fontSize="1.125rem" textAlign="center">
            {t('280')}
          </Text>
          <Text color="rgba(100, 150, 255, 0.6)" fontSize="1.125rem" textAlign="center">
            {t('279')}
          </Text>
        </VStack>
      )}
    </Box>
  );
} 