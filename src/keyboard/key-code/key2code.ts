import { getByteForLayerCode } from "../keycode";
import { advancedStringToKeycode } from "./advanced_keys";
import keyCodeV10 from "./v10";
import keyCodeV11 from "./v11";
import keyCodeV12 from "./v12";

export interface IKeycode {
  name: string;
  code: string;
  title?: string;
  shortName?: string;
  keys?: string;
  width?: number;
  type?: "container" | "text" | "layer";
  layer?: number;
}

export interface IKeycodeMenu {
  id: string;
  label: string;
  keycodes: IKeycode[];
  width?: "label";
  detailed?: string;
}

const quantumRangesKeys = [
  "_QK_MODS",
  "_QK_MODS_MAX",
  "_QK_MOD_TAP",
  "_QK_MOD_TAP_MAX",
  "_QK_LAYER_TAP",
  "_QK_LAYER_TAP_MAX",
  "_QK_LAYER_MOD",
  "_QK_LAYER_MOD_MAX",
  "_QK_TO",
  "_QK_TO_MAX",
  "_QK_MOMENTARY",
  "_QK_MOMENTARY_MAX",
  "_QK_DEF_LAYER",
  "_QK_DEF_LAYER_MAX",
  "_QK_TOGGLE_LAYER",
  "_QK_TOGGLE_LAYER_MAX",
  "_QK_ONE_SHOT_LAYER",
  "_QK_ONE_SHOT_LAYER_MAX",
  "_QK_ONE_SHOT_MOD",
  "_QK_ONE_SHOT_MOD_MAX",
  "_QK_LAYER_TAP_TOGGLE",
  "_QK_LAYER_TAP_TOGGLE_MAX",
  "_QK_KB",
  "_QK_KB_MAX",
  "_QK_MACRO",
  "_QK_MACRO_MAX",
];

const quantumRanges = (
  basicKeyToByte: Record<string, number>
): Record<string, number> => {
  return Object.keys(basicKeyToByte).reduce(
    (acc, key) =>
      quantumRangesKeys.includes(key)
        ? { ...acc, [key]: basicKeyToByte[key] }
        : acc,
    {}
  );
};

const modCodes = {
  QK_LCTL: 0x0100,
  QK_LSFT: 0x0200,
  QK_LALT: 0x0400,
  QK_LGUI: 0x0800,
  QK_RMODS_MIN: 0x1000,
  QK_RCTL: 0x1100,
  QK_RSFT: 0x1200,
  QK_RALT: 0x1400,
  QK_RGUI: 0x1800,
};

const modMasks = {
  MOD_LCTL: 0x0001,
  MOD_LSFT: 0x0002,
  MOD_LALT: 0x0004,
  MOD_LGUI: 0x0008,
  MOD_RCTL: 0x0011,
  MOD_RSFT: 0x0012,
  MOD_RALT: 0x0014,
  MOD_RGUI: 0x0018,
  MOD_HYPR: 0x000f,
  MOD_MEH: 0x0007,
};

const topLevelMacroToValue = {
  MT: "_QK_MOD_TAP", // MT(mod, kc)
  LT: "_QK_LAYER_TAP", // LT(layer, kc)
  LM: "_QK_LAYER_MOD", // LM(layer, mod)
  TO: "_QK_TO", // TO(layer)
  MO: "_QK_MOMENTARY", // MO(layer)
  DF: "_QK_DEF_LAYER", //DF(layer)
  TG: "_QK_TOGGLE_LAYER", //  TG(layer)
  OSL: "_QK_ONE_SHOT_LAYER", // OSL(layer)
  OSM: "_QK_ONE_SHOT_MOD", //OSM(mod)
  TT: "_QK_LAYER_TAP_TOGGLE", // TT(layer)
  CUSTOM: "_QK_KB", // CUSTOM(n)
  MACRO: "_QK_MACRO", // MACRO(n)
};

const modifierKeyToValue = {
  LCTL: modCodes.QK_LCTL,
  C: modCodes.QK_LCTL,
  LSFT: modCodes.QK_LSFT,
  S: modCodes.QK_LSFT,
  LALT: modCodes.QK_LALT,
  A: modCodes.QK_LALT,
  LGUI: modCodes.QK_LGUI,
  LCMD: modCodes.QK_LGUI,
  LWIN: modCodes.QK_LGUI,
  G: modCodes.QK_LGUI,
  RCTL: modCodes.QK_RCTL,
  RSFT: modCodes.QK_RSFT,
  ALGR: modCodes.QK_RALT,
  RALT: modCodes.QK_RALT,
  RCMD: modCodes.QK_RGUI,
  RWIN: modCodes.QK_RGUI,
  RGUI: modCodes.QK_RGUI,
  SCMD: modCodes.QK_LSFT | modCodes.QK_LGUI,
  SWIN: modCodes.QK_LSFT | modCodes.QK_LGUI,
  SGUI: modCodes.QK_LSFT | modCodes.QK_LGUI,
  LSG: modCodes.QK_LSFT | modCodes.QK_LGUI,
  LAG: modCodes.QK_LALT | modCodes.QK_LGUI,
  RSG: modCodes.QK_RSFT | modCodes.QK_RGUI,
  RAG: modCodes.QK_RALT | modCodes.QK_RGUI,
  LCA: modCodes.QK_LCTL | modCodes.QK_LALT,
  LSA: modCodes.QK_LSFT | modCodes.QK_LALT,
  SAGR: modCodes.QK_RSFT | modCodes.QK_RALT,
  RSA: modCodes.QK_RSFT | modCodes.QK_RALT,
  RCS: modCodes.QK_RCTL | modCodes.QK_RSFT,
  LCAG: modCodes.QK_LCTL | modCodes.QK_LALT | modCodes.QK_LGUI,
  MEH: modCodes.QK_LCTL | modCodes.QK_LALT | modCodes.QK_LSFT,
  HYPR:
    modCodes.QK_LCTL | modCodes.QK_LALT | modCodes.QK_LSFT | modCodes.QK_LGUI,
};

