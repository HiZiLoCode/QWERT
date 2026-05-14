"use client";

import { Box, Button, Divider, FormControl, MenuItem, Select, type SelectChangeEvent, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import { screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { VIDEO_SPEED_OPTIONS } from "./options";
import {
  screenThemeSelectMenuItemSx,
  screenThemeSelectMenuProps,
  screenThemeSelectSx,
} from "./screenThemeSelectStyles";

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
              color: screenThemeColors.textMuted,
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
              color: screenThemeColors.textMuted,
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

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography
            variant="body2"
            sx={{ color: screenThemeColors.textDark, fontWeight: 500, fontSize: "14px", wordBreak: "break-all", pr: 1 }}
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
              ...screenThemeOutlinedPillButtonSx,
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
          <Typography variant="body2" sx={{ color: screenThemeColors.textDark, minWidth: "88px", fontSize: "14px" }}>
            {t("1637")}
          </Typography>
          <FormControl size="small" sx={{ minWidth: "172px" }}>
            <Select
              value={VIDEO_SPEED_OPTIONS.some((o) => o.value === speed) ? speed : VIDEO_SPEED_OPTIONS[0]!.value}
              disabled={isLocked}
              onChange={(e: SelectChangeEvent) => onSpeedChange(e.target.value)}
              sx={screenThemeSelectSx}
              MenuProps={screenThemeSelectMenuProps}
            >
              {VIDEO_SPEED_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={screenThemeSelectMenuItemSx}>
                  {t(o.labelKey)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", justifyContent: "space-between", mt: 61 }}>
          <Typography variant="body2" sx={{ color: screenThemeColors.textDark, minWidth: "88px", fontSize: "14px" }}>
            {t("2571")}
          </Typography>
          <Button
            variant="text"
            disableElevation
            disabled={isLocked || isSaving}
            onClick={onRestoreBackground}
            sx={{
              ...screenThemeOutlinedPillButtonSx,
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
