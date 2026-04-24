"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Dialog, DialogContent, DialogTitle, Divider, LinearProgress, Typography } from "@mui/material";
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
import ScreenThemeTypingPanel, { type TypingCharacterValue } from "./ScreenThemeTypingPanel";
import ScreenThemeKeyboardLegend from "./ScreenThemeKeyboardLegend";
import ScreenThemeThemeColorPanel from "./ScreenThemeThemeColorPanel";
import ScreenThemeThemeColorPreview from "./ScreenThemeThemeColorPreview";
import ScreenThemeConfirmDialog from "./ScreenThemeConfirmDialog";
import { VIDEO_SPEED_OPTIONS } from "./options";
import type { ImportSource, ScreenThemeTab, TransitionKind } from "./types";
import { findLeftShiftKeyIndex } from "./screenThemeLayout";
import { mergeLayoutKeysWithUserKeyNames } from "@/utils/mergeLayoutKeysWithUserKeyNames";
import { getFileById, saveFile } from "@/utils/indexeddb-storage";
import { countGifFrames, isGifFile } from "@/utils/gifFrameCount";
import { compressPngFramesToQgifWithinPayloadLimit } from "@/utils/compressQgifUnderByteLimit";
import { decomposeGifDataUrlToPngFramesInWorker } from "@/utils/decomposeGifInWorker";
import { compressPngFramesToQgifInWorker } from "@/utils/compressQgifInWorker";
import { GIF_UPLOAD_MAX_BYTES, shrinkGifArrayBufferToLimit } from "@/utils/shrinkGifToMaxBytes";
import { useTranslation } from "@/app/i18n";
import { getScreenThemeGifPlaybackFps, isNativeGifPlaybackSpeed } from "./screenThemeGifPlaybackFps";
import {
  buildDualIslandWorkLogical15FromReadPatch,
  encodeLcdImageMetaByte,
  extractLcdWorkTailThemeRgbFrom14Read,
  lcdEraseIslandModeFromMediaIsland,
  readLcdWorkParam14,
  readMergeSendLcdWorkAreaScreenTail,
  sendLcdEraseAndWait,
  sendLcdScreenWorkAreaSave16,
  settleBetweenLcd19Packets,
  type LcdScreenTransferMeta,
  secondsToLcdIntervalCode,
  sendScreenWorkParam15Packets,
  transitionKindToLcdAnimType,
  type LcdWorkParam14ReadResult,
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
  /** GIF 上传超过阈值时，只保留前 N 帧用于预览/下载 */
  frameLimit?: number;
};

type TransferStage = "convert" | "erase" | "download";

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
/** `public/image.png`：基础灵动岛默认「图片」/「相册」占位（视频见 DEFAULT_VIDEO_BG_STATIC_PATH） */
const DEFAULT_BASIC_MEDIA_PATH = "/image.png";
/** `public/image1.png`：个性化灵动岛默认图 / 相册占位 */
const DEFAULT_PERSONAL_MEDIA_PATH = "/image1.png";
/** `public/screen-theme/default-background.gif`：导入「视频」槽位默认 / 恢复默认视频（两岛共用） */
const DEFAULT_VIDEO_BG_STATIC_PATH = "/screen-theme/default-background.gif";

/** 解码后单边超过此值时先用 createImageBitmap 缩小，降低手机大图等导致 OOM / 标签页崩溃的概率 */
const LCD_DECODE_MAX_SIDE = 4096;
/** 设备返回异常超大分辨率时的 canvas 单边上限 */
const LCD_TARGET_MAX_SIDE = 8192;
/** 主线程 RGB565 转换分片，中间 yield，减轻「页面无响应」被强杀（越小越顺滑，略增异步开销） */
const LCD_RGB565_CHUNK_PIXELS = 16384;
/** GIF 帧解码内存预算（RGBA 估算）；取保守值，优先稳定不崩溃 */
const GIF_DECODE_BUDGET_BYTES = 80 * 1024 * 1024;
/** data URL 输入体积上限（估算）；收紧阈值，提前拦截高风险大文件 */
const GIF_SOURCE_DATAURL_MAX_BYTES = 12 * 1024 * 1024;
/** GIF 原始尺寸软上限：超出则拒绝，避免大尺寸帧 patch 导致内存暴涨 */
const GIF_SOURCE_MAX_SIDE = 1024;

function clampLcdTargetDimension(n: number, maxSide: number): number {
  return Math.min(Math.max(1, Math.floor(Number(n) || 1)), maxSide);
}

function canvasImageSourceSize(source: CanvasImageSource): { w: number; h: number } {
  if (source instanceof HTMLImageElement) {
    const w = source.naturalWidth || source.width;
    const h = source.naturalHeight || source.height;
    return { w, h };
  }
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { w: source.width, h: source.height };
  }
  if (source instanceof HTMLVideoElement) {
    return { w: source.videoWidth, h: source.videoHeight };
  }
  if ("width" in source && "height" in source && typeof (source as { width: unknown }).width === "number") {
    const s = source as { width: number; height: number };
    return { w: s.width, h: s.height };
  }
  return { w: 0, h: 0 };
}

