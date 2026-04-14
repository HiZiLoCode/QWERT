"use client";

import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import type { ImportSource } from "./types";
import { screenThemeFilledPillButtonSx, screenThemeOutlinedPillButtonSx } from "./screenThemeButtonSx";
import { screenThemeColors } from "./theme";

const SOURCES: { id: ImportSource; labelKey: string }[] = [
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
  const colorInputId = "screen-theme-personal-theme-color";

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
      {themeColorSlot ? (
        <Box
          component="label"
          htmlFor={colorInputId}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.5,
            width: "13.875rem",
            height: "3rem",
            px: 1.5,
            boxSizing: "border-box",
            borderRadius: "0.75rem",
            border: `0.0625rem solid rgba(181, 187, 196, 0.55)`,
            cursor: themeColorSlot.disabled ? "default" : "pointer",
            "&:hover": themeColorSlot.disabled
              ? {}
              : {
                  borderColor: screenThemeColors.primary,
                },
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color: screenThemeColors.textDark,
              flex: 1,
              minWidth: 0,
            }}
          >
            {t("2535")}
          </Typography>
          <Box
            sx={{
              width: "1.75rem",
              height: "1.75rem",
              borderRadius: "0.375rem",
              border: "0.0625rem solid rgba(0,0,0,0.12)",
              overflow: "hidden",
              flexShrink: 0,
              backgroundColor: themeColorSlot.value,
            }}
          >
            <input
              id={colorInputId}
              type="color"
              value={themeColorSlot.value}
              disabled={themeColorSlot.disabled}
              onChange={(e) => themeColorSlot.onChange(e.target.value)}
              aria-label={t("2535")}
              style={{
                width: "200%",
                height: "200%",
                margin: "-50%",
                padding: 0,
                border: "none",
                cursor: themeColorSlot.disabled ? "default" : "pointer",
                opacity: themeColorSlot.disabled ? 0.5 : 1,
              }}
            />
          </Box>
        </Box>
      ) : null}

      {SOURCES.map((s) => {
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
