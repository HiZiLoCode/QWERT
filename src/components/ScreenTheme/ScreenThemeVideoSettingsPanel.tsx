"use client";

import { Box, Button, Divider, FormControl, MenuItem, Select, type SelectChangeEvent, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { getScreenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { VIDEO_SPEED_OPTIONS } from "./options";
import {
  getScreenThemeSelectMenuItemSx,
  getScreenThemeSelectMenuProps,
  getScreenThemeSelectSx,
} from "./screenThemeSelectStyles";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";

type Props = {
  fileName: string;
  speed: string;
  onSpeedChange: (v: string) => void;
  onSelectFile: () => void;
  onRestoreBackground: () => void;
  onSaveToKeyboard: () => void;
  isSaving?: boolean;
  isLocked?: boolean;
};

export default function ScreenThemeVideoSettingsPanel({
  fileName,
  speed,
  onSpeedChange,
  onSelectFile,
  onRestoreBackground,
  onSaveToKeyboard,
  isSaving = false,
  isLocked = false,
}: Props) {
  const { t } = useTranslation("common");
  const sv = useScreenThemeVisual();
  const outlinedSx = getScreenThemeOutlinedPillButtonSx(sv);
  const selectSx = getScreenThemeSelectSx(sv);
  const selectMenuProps = getScreenThemeSelectMenuProps(sv);
  const menuItemSx = getScreenThemeSelectMenuItemSx(sv);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.25, pl: 1, pr: 0.5 }}>
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
              fontSize: "12px",
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
              fontSize: "12px",
              lineHeight: 1.55,
            }}
          >
            {t("1632")}
          </Typography>
        </Box>
        <Button
          variant="text"
          disableElevation
          disabled={isSaving || isLocked}
          onClick={onSaveToKeyboard}
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

      <Divider sx={{ borderColor: sv.borderLight, mt: 19, mb: 36 }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography
            variant="body2"
            sx={{ color: sv.textDark, fontWeight: 500, fontSize: "14px", wordBreak: "break-all", pr: 1 }}
          >
            {t("1635")}
            {fileName}
          </Typography>
          <Button
            variant="text"
            disableElevation
            disabled={isLocked}
            onClick={onSelectFile}
            sx={{
              ...outlinedSx,
              flexShrink: 0,
              minHeight: "36px",
              width: "172px",
              minWidth: "172px",
            }}
          >
            {t("1636")}
          </Button>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "space-between", mt: 61 }}>
          <Typography variant="body2" sx={{ color: sv.textDark, minWidth: "88px", fontSize: "14px" }}>
            {t("1637")}
          </Typography>
          <FormControl size="small" sx={{ minWidth: "172px" }}>
            <Select
              value={VIDEO_SPEED_OPTIONS.some((o) => o.value === speed) ? speed : VIDEO_SPEED_OPTIONS[0]!.value}
              disabled={isLocked}
              onChange={(e: SelectChangeEvent) => onSpeedChange(e.target.value)}
              sx={selectSx}
              MenuProps={selectMenuProps}
            >
              {VIDEO_SPEED_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={menuItemSx}>
                  {t(o.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "space-between", mt: 61 }}>
          <Typography variant="body2" sx={{ color: sv.textDark, minWidth: "88px", fontSize: "14px" }}>
            {t("2571")}
          </Typography>
          <Button
            variant="text"
            disableElevation
            disabled={isLocked || isSaving}
            onClick={onRestoreBackground}
            sx={{
              ...outlinedSx,
              flexShrink: 0,
              minHeight: "36px",
              width: "172px",
              minWidth: "172px",
            }}
          >
            {t("2572")}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
