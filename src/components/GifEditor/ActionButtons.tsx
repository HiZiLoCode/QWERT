"use client";

import { Box, HStack, Button, Progress, Text } from "@chakra-ui/react";
import { MdCheck, MdRefresh, MdDownload, MdSync } from "react-icons/md";
import { TransferProgress, TransferStatus } from "../GifConverter";

interface ActionButtonsProps {
  selectedScreen: number | null;
  hasValidGifs: boolean;
  onApplyEdit: () => void;
  onResetEdit: () => void;
  onDownloadToDevice: () => void;
  isDownloading?: boolean;
  downloadProgress?: TransferProgress | null;
  t: (key: string) => string;
}

const ActionButtons = ({
  selectedScreen,
  hasValidGifs,
  onApplyEdit,
  onResetEdit,
  onDownloadToDevice,
  isDownloading = false,
  downloadProgress,
  t
}: ActionButtonsProps) => {
  const handleApplyEdit = (): void => {
    onApplyEdit();
  };

  const handleResetEdit = (): void => {
    onResetEdit();
  };

  const handleDownloadToDevice = (): void => {
    onDownloadToDevice();
  };

  const handleKeyDown = (event: React.KeyboardEvent, action: () => void): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  // 获取下载状态文本
  const getDownloadStatusText = (): string => {
    if (!downloadProgress) return t('306');

    switch (downloadProgress.status) {
      case TransferStatus.CONNECTING:
        return t('307');
      case TransferStatus.SYNCING_TIME:
        return t('308');
      case TransferStatus.INITIALIZING:
        return t('309');
      case TransferStatus.PREPARING:
        return t('310');
      case TransferStatus.ERASING:
        return t('311');
      case TransferStatus.TRANSFERRING:
        return `${t('312')} ${downloadProgress.percentage}%`;
      case TransferStatus.FINALIZING:
        return t('313');
      case TransferStatus.COMPLETED:
        return t('314');
      case TransferStatus.ERROR:
        return t('315');
      default:
        return t('316');
    }
  };

  return (
    <Box mt={4} role="toolbar" aria-label={t('318')}>
      <HStack spacing={3} justify="center">
        {/* 应用编辑按钮 */}
        <Button
          size="md"
          colorScheme="green"
          leftIcon={<MdCheck />}
          onClick={handleApplyEdit}
          onKeyDown={(e) => handleKeyDown(e, handleApplyEdit)}
          isDisabled={selectedScreen === null || isDownloading}
          bg="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
          _hover={{
            bg: "linear-gradient(135deg, #38a169 0%, #2f855a 100%)",
            transform: "translateY(-2px)"
          }}
          _disabled={{
            bg: "rgba(80, 80, 80, 0.5)",
            color: "rgba(255, 255, 255, 0.3)"
          }}
          borderRadius="12px"
          fontSize="sm"
          fontWeight="600"
          boxShadow="0 4px 15px rgba(72, 187, 120, 0.3)"
          p={8}
          color="white"
          tabIndex={0}
          aria-label="应用当前编辑到GIF"
        >
          {t('304')}
        </Button>

        {/* 重置编辑按钮 */}
        <Button
          size="md"
          colorScheme="gray"
          leftIcon={<MdRefresh />}
          onClick={handleResetEdit}
          onKeyDown={(e) => handleKeyDown(e, handleResetEdit)}
          isDisabled={selectedScreen === null || isDownloading}
          bg="linear-gradient(135deg, #718096 0%, #4a5568 100%)"
          _hover={{
            bg: "linear-gradient(135deg, #4a5568 0%, #2d3748 100%)",
            transform: "translateY(-2px)"
          }}
          _disabled={{
            bg: "rgba(80, 80, 80, 0.5)",
            color: "rgba(255, 255, 255, 0.3)"
          }}
          borderRadius="12px"
          fontSize="sm"
          fontWeight="600"
          boxShadow="0 4px 15px rgba(113, 128, 150, 0.3)"
          p={8}
          color="white"
          tabIndex={0}
          aria-label="重置当前编辑状态"
        >
          {t('305')}
        </Button>

        {/* 下载到设备按钮 */}
        <Button
          size="md"
          color="white"
          colorScheme="blue"
          leftIcon={isDownloading ? <MdSync className="animate-spin" /> : <MdDownload />}
          onClick={handleDownloadToDevice}
          onKeyDown={(e) => handleKeyDown(e, handleDownloadToDevice)}
          isDisabled={!hasValidGifs || isDownloading}
          isLoading={isDownloading}
          bg="linear-gradient(135deg, #4299e1 0%, #3182ce 100%)"
          _hover={{
            bg: "linear-gradient(135deg, #3182ce 0%, #2c5282 100%)",
            transform: "translateY(-2px)"
          }}
          _disabled={{
            bg: "rgba(80, 80, 80, 0.5)",
            color: "rgba(255, 255, 255, 0.3)"
          }}
          borderRadius="12px"
          fontSize="sm"
          fontWeight="600"
          boxShadow="0 4px 15px rgba(66, 153, 225, 0.3)"
          p={8}
          tabIndex={0}
          aria-label={t('306')}
        >
          {t('306')}
        </Button>
      </HStack>

      {/* 下载进度条 */}
      {isDownloading && downloadProgress && (
        <Box mt={3} px={4}>
          <Progress
            value={downloadProgress.percentage}
            colorScheme="blue"
            size="sm"
            borderRadius="md"
            bg="rgba(255, 255, 255, 0.1)"
          />
          <Text
            fontSize="xs"
            textAlign="center"
            mt={1}
          >
            {downloadProgress.message}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default ActionButtons; 