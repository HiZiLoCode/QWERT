export type QMKMacroAction = {
  id: string;
  type: 'keydown' | 'keyup' | 'delay';
  keycode?: number;
  keyname?: string;
  delay?: number;
};

export type QMKMacroProfile = {
  id: number;
  name: string;
  actions: QMKMacroAction[];
};

export const WEB_TO_HID: Record<string, number> = {
  KeyA: 0x04, KeyB: 0x05, KeyC: 0x06, KeyD: 0x07, KeyE: 0x08, KeyF: 0x09, KeyG: 0x0a, KeyH: 0x0b,
  KeyI: 0x0c, KeyJ: 0x0d, KeyK: 0x0e, KeyL: 0x0f, KeyM: 0x10, KeyN: 0x11, KeyO: 0x12, KeyP: 0x13,
  KeyQ: 0x14, KeyR: 0x15, KeyS: 0x16, KeyT: 0x17, KeyU: 0x18, KeyV: 0x19, KeyW: 0x1a, KeyX: 0x1b,
  KeyY: 0x1c, KeyZ: 0x1d,
  Digit1: 0x1e, Digit2: 0x1f, Digit3: 0x20, Digit4: 0x21, Digit5: 0x22,
  Digit6: 0x23, Digit7: 0x24, Digit8: 0x25, Digit9: 0x26, Digit0: 0x27,
  Enter: 0x28, Escape: 0x29, Backspace: 0x2a, Tab: 0x2b, Space: 0x2c,
  Minus: 0x2d, Equal: 0x2e, BracketLeft: 0x2f, BracketRight: 0x30,
  Backslash: 0x31, Semicolon: 0x33, Quote: 0x34, Backquote: 0x35,
  Comma: 0x36, Period: 0x37, Slash: 0x38, CapsLock: 0x39,
  F1: 0x3a, F2: 0x3b, F3: 0x3c, F4: 0x3d, F5: 0x3e, F6: 0x3f,
  F7: 0x40, F8: 0x41, F9: 0x42, F10: 0x43, F11: 0x44, F12: 0x45,
  PrintScreen: 0x46, ScrollLock: 0x47, Pause: 0x48, Insert: 0x49, Home: 0x4a,
  PageUp: 0x4b, Delete: 0x4c, End: 0x4d, PageDown: 0x4e,
  ArrowRight: 0x4f, ArrowLeft: 0x50, ArrowDown: 0x51, ArrowUp: 0x52,
  ControlLeft: 0xe0, ShiftLeft: 0xe1, AltLeft: 0xe2, MetaLeft: 0xe3,
  ControlRight: 0xe4, ShiftRight: 0xe5, AltRight: 0xe6, MetaRight: 0xe7,
};

const PRINTABLE_KEYCODES = new Set([
  'KeyA', 'KeyB', 'KeyC', 'KeyD', 'KeyE', 'KeyF', 'KeyG', 'KeyH', 'KeyI', 'KeyJ', 'KeyK', 'KeyL', 'KeyM',
  'KeyN', 'KeyO', 'KeyP', 'KeyQ', 'KeyR', 'KeyS', 'KeyT', 'KeyU', 'KeyV', 'KeyW', 'KeyX', 'KeyY', 'KeyZ',
  'Digit0', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9',
  'Space', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
  'Semicolon', 'Quote', 'Backquote', 'Comma', 'Period', 'Slash',
]);

const WEB_TO_ASCII: Record<string, number> = {
  KeyA: 97, KeyB: 98, KeyC: 99, KeyD: 100, KeyE: 101, KeyF: 102, KeyG: 103, KeyH: 104,
  KeyI: 105, KeyJ: 106, KeyK: 107, KeyL: 108, KeyM: 109, KeyN: 110, KeyO: 111, KeyP: 112,
  KeyQ: 113, KeyR: 114, KeyS: 115, KeyT: 116, KeyU: 117, KeyV: 118, KeyW: 119, KeyX: 120,
  KeyY: 121, KeyZ: 122,
  Digit1: 49, Digit2: 50, Digit3: 51, Digit4: 52, Digit5: 53,
  Digit6: 54, Digit7: 55, Digit8: 56, Digit9: 57, Digit0: 48,
  Space: 32, Minus: 45, Equal: 61, BracketLeft: 91, BracketRight: 93,
  Backslash: 92, Semicolon: 59, Quote: 39, Backquote: 96, Comma: 44, Period: 46, Slash: 47,
};