export const evtToCode = (
  basicKeyToByte: Record<string, number>,
  code: string
) => {
  const evtToKeyByte = {
    Digit1: basicKeyToByte.KC_1,
    Digit2: basicKeyToByte.KC_2,
    Digit3: basicKeyToByte.KC_3,
    Digit4: basicKeyToByte.KC_4,
    Digit5: basicKeyToByte.KC_5,
    Digit6: basicKeyToByte.KC_6,
    Digit7: basicKeyToByte.KC_7,
    Digit8: basicKeyToByte.KC_8,
    Digit9: basicKeyToByte.KC_9,
    Digit0: basicKeyToByte.KC_0,
    KeyA: basicKeyToByte.KC_A,
    KeyB: basicKeyToByte.KC_B,
    KeyC: basicKeyToByte.KC_C,
    KeyD: basicKeyToByte.KC_D,
    KeyE: basicKeyToByte.KC_E,
    KeyF: basicKeyToByte.KC_F,
    KeyG: basicKeyToByte.KC_G,
    KeyH: basicKeyToByte.KC_H,
    KeyI: basicKeyToByte.KC_I,
    KeyJ: basicKeyToByte.KC_J,
    KeyK: basicKeyToByte.KC_K,
    KeyL: basicKeyToByte.KC_L,
    KeyM: basicKeyToByte.KC_M,
    KeyN: basicKeyToByte.KC_N,
    KeyO: basicKeyToByte.KC_O,
    KeyP: basicKeyToByte.KC_P,
    KeyQ: basicKeyToByte.KC_Q,
    KeyR: basicKeyToByte.KC_R,
    KeyS: basicKeyToByte.KC_S,
    KeyT: basicKeyToByte.KC_T,
    KeyU: basicKeyToByte.KC_U,
    KeyV: basicKeyToByte.KC_V,
    KeyW: basicKeyToByte.KC_W,
    KeyX: basicKeyToByte.KC_X,
    KeyY: basicKeyToByte.KC_Y,
    KeyZ: basicKeyToByte.KC_Z,
    Comma: basicKeyToByte.KC_COMM,
    Period: basicKeyToByte.KC_DOT,
    Semicolon: basicKeyToByte.KC_SCLN,
    Quote: basicKeyToByte.KC_QUOT,
    BracketLeft: basicKeyToByte.KC_LBRC,
    BracketRight: basicKeyToByte.KC_RBRC,
    Backspace: basicKeyToByte.KC_BSPC,
    Backquote: basicKeyToByte.KC_GRV,
    Slash: basicKeyToByte.KC_SLSH,
    Backslash: basicKeyToByte.KC_BSLS,
    Minus: basicKeyToByte.KC_MINS,
    Equal: basicKeyToByte.KC_EQL,
    IntlRo: basicKeyToByte.KC_RO,
    IntlYen: basicKeyToByte.KC_JYEN,
    AltLeft: basicKeyToByte.KC_LALT,
    AltRight: basicKeyToByte.KC_RALT,
    CapsLock: basicKeyToByte.KC_CAPS,
    ControlLeft: basicKeyToByte.KC_LCTL,
    ControlRight: basicKeyToByte.KC_RCTL,
    MetaLeft: basicKeyToByte.KC_LGUI,
    MetaRight: basicKeyToByte.KC_RGUI,
    OSLeft: basicKeyToByte.KC_LGUI,
    OSRight: basicKeyToByte.KC_RGUI,
    ShiftLeft: basicKeyToByte.KC_LSFT,
    ShiftRight: basicKeyToByte.KC_RSFT,
    ContextMenu: basicKeyToByte.KC_APP,
    Enter: basicKeyToByte.KC_ENT,
    Space: basicKeyToByte.KC_SPC,
    Tab: basicKeyToByte.KC_TAB,
    Delete: basicKeyToByte.KC_DEL,
    End: basicKeyToByte.KC_END,
    Help: basicKeyToByte.KC_HELP,
    Home: basicKeyToByte.KC_HOME,
    Insert: basicKeyToByte.KC_INS,
    PageDown: basicKeyToByte.KC_PGDN,
    PageUp: basicKeyToByte.KC_PGUP,
    ArrowDown: basicKeyToByte.KC_DOWN,
    ArrowLeft: basicKeyToByte.KC_LEFT,
    ArrowRight: basicKeyToByte.KC_RGHT,
    ArrowUp: basicKeyToByte.KC_UP,
    Escape: basicKeyToByte.KC_ESC,
    PrintScreen: basicKeyToByte.KC_PSCR,
    ScrollLock: basicKeyToByte.KC_SLCK,
    AudioVolumeUp: basicKeyToByte.KC_VOLU,
    AudioVolumeDown: basicKeyToByte.KC_VOLD,
    AudioVolumeMute: basicKeyToByte.KC_MUTE,
    Pause: basicKeyToByte.KC_PAUS,
    F1: basicKeyToByte.KC_F1,
    F2: basicKeyToByte.KC_F2,
    F3: basicKeyToByte.KC_F3,
    F4: basicKeyToByte.KC_F4,
    F5: basicKeyToByte.KC_F5,
    F6: basicKeyToByte.KC_F6,
    F7: basicKeyToByte.KC_F7,
    F8: basicKeyToByte.KC_F8,
    F9: basicKeyToByte.KC_F9,
    F10: basicKeyToByte.KC_F10,
    F11: basicKeyToByte.KC_F11,
    F12: basicKeyToByte.KC_F12,
    F13: basicKeyToByte.KC_F13,
    F14: basicKeyToByte.KC_F14,
    F15: basicKeyToByte.KC_F15,
    F16: basicKeyToByte.KC_F16,
    F17: basicKeyToByte.KC_F17,
    F18: basicKeyToByte.KC_F18,
    F19: basicKeyToByte.KC_F19,
    F20: basicKeyToByte.KC_F20,
    F21: basicKeyToByte.KC_F21,
    F22: basicKeyToByte.KC_F22,
    F23: basicKeyToByte.KC_F23,
    F24: basicKeyToByte.KC_F24,
    NumLock: basicKeyToByte.KC_NLCK,
    Numpad0: basicKeyToByte.KC_P0,
    Numpad1: basicKeyToByte.KC_P1,
    Numpad2: basicKeyToByte.KC_P2,
    Numpad3: basicKeyToByte.KC_P3,
    Numpad4: basicKeyToByte.KC_P4,
    Numpad5: basicKeyToByte.KC_P5,
    Numpad6: basicKeyToByte.KC_P6,
    Numpad7: basicKeyToByte.KC_P7,
    Numpad8: basicKeyToByte.KC_P8,
    Numpad9: basicKeyToByte.KC_P9,
    NumpadAdd: basicKeyToByte.KC_PPLS,
    NumpadComma: basicKeyToByte.KC_COMM,
    NumpadDecimal: basicKeyToByte.KC_PDOT,
    NumpadDivide: basicKeyToByte.KC_PSLS,
    NumpadEnter: basicKeyToByte.KC_PENT,
    NumpadEqual: basicKeyToByte.KC_PEQL,
    NumpadMultiply: basicKeyToByte.KC_PAST,
    NumpadSubtract: basicKeyToByte.KC_PMNS,
  };
  return evtToKeyByte[code as keyof typeof evtToKeyByte];
};

