"use client";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
import { useToast } from "@chakra-ui/react";
import {
  buildWorkParamLogical15,
  encodeLcdImageMetaByte,
  LCD_ERASE_ISLAND_PERSONAL,
  sendLcdEraseAndWait,
  sendScreenWorkParam15Packets,
  settleBetweenLcd19Packets,
} from "@/components/ScreenTheme/lcdIslandProtocol";

// GIF转换结果类型
export interface GifConversionResult {
  qgifBin: Uint8Array;
  size: number;
  frameCount: number;
  fps: number;
  screenIndex: number;
}

// 数据传输状态
export enum TransferStatus {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  SYNCING_TIME = 'syncing_time',
  INITIALIZING = 'initializing',
  PREPARING = 'preparing',
  ERASING = 'erasing',
  TRANSFERRING = 'transferring',
  FINALIZING = 'finalizing',
  COMPLETED = 'completed',
  ERROR = 'error'
}

// 传输进度信息
export interface TransferProgress {
  status: TransferStatus;
  currentScreen: number;
  totalScreens: number;
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  message: string;
  error?: string;
}

// 定义GIF编辑状态接口
interface GifEditState {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  scale: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  texts: TextElement[];
  drawings: DrawingElement[];
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  direction: 'horizontal' | 'vertical';
}

