"use client";

import { Box, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import ScreenThemeSyncTimeButton from "./ScreenThemeSyncTimeButton";

type Props = {
  timeLabel: string;
  onSyncTime: () => Promise<boolean>;
};

export default function ScreenThemeTopBar({ timeLabel, onSyncTime }: Props) {
  const { t } = useTranslation("common");

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        background: "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)",
        height: "5rem",
        padding: "1.75rem 2rem",
        marginBottom: "1.875rem",
        borderRadius: "0.75rem",
      }}
    >
      <Typography variant="body1" sx={{ color: screenThemeColors.textDark, fontWeight: 500 }}>
        {t("1604")}
        {timeLabel}
      </Typography>
      <ScreenThemeSyncTimeButton onSync={onSyncTime} />
    </Box>
  );
}