function hidToKeyname(hid: number): string {
  return Object.entries(WEB_TO_HID).find(([, v]) => v === hid)?.[0] ?? `HID_${hid.toString(16)}`;
}

export function encodeMacroActions(actions: QMKMacroAction[]): number[] {
  const bytes: number[] = [];
  let i = 0;
  while (i < actions.length) {
    const a = actions[i];
    if (a.type === 'delay') {
      const d = a.delay ?? 0;
      if (d <= 0) {
        i++;
        continue;
      }
      const digits = String(d).split('').map((c) => c.charCodeAt(0));
      bytes.push(0x01, 0x04, ...digits, 0x7c);
      i++;
    } else if (a.type === 'keydown') {
      if (PRINTABLE_KEYCODES.has(a.keyname ?? '')) {
        const next = actions[i + 1];
        const isImmediateTap =
          next?.type === 'keyup' && next.keyname === a.keyname;
        if (isImmediateTap) {
          const ascii = WEB_TO_ASCII[a.keyname ?? ''];
          if (ascii !== undefined) bytes.push(ascii);
          i += 2;
        } else {
          const hid = WEB_TO_HID[a.keyname ?? ''] ?? 0;
          bytes.push(0x01, 0x02, hid);
          i++;
        }
      } else if (
        i + 1 < actions.length &&
        actions[i + 1].type === 'keyup' &&
        actions[i + 1].keyname === a.keyname
      ) {
        const hid = WEB_TO_HID[a.keyname ?? ''] ?? 0;
        bytes.push(0x01, 0x01, hid);
        i += 2;
      } else {
        const hid = WEB_TO_HID[a.keyname ?? ''] ?? 0;
        bytes.push(0x01, 0x02, hid);
        i++;
      }
    } else if (a.type === 'keyup') {
      const prev = actions[i - 1];
      const isImmediateTapUp =
        prev?.type === 'keydown' && prev.keyname === a.keyname;
      if (!isImmediateTapUp) {
        const hid = WEB_TO_HID[a.keyname ?? ''] ?? 0;
        bytes.push(0x01, 0x03, hid);
      }
      i++;
    } else {
      i++;
    }
  }
  return bytes;
}

export function encodeAllMacros(macros: QMKMacroProfile[], macroCount: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < macroCount; i++) {
    const macro = macros.find((m) => m.id === i);
    if (macro && macro.actions.length > 0) result.push(...encodeMacroActions(macro.actions));
    result.push(0x00);
  }
  return result;
}

export function parseRawMacroBytes(bytes: number[], macroCount: number): QMKMacroAction[][] {
  const result: QMKMacroAction[][] = [];
  let current: QMKMacroAction[] = [];
  let i = 0;
  let ts = 0;
  while (i < bytes.length && result.length < macroCount) {
    const b = bytes[i];
    if (b === 0x00) {
      result.push(current);
      current = [];
      i++;
      continue;
    }
    if (b === 0x01 && i + 1 < bytes.length) {
      const action = bytes[i + 1];
      if (action === 0x01 && i + 2 < bytes.length) {
        const keyname = hidToKeyname(bytes[i + 2]);
        ts++;
        current.push({ id: `tap-${ts}`, type: 'keydown', keyname, keycode: bytes[i + 2] });
        ts++;
        current.push({ id: `tap-up-${ts}`, type: 'keyup', keyname, keycode: bytes[i + 2] });
        i += 3;
      } else if (action === 0x02 && i + 2 < bytes.length) {
        const keyname = hidToKeyname(bytes[i + 2]);
        ts++;
        current.push({ id: `down-${ts}`, type: 'keydown', keyname, keycode: bytes[i + 2] });
        i += 3;
      } else if (action === 0x03 && i + 2 < bytes.length) {
        const keyname = hidToKeyname(bytes[i + 2]);
        ts++;
        current.push({ id: `up-${ts}`, type: 'keyup', keyname, keycode: bytes[i + 2] });
        i += 3;
      } else if (action === 0x04) {
        i += 2;
        let delayStr = '';
        while (i < bytes.length && bytes[i] !== 0x7c && bytes[i] !== 0x00) {
          delayStr += String.fromCharCode(bytes[i]);
          i++;
        }
        if (bytes[i] === 0x7c) i++;
        ts++;
        current.push({ id: `delay-${ts}`, type: 'delay', delay: parseInt(delayStr, 10) || 0 });
      } else {
        i++;
      }
    } else {
      const keyname = Object.entries(WEB_TO_ASCII).find(([, v]) => v === b)?.[0];
      if (keyname) {
        ts++;
        current.push({ id: `cs-down-${ts}`, type: 'keydown', keyname, keycode: WEB_TO_HID[keyname] ?? 0 });
        ts++;
        current.push({ id: `cs-up-${ts}`, type: 'keyup', keyname, keycode: WEB_TO_HID[keyname] ?? 0 });
      }
      i++;
    }
  }
  return result;
}

