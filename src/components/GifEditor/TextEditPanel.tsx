"use client";

import { VStack, Box, Text, HStack, Button, SliderTrack, SliderFilledTrack, SliderThumb, Alert, AlertIcon } from "@chakra-ui/react";
import { TextElement } from "./types";
import { Slider, Input, TextField, Select, FormControl, MenuItem } from "@mui/material";
interface TextEditPanelProps {
  selectedScreen: number | null;
  texts: TextElement[];
  newText: string;
  textColor: string;
  fontSize: number;
  fontFamily: string;
  textDirection: 'horizontal' | 'vertical';
  onNewTextChange: (text: string) => void;
  onTextColorChange: (color: string) => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onTextDirectionChange: (direction: 'horizontal' | 'vertical') => void;
  onAddText: () => void;
  onDeleteText: (textId: string) => void;
  t: (key: string) => string;
}

export default function TextEditPanel({
  selectedScreen,
  texts,
  newText,
  textColor,
  fontSize,
  fontFamily,
  textDirection,
  onNewTextChange,
  onTextColorChange,
  onFontSizeChange,
  onFontFamilyChange,
  onTextDirectionChange,
  onAddText,
  onDeleteText,
  t
}: TextEditPanelProps) {
  return (
    <VStack spacing={4} align="stretch">
      <Alert status="info" p='1rem' borderRadius="8px" bg="rgba(0, 100, 255, 0.1)" border="1px solid rgba(0, 100, 255, 0.3)">
        <AlertIcon boxSize={32} color="rgba(0, 100, 255, 0.8)" mr='10px' />
        <Text fontSize="0.75rem">
          {t('350')}
        </Text>
      </Alert>

      {/* 直接添加文字 */}
      <Box>
        <Text fontSize="0.875rem" mb={2} fontWeight="600">
          {t('351')}
        </Text>
        <HStack spacing={2}>
          <TextField
            value={newText}
            onChange={(e) => onNewTextChange(e.target.value)}
            placeholder={t('352')}
            size="small"
          />
          <Button
            borderRadius='6px'
            p={5}
            size="0.875rem"
            colorScheme="blue"
            onClick={onAddText}
            isDisabled={!newText.trim()}
            bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            _hover={{
              bg: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)"
            }}
            px={4}
          >
            {t('351')}
          </Button>
        </HStack>
      </Box>

      {/* 文字样式设置 */}
      <Box>
        <Text fontSize="0.875rem" mb={2} fontWeight="600">
          {t('353')}
        </Text>
        <input
          type="color"
          value={textColor}
          onChange={(e) => onTextColorChange(e.target.value)}
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
        <Text fontSize="0.875rem" mb={2} fontWeight="600">
          {t('354')}: {fontSize}px
        </Text>
        <Slider
          value={fontSize}
          min={8}
          max={48}
          step={1}
          onChange={(_, value) => onFontSizeChange(value as number)}
        />
      </Box>

      <Box>
        <Text fontSize="0.875rem" mb={2} fontWeight="600">
          {t('355')}
        </Text>
        <FormControl fullWidth>
          <Select
            labelId="font-family-label"
            value={fontFamily}
            onChange={(e) => onFontFamilyChange(e.target.value)}
            sx={{
                height: '2rem',
              border: '1px solid rgba(100, 150, 255, 0.3)',
              '&:hover': {
                borderColor: 'rgba(100, 150, 255, 0.4)',
              },
              '&.Mui-focused': {
                borderColor: 'rgba(100, 150, 255, 0.6)',
                boxShadow: '0 0 0 1px rgba(100, 150, 255, 0.3)',
              },
              '& .MuiSvgIcon-root': {
                color: 'white',
              },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2D3748',
                  color: 'white',
                  '& .MuiMenuItem-root:hover': {
                    backgroundColor: '#4A5568',
                  },
                  '& .Mui-selected': {
                    backgroundColor: 'rgba(100, 150, 255, 0.2) !important',
                  },
                },
              },
            }}
          >
            <MenuItem value="Arial">Arial</MenuItem>
            <MenuItem value="Microsoft YaHei">微软雅黑</MenuItem>
            <MenuItem value="SimHei">黑体</MenuItem>
            <MenuItem value="KaiTi">楷体</MenuItem>
            <MenuItem value="Times New Roman">Times New Roman</MenuItem>
            <MenuItem value="Georgia">Georgia</MenuItem>
            <MenuItem value="Verdana">Verdana</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box>
        <Text fontSize="0.875rem" mb={2} fontWeight="600">
          {t('356')}
        </Text>

        <FormControl fullWidth size="small">
          <Select
            labelId="text-direction-label"
            value={textDirection}
            onChange={(e) => onTextDirectionChange(e.target.value as 'horizontal' | 'vertical')}
            sx={{
              height: '2rem',
              fontSize: '0.875rem',
              border: '1px solid rgba(100, 150, 255, 0.3)',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(100, 150, 255, 0.3)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(100, 150, 255, 0.4)',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(100, 150, 255, 0.6)',
                boxShadow: '0 0 0 1px rgba(100, 150, 255, 0.3)',
              },
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  backgroundColor: '#2D3748',
                  color: 'white',
                  '& .MuiMenuItem-root:hover': {
                    backgroundColor: '#4A5568',
                  },
                  '& .Mui-selected': {
                    backgroundColor: 'rgba(100, 150, 255, 0.2)',
                  },
                }
              }
            }}
          >
            <MenuItem value="horizontal">{t('361')}</MenuItem>
            <MenuItem value="vertical">{t('362')}</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {selectedScreen !== null && texts.length > 0 && (
        <Box>
          <Text fontSize="0.875rem" mb={2} fontWeight="600">
            {t('357')}
          </Text>
          <VStack spacing={2} maxH="150px" overflowY="auto">
            {texts.map(text => (
              <Box
                key={text.id}
                p={3}
                bg="rgba(0, 0, 0, 0.3)"
                borderRadius="8px"
                border="1px solid rgba(100, 150, 255, 0.2)"
                cursor="pointer"
                onClick={() => onDeleteText(text.id)}
                _hover={{
                  bg: "rgba(255, 0, 0, 0.2)",
                  borderColor: "rgba(255, 100, 100, 0.5)"
                }}
                w="100%"
              >
                <Text
                  color={text.color}
                  fontSize="0.875rem"
                  noOfLines={1}
                  fontFamily={text.fontFamily}
                  fontWeight={text.fontWeight}
                >
                  {text.text}
                </Text>
                <Text color="rgba(255, 255, 255, 0.6)" fontSize="0.75rem">
                  {t('358')}: {text.fontFamily} | {t('359')}: {text.fontSize}px | {t('360')}: {text.direction === 'horizontal' ? t('361') : t('362')}
                </Text>
              </Box>
            ))}
          </VStack>
        </Box>
      )}
    </VStack>
  );
} 