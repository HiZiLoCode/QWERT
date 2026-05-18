"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Box, IconButton, Stack } from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import ChevronRight from "@mui/icons-material/ChevronRight";
import { MainContext } from "@/providers/MainProvider";
import { useTranslation } from "@/app/i18n";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";
import ScreenThemeGifCanvasPlayer from "./ScreenThemeGifCanvasPlayer";

type AlbumCarouselProps = {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

function isGifDataUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /^data:image\/gif/i.test(url);
}

type Props = {
  previewUrl?: string | null;
  /** 导入相册：多图时左右切换与指示点；自动轮播由页面按「播放间隔」驱动 index */
  albumCarousel?: AlbumCarouselProps | null;
  /** 有值且预览为 GIF 时用 canvas 按该速度播放（与右侧「播放速度」联动） */
  gifPlaybackSpeed?: string | null;
  /** 上传超限 GIF 时，仅预览前 N 帧（与下发到设备一致） */
  gifFrameLimit?: number;
  /**
   * 「导入视频」且尚无预览 dataUrl 时，用 `public/` 下该路径作为占位图（如 `/screen-theme/default-background.gif`）。
   * 与 `assetPrefix: "./"` 兼容：在客户端解析为相对当前页的 URL。
   */
  videoEmptyFallbackPublicPath?: string | null;
};

function resolvePublicImgSrc(absolutePath: string | null | undefined): string | null {
  if (!absolutePath) return null;
  if (typeof window === "undefined") return absolutePath;
  if (!absolutePath.startsWith("/")) return absolutePath;
  try {
    return new URL(`.${absolutePath}`, window.location.href).href;
  } catch {
    return absolutePath;
  }
}

const toCssPx = (v: number) => `${v}px`;

const PLACEHOLDER_BG =
  "linear-gradient(135deg, #ff8a4a 0%, #4a7cff 45%, #ff3c5c 78%, #9aa3ad 100%)";

/** 中间预览区：GIF 在「视频」源下用 canvas 按所选 fps 播放，否则用 img；虚线框表示设备裁切区域 */
export default function ScreenThemePreview({
  previewUrl,
  albumCarousel,
  gifPlaybackSpeed,
  gifFrameLimit,
  videoEmptyFallbackPublicPath,
}: Props) {
  const { screenWidth, screenHeight } = useContext(MainContext);
  const { t } = useTranslation("common");
  const sv = useScreenThemeVisual();
  const [gifEngineFallback, setGifEngineFallback] = useState(false);

  const resolvedVideoFallbackSrc = useMemo(
    () => resolvePublicImgSrc(videoEmptyFallbackPublicPath ?? null),
    [videoEmptyFallbackPublicPath],
  );

  useEffect(() => {
    setGifEngineFallback(false);
  }, [previewUrl]);

  const onGifEngineError = useCallback(() => {
    setGifEngineFallback(true);
  }, []);

  // 「正常播放」保持浏览器原生 GIF 渲染，避免 canvas 解码差异导致预览形变。
  const useCanvasGif =
    Boolean(gifPlaybackSpeed) &&
    (gifPlaybackSpeed !== "native" || Boolean(gifFrameLimit && gifFrameLimit > 0)) &&
    isGifDataUrl(previewUrl) &&
    !gifEngineFallback;
  const safeW = Math.max(1, Number(screenWidth) || 240);
  const safeH = Math.max(1, Number(screenHeight) || 136);

  const frameRect = useMemo(() => {
    const innerW = 175;
    const innerH = 380;

    let w = innerW;
    let h = (w * safeH) / safeW;
    if (h > innerH) {
      h = innerH;
      w = (h * safeW) / safeH;
    }
    return {
      width: Math.round(w),
      height: Math.round(h),
      left: Math.round((innerW - w) / 2),
      top: Math.round((innerH - h) / 2),
    };
  }, [safeW, safeH]);

  const showArrows = albumCarousel && albumCarousel.total > 1;

  return (
    <Box
      sx={{
        flexShrink: 0,
        width: "400px",
        minHeight: "400px",
        mx: 36,
        border: `1px solid ${sv.primary}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "13px",
        background: sv.previewOuterBg,
        boxShadow: "inset 0 2px 4px rgba(0, 0, 0, 0.25)",
      }}
    >
      <Box
        sx={{
          position: "relative",
          width: "175px",
          height: "380px",
          borderRadius: "12px",
          overflow: "hidden",
          background: sv.previewInnerBg,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.07)",
        }}
      >
        {!previewUrl ? (
          resolvedVideoFallbackSrc ? (
            <Box
              component="img"
              src={resolvedVideoFallbackSrc}
              alt=""
              sx={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                display: "block",
                userSelect: "none",
                pointerEvents: "none",
              }}
            />
          ) : (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background: PLACEHOLDER_BG,
              }}
            />
          )
        ) : useCanvasGif && previewUrl && gifPlaybackSpeed ? (
          <ScreenThemeGifCanvasPlayer
            dataUrl={previewUrl}
            playbackSpeed={gifPlaybackSpeed}
            maxFrames={gifFrameLimit}
            onEngineError={onGifEngineError}
          />
        ) : (
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        )}

        {showArrows && (
          <>
            <IconButton
              type="button"
              size="small"
              aria-label={t("1666")}
              onClick={(e) => {
                e.stopPropagation();
                albumCarousel.onPrev();
              }}
              sx={{
                position: "absolute",
                left: "4px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2,
                bgcolor: "rgba(255,255,255,0.92)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                "&:hover": { bgcolor: "#fff" },
              }}
            >
              <ChevronLeft sx={{ fontSize: "20px", color: sv.textDark }} />
            </IconButton>
            <IconButton
              type="button"
              size="small"
              aria-label={t("1667")}
              onClick={(e) => {
                e.stopPropagation();
                albumCarousel.onNext();
              }}
              sx={{
                position: "absolute",
                right: "4px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 2,
                bgcolor: "rgba(255,255,255,0.92)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                "&:hover": { bgcolor: "#fff" },
              }}
            >
              <ChevronRight sx={{ fontSize: "20px", color: sv.textDark }} />
            </IconButton>
            <Stack
              direction="row"
              spacing={0.5}
              sx={{
                position: "absolute",
                bottom: "8px",
                left: 0,
                right: 0,
                justifyContent: "center",
                alignItems: "center",
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              {Array.from({ length: albumCarousel.total }).map((_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    bgcolor: i === albumCarousel.index ? sv.primary : "rgba(0,0,0,0.22)",
                    transition: "background-color 0.2s ease",
                  }}
                />
              ))}
            </Stack>
          </>
        )}

        <Box
          sx={{
            position: "absolute",
            left: toCssPx(frameRect.left),
            top: toCssPx(frameRect.top),
            width: toCssPx(frameRect.width),
            height: toCssPx(frameRect.height),
            borderRadius: "12px",
            border: `2px dashed ${sv.previewCropDash}`,
            pointerEvents: "none",
            boxSizing: "border-box",
            zIndex: 1,
          }}
        />
      </Box>
    </Box>
  );
}