export function webCodeToDisplayKey(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'SPACE';
  if (code.startsWith('Arrow')) return code.slice(5).toUpperCase();
  if (code.endsWith('Left') || code.endsWith('Right')) return code.replace(/Left|Right/, '').toUpperCase();
  return code.replace(/^Key/, '');
}

export interface MacroRecorderActionLike {
  id: string;
  type: 'keyboard' | 'mouse' | 'delay';
  key: string;
  hasUpArrow: boolean;
  hasDownArrow: boolean;
  webCode?: string;
}

export interface MacroRecorderProfileLike {
  index: number;
  name: string;
  actions: MacroRecorderActionLike[];
  loopType: 0 | 1 | 2;
  loopCount: number;
}

export function qmkActionsToRecorderActions(actions: QMKMacroAction[]): MacroRecorderActionLike[] {
  const normalized: QMKMacroAction[] = [];
  for (const a of actions) {
    if (a.type === 'delay') {
      const prev = normalized[normalized.length - 1];
      if (prev?.type === 'delay') {
        prev.delay = a.delay;
        continue;
      }
    }
    normalized.push(a);
  }
  return normalized.map((a) => {
    if (a.type === 'delay') {
      return {
        id: a.id,
        type: 'delay',
        key: String(a.delay ?? 0),
        hasUpArrow: false,
        hasDownArrow: false,
        webCode: '',
      };
    }
    return {
      id: a.id,
      type: 'keyboard',
      key: webCodeToDisplayKey(a.keyname ?? ''),
      hasUpArrow: a.type === 'keyup',
      hasDownArrow: a.type === 'keydown',
      webCode: a.keyname ?? '',
    };
  });
}

export function normalizeRecorderActions(actions: MacroRecorderActionLike[]): MacroRecorderActionLike[] {
  const result: MacroRecorderActionLike[] = [];
  for (const a of actions) {
    if (a.type === 'delay') {
      const prev = result[result.length - 1];
      if (prev?.type === 'delay') {
        prev.key = a.key;
        continue;
      }
    }
    result.push({ ...a });
  }
  return result;
}

export function recorderActionsToQmkActions(actions: MacroRecorderActionLike[]): QMKMacroAction[] {
  const result: QMKMacroAction[] = [];
  for (const a of normalizeRecorderActions(actions)) {
    if (a.type === 'delay') {
      result.push({ id: a.id, type: 'delay', delay: parseInt(a.key, 10) || 0 });
      continue;
    }
    if (a.type !== 'keyboard' || !a.webCode) continue;
    result.push({
      id: a.id,
      type: a.hasUpArrow ? 'keyup' : 'keydown',
      keyname: a.webCode,
      keycode: WEB_TO_HID[a.webCode] ?? 0,
    });
  }
  return result;
}

export function recorderProfilesToQmk(profiles: MacroRecorderProfileLike[]): QMKMacroProfile[] {
  return profiles.map((p) => ({
    id: p.index,
    name: p.name,
    actions: recorderActionsToQmkActions(p.actions),
  }));
}

export function qmkParsedToRecorderProfiles(
  parsed: QMKMacroAction[][],
  macroCount: number,
): MacroRecorderProfileLike[] {
  return Array.from({ length: macroCount }, (_, i) => ({
    index: i,
    name: `M${i}`,
    actions: qmkActionsToRecorderActions(parsed[i] ?? []),
    loopType: 0 as const,
    loopCount: 1,
  }));
}
