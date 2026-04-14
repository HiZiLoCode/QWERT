"use client";

import React, { useState, useCallback, useEffect, useContext } from "react";
import { useToast, Box } from "@chakra-ui/react";
import { MainContext } from "@/providers/MainProvider";
import { GifEditState } from "./GifEditor/types";
import { useGifConverter, TransferProgress, TransferStatus } from "./GifConverter";
import GifEditor from "./GifEditor/GifEditor";
import HomePage from "./GIFHome/HomePage";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
// 解决TS类型报错：声明window扩展属性
declare global {
  interface Window {
    gifuct?: any;
    createModule?: any;
    GIFEncoder?: any;  // 添加 GIFEncoder 类型声明
  }
}

const MainScreen = React.memo(() => {
  const {
    deviceStatus,
    deviceComm,

    t,
    setDownLoad,
    connectMode,
    screenWidth,
    screenHeight,
    appliedEditStates,
    setAppliedEditStates,
    qgifModule,
    isDownloading,
    setIsDownloading,
    downloadProgress,
    setDownloadProgress,
  } = useContext(MainContext);
  const toast = useToast();
  const { showMessage, showDialog } = useSnackbarDialog()
  // GIF相关状态
  const [gifFiles, setGifFiles] = useState<(File | null)[]>([null, null, null]);
  const [gifPreviews, setGifPreviews] = useState<(string | null)[]>([null, null, null]);
  const { connectedKeyboard, keyboard } = useContext(ConnectKbContext);
  const { setDeviceFuncInfo, deviceBaseInfo } = keyboard
  // 页面状态管理
  const [currentPage, setCurrentPage] = useState<'home' | 'editor'>('home');
  const lcdScreenMaxGifs = async (length) => {
    await connectedKeyboard.startComm()
    const deviceFuncInfo = await connectedKeyboard.getFuncInfo(deviceBaseInfo.protocolVer);
    await connectedKeyboard.stopComm()
    const funcInfo = { ...deviceFuncInfo, lcdScreenMaxGif: length }
    await connectedKeyboard.setFuncInfo(funcInfo, deviceBaseInfo.protocolVer)
    setDeviceFuncInfo(funcInfo)
  }
  // 使用 GifConverter Hook
  const { convertAndDownloadGifs } = useGifConverter({
    gifFiles,
    qgifModule,
    deviceComm,
    lcdScreenMaxGifs,
    onProgressUpdate: (progress: TransferProgress) => {
      setDownloadProgress(progress);

      // 根据状态显示不同的提示
      if (progress.status === TransferStatus.COMPLETED) {
        showMessage({
          title: t('90'),
          message: progress.message,
          type: 'success',
          duration: 3000
        });
      } else if (progress.status === TransferStatus.ERROR) {
        showMessage({
          title: t('91'),
          message: progress.error || progress.message,
          type: 'error',
          duration: 5000
        });
      }
    },
    onProcessingChange: (processing: boolean) => {
      setIsDownloading(processing);
    },
    onResultsUpdate: (results) => {
      console.log('转换结果:', results);
    },
    screenWidth,
    screenHeight,
    t: t as (key: string) => string
  });

  // 监听设备连接状态，连接成功后跳转到编辑器页面
  useEffect(() => {
    if (deviceStatus && currentPage === 'home') {
      setCurrentPage('editor');
      showMessage({
        title: t('92'),
        message: t('93'),
        type: 'success',
        duration: 2000
      });
    } else if (!deviceStatus && currentPage === 'editor') {
      setCurrentPage('home');
      setIsDownloading(false);
      showMessage({
        title: t('94'),
        message: t('95'),
        type: 'warning',
        duration: 2000
      });
    }

  }, [deviceStatus, currentPage, showMessage]);

  // 组件初始化时从localStorage加载数据
  useEffect(() => {
    const initializeDefaultGifs = async () => {
      try {
        const savedFiles = JSON.parse(localStorage.getItem('gifFilesData') || '[]');
        const savedStates = JSON.parse(localStorage.getItem('appliedEditStates') || '[]');
        // 重新创建File对象和预览URL
        const files: (File | null)[] = [null, null, null];
        const previews: (string | null)[] = [null, null, null];

        // 如果没有保存的数据，或者屏幕1没有数据，则加载默认GIF
        if (savedFiles.length === 0) {

          // try {
          //   // 加载默认GIF到屏幕1
          //   const response = await fetch('./default/default1.gif');
          //   if (response.ok) {
          //     const blob = await response.blob();
          //     const defaultFile = new File([blob], 'default1.gif', { type: 'image/gif' });

          //     files[0] = defaultFile;
          //     previews[0] = URL.createObjectURL(defaultFile);

          //     // 保存默认GIF到localStorage
          //     const fileData = {
          //       name: 'default1.gif',
          //       type: 'image/gif',
          //       data: await new Promise<string>((resolve) => {
          //         const reader = new FileReader();
          //         reader.onload = () => {
          //           const result = reader.result as string;
          //           resolve(result.split(',')[1]); // 移除data:image/gif;base64,前缀
          //         };
          //         reader.readAsDataURL(defaultFile);
          //       })
          //     };

          //     const newSavedFiles = savedFiles.length === 3 ? [...savedFiles] : [null, null, null];
          //     newSavedFiles[0] = fileData;
          //     localStorage.setItem('gifFilesData', JSON.stringify(newSavedFiles));

          //     console.log('默认GIF已加载到屏幕1');
          //   }
          // } catch (error) {
          //   console.warn('加载默认GIF失败:', error);
          // }
        } else {
          // 从保存的数据恢复
          savedFiles.forEach((fileData: any, index: number) => {
            if (fileData) {
              // 从base64还原File对象
              const byteCharacters = atob(fileData.data);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const file = new File([byteArray], fileData.name, { type: fileData.type });

              files[index] = file;
              previews[index] = URL.createObjectURL(file);
            }
          });
        }

        setGifFiles(files);
        setGifPreviews(previews);

        if (savedStates.length === 3) {
          setAppliedEditStates(savedStates);
        }
      } catch (error) {
        console.error('从localStorage恢复数据失败:', error);
      }
    };

    initializeDefaultGifs();
  }, [deviceComm]);
  const getGifFrameCount = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const gif = window.gifuct.parseGIF(arrayBuffer);
    const frames = window.gifuct.decompressFrames(gif, true);
    return frames.length;
  };
  // 处理GIF上传
  const handleGifUpload = useCallback(async (screenIdx: number, file: File) => {
    if (!file.type.startsWith('image/gif')) {
      showMessage({
        title: t('126'),
        message: t('107'),
        type: 'error'
      });
      return;
    }
    try {
      // 更新文件数组
      const newFiles = [...gifFiles];
      if (newFiles[screenIdx]) {
        // 清理旧的预览URL
        if (gifPreviews[screenIdx]) {
          URL.revokeObjectURL(gifPreviews[screenIdx]!);
        }
      }
      newFiles[screenIdx] = file;
      setGifFiles(newFiles);

      // 创建新的预览URL
      const newPreviews = [...gifPreviews];
      newPreviews[screenIdx] = URL.createObjectURL(file);
      setGifPreviews(newPreviews);

      // 保存到localStorage
      const fileData = {
        name: file.name,
        type: file.type,
        data: await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // 移除data:image/gif;base64,前缀
          };
          reader.readAsDataURL(file);
        })
      };

      const savedFiles = JSON.parse(localStorage.getItem('gifFilesData') || '[null, null, null]');
      savedFiles[screenIdx] = fileData;
      localStorage.setItem('gifFilesData', JSON.stringify(savedFiles));
      showMessage({
        title: t('108'),
        message: `${t('109')} ${screenIdx + 1} ${t('110')}`,
        type: 'success'
      });

    } catch (error) {
      console.error('处理GIF文件失败:', error);
      const frameCount = await getGifFrameCount(file);
      if (frameCount >= 100) {
        showMessage({
          title: t('631'),
          message: `${t('2')}${frameCount}${t("3")}`,
          type: 'warning'
        });
      }
      // showMessage({
      //   title: t('111'),
      //   message: t('112'),
      //   type: 'error'
      // });
    }
  }, [gifFiles, gifPreviews, showMessage]);

  // 同步时间到设备
  const handleSyncTime = () => {
    if (deviceComm) {
      deviceComm.syncTime();
    }
  };

  // 清理本地数据
  const handleClearData = useCallback(() => {
    // 清理预览URL
    gifPreviews.forEach(preview => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    });

    // 重置状态
    setGifFiles([null, null, null]);
    setGifPreviews([null, null, null]);
    setAppliedEditStates([
      { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
      { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] },
      { isHue: 0, brightness: 100, contrast: 100, saturation: 100, hue: 0, scale: 100, rotation: 0, flipX: false, flipY: false, texts: [], drawings: [] }
    ]);

    // 清理localStorage
    localStorage.removeItem('gifFilesData');
    localStorage.removeItem('appliedEditStates');

    showMessage({
      title: t('113'),
      message: t('114'),
      type: 'success'
    });
  }, [gifPreviews, showMessage]);

  // 下载到设备
  const handleDownloadToDevice = useCallback(async () => {
    const validGifs = gifFiles.filter(file => file !== null);
    setDownLoad(true);
    if (validGifs.length === 0) {
      showMessage({
        title: t('115'),
        message: t('116'),
        type: 'warning'
      });
      return;
    }

    if (!deviceComm) {
      showMessage({
        title: t('117'),
        message: t('118'),
        type: 'error'
      });
      return;
    }

    if (!qgifModule) {
      showMessage({
        title: t('119'),
        message: t('120'),
        type: 'error'
      });
      return;
    }
    try {


      // 保存当前的编辑状态到 sessionStorage（GifConverter 会读取）
      for (let i = 0; i < appliedEditStates.length; i++) {
        const appliedEditKey = `applied_edit_${i}`;
        sessionStorage.setItem(appliedEditKey, JSON.stringify(appliedEditStates[i]));
      }

      // 显示开始下载提示
      showMessage({
        title: t('121'),
        message: `${t('122')} ${validGifs.length} ${t('123')}`,
        type: 'info',
        duration: 2000
      });
      console.log('convertAndDownloadGifs');

      // 调用 GifConverter 的转换和下载功能
      await convertAndDownloadGifs();

    } catch (error) {
      console.error('下载过程出错:', error);
      showMessage({
        title: t('124'),
        message: error instanceof Error ? error.message : t('125'),
        type: 'error',
        duration: 5000
      });
    } finally {
      setDownLoad(false);
    }
  }, [gifFiles, appliedEditStates, deviceComm, qgifModule, convertAndDownloadGifs, showMessage, setDownLoad]);

  // 保存appliedEditStates到localStorage
  const handleAppliedEditStatesChange = useCallback((states: GifEditState[]) => {
    setAppliedEditStates(states);
    localStorage.setItem('appliedEditStates', JSON.stringify(states));
    console.log('handleAppliedEditStatesChange');

  }, []);

  // 根据当前页面状态渲染不同内容
  return (
    <Box w="100%" h="100vh" position="relative">
      {/* 如果在编辑器页面，显示标题栏 */}
      {/* 根据页面状态显示不同内容 */}
      {currentPage === 'home' ? (
        <HomePage />
      ) : (
        <Box
          w="100%"
          h={currentPage === 'editor' ? "calc(100vh - 4.25rem)" : "100vh"}
          position="relative"
        >
          <GifEditor
            gifFiles={gifFiles}
            gifPreviews={gifPreviews}
            appliedEditStates={appliedEditStates}
            onGifUpload={handleGifUpload}
            onAppliedEditStatesChange={handleAppliedEditStatesChange}
            onGifFilesChange={setGifFiles}
            onGifPreviewsChange={setGifPreviews}
            onSyncTime={handleSyncTime}
            onClearData={handleClearData}
            onDownloadToDevice={handleDownloadToDevice}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            t={t as (key: string) => string}
          />
          {/* 蒙蔽层：非 USB 模式时显示 */}
          {connectMode !== 'USB' && (
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              bg="#dcdfe673"
              zIndex={10}
              display="flex"
              alignItems="center"
              justifyContent="center"
              fontSize="1rem"
              fontWeight="bold"
            >
              {t('888')}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
})

export default MainScreen; 