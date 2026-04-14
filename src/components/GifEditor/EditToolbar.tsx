"use client";

import { Box, Text, HStack, Button, Icon } from "@chakra-ui/react";
import { MdBrightness6, MdTextFields, MdBrush } from "react-icons/md";
import { EditMode } from "./types";

interface EditToolbarProps {
  editMode: EditMode;
  selectedScreen: number | null;
  onEditModeChange: (mode: EditMode) => void;
  t: (key: string) => string;
}

export default function EditToolbar({
  editMode,
  selectedScreen,
  onEditModeChange,
  t
}: EditToolbarProps) {
  return (
    <Box 
      w="100%" 
      bg="rgba(0, 0, 0, 0.2)" 
      p={3} 
      borderRadius="12px"
      border="1px solid rgba(100, 150, 255, 0.1)"
      mb={4}
      
    >
      <HStack spacing={3} justify="center">
        {[
          { mode: 'resize', icon: MdBrightness6, label: '300' },
          { mode: 'text', icon: MdTextFields, label: '301' },
          { mode: 'draw', icon: MdBrush, label: '302' }
        ].map(({ mode, icon, label }) => (
          <Button
            key={mode}
            size="sm"
            p={10}
            colorScheme={editMode === mode ? "blue" : "gray"}
            variant={editMode === mode ? "solid" : "outline"}
            leftIcon={<Icon as={icon} boxSize={18} />}
            onClick={() => onEditModeChange(mode as EditMode)}
            bg={editMode === mode ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" : "transparent"}
            color={editMode === mode && "white" }
            borderColor={editMode === mode ? "transparent" : "rgba(100, 150, 255, 0.4)"}
            _hover={{
              bg: editMode === mode ? "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)" : "rgba(100, 150, 255, 0.2)",
              color: "white",
              borderColor: editMode === mode ? "transparent" : "rgba(100, 150, 255, 0.6)"
            }}
            borderRadius="8px"
            fontSize="sm"
            fontWeight="600"
            isDisabled={!selectedScreen && selectedScreen !== 0}
          >
            {t(label)}
          </Button>
        ))}
      </HStack>
    </Box>
  );
} 