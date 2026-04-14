"use client";

import { VStack, Box, Text, Grid, Button, Icon, SliderTrack, SliderFilledTrack, SliderThumb } from "@chakra-ui/react";
import { MdRotateLeft, MdRotateRight } from "react-icons/md";
import { GifEditState } from "./types";
import { Slider } from "@mui/material";
interface ColorAdjustPanelProps {
  selectedScreen: number | null;
  editState: GifEditState;
  onUpdateEditState: (updates: Partial<GifEditState>) => void;
  t: (key: string) => string;
}

export default function ColorAdjustPanel({
  selectedScreen,
  editState,
  onUpdateEditState,
  t
}: ColorAdjustPanelProps) {
  const handleRotateLeft = () => {
    const currentRotation = editState.rotation;
    onUpdateEditState({ rotation: (currentRotation - 90) % 360 });
  };

  const handleRotateRight = () => {
    const currentRotation = editState.rotation;
    onUpdateEditState({ rotation: (currentRotation + 90) % 360 });
  };

  const handleFlipX = () => {
    onUpdateEditState({ flipX: !editState.flipX });
  };

  const handleFlipY = () => {
    onUpdateEditState({ flipY: !editState.flipY });
  };
  // 是否文字绘画调色
  const isHue = (index: number) => {
    onUpdateEditState({ isHue: index });
  }
  if (!selectedScreen && selectedScreen !== 0) {
    return null;
  }

  return (
    <VStack spacing={4} align="stretch" width={"94%"}>
      <Box mt={6}>
        <Text fontSize="0.875rem" mb={3} fontWeight="600">
          {t('269')}
        </Text>
        <Grid templateColumns="repeat(2, 1fr)" gap={2}>
          {[
            { icon: MdRotateLeft, label: '724', },
            { icon: MdRotateRight, label: '723', },
          ].map((item, index) => (
            <Button
              key={index}

              fontSize="0.875rem"
              size="sm"
              color={editState.isHue === index && "rgba(255, 255, 255, 0.9)"}
              variant={editState.isHue === index ? "solid" : "outline"}
              colorScheme={editState.isHue === index ? "blue" : "gray"}
              onClick={() => isHue(index as number)}
              bg={editState.isHue === index ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent"}
              _hover={{
                bg: editState.isHue === index ? "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)" : "rgba(100, 150, 255, 0.1)"
              }}
              borderRadius="8px"
              border='1px solid rgba(100, 150, 255, 0.1)'
              p={8}
            >
              {item.icon && <Icon as={item.icon} boxSize={3} mr={1} />}
              {t(item.label)}
            </Button>
          ))}
        </Grid>
      </Box>
      {[
        { key: 'brightness', label: '250', min: 0, max: 200, unit: '%' },
        { key: 'contrast', label: '251', min: 0, max: 200, unit: '%' },
        { key: 'saturation', label: '252', min: 0, max: 200, unit: '%' },
        { key: 'hue', label: '253', min: -180, max: 180, unit: '°' },
        { key: 'scale', label: '254', min: 10, max: 300, unit: '%' }
      ].map(({ key, label, min, max, unit }) => (
        <Box key={key}>
          <Text fontSize="0.875rem" mb={2} fontWeight="600">
            {t(label)}: {(editState[key as keyof GifEditState] as number)}{unit}
          </Text>
          <Slider
            value={editState[key as keyof GifEditState] as number}
            min={min}
            max={max}
            onChange={(_, value) => onUpdateEditState({ [key]: value })}
          />
        </Box>
      ))}

      {/* 变换工具 */}
      <Box mt={6}>
        <Text fontSize="0.875rem" mb={3} fontWeight="600">
          {t('260')}
        </Text>
        <Grid templateColumns="repeat(2, 1fr)" gap={2}>
          {[
            { icon: MdRotateLeft, label: '258', action: handleRotateLeft },
            { icon: MdRotateRight, label: '259', action: handleRotateRight },
            { icon: null, label: '256', action: handleFlipX },
            { icon: null, label: '257', action: handleFlipY }
          ].map((item, index) => (
            <Button
              key={index}
              size="0.875rem"
              variant="outline"
              onClick={item.action}
              borderColor="rgba(100, 150, 255, 0.3)"
              border='1px solid rgba(100, 150, 255, 0.4)'
              _hover={{
                bg: "rgba(100, 150, 255, 0.2)",
                borderColor: "rgba(100, 150, 255, 0.5)"
              }}
              borderRadius="8px"
              fontSize="xs"
            >
              {item.icon && <Icon as={item.icon} boxSize={3} mr={1} />}
              {t(item.label)}
            </Button>
          ))}
        </Grid>
      </Box>
    </VStack>
  );
} 