async function yieldMainThreadIfNeeded(): Promise<void> {
  const sched = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof sched?.yield === "function") {
    await sched.yield();
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * 大图先缩到单边 LCD_DECODE_MAX_SIDE，再参与 letterbox 绘制，降低 decode 内存峰值。
 */
async function openDownscaledCanvasSourceIfNeeded(
  image: HTMLImageElement,
): Promise<{ source: CanvasImageSource; close?: () => void }> {
  const { w, h } = canvasImageSourceSize(image);
  const maxSide = Math.max(w, h);
  if (maxSide <= 0 || maxSide <= LCD_DECODE_MAX_SIDE) {
    return { source: image };
  }
  const scale = LCD_DECODE_MAX_SIDE / maxSide;
  const rw = Math.max(1, Math.round(w * scale));
  const rh = Math.max(1, Math.round(h * scale));
  try {
    const bitmap = await createImageBitmap(image, {
      resizeWidth: rw,
      resizeHeight: rh,
      resizeQuality: "high",
    });
    return {
      source: bitmap,
      close: () => {
        try {
          bitmap.close();
        } catch {
          /* ignore */
        }
      },
    };
  } catch {
    return { source: image };
  }
}

async function rgbaToRgb565SwappedChunked(rgba: Uint8ClampedArray, pixelCount: number, rgb565: Uint8Array): Promise<void> {
  if (pixelCount <= LCD_RGB565_CHUNK_PIXELS) {
    for (let p = 0; p < pixelCount; p++) {
      const r5 = (rgba[p * 4] >> 3) & 0x1f;
      const g6 = (rgba[p * 4 + 1] >> 2) & 0x3f;
      const b5 = (rgba[p * 4 + 2] >> 3) & 0x1f;
      const pixel = (r5 << 11) | (g6 << 5) | b5;
      rgb565[p * 2] = (pixel >> 8) & 0xff;
      rgb565[p * 2 + 1] = pixel & 0xff;
    }
    return;
  }
  for (let start = 0; start < pixelCount; start += LCD_RGB565_CHUNK_PIXELS) {
    const end = Math.min(start + LCD_RGB565_CHUNK_PIXELS, pixelCount);
    for (let p = start; p < end; p++) {
      const r5 = (rgba[p * 4] >> 3) & 0x1f;
      const g6 = (rgba[p * 4 + 1] >> 2) & 0x3f;
      const b5 = (rgba[p * 4 + 2] >> 3) & 0x1f;
      const pixel = (r5 << 11) | (g6 << 5) | b5;
      rgb565[p * 2] = (pixel >> 8) & 0xff;
      rgb565[p * 2 + 1] = pixel & 0xff;
    }
    if (end < pixelCount) {
      await yieldMainThreadIfNeeded();
    }
  }
}

/**
 * 从 `public/` 拉取静态资源并转为 data URL。静态导出且 `assetPrefix` 为相对路径时，
 * 仅用 `fetch("/x")` 可能失败，故优先使用 `origin + path`。
 */
async function fetchPublicFileAsMediaAsset(absolutePath: string, displayName: string): Promise<MediaAsset> {
  const attempts: string[] = [];
  if (typeof window !== "undefined" && absolutePath.startsWith("/")) {
    attempts.push(`${window.location.origin}${absolutePath}`);
  }
  attempts.push(absolutePath);

  let lastError: unknown;
  for (const url of [...new Set(attempts)]) {
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return { name: displayName, dataUrl };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "fetch failed"));
}

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

const TYPING_THEME_BIN_MAP: Record<TypingCharacterValue, string> = {
  cat: "/typing-theme/bins/cat.bin",
  "cat-glasses": "/typing-theme/bins/cat-glasses.bin",
};
const TYPING_THEME_BIN_FALLBACK = "/typing-theme/bins/cat.bin";
const LCD_CMD_SUBJECT_FLASH_ERASE = 0x1d;
const LCD_CMD_SUBJECT_FLASH_WRITE = 0x1e;

function isLikelyTimeoutError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return /timeout|timed out|no response|did not return/i.test(msg);
}

async function sendLcdStopCommands(deviceComm: { setData: (data: number[]) => Promise<unknown> }) {
  const resetBuffer = new Uint8Array(65);
  resetBuffer[1] = 0xaa;
  resetBuffer[2] = 0x1a;
  await deviceComm.setData(Array.from(resetBuffer));

  const endBuffer = new Uint8Array(65);
  endBuffer[1] = 0xaa;
  endBuffer[2] = 0x11;
  await deviceComm.setData(Array.from(endBuffer));
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
      if (parsed?.dataUrl) {
        draft.videoAsset = {
          name: parsed.name,
          dataUrl: parsed.dataUrl,
          frameLimit: Number.isFinite(parsed.frameLimit) && (parsed.frameLimit ?? 0) > 0 ? Number(parsed.frameLimit) : undefined,
        };
      }
      if (parsed?.speed) draft.videoSpeed = normalizeVideoSpeed(parsed.speed);
    } catch {
      /* keep null */
    }
  }

  return draft;
}

