"use client";

import { Box, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import ScreenThemeSyncTimeButton from "./ScreenThemeSyncTimeButton";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";

type Props = {
  timeLabel: string;
  onSyncTime: () => Promise<boolean>;
};

export default function ScreenThemeTopBar({ timeLabel, onSyncTime }: Props) {
  const { t } = useTranslation("common");
  const sv = useScreenThemeVisual();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        backgroundColor: sv.sidebarBg,
        border: `${sv.sidebarBorder}`,
        height: "80px",
        padding: "28px 32px",
        marginBottom: "30px",
        borderRadius: "12px",
        boxShadow: sv.boxShadow,
      }}
    >
      <Typography variant="body1" sx={{ color: sv.textDark, fontWeight: 500 }}>
        {t("1604")}
        {timeLabel}
      </Typography>
      <ScreenThemeSyncTimeButton onSync={onSyncTime} />
    </Box>
  );
}
