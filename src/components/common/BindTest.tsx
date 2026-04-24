'use client';

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Box, Switch, Typography } from "@mui/material";
import { useTranslation } from "@/app/i18n";
import { ConnectKbContext } from "@/providers/ConnectKbProvider";
import TravelVirtualKeyboard from "@/components/TravelVirtualKeyboard";
import { getKeyCodeFromWebCode } from "@/keyboard/keycode";
import testKeyboard128 from "@/data/keyboardLayout/test_keyboard_128.json";
import { mergeLayoutKeysWithUserKeyNames } from "@/utils/mergeLayoutKeysWithUserKeyNames";

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
    case "CONTROL":
      if (event.code === "ControlRight") return "RCtrl";
      if (event.code === "ControlLeft") return "LCtrl";
      if (event.location === 2) return "RCtrl";
      if (event.location === 1) return "LCtrl";
      return "LCtrl";
    case "Shift":
    case "Shift":
      console.log(321321321);
      
      if (event.code === "") return "RShift";
      if (event.code === "ShiftLeft") return "LShift";
      if (event.location === 0) return "RShift";
      if (event.location === 1) return "LShift";
      return "LShift";
    case "Alt":
    case "ALT":
      if (event.code === "AltRight") return "RAlt";
      if (event.code === "AltLeft") return "LAlt";
      if (event.location === 0) return "RAlt";
      if (event.location === 1) return "LAlt";
      return "LAlt";
    case "Meta":
    case "META":
      if (event.code === "MetaRight" || event.code === "OSRight") return "RGUI";
      if (event.code === "MetaLeft" || event.code === "OSLeft") return "LGUI";
      if (event.location === 2) return "RGUI";
      if (event.location === 1) return "LGUI";
      return "LGUI";
    case "PrintScreen":
    case "Print Screen":
      return "PRTSC";
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
    case "PrintScreen":
      return ["PRTSC", "PRISC", "PRTSCN", "PRINT SCREEN", "PRINTSCRN", "SNAPSHOT"];
    default:
      return [];
  }
}

/** 布局里常统一写成 Shift；仅靠 location 在部分环境下为 0，需用 code 区分左右 */
function modifierSideFromPhysicalCode(code: string): "left" | "right" | null {
  switch (code) {
    case "ShiftRight":
    case "ControlRight":
    case "AltRight":
    case "MetaRight":
    case "OSRight":
      return "right";
    case "ShiftLeft":
    case "ControlLeft":
    case "AltLeft":
    case "MetaLeft":
    case "OSLeft":
      return "left";
    default:
      return null;
  }
}

function getModifierKindFromEvent(event: KeyboardEvent): "SHIFT" | "CTRL" | "ALT" | "META" | null {
  if (event.key === "Shift" || event.key === "SHIFT" || event.code.startsWith("Shift")) return "SHIFT";
  if (event.key === "Control" || event.key === "CONTROL" || event.code.startsWith("Control")) return "CTRL";
  if (
    event.key === "Alt" ||
    event.key === "ALT" ||
    event.key === "AltGraph" ||
    event.code.startsWith("Alt")
  )
    return "ALT";
  if (event.key === "Meta" || event.key === "META" || event.code.startsWith("Meta") || event.code.startsWith("OS"))
    return "META";
  return null;
}

/** 布局里多个键同名（如两个 Shift）时，名称映射会得到多个 index；用 code/location 收窄到一侧 */
function narrowIndexesForModifierDuplicates(
  indexes: number[],
  event: KeyboardEvent,
  modifierKind: "SHIFT" | "CTRL" | "ALT" | "META",
  sideIndex: Record<"SHIFT" | "CTRL" | "ALT" | "META", { left?: number; right?: number }>,
): number[] {
  if (indexes.length <= 1) return indexes;
  const sideFromCode = modifierSideFromPhysicalCode(event.code);
  const sideFromLoc =
    event.location === 2 ? "right" : event.location === 1 ? ("left" as const) : null;
  const side = sideFromCode ?? sideFromLoc;
  if (!side) return [indexes[0]];
  const pick = sideIndex[modifierKind][side];
  if (typeof pick === "number" && indexes.includes(pick)) return [pick];
  return [indexes[0]];
}