interface DrawingElement {
  id: string;
  type: 'brush' | 'line' | 'rect' | 'circle';
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

interface GifConverterProps {
  gifFiles: (File | null)[];
  qgifModule: any;
  deviceComm: any;
  onProgressUpdate: (progress: TransferProgress) => void;
  onProcessingChange: (processing: boolean) => void;
  onResultsUpdate: (results: GifConversionResult[]) => void;
  screenWidth: number;
  screenHeight: number;
  t: (key: string) => string;
  lcdScreenMaxGifs: any;
}
// 清理 WASM 文件系统中的文件
async function cleanupWasmFiles(qgifModule: any) {
  try {
    const files = qgifModule.FS.readdir('/');
    for (const file of files) {
      if (file !== '.' && file !== '..') {
        try {
          qgifModule.FS.unlink(`/${file}`);
        } catch (e) {
          console.warn(`清理文件失败: ${file}`, e);
        }
      }
    }
  } catch (error) {
    console.warn('清理文件系统失败:', error);
  }
}

// 尝试扩展 WASM 内存
async function tryExtendWasmMemory(qgifModule: any) {
  try {
    const currentPages = qgifModule._getMemoryPages();
    const targetPages = Math.ceil((currentPages * 1.5) / 64) * 64;
    if (targetPages > currentPages) {
      console.log(`扩展内存: ${currentPages} -> ${targetPages} 页`);
      qgifModule._extendMemory(targetPages);
    }
  } catch (error) {
    console.warn('扩展内存失败:', error);
  }
}

// 分解 GIF 为 PNG 序列 - 使用 gifuct-js 处理透明度
// 分解 GIF 为 PNG 序列 - 使用 gifuct-js 处理透明度
async function decomposeGifToPngs(
  gifData: Uint8Array,
  fs: any,
  options: { targetWidth: number; targetHeight: number; defaultFps: number },
  editState?: GifEditState,
  t?: (key: string) => string
): Promise<{ frameCount: number; fps: number }> {
  if (!window.gifuct) {
    throw new Error("gifuct-js 未加载");
  }

  // 绘制文字和绘画
  function drawTextsAndDrawings(
    ctx: CanvasRenderingContext2D,
    editState: GifEditState,
    offsetX: number,
    offsetY: number
  ) {
    ctx.textBaseline = "top";
    editState.texts.forEach((text) => {
      ctx.font = `${text.fontWeight} ${text.fontSize}px ${text.fontFamily}`;
      ctx.fillStyle = text.color;
      if (text.direction === "vertical") {
        text.text.split("").forEach((char, idx) => {
          ctx.fillText(
            char,
            text.x + offsetX,
            text.y + offsetY + idx * text.fontSize
          );
        });
      } else {
        ctx.fillText(text.text, text.x + offsetX, text.y + offsetY);
      }
    });

    editState.drawings.forEach((drawing) => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (drawing.type === "brush" && drawing.points.length > 0) {
        ctx.beginPath();
        drawing.points.forEach((p, i) => {
          const x = p.x + offsetX;
          const y = p.y + offsetY;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
      } else if (drawing.type === "line" && drawing.points.length === 2) {
        const [p1, p2] = drawing.points;
        ctx.beginPath();
        ctx.moveTo(p1.x + offsetX, p1.y + offsetY);
        ctx.lineTo(p2.x + offsetX, p2.y + offsetY);
        ctx.stroke();
      } else if (drawing.type === "rect" && drawing.points.length === 2) {
        const [p1, p2] = drawing.points;
        ctx.strokeRect(
          p1.x + offsetX,
          p1.y + offsetY,
          p2.x - p1.x,
          p2.y - p1.y
        );
      } else if (drawing.type === "circle" && drawing.points.length === 2) {
        const [c, e] = drawing.points;
        const radius = Math.hypot(e.x - c.x, e.y - c.y);
        ctx.beginPath();
        ctx.arc(c.x + offsetX, c.y + offsetY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  }

  // 色相矩阵
  function applyHueRotateMatrix(
    r: number,
    g: number,
    b: number,
    hue: number
  ): [number, number, number] {
    const angle = (hue * Math.PI) / 180;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    return [
      r * (0.213 + cosA * 0.787 - sinA * 0.213) +
      g * (0.715 - cosA * 0.715 - sinA * 0.715) +
      b * (0.072 - cosA * 0.072 + sinA * 0.928),
      r * (0.213 - cosA * 0.213 + sinA * 0.143) +
      g * (0.715 + cosA * 0.285 + sinA * 0.140) +
      b * (0.072 - cosA * 0.072 - sinA * 0.283),
      r * (0.213 - cosA * 0.213 - sinA * 0.787) +
      g * (0.715 - cosA * 0.715 + sinA * 0.715) +
      b * (0.072 + cosA * 0.928 + sinA * 0.072),
    ];
  }

  try {
    // 解析 GIF
    const gif = window.gifuct.parseGIF(gifData);
    const frames = window.gifuct.decompressFrames(gif, true);
    if (!frames || frames.length === 0) {
      throw new Error("GIF 没有有效的帧数据");
    }

    const frameCount = frames.length;

    // 动态帧率
    const firstFrame = frames[0];
    let fps = options.defaultFps;
    if (firstFrame && firstFrame.delay !== undefined && firstFrame.delay > 0) {
      const originalFps = Math.round(1000 / firstFrame.delay);
      fps = Math.max(2, Math.min(120, originalFps));
    }
    fps += 2; // 你原本的逻辑

    // GIF 尺寸
    let maxRight = 0;
    let maxBottom = 0;
    frames.forEach((frame: any) => {
      if (frame.dims) {
        maxRight = Math.max(maxRight, frame.dims.left + frame.dims.width);
        maxBottom = Math.max(maxBottom, frame.dims.top + frame.dims.height);
      }
    });
    const gifWidth = maxRight || frames[0]?.dims?.width || 100;
    const gifHeight = maxBottom || frames[0]?.dims?.height || 100;

    // 累积canvas
    const accumulatedCanvas = document.createElement("canvas");
    accumulatedCanvas.width = gifWidth;
    accumulatedCanvas.height = gifHeight;
    const accumulatedCtx = accumulatedCanvas.getContext("2d")!;
    accumulatedCtx.clearRect(0, 0, gifWidth, gifHeight);

    // 输出canvas
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = options.targetWidth;
    outputCanvas.height = options.targetHeight;
    const outputCtx = outputCanvas.getContext("2d")!;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      // disposal
      if (i > 0) {
        const prevFrame = frames[i - 1];
        if (prevFrame.disposalType === 2) {
          accumulatedCtx.clearRect(
            prevFrame.dims.left,
            prevFrame.dims.top,
            prevFrame.dims.width,
            prevFrame.dims.height
          );
        }
      }

      if (!frame.patch || frame.patch.length === 0) continue;

      // 当前帧
      const frameImageData = new ImageData(
        new Uint8ClampedArray(frame.patch),
        frame.dims.width,
        frame.dims.height
      );
      const frameCanvas = document.createElement("canvas");
      frameCanvas.width = frame.dims.width;
      frameCanvas.height = frame.dims.height;
      const frameCtx = frameCanvas.getContext("2d")!;
      frameCtx.putImageData(frameImageData, 0, 0);

      accumulatedCtx.drawImage(frameCanvas, frame.dims.left, frame.dims.top);

      // 缩放
      const scale = Math.min(
        options.targetWidth / gifWidth,
        options.targetHeight / gifHeight
      );
      const scaledWidth = gifWidth * scale;
      const scaledHeight = gifHeight * scale;
      const offsetX = (options.targetWidth - scaledWidth) / 2;
      const offsetY = (options.targetHeight - scaledHeight) / 2;

      // 清理输出
      outputCtx.clearRect(0, 0, options.targetWidth, options.targetHeight);

      // Step 1: 绘制图像（始终变换）
      outputCtx.save();
      const cx = options.targetWidth / 2;
      const cy = options.targetHeight / 2;
      outputCtx.translate(cx, cy);
      if (editState) {
        outputCtx.rotate((editState.rotation * Math.PI) / 180);
        outputCtx.scale(
          (editState.scale / 100) * (editState.flipX ? -1 : 1),
          (editState.scale / 100) * (editState.flipY ? -1 : 1)
        );
      }
      outputCtx.drawImage(
        accumulatedCanvas,
        -cx + offsetX,
        -cy + offsetY,
        scaledWidth,
        scaledHeight
      );
      outputCtx.restore();

      // Step 2: 滤镜
      if (editState) {
        const imageData = outputCtx.getImageData(
          0,
          0,
          options.targetWidth,
          options.targetHeight
        );
        const data = imageData.data;
        for (let j = 0; j < data.length; j += 4) {
          const alpha = data[j + 3];
          if (alpha === 0) continue;
          let r = data[j],
            g = data[j + 1],
            b = data[j + 2];
          [r, g, b] = applyHueRotateMatrix(r, g, b, editState.hue);
          const brightnessFactor = editState.brightness / 100;
          r *= brightnessFactor;
          g *= brightnessFactor;
          b *= brightnessFactor;
          const contrastFactor = editState.contrast / 100;
          r = (r - 128) * contrastFactor + 128;
          g = (g - 128) * contrastFactor + 128;
          b = (b - 128) * contrastFactor + 128;
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const saturationFactor = editState.saturation / 100;
          r = gray + (r - gray) * saturationFactor;
          g = gray + (g - gray) * saturationFactor;
          b = gray + (b - gray) * saturationFactor;
          data[j] = Math.max(0, Math.min(255, r));
          data[j + 1] = Math.max(0, Math.min(255, g));
          data[j + 2] = Math.max(0, Math.min(255, b));
        }
        outputCtx.putImageData(imageData, 0, 0);
      }

      // Step 3: 文字和绘画（是否跟随 isHue）
      if (editState) {
        const isHue = editState.isHue === 1;
        if (isHue) {
          outputCtx.save();
          outputCtx.translate(options.targetWidth / 2, options.targetHeight / 2);
          outputCtx.rotate((editState.rotation * Math.PI) / 180);
          outputCtx.scale(
            (editState.scale / 100) * (editState.flipX ? -1 : 1),
            (editState.scale / 100) * (editState.flipY ? -1 : 1)
          );
          drawTextsAndDrawings(
            outputCtx,
            editState,
            -options.targetWidth / 2,
            -options.targetHeight / 2
          );
          outputCtx.restore();
        } else {
          drawTextsAndDrawings(outputCtx, editState, 0, 0);
        }
      }

      // 保存 PNG
      const pngBase64 = outputCanvas
        .toDataURL("image/png")
        .split(",")[1];
      const pngBuffer = Uint8Array.from(atob(pngBase64), (c) =>
        c.charCodeAt(0)
      );
      await fs.writeFile(`input_${i}.png`, pngBuffer);
    }

    return { frameCount, fps };
  } catch (error) {
    console.error("GIF处理失败:", error);
    throw error;
  }
}

// 压缩为QGIF
async function compressToQgif(qgifModule: any, frameCount: number, fps: number): Promise<Uint8Array> {
  try {
    const compress_video = qgifModule.cwrap(
      "compress_video_wasm",
      "number",
      ["string", "string", "number", "number"]
    );

    console.log(`compressToQgif 压缩视频: ${frameCount} 帧, ${fps} fps`);
    // 固定使用类型0和30fps
    const type = 0;
    const attempts = [
      () => compress_video("input_X.png", "output.qgif", type, fps),
      () => compress_video("/input_X.png", "/output.qgif", type, fps),
      () => compress_video("input_X.png", "output.qgif", type, fps),
      () => compress_video("/input_X.png", "/output.qgif", type, fps)
    ];

    let lastError: any;
    for (let i = 0; i < attempts.length; i++) {
      try {
        console.log(`尝试压缩方式 ${i + 1}/${attempts.length}`);
        const result = attempts[i]();
        console.log(`压缩返回值: ${result}`);

        let qgifBin: Uint8Array;
        try {
          qgifBin = qgifModule.FS.readFile("output.qgif");
        } catch {
          qgifBin = qgifModule.FS.readFile("/output.qgif");
        }

        if (qgifBin && qgifBin.length > 0) {
          console.log(`压缩成功，QGIF大小: ${qgifBin.length} bytes`);
          return qgifBin;
        }
      } catch (error) {
        lastError = error;
        console.warn(`压缩尝试 ${i + 1} 失败:`, error);
      }
    }

    throw new Error(`所有压缩尝试都失败: ${lastError?.message || lastError}`);
  } catch (error) {
    console.error('压缩为QGIF失败:', error);
    throw error;
  }
}

// 下载QGIF数据到设备的函数
async function downloadQgifToDevice(
  qgifData: Uint8Array[],
  deviceComm: any,
  onProgress: (progress: TransferProgress) => void,
  t: (key: string) => string,
) {
  if (!deviceComm) {
    throw new Error('设备未连接');
  }

  // 第一步：初始化通信
  onProgress({
    status: TransferStatus.INITIALIZING,
    currentScreen: 0,
    totalScreens: qgifData.length,
    bytesTransferred: 0,
    totalBytes: qgifData.reduce((sum, data) => sum + data.length, 0),
    percentage: 0,
    message: t('170')
  });

  // const initBuffer = new Uint8Array(65);
  // initBuffer[1] = 0xAA;
  // initBuffer[2] = 0x10;
  // await deviceComm.setData(Array.from(initBuffer));


  const Buffer2 = new Uint8Array(65);
  Buffer2[1] = 0xAA;
  Buffer2[2] = 0x14;
  Buffer2[6] = 0x38;
  await deviceComm.setData(Array.from(Buffer2));

  onProgress({
    status: TransferStatus.PREPARING,
    currentScreen: 0,
    totalScreens: qgifData.length,
    bytesTransferred: 0,
    totalBytes: qgifData.reduce((sum, data) => sum + data.length, 0),
    percentage: 10,
    message: t('171')
  });

  const totalSize = qgifData.reduce((sum, data) => sum + data.length, 0);
  const flashBlocks = qgifData.reduce((sum, data) => sum + Math.ceil(data.length / (64 * 1024)), 0);

  const metaByte = encodeLcdImageMetaByte({
    imageSlotCount: Math.min(qgifData.length, 4),
    animType: 0,
    intervalCode: 0,
  });
  const logical15 = buildWorkParamLogical15(
    0,
    qgifData.length,
    flashBlocks,
    qgifData.map((d) => ({ metaByte, type: 0 as const, size: d.length })),
  );
  await sendScreenWorkParam15Packets(deviceComm, logical15);

  const completeBuffer = new Uint8Array(65);
  completeBuffer[1] = 0xAA;
  completeBuffer[2] = 0x16;
  completeBuffer[6] = 0x38;
  await deviceComm.setData(Array.from(completeBuffer));

  onProgress({
    status: TransferStatus.ERASING,
    currentScreen: 0,
    totalScreens: qgifData.length,
    bytesTransferred: 0,
    totalBytes: qgifData.reduce((sum, data) => sum + data.length, 0),
    percentage: 20,
    message: t('172')
  });

  await sendLcdEraseAndWait(deviceComm, flashBlocks, LCD_ERASE_ISLAND_PERSONAL);

  let totalBytesTransferred = 0;
  for (let screenIndex = 0; screenIndex < qgifData.length; screenIndex++) {
    const data = qgifData[screenIndex];
    let currentAddress = 0;

    for (let i = 0; i < screenIndex; i++) {
      currentAddress += Math.ceil(qgifData[i].length / (64 * 1024)) * (64 * 1024);
    }

    onProgress({
      status: TransferStatus.TRANSFERRING,
      currentScreen: screenIndex + 1,
      totalScreens: qgifData.length,
      bytesTransferred: totalBytesTransferred,
      totalBytes: qgifData.reduce((sum, data) => sum + data.length, 0),
      percentage: Math.round((totalBytesTransferred / totalSize) * 100),
      message: `${t('173')} ${screenIndex + 1} ${t('174')}`
    });

    const step = 56;
    for (let i = 0; i < data.length; i += step) {
      const writeBuffer = new Uint8Array(65);
      writeBuffer[1] = 0xAA;
      writeBuffer[2] = 0x19;

      writeBuffer[3] = currentAddress & 0xff;
      writeBuffer[4] = (currentAddress >> 8) & 0xff;
      writeBuffer[5] = (currentAddress >> 16) & 0xff;

      const bytesToSend = Math.min(step, data.length - i);
      writeBuffer[6] = bytesToSend;
      writeBuffer[7] = LCD_ERASE_ISLAND_PERSONAL;

      writeBuffer.set(data.slice(i, i + bytesToSend), 9);

      await deviceComm.setData(Array.from(writeBuffer));
      await settleBetweenLcd19Packets();

      currentAddress += bytesToSend;
      totalBytesTransferred += bytesToSend;

      onProgress({
        status: TransferStatus.TRANSFERRING,
        currentScreen: screenIndex + 1,
        totalScreens: qgifData.length,
        bytesTransferred: totalBytesTransferred,
        totalBytes: totalSize,
        percentage: Math.round((totalBytesTransferred / totalSize) * 100),
        message: `${t('173')} ${screenIndex + 1} ${t('174')} ${Math.round((totalBytesTransferred / totalSize) * 100)}%`
      });
    }
  }

  onProgress({
    status: TransferStatus.FINALIZING,
    currentScreen: qgifData.length,
    totalScreens: qgifData.length,
    bytesTransferred: totalBytesTransferred,
    totalBytes: totalSize,
    percentage: 100,
    message: t('175')
  });


  const resetBuffer = new Uint8Array(65);
  resetBuffer[1] = 0xAA;
  resetBuffer[2] = 0x1A;
  await deviceComm.setData(Array.from(resetBuffer));

  await deviceComm.syncTime();
  const endBuffer = new Uint8Array(65);
  endBuffer[1] = 0xAA;
  endBuffer[2] = 0x11;
  await deviceComm.setData(Array.from(endBuffer));

  onProgress({
    status: TransferStatus.COMPLETED,
    currentScreen: qgifData.length,
    totalScreens: qgifData.length,
    bytesTransferred: totalBytesTransferred,
    totalBytes: totalSize,
    percentage: 100,
    message: t('176')
  });
}

export function useGifConverter({
  gifFiles,
  qgifModule,
  deviceComm,
  onProgressUpdate,
  onProcessingChange,
  onResultsUpdate,
  screenWidth,
  screenHeight,
  t,
  lcdScreenMaxGifs
}: GifConverterProps) {
  const toast = useToast();
    const { showMessage,showDialog } = useSnackbarDialog()
  const convertAndDownloadGifs = async () => {
    if (!qgifModule || !window.gifuct) {
      showMessage({
        title: t('180'),
        message: t('181'),
        type: 'error'
      });
      return;
    }

    if (gifFiles.every(f => !f)) {
      showMessage({
        title: t('182'),
        message: t('183'),
        type: 'warning'
      });
      return;
    }

    onProcessingChange(true);
    onProgressUpdate({
      status: TransferStatus.IDLE,
      currentScreen: 0,
      totalScreens: gifFiles.length,
      bytesTransferred: 0,
      totalBytes: 0,
      percentage: 0,
      message: t('184')
    });

    try {
      // 开始下发
      const startDownLoad = new Uint8Array(65);
      startDownLoad[1] = 0xAA;
      startDownLoad[2] = 0x1B;
      startDownLoad[6] = 0x38;
      await deviceComm.setData(Array.from(startDownLoad));

      // 收集已应用的编辑状态
      const appliedEditStates: (GifEditState | null)[] = [];
      for (let i = 0; i < gifFiles.length; i++) {
        const appliedEditKey = `applied_edit_${i}`;
        const savedEditState = sessionStorage.getItem(appliedEditKey);
        if (savedEditState) {
          try {
            appliedEditStates[i] = JSON.parse(savedEditState);
            console.log(`屏幕 ${i + 1} 应用编辑状态:`, appliedEditStates[i]);
          } catch (e) {
            console.warn(`解析屏幕 ${i + 1} 编辑状态失败:`, e);
            appliedEditStates[i] = null;
            const startDownLoad = new Uint8Array(65);
            startDownLoad[1] = 0xAA;
            startDownLoad[2] = 0x1A;
            startDownLoad[6] = 0x38;
            await deviceComm.setData(Array.from(startDownLoad));
          }
        } else {
          appliedEditStates[i] = null;
        }
      }

      // 转换每个GIF文件为QGIF
      const results: GifConversionResult[] = [];
      for (let i = 0; i < gifFiles.length; i++) {
        const file = gifFiles[i];
        if (!file) {
          console.log(`屏幕 ${i + 1} 没有GIF文件，跳过`);
          results.push({
            qgifBin: new Uint8Array(0),
            size: 0,
            frameCount: 0,
            fps: 0,
            screenIndex: i
          });
          continue;
        }

        onProgressUpdate({
          status: TransferStatus.IDLE,
          currentScreen: i,
          totalScreens: gifFiles.length,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: Math.round((i / gifFiles.length) * 100),
          message: `${t('185')} ${i + 1} ${t('186')}`
        });

        try {
          console.log(`开始处理屏幕 ${i + 1} 的GIF: ${file.name}`);

          const buffer = await file.arrayBuffer();
          const gifData = new Uint8Array(buffer);
          console.log(`文件读取完成，大小: ${gifData.length} bytes`);

          await cleanupWasmFiles(qgifModule);
          await tryExtendWasmMemory(qgifModule);

          const editState = appliedEditStates[i];
          if (editState) {
            console.log(`应用编辑效果到屏幕 ${i + 1}:`, editState);
          }
          const gif = window.gifuct.parseGIF(gifData);
          const frames = window.gifuct.decompressFrames(gif, true);
          console.log(frames);

          const result = await decomposeGifToPngs(gifData, qgifModule.FS, {
            targetWidth: screenWidth,  // 固定宽度
            targetHeight: screenHeight, // 固定高度
            defaultFps: 20     // 默认帧率（如果无法检测到）
          }, editState || undefined, t);

          const frameCount2 = result.frameCount;
          const dynamicFps = result.fps;

          console.log(`GIF分解完成，共${frameCount2}帧，动态帧率: ${dynamicFps} FPS`);

          const qgifBin = await compressToQgif(qgifModule, frameCount2, dynamicFps);  // 使用动态帧率

          console.log(`屏幕 ${i + 1} QGIF数据:`, {
            size: qgifBin.length,
            frameCount: frameCount2,
            fps: dynamicFps,  // 动态帧率
            hexPreview: Array.from(qgifBin.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ') + ' ...'
          });
          const delays = frames.map((f: any) => f.delay || 10); // delay 单位为 1/100 s，默认10即0.1s
          const avgDelay = delays.reduce((a: number, b: number) => a + b, 0) / delays.length;
          const fps = avgDelay > 0 ? Math.round(100 / avgDelay) : 10; // 1秒内帧数
          console.log(fps, avgDelay);

          results.push({
            qgifBin,
            size: qgifBin.length,
            frameCount: frameCount2,
            fps: dynamicFps,  // 动态帧率
            screenIndex: i
          });

        } catch (error) {
          console.error(`处理屏幕 ${i + 1} 的GIF失败:`, error);
          throw error;
        }
      }

      console.log('所有GIF转换结果:', results.map(r => ({
        screen: r.screenIndex + 1,
        size: r.size,
        frameCount: r.frameCount,
        fps: r.fps
      })));

      onResultsUpdate(results);

      // 下载QGIF文件到本地，调试使用，不需要了
      const validResults = results.filter(r => r.qgifBin.length > 0);
      // if (validResults.length > 0) {
      //   // 为每个有效的QGIF文件创建下载链接
      //   validResults.forEach((result, index) => {
      //     const blob = new Blob([result.qgifBin], { type: 'application/octet-stream' });
      //     const url = URL.createObjectURL(blob);
      //     const a = document.createElement('a');
      //     a.href = url;
      //     a.download = `screen_${result.screenIndex + 1}_output.qgif`;
      //     a.style.display = 'none';
      //     document.body.appendChild(a);
      //     a.click();
      //     document.body.removeChild(a);
      //     URL.revokeObjectURL(url);
      //     console.log(`已下载屏幕${result.screenIndex + 1}的QGIF文件: ${result.size} bytes`);
      //   });

      //   toast({ 
      //     title: '文件已下载', 
      //     description: `已下载${validResults.length}个QGIF文件到本地`, 
      //     status: 'info' 
      //   });
      // }

      // 转换完成后自动下载到设备
      if (validResults.length > 0 && deviceComm) {
        onProgressUpdate({
          status: TransferStatus.PREPARING,
          currentScreen: 0,
          totalScreens: results.length,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: 100,
          message: t('187')
        });

        // 提取QGIF数据数组，只包含有效数据
        const qgifDataArray = validResults.map(r => r.qgifBin);

        console.log(`准备下载到设备: ${qgifDataArray.length} 个有效QGIF文件`);
        lcdScreenMaxGifs(qgifDataArray.length)
        lcdScreenMaxGifs(qgifDataArray.length)
        // 调用下载到设备功能
        await downloadQgifToDevice(qgifDataArray, deviceComm, onProgressUpdate, t,);

        showMessage({
          title: t('188'),
          message: `${t('189')} ${validResults.length} ${t('190')}`,
          type: 'success'
        });
      } else if (validResults.length > 0) {
        onProgressUpdate({
          status: TransferStatus.COMPLETED,
          currentScreen: results.length,
          totalScreens: results.length,
          bytesTransferred: 0,
          totalBytes: 0,
          percentage: 100,
          message: t('191')
        });

        showMessage({
          title: t('192'),
          message: `${t('193')} ${validResults.length} ${t('194')}`,
          type: 'warning'
        });
      } else {
      }

    } catch (error) {
      console.error('GIF转换失败:', error);
      onProgressUpdate({
        status: TransferStatus.ERROR,
        currentScreen: 0,
        totalScreens: gifFiles.length,
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        message: '转换失败',
        error: error instanceof Error ? error.message : '未知错误'
      });
      showMessage({
        title: '转换失败',
        message: error instanceof Error ? error.message : '未知错误',
        type: 'error'
      });
    } finally {
      onProcessingChange(false);
    }
  };

  const downloadToDevice = async (qgifData: Uint8Array[]) => {
    if (!deviceComm) {
      showMessage({
        title: '设备未连接',
        message: '请确保设备已连接',
        type: 'error'
      });
      return;
    }

    // 过滤掉空数据，只传输有效的QGIF文件
    const validQgifData = qgifData.filter(data => data.length > 0);

    if (validQgifData.length === 0) {
      showMessage({
        title: '没有数据',
        message: '没有有效的QGIF数据需要传输',
        type: 'warning'
      });
      return;
    }

    console.log(`准备下载到设备: ${validQgifData.length} 个有效QGIF文件`);

    onProcessingChange(true);

    try {
      await downloadQgifToDevice(validQgifData, deviceComm, onProgressUpdate, t,);

      showMessage({
        title: t('188'),
        message: `${t('189')} ${validQgifData.length} ${t('190')}`,
        type: 'success'
      });
    } catch (error) {
      console.error('下载到设备失败:', error);
      onProgressUpdate({
        status: TransferStatus.ERROR,
        currentScreen: 0,
        totalScreens: validQgifData.length,
        bytesTransferred: 0,
        totalBytes: 0,
        percentage: 0,
        message: t('194'),
        error: error instanceof Error ? error.message : '未知错误'
      });
      showMessage({
        title: t('194'),
        message: error instanceof Error ? error.message : '未知错误',
        type: 'error'
      });
    } finally {
      onProcessingChange(false);
    }
  };

  return { convertAndDownloadGifs, downloadToDevice };
} 