"use client";

import { Box, Text, VStack, Button } from "@chakra-ui/react";
import { MdSync } from "react-icons/md";
import { useState, useEffect } from "react";

interface TimeSyncProps {
  onSyncTime: () => void;
  onClearData: () => void;
  t: (key: string) => string;
}

const TimeSync = ({ onSyncTime, onClearData, t }: TimeSyncProps) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  // 更新当前时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // 获取星期几
  const getWeekday = (date: Date): string => {
    const weekdays = [t('390'), t('391'), t('392'), t('393'), t('394'), t('395'), t('396')];
    return weekdays[date.getDay()];
  };

  const handleSyncTime = (): void => {
    onSyncTime();
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return (
    <Box
      position="absolute"
      top="10px"
      right="20px"
      w="320px"
      h="230px"
      backdropFilter="blur(12px)"
      borderRadius="20px"
      border="1px solid rgba(100, 150, 255, 0.2)"
      p={5}
      role="region"
      aria-label={t('380')}
      tabIndex={0}
    >
      <Text 
         
        fontWeight="700" 
        fontSize="1.125rem" 
        textAlign="center" 
        mb={4}
        textShadow="0 2px 4px rgba(0, 0, 0, 0.3)"
        as="h3"
      >
        {t('380')}
      </Text>
      
      <VStack spacing={3} align="center" h='80%' justifyContent='space-evenly'>
        {/* 当前时间显示 */}
        <Box textAlign="center" role="timer" aria-live="polite">
          <Text fontSize="0.875rem" fontWeight="600" >
            {currentTime.getFullYear()}-{String(currentTime.getMonth() + 1).padStart(2, '0')}-{String(currentTime.getDate()).padStart(2, '0')}
          </Text>
          <Text fontSize="0.75rem" color="rgba(100, 150, 255, 0.8)" mb={2}>
            {getWeekday(currentTime)}
          </Text>
          <Text 
            fontSize="1.5rem" 
            fontWeight="700" 
            
            fontFamily="monospace"
            textShadow="0 0 15px rgba(100, 150, 255, 0.5)"
            letterSpacing="0.1em"
            aria-label={`${t('386')} ${String(currentTime.getHours()).padStart(2, '0')}${t('387')}${String(currentTime.getMinutes()).padStart(2, '0')}${t('388')}${String(currentTime.getSeconds()).padStart(2, '0')}${t('389')}`}
          >
            {String(currentTime.getHours()).padStart(2, '0')}:
            {String(currentTime.getMinutes()).padStart(2, '0')}:
            {String(currentTime.getSeconds()).padStart(2, '0')}
          </Text>
        </Box>
        
        {/* 同步按钮 */}
        <Button 
          size="md" 
          colorScheme="blue" 
          leftIcon={<MdSync />}
          onClick={handleSyncTime}
          onKeyDown={(e) => handleKeyDown(e, handleSyncTime)}
          bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
          _hover={{
            bg: "linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)",
            transform: "translateY(-2px)"
          }}
          borderRadius="12px"
          fontSize="sm"
          fontWeight="600"
          boxShadow="0 4px 15px rgba(102, 126, 234, 0.3)"
          p={10}
          tabIndex={0}
          aria-label={t('381')}
        >
          {t('381')}
        </Button>
      </VStack>
    </Box>
  );
};

export default TimeSync; 