export default function ScreenThemePage() {
  const { keyboard, keyboardLayout } = useContext(ConnectKbContext);
  const { deviceComm, screenWidth, screenHeight, screenInfo, setDownLoad, disconnectDevice } = useContext(MainContext);
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
  const [typingChar1, setTypingChar1] = useState<TypingCharacterValue>("cat");
  const [typingChar2, setTypingChar2] = useState<TypingCharacterValue>("cat-glasses");
  const [personalThemeColors, setPersonalThemeColors] = useState<PersonalThemePalette>(DEFAULT_PERSONAL_THEME_COLORS);
  const [savingSource, setSavingSource] = useState<ImportSource | "typing" | null>(null);
  const [fileName] = useState("XXXX.png");
  const [restored, setRestored] = useState(false);
  const [trimConfirmDialog, setTrimConfirmDialog] = useState<{ open: boolean; frameCount: number }>({
    open: false,
    frameCount: 0,
  });
  const [saveConfirmDialog, setSaveConfirmDialog] = useState<{ open: boolean }>({ open: false });
  type MediaOversizeConfirmKind = "import-gif" | "save-qgif";
  const [oversizeConfirmDialog, setOversizeConfirmDialog] = useState<{ open: boolean; kind: MediaOversizeConfirmKind }>({
    open: false,
    kind: "import-gif",
  });
  const [transferDialog, setTransferDialog] = useState<{ open: boolean; stage: TransferStage; progress: number }>({
    open: false,
    stage: "convert",
    progress: 0,
  });

  const layoutKeys = keyboard?.layoutKeys ?? [];
  const currentLayer = keyboard?.layer ?? 0;
  const userKeys = keyboard?.userKeys?.[currentLayer] ?? [];

  const mappedLayoutKeys = useMemo(
    () => mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeys),
    [layoutKeys, userKeys],
  );

  const lShiftDemoIndex = useMemo(() => findLeftShiftKeyIndex(layoutKeys), [layoutKeys]);

  const imageRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const isSavingToKeyboardRef = useRef(false);
  const trimConfirmResolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const saveConfirmResolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const oversizeConfirmResolverRef = useRef<((accepted: boolean) => void) | null>(null);
  /** 首次从 IDB 灌入两套草稿时跳过自动回写，避免无意义覆盖 */
  const mediaHydratingRef = useRef(false);
  const isTransferLocked = savingSource !== null;

  const askGifTrimConfirm = useCallback((frameCount: number) => {
    return new Promise<boolean>((resolve) => {
      trimConfirmResolverRef.current = resolve;
      setTrimConfirmDialog({ open: true, frameCount });
    });
  }, []);

  const confirmSaveToKeyboard = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      saveConfirmResolverRef.current = resolve;
      setSaveConfirmDialog({ open: true });
    });
  }, []);

  const resolveGifTrimConfirm = useCallback((accepted: boolean) => {
    trimConfirmResolverRef.current?.(accepted);
    trimConfirmResolverRef.current = null;
    setTrimConfirmDialog({ open: false, frameCount: 0 });
  }, []);

  const resolveSaveConfirm = useCallback((accepted: boolean) => {
    saveConfirmResolverRef.current?.(accepted);
    saveConfirmResolverRef.current = null;
    setSaveConfirmDialog({ open: false });
  }, []);

  const askMediaOversizeConfirm = useCallback((kind: MediaOversizeConfirmKind) => {
    return new Promise<boolean>((resolve) => {
      oversizeConfirmResolverRef.current = resolve;
      setOversizeConfirmDialog({ open: true, kind });
    });
  }, []);

  const resolveMediaOversizeConfirm = useCallback((accepted: boolean) => {
    oversizeConfirmResolverRef.current?.(accepted);
    oversizeConfirmResolverRef.current = null;
    setOversizeConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const openTransferDialog = useCallback(() => {
    setTransferDialog({ open: true, stage: "convert", progress: 0 });
  }, []);

  const closeTransferDialog = useCallback(() => {
    setTransferDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const updateTransferStage = useCallback((stage: TransferStage) => {
    setTransferDialog((prev) => ({ ...prev, open: true, stage, progress: stage === "download" ? prev.progress : 0 }));
  }, []);

  const updateTransferProgress = useCallback((progress: number) => {
    setTransferDialog((prev) => ({ ...prev, open: true, stage: "download", progress: Math.max(0, Math.min(100, progress)) }));
  }, []);

  useEffect(() => {
    return () => {
      trimConfirmResolverRef.current?.(false);
      trimConfirmResolverRef.current = null;
      saveConfirmResolverRef.current?.(false);
      saveConfirmResolverRef.current = null;
      oversizeConfirmResolverRef.current?.(false);
      oversizeConfirmResolverRef.current = null;
    };
  }, []);

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

  const applyThemePaletteFromLcd14 = useCallback((read: LcdWorkParam14ReadResult) => {
    if (!read) return;
    const tail = extractLcdWorkTailThemeRgbFrom14Read(read);
    if (!tail) return;
    setPersonalThemeColors((prev) => ({
      ...prev,
      date: rgbToHexOrFallback(tail.timeRgb[0], tail.timeRgb[1], tail.timeRgb[2], prev.date),
      power: rgbToHexOrFallback(tail.batteryRgb[0], tail.batteryRgb[1], tail.batteryRgb[2], prev.power),
      status: rgbToHexOrFallback(tail.iconRgb[0], tail.iconRgb[1], tail.iconRgb[2], prev.status),
    }));
  }, []);

  useEffect(() => {
    if (!deviceComm) return;
    let cancelled = false;
    void (async () => {
      try {
        const read = await readLcdWorkParam14(deviceComm);
        if (cancelled || !read) return;
        applyThemePaletteFromLcd14(read);
      } catch {
        // 无屏幕或未就绪时忽略
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceComm, applyThemePaletteFromLcd14]);

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

  const readDefaultVideoBgAsDataUrl = useCallback(async () => {
    try {
      return await fetchPublicFileAsMediaAsset(
        DEFAULT_VIDEO_BG_STATIC_PATH,
        DEFAULT_VIDEO_BG_STATIC_PATH.split("/").pop() || "default-background.gif",
      );
    } catch {
      throw new Error(t("2574"));
    }
  }, [t]);

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
    let frameLimit: number | undefined;
    let uploadFile: File = file;
    if (isGifFile(file)) {
      let buf = await file.arrayBuffer();
      const frameCount = countGifFrames(buf);
      if (frameCount > MAX_GIF_FRAMES) {
        const shouldTrim = await askGifTrimConfirm(frameCount);
        if (!shouldTrim) return;
        frameLimit = MAX_GIF_FRAMES;
        showMessage({ type: "info", message: t("2564") });
      }
      const compositeCap = frameLimit ?? Math.min(frameCount, MAX_GIF_FRAMES);
      if (file.size > GIF_UPLOAD_MAX_BYTES) {
        const proceedImport = await askMediaOversizeConfirm("import-gif");
        if (!proceedImport) return;
        const shrunk = await shrinkGifArrayBufferToLimit(buf, GIF_UPLOAD_MAX_BYTES, compositeCap);
        if (!shrunk) {
          showMessage({ type: "error", message: t("2584") });
          return;
        }
        buf = shrunk;
        frameLimit = undefined;
        uploadFile = new File([buf], file.name, { type: "image/gif" });
        showMessage({ type: "info", message: t("2583") });
      }
    }
    const dataUrl = await readAsDataUrl(uploadFile);
    patchDraft(mediaEditIsland, { videoAsset: { name: file.name, dataUrl, frameLimit } });
  };

  const restoreVideoBackground = useCallback(async () => {
    try {
      const asset = await readDefaultVideoBgAsDataUrl();
      patchDraft(mediaEditIsland, { videoAsset: { ...asset, frameLimit: undefined } });
      showMessage({ type: "success", message: t("2573") });
    } catch {
      showMessage({ type: "error", message: t("2574") });
    }
  }, [mediaEditIsland, patchDraft, readDefaultVideoBgAsDataUrl, showMessage, t]);

  const onImport = (source: ImportSource) => {
    if (isTransferLocked) return;
    if (source === "theme" && activeTab !== "personal") return;
    setActiveSource(source);
  };

  const pickCurrentSourceFile = () => {
    if (isTransferLocked) return;
    if (activeSource === "theme") return;
    if (activeSource === "video") videoRef.current?.click();
    else if (activeSource === "album") albumRef.current?.click();
    else imageRef.current?.click();
  };

  const convertAssetDataUrlToRgb565WithHeader = useCallback(
    async (dataUrl: string, targetWidth: number, targetHeight: number, rotate: number): Promise<Uint8Array> => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t("1652")));
        img.src = dataUrl;
      });

      const tw = clampLcdTargetDimension(targetWidth, LCD_TARGET_MAX_SIDE);
      const th = clampLcdTargetDimension(targetHeight, LCD_TARGET_MAX_SIDE);

      const { source, close } = await openDownscaledCanvasSourceIfNeeded(image);
      try {
        const { w: srcW, h: srcH } = canvasImageSourceSize(source);
        const needsRotate = rotate === 1 || rotate === 3;
        const outputWidth = needsRotate ? th : tw;
        const outputHeight = needsRotate ? tw : th;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = tw;
        tempCanvas.height = th;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) throw new Error(t("1653"));

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext("2d");
        if (!outputCtx) throw new Error(t("1654"));

        const scale = Math.min(tw / srcW, th / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const offsetX = (tw - drawW) / 2;
        const offsetY = (th - drawH) / 2;

        tempCtx.clearRect(0, 0, tw, th);
        tempCtx.drawImage(source, offsetX, offsetY, drawW, drawH);

        outputCtx.clearRect(0, 0, outputWidth, outputHeight);
        outputCtx.save();
        if (needsRotate) {
          outputCtx.translate(outputWidth / 2, outputHeight / 2);
          const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
          outputCtx.rotate(rotationAngle);
          outputCtx.drawImage(tempCanvas, -tw / 2, -th / 2);
        } else {
          outputCtx.drawImage(tempCanvas, 0, 0);
        }
        outputCtx.restore();

        const pixelData = outputCtx.getImageData(0, 0, outputWidth, outputHeight);
        await yieldMainThreadIfNeeded();
        const rgba = pixelData.data;
        const pixelCount = outputWidth * outputHeight;
        const rgb565 = new Uint8Array(pixelCount * 2);
        await rgbaToRgb565SwappedChunked(rgba, pixelCount, rgb565);

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
      } finally {
        close?.();
      }
    },
    [t],
  );

  const compressPngFramesToQgif = useCallback(
    async (pngFrames: Uint8Array[], fps: number): Promise<Uint8Array> => {
      return compressPngFramesToQgifInWorker(pngFrames, fps);
    },
    [],
  );

  const decomposeGifDataUrlToPngFrames = useCallback(
    async (
      dataUrl: string,
      targetWidth: number,
      targetHeight: number,
      rotate: number,
      frameLimit?: number,
    ): Promise<{ frames: Uint8Array[]; fpsFromGif: number }> => {
      return decomposeGifDataUrlToPngFramesInWorker({
        dataUrl,
        targetWidth,
        targetHeight,
        rotate,
        frameLimit,
        maxGifFrames: MAX_GIF_FRAMES,
        maxDataUrlBytes: GIF_SOURCE_DATAURL_MAX_BYTES,
        maxDecodeBudgetBytes: GIF_DECODE_BUDGET_BYTES,
        maxSourceSide: GIF_SOURCE_MAX_SIDE,
      });
    },
    [],
  );

  const downloadQgifToDevice = useCallback(
    async (qgifData: Uint8Array[], lcdMeta: LcdScreenTransferMeta, payloadType: 0 | 1 = 0) => {
      if (!deviceComm) throw new Error(t("1660"));
      const totalSize = qgifData.reduce((sum, data) => sum + data.length, 0);
      updateTransferProgress(0);
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
        fpsSimple: lcdMeta.fpsSimple,
        fpsDefine: lcdMeta.fpsDefine,
      });

      if (logical15.length > W15_LOGICAL_MAX) {
        throw new Error(
          `QGIF 0x15 功能区超限：${logical15.length} 字节（上限 ${W15_LOGICAL_MAX}），请减少张数`,
        );
      }
      try {
        await sendScreenWorkParam15Packets(deviceComm, logical15);
        await sendLcdScreenWorkAreaSave16(deviceComm);

        const eraseBlocks = Math.max(
          1,
          qgifData.reduce((sum, data) => sum + Math.ceil(data.length / (64 * 1024)), 0),
        );
        updateTransferStage("erase");
        await sendLcdEraseAndWait(deviceComm, eraseBlocks, lcdMeta.islandMode);

        let totalBytesTransferred = 0;
        const step = 56;
        updateTransferStage("download");
        for (let screenIndex = 0; screenIndex < qgifData.length; screenIndex++) {
          const data = qgifData[screenIndex];
          // 对齐 drive_app：当前会话内 0x19 地址从 0 开始，按分片顺序累加。
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
            updateTransferProgress(Math.round((totalBytesTransferred / Math.max(totalSize, 1)) * 100));
          }
        }
        updateTransferProgress(100);
      } finally {
        try {
          // 0x19 成功/失败都要尝试收尾。
          await sendLcdStopCommands(deviceComm);
          await deviceComm.syncTime();
        } catch (closeError) {
          // 收尾失败不覆盖主结果：是否成功只看 0x19 数据分包是否完整发送并收到回应。
          console.warn("[ScreenTheme] QGIF 收尾(1A/11)失败，但不判定本次下载失败", closeError);
        }
      }
    },
    [deviceComm, t, updateTransferProgress, updateTransferStage],
  );

  /** 静态 RGB565：LVGL 4 字节头 + 像素；0x15 与擦写均跟 `lcdMeta.islandMode`（实际保存侧） */
  const downloadStaticRgb565ToDevice = useCallback(
    async (rgb565WithHeader: Uint8Array, lcdMeta: LcdScreenTransferMeta) => {
      if (!deviceComm) throw new Error(t("1660"));
      const data = rgb565WithHeader;
      const totalSize = data.length;
      updateTransferProgress(0);
      const read14 = await readLcdWorkParam14(deviceComm);
      if (!read14) throw new Error(t("1662"));

      const newEntries = [{ metaByte: lcdMeta.metaByte, type: 1 as const, size: totalSize }];
      const logical15 = buildDualIslandWorkLogical15FromReadPatch(read14.rawResponse, read14.parsed, {
        islandBeingSaved: lcdMeta.islandMode,
        newEntries,
        fpsSimple: lcdMeta.fpsSimple,
        fpsDefine: lcdMeta.fpsDefine,
      });
      try {
        await sendScreenWorkParam15Packets(deviceComm, logical15);
        await sendLcdScreenWorkAreaSave16(deviceComm);

        const eraseBlocks = Math.max(1, Math.ceil(totalSize / (64 * 1024)));
        updateTransferStage("erase");
        await sendLcdEraseAndWait(deviceComm, eraseBlocks, lcdMeta.islandMode);

        const step = 56;
        // 对齐 drive_app：当前会话内 0x19 地址从 0 开始。
        let currentAddress = 0;
        let totalBytesTransferred = 0;
        updateTransferStage("download");
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
          updateTransferProgress(Math.round((totalBytesTransferred / Math.max(totalSize, 1)) * 100));
        }
        updateTransferProgress(100);
      } finally {
        try {
          await sendLcdStopCommands(deviceComm);
          await deviceComm.syncTime();
        } catch (closeError) {
          // 收尾失败不覆盖主结果：是否成功只看 0x19 数据分包是否完整发送并收到回应。
          console.warn("[ScreenTheme] RGB565 收尾(1A/11)失败，但不判定本次下载失败", closeError);
        }
      }
    },
    [deviceComm, t, updateTransferProgress, updateTransferStage],
  );

  const syncVideoSpeedFuncBytes = useCallback(
    async (mode: "video" | "clear"): Promise<boolean> => {
      if (!deviceComm) {
        showMessage({ type: "error", message: t("1660") });
        return false;
      }

      const speedIndex = VIDEO_SPEED_OPTIONS.findIndex((o) => o.value === videoSpeed);
      const indexValue = speedIndex >= 0 ? speedIndex : 0;
      const byteValue = mode === "video" ? indexValue : 0;

      try {
        await readMergeSendLcdWorkAreaScreenTail(
          deviceComm,
          mediaEditIsland === "personal" ? { fpsDefine: byteValue } : { fpsSimple: byteValue },
        );
      } catch {
        showMessage({ type: "error", message: t("1660") });
        return false;
      }

      return true;
    },
    [deviceComm, mediaEditIsland, showMessage, t, videoSpeed],
  );

  /** 与 `syncVideoSpeedFuncBytes` 字节一致，合并进媒体下发时的单次 0x15，避免保存前多发一帧功能区 */
  const lcdFpsMetaPatch = useCallback(
    (mode: "video" | "clear"): { fpsSimple?: number; fpsDefine?: number } => {
      const speedIndex = VIDEO_SPEED_OPTIONS.findIndex((o) => o.value === videoSpeed);
      const indexValue = mode === "video" ? (speedIndex >= 0 ? speedIndex : 0) : 0;
      return mediaEditIsland === "personal" ? { fpsDefine: indexValue } : { fpsSimple: indexValue };
    },
    [mediaEditIsland, videoSpeed],
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
      openTransferDialog();
      updateTransferStage("convert");
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
        await yieldMainThreadIfNeeded();
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
          ...lcdFpsMetaPatch("clear"),
        },
        1,
      );
      showMessage({ type: "success", message: t("1647") });
    } catch {
      showMessage({ type: "error", message: t("1648") });
    } finally {
      closeTransferDialog();
      setDownLoad(false);
      setSavingSource(null);
    }
  }, [
    albumAssets,
    compressPngFramesToQgif,
    closeTransferDialog,
    openTransferDialog,
    updateTransferStage,
    deviceComm,
    downloadQgifToDevice,
    setDownLoad,
    intervalSec,
    convertAssetDataUrlToRgb565WithHeader,
    screenHeight,
    screenInfo,
    screenWidth,
    showMessage,
    lcdFpsMetaPatch,
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
    try {
      setSavingSource("video");
      setDownLoad(true);
      openTransferDialog();
      updateTransferStage("convert");
      const targetW = Math.max(1, Number(screenWidth) || 240);
      const targetH = Math.max(1, Number(screenHeight) || 136);
      const rotate = Number((screenInfo as unknown as { rotate?: number } | undefined)?.rotate ?? 0);

      // 你要求：调用 QGIF 转换前先下发 0x1B
      const startBuffer = new Uint8Array(65);
      startBuffer[1] = 0xaa;
      startBuffer[2] = 0x1b;
      startBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(startBuffer));

      const { frames, fpsFromGif } = await decomposeGifDataUrlToPngFrames(
        videoAsset.dataUrl,
        targetW,
        targetH,
        rotate,
        videoAsset.frameLimit,
      );
      console.info(`[ScreenTheme] 本次下载 GIF 帧数: ${frames.length}`);
      const fps = isNativeGifPlaybackSpeed(videoSpeed) ? fpsFromGif : getScreenThemeGifPlaybackFps(videoSpeed);
      let qgifBin: Uint8Array;
      let qgifTrimmedForLimit = false;
      try {
        const capped = await compressPngFramesToQgifWithinPayloadLimit(
          frames,
          fps,
          GIF_UPLOAD_MAX_BYTES,
          compressPngFramesToQgif,
        );
        qgifBin = capped.bin;
        qgifTrimmedForLimit = capped.trimmed;
        if (capped.trimmed) {
          console.info(
            `[ScreenTheme] QGIF 超过 ${GIF_UPLOAD_MAX_BYTES} 字节，已按 ${capped.usedFrames}/${frames.length} 帧下发`,
          );
        }
      } catch (e) {
        if (e instanceof Error && e.message === "QGIF_SINGLE_FRAME_EXCEEDS_PAYLOAD_LIMIT") {
          showMessage({ type: "error", message: t("2587") });
          return;
        }
        throw e;
      }
      if (qgifTrimmedForLimit) {
        const proceedSave = await askMediaOversizeConfirm("save-qgif");
        if (!proceedSave) {
          try {
            await sendLcdStopCommands(deviceComm);
          } catch (stopErr) {
            console.warn("[ScreenTheme] 取消保存视频时 LCD 收尾(1A/11)失败", stopErr);
          }
          return;
        }
      }
      const metaByte = encodeLcdImageMetaByte({
        imageSlotCount: 1,
        animType: 0,
        intervalCode: 0,
      });
      await downloadQgifToDevice([qgifBin], {
        metaByte,
        islandMode: lcdEraseIslandModeFromMediaIsland(mediaEditIsland),
        ...lcdFpsMetaPatch("video"),
      });
      showMessage({ type: "success", message: qgifTrimmedForLimit ? t("2586") : t("1650") });
    } catch (err) {
      console.error("[ScreenTheme] 保存视频到键盘失败", err);
      if (
        err instanceof Error &&
        (err.message === "GIF_INPUT_TOO_LARGE" ||
          err.message === "GIF_DECODE_BUDGET_EXCEEDED" ||
          err.message === "GIF_WORKER_TIMEOUT" ||
          err.message === "GIF_WORKER_RUNTIME_ERROR" ||
          err.message === "GIF_WORKER_UNAVAILABLE" ||
          err.message === "QGIF_MODULE_SCRIPT_NOT_FOUND" ||
          err.message === "QGIF_MODULE_FACTORY_INVALID" ||
          err.message === "QGIF_MODULE_NOT_READY" ||
          err.message === "QGIF_COMPRESS_FAILED" ||
          err.message === "QGIF_WORKER_TIMEOUT" ||
          err.message === "QGIF_WORKER_RUNTIME_ERROR" ||
          err.message === "QGIF_WORKER_UNAVAILABLE")
      ) {
        showMessage({ type: "error", message: t("2584") });
      } else {
        showMessage({ type: "error", message: t("1651") });
      }
    } finally {
      closeTransferDialog();
      setDownLoad(false);
      setSavingSource(null);
    }
  }, [
    videoAsset?.dataUrl,
    videoAsset?.frameLimit,
    closeTransferDialog,
    openTransferDialog,
    updateTransferStage,
    deviceComm,
    setDownLoad,
    t,
    screenWidth,
    screenHeight,
    screenInfo,
    decomposeGifDataUrlToPngFrames,
    videoSpeed,
    lcdFpsMetaPatch,
    compressPngFramesToQgif,
    downloadQgifToDevice,
    showMessage,
    mediaEditIsland,
    setSavingSource,
    askMediaOversizeConfirm,
  ]);

  const convertImageDataUrlToRgb565Swap = useCallback(
    async (dataUrl: string, targetWidth: number, targetHeight: number, rotate: number) => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(t("1652")));
        img.src = dataUrl;
      });

      const tw = clampLcdTargetDimension(targetWidth, LCD_TARGET_MAX_SIDE);
      const th = clampLcdTargetDimension(targetHeight, LCD_TARGET_MAX_SIDE);

      const { source, close } = await openDownscaledCanvasSourceIfNeeded(image);
      try {
        const { w: srcW, h: srcH } = canvasImageSourceSize(source);
        const needsRotate = rotate === 1 || rotate === 3;
        const outputWidth = needsRotate ? th : tw;
        const outputHeight = needsRotate ? tw : th;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = tw;
        tempCanvas.height = th;
        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) throw new Error(t("1653"));

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext("2d");
        if (!outputCtx) throw new Error(t("1654"));

        const scale = Math.min(tw / srcW, th / srcH);
        const drawW = srcW * scale;
        const drawH = srcH * scale;
        const offsetX = (tw - drawW) / 2;
        const offsetY = (th - drawH) / 2;

        tempCtx.clearRect(0, 0, tw, th);
        tempCtx.drawImage(source, offsetX, offsetY, drawW, drawH);

        outputCtx.clearRect(0, 0, outputWidth, outputHeight);
        outputCtx.save();
        if (needsRotate) {
          outputCtx.translate(outputWidth / 2, outputHeight / 2);
          const rotationAngle = rotate === 1 ? Math.PI / 2 : (3 * Math.PI) / 2;
          outputCtx.rotate(rotationAngle);
          outputCtx.drawImage(tempCanvas, -tw / 2, -th / 2);
        } else {
          outputCtx.drawImage(tempCanvas, 0, 0);
        }
        outputCtx.restore();

        // RGBA -> RGB565 (R5G6B5), then swap bytes to match firmware order.
        const pixelData = outputCtx.getImageData(0, 0, outputWidth, outputHeight);
        await yieldMainThreadIfNeeded();
        const rgba = pixelData.data;
        const pixelCount = outputWidth * outputHeight;

        const rgb565 = new Uint8Array(pixelCount * 2);

        await rgbaToRgb565SwappedChunked(rgba, pixelCount, rgb565);

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
      } finally {
        close?.();
      }
    },
    [t],
  );

  const loadTypingThemeBinByChar = useCallback(
    async (char: TypingCharacterValue): Promise<Uint8Array> => {
      const candidates = [TYPING_THEME_BIN_MAP[char], TYPING_THEME_BIN_FALLBACK];
      for (const url of candidates) {
        try {
          const resp = await fetch(url, { cache: "no-store" });
          if (!resp.ok) continue;
          const ab = await resp.arrayBuffer();
          const out = new Uint8Array(ab);
          if (out.length > 0) return out;
        } catch {
          // try next candidate
        }
      }
      throw new Error(t("2558"));
    },
    [t],
  );

  const tryStopLcdTransfer = useCallback(async (): Promise<boolean> => {
    if (!deviceComm) return false;
    try {
      const resetBuffer = new Uint8Array(65);
      resetBuffer[1] = 0xaa;
      resetBuffer[2] = 0x1a;
      await deviceComm.setData(Array.from(resetBuffer));

      const endBuffer = new Uint8Array(65);
      endBuffer[1] = 0xaa;
      endBuffer[2] = 0x11;
      await deviceComm.setData(Array.from(endBuffer));
      return true;
    } catch {
      return false;
    }
  }, [deviceComm]);

  /**
   * 打字主题专用：按固件 subject 区协议下发（0x1D 擦除、0x1E 写入），
   * 不走 0x14/0x15 功能区，也不走 0x18/0x19 灵动岛资源区。
   */
  type TypingSubjectBinOpts = {
    /** 仅首包擦写前切到「擦除中」；第二路 subject 续传时为 false，避免进度条阶段被重置 */
    showEraseStage?: boolean;
    /** 单路 payload 写入进度 0–100（不含擦除阶段） */
    onWriteProgress?: (pctWithinPayload: number) => void;
  };

  const downloadTypingSubjectBinToDevice = useCallback(
    async (payload: Uint8Array, subjectSlot: 0 | 1, opts?: TypingSubjectBinOpts) => {
      if (!deviceComm) throw new Error(t("1660"));
      const { showEraseStage = true, onWriteProgress } = opts ?? {};
      const eraseBlocks = Math.max(1, Math.ceil(payload.length / (64 * 1024)));

      const eraseBuffer = new Uint8Array(65);
      eraseBuffer[1] = 0xaa;
      eraseBuffer[2] = LCD_CMD_SUBJECT_FLASH_ERASE;
      eraseBuffer[6] = 0x38;
      eraseBuffer[7] = subjectSlot;
      eraseBuffer[9] = eraseBlocks & 0xff;
      if (showEraseStage) {
        updateTransferStage("erase");
      }
      try {
        await deviceComm.setData(Array.from(eraseBuffer));
      } catch (e) {
        throw new Error(`Subject erase timeout (cmd=0x1D, slot=${subjectSlot}, blocks=${eraseBlocks})`);
      }

      if (showEraseStage) {
        updateTransferStage("download");
        onWriteProgress?.(0);
      }

      const step = 56;
      let addr = 0;
      for (let i = 0; i < payload.length; i += step) {
        const writeBuffer = new Uint8Array(65);
        writeBuffer[1] = 0xaa;
        writeBuffer[2] = LCD_CMD_SUBJECT_FLASH_WRITE;
        writeBuffer[3] = addr & 0xff;
        writeBuffer[4] = (addr >> 8) & 0xff;
        writeBuffer[5] = (addr >> 16) & 0xff;
        const bytesToSend = Math.min(step, payload.length - i);
        writeBuffer[6] = bytesToSend;
        writeBuffer[7] = subjectSlot;
        writeBuffer.set(payload.slice(i, i + bytesToSend), 9);
        try {
          await deviceComm.setData(Array.from(writeBuffer));
        } catch {
          throw new Error(
            `Subject write timeout (cmd=0x1E, slot=${subjectSlot}, addr=${addr}, len=${bytesToSend})`,
          );
        }
        await settleBetweenLcd19Packets();
        addr += bytesToSend;
        const pct = Math.round(Math.min(100, ((i + bytesToSend) / payload.length) * 100));
        onWriteProgress?.(pct);
      }
    },
    [deviceComm, t, updateTransferStage],
  );

  const saveThemeColorsToKeyboard = useCallback(async (): Promise<boolean> => {
    if (!deviceComm) {
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

      await readMergeSendLcdWorkAreaScreenTail(deviceComm, {
        timeRgb: [timeRgb[0], timeRgb[1], timeRgb[2]],
        batteryRgb: [batteryRgb[0], batteryRgb[1], batteryRgb[2]],
        iconRgb: [statusRgb[0], statusRgb[1], statusRgb[2]],
      });

      showMessage({ type: "success", message: t("2546") });
      return true;
    } catch {
      showMessage({ type: "error", message: t("2547") });
      return false;
    } finally {
      setSavingSource(null);
    }
  }, [deviceComm, personalThemeColors.date, personalThemeColors.power, personalThemeColors.status, showMessage, t]);

  const saveTypingThemeToKeyboard = useCallback(async () => {
    if (!deviceComm) {
      showMessage({ type: "error", message: t("1660") });
      return;
    }

    setSavingSource("typing");
    setDownLoad(true);
    openTransferDialog();
    updateTransferStage("convert");
    updateTransferProgress(0);

    try {
      let bin1: Uint8Array;
      let bin2: Uint8Array;
      try {
        bin1 = await loadTypingThemeBinByChar(typingChar1);
        bin2 = await loadTypingThemeBinByChar(typingChar2);
      } catch {
        showMessage({ type: "warning", message: t("2558") });
        return;
      }
      if (!bin1.length || !bin2.length) {
        showMessage({ type: "warning", message: t("2592") });
        return;
      }

      const synced = await syncVideoSpeedFuncBytes("clear");
      if (!synced) return;

      // AP_START
      const startBuffer = new Uint8Array(65);
      startBuffer[1] = 0xaa;
      startBuffer[2] = 0x1b;
      startBuffer[6] = 0x38;
      await deviceComm.setData(Array.from(startBuffer));

      // 打字主题：专用 subject 擦写链路；进度条与图片/相册下发一致（转换 → 擦除 → 下载）
      await downloadTypingSubjectBinToDevice(bin1, 0, {
        showEraseStage: true,
        onWriteProgress: (p) => updateTransferProgress(Math.round(p * 0.5)),
      });
      await downloadTypingSubjectBinToDevice(bin2, 1, {
        showEraseStage: false,
        onWriteProgress: (p) => updateTransferProgress(50 + Math.round(p * 0.5)),
      });
      updateTransferProgress(100);

      // 正常完成也必须发送 1A + 11 结束流程。
      const stopped = await tryStopLcdTransfer();
      if (!stopped) {
        await disconnectDevice?.();
        showMessage({ type: "error", message: t("2559") });
        return;
      }
      showMessage({ type: "success", message: t("2555") });
    } catch (error) {
      if (isLikelyTimeoutError(error)) {
        const stopped = await tryStopLcdTransfer();
        if (!stopped) {
          await disconnectDevice?.();
          showMessage({ type: "error", message: t("2559") });
          return;
        }
      }
      showMessage({ type: "error", message: error instanceof Error ? error.message : t("1662") });
    } finally {
      closeTransferDialog();
      setDownLoad(false);
      setSavingSource(null);
    }
  }, [
    closeTransferDialog,
    deviceComm,
    disconnectDevice,
    downloadTypingSubjectBinToDevice,
    loadTypingThemeBinByChar,
    openTransferDialog,
    setDownLoad,
    showMessage,
    syncVideoSpeedFuncBytes,
    t,
    tryStopLcdTransfer,
    typingChar1,
    typingChar2,
    updateTransferProgress,
    updateTransferStage,
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
      openTransferDialog();
      updateTransferStage("convert");
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
        ...lcdFpsMetaPatch("clear"),
      });
      showMessage({ type: "success", message: t("1661") });
    } catch {
      showMessage({ type: "error", message: t("1662") });
    } finally {
      closeTransferDialog();
      setDownLoad(false);
      isSavingToKeyboardRef.current = false;
      setSavingSource(null);
    }
  }, [
    closeTransferDialog,
    convertImageDataUrlToRgb565Swap,
    deviceComm,
    downloadStaticRgb565ToDevice,
    openTransferDialog,
    setDownLoad,
    imageAsset?.dataUrl,
    screenHeight,
    screenInfo,
    screenWidth,
    showMessage,
    lcdFpsMetaPatch,
    t,
    updateTransferStage,
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

  /** 基础灵动岛：无 IndexedDB 草稿时注入 `public/image.png` 为默认图片 */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (basicDraft.imageAsset) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(DEFAULT_BASIC_MEDIA_PATH, "image.png");
        if (cancelled) return;
        setBasicDraft((prev) => (prev.imageAsset ? prev : { ...prev, imageAsset: asset }));
      } catch (e) {
        console.warn("[ScreenTheme] 基础灵动岛默认图片加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, basicDraft.imageAsset]);

  /** 个性化灵动岛：无本地草稿时注入 `public/image1.png` 为默认「图片」 */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (personalDraft.imageAsset) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(DEFAULT_PERSONAL_MEDIA_PATH, "image1.png");
        if (cancelled) return;
        setPersonalDraft((prev) => (prev.imageAsset ? prev : { ...prev, imageAsset: asset }));
      } catch (e) {
        console.warn("[ScreenTheme] 个性化灵动岛默认图片加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, personalDraft.imageAsset]);

  /** 基础灵动岛：无相册草稿时注入单张默认图 */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (basicDraft.albumAssets.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(DEFAULT_BASIC_MEDIA_PATH, "image.png");
        if (cancelled) return;
        setBasicDraft((prev) =>
          prev.albumAssets.length > 0 ? prev : { ...prev, albumAssets: [{ name: asset.name, dataUrl: asset.dataUrl }], albumIndex: 0 },
        );
      } catch (e) {
        console.warn("[ScreenTheme] 基础灵动岛默认相册加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, basicDraft.albumAssets.length]);

  /** 个性化灵动岛：无相册草稿时注入单张默认图 */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (personalDraft.albumAssets.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(DEFAULT_PERSONAL_MEDIA_PATH, "image1.png");
        if (cancelled) return;
        setPersonalDraft((prev) =>
          prev.albumAssets.length > 0 ? prev : { ...prev, albumAssets: [{ name: asset.name, dataUrl: asset.dataUrl }], albumIndex: 0 },
        );
      } catch (e) {
        console.warn("[ScreenTheme] 个性化灵动岛默认相册加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, personalDraft.albumAssets.length]);

  /** 基础灵动岛：无视频草稿时注入默认 GIF */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (basicDraft.videoAsset) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(
          DEFAULT_VIDEO_BG_STATIC_PATH,
          DEFAULT_VIDEO_BG_STATIC_PATH.split("/").pop() || "default-background.gif",
        );
        if (cancelled) return;
        setBasicDraft((prev) => (prev.videoAsset ? prev : { ...prev, videoAsset: { ...asset, frameLimit: undefined } }));
      } catch (e) {
        console.warn("[ScreenTheme] 基础灵动岛默认视频占位加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, basicDraft.videoAsset]);

  /** 个性化灵动岛：无视频草稿时注入同一默认 GIF（与基础岛视频占位一致） */
  useEffect(() => {
    if (!restored || mediaHydratingRef.current) return;
    if (personalDraft.videoAsset) return;
    let cancelled = false;
    void (async () => {
      try {
        const asset = await fetchPublicFileAsMediaAsset(
          DEFAULT_VIDEO_BG_STATIC_PATH,
          DEFAULT_VIDEO_BG_STATIC_PATH.split("/").pop() || "default-background.gif",
        );
        if (cancelled) return;
        setPersonalDraft((prev) => (prev.videoAsset ? prev : { ...prev, videoAsset: { ...asset, frameLimit: undefined } }));
      } catch (e) {
        console.warn("[ScreenTheme] 个性化灵动岛默认视频占位加载失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restored, personalDraft.videoAsset]);

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
          gifFrameLimit={activeSource === "video" ? videoAsset?.frameLimit : undefined}
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
          onSaveToKeyboard={async () => {
            const ok = await confirmSaveToKeyboard();
            if (!ok) return false;
            return await saveThemeColorsToKeyboard();
          }}
        />
      ) : activeSource === "image" ? (
        <ScreenThemeImageSettingsPanel
          fileName={basicFileName}
          isSaving={savingSource === "image"}
          isLocked={isTransferLocked}
          onSelectFile={pickCurrentSourceFile}
          onSaveToKeyboard={async () => {
            const ok = await confirmSaveToKeyboard();
            if (!ok) return;
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
          onRestoreBackground={() => {
            void restoreVideoBackground();
          }}
          onSaveToKeyboard={async () => {
            const ok = await confirmSaveToKeyboard();
            if (!ok) return;
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
          onSaveToKeyboard={async () => {
            const ok = await confirmSaveToKeyboard();
            if (!ok) return;
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
        screenWidth={screenWidth}
        screenHeight={screenHeight}
        char1={typingChar1}
        char2={typingChar2}
        onChar1Change={setTypingChar1}
        onChar2Change={setTypingChar2}
        isSaving={savingSource === "typing"}
        isLocked={isTransferLocked}
        onSaveToKeyboard={async () => {
          const ok = await confirmSaveToKeyboard();
          if (!ok) return;
          void saveTypingThemeToKeyboard();
        }}
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

  const transferStageText =
    transferDialog.stage === "convert"
      ? t("2566")
      : transferDialog.stage === "erase"
        ? t("2567")
        : `${t("2568")} ${transferDialog.progress}%`;

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
      <ScreenThemeConfirmDialog
        open={saveConfirmDialog.open}
        title={t("2565")}
        content={t("2714")}
        cancelText={t("2570")}
        confirmText={t("2569")}
        onCancel={() => resolveSaveConfirm(false)}
        onConfirm={() => resolveSaveConfirm(true)}
      />
      <ScreenThemeConfirmDialog
        open={trimConfirmDialog.open}
        title={t("2565")}
        content={`${t("2563")} (${trimConfirmDialog.frameCount} -> ${MAX_GIF_FRAMES})`}
        cancelText={t("2570")}
        confirmText={t("2569")}
        onCancel={() => resolveGifTrimConfirm(false)}
        onConfirm={() => resolveGifTrimConfirm(true)}
      />
      <ScreenThemeConfirmDialog
        open={oversizeConfirmDialog.open}
        title={t("2565")}
        content={t(oversizeConfirmDialog.kind === "save-qgif" ? "2591" : "2590")}
        cancelText={t("2570")}
        confirmText={t("2569")}
        onCancel={() => resolveMediaOversizeConfirm(false)}
        onConfirm={() => resolveMediaOversizeConfirm(true)}
      />
      <Dialog
        open={transferDialog.open}
        onClose={() => {}}
        disableEscapeKeyDown
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{t("2565")}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1, color: "#334155", fontSize: "0.9375rem" }}>{transferStageText}</Typography>
          <LinearProgress
            variant={transferDialog.stage === "download" ? "determinate" : "indeterminate"}
            value={transferDialog.progress}
            sx={{ height: "0.5rem", borderRadius: "0.375rem" }}
          />
        </DialogContent>
      </Dialog>

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
            onToggleKey={() => {}}
            demoHighlightKeyIndex={lShiftDemoIndex >= 0 ? lShiftDemoIndex : undefined}
            demoHighlightTitle={lShiftDemoIndex >= 0 ? t("1665") : undefined}
          />
        </Box>
      </Box>
      <ScreenThemeKeyboardLegend variant={activeTab === "typing" ? "typing" : "media"} />

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
