"use client";

import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import type { ScreenThemeTab } from "./types";
import { screenThemeColors } from "./theme";
import { screenThemeFilledPillButtonSx, screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";

const NAV_ITEMS: { id: ScreenThemeTab; labelKey: string }[] = [
  { id: "basic", labelKey: "1601" },
  { id: "personal", labelKey: "1602" },
  { id: "typing", labelKey: "1603" },
];

type Props = {
  activeTab: ScreenThemeTab;
  onTabChange: (tab: ScreenThemeTab) => void;
  /** 与白卡主区间距，不再用右侧灰线 */
  embedded?: boolean;
  disabled?: boolean;
};

export default function ScreenThemeSidebar({ activeTab, onTabChange, embedded, disabled = false }: Props) {
  const { t } = useTranslation("common");

  return (
    <Box
      sx={{
        flexShrink: 0,
        alignSelf: "flex-start",
        boxSizing: "border-box",
        mr: embedded ? 2.5 : 0,
        fontWeight: 400,
        fontSize: "0.875rem",
        borderRadius: "0.75rem",
        px: 1.75,
        pt: 1.5,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        width: "16.5rem",
        background: "#F9F9F9",
        marginRight: "2rem",
        height: "100%",
        padding: "1.5rem 1.25rem",
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontSize: "1rem",
          fontWeight: 400,
          color: "rgba(100, 116, 139, 1)",
          letterSpacing: "0.02em",
          mb: 20,
          lineHeight: 1.3,
          textAlign: "left",
        }}
      >
        {t("1600")}
      </Typography>


      <Box
        component="nav"
        aria-label={t("1600")}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "0.625rem",
          width: "100%",


        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <Button
              key={item.id}
              fullWidth
              variant="text"
              disableElevation
              disabled={disabled}
              onClick={() => onTabChange(item.id)}
              sx={{
                justifyContent: "center",
                height: "3rem",
                ...(active ? screenThemeFilledPillButtonSx : screenThemeOutlinedPillButtonSx),
                ...(active
                  ? {}
                  : {
                      color: "#66778f",
                      "&:hover": {
                        backgroundColor: "#fff",
                        borderColor: screenThemeColors.primary,
                        boxShadow: "0 0 0 0.1875rem rgba(0, 102, 255, 0.2)",
                        color: "#0066ff",
                      },
                    }),
              }}
            >
              {t(item.labelKey)}
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
