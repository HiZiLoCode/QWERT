"use client";

import { Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import { screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";

type Props = {
  fileName: string;
  onSelectFile: () => void;
  onSaveToKeyboard: () => void;
  isSaving?: boolean;
  isLocked?: boolean;
};

export default function ScreenThemeImageSettingsPanel({
  fileName,
  onSelectFile,
  onSaveToKeyboard,
  isSaving = false,
  isLocked = false,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, pl: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          flexWrap: "nowrap",
        }}
      >
        <Typography variant="caption" sx={{ color: screenThemeColors.textMuted, lineHeight: 1.65, display: "block" }}>
          {t("1626")}
        </Typography>

        <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
          <Button
            variant="text"
            disableElevation
            disabled={isSaving}
            onClick={onSaveToKeyboard}
            sx={{
              ...screenThemeOutlinedPillButtonSx,
              width: "10.75rem",
              height: "2.25rem",
            }}
          >
            {isSaving ? t("1645") : t("1609")}
          </Button>
        </Box>
      </Box>

      <Divider sx={{ borderColor: screenThemeColors.borderLight, mt: 19, mb: 36 }} />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: screenThemeColors.textDark, fontWeight: 400, fontSize: "1rem" }}>
          {t("1610")} {fileName}
        </Typography>
        <Button
          variant="text"
          disableElevation
          disabled={isLocked}
          onClick={onSelectFile}
          sx={{
            ...screenThemeOutlinedPillButtonSx,
            flexShrink: 0,
            width: "10.75rem",
            height: "2.25rem",
          }}
        >
          {t("1611")}
        </Button>
      </Box>
    </Box>
  );
}

