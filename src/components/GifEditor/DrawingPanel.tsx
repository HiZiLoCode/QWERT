"use client";

import { VStack, Box, Text, Grid, Button, Icon, SliderTrack, SliderFilledTrack, SliderThumb } from "@chakra-ui/react";
import { MdBrush, MdClear } from "react-icons/md";
import { DrawingTool } from "./types";
import { Slider } from "@mui/material";

interface DrawingPanelProps {
  drawingTool: DrawingTool;
  brushColor: string;
  brushSize: number;
  onDrawingToolChange: (tool: DrawingTool) => void;
  onBrushColorChange: (color: string) => void;
  onBrushSizeChange: (size: number) => void;
  onClearDrawings: () => void;
  t: (key: string) => string;
}

export default function DrawingPanel({
  drawingTool,
  brushColor,
  brushSize,
  onDrawingToolChange,
  onBrushColorChange,
  onBrushSizeChange,
  onClearDrawings,
  t
}: DrawingPanelProps) {
  return (
    <VStack spacing={4} align="stretch">
      <Text fontSize="sm" fontWeight="600">
        🎨 {t('793')}
      </Text>

      <Grid templateColumns="repeat(2, 1fr)" gap={2}>
        {[
          { tool: 'brush', icon: MdBrush, label: '270' },
          { tool: 'line', icon: null, label: '271' },
          { tool: 'rect', icon: null, label: '272' },
          { tool: 'circle', icon: null, label: '273' }
        ].map(({ tool, icon, label }) => (
          <Button
            key={tool}
            size="sm"
            color={drawingTool === tool&&"rgba(255, 255, 255, 0.9)"}
            variant={drawingTool === tool ? "solid" : "outline"}
            colorScheme={drawingTool === tool ? "blue" : "gray"}
            onClick={() => onDrawingToolChange(tool as DrawingTool)}
            leftIcon={icon ? <Icon as={icon} boxSize={12} /> : undefined}
            bg={drawingTool === tool ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent"}
            _hover={{
              bg: drawingTool === tool ? "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)" : "rgba(100, 150, 255, 0.1)"
            }}
            borderRadius="8px"
            fontSize="0.75rem"
            border='1px solid rgba(100, 150, 255, 0.1)'
            p={8}
          >
            {t(label)}
          </Button>
        ))}
      </Grid>

      <Box>
        <Text fontSize="sm" mb={2} fontWeight="600">
          {t('274')}
        </Text>
        <input
          type="color"
          value={brushColor}
          onChange={(e) => onBrushColorChange(e.target.value)}
          style={{
            width: '100%',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        />
      </Box>

      <Box>
        <Text  fontSize="sm" mb={2} fontWeight="600">
          {t('277')}: {brushSize}px
        </Text>
         <Slider
          value={brushSize}
          min={1}
          max={20}
          step={1}
          size="md"
          onChange={( _ ,value) => onBrushSizeChange(value)}
        />
      </Box>

      <Button
        size="sm"
        p={10}
        colorScheme="red"
        leftIcon={<MdClear />}
        onClick={onClearDrawings}
        bg="linear-gradient(135deg, #e53e3e 0%, #c53030 100%)"
        _hover={{
          bg: "linear-gradient(135deg, #c53030 0%, #9c2626 100%)"
        }}
        borderRadius="8px"
        fontSize="sm"
      >
        {t('276')}
      </Button>
    </VStack>
  );
} 