"use client";

import { Box, Button, Divider, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { getScreenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";

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
  const sv = useScreenThemeVisual();
  const outlinedSx = getScreenThemeOutlinedPillButtonSx(sv);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, pl: 1 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
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
          disabled={isSaving}
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

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" sx={{ color: sv.textDark, fontWeight: 400, fontSize: "16px" }}>
          {t("1610")} {fileName}
        </Typography>
        <Button
          variant="text"
          disableElevation
          disabled={isLocked}
          onClick={onSelectFile}
          sx={{
            ...outlinedSx,
            flexShrink: 0,
            width: "172px",
            height: "36px",
          }}
        >
          {t("1611")}
        </Button>
      </Box>
    </Box>
  );
}
