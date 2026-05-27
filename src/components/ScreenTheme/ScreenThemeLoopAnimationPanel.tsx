"use client";

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
import { useMemo } from "react";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "@/app/i18n";
import { getComfortableScrollbarSx } from "@/utils/comfortableScrollbarSx";
import { resolvePublicAssetUrl } from "@/utils/resolvePublicAssetUrl";
import { getScreenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { INTERVAL_OPTIONS } from "./options";
import {
  getScreenThemeSelectMenuItemSx,
  getScreenThemeSelectMenuProps,
  getScreenThemeSelectSx,
} from "./screenThemeSelectStyles";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";
import ScreenThemePreview from "./ScreenThemePreview";
import { LOOP_ANIMATION_PRESETS, type LoopAnimationPresetId } from "./loopAnimationPresets";

type Props = {
  selectedId: LoopAnimationPresetId;
  onSelect: (id: LoopAnimationPresetId) => void;
  /** 已缓存的 data URL，仅用于「保存至键盘」；预览用 public 路径，避免加载时闪屏 */
  previewDataUrl: string | null;
  intervalSec: string;
  onIntervalChange: (v: string) => void;
  onSaveToKeyboard?: () => void | Promise<void>;
  isSaving?: boolean;
  isLocked?: boolean;
};

/** 左侧四列缩略图区域宽度（与图二比例一致） */
const LEFT_COLUMN_W = "50%";

export default function ScreenThemeLoopAnimationPanel({
  selectedId,
  onSelect,
  previewDataUrl,
  intervalSec,
  onIntervalChange,
  onSaveToKeyboard,
  isSaving = false,
  isLocked = false,
}: Props) {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const sv = useScreenThemeVisual();

  const previewDisplayUrl = useMemo(() => {
    const preset = LOOP_ANIMATION_PRESETS.find((p) => p.id === selectedId);
    return preset?.gifPath ? resolvePublicAssetUrl(preset.gifPath) : null;
  }, [selectedId]);
  const outlinedSx = getScreenThemeOutlinedPillButtonSx(sv);
  const selectSx = getScreenThemeSelectSx(sv);
  const selectMenuProps = getScreenThemeSelectMenuProps(sv);
  const menuItemSx = getScreenThemeSelectMenuItemSx(sv);

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: "260px",
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        overflow: "auto",
        p: 25,
        gap: 0,
        boxSizing: "border-box",
        borderRadius: "20px",
        backgroundColor: sv.cardBg,
        border: `1px solid ${sv.panelBorder}`,
        ...getComfortableScrollbarSx(theme.palette.mode === "dark"),
      }}
    >
      {/* 左：主题动画缩略图（与图二整体一致） */}
      <Box
        sx={{
          flexShrink: 0,
          width: LEFT_COLUMN_W,
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          justifyContent: "flex-start",
        }}
      >
        <Box sx={{  display: "flex", alignItems: "center", gap: "8px" }}>
          <Typography
            sx={{
              fontSize: "18px",
              fontWeight: 600,
              color: sv.textDark,
              lineHeight: 1.35,
            }}
          >
            {t("2941")}
          </Typography>
          <Typography sx={{ fontSize: "14px", color: sv.textMuted, lineHeight: 1.55 }}>
            {t("2942")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            gap: "14px",
            width: "100%",
          }}
        >
          {LOOP_ANIMATION_PRESETS.map((preset) => {
            const active = selectedId === preset.id;
            const disabled = Boolean(preset.disabled) || isLocked;
            const thumbSrc = preset.gifPath ? resolvePublicAssetUrl(preset.gifPath) : null;
            return (
              <Box
                key={preset.id}
                component="button"
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onSelect(preset.id);
                }}
                sx={{
                  borderRadius: "20px",
                  background: "rgba(255, 255, 255, 1)",
                  boxShadow: "0px 2px 4px 1px rgba(176, 206, 255, 0.25)",
                  padding: "14px",
                  order: "none",
                  m: 0,
                  cursor: disabled ? "not-allowed" : "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "8px",
                  opacity: disabled ? 0.55 : 1,
                }}
              >
                <Box
                  sx={{
                    aspectRatio: "9 / 16",
                    borderRadius: "12px",
                    overflow: "hidden",
                    border: active ? `2px solid ${sv.primary}` : `1px solid ${sv.borderLight}`,
                    boxShadow: active ? `0 0 0 3px ${sv.primaryGlow}` : "0 2px 2px rgba(0,0,0,0.04)",
                    bgcolor: disabled
                      ? theme.palette.mode === "dark"
                        ? "#2a2a2a"
                        : "#e8ecf1"
                      : "#0f172a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {thumbSrc ? (
                    <Box
                      component="img"
                      src={thumbSrc}
                      alt=""
                      sx={{ width: "94px", height: "174.88px", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <Typography sx={{ fontSize: "12px", width: "94px", height: "174.88px", color: sv.textMuted, px: 0.5, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t(preset.labelKey)}
                    </Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontSize: "13px",
                    fontWeight: active ? 600 : 500,
                    color: active ? sv.primary : sv.textMuted,
                    textAlign: "center",
                    lineHeight: 1.3,
                  }}
                >
                  {t(preset.labelKey)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Divider orientation="vertical" variant="middle" flexItem sx={{ m: 12 }} />

      {/* 右：与基础灵动岛「导入视频」右侧区（图一）一致 */}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          pl: 1,
          pr: 0.5,
        }}
      >
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
                color: sv.textMuted,
                fontSize: "16px",
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
                color: sv.textMuted,
                fontSize: "16px",
                lineHeight: 1.55,
              }}
            >
              {t("1632")}
            </Typography>
          </Box>
          <Button
            variant="text"
            disableElevation
            disabled={isSaving || isLocked || !onSaveToKeyboard || !previewDataUrl}
            onClick={() => void onSaveToKeyboard?.()}
            sx={{
              ...outlinedSx,
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

        <Divider sx={{ borderColor: sv.borderLight, mt: "19px", mb: "36px" }} />

        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            flex: 1,
            minHeight: 0,
            gap: 0,
          }}
        >
          <Box sx={{ flexShrink: 0 }}>
            <ScreenThemePreview previewUrl={previewDisplayUrl} gifPlaybackSpeed="native" />
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-start",
              pl: 2.5,
              pt: "12px",
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                flexWrap: "wrap",
              }}
            >
              <Typography variant="body2" sx={{ color: sv.textDark, minWidth: "88px", fontSize: "14px" }}>
                {t("1612")}
              </Typography>
              <FormControl size="small" sx={{ minWidth: "172px" }}>
                <Select
                  value={INTERVAL_OPTIONS.some((o) => o.value === intervalSec) ? intervalSec : INTERVAL_OPTIONS[1]!.value}
                  disabled={isLocked || isSaving}
                  onChange={(e: SelectChangeEvent) => onIntervalChange(e.target.value)}
                  sx={selectSx}
                  MenuProps={selectMenuProps}
                >
                  {INTERVAL_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value} sx={menuItemSx}>
                      {t(o.labelKey)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
