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
        backgroundColor: screenThemeColors.cardBg,
        height: "80px",
        padding: "28px 32px",
        marginBottom: "30px",
        borderRadius: "12px",
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