export const codeToEvt = (
  basicKeyToByte: Record<string, number>,
  code: number
) => {
  const evtToKeyByte = {
    Digit1: basicKeyToByte.KC_1,
    Digit2: basicKeyToByte.KC_2,
    Digit3: basicKeyToByte.KC_3,
    Digit4: basicKeyToByte.KC_4,
    Digit5: basicKeyToByte.KC_5,
    Digit6: basicKeyToByte.KC_6,
    Digit7: basicKeyToByte.KC_7,
    Digit8: basicKeyToByte.KC_8,
    Digit9: basicKeyToByte.KC_9,
    Digit0: basicKeyToByte.KC_0,
    KeyA: basicKeyToByte.KC_A,
    KeyB: basicKeyToByte.KC_B,
    KeyC: basicKeyToByte.KC_C,
    KeyD: basicKeyToByte.KC_D,
    KeyE: basicKeyToByte.KC_E,
    KeyF: basicKeyToByte.KC_F,
    KeyG: basicKeyToByte.KC_G,
    KeyH: basicKeyToByte.KC_H,
    KeyI: basicKeyToByte.KC_I,
    KeyJ: basicKeyToByte.KC_J,
    KeyK: basicKeyToByte.KC_K,
    KeyL: basicKeyToByte.KC_L,
    KeyM: basicKeyToByte.KC_M,
    KeyN: basicKeyToByte.KC_N,
    KeyO: basicKeyToByte.KC_O,
    KeyP: basicKeyToByte.KC_P,
    KeyQ: basicKeyToByte.KC_Q,
    KeyR: basicKeyToByte.KC_R,
    KeyS: basicKeyToByte.KC_S,
    KeyT: basicKeyToByte.KC_T,
    KeyU: basicKeyToByte.KC_U,
    KeyV: basicKeyToByte.KC_V,
    KeyW: basicKeyToByte.KC_W,
    KeyX: basicKeyToByte.KC_X,
    KeyY: basicKeyToByte.KC_Y,
    KeyZ: basicKeyToByte.KC_Z,
    Comma: basicKeyToByte.KC_COMM,
    Period: basicKeyToByte.KC_DOT,
    Semicolon: basicKeyToByte.KC_SCLN,
    Quote: basicKeyToByte.KC_QUOT,
    BracketLeft: basicKeyToByte.KC_LBRC,
    BracketRight: basicKeyToByte.KC_RBRC,
    Backspace: basicKeyToByte.KC_BSPC,
    Backquote: basicKeyToByte.KC_GRV,
    Slash: basicKeyToByte.KC_SLSH,
    Backslash: basicKeyToByte.KC_BSLS,
    Minus: basicKeyToByte.KC_MINS,
    Equal: basicKeyToByte.KC_EQL,
    IntlRo: basicKeyToByte.KC_RO,
    IntlYen: basicKeyToByte.KC_JYEN,
    AltLeft: basicKeyToByte.KC_LALT,
    AltRight: basicKeyToByte.KC_RALT,
    CapsLock: basicKeyToByte.KC_CAPS,
    ControlLeft: basicKeyToByte.KC_LCTL,
    ControlRight: basicKeyToByte.KC_RCTL,
    MetaLeft: basicKeyToByte.KC_LGUI,
    MetaRight: basicKeyToByte.KC_RGUI,
    OSLeft: basicKeyToByte.KC_LGUI,
    OSRight: basicKeyToByte.KC_RGUI,
    ShiftLeft: basicKeyToByte.KC_LSFT,
    ShiftRight: basicKeyToByte.KC_RSFT,
    ContextMenu: basicKeyToByte.KC_APP,
    Enter: basicKeyToByte.KC_ENT,
    Space: basicKeyToByte.KC_SPC,
    Tab: basicKeyToByte.KC_TAB,
    Delete: basicKeyToByte.KC_DEL,
    End: basicKeyToByte.KC_END,
    Help: basicKeyToByte.KC_HELP,
    Home: basicKeyToByte.KC_HOME,
    Insert: basicKeyToByte.KC_INS,
    PageDown: basicKeyToByte.KC_PGDN,
    PageUp: basicKeyToByte.KC_PGUP,
    ArrowDown: basicKeyToByte.KC_DOWN,
    ArrowLeft: basicKeyToByte.KC_LEFT,
    ArrowRight: basicKeyToByte.KC_RGHT,
    ArrowUp: basicKeyToByte.KC_UP,
    Escape: basicKeyToByte.KC_ESC,
    PrintScreen: basicKeyToByte.KC_PSCR,
    ScrollLock: basicKeyToByte.KC_SLCK,
    AudioVolumeUp: basicKeyToByte.KC_VOLU,
    AudioVolumeDown: basicKeyToByte.KC_VOLD,
    AudioVolumeMute: basicKeyToByte.KC_MUTE,
    Pause: basicKeyToByte.KC_PAUS,
    F1: basicKeyToByte.KC_F1,
    F2: basicKeyToByte.KC_F2,
    F3: basicKeyToByte.KC_F3,
    F4: basicKeyToByte.KC_F4,
    F5: basicKeyToByte.KC_F5,
    F6: basicKeyToByte.KC_F6,
    F7: basicKeyToByte.KC_F7,
    F8: basicKeyToByte.KC_F8,
    F9: basicKeyToByte.KC_F9,
    F10: basicKeyToByte.KC_F10,
    F11: basicKeyToByte.KC_F11,
    F12: basicKeyToByte.KC_F12,
    F13: basicKeyToByte.KC_F13,
    F14: basicKeyToByte.KC_F14,
    F15: basicKeyToByte.KC_F15,
    F16: basicKeyToByte.KC_F16,
    F17: basicKeyToByte.KC_F17,
    F18: basicKeyToByte.KC_F18,
    F19: basicKeyToByte.KC_F19,
    F20: basicKeyToByte.KC_F20,
    F21: basicKeyToByte.KC_F21,
    F22: basicKeyToByte.KC_F22,
    F23: basicKeyToByte.KC_F23,
    F24: basicKeyToByte.KC_F24,
    NumLock: basicKeyToByte.KC_NLCK,
    Numpad0: basicKeyToByte.KC_P0,
    Numpad1: basicKeyToByte.KC_P1,
    Numpad2: basicKeyToByte.KC_P2,
    Numpad3: basicKeyToByte.KC_P3,
    Numpad4: basicKeyToByte.KC_P4,
    Numpad5: basicKeyToByte.KC_P5,
    Numpad6: basicKeyToByte.KC_P6,
    Numpad7: basicKeyToByte.KC_P7,
    Numpad8: basicKeyToByte.KC_P8,
    Numpad9: basicKeyToByte.KC_P9,
    NumpadAdd: basicKeyToByte.KC_PPLS,
    NumpadComma: basicKeyToByte.KC_COMM,
    NumpadDecimal: basicKeyToByte.KC_PDOT,
    NumpadDivide: basicKeyToByte.KC_PSLS,
    NumpadEnter: basicKeyToByte.KC_PENT,
    NumpadEqual: basicKeyToByte.KC_PEQL,
    NumpadMultiply: basicKeyToByte.KC_PAST,
    NumpadSubtract: basicKeyToByte.KC_PMNS,
  };

  return Object.keys(evtToKeyByte).find(
    (key) => evtToKeyByte[key as keyof typeof evtToKeyByte] == code
  );
};

export const getKeyCodeDict = (version: number) => {
  switch (version) {
    case 13:
    case 12:
      return keyCodeV12;
    case 11:
      return keyCodeV11;
    default:
      return keyCodeV10;
  }
};

export const getCode = (key: string, version: number = 11) => {
  const dict: Record<string, number> = getKeyCodeDict(version);
  // if (isLayerKey(key)) {
  //     return getCustomCode(key, dict);
  // }
  // return dict[key];

  return getByteForCode(key, dict);
};

export function getByteForCode(
  code: string,
  basicKeyToByte: Record<string, number>
) {
  const byte: number | undefined = basicKeyToByte[code];
  if (byte !== undefined) {
    return byte;
  } else if (isLayerCode(code)) {
    return getCustomCode(code, basicKeyToByte);
  } else if (advancedStringToKeycode(code, basicKeyToByte) !== null) {
    return advancedStringToKeycode(code, basicKeyToByte);
  }
  throw `Could not find byte for ${code}`;
}

export function isLayerCode(key: string) {
  return /([A-Za-z]+)\((\d+)\)/.test(key);
}

export const getCustomCode = (key: string, dict: Record<string, number>) => {
  const keycodeMatch = key.match(/([A-Za-z]+)\((\d+)\)/);
  if (keycodeMatch) {
    const [, code, layer] = keycodeMatch;
    const numLayer = parseInt(layer);
    switch (code) {
      case "TO": {
        return Math.min(dict._QK_TO + numLayer, dict._QK_TO_MAX);
      }
      case "MO": {
        return Math.min(dict._QK_MOMENTARY + numLayer, dict._QK_MOMENTARY_MAX);
      }
      case "DF": {
        return Math.min(dict._QK_DEF_LAYER + numLayer, dict._QK_DEF_LAYER_MAX);
      }
      case "TG": {
        return Math.min(
          dict._QK_TOGGLE_LAYER + numLayer,
          dict._QK_TOGGLE_LAYER_MAX
        );
      }
      case "OSL": {
        return Math.min(
          dict._QK_ONE_SHOT_LAYER + numLayer,
          dict._QK_ONE_SHOT_LAYER_MAX
        );
      }
      case "TT": {
        return Math.min(
          dict._QK_LAYER_TAP_TOGGLE + numLayer,
          dict._QK_LAYER_TAP_TOGGLE_MAX
        );
      }
      case "CUSTOM": {
        return Math.min(dict._QK_KB + numLayer, dict._QK_KB_MAX);
      }
      case "MACRO": {
        return Math.min(dict._QK_MACRO + numLayer, dict._QK_MACRO_MAX);
      }
      default: {
        throw new Error("Incorrect code");
      }
    }
  }
};

export function getLabelForByte(
  byte: number,
  basicKeyToByte: Record<string, number>,
  byteToKey: Record<number, string>
) {
  const keycode = getCodeForByte(byte, basicKeyToByte, byteToKey);
  const basicKeycode = keycodesList.find(({ code }) => code === keycode);
  if (!basicKeycode) {
    return keycode;
  }
  return getShortNameForKeycode(basicKeycode, 100);
}

export function getShortNameForKeycode(keycode: IKeycode, size = 100) {
  const { code, name, shortName } = keycode;
  if (size <= 150 && shortName) {
    return shortName;
  }
  if (size === 100 && name.length > 5) {
    const shortenedName = shorten(name);
    if (!!code) {
      const shortCode = code.replace("KC_", "").replace("_", " ");
      return shortenedName.length > 4 && shortCode.length < shortenedName.length
        ? shortCode
        : shortenedName;
    }
    return shortenedName;
  }
  return name;
}

function shorten(str: string) {
  return str
    .split(" ")
    .map((word) => word.slice(0, 1) + word.slice(1).replace(/[aeiou ]/gi, ""))
    .join("");
}

export const keycodesList = getKeycodes().reduce<IKeycode[]>(
  (p, n) => p.concat(n.keycodes),
  []
);

