"use client";

import { Box, Text, VStack, Flex, Button, HStack, Icon } from "@chakra-ui/react";
import { MdCloudUpload } from "react-icons/md";
import { GifEditState } from "./types";
import { useCallback, useContext, useEffect, useRef } from "react";
import { MainContext } from "@/providers/MainProvider";

interface GifUploadPanelProps {
  gifFiles: (File | null)[];
  gifPreviews: (string | null)[];
  appliedEditStates: GifEditState[];
  selectedScreen: number | null;
  onGifUpload: (screenIdx: number, file: File) => void;
  onScreenSelect: (screenIdx: number) => void;
  onResetAppliedEdit: (screenIdx: number) => void;
  onDeleteGif: (screenIdx: number) => void;
  screenWidth: number;
  screenHeight: number;
  t: (key: string) => string;
}

const GifUploadPanel = ({
  gifFiles,
  gifPreviews,
  appliedEditStates,
  selectedScreen,
  onGifUpload,
  onScreenSelect,
  onResetAppliedEdit,
  onDeleteGif,
  screenWidth,
  screenHeight,
  t
}: GifUploadPanelProps) => {
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({});
  const { screenInfo } = useContext(MainContext)
  const handleFileUpload = (screenIdx: number, event: React.ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;

    onGifUpload(screenIdx, file);
  };

  const handleScreenSelect = (screenIdx: number): void => {
    onScreenSelect(screenIdx);
  };

  const handleResetAppliedEdit = (screenIdx: number): void => {
    onResetAppliedEdit(screenIdx);
  };

  const handleDeleteGif = (screenIdx: number): void => {
    onDeleteGif(screenIdx);
    const input = document.getElementById(`gif-upload-${screenIdx}`) as HTMLInputElement
    input!.value = ''
  };

  const handleUploadClick = (screenIdx: number): void => {
    const input = document.getElementById(`gif-upload-${screenIdx}`);
    input?.click();
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  const isEditStateDefault = (screenIdx: number): boolean => {
    const state = appliedEditStates[screenIdx];
    return (
      state.brightness === 100 &&
      state.contrast === 100 &&
      state.saturation === 100 &&
      state.hue === 0 &&
      state.scale === 100 &&
      state.rotation === 0 &&
      !state.flipX &&
      !state.flipY &&
      state.texts.length === 0 &&
      state.drawings.length === 0
    );
  };
  const updateCanvasDisplay = useCallback(() => {

    appliedEditStates.forEach((editState, idx) => {
      // if (isEditStateDefault(idx)) {
      //   console.log(`屏幕 ${idx + 1} 为默认状态，跳过渲染`);
      //   return;
      // }

      const canvas = canvasRefs.current[idx];
      if (!canvas) {
        console.log(`未找到屏幕 ${idx + 1} 的 canvas`);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.log(`无法获取屏幕 ${idx + 1} 的 canvas 上下文`);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制文字
      editState.texts.forEach((text, textIdx) => {
        ctx.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        if (text.direction === 'vertical') {
          text.text.split('').forEach((char, i) => {
            ctx.fillText(char, text.x, text.y + i * text.fontSize);
          });
        } else {
          ctx.fillText(text.text, text.x, text.y);
        }
      });

      // 绘制图形
      editState.drawings.forEach((drawing, drawIdx) => {

        ctx.strokeStyle = drawing.color;
        ctx.lineWidth = drawing.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (drawing.type === 'brush') {
          ctx.beginPath();
          drawing.points.forEach((pt, ptIdx) => {
            if (ptIdx === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();
        } else if (drawing.type === 'line' && drawing.points.length === 2) {
          ctx.beginPath();
          ctx.moveTo(drawing.points[0].x, drawing.points[0].y);
          ctx.lineTo(drawing.points[1].x, drawing.points[1].y);
          ctx.stroke();
        } else if (drawing.type === 'rect' && drawing.points.length === 2) {
          const w = drawing.points[1].x - drawing.points[0].x;
          const h = drawing.points[1].y - drawing.points[0].y;
          ctx.strokeRect(drawing.points[0].x, drawing.points[0].y, w, h);
        } else if (drawing.type === 'circle' && drawing.points.length === 2) {
          const cx = drawing.points[0].x;
          const cy = drawing.points[0].y;
          const r = Math.sqrt(
            Math.pow(drawing.points[1].x - cx, 2) +
            Math.pow(drawing.points[1].y - cy, 2)
          );
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, 2 * Math.PI);
          ctx.stroke();
        }
      });

      console.log(`屏幕 ${idx + 1} 渲染完成`);
    });

  }, [appliedEditStates, gifPreviews]);
  useEffect(() => {
    console.log(appliedEditStates, gifPreviews, 'gifPreviews');

    updateCanvasDisplay();
  }, [appliedEditStates, updateCanvasDisplay, gifPreviews]);
  return (
    <Box
      position="absolute"
      w="320px"
      h="calc(100% - 24px)"
      backdropFilter="blur(12px)"
      borderRight="1px dashed rgba(100, 150, 255, 0.1)"
      overflowY="auto"
      role="region"
      aria-label="GIF文件管理面板"
      tabIndex={0}
      left={10}
      p={10}
    >
      <Text
        fontWeight="700"
        fontSize="1.125rem"
        textAlign="center"
        textShadow="0 2px 4px rgba(0, 0, 0, 0.3)"
        as="h3"
      > 
        {t('310')}
      </Text>

      <VStack spacing={4}>
        {Array.from({ length: screenInfo?.maxSereen || 0 }, (_, i) => i).map(idx => (
          <Box key={idx} w="100%" role="group" aria-labelledby={`screen-label-${idx}`}>
            <Flex justify="space-between" align="center" mb={2}>
              <Text
                id={`screen-label-${idx}`}
                fontWeight="600"
                fontSize="sm"
              >
                {t('311')} {idx + 1}
              </Text>
              <Text
                color="rgba(100, 150, 255, 0.8)"
                fontSize="xs"
                fontFamily="monospace"
                aria-label="推荐尺寸240像素宽136像素高"
              >
                {screenWidth}×{screenHeight}
              </Text>
            </Flex>

            <input
              type="file"
              accept="image/gif"
              style={{ display: 'none' }}
              id={`gif-upload-${idx}`}
              onChange={(e) => handleFileUpload(idx, e)}
              aria-label={`${t('312')} ${idx + 1} ${t('313')}`}
            />
            <Flex justify="center" w="100%">
              <Box
                w={`${screenWidth}px`}
                h={`${screenHeight}px`}
                borderRadius="12px"
                overflow="hidden"
                border="2px solid"
                borderColor={gifFiles[idx] ? "rgba(100, 200, 255, 0.5)" : "rgba(100, 150, 255, 0.3)"}
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="pointer"
                onClick={() => handleUploadClick(idx)}
                onKeyDown={(e) => handleKeyDown(e, () => handleUploadClick(idx))}
                _hover={{
                  borderColor: gifFiles[idx] ? "rgba(100, 200, 255, 0.8)" : "rgba(100, 150, 255, 0.6)",
                  bg: gifFiles[idx] ? "rgba(0, 30, 60, 0.6)" : "rgba(40, 50, 70, 0.8)",
                  transform: "translateY(-1px)"
                }}
                transition="all 0.3s ease"
                position="relative"
                tabIndex={0}
                role="button"
                aria-label={gifFiles[idx] ? `${t('314')}: ${gifFiles[idx]?.name}` : `${t('315')} ${idx + 1} ${t('316')}`}
              >
                {gifPreviews[idx] ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gifPreviews[idx]!}
                      alt={`${t('318')} ${idx + 1} ${t('319')}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        filter: `
                          brightness(${appliedEditStates[idx].brightness}%) 
                          contrast(${appliedEditStates[idx].contrast}%) 
                          saturate(${appliedEditStates[idx].saturation}%) 
                          hue-rotate(${appliedEditStates[idx].hue}deg)
                        `,
                        transform: `
                          scale(${appliedEditStates[idx].scale / 100}) 
                          rotate(${appliedEditStates[idx].rotation}deg) 
                          scaleX(${appliedEditStates[idx].flipX ? -1 : 1}) 
                          scaleY(${appliedEditStates[idx].flipY ? -1 : 1})
                        `,
                        transformOrigin: 'center center',
                        transition: 'filter 0.3s ease, transform 0.3s ease'
                      }}
                    />
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[idx] = el;
                      }}
                      width={screenWidth}
                      height={screenHeight}
                      style={{
                        position: 'absolute',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: '8px',
                        filter: appliedEditStates[idx].isHue === 1 ? `
                          brightness(${appliedEditStates[idx].brightness}%) 
                          contrast(${appliedEditStates[idx].contrast}%) 
                          saturate(${appliedEditStates[idx].saturation}%) 
                          hue-rotate(${appliedEditStates[idx].hue}deg)
                        `: "none",
                        transform: appliedEditStates[idx].isHue === 1 ? `
                          scale(${appliedEditStates[idx].scale / 100}) 
                          rotate(${appliedEditStates[idx].rotation}deg) 
                          scaleX(${appliedEditStates[idx].flipX ? -1 : 1}) 
                          scaleY(${appliedEditStates[idx].flipY ? -1 : 1})
                        `: "none",
                        transformOrigin: 'center center',
                        transition: 'filter 0.3s ease, transform 0.3s ease'
                      }}
                    />
                    <Box
                      position="absolute"
                      bottom={0}
                      left={0}
                      right={0}
                      bg="rgba(255, 255, 255, 0.5)"
                      p={1}
                      borderBottomRadius="10px"
                    >
                      <Text fontSize="0.75rem" textAlign="center" fontWeight="500" noOfLines={1}>
                        {gifFiles[idx]?.name}
                      </Text>
                    </Box>
                  </>
                ) : (
                  <VStack spacing={2}>
                    <Icon as={MdCloudUpload} boxSize={24} aria-hidden="true" />
                    <Text fontSize="0.75rem" textAlign="center">
                      {t('320')}
                    </Text>
                    <Text color="rgba(100, 150, 255, 0.6)" fontSize="0.75rem" textAlign="center">
                      {t('321')}: {screenWidth}{t('322')}{screenHeight}
                    </Text>
                  </VStack>
                )}
              </Box>
            </Flex>

            {gifFiles[idx] && (
              <HStack spacing={2} mt={2} justify="center" role="toolbar" aria-label={`屏幕${idx + 1}操作按钮`}>
                <Button
                  size="0.75rem"
                  variant="outline"
                  colorScheme={selectedScreen === idx ? "blue" : "gray"}
                  onClick={() => handleScreenSelect(idx)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleScreenSelect(idx))}
                  borderColor="rgba(100, 150, 255, 0.3)"
                  _hover={{
                    bg: "rgba(100, 150, 255, 0.2)",
                    borderColor: "rgba(100, 150, 255, 0.5)"
                  }}
                  p={8}
                  m={2}
                  borderRadius="6px"
                  fontSize="0.75rem"
                  border="1px solid"
                  tabIndex={0}
                  aria-label={`编辑屏幕${idx + 1}的GIF`}
                  aria-pressed={selectedScreen === idx}
                >
                  {t('325')}
                </Button>
                <Button
                  size="0.75rem"
                  variant="outline"
                  colorScheme="orange"
                  onClick={() => handleResetAppliedEdit(idx)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleResetAppliedEdit(idx))}
                  borderColor="rgba(255, 150, 100, 0.3)"
                  color="rgba(255, 150, 100, 0.9)"
                  _hover={{
                    bg: "rgba(255, 150, 100, 0.2)",
                    borderColor: "rgba(255, 150, 100, 0.5)"
                  }}
                  p={8}
                  m={2}
                  border="1px solid"
                  borderRadius="6px"
                  fontSize="0.75rem"
                  isDisabled={isEditStateDefault(idx)}
                  tabIndex={0}
                  aria-label={`重置屏幕${idx + 1}的编辑状态`}
                >
                  {t('326')}
                </Button>
                <Button
                  size="0.75rem"
                  variant="outline"
                  border="1px solid"
                  colorScheme="red"
                  onClick={() => handleDeleteGif(idx)}
                  onKeyDown={(e) => handleKeyDown(e, () => handleDeleteGif(idx))}
                  borderColor="rgba(255, 100, 100, 0.3)"
                  color="rgba(255, 100, 100, 0.9)"
                  _hover={{
                    bg: "rgba(255, 100, 100, 0.2)",
                    borderColor: "rgba(255, 100, 100, 0.5)"
                  }}
                  p={8}
                  m={2}
                  borderRadius="6px"
                  fontSize="0.75rem"
                  tabIndex={0}
                  aria-label={`删除屏幕${idx + 1}的GIF文件`}
                >
                  {t('327')}
                </Button>
              </HStack>
            )}
          </Box>
        ))}
      </VStack>
    </Box>
  );
};

export default GifUploadPanel; 