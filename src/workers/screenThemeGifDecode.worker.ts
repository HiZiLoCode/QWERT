/// <reference lib="webworker" />

import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";

type DecomposePayload = {
  dataUrl: string;
  targetWidth: number;
  targetHeight: number;
  rotate: number;
  frameLimit?: number;
  maxGifFrames: number;
  maxDataUrlBytes: number;
  maxDecodeBudgetBytes: number;
  maxSourceSide: number;
};

type WorkerReq = {
  id: number;
  type: "decompose";
  payload: DecomposePayload;
};

type WorkerOk = {
  id: number;
  ok: true;
  fpsFromGif: number;
  frames: ArrayBuffer[];
};

type WorkerErr = {
  id: number;
  ok: false;
  error: string;
};

type WorkerRes = WorkerOk | WorkerErr;

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  const meta = comma >= 0 ? dataUrl.slice(0, comma) : "data:application/octet-stream;base64";
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const mime = /^data:([^;]+);base64$/i.exec(meta)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function canvasToPngBytes(canvas: OffscreenCanvas): Promise<Uint8Array> {
  const blob = await canvas.convertToBlob({ type: "image/png" });
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}

function drawLetterboxed(
  outCtx: OffscreenCanvasRenderingContext2D,
  source: OffscreenCanvas | ImageBitmap,
  sourceW: number,
  sourceH: number,
  targetWidth: number,
  targetHeight: number,
  rotate: number,
) {
  const needsRotate = rotate === 1 || rotate === 3;
  const outW = needsRotate ? targetHeight : targetWidth;
  const outH = needsRotate ? targetWidth : targetHeight;
  const scale = Math.min(targetWidth / sourceW, targetHeight / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const offsetX = (targetWidth - drawW) / 2;
  const offsetY = (targetHeight - drawH) / 2;

  outCtx.clearRect(0, 0, outW, outH);
  outCtx.save();
  if (needsRotate) {
    outCtx.translate(outW / 2, outH / 2);
    const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
    outCtx.rotate(rotationAngle);
    outCtx.drawImage(source, -targetWidth / 2 + offsetX, -targetHeight / 2 + offsetY, drawW, drawH);
  } else {
    outCtx.drawImage(source, offsetX, offsetY, drawW, drawH);
  }
  outCtx.restore();
}

async function decompose(payload: DecomposePayload): Promise<WorkerOk> {
  if (estimateDataUrlBytes(payload.dataUrl) > payload.maxDataUrlBytes) {
    throw new Error("GIF_INPUT_TOO_LARGE");
  }
  const targetWidth = Math.max(1, payload.targetWidth | 0);
  const targetHeight = Math.max(1, payload.targetHeight | 0);
  const rotate = Number(payload.rotate) || 0;

  if (/^data:image\/(png|jpe?g|webp)/i.test(payload.dataUrl)) {
    const bitmap = await createImageBitmap(dataUrlToBlob(payload.dataUrl));
    try {
      const outCanvas = new OffscreenCanvas(rotate === 1 || rotate === 3 ? targetHeight : targetWidth, rotate === 1 || rotate === 3 ? targetWidth : targetHeight);
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) throw new Error("GIF_PNG_CONVERT_FAILED");
      drawLetterboxed(outCtx, bitmap, Math.max(1, bitmap.width), Math.max(1, bitmap.height), targetWidth, targetHeight, rotate);
      const png = await canvasToPngBytes(outCanvas);
      return { id: -1, ok: true, frames: [png.buffer], fpsFromGif: 30 };
    } finally {
      bitmap.close();
    }
  }

  const gifData = dataUrlToUint8Array(payload.dataUrl);
  const gifBuffer = gifData.buffer.slice(gifData.byteOffset, gifData.byteOffset + gifData.byteLength) as ArrayBuffer;
  const gif = parseGIF(gifBuffer);
  const gifW = Math.max(1, gif.lsd.width);
  const gifH = Math.max(1, gif.lsd.height);
  const frameCountHint = Array.isArray((gif as { frames?: unknown[] }).frames)
    ? (gif as { frames: unknown[] }).frames.length
    : payload.maxGifFrames;
  const decodeFrames = Math.max(
    1,
    Math.min(payload.frameLimit && payload.frameLimit > 0 ? payload.frameLimit : payload.maxGifFrames, frameCountHint || payload.maxGifFrames),
  );
  const estimatedDecodeBytes = gifW * gifH * 4 * decodeFrames;
  if (Math.max(gifW, gifH) > payload.maxSourceSide || estimatedDecodeBytes > payload.maxDecodeBudgetBytes) {
    throw new Error("GIF_DECODE_BUDGET_EXCEEDED");
  }

  const frames = decompressFrames(gif, true) as ParsedFrame[];
  const effectiveFrames =
    payload.frameLimit && payload.frameLimit > 0 ? frames.slice(0, Math.min(payload.frameLimit, frames.length)) : frames;
  if (!effectiveFrames.length) throw new Error("GIF_NO_VALID_FRAMES");

  const firstDelay = Math.max(effectiveFrames[0]?.delay ?? 100, 1);
  const fpsFromGif = Math.max(2, Math.min(120, Math.round(1000 / firstDelay)));

  const accCanvas = new OffscreenCanvas(gifW, gifH);
  const accCtx = accCanvas.getContext("2d");
  if (!accCtx) throw new Error("GIF_CANNOT_CREATE_ACC_CANVAS");
  const frameCanvas = new OffscreenCanvas(1, 1);
  const outCanvas = new OffscreenCanvas(rotate === 1 || rotate === 3 ? targetHeight : targetWidth, rotate === 1 || rotate === 3 ? targetWidth : targetHeight);
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("GIF_CANNOT_CREATE_OUTPUT_CANVAS");

  const pngFrames: ArrayBuffer[] = [];
  for (let i = 0; i < effectiveFrames.length; i++) {
    const frame = effectiveFrames[i];
    if (i > 0) {
      const prev = effectiveFrames[i - 1];
      if (prev.disposalType === 2) {
        accCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
      }
    }
    if (!frame.patch?.length) continue;
    frameCanvas.width = frame.dims.width;
    frameCanvas.height = frame.dims.height;
    const fctx = frameCanvas.getContext("2d");
    if (!fctx) continue;
    fctx.putImageData(new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height), 0, 0);
    accCtx.drawImage(frameCanvas, frame.dims.left, frame.dims.top);

    drawLetterboxed(outCtx, accCanvas, gifW, gifH, targetWidth, targetHeight, rotate);
    const png = await canvasToPngBytes(outCanvas);
    pngFrames.push(png.buffer);
  }

  if (!pngFrames.length) throw new Error("GIF_PNG_CONVERT_FAILED");
  return { id: -1, ok: true, frames: pngFrames, fpsFromGif };
}

self.onmessage = async (ev: MessageEvent<WorkerReq>) => {
  const req = ev.data;
  if (!req || req.type !== "decompose") return;
  try {
    const out = await decompose(req.payload);
    const res: WorkerRes = { id: req.id, ok: true, fpsFromGif: out.fpsFromGif, frames: out.frames };
    self.postMessage(res, out.frames);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? "GIF_WORKER_UNKNOWN_ERROR");
    const res: WorkerRes = { id: req.id, ok: false, error: msg };
    self.postMessage(res);
  }
};