export function getCodeForByte(
  byte: number,
  basicKeyToByte: Record<string, number>,
  byteToKey: Record<number, string>
) {
  const keycode = byteToKey[byte];
  if (keycode && !keycode.startsWith("_QK")) {
    return keycode;
  } else if (isLayerKey(byte, basicKeyToByte)) {
    return getCodeForLayerByte(byte, basicKeyToByte);
  } else if (
    advancedKeycodeToString(byte, basicKeyToByte, byteToKey) !== null
  ) {
    return advancedKeycodeToString(byte, basicKeyToByte, byteToKey);
  } else {
    return "0x" + Number(byte).toString(16);
  }
}

export const getByteToKey = (basicKeyToByte: Record<string, number>) =>
  Object.keys(basicKeyToByte).reduce((p, n) => {
    const key = basicKeyToByte[n];
    if (key in p) {
      const basicKeycode = keycodesList.find(({ code }) => code === n);
      if (basicKeycode) {
        return { ...p, [key]: basicKeycode.code };
      }
      return p;
    }
    return { ...p, [key]: n };
  }, {} as { [key: number]: string });

function isLayerKey(byte: number, basicKeyToByte: Record<string, number>) {
  return [
    [basicKeyToByte._QK_TO, basicKeyToByte._QK_TO_MAX],
    [basicKeyToByte._QK_MOMENTARY, basicKeyToByte._QK_MOMENTARY_MAX],
    [basicKeyToByte._QK_DEF_LAYER, basicKeyToByte._QK_DEF_LAYER_MAX],
    [basicKeyToByte._QK_TOGGLE_LAYER, basicKeyToByte._QK_TOGGLE_LAYER_MAX],
    [basicKeyToByte._QK_ONE_SHOT_LAYER, basicKeyToByte._QK_ONE_SHOT_LAYER_MAX],
    [
      basicKeyToByte._QK_LAYER_TAP_TOGGLE,
      basicKeyToByte._QK_LAYER_TAP_TOGGLE_MAX,
    ],
    [basicKeyToByte._QK_KB, basicKeyToByte._QK_KB_MAX],
    [basicKeyToByte._QK_MACRO, basicKeyToByte._QK_MACRO_MAX],
  ].some((code) => byte >= code[0] && byte <= code[1]);
}

function getCodeForLayerByte(
  byte: number,
  basicKeyToByte: Record<string, number>
) {
  if (basicKeyToByte._QK_TO <= byte && basicKeyToByte._QK_TO_MAX >= byte) {
    const layer = byte - basicKeyToByte._QK_TO;
    return `TO(${layer})`;
  } else if (
    basicKeyToByte._QK_MOMENTARY <= byte &&
    basicKeyToByte._QK_MOMENTARY_MAX >= byte
  ) {
    const layer = byte - basicKeyToByte._QK_MOMENTARY;
    return `MO(${layer})`;
  } else if (
    basicKeyToByte._QK_DEF_LAYER <= byte &&
    basicKeyToByte._QK_DEF_LAYER_MAX >= byte
  ) {
    const layer = byte - basicKeyToByte._QK_DEF_LAYER;
    return `DF(${layer})`;
  } else if (
    basicKeyToByte._QK_TOGGLE_LAYER <= byte &&
    basicKeyToByte._QK_TOGGLE_LAYER_MAX >= byte
  ) {
    const layer = byte - basicKeyToByte._QK_TOGGLE_LAYER;
    return `TG(${layer})`;
  } else if (
    basicKeyToByte._QK_ONE_SHOT_LAYER <= byte &&
    basicKeyToByte._QK_ONE_SHOT_LAYER_MAX >= byte
  ) {
    const layer = byte - basicKeyToByte._QK_ONE_SHOT_LAYER;
    return `OSL(${layer})`;
  } else if (
    basicKeyToByte._QK_LAYER_TAP_TOGGLE <= byte &&
    basicKeyToByte._QK_LAYER_TAP_TOGGLE_MAX >= byte
  ) {
    const layer = byte - basicKeyToByte._QK_LAYER_TAP_TOGGLE;
    return `TT(${layer})`;
  } else if (
    basicKeyToByte._QK_KB <= byte &&
    basicKeyToByte._QK_KB_MAX >= byte
  ) {
    const n = byte - basicKeyToByte._QK_KB;
    return `CUSTOM(${n})`;
  } else if (
    basicKeyToByte._QK_MACRO <= byte &&
    basicKeyToByte._QK_MACRO_MAX >= byte
  ) {
    const n = byte - basicKeyToByte._QK_MACRO;
    return `MACRO(${n})`;
  }
}

export const advancedKeycodeToString = (
  inputKeycode: number,
  basicKeyToByte: Record<string, number>,
  byteToKey: Record<number, string>
): string | null => {
  let valueToRange = Object.entries(quantumRanges(basicKeyToByte))
    .map(([key, value]) => [value, key])
    .sort((a, b) => (a[0] as number) - (b[0] as number));

  /* Find the range we are in first */
  let lastRange = null;
  let lastValue: number = -1;
  for (let i = 0; i < valueToRange.length; i += 2) {
    if (
      inputKeycode >= parseInt(valueToRange[i][0] + "") &&
      inputKeycode <= parseInt(valueToRange[i + 1][0] + "")
    ) {
      lastRange = valueToRange[i][1];
      lastValue = +valueToRange[i][0];
    }
  }

  const topLevelModKeys = ["_QK_MODS"];
  if (topLevelModKeys.includes(lastRange as string)) {
    return topLevelModToString(inputKeycode, byteToKey);
  }
  let humanReadable: string | null =
    (topLevelValueToMacro(basicKeyToByte) as any)[lastValue] + "(";
  let remainder = inputKeycode & ~lastValue;
  let layer = 0;
  let keycode = "";
  let modValue = 0;
  switch (lastRange) {
    case "_QK_KB":
    case "_QK_MACRO":
      humanReadable += inputKeycode - lastValue + ")";
      break;
    case "_QK_MOMENTARY":
    case "_QK_DEF_LAYER":
    case "_QK_TOGGLE_LAYER":
    case "_QK_ONE_SHOT_LAYER":
    case "_QK_LAYER_TAP_TOGGLE":
    case "_QK_TO":
      humanReadable += remainder + ")";
      break;
    case "_QK_LAYER_TAP":
      layer = remainder >> 8;
      keycode = byteToKey[remainder & 0xff];
      humanReadable += layer + "," + keycode + ")";
      break;
    case "_QK_ONE_SHOT_MOD":
      humanReadable += modValueToString(remainder) + ")";
      break;
    case "_QK_LAYER_MOD":
      let mask = basicKeyToByte._QK_LAYER_MOD_MASK;
      let shift = Math.log2(mask + 1);
      layer = remainder >> shift;
      modValue = remainder & mask;
      humanReadable += layer + "," + modValueToString(modValue) + ")";
      break;
    case "_QK_MOD_TAP":
      modValue = (remainder >> 8) & 0x1f;
      keycode = byteToKey[remainder & 0xff];
      humanReadable += modValueToString(modValue) + "," + keycode + ")";
      break;
    default:
      humanReadable = null;
  }
  return humanReadable;
};

const topLevelValueToMacro = (
  basicKeyToByte: Record<string, number>
): Record<number, string> => {
  return Object.entries(topLevelMacroToValue).reduce(
    (acc, [key, value]) => ({ ...acc, [basicKeyToByte[value]]: key }),
    {}
  );
};

const modValueToString = (modMask: number): string => {
  const excluded = ["MOD_HYPR", "MOD_MEH"];
  const qualifyingStrings = Object.entries(modMasks)
    .filter(
      (part) => !excluded.includes(part[0]) && (part[1] & modMask) === part[1]
    )
    .map((part) => part[0]);
  return qualifyingStrings.join(" | ");
};

// All modifier combos
const modifierValueToKey: Record<number, string> = Object.entries(
  modifierKeyToValue
).reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {});

// Single left modifiers (as opposed to combos)
const leftModifierValueToKey: Record<number, string> = Object.entries(
  modifierKeyToValue
)
  .filter(
    ([_, value]) =>
      Object.values(modCodes).includes(value) && value < modCodes.QK_RMODS_MIN
  )
  .reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {});

