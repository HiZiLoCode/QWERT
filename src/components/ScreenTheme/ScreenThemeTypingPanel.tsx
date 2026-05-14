"use client";

import { useMemo } from "react";
import {
  Box,
  Button,
  Divider,
  FormControl,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Typography,
} from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import { screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import {
  SCREEN_THEME_SELECT_CORNER,
  screenThemeSelectMenuItemSx,
  screenThemeSelectMenuProps,
  screenThemeSelectSx,
} from "./screenThemeSelectStyles";

const CHAR_OPTIONS = [
  { value: "cat", labelKey: "2552" },
  { value: "cat-glasses", labelKey: "2553" },
] as const;
export type TypingCharacterValue = (typeof CHAR_OPTIONS)[number]["value"];

const TYPING_CHAR_SRC: Record<TypingCharacterValue, string> = {
  cat: "/typing-theme-cat.svg",
  "cat-glasses": "/typing-theme-cat-glasses.png",
};

function typingCharSrc(value: string): string {
  return TYPING_CHAR_SRC[value as keyof typeof TYPING_CHAR_SRC] ?? TYPING_CHAR_SRC.cat;
}

type Props = {
  /** 与 MainProvider / ScreenThemePreview 同源（设备 screen 尺寸） */
  screenWidth: number;
  screenHeight: number;
  char1: TypingCharacterValue;
  char2: TypingCharacterValue;
  onChar1Change: (v: TypingCharacterValue) => void;
  onChar2Change: (v: TypingCharacterValue) => void;
  onSaveToKeyboard?: () => void | Promise<void>;
  isSaving?: boolean;
  isLocked?: boolean;
};

/** 预览框按设备真实像素宽高（screenWidth×screenHeight）；仅在不进面板时再整体等比缩小 */
function typingPreviewFramePixels(sw: number, sh: number) {
  const w0 = Math.max(1, Math.round(Number(sw) || 240));
  const h0 = Math.max(1, Math.round(Number(sh) || 136));

  const gapPx = 24;
  const maxPreviewHeight = 420;
  const maxPairWidth = 720;

  let s = 1;
  if (h0 > maxPreviewHeight) s = Math.min(s, maxPreviewHeight / h0);
  const pairW = 2 * w0 + gapPx;
  if (pairW > maxPairWidth) s = Math.min(s, (maxPairWidth - gapPx) / (2 * w0));

  return {
    width: Math.max(1, Math.round(w0 * s)),
    height: Math.max(1, Math.round(h0 * s)),
  };
}

function TypingPreviewCard({
  imageSrc,
  caption,
  frameWidth,
  frameHeight,
}: {
  imageSrc: string;
  caption: string;
  frameWidth: number;
  frameHeight: number;
}) {
  /** 稿图：标题在蓝框上方、左对齐；蓝框为实线圆角饱和蓝边，内为渐变衬底 + 居中预览 */
  const blueFrame = screenThemeColors.primary;
  const innerPreviewSx = {
    position: "relative" as const,
    width: frameWidth,
    height: frameHeight,
    borderRadius: "10px",
    overflow: "hidden",
    background: "linear-gradient(165deg, #fff5fb 0%, #f3f7ff 42%, #faf3ff 100%)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55), inset 0 0 36px rgba(255, 182, 220, 0.1)",
    margin: "34px 95px 34px 128px",

  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "10px",
        width: "fit-content",
        maxWidth: "100%",
        margin: "0px 43px",
        height: "100%",
        justifyContent: "space-around"
      }}
    >
      <Typography
        sx={{
          fontSize: "18px",
          fontWeight: 400,
          color: "#5c6470",
          lineHeight: 1.35,
          letterSpacing: "0.01em",
          alignSelf: "stretch",
        }}
      >
        {caption}
      </Typography>
      <Box
        sx={{
          p: "10px",
          borderRadius: "12px",
          border: `2px solid ${blueFrame}`,
          bgcolor: "#fafbfd",
          boxSizing: "border-box",
          boxShadow: "0 2px 10px rgba(37, 99, 235, 0.08)",
        }}
      >
        <Box sx={innerPreviewSx}>
          <Box
            component="img"
            src={imageSrc}
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
        </Box>
      </Box>
    </Box>
  );
}

