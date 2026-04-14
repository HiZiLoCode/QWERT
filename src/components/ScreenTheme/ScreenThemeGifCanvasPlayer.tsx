"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { parseGIF, decompressFrames, type ParsedFrame } from "gifuct-js";
import { getScreenThemeGifPlaybackFps, isNativeGifPlaybackSpeed } from "./screenThemeGifPlaybackFps";

type Props = {
  dataUrl: string;
  playbackSpeed: string;
  /** 解析或绘制失败时由父级改回 <img> */
  onEngineError?: () => void;
};

function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(b64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

function drawFramePatch(
  accCtx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  frame: ParsedFrame,
) {
  if (!frame.patch?.length) return;
  const { width, height, left, top } = frame.dims;
  scratch.width = width;
  scratch.height = height;
  const sctx = scratch.getContext("2d");
  if (!sctx) return;
  const rgba = new Uint8ClampedArray(frame.patch);
  sctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  accCtx.drawImage(scratch, left, top);
}

/** 按所选「播放速度」帧率绘制 GIF（非浏览器原生 GIF 计时） */
const PLACEHOLDER_BG =
  "linear-gradient(135deg, #ff8a4a 0%, #4a7cff 45%, #ff3c5c 78%, #9aa3ad 100%)";

/** 与父级预览区一致：用 CSS 像素做 contain，避免固定 175×380 位图被另一宽高比的 CSS 盒子非等比拉伸 */
function layoutContainCss(cssW: number, cssH: number, gifW: number, gifH: number) {
  const scale = Math.min(cssW / gifW, cssH / gifH);
  const dw = gifW * scale;
  const dh = gifH * scale;
  const ox = (cssW - dw) / 2;
  const oy = (cssH - dh) / 2;
  return { ox, oy, dw, dh };
}

export default function ScreenThemeGifCanvasPlayer({ dataUrl, playbackSpeed, onEngineError }: Props) {
  const onEngineErrorRef = useRef(onEngineError);
  onEngineErrorRef.current = onEngineError;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const layoutCssRef = useRef({ w: 0, h: 0 });
  const blitRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<{
    frames: ParsedFrame[];
    gifW: number;
    gifH: number;
    acc: HTMLCanvasElement;
    idx: number;
  } | null>(null);
  const speedRef = useRef(playbackSpeed);
  speedRef.current = playbackSpeed;

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    stateRef.current = null;

    const run = async () => {
      try {
        const buf = dataUrlToArrayBuffer(dataUrl);
        const gif = parseGIF(buf);
        const frames = decompressFrames(gif, true) as ParsedFrame[];
        if (!frames.length) {
          if (!cancelled) {
            setPhase("error");
            onEngineErrorRef.current?.();
          }
          return;
        }
        const gifW = gif.lsd.width;
        const gifH = gif.lsd.height;
        const acc = document.createElement("canvas");
        acc.width = gifW;
        acc.height = gifH;
        const accCtx = acc.getContext("2d");
        if (!accCtx) {
          if (!cancelled) {
            setPhase("error");
            onEngineErrorRef.current?.();
          }
          return;
        }
        if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
        const scratch = scratchRef.current;
        accCtx.clearRect(0, 0, gifW, gifH);
        drawFramePatch(accCtx, scratch, frames[0]);
        stateRef.current = { frames, gifW, gifH, acc, idx: 0 };
        if (!cancelled) setPhase("ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
          onEngineErrorRef.current?.();
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  useEffect(() => {
    if (phase !== "ready") return;
    const display = displayRef.current;
    const wrap = wrapRef.current;
    const st = stateRef.current;
    if (!display || !wrap || !st) return;
    const dctx = display.getContext("2d");
    if (!dctx) return;

    const { frames, gifW, gifH, acc } = st;
    let idx = st.idx;
    let last = performance.now();
    let raf = 0;

    const syncBitmapToLayout = () => {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2.5);
      const cssW = Math.max(1, Math.round(wrap.clientWidth));
      const cssH = Math.max(1, Math.round(wrap.clientHeight));
      layoutCssRef.current = { w: cssW, h: cssH };
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (display.width !== bw || display.height !== bh) {
        display.width = bw;
        display.height = bh;
      }
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const blit = () => {
      syncBitmapToLayout();
      const { w: cssW, h: cssH } = layoutCssRef.current;
      dctx.clearRect(0, 0, cssW, cssH);
      const { ox, oy, dw, dh } = layoutContainCss(cssW, cssH, gifW, gifH);
      dctx.drawImage(acc, 0, 0, gifW, gifH, ox, oy, dw, dh);
    };

    blitRef.current = blit;

    const ro = new ResizeObserver(() => {
      blitRef.current?.();
    });
    ro.observe(wrap);

    const scratch = scratchRef.current!;
    const accCtx = acc.getContext("2d")!;

    const tick = (now: number) => {
      const speed = speedRef.current;
      const msPerFrame = isNativeGifPlaybackSpeed(speed)
        ? Math.max(frames[idx]?.delay ?? 100, 16)
        : Math.max(1000 / getScreenThemeGifPlaybackFps(speed), 16);
      if (now - last >= msPerFrame) {
        last = now;
        const next = (idx + 1) % frames.length;
        if (next === 0) {
          accCtx.clearRect(0, 0, gifW, gifH);
          drawFramePatch(accCtx, scratch, frames[0]);
          idx = 0;
        } else {
          const prev = frames[idx];
          if (prev.disposalType === 2) {
            accCtx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
          }
          idx = next;
          drawFramePatch(accCtx, scratch, frames[idx]);
        }
        st.idx = idx;
        blit();
      }
      raf = requestAnimationFrame(tick);
    };

    blit();
    raf = requestAnimationFrame(tick);
    return () => {
      ro.disconnect();
      blitRef.current = null;
      cancelAnimationFrame(raf);
    };
  }, [phase, dataUrl]);

  return (
    <Box ref={wrapRef} sx={{ position: "absolute", inset: 0 }}>
      {(phase === "loading" || phase === "error") && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: PLACEHOLDER_BG,
            zIndex: 0,
          }}
        />
      )}
      <Box
        component="canvas"
        ref={displayRef}
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
          zIndex: 1,
          opacity: phase === "ready" ? 1 : 0,
        }}
      />
    </Box>
  );
}