// Single right modifiers (as opposed to combos)
const rightModifierValueToKey: Record<number, string> = Object.entries(
  modifierKeyToValue
)
  .filter(
    ([_, value]) =>
      Object.values(modCodes).includes(value) && value >= modCodes.QK_RMODS_MIN
  )
  .reduce((acc, [key, value]) => ({ ...acc, [value]: key }), {});

const topLevelModToString = (
  keycode: number,
  byteToKey: Record<number, string>
): string => {
  const containedKeycode = byteToKey[keycode & 0x00ff];
  const modifierValue = keycode & 0x1f00;
  // if we find an exact match (like HYPR or MEH or LAG), use that
  const modifierKey = modifierValueToKey[modifierValue];
  if (modifierKey != undefined) {
    return modifierKey + "(" + containedKeycode + ")";
  }

  // Left and right mods are mutually exclusive.
  // Test the bit which is common to all right mods,
  // and generate the string from one of two lookups.
  const enabledMods = Object.entries(
    modifierValue & modCodes.QK_RMODS_MIN
      ? rightModifierValueToKey
      : leftModifierValueToKey
  )
    .filter((part) => {
      const current = Number.parseInt(part[0]);
      return (current & modifierValue) === current;
    })
    .map((part) => part[1]);
  return (
    enabledMods.join("(") +
    "(" +
    containedKeycode +
    ")".repeat(enabledMods.length)
  );
};

const parseTopLevelMacro = (
  inputParts: string[],
  basicKeyToByte: Record<string, number>
): number => {
  const topLevelKey = inputParts[0];
  const parameter = inputParts[1] ?? "";
  let [param1, param2] = ["", ""];
  let layer = 0;
  let mods = 0;
  switch (topLevelKey) {
    case "MO":
    case "DF":
    case "TG":
    case "OSL":
    case "TT":
    case "TO":
      layer = Number.parseInt(parameter);
      if (layer < 0) {
        return 0;
      }
      return basicKeyToByte[topLevelMacroToValue[topLevelKey]] | (layer & 0xff);
    case "OSM": //#define OSM(mod) (QK_ONE_SHOT_MOD | ((mod)&0xFF))
      mods = parseMods(parameter);
      if (mods === 0) {
        return 0;
      }
      return basicKeyToByte[topLevelMacroToValue[topLevelKey]] | (mods & 0xff);
    case "LM": //#define LM(layer, mod) (QK_LAYER_MOD | (((layer)&0xF) << 4) | ((mod)&0xF))
      [param1, param2] = parameter.split(",").map((s) => s.trim());
      let mask = basicKeyToByte._QK_LAYER_MOD_MASK;
      let shift = Math.log2(mask + 1);
      layer = Number.parseInt(param1);
      mods = parseMods(param2);
      if (layer < 0 || mods === 0) {
        return 0;
      }
      return (
        basicKeyToByte[topLevelMacroToValue[topLevelKey]] |
        ((layer & 0xf) << shift) |
        (mods & mask)
      );
    case "LT": //#define LT(layer, kc) (QK_LAYER_TAP | (((layer)&0xF) << 8) | ((kc)&0xFF))
      [param1, param2] = parameter.split(",").map((s) => s.trim());
      layer = Number.parseInt(param1);
      if (layer < 0 || !basicKeyToByte.hasOwnProperty(param2)) {
        return 0;
      }
      return (
        basicKeyToByte[topLevelMacroToValue[topLevelKey]] |
        ((layer & 0xf) << 8) |
        basicKeyToByte[param2]
      );
    case "MT": // #define MT(mod, kc) (QK_MOD_TAP | (((mod)&0x1F) << 8) | ((kc)&0xFF))
      [param1, param2] = parameter.split(",").map((s) => s.trim());
      mods = parseMods(param1);
      if (mods === 0 || !basicKeyToByte.hasOwnProperty(param2)) {
        return 0;
      }
      return (
        basicKeyToByte[topLevelMacroToValue[topLevelKey]] |
        ((mods & 0x1f) << 8) |
        (basicKeyToByte[param2] & 0xff)
      );
    case "CUSTOM": {
      const n = Number.parseInt(parameter);
      const nMax = basicKeyToByte._QK_KB_MAX - basicKeyToByte._QK_KB;
      if (n >= 0 && n <= nMax) {
        return basicKeyToByte[topLevelMacroToValue[topLevelKey]] + n;
      }
      return 0;
    }
    case "MACRO": {
      const n = Number.parseInt(parameter);
      const nMax = basicKeyToByte._QK_MACRO_MAX - basicKeyToByte._QK_MACRO;
      if (n >= 0 && n <= nMax) {
        return basicKeyToByte[topLevelMacroToValue[topLevelKey]] + n;
      }
      return 0;
    }
    default:
      return 0;
  }
};

const parseMods = (input: string = ""): number => {
  const parts = input.split("|").map((s) => s.trim());
  if (
    !parts.reduce((acc, part) => acc && modMasks.hasOwnProperty(part), true)
  ) {
    return 0;
  }
  return parts.reduce(
    (acc, part) => acc | modMasks[part as keyof typeof modMasks],
    0
  );
};

