"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Divider } from "@mui/material";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import { MainContext } from "@/providers/MainProvider";
import { useSnackbarDialog } from "@/providers/useSnackbarProvider";
import TravelVirtualKeyboard from "@/components/TravelVirtualKeyboard";
import ScreenThemeSidebar from "./ScreenThemeSidebar";
import ScreenThemeTopBar from "./ScreenThemeTopBar";
import ScreenThemeImportPanel from "./ScreenThemeImportPanel";
import ScreenThemePreview from "./ScreenThemePreview";
import ScreenThemeSettingsPanel from "./ScreenThemeSettingsPanel";
import ScreenThemeImageSettingsPanel from "./ScreenThemeImageSettingsPanel";
import ScreenThemeVideoSettingsPanel from "./ScreenThemeVideoSettingsPanel";
import ScreenThemeTypingPanel from "./ScreenThemeTypingPanel";
import ScreenThemeKeyboardLegend from "./ScreenThemeKeyboardLegend";
import ScreenThemeThemeColorPanel from "./ScreenThemeThemeColorPanel";
import ScreenThemeThemeColorPreview from "./ScreenThemeThemeColorPreview";
import type { ImportSource, ScreenThemeTab, TransitionKind } from "./types";
import { findLeftShiftKeyIndex } from "./screenThemeLayout";
import type { LayoutKey } from "@/types/types_v1";
import { getFileById, saveFile } from "@/utils/indexeddb-storage";
import { countGifFrames, isGifFile } from "@/utils/gifFrameCount";
import { useTranslation } from "@/app/i18n";
import { decompressFrames, parseGIF, type ParsedFrame } from "gifuct-js";
import { getScreenThemeGifPlaybackFps, isNativeGifPlaybackSpeed } from "./screenThemeGifPlaybackFps";
import {
  buildDualIslandWorkLogical15FromReadPatch,
  encodeLcdImageMetaByte,
  lcdEraseIslandModeFromMediaIsland,
  readLcdWorkParam14,
  sendLcdEraseAndWait,
  settleBetweenLcd19Packets,
  type LcdScreenTransferMeta,
  secondsToLcdIntervalCode,
  sendScreenWorkParam15Packets,
  transitionKindToLcdAnimType,
  W15_LOGICAL_MAX,
} from "./lcdIslandProtocol";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatScreenTime(d: Date) {
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

type MediaAsset = {
  name: string;
  dataUrl: string;
};

/** 单套灵动岛（基础 / 个性化）在内存与 IDB 中的媒体草稿，两套 state 完全独立 */
type IslandMediaDraft = {
  imageAsset: MediaAsset | null;
  albumAssets: MediaAsset[];
  albumIndex: number;
  videoAsset: MediaAsset | null;
  videoSpeed: string;
};

function emptyIslandDraft(): IslandMediaDraft {
  return {
    imageAsset: null,
    albumAssets: [],
    albumIndex: 0,
    videoAsset: null,
    videoSpeed: "native",
  };
}

/** 基础灵动岛本地草稿（IndexedDB），与个性化不得共用同一 id */
const DB_ID_IMAGE = "screen-theme:basic:image";
const DB_ID_ALBUM = "screen-theme:basic:album";
const DB_ID_VIDEO = "screen-theme:basic:video";

/** 个性化灵动岛本地草稿（图片 / 相册 / 动图各自独立键） */
const DB_ID_IMAGE_PERSONAL = "screen-theme:personal:image";
const DB_ID_ALBUM_PERSONAL = "screen-theme:personal:album";
const DB_ID_VIDEO_PERSONAL = "screen-theme:personal:video";
const DB_ID_PERSONAL_THEME = "screen-theme:personal:themeColor";

type PersonalThemePalette = {
  theme: string;
  date: string;
  power: string;
  status: string;
};

const DEFAULT_PERSONAL_THEME_COLORS: PersonalThemePalette = {
  theme: "#0066ff",
  date: "#ff3b30",
  power: "#22c55e",
  status: "#2563eb",
};

const MAX_GIF_FRAMES = 200;
const MAX_ALBUM_FILES = 4;

function clampRgbByte(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHexOrFallback(r: unknown, g: unknown, b: unknown, fallback: string): string {
  const rr = clampRgbByte(r);
  const gg = clampRgbByte(g);
  const bb = clampRgbByte(b);
  if (rr == null || gg == null || bb == null) return fallback;
  return `#${rr.toString(16).padStart(2, "0")}${gg.toString(16).padStart(2, "0")}${bb.toString(16).padStart(2, "0")}`.toUpperCase();
}

function hexToRgbTuple(hex: string): [number, number, number] | null {
  const normalized = hex.trim().toUpperCase();
  const match = normalized.match(/^#([0-9A-F]{6})$/);
  if (!match) return null;
  const v = match[1];
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

const VIDEO_SPEED_ALLOWED = new Set(["native", "15", "30", "60", "typing"]);
const LEGACY_VIDEO_SPEED: Record<string, string> = {
  slow: "typing",
  normal: "30",
  fast: "60",
};

function normalizeVideoSpeed(raw: string | undefined): string {
  if (!raw) return "native";
  if (LEGACY_VIDEO_SPEED[raw]) return LEGACY_VIDEO_SPEED[raw];
  if (VIDEO_SPEED_ALLOWED.has(raw)) return raw;
  return "native";
}

async function loadIslandDraftFromIds(
  imageId: string,
  albumId: string,
  videoId: string,
): Promise<IslandMediaDraft> {
  const draft = emptyIslandDraft();
  const [img, album, video] = await Promise.all([
    getFileById(imageId),
    getFileById(albumId),
    getFileById(videoId),
  ]);

  if (img?.content) {
    try {
      const parsed = JSON.parse(img.content) as MediaAsset;
      if (parsed?.dataUrl) draft.imageAsset = parsed;
    } catch {
      /* keep null */
    }
  }

  if (album?.content) {
    try {
      const parsed = JSON.parse(album.content) as { items?: MediaAsset[]; index?: number };
      if (Array.isArray(parsed?.items)) {
        draft.albumAssets = parsed.items;
        draft.albumIndex = Math.max(0, Math.min(parsed.index ?? 0, parsed.items.length - 1));
      }
    } catch {
      /* keep empty */
    }
  }

  if (video?.content) {
    try {
      const parsed = JSON.parse(video.content) as MediaAsset & { speed?: string };
      if (parsed?.dataUrl) draft.videoAsset = { name: parsed.name, dataUrl: parsed.dataUrl };
      if (parsed?.speed) draft.videoSpeed = normalizeVideoSpeed(parsed.speed);
    } catch {
      /* keep null */
    }
  }

  return draft;
}

export default function ScreenThemePage() {
  const { keyboard, keyboardLayout, connectedKeyboard } = useContext(ConnectKbContext);
  const { deviceComm, screenWidth, screenHeight, screenInfo, qgifModule, setDownLoad } = useContext(MainContext);
  const { showMessage } = useSnackbarDialog();
  const { t } = useTranslation("common");

  const [activeTab, setActiveTab] = useState<ScreenThemeTab>("basic");
  const [activeSource, setActiveSource] = useState<ImportSource>("album");
  const [now, setNow] = useState(() => new Date());
  const [basicDraft, setBasicDraft] = useState<IslandMediaDraft>(() => emptyIslandDraft());
  const [personalDraft, setPersonalDraft] = useState<IslandMediaDraft>(() => emptyIslandDraft());
  /** 打字页无独立库：导入/预览仍落在最近一次进入的基础或个性草稿上 */
  const [typingEditIsland, setTypingEditIsland] = useState<"basic" | "personal">("basic");
  const [intervalSec, setIntervalSec] = useState("5");
  const [transition, setTransition] = useState<TransitionKind>("btt");
  const [personalThemeColors, setPersonalThemeColors] = useState<PersonalThemePalette>(DEFAULT_PERSONAL_THEME_COLORS);
  const [savingSource, setSavingSource] = useState<ImportSource | "image" | null>(null);
  const [fileName] = useState("XXXX.png");
  const [restored, setRestored] = useState(false);

  const layoutKeys = keyboard?.layoutKeys ?? [];
  const currentLayer = keyboard?.layer ?? 0;
  const userKeys = keyboard?.userKeys?.[currentLayer] ?? [];

  const mappedLayoutKeys = useMemo(
    () =>
      layoutKeys.map((k: LayoutKey, idx: number) => {
        const keyIndex = k.index ?? idx;
        return {
          ...k,
          name: userKeys?.[keyIndex]?.name || k.name || "",
        };
      }),
    [layoutKeys, userKeys],
  );

  const lShiftDemoIndex = useMemo(() => findLeftShiftKeyIndex(layoutKeys), [layoutKeys]);

  const imageRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const isSavingToKeyboardRef = useRef(false);
  /** 首次从 IDB 灌入两套草稿时跳过自动回写，避免无意义覆盖 */
  const mediaHydratingRef = useRef(false);
  const isTransferLocked = savingSource !== null;

  useEffect(() => {
    if (activeTab === "basic") setTypingEditIsland("basic");
    else if (activeTab === "personal") setTypingEditIsland("personal");
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "personal" && activeSource === "theme") {
      setActiveSource("album");
    }
  }, [activeSource, activeTab]);

  const mediaEditIsland: "basic" | "personal" =
    activeTab === "personal" ? "personal" : activeTab === "basic" ? "basic" : typingEditIsland;

  const { imageAsset, albumAssets, albumIndex, videoAsset, videoSpeed } =
    mediaEditIsland === "personal" ? personalDraft : basicDraft;

  const patchDraft = useCallback((island: "basic" | "personal", patch: Partial<IslandMediaDraft>) => {
    if (island === "basic") setBasicDraft((prev) => ({ ...prev, ...patch }));
    else setPersonalDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDraft = useCallback((island: "basic" | "personal", fn: (d: IslandMediaDraft) => IslandMediaDraft) => {
    if (island === "basic") setBasicDraft(fn);
    else setPersonalDraft(fn);
  }, []);

  const setVideoSpeed = useCallback(
    (next: string | ((prev: string) => string)) => {
      updateDraft(mediaEditIsland, (d) => ({
        ...d,
        videoSpeed: typeof next === "function" ? next(d.videoSpeed) : next,
      }));
    },
    [mediaEditIsland, updateDraft],
  );

  const applyThemePaletteFromFuncInfo = useCallback((funcInfo: Record<string, unknown> | null | undefined) => {
    if (!funcInfo) return;
    setPersonalThemeColors((prev) => ({
      ...prev,
      date: rgbToHexOrFallback(
        funcInfo.lcdCustomTimeRValue,
        funcInfo.lcdCustomTimeGValue,
        funcInfo.lcdCustomTimeBValue,
        prev.date,
      ),
      power: rgbToHexOrFallback(
        funcInfo.lcdCustomBatteryRValue,
        funcInfo.lcdCustomBatteryGValue,
        funcInfo.lcdCustomBatteryBValue,
        prev.power,
      ),
      status: rgbToHexOrFallback(
        funcInfo.lcdCustomIconRValue,
        funcInfo.lcdCustomIconGValue,
        funcInfo.lcdCustomIconBValue,
        prev.status,
      ),
    }));
  }, []);

  useEffect(() => {
    if (!keyboard?.deviceFuncInfo) return;
    applyThemePaletteFromFuncInfo(keyboard.deviceFuncInfo as unknown as Record<string, unknown>);
  }, [keyboard?.deviceFuncInfo, applyThemePaletteFromFuncInfo]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // 下发期间须 setDownLoad(true)，否则 MainProvider 仍会 pollConnectStatus → 0x1C，并可能在 status≠2 时误发 0x1A 打断传图。

  const readAsDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }, []);

  const onImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const dataUrl = await readAsDataUrl(file);
    patchDraft(mediaEditIsland, { imageAsset: { name: file.name, dataUrl } });
  };

  const onAlbumFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const selectedFiles = files.slice(0, MAX_ALBUM_FILES);
    if (files.length > MAX_ALBUM_FILES) {
      showMessage({ type: "warning", message: t("1643") });
    }
    const assets = await Promise.all(
      selectedFiles.map(async (file) => ({
        name: file.name,
        dataUrl: await readAsDataUrl(file),
      })),
    );
    patchDraft(mediaEditIsland, { albumAssets: assets, albumIndex: 0 });
  };

  const onVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (isGifFile(file)) {
      const buf = await file.arrayBuffer();
      const frameCount = countGifFrames(buf);
      if (frameCount > MAX_GIF_FRAMES) {
        showMessage({ type: "warning", message: t("1644") });
        return;
      }
    }
    const dataUrl = await readAsDataUrl(file);
    patchDraft(mediaEditIsland, { videoAsset: { name: file.name, dataUrl } });
  };

  const onImport = (source: ImportSource) => {
    if (isTransferLocked) return;
    if (source === "theme" && activeTab !== "personal") return;
    setActiveSource(source);
  };

  useEffect(() => {
    if (activeTab === "typing") {
      setActiveSource("video");
    }
  }, [activeTab]);

  const pickCurrentSourceFile = () => {
    if (isTransferLocked) return;
    if (activeSource === "theme") return;
    if (activeSource === "video") videoRef.current?.click();
    else if (activeSource === "album") albumRef.current?.click();
    else imageRef.current?.click();
  };

  const cleanupQgifFs = useCallback(async () => {
    if (!qgifModule?.FS) return;
    try {
      const files = qgifModule.FS.readdir("/");
      for (const file of files) {
        if (file === "." || file === "..") continue;
        try {
          qgifModule.FS.unlink(`/${file}`);
        } catch {
          // ignore unlink errors
        }
      }
    } catch {
      // ignore cleanup errors
    }
  }, [qgifModule]);

  const convertAssetDataUrlToRgb565WithHeader = useCallback(
    async (dataUrl: string, targetWidth: number, targetHeight: number, rotate: number): Promise<Uint8Array> => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t("1652")));
        img.src = dataUrl;
      });

      const needsRotate = rotate === 1 || rotate === 3;
      const outputWidth = needsRotate ? targetHeight : targetWidth;
      const outputHeight = needsRotate ? targetWidth : targetHeight;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error(t("1653"));

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) throw new Error(t("1654"));

      const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const offsetX = (targetWidth - drawW) / 2;
      const offsetY = (targetHeight - drawH) / 2;

      tempCtx.clearRect(0, 0, targetWidth, targetHeight);
      tempCtx.drawImage(image, offsetX, offsetY, drawW, drawH);

      outputCtx.clearRect(0, 0, outputWidth, outputHeight);
      outputCtx.save();
      if (needsRotate) {
        outputCtx.translate(outputWidth / 2, outputHeight / 2);
        const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
        outputCtx.rotate(rotationAngle);
        outputCtx.drawImage(tempCanvas, -targetWidth / 2, -targetHeight / 2);
      } else {
        outputCtx.drawImage(tempCanvas, 0, 0);
      }
      outputCtx.restore();

      const pixelData = outputCtx.getImageData(0, 0, outputWidth, outputHeight);
      const rgba = pixelData.data;
      const pixelCount = outputWidth * outputHeight;
      const rgb565 = new Uint8Array(pixelCount * 2);
      for (let p = 0; p < pixelCount; p++) {
        const r5 = (rgba[p * 4] >> 3) & 0x1f;
        const g6 = (rgba[p * 4 + 1] >> 2) & 0x3f;
        const b5 = (rgba[p * 4 + 2] >> 3) & 0x1f;
        const pixel = (r5 << 11) | (g6 << 5) | b5;
        rgb565[p * 2] = (pixel >> 8) & 0xff;
        rgb565[p * 2 + 1] = pixel & 0xff;
      }

      const headerVal = (outputHeight << 21) | (outputWidth << 10) | 4;
      const lvglHeader = new Uint8Array(4);
      lvglHeader[0] = headerVal & 0xff;
      lvglHeader[1] = (headerVal >> 8) & 0xff;
      lvglHeader[2] = (headerVal >> 16) & 0xff;
      lvglHeader[3] = (headerVal >> 24) & 0xff;
      const out = new Uint8Array(4 + rgb565.length);
      out.set(lvglHeader, 0);
      out.set(rgb565, 4);
      return out;
    },
    [t],
  );

  const compressPngFramesToQgif = useCallback(
    async (pngFrames: Uint8Array[], fps: number): Promise<Uint8Array> => {
      if (!qgifModule?.FS || !qgifModule?.cwrap) throw new Error(t("1655"));
      await cleanupQgifFs();
      for (let i = 0; i < pngFrames.length; i++) {
        await qgifModule.FS.writeFile(`/input_${i}.png`, pngFrames[i]);
      }

      const compressVideo = qgifModule.cwrap("compress_video_wasm", "number", ["string", "string", "number", "number"]);
      const type = 0;
      const attempts = [
        () => compressVideo("input_X.png", "output.qgif", type, fps),
        () => compressVideo("/input_X.png", "/output.qgif", type, fps),
      ];
      for (const run of attempts) {
        try {
          run();
          try {
            const out = qgifModule.FS.readFile("/output.qgif");
            if (out?.length) return out;
          } catch {
            const out = qgifModule.FS.readFile("output.qgif");
            if (out?.length) return out;
          }
        } catch {
          // try next path format
        }
      }
      throw new Error(t("1656"));
    },
    [cleanupQgifFs, qgifModule, t],
  );

  const decomposeGifDataUrlToPngFrames = useCallback(
    async (
      dataUrl: string,
      targetWidth: number,
      targetHeight: number,
      rotate: number,
    ): Promise<{ frames: Uint8Array[]; fpsFromGif: number }> => {
      const gifData = dataUrlToUint8Array(dataUrl);
      const gifBuffer = gifData.buffer.slice(gifData.byteOffset, gifData.byteOffset + gifData.byteLength) as ArrayBuffer;
      const gif = parseGIF(gifBuffer);
      const frames = decompressFrames(gif, true) as ParsedFrame[];
      if (!frames.length) throw new Error(t("1657"));

      const firstDelay = Math.max(frames[0]?.delay ?? 100, 1);
      const fpsFromGif = Math.max(2, Math.min(120, Math.round(1000 / firstDelay)));
      const gifW = gif.lsd.width;
      const gifH = gif.lsd.height;

      const accCanvas = document.createElement("canvas");
      accCanvas.width = gifW;
      accCanvas.height = gifH;
      const accCtx = accCanvas.getContext("2d");
      if (!accCtx) throw new Error(t("1658"));

      const frameCanvas = document.createElement("canvas");
      const outCanvas = document.createElement("canvas");
      const needsRotate = rotate === 1 || rotate === 3;
      outCanvas.width = needsRotate ? targetHeight : targetWidth;
      outCanvas.height = needsRotate ? targetWidth : targetHeight;
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) throw new Error(t("1654"));

      const pngFrames: Uint8Array[] = [];
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        if (i > 0) {
          const prev = frames[i - 1];
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

        const scale = Math.min(targetWidth / gifW, targetHeight / gifH);
        const drawW = gifW * scale;
        const drawH = gifH * scale;
        const offsetX = (targetWidth - drawW) / 2;
        const offsetY = (targetHeight - drawH) / 2;

        outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
        outCtx.save();
        if (needsRotate) {
          outCtx.translate(outCanvas.width / 2, outCanvas.height / 2);
          const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
          outCtx.rotate(rotationAngle);
          outCtx.drawImage(accCanvas, -targetWidth / 2 + offsetX, -targetHeight / 2 + offsetY, drawW, drawH);
        } else {
          outCtx.drawImage(accCanvas, offsetX, offsetY, drawW, drawH);
        }
        outCtx.restore();

        const b64 = outCanvas.toDataURL("image/png").split(",")[1] ?? "";
        pngFrames.push(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
      }

      if (!pngFrames.length) throw new Error(t("1659"));
      return { frames: pngFrames, fpsFromGif };
    },
    [t],
  );

  const downloadQgifToDevice = useCallback(
    async (qgifData: Uint8Array[], lcdMeta: LcdScreenTransferMeta, payloadType: 0 | 1 = 0) => {
      if (!deviceComm) throw new Error(t("1660"));
      const totalSize = qgifData.reduce((sum, data) => sum + data.length, 0);
      const read14 = await readLcdWorkParam14(deviceComm);
      if (!read14) throw new Error(t("1662"));

      const newEntries = qgifData.map((d) => ({
        metaByte: lcdMeta.metaByte,
        type: payloadType,
        size: d.length,
      }));
      const logical15 = buildDualIslandWorkLogical15FromReadPatch(read14.rawResponse, read14.parsed, {
        islandBeingSaved: lcdMeta.islandMode,
        newEntries,
      });

      if (logical15.length > W15_LOGICAL_MAX) {
        throw new Error(
          `QGIF 0x15 功能区超限：${logical15.length} 字节（上限 ${W15_LOGICAL_MAX}），请减少张数`,
        );
      }
      await sendScreenWorkParam15Packets(deviceComm, logical15);

      const completeBuffer = new Uint8Array(65);
      completeBuffer[1] = 0xaa;
      completeBuffer[2] = 0x16;
      completeBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(completeBuffer));

      const eraseBlocks = Math.max(
        1,
        qgifData.reduce((sum, data) => sum + Math.ceil(data.length / (64 * 1024)), 0),
      );
      await sendLcdEraseAndWait(deviceComm, eraseBlocks, lcdMeta.islandMode);

      let totalBytesTransferred = 0;
      const step = 56;
      for (let screenIndex = 0; screenIndex < qgifData.length; screenIndex++) {
        const data = qgifData[screenIndex];
        let currentAddress = 0;
        for (let i = 0; i < screenIndex; i++) {
          currentAddress += Math.ceil(qgifData[i].length / (64 * 1024)) * (64 * 1024);
        }
        for (let i = 0; i < data.length; i += step) {
          const writeBuffer = new Uint8Array(65);
          writeBuffer[1] = 0xaa;
          writeBuffer[2] = 0x19;
          writeBuffer[3] = currentAddress & 0xff;
          writeBuffer[4] = (currentAddress >> 8) & 0xff;
          writeBuffer[5] = (currentAddress >> 16) & 0xff;
          const bytesToSend = Math.min(step, data.length - i);
          writeBuffer[6] = bytesToSend;
          writeBuffer[7] = lcdMeta.islandMode;
          writeBuffer.set(data.slice(i, i + bytesToSend), 9);
          await deviceComm.setData(Array.from(writeBuffer));
          await settleBetweenLcd19Packets();
          currentAddress += bytesToSend;
          totalBytesTransferred += bytesToSend;
          if (totalBytesTransferred >= totalSize) await Promise.resolve();
        }
      }

      // 必须等所有 0x19 分包循环发送完成后，再下发 0x1A
      const resetBuffer = new Uint8Array(65);
      resetBuffer[1] = 0xaa;
      resetBuffer[2] = 0x1a;
      await deviceComm.setData(Array.from(resetBuffer));
      await deviceComm.syncTime();
      const endBuffer = new Uint8Array(65);
      endBuffer[1] = 0xaa;
      endBuffer[2] = 0x11;
      await deviceComm.setData(Array.from(endBuffer));
    },
    [deviceComm, t],
  );

  /** 静态 RGB565：LVGL 4 字节头 + 像素；0x15 与擦写均跟 `lcdMeta.islandMode`（实际保存侧） */
  const downloadStaticRgb565ToDevice = useCallback(
    async (rgb565WithHeader: Uint8Array, lcdMeta: LcdScreenTransferMeta) => {
      if (!deviceComm) throw new Error(t("1660"));
      const data = rgb565WithHeader;
      const totalSize = data.length;
      const read14 = await readLcdWorkParam14(deviceComm);
      if (!read14) throw new Error(t("1662"));

      const newEntries = [{ metaByte: lcdMeta.metaByte, type: 1 as const, size: totalSize }];
      const logical15 = buildDualIslandWorkLogical15FromReadPatch(read14.rawResponse, read14.parsed, {
        islandBeingSaved: lcdMeta.islandMode,
        newEntries,
      });
      await sendScreenWorkParam15Packets(deviceComm, logical15);

      const completeBuffer = new Uint8Array(65);
      completeBuffer[1] = 0xaa;
      completeBuffer[2] = 0x16;
      completeBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(completeBuffer));

      const eraseBlocks = Math.max(1, Math.ceil(totalSize / (64 * 1024)));
      await sendLcdEraseAndWait(deviceComm, eraseBlocks, lcdMeta.islandMode);

      const step = 56;
      let currentAddress = 0;
      let totalBytesTransferred = 0;
      for (let i = 0; i < data.length; i += step) {
        const writeBuffer = new Uint8Array(65);
        writeBuffer[1] = 0xaa;
        writeBuffer[2] = 0x19;
        writeBuffer[3] = currentAddress & 0xff;
        writeBuffer[4] = (currentAddress >> 8) & 0xff;
        writeBuffer[5] = (currentAddress >> 16) & 0xff;
        const bytesToSend = Math.min(step, data.length - i);
        writeBuffer[6] = bytesToSend;
        writeBuffer[7] = lcdMeta.islandMode;
        writeBuffer.set(data.slice(i, i + bytesToSend), 9);
        await deviceComm.setData(Array.from(writeBuffer));
        await settleBetweenLcd19Packets();
        currentAddress += bytesToSend;
        totalBytesTransferred += bytesToSend;
        if (totalBytesTransferred >= totalSize) await Promise.resolve();
      }

      const resetBuffer = new Uint8Array(65);
      resetBuffer[1] = 0xaa;
      resetBuffer[2] = 0x1a;
      await deviceComm.setData(Array.from(resetBuffer));
      await deviceComm.syncTime();
      const endBuffer = new Uint8Array(65);
      endBuffer[1] = 0xaa;
      endBuffer[2] = 0x11;
      await deviceComm.setData(Array.from(endBuffer));
    },
    [deviceComm, t],
  );

  const saveAlbumToKeyboard = useCallback(async () => {
    if (!albumAssets.length) {
      showMessage({ type: "warning", message: t("1646") });
      return;
    }
    if (!deviceComm) {
      showMessage({ type: "error", message: t("1660") });
      return;
    }
    try {
      setSavingSource("album");
      setDownLoad(true);
      const targetW = Math.max(1, Number(screenWidth) || 240);
      const targetH = Math.max(1, Number(screenHeight) || 136);
      const rotate = Number((screenInfo as unknown as { rotate?: number } | undefined)?.rotate ?? 0);
      const interval = Math.max(1, parseInt(intervalSec, 10) || 5);

      // 参考 drive_app：在开始 QGIF 转换/传输前先发送 AP_START(0x1B)
      const startBuffer = new Uint8Array(65);
      startBuffer[1] = 0xaa;
      startBuffer[2] = 0x1b;
      startBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(startBuffer));

      const rgb565Bins: Uint8Array[] = [];
      for (const asset of albumAssets) {
        const rgb565Bin = await convertAssetDataUrlToRgb565WithHeader(asset.dataUrl, targetW, targetH, rotate);
        rgb565Bins.push(rgb565Bin);
      }

      // 相册要求：所有图片先转换完成，再合并成一段数据一次下发。
      const mergedAlbumData = new Uint8Array(rgb565Bins.reduce((s, b) => s + b.length, 0));
      let off = 0;
      for (const bin of rgb565Bins) {
        mergedAlbumData.set(bin, off);
        off += bin.length;
      }

      const metaByte = encodeLcdImageMetaByte({
        imageSlotCount: rgb565Bins.length,
        animType: transitionKindToLcdAnimType(transition),
        intervalCode: secondsToLcdIntervalCode(interval),
      });
      await downloadQgifToDevice(
        [mergedAlbumData],
        {
          metaByte,
          islandMode: lcdEraseIslandModeFromMediaIsland(mediaEditIsland),
        },
        1,
      );
      showMessage({ type: "success", message: t("1647") });
    } catch {
      showMessage({ type: "error", message: t("1648") });
    } finally {
      setDownLoad(false);
      setSavingSource(null);
    }
  }, [
    albumAssets,
    compressPngFramesToQgif,
    deviceComm,
    downloadQgifToDevice,
    setDownLoad,
    intervalSec,
    convertAssetDataUrlToRgb565WithHeader,
    screenHeight,
    screenInfo,
    screenWidth,
    showMessage,
    t,
    transition,
    mediaEditIsland,
    setSavingSource,
  ]);

  const saveVideoToKeyboard = useCallback(async () => {
    if (!videoAsset?.dataUrl) {
      showMessage({ type: "warning", message: t("1649") });
      return;
    }
    if (!deviceComm) {
      showMessage({ type: "error", message: t("1660") });
      return;
    }
    if (!qgifModule) {
      showMessage({ type: "error", message: t("181") });
      return;
    }

    try {
      setSavingSource("video");
      setDownLoad(true);
      const targetW = Math.max(1, Number(screenWidth) || 240);
      const targetH = Math.max(1, Number(screenHeight) || 136);
      const rotate = Number((screenInfo as unknown as { rotate?: number } | undefined)?.rotate ?? 0);

      // 你要求：调用 QGIF 转换前先下发 0x1B
      const startBuffer = new Uint8Array(65);
      startBuffer[1] = 0xaa;
      startBuffer[2] = 0x1b;
      startBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(startBuffer));

      const { frames, fpsFromGif } = await decomposeGifDataUrlToPngFrames(videoAsset.dataUrl, targetW, targetH, rotate);
      const fps = isNativeGifPlaybackSpeed(videoSpeed) ? fpsFromGif : getScreenThemeGifPlaybackFps(videoSpeed);
      const qgifBin = await compressPngFramesToQgif(frames, fps);
      const metaByte = encodeLcdImageMetaByte({
        imageSlotCount: 1,
        animType: 0,
        intervalCode: 0,
      });
      await downloadQgifToDevice([qgifBin], {
        metaByte,
        islandMode: lcdEraseIslandModeFromMediaIsland(mediaEditIsland),
      });
      showMessage({ type: "success", message: t("1650") });
    } catch (err) {
      console.error("[ScreenTheme] 保存视频到键盘失败", err);
      showMessage({ type: "error", message: t("1651") });
    } finally {
      setDownLoad(false);
      setSavingSource(null);
    }
  }, [
    videoAsset?.dataUrl,
    deviceComm,
    qgifModule,
    setDownLoad,
    t,
    screenWidth,
    screenHeight,
    screenInfo,
    decomposeGifDataUrlToPngFrames,
    videoSpeed,
    compressPngFramesToQgif,
    downloadQgifToDevice,
    showMessage,
    mediaEditIsland,
    setSavingSource,
  ]);

  const convertImageDataUrlToRgb565Swap = useCallback(
    async (dataUrl: string, targetWidth: number, targetHeight: number, rotate: number) => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t("1652")));
        img.src = dataUrl;
      });

      const needsRotate = rotate === 1 || rotate === 3;
      const outputWidth = needsRotate ? targetHeight : targetWidth;
      const outputHeight = needsRotate ? targetWidth : targetHeight;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) throw new Error(t("1653"));

      const outputCanvas = document.createElement("canvas");
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      const outputCtx = outputCanvas.getContext("2d");
      if (!outputCtx) throw new Error(t("1654"));

      const scale = Math.min(targetWidth / image.width, targetHeight / image.height);
      const drawW = image.width * scale;
      const drawH = image.height * scale;
      const offsetX = (targetWidth - drawW) / 2;
      const offsetY = (targetHeight - drawH) / 2;

      tempCtx.clearRect(0, 0, targetWidth, targetHeight);
      tempCtx.drawImage(image, offsetX, offsetY, drawW, drawH);

      outputCtx.clearRect(0, 0, outputWidth, outputHeight);
      outputCtx.save();
      if (needsRotate) {
        outputCtx.translate(outputWidth / 2, outputHeight / 2);
        const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
        outputCtx.rotate(rotationAngle);
        outputCtx.drawImage(tempCanvas, -targetWidth / 2, -targetHeight / 2);
      } else {
        outputCtx.drawImage(tempCanvas, 0, 0);
      }
      outputCtx.restore();

      // RGBA -> RGB565 (R5G6B5), then swap bytes to match firmware order.
      const pixelData = outputCtx.getImageData(0, 0, outputWidth, outputHeight);
      const rgba = pixelData.data;
      const pixelCount = outputWidth * outputHeight;

      const rgb565 = new Uint8Array(pixelCount * 2);

      for (let p = 0; p < pixelCount; p++) {
        const r = rgba[p * 4];
        const g = rgba[p * 4 + 1];
        const b = rgba[p * 4 + 2];

        const r5 = (r >> 3) & 0x1f;
        const g6 = (g >> 2) & 0x3f;
        const b5 = (b >> 3) & 0x1f;

        const pixel = (r5 << 11) | (g6 << 5) | b5;

        // Byte-swapped on wire: hi then lo.
        rgb565[p * 2] = (pixel >> 8) & 0xff;
        rgb565[p * 2 + 1] = pixel & 0xff;
      }

      const headerVal = (outputHeight << 21) | (outputWidth << 10) | 4;
      const lvglHeader = new Uint8Array(4);
      lvglHeader[0] = headerVal & 0xff;
      lvglHeader[1] = (headerVal >> 8) & 0xff;
      lvglHeader[2] = (headerVal >> 16) & 0xff;
      lvglHeader[3] = (headerVal >> 24) & 0xff;
      const out = new Uint8Array(4 + rgb565.length);
      out.set(lvglHeader, 0);
      out.set(rgb565, 4);
      return out;
    },
    [t],
  );

  
  const saveThemeColorsToKeyboard = useCallback(async (): Promise<boolean> => {
    const protocolVer = keyboard?.deviceBaseInfo?.protocolVer;
    
    const currentFuncInfo = keyboard?.deviceFuncInfo;
    if (!connectedKeyboard || protocolVer == null || !currentFuncInfo) {
      showMessage({ type: "error", message: t("1660") });
      return false;
    }

    const timeRgb = hexToRgbTuple(personalThemeColors.date);
    const batteryRgb = hexToRgbTuple(personalThemeColors.power);
    const statusRgb = hexToRgbTuple(personalThemeColors.status);
    if (!timeRgb || !batteryRgb || !statusRgb) {
      showMessage({ type: "warning", message: t("2548") });
      return false;
    }

    try {
      setSavingSource("theme");
      
      const next = {
        ...currentFuncInfo,
        lcdCustomTimeRValue: timeRgb[0],
        lcdCustomTimeGValue: timeRgb[1],
        lcdCustomTimeBValue: timeRgb[2],
        lcdCustomBatteryRValue: batteryRgb[0],
        lcdCustomBatteryGValue: batteryRgb[1],
        lcdCustomBatteryBValue: batteryRgb[2],
        lcdCustomIconRValue: statusRgb[0],
        lcdCustomIconGValue: statusRgb[1],
        lcdCustomIconBValue: statusRgb[2],
      };
      keyboard?.setDeviceFuncInfo?.(next);
      await connectedKeyboard.setFuncInfo(next, protocolVer);
      showMessage({ type: "success", message: t("2546") });
      return true;
    } catch {
      showMessage({ type: "error", message: t("2547") });
      return false;
    } finally {
      setSavingSource(null);
    }
  }, [
    connectedKeyboard,
    keyboard,
    keyboard?.deviceFuncInfo,
    personalThemeColors.date,
    personalThemeColors.power,
    personalThemeColors.status,
    showMessage,
    t,
  ]);

  const saveImageToKeyboard = useCallback(async () => {
    if (!imageAsset?.dataUrl) {
      showMessage({ type: "warning", message: t("404") });
      return;
    }
    if (!deviceComm) {
      showMessage({ type: "error", message: t("1660") });
      return;
    }

    const targetW = Math.max(1, Number(screenWidth) || 240);
    const targetH = Math.max(1, Number(screenHeight) || 136);
    const rotate = Number((screenInfo as unknown as { rotate?: number } | undefined)?.rotate ?? 0);

    isSavingToKeyboardRef.current = true;
    try {
      setSavingSource("image");
      setDownLoad(true);
      const rgb565Bin = await convertImageDataUrlToRgb565Swap(imageAsset.dataUrl, targetW, targetH, rotate);

      const startBuffer = new Uint8Array(65).fill(0);
      startBuffer[1] = 0xaa;
      startBuffer[2] = 0x1b;
      startBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(startBuffer));

      const metaByte = encodeLcdImageMetaByte({
        imageSlotCount: 1,
        animType: 0,
        intervalCode: 0,
      });
      await downloadStaticRgb565ToDevice(rgb565Bin, {
        metaByte,
        islandMode: lcdEraseIslandModeFromMediaIsland(mediaEditIsland),
      });
      showMessage({ type: "success", message: t("1661") });
    } catch {
      showMessage({ type: "error", message: t("1662") });
    } finally {
      setDownLoad(false);
      isSavingToKeyboardRef.current = false;
      setSavingSource(null);
    }
  }, [
    convertImageDataUrlToRgb565Swap,
    deviceComm,
    downloadStaticRgb565ToDevice,
    setDownLoad,
    imageAsset?.dataUrl,
    screenHeight,
    screenInfo,
    screenWidth,
    showMessage,
    t,
    mediaEditIsland,
  ]);

  useEffect(() => {
    const restoreFromDb = async () => {
      mediaHydratingRef.current = true;
      try {
        const [basic, personal] = await Promise.all([
          loadIslandDraftFromIds(DB_ID_IMAGE, DB_ID_ALBUM, DB_ID_VIDEO),
          loadIslandDraftFromIds(DB_ID_IMAGE_PERSONAL, DB_ID_ALBUM_PERSONAL, DB_ID_VIDEO_PERSONAL),
        ]);
        setBasicDraft(basic);
        setPersonalDraft(personal);

        const themeFile = await getFileById(DB_ID_PERSONAL_THEME);
        if (themeFile?.content) {
          try {
            const p = JSON.parse(themeFile.content) as Partial<PersonalThemePalette> & { color?: string };
            setPersonalThemeColors((prev) => ({
              theme: typeof p.theme === "string" && p.theme ? p.theme : typeof p.color === "string" && p.color ? p.color : prev.theme,
              // 时间/电量/状态颜色来自键盘功能区，不从本地草稿覆盖
              date: prev.date,
              power: prev.power,
              status: prev.status,
            }));
          } catch {
            // ignore
          }
        }

        setRestored(true);
      } finally {
        mediaHydratingRef.current = false;
      }
    };

    void restoreFromDb();
  }, []);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const asset = basicDraft.imageAsset;
      if (asset) {
        await saveFile({
          id: DB_ID_IMAGE,
          name: asset.name,
          type: "file",
          size: asset.dataUrl.length,
          date: new Date().toISOString(),
          content: JSON.stringify(asset),
        });
      } else {
        await saveFile({
          id: DB_ID_IMAGE,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, basicDraft.imageAsset, basicDraft.imageAsset?.dataUrl]);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const asset = personalDraft.imageAsset;
      if (asset) {
        await saveFile({
          id: DB_ID_IMAGE_PERSONAL,
          name: asset.name,
          type: "file",
          size: asset.dataUrl.length,
          date: new Date().toISOString(),
          content: JSON.stringify(asset),
        });
      } else {
        await saveFile({
          id: DB_ID_IMAGE_PERSONAL,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, personalDraft.imageAsset, personalDraft.imageAsset?.dataUrl]);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const { albumAssets: items, albumIndex: index } = basicDraft;
      if (items.length) {
        await saveFile({
          id: DB_ID_ALBUM,
          name: `album-${items.length}.json`,
          type: "file",
          size: JSON.stringify(items).length,
          date: new Date().toISOString(),
          content: JSON.stringify({ items, index }),
        });
      } else {
        await saveFile({
          id: DB_ID_ALBUM,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, basicDraft.albumAssets, basicDraft.albumIndex]);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const { albumAssets: items, albumIndex: index } = personalDraft;
      if (items.length) {
        await saveFile({
          id: DB_ID_ALBUM_PERSONAL,
          name: `album-${items.length}.json`,
          type: "file",
          size: JSON.stringify(items).length,
          date: new Date().toISOString(),
          content: JSON.stringify({ items, index }),
        });
      } else {
        await saveFile({
          id: DB_ID_ALBUM_PERSONAL,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, personalDraft.albumAssets, personalDraft.albumIndex]);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const { videoAsset: v, videoSpeed: spd } = basicDraft;
      if (v?.dataUrl) {
        await saveFile({
          id: DB_ID_VIDEO,
          name: v.name,
          type: "file",
          size: v.dataUrl.length,
          date: new Date().toISOString(),
          content: JSON.stringify({ ...v, speed: spd }),
        });
      } else {
        await saveFile({
          id: DB_ID_VIDEO,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, basicDraft.videoAsset, basicDraft.videoAsset?.dataUrl, basicDraft.videoSpeed]);

  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    void (async () => {
      const { videoAsset: v, videoSpeed: spd } = personalDraft;
      if (v?.dataUrl) {
        await saveFile({
          id: DB_ID_VIDEO_PERSONAL,
          name: v.name,
          type: "file",
          size: v.dataUrl.length,
          date: new Date().toISOString(),
          content: JSON.stringify({ ...v, speed: spd }),
        });
      } else {
        await saveFile({
          id: DB_ID_VIDEO_PERSONAL,
          name: "-",
          type: "file",
          size: 0,
          date: new Date().toISOString(),
          content: "",
        });
      }
    })();
  }, [restored, personalDraft.videoAsset, personalDraft.videoAsset?.dataUrl, personalDraft.videoSpeed]);

  useEffect(() => {
    if (mediaHydratingRef.current) return;
    if (!restored || activeTab !== "personal") return;
    void saveFile({
      id: DB_ID_PERSONAL_THEME,
      name: "themeColor",
      type: "file",
      size: JSON.stringify(personalThemeColors).length,
      date: new Date().toISOString(),
      content: JSON.stringify({ ...personalThemeColors, color: personalThemeColors.theme }),
    });
  }, [personalThemeColors, restored, activeTab]);

  useEffect(() => {
    setBasicDraft((prev) => {
      const len = prev.albumAssets.length;
      if (!len) return { ...prev, albumIndex: 0 };
      return { ...prev, albumIndex: Math.min(prev.albumIndex, len - 1) };
    });
  }, [basicDraft.albumAssets.length]);

  useEffect(() => {
    setPersonalDraft((prev) => {
      const len = prev.albumAssets.length;
      if (!len) return { ...prev, albumIndex: 0 };
      return { ...prev, albumIndex: Math.min(prev.albumIndex, len - 1) };
    });
  }, [personalDraft.albumAssets.length]);

  useEffect(() => {
    if ((activeTab !== "basic" && activeTab !== "personal") || activeSource !== "album") return;
    const len = albumAssets.length;
    if (len <= 1) return;
    const sec = Math.max(1, parseInt(intervalSec, 10) || 5);
    const island = mediaEditIsland;
    const id = window.setInterval(() => {
      updateDraft(island, (p) => {
        const l = p.albumAssets.length;
        if (l <= 1) return p;
        return { ...p, albumIndex: (p.albumIndex + 1) % l };
      });
    }, sec * 1000);
    return () => window.clearInterval(id);
  }, [activeTab, activeSource, albumAssets.length, intervalSec, mediaEditIsland, updateDraft]);

  const albumCarousel = useMemo(() => {
    if (activeSource !== "album" || albumAssets.length <= 1) return null;
    const len = albumAssets.length;
    const island = mediaEditIsland;
    return {
      index: albumIndex,
      total: len,
      onPrev: () =>
        updateDraft(island, (p) => {
          const l = p.albumAssets.length;
          if (!l) return p;
          return { ...p, albumIndex: (p.albumIndex - 1 + l) % l };
        }),
      onNext: () =>
        updateDraft(island, (p) => {
          const l = p.albumAssets.length;
          if (!l) return p;
          return { ...p, albumIndex: (p.albumIndex + 1) % l };
        }),
    };
  }, [activeSource, albumAssets.length, albumIndex, mediaEditIsland, updateDraft]);

  const timeLabel = formatScreenTime(now);
  const albumCurrent = albumAssets[albumIndex] ?? null;
  const previewUrl =
    activeSource === "theme"
      ? null
      : activeSource === "image"
        ? imageAsset?.dataUrl ?? null
        : activeSource === "video"
          ? videoAsset?.dataUrl ?? null
          : albumCurrent?.dataUrl ?? null;
  const basicFileName =
    activeSource === "image"
      ? imageAsset?.name ?? fileName
      : activeSource === "video"
        ? videoAsset?.name ?? fileName
        : albumCurrent?.name ?? t("2539");
  const albumDisplayIndex = albumAssets.length === 0 ? 0 : Math.min(albumIndex + 1, albumAssets.length);

  const renderMediaWorkspace = (isPersonalIsland: boolean) => (
    <Box
      sx={{
        flex: 1,
        minHeight: "16.25rem",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        overflow: "auto",
        p: 25,
        gap: 0,
        boxSizing: "border-box",
        borderRadius: "1.25rem",
        background: "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)",
        border: "0.0625rem solid rgba(181,187,196,0.32)",
      }}
    >
      <ScreenThemeImportPanel
        activeSource={activeSource}
        onImport={onImport}
        disabled={isTransferLocked}
        themeColorSlot={
          isPersonalIsland
            ? {
                value: personalThemeColors.theme,
                onChange: (next) => setPersonalThemeColors((prev) => ({ ...prev, theme: next })),
                disabled: isTransferLocked,
              }
            : null
        }
      />
      <Divider orientation="vertical" variant="middle" flexItem sx={{ my: 12 }} />
      {isPersonalIsland && activeSource === "theme" ? (
        <ScreenThemeThemeColorPreview
          themeColor={personalThemeColors.theme}
          dateColor={personalThemeColors.date}
          powerColor={personalThemeColors.power}
          statusColor={personalThemeColors.status}
        />
      ) : (
        <ScreenThemePreview
          previewUrl={previewUrl}
          albumCarousel={albumCarousel}
          gifPlaybackSpeed={activeSource === "video" ? videoSpeed : undefined}
        />
      )}
      {isPersonalIsland && activeSource === "theme" ? (
        <ScreenThemeThemeColorPanel
          colors={personalThemeColors}
          isSaving={savingSource === "theme"}
          isLocked={isTransferLocked}
          onColorChange={(field, color) => {
            setPersonalThemeColors((prev) => ({ ...prev, [field]: color }));
          }}
          onSaveToKeyboard={saveThemeColorsToKeyboard}
        />
      ) : activeSource === "image" ? (
        <ScreenThemeImageSettingsPanel
          fileName={basicFileName}
          isSaving={savingSource === "image"}
          isLocked={isTransferLocked}
          onSelectFile={pickCurrentSourceFile}
          onSaveToKeyboard={() => {
            void saveImageToKeyboard();
          }}
        />
      ) : activeSource === "video" ? (
        <ScreenThemeVideoSettingsPanel
          fileName={basicFileName}
          speed={videoSpeed}
          isSaving={savingSource === "video"}
          isLocked={isTransferLocked}
          onSpeedChange={setVideoSpeed}
          onSelectFile={pickCurrentSourceFile}
          onSaveToKeyboard={() => {
            void saveVideoToKeyboard();
          }}
        />
      ) : (
        <ScreenThemeSettingsPanel
          fileIndex={albumDisplayIndex}
          fileTotal={albumAssets.length}
          intervalSec={intervalSec}
          transition={transition}
          isSaving={savingSource === "album"}
          isLocked={isTransferLocked}
          onIntervalChange={setIntervalSec}
          onTransitionChange={setTransition}
          onSelectFolder={pickCurrentSourceFile}
          onSaveToKeyboard={() => {
            void saveAlbumToKeyboard();
          }}
        />
      )}
    </Box>
  );

  const renderPanelByTab = () => {
    if (activeTab === "basic" || activeTab === "personal") {
      return renderMediaWorkspace(activeTab === "personal");
    }
    return (
      <ScreenThemeTypingPanel
        activeSource={activeSource}
        previewUrl={previewUrl}
        gifPlaybackSpeed={activeSource === "video" ? videoSpeed : undefined}
        onImport={onImport}
      />
    );
  };

  const handleSyncTime = useCallback(async (): Promise<boolean> => {
    if (!deviceComm) return false;
    try {
      await deviceComm.syncTime();
      setNow(new Date());
      showMessage({
        type: "success",
        message: t("1663"),
      });
      return true;
    } catch {
      showMessage({
        type: "error",
        message: t("1664"),
      });
      return false;
    }
  }, [deviceComm, showMessage, t]);

  return (
    <Box
      sx={{
        flex: 1,
        width: "100%",
        minHeight: 0,
        height: "100%",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <input ref={imageRef} type="file" accept=".png,.jpg,.jpeg,.webp" hidden onChange={onImageFileChange} />
      <input ref={albumRef} type="file" accept=".png,.jpg,.jpeg,.webp" multiple hidden onChange={onAlbumFileChange} />
      <input ref={videoRef} type="file" accept=".gif" hidden onChange={onVideoFileChange} />

      <Box
        sx={{
          flex: "0 1 48%",
          minHeight: "45%",
          maxHeight: "50%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          flexShrink: 0,
          px: { xs: 1, sm: 2 },
          pt: 1,
          pb: 0.5,
          margin: "0 auto",
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", display: "flex", flexDirection: "column" }}>
        <TravelVirtualKeyboard
          layoutKeys={mappedLayoutKeys}
          patternKeys={keyboardLayout?.layouts?.patternKeys ?? []}
          travelKeys={[]}
          selectedKeys={[]}
          travelValue={0}
          showActuation={false}
          alignTop
          showLayerOverlay={false}
          onToggleKey={() => { }}
          demoHighlightKeyIndex={lShiftDemoIndex >= 0 ? lShiftDemoIndex : undefined}
          demoHighlightTitle={lShiftDemoIndex >= 0 ? t("1665") : undefined}
        />
        </Box>
      </Box>
      <ScreenThemeKeyboardLegend />

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          px: 2,
          pb: 2,
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            px: 163,
          }}
        >
          <ScreenThemeSidebar
            embedded
            activeTab={activeTab}
            disabled={isTransferLocked}
            onTabChange={(tab) => {
              if (isTransferLocked) return;
              setActiveTab(tab);
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.25, minHeight: 0 }}>
            <ScreenThemeTopBar timeLabel={timeLabel} onSyncTime={handleSyncTime} />
            {renderPanelByTab()}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
