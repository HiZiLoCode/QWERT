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
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <Box
        sx={{
          position: "relative",
          width: frameWidth,
          height: frameHeight,
          borderRadius: "0.75rem",
          overflow: "hidden",
          background: "rgba(241,243,247,0.95)",
          boxShadow: "inset 0 0 0 0.0625rem rgba(0,0,0,0.07)",
        }}
      >
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
      <Typography
        sx={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: screenThemeColors.textDark,
          textAlign: "center",
        }}
      >
        {caption}
      </Typography>
    </Box>
  );
}

export default function ScreenThemeTypingPanel({
  screenWidth,
  screenHeight,
  char1,
  char2,
  onChar1Change,
  onChar2Change,
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
      <Box
        sx={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 126,
          pl: 95,
          pr: 128,
          py: 2,
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
          <Box sx={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 12rem)" }}>
            <Typography
              variant="caption"
              component="p"
              sx={{
                m: 0,
                color: screenThemeColors.textMuted,
                fontSize: "0.75rem",
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
                mt: "0.375rem",
                color: screenThemeColors.textMuted,
                fontSize: "0.75rem",
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
              width: "10.75rem",
              minWidth: "10.75rem",
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
              sx={{ color: screenThemeColors.textDark, fontWeight: 500, fontSize: "0.875rem", minWidth: "4.5rem" }}
            >
              {t("2550")}：
            </Typography>
            <FormControl size="small" sx={{ minWidth: "10.75rem" }}>
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

          {/* <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography
              variant="body2"
              sx={{ color: screenThemeColors.textDark, fontWeight: 500, fontSize: "0.875rem", minWidth: "4.5rem" }}
            >
              {t("2551")}：
            </Typography>
            <FormControl size="small" sx={{ minWidth: "10.75rem" }}>
              <Select
                value={char2}
                disabled={isLocked}
                onChange={(e: SelectChangeEvent) => onChar2Change(e.target.value as TypingCharacterValue)}
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
          </Box> */}
        </Box>
      </Box>
    </Box>
  );
}
