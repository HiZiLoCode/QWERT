"use client";

import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import type { ScreenThemeTab } from "./types";
import { getScreenThemeFilledPillButtonSx, getScreenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { useScreenThemeVisual } from "./ScreenThemeVisualContext";

const NAV_ITEMS: { id: ScreenThemeTab; labelKey: string }[] = [
  { id: "basic", labelKey: "1601" },
  // 个性化灵动岛（选项暂隐藏）
  // { id: "personal", labelKey: "1602" },
  { id: "typing", labelKey: "1603" },
  { id: "loopAnimation", labelKey: "2940" },
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
  const sv = useScreenThemeVisual();
  const filledSx = getScreenThemeFilledPillButtonSx(sv);
  const outlinedSx = getScreenThemeOutlinedPillButtonSx(sv);

  return (
    <Box
      sx={{
        flexShrink: 0,
        alignSelf: "flex-start",
        boxSizing: "border-box",
        mr: embedded ? 2.5 : 0,
        fontWeight: 400,
        fontSize: "14px",
        borderRadius: "12px",
        px: 1.75,
        pt: 1.5,
        pb: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        width: "264px",
        background: sv.sidebarBg,
        border: sv.sidebarBorder,
        boxShadow: sv.boxShadow,
        marginRight: "32px",
        height: "100%",
        
        padding: "24px 20px",
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontSize: "16px",
          fontWeight: 400,
          color: sv.textMuted,
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
          gap: "10px",
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
                height: "48px",
                ...(active ? filledSx : outlinedSx),
                ...(active
                  ? {}
                  : {
                      color: sv.textMuted,
                      "&:hover": {
                        backgroundColor: sv.pillOutlinedBg,
                        borderColor: sv.primary,
                        boxShadow: `0 0 0 3px ${sv.primaryGlow}`,
                        color: sv.primary,
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
