"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Box, Button, Divider, Popover, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import ColorPicker from "@/components/ColorPicker";
import { screenThemeColors } from "./theme";
import { screenThemeFilledPillButtonSx, screenThemeOutlinedPillButtonSx, screenThemePillRadius } from "./screenThemeButtonSx";

type ThemeColorField = "theme" | "date" | "power" | "status";

type Props = {
  colors: Record<ThemeColorField, string>;
  onColorChange: (field: ThemeColorField, color: string) => void;
  onSaveToKeyboard: () => Promise<boolean>;
  isSaving?: boolean;
  isLocked?: boolean;
};

const COLOR_ROWS: { field: ThemeColorField; labelKey: string }[] = [
  { field: "date", labelKey: "2543" },
  { field: "power", labelKey: "2544" },
  { field: "status", labelKey: "2545" },
];

const BUSY_MS = 720;

export default function ScreenThemeThemeColorPanel({
  colors,
  onColorChange,
  onSaveToKeyboard,
  isSaving = false,
  isLocked = false,
}: Props) {
  const { t } = useTranslation("common");
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [activeField, setActiveField] = useState<ThemeColorField>("theme");
  const [savePhase, setSavePhase] = useState<"idle" | "busy" | "done">("idle");
  const [saveProgress, setSaveProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const timeoutRefs = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timeoutRefs.current.forEach((id) => window.clearTimeout(id));
    timeoutRefs.current = [];
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const openPicker = (event: MouseEvent<HTMLElement>, field: ThemeColorField) => {
    if (anchorEl && activeField === field) {
      setAnchorEl(null);
      return;
    }
    setAnchorEl(event.currentTarget);
    setActiveField(field);
  };

  const closePicker = () => setAnchorEl(null);
  const pickerOpen = Boolean(anchorEl);

  const runSave = useCallback(async () => {
    if (savePhase !== "idle" || isLocked) return;
    setSavePhase("busy");
    setSaveProgress(0);
    clearTimers();

    const start = performance.now();
    const step = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, (elapsed / BUSY_MS) * 100);
      setSaveProgress(p);
      if (p < 100) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    let ok = false;
    try {
      const savePromise = onSaveToKeyboard();
      await Promise.all([
        savePromise,
        new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, BUSY_MS);
          timeoutRefs.current.push(id);
        }),
      ]);
      ok = await savePromise;
    } catch {
      ok = false;
    } finally {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setSaveProgress(100);
    }

    if (ok) {
      setSavePhase("done");
      const id = window.setTimeout(() => {
        setSavePhase("idle");
        setSaveProgress(0);
      }, 1800);
      timeoutRefs.current.push(id);
    } else {
      setSavePhase("idle");
      setSaveProgress(0);
    }
  }, [savePhase, isLocked, clearTimers, onSaveToKeyboard]);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2.25, pl: 1, pr: 0.5 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, maxWidth: "calc(100% - 12rem)" }}>
          <Typography
            variant="caption"
            component="p"
            sx={{
              m: 0,
              color: screenThemeColors.textMuted,
              fontSize: "0.75rem",
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
              mt: "0.375rem",
              color: screenThemeColors.textMuted,
              fontSize: "0.75rem",
              lineHeight: 1.55,
            }}
          >
            {t("1632")}
          </Typography>
        </Box>
        <Button
          variant="text"
          disableElevation
          disabled={isSaving || isLocked || savePhase !== "idle"}
          onClick={() => void runSave()}
          sx={{
            position: "relative",
            overflow: "hidden",
            flexShrink: 0,
            px: 0,
            py: 0,
            width: "13rem",
            minWidth: "13rem",
            height: "2.25rem",
            ...(savePhase === "done"
              ? screenThemeFilledPillButtonSx
              : {
                  ...screenThemeOutlinedPillButtonSx,
                  ...(savePhase === "busy"
                    ? {
                        "&:hover": { boxShadow: "none" },
                        "&.Mui-disabled": {
                          borderColor: screenThemeColors.primary,
                          color: "transparent",
                        },
                      }
                    : {}),
                }),
          }}
        >
          {savePhase === "busy" && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${saveProgress}%`,
                backgroundColor: screenThemeColors.primary,
                borderTopLeftRadius: screenThemePillRadius,
                borderBottomLeftRadius: screenThemePillRadius,
                borderTopRightRadius: saveProgress >= 99 ? screenThemePillRadius : 0,
                borderBottomRightRadius: saveProgress >= 99 ? screenThemePillRadius : 0,
                transition: "border-radius 0.12s ease-out",
              }}
            />
          )}
          <Typography
            component="span"
            sx={{
              position: "relative",
              zIndex: 1,
              fontSize: "0.875rem",
              fontWeight: savePhase === "done" ? 600 : 500,
              color: savePhase === "busy" ? "transparent" : savePhase === "done" ? "#fff" : screenThemeColors.textDark,
              whiteSpace: "nowrap",
            }}
          >
            {savePhase === "done" ? t("2546") : t("1609")}
          </Typography>
        </Button>
      </Box>

      <Divider sx={{ borderColor: screenThemeColors.borderLight, mt: 19, mb: 36 }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <Typography sx={{ color: screenThemeColors.textDark, fontSize: "0.875rem", fontWeight: 500 }}>
          {t("2541")}
        </Typography>
        {COLOR_ROWS.map((item) => (
          <Box key={item.field} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Typography sx={{ color: screenThemeColors.textDark, fontSize: "0.875rem", minWidth: "4.5rem" }}>
                {t(item.labelKey)}
              </Typography>
              <Box
                sx={{
                  width: "0.875rem",
                  height: "0.875rem",
                  borderRadius: "50%",
                  backgroundColor: colors[item.field],
                  border: "0.0625rem solid rgba(0,0,0,0.12)",
                }}
              />
            </Box>
            <Button
              variant="text"
              disableElevation
              disabled={isLocked}
              onClick={(event) => openPicker(event, item.field)}
              sx={{
                ...screenThemeOutlinedPillButtonSx,
                flexShrink: 0,
                minHeight: "2.25rem",
                width: "10.75rem",
                minWidth: "10.75rem",
              }}
            >
              {t("2542")}
            </Button>
          </Box>
        ))}
      </Box>

      <Popover
        open={pickerOpen}
        anchorEl={anchorEl}
        onClose={closePicker}
        anchorOrigin={{ vertical: "center", horizontal: "left" }}
        transformOrigin={{ vertical: "center", horizontal: "right" }}
        PaperProps={{
          sx: {
            width: "16.5rem",
            p: 1.5,
            mr: 1,
            borderRadius: "0.875rem",
            border: "0.0625rem solid rgba(181,187,196,0.45)",
            boxShadow: "0 0.5rem 1.5rem rgba(15, 23, 42, 0.16)",
          },
        }}
      >
        <ColorPicker
          selectColor={colors[activeField]}
          setSelectColor={(color) => onColorChange(activeField, color)}
          disabled={isLocked}
        />
      </Popover>
    </Box>
  );
}
