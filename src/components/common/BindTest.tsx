'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Switch, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import TravelVirtualKeyboard from "@/components/TravelVirtualKeyboard";
import { getKeyCodeFromWebCode } from "@/keyboard/keycode";
import testKeyboard128 from "@/data/keyboardLayout/test_keyboard_128.json";

function normalizeKeyName(event: KeyboardEvent): string {
  const key = event.key;
  switch (key) {
    case "Escape":
      return "Esc";
    case " ":
      return "Space";
    case "ArrowUp":
      return "↑";
    case "ArrowDown":
      return "↓";
    case "ArrowLeft":
      return "←";
    case "ArrowRight":
      return "→";
    case "Backspace":
      return "Bksp";
    case "Delete":
      return "Del";
    case "Insert":
      return "Ins";
    case "PageUp":
      return "PgUp";
    case "PageDown":
      return "PgDn";
    case "Control":
      return event.code === "ControlRight" ? "RCtrl" : "LCtrl";
    case "Shift":
      return event.code === "ShiftRight" ? "RShift" : "LShift";
    case "Alt":
      return event.code === "AltRight" ? "RAlt" : "LAlt";
    case "Meta":
      return event.code === "MetaRight" ? "RGUI" : "LGUI";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

function preferredNamesFromEventCode(code: string): string[] {
  switch (code) {
    case "ShiftLeft":
      return ["LSHIFT", "LEFT SHIFT"];
    case "ShiftRight":
      return ["RSHIFT", "RIGHT SHIFT"];
    case "ControlLeft":
      return ["LCTRL", "LCTL", "LEFT CTRL", "LEFT CONTROL"];
    case "ControlRight":
      return ["RCTRL", "RCTL", "RIGHT CTRL", "RIGHT CONTROL"];
    case "AltLeft":
      return ["LALT", "LEFT ALT"];
    case "AltRight":
      return ["RALT", "RIGHT ALT", "ALTGR"];
    case "MetaLeft":
    case "OSLeft":
      return ["LGUI", "LWIN", "LEFT WIN", "LEFT GUI"];
    case "MetaRight":
    case "OSRight":
      return ["RGUI", "RWIN", "RIGHT WIN", "RIGHT GUI"];
    default:
      return [];
  }
}

function getModifierKindFromEvent(event: KeyboardEvent): "SHIFT" | "CTRL" | "ALT" | "META" | null {
  if (event.key === "Shift" || event.code.startsWith("Shift")) return "SHIFT";
  if (event.key === "Control" || event.code.startsWith("Control")) return "CTRL";
  if (event.key === "Alt" || event.code.startsWith("Alt")) return "ALT";
  if (event.key === "Meta" || event.code.startsWith("Meta") || event.code.startsWith("OS")) return "META";
  return null;
}

const RESET_BUSY_MS = 720;
const RESET_ACCENT = "#3f72b9";

function BindTest() {
  const { t } = useTranslation("common");
  const { keyboard, keyboardLayout } = useContext(ConnectKbContext);
  const [matrixTestEnabled, setMatrixTestEnabled] = useState(false);
  const [pressedKeys, setPressedKeys] = useState<number[]>([]);
  const pressCountsRef = useRef<Record<number, number>>({});
  const [resetPhase, setResetPhase] = useState<"idle" | "busy" | "done">("idle");
  const [resetProgress, setResetProgress] = useState(0);
  const resetRafRef = useRef<number | null>(null);
  const resetTimeoutRefs = useRef<number[]>([]);

  const clearResetTimers = useCallback(() => {
    resetTimeoutRefs.current.forEach((id) => window.clearTimeout(id));
    resetTimeoutRefs.current = [];
    if (resetRafRef.current != null) {
      cancelAnimationFrame(resetRafRef.current);
      resetRafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearResetTimers(), [clearResetTimers]);

  const runReset = useCallback(async () => {
    if (resetPhase !== "idle") return;
    setResetPhase("busy");
    setResetProgress(0);
    clearResetTimers();

    const start = performance.now();
    const step = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(100, (elapsed / RESET_BUSY_MS) * 100);
      setResetProgress(p);
      if (p < 100) {
        resetRafRef.current = requestAnimationFrame(step);
      }
    };
    resetRafRef.current = requestAnimationFrame(step);

    const doReset = async (): Promise<boolean> => {
      setPressedKeys([]);
      pressCountsRef.current = {};
      return true;
    };

    let ok = false;
    try {
      const resetPromise = doReset();
      await Promise.all([
        resetPromise,
        new Promise<void>((resolve) => {
          const id = window.setTimeout(resolve, RESET_BUSY_MS);
          resetTimeoutRefs.current.push(id);
        }),
      ]);
      ok = await resetPromise;
    } catch {
      ok = false;
    } finally {
      if (resetRafRef.current != null) {
        cancelAnimationFrame(resetRafRef.current);
        resetRafRef.current = null;
      }
      setResetProgress(100);
    }

    if (ok) {
      setResetPhase("done");
      const id = window.setTimeout(() => {
        setResetPhase("idle");
        setResetProgress(0);
      }, 2000);
      resetTimeoutRefs.current.push(id);
    } else {
      setResetPhase("idle");
      setResetProgress(0);
    }
  }, [resetPhase, clearResetTimers]);

  const testKeyboardLayoutKeys = useMemo(() => {
    return ((testKeyboard128 as any)?.layouts?.keys ?? []) as any[];
  }, []);
  const deviceLayoutKeys = keyboard?.layoutKeys ?? [];
  const layoutKeys = useMemo(() => {
    if (matrixTestEnabled) return testKeyboardLayoutKeys;
    return deviceLayoutKeys.length ? deviceLayoutKeys : testKeyboardLayoutKeys;
  }, [matrixTestEnabled, deviceLayoutKeys, testKeyboardLayoutKeys]);
  const travelKeys = keyboard?.travelKeys ?? [];
  const patternKeys = matrixTestEnabled ? [] : (keyboardLayout?.layouts?.patternKeys ?? []);

  const keyIndexByCode = useMemo(() => {
    const map = new Map<number, number[]>();
    layoutKeys.forEach((key: any, idx: number) => {
      if (typeof key.code !== "number") return;
      const keyIndex = key.index ?? idx;
      const list = map.get(key.code) ?? [];
      list.push(keyIndex);
      map.set(key.code, list);
    });
    if (map.size === 0 && testKeyboardLayoutKeys.length) {
      testKeyboardLayoutKeys.forEach((key: any, idx: number) => {
        if (typeof key.code !== "number") return;
        const keyIndex = key.index ?? idx;
        const list = map.get(key.code) ?? [];
        list.push(keyIndex);
        map.set(key.code, list);
      });
    }
    return map;
  }, [layoutKeys, testKeyboardLayoutKeys]);

  const keyIndexByName = useMemo(() => {
    const map = new Map<string, number[]>();
    layoutKeys.forEach((key: any, idx: number) => {
      const keyIndex = key.index ?? idx;
      const name = (key.name ?? "").trim();
      if (!name) return;
      const normalized = name.toUpperCase();
      const list = map.get(normalized) ?? [];
      list.push(keyIndex);
      map.set(normalized, list);
    });
    return map;
  }, [layoutKeys]);

  const keyIndexByEventCode = useMemo(() => {
    const map = new Map<string, number[]>();
    const push = (name: string, idx: number) => {
      const list = map.get(name) ?? [];
      list.push(idx);
      map.set(name, list);
    };
    layoutKeys.forEach((key: any, idx: number) => {
      const keyIndex = key.index ?? idx;
      const normalized = String(key.name ?? "").trim().toUpperCase();
      if (!normalized) return;
      push(normalized, keyIndex);
      if (normalized === "LSHIFT") push("LEFT SHIFT", keyIndex);
      if (normalized === "RSHIFT") push("RIGHT SHIFT", keyIndex);
      if (normalized === "LCTRL" || normalized === "LCTL") {
        push("LCTRL", keyIndex);
        push("LCTL", keyIndex);
        push("LEFT CTRL", keyIndex);
        push("LEFT CONTROL", keyIndex);
      }
      if (normalized === "RCTRL" || normalized === "RCTL") {
        push("RCTRL", keyIndex);
        push("RCTL", keyIndex);
        push("RIGHT CTRL", keyIndex);
        push("RIGHT CONTROL", keyIndex);
      }
      if (normalized === "LALT") push("LEFT ALT", keyIndex);
      if (normalized === "RALT") {
        push("RIGHT ALT", keyIndex);
        push("ALTGR", keyIndex);
      }
      if (normalized === "LGUI" || normalized === "LWIN") {
        push("LGUI", keyIndex);
        push("LWIN", keyIndex);
        push("LEFT WIN", keyIndex);
        push("LEFT GUI", keyIndex);
      }
      if (normalized === "RGUI" || normalized === "RWIN") {
        push("RGUI", keyIndex);
        push("RWIN", keyIndex);
        push("RIGHT WIN", keyIndex);
        push("RIGHT GUI", keyIndex);
      }
    });
    return map;
  }, [layoutKeys]);

  const modifierSideIndex = useMemo(() => {
    const out: Record<"SHIFT" | "CTRL" | "ALT" | "META", { left?: number; right?: number }> = {
      SHIFT: {},
      CTRL: {},
      ALT: {},
      META: {},
    };
    const generic: Record<"SHIFT" | "CTRL" | "ALT" | "META", Array<{ index: number; x: number }>> = {
      SHIFT: [],
      CTRL: [],
      ALT: [],
      META: [],
    };
    const isLeftLabel = (name: string) => name.startsWith("L") || name.startsWith("LEFT");
    const isRightLabel = (name: string) => name.startsWith("R") || name.startsWith("RIGHT");
    const detectKind = (name: string): "SHIFT" | "CTRL" | "ALT" | "META" | null => {
      if (name.includes("SHIFT")) return "SHIFT";
      if (name.includes("CTRL") || name.includes("CTL") || name.includes("CONTROL")) return "CTRL";
      if (name.includes("ALT")) return "ALT";
      if (name.includes("GUI") || name.includes("WIN") || name.includes("META") || name.includes("OS")) return "META";
      return null;
    };

    layoutKeys.forEach((key: any, idx: number) => {
      const normalized = String(key.name ?? "").trim().toUpperCase();
      const kind = detectKind(normalized);
      if (!kind) return;
      const keyIndex = key.index ?? idx;
      const x = typeof key.x === "number" ? key.x : idx;
      generic[kind].push({ index: keyIndex, x });
      if (isLeftLabel(normalized) && out[kind].left == null) out[kind].left = keyIndex;
      if (isRightLabel(normalized) && out[kind].right == null) out[kind].right = keyIndex;
    });

    (Object.keys(generic) as Array<keyof typeof generic>).forEach((kind) => {
      if (!generic[kind].length) return;
      const sorted = [...generic[kind]].sort((a, b) => a.x - b.x);
      if (out[kind].left == null) out[kind].left = sorted[0]?.index;
      if (out[kind].right == null) out[kind].right = sorted[sorted.length - 1]?.index;
    });
    return out;
  }, [layoutKeys]);

  const selectedKeys = useMemo(() => [...new Set(pressedKeys)], [pressedKeys]);

  const keyBadges = useMemo<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    Object.entries(pressCountsRef.current).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isFinite(idx) && v > 0) out[idx] = v;
    });
    return out;
  }, [selectedKeys]);

  useEffect(() => {
    setPressedKeys([]);
    pressCountsRef.current = {};
  }, [matrixTestEnabled]);

  useEffect(() => {
    const resolveIndexesFromEvent = (event: KeyboardEvent): number[] => {
      const modifierKind = getModifierKindFromEvent(event);
      if (modifierKind && (event.location === 1 || event.location === 2)) {
        const side = event.location === 2 ? "right" : "left";
        const idx = modifierSideIndex[modifierKind][side];
        if (typeof idx === "number") return [idx];
      }
      const preferredNames = preferredNamesFromEventCode(event.code);
      for (const preferredName of preferredNames) {
        const strict = keyIndexByEventCode.get(preferredName);
        if (strict && strict.length) return strict;
      }
      const hidCode = getKeyCodeFromWebCode("key", event.code);
      if (hidCode) {
        const fromCode = keyIndexByCode.get(hidCode);
        if (fromCode && fromCode.length) return fromCode;
      }
      const byName = keyIndexByName.get(normalizeKeyName(event).toUpperCase());
      if (byName && byName.length) return byName;
      return [];
    };

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      const indexes = resolveIndexesFromEvent(event);
      if (!indexes.length) return;
      setPressedKeys((prev) => [...new Set([...prev, ...indexes])]);
      indexes.forEach((idx) => {
        pressCountsRef.current[idx] = (pressCountsRef.current[idx] ?? 0) + 1;
      });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const indexes = resolveIndexesFromEvent(event);
      if (!indexes.length) return;
      setPressedKeys((prev) => prev.filter((idx) => !indexes.includes(idx)));
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("keyup", onKeyUp, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("keyup", onKeyUp, true);
    };
  }, [keyIndexByCode, keyIndexByName, keyIndexByEventCode, modifierSideIndex]);

  return (
    <Box
      sx={{
        flex: 1,
        borderRadius: "0.875rem",
        backdropFilter: "blur(0.375rem)",
        p: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <Box
        sx={{
          borderRadius: "0.625rem",
          p: "0.75rem 0.75rem 0.4rem",
          display: "flex",
          flexDirection: "column",
          mx: "auto",
        }}
      >
        <TravelVirtualKeyboard
          layoutKeys={layoutKeys}
          travelKeys={travelKeys}
          patternKeys={patternKeys}
          selectedKeys={selectedKeys}
          travelValue={1.5}
          onToggleKey={() => {}}
          colorMode={false}
          keyColors={[]}
          keyBadges={keyBadges}
        />
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", width: "70%", mx: "auto" }}>
        <Box
          role="button"
          tabIndex={resetPhase === "idle" ? 0 : -1}
          aria-busy={resetPhase === "busy"}
          onClick={() => void runReset()}
          onKeyDown={(e) => {
            if (resetPhase !== "idle") return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void runReset();
            }
          }}
          sx={{
            position: "relative",
            minWidth: 110,
            height: 32,
            px: "1rem",
            borderRadius: "0.8rem",
            overflow: "hidden",
            border:
              resetPhase === "done"
                ? `0.0625rem solid ${RESET_ACCENT}`
                : resetPhase === "busy"
                  ? `0.0625rem solid ${RESET_ACCENT}`
                  : "0.0625rem solid rgba(203,213,225,0.95)",
            bgcolor: resetPhase === "done" ? RESET_ACCENT : "rgba(248,250,252,1)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: resetPhase === "idle" ? "pointer" : "default",
            fontWeight: 400,
            transition: "border-color 0.15s ease, background-color 0.2s ease",
            ...(resetPhase === "idle"
              ? {
                  "&:hover": {
                    borderColor: "rgba(63, 114, 185, 0.85)",
                  },
                }
              : {}),
            ...(resetPhase === "busy"
              ? {
                  "&:hover": { boxShadow: "none" },
                }
              : {}),
          }}
        >
          {resetPhase === "busy" && (
            <Box
              aria-hidden
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${resetProgress}%`,
                backgroundColor: RESET_ACCENT,
                borderTopLeftRadius: "0.8rem",
                borderBottomLeftRadius: "0.8rem",
                borderTopRightRadius: resetProgress >= 99 ? "0.8rem" : 0,
                borderBottomRightRadius: resetProgress >= 99 ? "0.8rem" : 0,
                transition: "border-radius 0.12s ease-out",
              }}
            />
          )}
          <Typography
            component="span"
            sx={{
              position: "relative",
              zIndex: 1,
              fontSize: "1rem",
              fontWeight: resetPhase === "done" ? 600 : 400,
              color:
                resetPhase === "busy"
                  ? "transparent"
                  : resetPhase === "done"
                    ? "#fff"
                    : "rgba(100, 116, 139, 1)",
            }}
          >
            {resetPhase === "done" ? t("2717") : t("1304")}
          </Typography>
        </Box>
      </Box>

      <Box
        sx={{
          borderRadius: "1rem",
          border: "0.0625rem solid rgba(153,169,191,0.18)",
          background: "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%)",
          px: "2rem",
          py: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "70%",
          mx: "auto",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: "1rem", color: "rgba(100, 116, 139, 1)", fontWeight: 500 }}>
            {t("2715")}
          </Typography>
          <Switch
            checked={matrixTestEnabled}
            onChange={(_, checked) => {
              setMatrixTestEnabled(checked);
            }}
            size="medium"
          />
        </Box>
      </Box>
    </Box>
  );
}

export default BindTest;