export function getKeycodes(numMacros = 16): IKeycodeMenu[] {
  return [
    {
      id: "basic",
      label: "Basic",
      keycodes: [
        { name: "", code: "KC_NO", title: "Nothing" },
        { name: "▽", code: "KC_TRNS", title: "Pass-through" },
        // TODO: remove "shortName" when multiline keycap labels are working
        { name: "Esc", code: "KC_ESC", keys: "esc" },
        { name: "A", code: "KC_A", keys: "a" },
        { name: "B", code: "KC_B", keys: "b" },
        { name: "C", code: "KC_C", keys: "c" },
        { name: "D", code: "KC_D", keys: "d" },
        { name: "E", code: "KC_E", keys: "e" },
        { name: "F", code: "KC_F", keys: "f" },
        { name: "G", code: "KC_G", keys: "g" },
        { name: "H", code: "KC_H", keys: "h" },
        { name: "I", code: "KC_I", keys: "i" },
        { name: "J", code: "KC_J", keys: "j" },
        { name: "K", code: "KC_K", keys: "k" },
        { name: "L", code: "KC_L", keys: "l" },
        { name: "M", code: "KC_M", keys: "m" },
        { name: "N", code: "KC_N", keys: "n" },
        { name: "O", code: "KC_O", keys: "o" },
        { name: "P", code: "KC_P", keys: "p" },
        { name: "Q", code: "KC_Q", keys: "q" },
        { name: "R", code: "KC_R", keys: "r" },
        { name: "S", code: "KC_S", keys: "s" },
        { name: "T", code: "KC_T", keys: "t" },
        { name: "U", code: "KC_U", keys: "u" },
        { name: "V", code: "KC_V", keys: "v" },
        { name: "W", code: "KC_W", keys: "w" },
        { name: "X", code: "KC_X", keys: "x" },
        { name: "Y", code: "KC_Y", keys: "y" },
        { name: "Z", code: "KC_Z", keys: "z" },
        { name: "!\n1", code: "KC_1", keys: "1" },
        { name: "@\n2", code: "KC_2", keys: "2" },
        { name: "#\n3", code: "KC_3", keys: "3" },
        { name: "$\n4", code: "KC_4", keys: "4" },
        { name: "%\n5", code: "KC_5", keys: "5" },
        { name: "^\n6", code: "KC_6", keys: "6" },
        { name: "&\n7", code: "KC_7", keys: "7" },
        { name: "*\n8", code: "KC_8", keys: "8" },
        { name: "(\n9", code: "KC_9", keys: "9" },
        { name: ")\n0", code: "KC_0", keys: "0" },
        { name: "_\n-", code: "KC_MINS", keys: "-" },
        { name: "+\n=", code: "KC_EQL", keys: "=" },
        { name: "~\n`", code: "KC_GRV", keys: "`" },
        { name: "{\n[", code: "KC_LBRC", keys: "[" },
        { name: "}\n]", code: "KC_RBRC", keys: "]" },
        { name: "|\n\\", code: "KC_BSLS", keys: "\\", width: 1500 },
        { name: ":\n;", code: "KC_SCLN", keys: ";" },
        { name: "\"\n'", code: "KC_QUOT", keys: "'" },
        { name: "<\n,", code: "KC_COMM", keys: "," },
        { name: ">\n.", code: "KC_DOT", keys: "." },
        { name: "?\n/", code: "KC_SLSH", keys: "/" },
        { name: "=", code: "KC_PEQL" },
        { name: ",", code: "KC_PCMM" },
        { name: "F1", code: "KC_F1" },
        { name: "F2", code: "KC_F2" },
        { name: "F3", code: "KC_F3" },
        { name: "F4", code: "KC_F4" },
        { name: "F5", code: "KC_F5" },
        { name: "F6", code: "KC_F6" },
        { name: "F7", code: "KC_F7" },
        { name: "F8", code: "KC_F8" },
        { name: "F9", code: "KC_F9" },
        { name: "F10", code: "KC_F10" },
        { name: "F11", code: "KC_F11" },
        { name: "F12", code: "KC_F12" },
        { name: "Print Screen", code: "KC_PSCR", shortName: "PrtSc" },
        { name: "Scroll Lock", code: "KC_SLCK", shortName: "Scroll" },
        { name: "Pause", code: "KC_PAUS" },
        { name: "Tab", code: "KC_TAB", keys: "tab", width: 1500 },
        {
          name: "Backspace",
          code: "KC_BSPC",
          keys: "backspace",
          width: 2000,
          shortName: "Bksp",
        },
        { name: "Insert", code: "KC_INS", keys: "insert", shortName: "Ins" },
        { name: "Del", code: "KC_DEL", keys: "delete" },
        { name: "Home", code: "KC_HOME", keys: "home" },
        { name: "End", code: "KC_END", keys: "end" },
        { name: "Page Up", code: "KC_PGUP", keys: "pageup", shortName: "PgUp" },
        {
          name: "Page Down",
          code: "KC_PGDN",
          keys: "pagedown",
          shortName: "PgDn",
        },
        { name: "Num\nLock", code: "KC_NLCK", keys: "num", shortName: "N.Lck" },
        { name: "Caps Lock", code: "KC_CAPS", keys: "caps_lock", width: 1750 },
        { name: "Enter", code: "KC_ENT", keys: "enter", width: 2250 },
        { name: "1", code: "KC_P1", keys: "num_1", title: "Numpad 1" },
        { name: "2", code: "KC_P2", keys: "num_2", title: "Numpad 2" },
        { name: "3", code: "KC_P3", keys: "num_3", title: "Numpad 3" },
        { name: "4", code: "KC_P4", keys: "num_4", title: "Numpad 4" },
        { name: "5", code: "KC_P5", keys: "num_5", title: "Numpad 5" },
        { name: "6", code: "KC_P6", keys: "num_6", title: "Numpad 6" },
        { name: "7", code: "KC_P7", keys: "num_7", title: "Numpad 7" },
        { name: "8", code: "KC_P8", keys: "num_8", title: "Numpad 8" },
        { name: "9", code: "KC_P9", keys: "num_9", title: "Numpad 9" },
        {
          name: "0",
          code: "KC_P0",
          width: 2000,
          keys: "num_0",
          title: "Numpad 0",
        },
        { name: "÷", code: "KC_PSLS", keys: "num_divide", title: "Numpad ÷" },
        { name: "×", code: "KC_PAST", keys: "num_multiply", title: "Numpad ×" },
        { name: "-", code: "KC_PMNS", keys: "num_subtract", title: "Numpad -" },
        { name: "+", code: "KC_PPLS", keys: "num_add", title: "Numpad +" },
        { name: ".", code: "KC_PDOT", keys: "num_decimal", title: "Numpad ." },
        {
          name: "Num\nEnter",
          code: "KC_PENT",
          shortName: "N.Ent",
          title: "Numpad Enter",
        },
        {
          name: "Left Shift",
          code: "KC_LSFT",
          keys: "shift",
          width: 2250,
          shortName: "LShft",
        },
        {
          name: "Right Shift",
          code: "KC_RSFT",
          width: 2750,
          shortName: "RShft",
        },
        { name: "Left Ctrl", code: "KC_LCTL", keys: "ctrl", width: 1250 },
        { name: "Right Ctrl", code: "KC_RCTL", width: 1250, shortName: "RCtl" },
        {
          name: "Left Win",
          code: "KC_LGUI",
          keys: "cmd",
          width: 1250,
          shortName: "LWin",
        },
        { name: "Right Win", code: "KC_RGUI", width: 1250, shortName: "RWin" },
        {
          name: "Left Alt",
          code: "KC_LALT",
          keys: "alt",
          width: 1250,
          shortName: "LAlt",
        },
        { name: "Right Alt", code: "KC_RALT", width: 1250, shortName: "RAlt" },
        { name: "Space", code: "KC_SPC", keys: "space", width: 6250 },
        { name: "Menu", code: "KC_APP", width: 1250, shortName: "RApp" },
        { name: "Left", code: "KC_LEFT", keys: "left", shortName: "←" },
        { name: "Down", code: "KC_DOWN", keys: "down", shortName: "↓" },
        { name: "Up", code: "KC_UP", keys: "up", shortName: "↑" },
        { name: "Right", code: "KC_RGHT", keys: "right", shortName: "→" },
      ],
    },
    {
      id: "wt_lighting",
      label: "Lighting",
      width: "label",
      keycodes: [
        {
          name: "Bright -",
          code: "BR_DEC",
          title: "Brightness -",
          shortName: "BR -",
        },
        {
          name: "Bright +",
          code: "BR_INC",
          title: "Brightness +",
          shortName: "BR +",
        },
        {
          name: "Effect -",
          code: "EF_DEC",
          title: "Effect -",
          shortName: "EF -",
        },
        {
          name: "Effect +",
          code: "EF_INC",
          title: "Effect +",
          shortName: "EF +",
        },
        {
          name: "Effect Speed -",
          code: "ES_DEC",
          title: "Effect Speed -",
          shortName: "ES -",
        },
        {
          name: "Effect Speed +",
          code: "ES_INC",
          title: "Effect Speed +",
          shortName: "ES +",
        },
        {
          name: "Color1 Hue -",
          code: "H1_DEC",
          title: "Color1 Hue -",
          shortName: "H1 -",
        },
        {
          name: "Color1 Hue +",
          code: "H1_INC",
          title: "Color1 Hue +",
          shortName: "H1 +",
        },
        {
          name: "Color2 Hue -",
          code: "H2_DEC",
          title: "Color2 Hue -",
          shortName: "H2 -",
        },
        {
          name: "Color2 Hue +",
          code: "H2_INC",
          title: "Color2 Hue +",
          shortName: "H2 +",
        },
        {
          name: "Color1 Sat -",
          code: "S1_DEC",
          title: "Color1 Sat -",
          shortName: "S1 -",
        },
        {
          name: "Color1 Sat +",
          code: "S1_INC",
          title: "Color1 Sat +",
          shortName: "S1 +",
        },
        {
          name: "Color2 Sat -",
          code: "S2_DEC",
          title: "Color2 Sat -",
          shortName: "S2 -",
        },
        {
          name: "Color2 Sat +",
          code: "S2_INC",
          title: "Color2 Sat +",
          shortName: "S2 +",
        },
      ],
    },
    {
      id: "media",
      label: "Media",
      width: "label",
      keycodes: [
        { name: "Vol -", code: "KC_VOLD", title: "Volume Down" },
        { name: "Vol +", code: "KC_VOLU", title: "Volume Up" },
        { name: "Mute", code: "KC_MUTE", title: "Mute Audio" },
        { name: "Play", code: "KC_MPLY", title: "Play/Pause" },
        { name: "Media Stop", code: "KC_MSTP", title: "Media Stop" },
        { name: "Previous", code: "KC_MPRV", title: "Media Previous" },
        { name: "Next", code: "KC_MNXT", title: "Media Next" },
        { name: "Rewind", code: "KC_MRWD", title: "Rewind" },
        { name: "Fast Forward", code: "KC_MFFD", title: "Fast Forward" },
        { name: "Select", code: "KC_MSEL", title: "Media Select" },
        { name: "Eject", code: "KC_EJCT", title: "Media Eject" },
      ],
    },
    {
      id: "macro",
      label: "Macro",
      width: "label",
      keycodes: generateMacros(numMacros),
    },
    buildLayerMenu(),
    {
      id: "special",
      label: "Special",
      width: "label",
      keycodes: [
        { name: "~", code: "S(KC_GRV)", keys: "`", title: "Shift + `" },
        { name: "!", code: "S(KC_1)", keys: "!", title: "Shift + 1" },
        { name: "@", code: "S(KC_2)", keys: "@", title: "Shift + 2" },
        { name: "#", code: "S(KC_3)", keys: "#", title: "Shift + 3" },
        { name: "$", code: "S(KC_4)", keys: "$", title: "Shift + 4" },
        { name: "%", code: "S(KC_5)", keys: "%", title: "Shift + 5" },
        { name: "^", code: "S(KC_6)", keys: "^", title: "Shift + 6" },
        { name: "&", code: "S(KC_7)", keys: "&", title: "Shift + 7" },
        { name: "*", code: "S(KC_8)", keys: "*", title: "Shift + 8" },
        { name: "(", code: "S(KC_9)", keys: "(", title: "Shift + 9" },
        { name: ")", code: "S(KC_0)", keys: ")", title: "Shift + 0" },
        { name: "_", code: "S(KC_MINS)", keys: "_", title: "Shift + -" },
        { name: "+", code: "S(KC_EQL)", keys: "+", title: "Shift + =" },
        { name: "{", code: "S(KC_LBRC)", keys: "{", title: "Shift + [" },
        { name: "}", code: "S(KC_RBRC)", keys: "}", title: "Shift + ]" },
        { name: "|", code: "S(KC_BSLS)", keys: "|", title: "Shift + \\" },
        { name: ":", code: "S(KC_SCLN)", keys: ":", title: "Shift + /" },
        { name: '"', code: "S(KC_QUOT)", keys: '"', title: "Shift + '" },
        { name: "<", code: "S(KC_COMM)", keys: "<", title: "Shift + ," },
        { name: ">", code: "S(KC_DOT)", keys: ">", title: "Shift + ." },
        { name: "?", code: "S(KC_SLSH)", keys: "?", title: "Shift + /" },
        { name: "NUHS", code: "KC_NUHS", title: "Non-US # and ~" },
        { name: "NUBS", code: "KC_NUBS", title: "Non-US \\ and |" },
        { name: "Ro", code: "KC_RO", title: "JIS \\ and |" },
        { name: "¥", code: "KC_JYEN", title: "JPN Yen" },
        { name: "無変換", code: "KC_MHEN", title: "JIS Muhenkan" },
        { name: "漢字", code: "KC_HANJ", title: "Hanja" },
        { name: "한영", code: "KC_HAEN", title: "HanYeong" },
        { name: "変換", code: "KC_HENK", title: "JIS Henkan" },
        { name: "かな", code: "KC_KANA", title: "JIS Katakana/Hiragana" },
        {
          name: "Esc `",
          code: "KC_GESC",
          title: "Esc normally, but ` when Shift or Win is pressed",
        },
        {
          name: "LS (",
          code: "KC_LSPO",
          title: "Left Shift when held, ( when tapped",
        },
        {
          name: "RS )",
          code: "KC_RSPC",
          title: "Right Shift when held, ) when tapped",
        },
        {
          name: "LC (",
          code: "KC_LCPO",
          title: "Left Control when held, ( when tapped",
        },
        {
          name: "RC )",
          code: "KC_RCPC",
          title: "Right Control when held, ) when tapped",
        },
        {
          name: "LA (",
          code: "KC_LAPO",
          title: "Left Alt when held, ( when tapped",
        },
        {
          name: "RA )",
          code: "KC_RAPC",
          title: "Right Alt when held, ) when tapped",
        },
        {
          name: "SftEnt",
          code: "KC_SFTENT",
          title: "Right Shift when held, Enter when tapped",
        },
        { name: "Reset", code: "RESET", title: "Reset the keyboard" },
        { name: "Debug", code: "DEBUG", title: "Toggle debug mode" },
        {
          name: "Toggle NKRO",
          code: "MAGIC_TOGGLE_NKRO",
          shortName: "NKRO",
          title: "Toggle NKRO",
        },
        // I don't even think the locking stuff is enabled...
        { name: "Locking Num Lock", code: "KC_LNUM" },
        { name: "Locking Caps Lock", code: "KC_LCAP" },
        { name: "Locking Scroll Lock", code: "KC_LSCR" },
        { name: "Power", code: "KC_PWR" },
        { name: "Power OSX", code: "KC_POWER" },
        { name: "Sleep", code: "KC_SLEP" },
        { name: "Wake", code: "KC_WAKE" },
        { name: "Calc", code: "KC_CALC" },
        { name: "Mail", code: "KC_MAIL" },
        { name: "Help", code: "KC_HELP" },
        { name: "Stop", code: "KC_STOP" },
        { name: "Alt Erase", code: "KC_ERAS" },
        { name: "Again", code: "KC_AGAIN" },
        { name: "Menu", code: "KC_MENU" },
        { name: "Undo", code: "KC_UNDO" },
        { name: "Select", code: "KC_SELECT" },
        { name: "Exec", code: "KC_EXECUTE" },
        { name: "Cut", code: "KC_CUT" },
        { name: "Copy", code: "KC_COPY" },
        { name: "Paste", code: "KC_PASTE" },
        { name: "Find", code: "KC_FIND" },
        { name: "My Comp", code: "KC_MYCM" },
        { name: "Home", code: "KC_WWW_HOME" },
        { name: "Back", code: "KC_WWW_BACK" },
        { name: "Forward", code: "KC_WWW_FORWARD" },
        { name: "Stop", code: "KC_WWW_STOP" },
        { name: "Refresh", code: "KC_WWW_REFRESH" },
        { name: "Favorites", code: "KC_WWW_FAVORITES" },
        { name: "Search", code: "KC_WWW_SEARCH" },
        {
          name: "Screen +",
          code: "KC_BRIU",
          shortName: "Scr +",
          title: "Screen Brightness Up",
        },
        {
          name: "Screen -",
          code: "KC_BRID",
          shortName: "Scr -",
          title: "Screen Brightness Down",
        },
        { name: "F13", code: "KC_F13" },
        { name: "F14", code: "KC_F14" },
        { name: "F15", code: "KC_F15" },
        { name: "F16", code: "KC_F16" },
        { name: "F17", code: "KC_F17" },
        { name: "F18", code: "KC_F18" },
        { name: "F19", code: "KC_F19" },
        { name: "F20", code: "KC_F20" },
        { name: "F21", code: "KC_F21" },
        { name: "F22", code: "KC_F22" },
        { name: "F23", code: "KC_F23" },
        { name: "F24", code: "KC_F24" },

        // TODO: move these to a new group
        { name: "Mouse ↑", code: "KC_MS_UP" },
        { name: "Mouse ↓", code: "KC_MS_DOWN" },
        { name: "Mouse ←", code: "KC_MS_LEFT" },
        { name: "Mouse →", code: "KC_MS_RIGHT" },
        { name: "Mouse Btn1", code: "KC_MS_BTN1" },
        { name: "Mouse Btn2", code: "KC_MS_BTN2" },
        { name: "Mouse Btn3", code: "KC_MS_BTN3" },
        { name: "Mouse Btn4", code: "KC_MS_BTN4" },
        { name: "Mouse Btn5", code: "KC_MS_BTN5" },
        { name: "Mouse Btn6", code: "KC_MS_BTN6" },
        { name: "Mouse Btn7", code: "KC_MS_BTN7" },
        { name: "Mouse Btn8", code: "KC_MS_BTN8" },
        { name: "Mouse Wh ↑", code: "KC_MS_WH_UP" },
        { name: "Mouse Wh ↓", code: "KC_MS_WH_DOWN" },
        { name: "Mouse Wh ←", code: "KC_MS_WH_LEFT" },
        { name: "Mouse Wh →", code: "KC_MS_WH_RIGHT" },
        { name: "Mouse Acc0", code: "KC_MS_ACCEL0" },
        { name: "Mouse Acc1", code: "KC_MS_ACCEL1" },
        { name: "Mouse Acc2", code: "KC_MS_ACCEL2" },

        // TODO: move these to a new group
        { name: "Audio On", code: "AU_ON" },
        { name: "Audio Off", code: "AU_OFF" },
        { name: "Audio Toggle", code: "AU_TOG" },
        { name: "Clicky Toggle", code: "CLICKY_TOGGLE" },
        { name: "Clicky Enable", code: "CLICKY_ENABLE" },
        { name: "Clicky Disable", code: "CLICKY_DISABLE" },
        { name: "Clicky Up", code: "CLICKY_UP" },
        { name: "Clicky Down", code: "CLICKY_DOWN" },
        { name: "Clicky Reset", code: "CLICKY_RESET" },
        { name: "Music On", code: "MU_ON" },
        { name: "Music Off", code: "MU_OFF" },
        { name: "Music Toggle", code: "MU_TOG" },
        { name: "Music Mode", code: "MU_MOD" },
      ],
    },
    /* These are for controlling the original backlighting and bottom RGB. */
    {
      id: "qmk_lighting",
      label: "Lighting",
      width: "label",
      keycodes: [
        { name: "BL Toggle", code: "BL_TOGG" },
        { name: "BL On", code: "BL_ON" },
        { name: "BL Off", code: "BL_OFF", shortName: "BL Off" },
        { name: "BL -", code: "BL_DEC" },
        { name: "BL +", code: "BL_INC" },
        { name: "BL Cycle", code: "BL_STEP" },
        { name: "BR Toggle", code: "BL_BRTG" },
        { name: "RGB Toggle", code: "RGB_TOG" },
        { name: "RGB Mode -", code: "RGB_RMOD" },
        { name: "RGB Mode +", code: "RGB_MOD" },
        { name: "Hue -", code: "RGB_HUD" },
        { name: "Hue +", code: "RGB_HUI" },
        { name: "Sat -", code: "RGB_SAD" },
        { name: "Sat +", code: "RGB_SAI" },
        { name: "Bright -", code: "RGB_VAD" },
        { name: "Bright +", code: "RGB_VAI" },
        { name: "Effect Speed-", code: "RGB_SPD" },
        { name: "Effect Speed+", code: "RGB_SPI" },
        { name: "RGB Mode P", code: "RGB_M_P", title: "Plain" },
        { name: "RGB Mode B", code: "RGB_M_B", title: "Breathe" },
        { name: "RGB Mode R", code: "RGB_M_R", title: "Rainbow" },
        { name: "RGB Mode SW", code: "RGB_M_SW", title: "Swirl" },
        { name: "RGB Mode SN", code: "RGB_M_SN", title: "Snake" },
        { name: "RGB Mode K", code: "RGB_M_K", title: "Knight" },
        { name: "RGB Mode X", code: "RGB_M_X", title: "Xmas" },
        { name: "RGB Mode G", code: "RGB_M_G", title: "Gradient" },
      ],
    },
    /*
     These custom keycodes always exist and should be filtered out if necessary
     Name and Title should be replaced with the correct ones from the keyboard json
    */
    {
      id: "custom",
      label: "Custom",
      width: "label",
      keycodes: [
        { name: "CUSTOM(0)", code: "CUSTOM(0)", title: "Custom Keycode 0" },
        { name: "CUSTOM(1)", code: "CUSTOM(1)", title: "Custom Keycode 1" },
        { name: "CUSTOM(2)", code: "CUSTOM(2)", title: "Custom Keycode 2" },
        { name: "CUSTOM(3)", code: "CUSTOM(3)", title: "Custom Keycode 3" },
        { name: "CUSTOM(4)", code: "CUSTOM(4)", title: "Custom Keycode 4" },
        { name: "CUSTOM(5)", code: "CUSTOM(5)", title: "Custom Keycode 5" },
        { name: "CUSTOM(6)", code: "CUSTOM(6)", title: "Custom Keycode 6" },
        { name: "CUSTOM(7)", code: "CUSTOM(7)", title: "Custom Keycode 7" },
        { name: "CUSTOM(8)", code: "CUSTOM(8)", title: "Custom Keycode 8" },
        { name: "CUSTOM(9)", code: "CUSTOM(9)", title: "Custom Keycode 9" },
        { name: "CUSTOM(10)", code: "CUSTOM(10)", title: "Custom Keycode 10" },
        { name: "CUSTOM(11)", code: "CUSTOM(11)", title: "Custom Keycode 11" },
        { name: "CUSTOM(12)", code: "CUSTOM(12)", title: "Custom Keycode 12" },
        { name: "CUSTOM(13)", code: "CUSTOM(13)", title: "Custom Keycode 13" },
        { name: "CUSTOM(14)", code: "CUSTOM(14)", title: "Custom Keycode 14" },
        { name: "CUSTOM(15)", code: "CUSTOM(15)", title: "Custom Keycode 15" },
      ],
    },
  ];
}