export default function ScreenThemeTypingPanel({
  screenWidth,
  screenHeight,
  char1,
  char2: _char2,
  onChar1Change,
  onChar2Change: _onChar2Change,
  onSaveToKeyboard,
  isSaving = false,
  isLocked = false,
}: Props) {
  const { t } = useTranslation("common");
  const frame = useMemo(() => typingPreviewFramePixels(screenWidth, screenHeight), [screenWidth, screenHeight]);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: "260px",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        overflow: "auto",
        p: 25,
        gap: 0,
        boxSizing: "border-box",
        borderRadius: "20px",
        backgroundColor: screenThemeColors.cardBg,
        border: "1px solid rgba(181,187,196,0.32)",
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 126,



        }}
      >
        <TypingPreviewCard
          key={`c1-${char1}`}
          imageSrc={typingCharSrc(char1)}
          caption={t("2550")}
          frameWidth={frame.width}
          frameHeight={frame.height}
        />
        {/* <TypingPreviewCard
          key={`c2-${char2}`}
          imageSrc={typingCharSrc(char2)}
          caption={t("2551")}
          frameWidth={frame.width}
          frameHeight={frame.height}
        /> */}
      </Box>

      <Divider orientation="vertical" variant="middle" flexItem sx={{ my: 12 }} />

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.25, pl: 35, pr: 16 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 192px)" }}>
            <Typography
              variant="caption"
              component="p"
              sx={{
                m: 0,
                color: screenThemeColors.textMuted,
                fontSize: "18px",
                lineHeight: 1.55,
              }}
            >
              {t("1631")}
            </Typography>
            <Typography
              variant="caption"
              component="p"
              sx={{
                m: 0,
                mt: "6px",
                color: screenThemeColors.textMuted,
                fontSize: "18px",
                lineHeight: 1.55,
              }}
            >
              {t("1632")}
            </Typography>
          </Box>
          <Button
            variant="text"
            disableElevation
            disabled={isSaving || isLocked || !onSaveToKeyboard}
            onClick={() => void onSaveToKeyboard?.()}
            sx={{
              ...screenThemeOutlinedPillButtonSx,
              flexShrink: 0,
              px: 2.5,
              py: 0.75,
              width: "172px",
              minWidth: "172px",
            }}
          >
            {isSaving ? t("1645") : t("1609")}
          </Button>
        </Box>

        <Divider sx={{ borderColor: screenThemeColors.borderLight, mt: 19, mb: 36 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 61 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography
              variant="body2"
              sx={{ color: screenThemeColors.textDark, fontWeight: 500, fontSize: "18px", minWidth: "72px" }}
            >
              {t("2550")}：
            </Typography>
            <FormControl size="small" sx={{ minWidth: "172px" }}>
              <Select
                value={char1}
                disabled={isLocked}
                onChange={(e: SelectChangeEvent) => onChar1Change(e.target.value as TypingCharacterValue)}
                sx={screenThemeSelectSx}
                MenuProps={screenThemeSelectMenuProps}
              >
                {CHAR_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value} sx={screenThemeSelectMenuItemSx}>
                    {t(o.labelKey)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography
              variant="body2"
              sx={{ color: screenThemeColors.textDark, fontWeight: 400, fontSize: "18px", minWidth: "72px" }}
            >
              {t("2551")}：
            </Typography>
            <Box
              sx={{
                minWidth: "172px",
                minHeight: "36px",
                px: 1.5,
                py: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
                borderRadius: SCREEN_THEME_SELECT_CORNER,
                fontSize: "14px",
                fontWeight: 500,
                color: screenThemeColors.textMuted,
                bgcolor: "#ffffff",
                border: `1px solid ${screenThemeColors.borderLight}`,
                userSelect: "none",
              }}
              aria-disabled
            >
              {t("2894")}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