function layoutKeyNumericCode(key: { code?: unknown }): number | null {
  const raw = key.code;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** 布局里 code 可能是 229 或带高位的 QMK 值；统一到 USB 键盘页 0xE0–0xE7 修饰键用法字节 */
function layoutCodeToModifierUsageByte(c: number): number | null {
  if (!Number.isFinite(c)) return null;
  const low = c & 0xff;
  if (low >= 0xe0 && low <= 0xe7) return low;
  for (let s = 8; s <= 24; s += 8) {
    const b = (c >> s) & 0xff;
    if (b >= 0xe0 && b <= 0xe7) return b;
  }
  return null;
}

/** 布局里左右同名（如两个 Ctrl）时，按 x 为 preferredNames 补 L/R 别名 */
function pushGenericLeftRightModifierAliases(
  layoutKeys: any[],
  push: (name: string, idx: number) => void,
  matchLabel: (normalized: string) => boolean,
  leftAliases: string[],
  rightAliases: string[],
) {
  const row: { keyIndex: number; x: number }[] = [];
  layoutKeys.forEach((key: any, idx: number) => {
    const normalized = String(key.name ?? "").trim().toUpperCase();
    if (!matchLabel(normalized)) return;
    const keyIndex = key.index ?? idx;
    const x = typeof key.x === "number" ? key.x : idx;
    row.push({ keyIndex, x });
  });
  row.sort((a, b) => a.x - b.x);
  if (row.length >= 2) {
    const li = row[0].keyIndex;
    const ri = row[row.length - 1].keyIndex;
    for (const a of leftAliases) push(a, li);
    for (const a of rightAliases) push(a, ri);
  } else if (row.length === 1) {
    const i = row[0].keyIndex;
    for (const a of [...leftAliases, ...rightAliases]) push(a, i);
  }
}

const RESET_BUSY_MS = 720;
const RESET_ACCENT = "#3f72b9";
/** 页面内模拟按键松开的延迟（毫秒），与真实短按接近 */
const SYNTHETIC_RELEASE_MS = 200;

function bindTestLogKeyPhase(phase: "keydown" | "keyup", ev: KeyboardEvent, indexes: number[], note?: string) {
  const evAny = ev as KeyboardEvent & { keyCode?: number; which?: number };
  console.log("[BindTest]", phase, {
    ...(note ? { note } : {}),
    key: ev.key,
    code: ev.code,
    location: ev.location,
    repeat: ev.repeat,
    keyCode: evAny.keyCode,
    which: evAny.which,
    ctrlKey: ev.ctrlKey,
    shiftKey: ev.shiftKey,
    altKey: ev.altKey,
    metaKey: ev.metaKey,
    normalizedName: normalizeKeyName(ev).toUpperCase(),
    indexes,
  });
}

function isShiftKeyboardEvent(ev: KeyboardEvent): boolean {
  return ev.key === "Shift" || ev.key === "SHIFT" || ev.code.startsWith("Shift");
}

/** Shift 专用调试输出（含 HID 用法码，便于对照 layout.code） */
function bindTestLogShiftKey(
  phase: "keydown" | "keyup",
  ev: KeyboardEvent,
  indexes: number[],
  hidUsage: number | undefined,
  note?: string,
) {
  const evAny = ev as KeyboardEvent & { keyCode?: number; which?: number };
  const hidLabel =
    hidUsage != null ? `0x${hidUsage.toString(16)} (${hidUsage})` : "(无 HID 映射)";
  console.log("[BindTest Shift]", phase, {
    ...(note ? { note } : {}),
    key: ev.key,
    code: ev.code,
    location: ev.location,
    repeat: ev.repeat,
    keyCode: evAny.keyCode,
    which: evAny.which,
    hidUsage,
    hidLabel,
    normalizedName: normalizeKeyName(ev).toUpperCase(),
    indexes,
  });
}

function isLikelyPrintScreenKey(ev: KeyboardEvent): boolean {
  if (ev.code === "PrintScreen") return true;
  const k = ev.key;
  return k === "PrintScreen" || k === "Print Screen" || k === "Snapshot" || k.includes("Print");
}

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
  const syntheticPulseTimersRef = useRef<number[]>([]);
  const pressedKeysRef = useRef<number[]>([]);
  pressedKeysRef.current = pressedKeys;

  const clearResetTimers = useCallback(() => {
    resetTimeoutRefs.current.forEach((id) => window.clearTimeout(id));
    resetTimeoutRefs.current = [];
    if (resetRafRef.current != null) {
      cancelAnimationFrame(resetRafRef.current);
      resetRafRef.current = null;
    }
  }, []);

  useEffect(() => () => clearResetTimers(), [clearResetTimers]);

  useEffect(
    () => () => {
      syntheticPulseTimersRef.current.forEach((id) => window.clearTimeout(id));
      syntheticPulseTimersRef.current = [];
    },
    [],
  );

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
  const currentLayer = keyboard?.layer ?? 0;
  const userKeysRow = keyboard?.userKeys?.[currentLayer] ?? [];
  const displayLayoutKeys = useMemo(() => {
    if (matrixTestEnabled) return layoutKeys;
    return mergeLayoutKeysWithUserKeyNames(layoutKeys, userKeysRow);
  }, [matrixTestEnabled, layoutKeys, userKeysRow]);

  const keyIndexByCode = useMemo(() => {
    const map = new Map<number, number[]>();
    const pushCode = (codeKey: number, keyIndex: number) => {
      const list = map.get(codeKey) ?? [];
      if (list.includes(keyIndex)) return;
      list.push(keyIndex);
      map.set(codeKey, list);
    };
    const ingest = (keys: any[]) => {
      keys.forEach((key: any, idx: number) => {
        const codeNum = layoutKeyNumericCode(key);
        if (codeNum == null) return;
        const keyIndex = key.index ?? idx;
        pushCode(codeNum, keyIndex);
        const usage = layoutCodeToModifierUsageByte(codeNum);
        if (usage != null && usage !== codeNum) pushCode(usage, keyIndex);
      });
    };
    ingest(layoutKeys);
    if (map.size === 0 && testKeyboardLayoutKeys.length) ingest(testKeyboardLayoutKeys);
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
    pushGenericLeftRightModifierAliases(
      layoutKeys,
      push,
      (n) => n === "SHIFT",
      ["LSHIFT", "LEFT SHIFT"],
      ["RSHIFT", "RIGHT SHIFT"],
    );
    pushGenericLeftRightModifierAliases(
      layoutKeys,
      push,
      (n) => n === "CTRL" || n === "CONTROL",
      ["LCTRL", "LCTL", "LEFT CTRL", "LEFT CONTROL"],
      ["RCTRL", "RCTL", "RIGHT CTRL", "RIGHT CONTROL"],
    );
    pushGenericLeftRightModifierAliases(
      layoutKeys,
      push,
      (n) => n === "ALT",
      ["LALT", "LEFT ALT"],
      ["RALT", "RIGHT ALT", "ALTGR"],
    );
    pushGenericLeftRightModifierAliases(
      layoutKeys,
      push,
      (n) => n === "WIN" || n === "GUI" || n === "META" || n === "OS",
      ["LGUI", "LWIN", "LEFT WIN", "LEFT GUI"],
      ["RGUI", "RWIN", "RIGHT WIN", "RIGHT GUI"],
    );
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
      if (name.includes("ALTGR") || name.includes("ALGR")) return null;
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

    /** 仅靠名称时 generic 可能只有一颗 Shift，left/right 会相同；用 USB 修饰键用法字节强制左右 */
    layoutKeys.forEach((key: any, idx: number) => {
      const keyIndex = key.index ?? idx;
      const c = layoutKeyNumericCode(key);
      const usage = c != null ? layoutCodeToModifierUsageByte(c) : null;
      if (usage == null) return;
      switch (usage) {
        case 0xe1:
          out.SHIFT.left = keyIndex;
          break;
        case 0xe5:
          out.SHIFT.right = keyIndex;
          break;
        case 0xe0:
          out.CTRL.left = keyIndex;
          break;
        case 0xe4:
          out.CTRL.right = keyIndex;
          break;
        case 0xe2:
          out.ALT.left = keyIndex;
          break;
        case 0xe6:
          out.ALT.right = keyIndex;
          break;
        case 0xe3:
          out.META.left = keyIndex;
          break;
        case 0xe7:
          out.META.right = keyIndex;
          break;
        default:
          break;
      }
    });

    return out;
  }, [layoutKeys]);

  const resolveIndexesFromEvent = useCallback(
    (event: KeyboardEvent): number[] => {
      const modifierKind = getModifierKindFromEvent(event);
      const logShiftResolve = modifierKind === "SHIFT";
      const steps: { step: string; detail?: unknown }[] = [];
      const trace = (step: string, detail?: unknown) => {
        if (logShiftResolve) steps.push(detail !== undefined ? { step, detail } : { step });
      };

      let indexes: number[] = [];

      trace("getModifierKindFromEvent", { modifierKind });

      /** 修饰键以 HID 与 layout.code 对齐最可靠，避免仅靠几何 left/right 与真实键帽不一致 */
      if (modifierKind) {
        const hidUsage = getKeyCodeFromWebCode("key", event.code);
        trace("hidUsageFromWebCode", { code: event.code, hidUsage: hidUsage ?? null });
        if (hidUsage) {
          const fromHid = keyIndexByCode.get(hidUsage);
          trace("keyIndexByCode.get(hidUsage)", { fromHid: fromHid ?? null });
          if (fromHid?.length === 1) {
            indexes = [...fromHid];
            trace("分支:HID修饰键唯一命中", { indexes });
          } else if (fromHid && fromHid.length > 1) {
            indexes = narrowIndexesForModifierDuplicates(
              [...fromHid],
              event,
              modifierKind,
              modifierSideIndex,
            );
            trace("分支:HID多命中→narrow", { before: [...fromHid], after: indexes });
          } else {
            trace("分支:HID无 keyIndexByCode 条目", {});
          }
        } else {
          trace("分支:event.code 无 HID 映射", {});
        }
      }

      if (!indexes.length && modifierKind) {
        const sideFromCode = modifierSideFromPhysicalCode(event.code);
        const sideFromLoc =
          event.location === 2 ? "right" : event.location === 1 ? ("left" as const) : null;
        const side = sideFromCode ?? sideFromLoc;
        trace("modifierSide几何", {
          sideFromCode,
          sideFromLoc,
          side,
          modifierSideForKind: modifierSideIndex[modifierKind],
        });
        if (side) {
          const idx = modifierSideIndex[modifierKind][side];
          trace("modifierSideIndex[kind][side]", { idx: idx ?? null });
          if (typeof idx === "number") {
            indexes = [idx];
            trace("分支:modifierSideIndex 命中", { indexes });
          }
        }
      }

      if (!indexes.length) {
        const preferredNames = preferredNamesFromEventCode(event.code);
        trace("preferredNames 尝试顺序", { preferredNames });
        for (const preferredName of preferredNames) {
          const strict = keyIndexByEventCode.get(preferredName);
          if (strict && strict.length) {
            indexes = [...strict];
            trace("分支:preferredName 命中", { preferredName, strict: [...strict] });
            break;
          }
        }
      }

      if (!indexes.length) {
        const hidCode = getKeyCodeFromWebCode("key", event.code);
        trace("通用 HID 回退", { hidCode: hidCode ?? null });
        if (hidCode) {
          const fromCode = keyIndexByCode.get(hidCode);
          if (fromCode && fromCode.length) {
            indexes = [...fromCode];
            trace("分支:通用 HID keyIndexByCode", { fromCode: [...fromCode] });
          }
        }
      }

      if (!indexes.length) {
        const norm = normalizeKeyName(event).toUpperCase();
        const byName = keyIndexByName.get(norm);
        trace("byName 查找", { normalizedName: norm, byName: byName ?? null });
        if (byName && byName.length) {
          indexes = [...byName];
          trace("分支:byName 命中", { indexes });
        }
      }

      let out = indexes;
      if (modifierKind && indexes.length > 1) {
        out = narrowIndexesForModifierDuplicates(indexes, event, modifierKind, modifierSideIndex);
        trace("最终:narrow 修饰键多 index", { before: [...indexes], after: [...out] });
      }

      if (logShiftResolve) {
        console.log("[BindTest Shift resolve]", {
          key: event.key,
          code: event.code,
          location: event.location,
          steps,
          result: out,
        });
      }

      return out;
    },
    [keyIndexByCode, keyIndexByName, keyIndexByEventCode, modifierSideIndex],
  );

  const applyKeyDown = useCallback((indexes: number[]) => {
    if (!indexes.length) return;
    setPressedKeys((prev) => [...new Set([...prev, ...indexes])]);
    indexes.forEach((idx) => {
      pressCountsRef.current[idx] = (pressCountsRef.current[idx] ?? 0) + 1;
    });
  }, []);

  const applyKeyUp = useCallback((indexes: number[]) => {
    if (!indexes.length) return;
    setPressedKeys((prev) => prev.filter((idx) => !indexes.includes(idx)));
  }, []);

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
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) {
        if (isShiftKeyboardEvent(event)) {
          const hid = getKeyCodeFromWebCode("key", event.code);
          bindTestLogShiftKey("keydown", event, [], typeof hid === "number" ? hid : undefined, "repeat-skip");
        } else {
          bindTestLogKeyPhase("keydown", event, [], "repeat-skip");
        }
        return;
      }
      const indexes = resolveIndexesFromEvent(event);
      if (isShiftKeyboardEvent(event)) {
        const hid = getKeyCodeFromWebCode("key", event.code);
        bindTestLogShiftKey("keydown", event, indexes, typeof hid === "number" ? hid : undefined);
      } else {
        bindTestLogKeyPhase("keydown", event, indexes);
      }
      if (!indexes.length) return;
      applyKeyDown(indexes);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const indexes = resolveIndexesFromEvent(event);
      const isPrint = isLikelyPrintScreenKey(event);
      const hadDown =
        isPrint && indexes.length > 0 ? indexes.every((i) => pressedKeysRef.current.includes(i)) : true;
      if (isShiftKeyboardEvent(event)) {
        const hid = getKeyCodeFromWebCode("key", event.code);
        bindTestLogShiftKey(
          "keyup",
          event,
          indexes,
          typeof hid === "number" ? hid : undefined,
          !indexes.length ? "no-resolve" : undefined,
        );
      } else {
        bindTestLogKeyPhase(
          "keyup",
          event,
          indexes,
          !indexes.length ? "no-resolve" : isPrint && !hadDown ? "print-keyup-only-pulse" : undefined,
        );
      }
      if (!indexes.length) return;

      if (isPrint && !hadDown) {
        applyKeyDown(indexes);
        const id = window.setTimeout(() => {
          applyKeyUp(indexes);
          syntheticPulseTimersRef.current = syntheticPulseTimersRef.current.filter((tid) => tid !== id);
        }, SYNTHETIC_RELEASE_MS);
        syntheticPulseTimersRef.current.push(id);
        return;
      }

      applyKeyUp(indexes);
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [applyKeyDown, applyKeyUp, resolveIndexesFromEvent]);

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
          layoutKeys={displayLayoutKeys}
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
