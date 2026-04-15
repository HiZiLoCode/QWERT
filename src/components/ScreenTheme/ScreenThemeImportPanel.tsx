"use client";

import { Box, Button } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import type { ImportSource } from "./types";
import { screenThemeFilledPillButtonSx, screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";

const SOURCES: { id: ImportSource; labelKey: string }[] = [
  { id: "theme", labelKey: "2535" },
  { id: "image", labelKey: "1606" },
  { id: "album", labelKey: "1607" },
  { id: "video", labelKey: "1608" },
];

export type ThemeColorSlotProps = {
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
};

type Props = {
  activeSource: ImportSource;
  /** 选中来源并触发对应文件选择 */
  onImport: (source: ImportSource) => void;
  disabled?: boolean;
  /** 个性化主题：与三个导入入口同级，仅本地保存（与基础灵动岛分库存储） */
  themeColorSlot?: ThemeColorSlotProps | null;
};

export default function ScreenThemeImportPanel({
  activeSource,
  onImport,
  disabled = false,
  themeColorSlot = null,
}: Props) {
  const { t } = useTranslation("common");
  const visibleSources = themeColorSlot ? SOURCES : SOURCES.filter((item) => item.id !== "theme");

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        justifyContent: "center",
        alignItems: "center",
        flexShrink: 0,
        width: "16.75rem",
      }}
    >
      {visibleSources.map((s) => {
        const active = activeSource === s.id;
        return (
          <Button
            key={s.id}
            fullWidth
            variant="text"
            disableElevation
            disabled={disabled}
            onClick={() => onImport(s.id)}
            sx={{
              justifyContent: "center",
              py: 1,
              width: "13.875rem",
              height: "3rem",
              minWidth: 0,
              ...(active ? screenThemeFilledPillButtonSx : screenThemeOutlinedPillButtonSx),
            }}
          >
            {t(s.labelKey)}
          </Button>
        );
      })}
    </Box>
  );
}
