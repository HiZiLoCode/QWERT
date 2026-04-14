"use client";

import { Box, Divider, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import type { ImportSource } from "./types";
import ScreenThemeImportPanel from "./ScreenThemeImportPanel";
import ScreenThemePreview from "./ScreenThemePreview";

type Props = {
  activeSource: ImportSource;
  previewUrl?: string | null;
  gifPlaybackSpeed?: string | null;
  onImport: (source: ImportSource) => void;
};

export default function ScreenThemeTypingPanel({ activeSource, previewUrl, gifPlaybackSpeed, onImport }: Props) {
  const { t } = useTranslation("common");
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: "16.25rem",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        p: 3,
        gap: 0,
        boxSizing: "border-box",
        borderRadius: "1.25rem",
        background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 100%)",
        border: "0.0625rem solid rgba(181,187,196,0.32)",
      }}
    >
      <ScreenThemeImportPanel activeSource={activeSource} onImport={onImport} />
      <Divider orientation="vertical" variant="middle" flexItem sx={{ my: 12 }} />
      <ScreenThemePreview previewUrl={previewUrl} gifPlaybackSpeed={gifPlaybackSpeed} />
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ color: "#71839b", fontSize: "0.875rem" }}>{t("1669")}</Typography>
      </Box>
    </Box>
  );
}