function generateMacros(numMacros: number = 16): IKeycode[] {
  let res: IKeycode[] = [];
  for (let idx = 0; idx < numMacros; idx++) {
    const newName = `M${idx}`;
    const newCode = `MACRO(${idx})`;
    const newTitle = `Macro ${idx}`;
    res = [...res, { name: newName, title: newTitle, code: newCode }];
  }
  return res;
}

function buildLayerMenu(): IKeycodeMenu {
  const hardCodedKeycodes: IKeycode[] = [
    {
      name: "Fn1\n(Fn3)",
      code: "FN_MO13",
      title: "Hold = Layer 1, Hold with Fn2 = Layer 3",
      shortName: "Fn1(3)",
    },
    {
      name: "Fn2\n(Fn3)",
      code: "FN_MO23",
      title: "Hold = Layer 2, Hold with Fn1 = Layer 3",
      shortName: "Fn2(3)",
    },
    {
      name: "Space Fn1",
      code: "LT(1,KC_SPC)",
      title: "Hold = Layer 1, Tap = Space",
      shortName: "Spc Fn1",
    },
    {
      name: "Space Fn2",
      code: "LT(2,KC_SPC)",
      title: "Hold = Layer 2, Tap = Space",
      shortName: "Spc Fn2",
    },
    {
      name: "Space Fn3",
      code: "LT(3,KC_SPC)",
      title: "Hold = Layer 3, Tap = Space",
      shortName: "Spc Fn3",
    },
  ];

  const menu: IKeycodeMenu = {
    id: "layers",
    label: "Layers",
    width: "label",
    keycodes: [
      {
        name: "MO",
        code: "MO(layer)",
        type: "layer",
        layer: 0,
        title: "Momentary turn layer on",
      },
      {
        name: "TG",
        code: "TG(layer)",
        type: "layer",
        layer: 0,
        title: "Toggle layer on/off",
      },
      {
        name: "TT",
        code: "TT(layer)",
        type: "layer",
        layer: 0,
        title:
          "Normally acts like MO unless it's tapped multple times which toggles layer on",
      },
      {
        name: "OSL",
        code: "OSL(layer)",
        type: "layer",
        layer: 0,
        title: "Switch to layer for one keypress",
      },
      {
        name: "TO",
        code: "TO(layer)",
        type: "layer",
        layer: 0,
        title: "Turn on layer when pressed",
      },
      {
        name: "DF",
        code: "DF(layer)",
        type: "layer",
        layer: 0,
        title: "Sets the default layer",
      },
    ],
  };

  // Statically generate layer codes from 0-9 instead of making it an input
  return {
    ...menu,
    keycodes: [
      ...hardCodedKeycodes,
      ...menu.keycodes.flatMap((keycode) => {
        let res: IKeycode[] = [];
        for (let idx = 0; idx < 10; idx++) {
          const newTitle = (keycode.title || "").replace(
            "layer",
            `layer ${idx}`
          );
          const newCode = keycode.code.replace("layer", `${idx}`);
          const newName = keycode.name + `(${idx})`;
          res = [
            ...res,
            { ...keycode, name: newName, title: newTitle, code: newCode },
          ];
        }
        return res;
      }),
    ],
  };
}
