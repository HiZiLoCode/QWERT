import { GifWriter } from "omggif";
import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";

/**
 * 灵动岛媒体上限（与固件预留 FLASH 对齐）：源 GIF 导入、以及 GIF→QGIF 后写入 0x19 的实际载荷，
 * 超过易导致末尾花屏。
 */
export const GIF_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;

function buildGlobalPalette256(): number[] {
  const pal: number[] = new Array(256).fill(0);
  let idx = 0;
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        pal[idx++] = (r * 51) << 16 | (g * 51) << 8 | (b * 51);
      }
    }
  }
  pal[255] = 0x010101;
  return pal;
}

const TRANSPARENT_IDX = 255;

function rgbaToIndexedWeb216(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    if (rgba[i + 3] < 128) {
      out[p] = TRANSPARENT_IDX;
    } else {
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const ri = Math.min(5, Math.round((r / 255) * 5));
      const gi = Math.min(5, Math.round((g / 255) * 5));
      const bi = Math.min(5, Math.round((b / 255) * 5));
      out[p] = ri * 36 + gi * 6 + bi;
    }
  }
  return out;
}

function delayMsToCs(ms: number): number {
  return Math.max(2, Math.min(65535, Math.round(ms / 10)));
}

function tryEncodeGif(
  sourceFrames: ParsedFrame[],
  gifW: number,
  gifH: number,
  frameCount: number,
  scale: number,
  outBuf: Uint8Array,
): number | null {
  const scaledW = Math.max(2, Math.round(gifW * scale));
  const scaledH = Math.max(2, Math.round(gifH * scale));
  const palette = buildGlobalPalette256();

  const accCanvas = document.createElement("canvas");
  accCanvas.width = gifW;
  accCanvas.height = gifH;
  const accCtx = accCanvas.getContext("2d");
  if (!accCtx) return null;

  const frameCanvas = document.createElement("canvas");
  const outCanvas = document.createElement("canvas");
  outCanvas.width = scaledW;
  outCanvas.height = scaledH;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) return null;

  let gw: {
    addFrame: (
      x: number,
      y: number,
      w: number,
      h: number,
      indexed: Uint8Array,
      opts: { delay: number; transparent?: number; disposal?: number },
    ) => void;
    end: () => void;
    getOutputBufferPosition: () => number;
  };
  try {
    gw = new GifWriter(outBuf, scaledW, scaledH, { loop: 0, palette }) as typeof gw;
  } catch {
    return null;
  }

  const effective = sourceFrames.slice(0, Math.min(frameCount, sourceFrames.length));
  let wrote = 0;

  try {
    for (let i = 0; i < effective.length; i++) {
      const frame = effective[i];
      if (i > 0) {
        const prev = effective[i - 1];
        if (prev.disposalType === 2) {
          accCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
        }
      }
      if (frame.patch?.length) {
        frameCanvas.width = frame.dims.width;
        frameCanvas.height = frame.dims.height;
        const fctx = frameCanvas.getContext("2d");
        if (!fctx) continue;
        fctx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height), 0, 0);
        accCtx.drawImage(frameCanvas, frame.dims.left, frame.dims.top);
      }

      outCtx.clearRect(0, 0, scaledW, scaledH);
      outCtx.drawImage(accCanvas, 0, 0, gifW, gifH, 0, 0, scaledW, scaledH);
      const imageData = outCtx.getImageData(0, 0, scaledW, scaledH);
      const indexed = rgbaToIndexedWeb216(imageData.data, scaledW, scaledH);
      const delayCs = delayMsToCs(frame.delay ?? 100);

      gw.addFrame(0, 0, scaledW, scaledH, indexed, {
        delay: delayCs,
        transparent: TRANSPARENT_IDX,
        disposal: 1,
      });
      wrote++;
    }
  } catch {
    return null;
  }

  if (!wrote) return null;

  try {
    gw.end();
  } catch {
    return null;
  }

  const endPos = gw.getOutputBufferPosition();
  return endPos;
}

/**
 * 将 GIF 重新编码为不超过 `maxBytes` 的二进制（全局 Web 216 调色板 + 必要时减帧 / 缩小画布）。
 * 仅在浏览器主线程可用（依赖 Canvas）。
 */
export async function shrinkGifArrayBufferToLimit(
  gifBuffer: ArrayBuffer,
  maxBytes: number,
  maxSourceFrames: number,
): Promise<ArrayBuffer | null> {
  let parsed: ReturnType<typeof parseGIF>;
  let sourceFrames: ParsedFrame[];
  try {
    parsed = parseGIF(gifBuffer);
    sourceFrames = decompressFrames(parsed, true) as ParsedFrame[];
  } catch {
    return null;
  }
  if (!sourceFrames.length) return null;

  const gifW = parsed.lsd.width;
  const gifH = parsed.lsd.height;
  const total = Math.min(sourceFrames.length, maxSourceFrames);
  if (total < 1) return null;

  const tryOnce = (frameCount: number, scale: number): number | null => {
    const est = Math.min(48 * 1024 * 1024, Math.max(maxBytes * 6, frameCount * (gifW * gifH * scale * scale * 2 + 4096)));
    const outBuf = new Uint8Array(est);
    return tryEncodeGif(sourceFrames, gifW, gifH, frameCount, scale, outBuf);
  };

  const fits = (len: number | null): boolean => len != null && len <= maxBytes;

  let scale = 1;
  for (let attempt = 0; attempt < 24; attempt++) {
    let lo = 1;
    let hi = total;
    let bestLen: number | null = null;
    let bestFrames = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const len = tryOnce(mid, scale);
      if (fits(len)) {
        bestLen = len;
        bestFrames = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestLen != null && bestFrames > 0) {
      const est = Math.min(48 * 1024 * 1024, Math.max(maxBytes * 6, bestFrames * (gifW * gifH * scale * scale * 2 + 4096)));
      const outBuf = new Uint8Array(est);
      const finalLen = tryEncodeGif(sourceFrames, gifW, gifH, bestFrames, scale, outBuf);
      if (finalLen != null && fits(finalLen)) {
        return outBuf.slice(0, finalLen).buffer;
      }
    }

    scale *= 0.88;
    if (scale < 0.18) break;
    await new Promise<void>((r) => {
      window.requestAnimationFrame(() => r());
    });
  }

  return null;
}
