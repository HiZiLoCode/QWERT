"use client";

import { Box, Button, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/i18n";
import { screenThemeColors } from "./theme";
import { screenThemeFilledPillButtonSx, screenThemeOutlinedPillButtonSx, screenThemePillRadius } from "./screenThemeButtonSx";

type Props = {
  /** 返回 true 表示同步成功，用于展示「已同步」 */
  onSync: () => Promise<boolean>;
};

const BUSY_MS = 720;

export default function ScreenThemeSyncTimeButton({ onSync }: Props) {
  const { t } = useTranslation("common");
  const [phase, setPhase] = useState<"idle" | "busy" | "done">("idle");
  const [progress, setProgress] = useState(0);
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

  const run = useCallback(async () => {
    if (phase !== "idle") return;
    setPhase("busy");
    setProgress(0);
    clearTimers();

    const start = performance.now();
    const step = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, (elapsed / BUSY_MS) * 100);
      setProgress(p);
      if (p < 100) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);

    let ok = false;
    try {
      const syncPromise = onSync();
      await Promise.all([
        syncPromise,
        new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, BUSY_MS);
          timeoutRefs.current.push(id);
        }),
      ]);
      ok = await syncPromise;
    } catch {
      ok = false;
    } finally {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setProgress(100);
    }

    if (ok) {
      setPhase("done");
      const id = window.setTimeout(() => {
        setPhase("idle");
        setProgress(0);
      }, 2000);
      timeoutRefs.current.push(id);
    } else {
      setPhase("idle");
      setProgress(0);
    }
  }, [phase, onSync, clearTimers]);

  const primary = screenThemeColors.primary;

  return (
    <Button
      variant="text"
      disableElevation
      onClick={() => void run()}
      disabled={phase !== "idle"}
      sx={{
        position: "relative",
        width: "11rem",
        height: "2.25rem",
        minWidth: "11rem",
        p: 0,
        overflow: "hidden",
        flexShrink: 0,
        ...(phase === "done"
          ? screenThemeFilledPillButtonSx
          : {
              ...screenThemeOutlinedPillButtonSx,
              ...(phase === "busy"
                ? {
                    "&:hover": { boxShadow: "none" },
                    "&.Mui-disabled": {
                      borderColor: primary,
                      color: "transparent",
                    },
                  }
                : {}),
            }),
      }}
    >
      {phase === "busy" && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            backgroundColor: primary,
            borderTopLeftRadius: screenThemePillRadius,
            borderBottomLeftRadius: screenThemePillRadius,
            borderTopRightRadius: progress >= 99 ? screenThemePillRadius : 0,
            borderBottomRightRadius: progress >= 99 ? screenThemePillRadius : 0,
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
          fontWeight: phase === "done" ? 600 : 500,
          color: phase === "busy" ? "transparent" : phase === "done" ? "#fff" : screenThemeColors.textDark,
        }}
      >
        {phase === "done" ? t("1630") : t("1605")}
      </Typography>
    </Button>
  );
}
