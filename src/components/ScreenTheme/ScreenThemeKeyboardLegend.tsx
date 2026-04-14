"use client";

import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import { screenThemePillRadius } from "./screenThemeButtonSx";

type LegendId = "theme" | "island";

const CIRCLE_REM = "1.125rem";

export default function ScreenThemeKeyboardLegend() {
  const { t } = useTranslation("common");
  const [active, setActive] = useState<LegendId>("theme");

  const row = (id: LegendId, labelKey: string, borderColor: string) => {
    const on = active === id;
    return (
      <Box
        component="button"
        type="button"
        onClick={() => setActive(id)}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          px: 0.75,
          py: 0.5,
          borderRadius: screenThemePillRadius,
          "&:hover": {
            backgroundColor: "rgba(0, 102, 255, 0.06)",
            boxShadow: "0 0 0 0.125rem rgba(0, 102, 255, 0.18)",
          },
        }}
      >
        <Box
          sx={{
            width: CIRCLE_REM,
            height: CIRCLE_REM,
            borderRadius: "50%",
            flexShrink: 0,
            border: `0.125rem solid ${borderColor}`,
            background: on ? `${borderColor}14` : "transparent",
            boxSizing: "border-box",
          }}
        />
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.8125rem",
            color: screenThemeColors.textDark,
            fontWeight: on ? 600 : 500,
            textAlign: "left",
          }}
        >
          {t(labelKey)}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 20,
        mb: 26,
        pr: { xs: 282, sm: 282 },
        flexShrink: 0,
      }}
    >
      {row("theme", "1627", "rgba(0, 102, 255, 1)")}
      {row("island", "1628", "rgba(255, 0, 60, 1)")}
    </Box>
  );
}
