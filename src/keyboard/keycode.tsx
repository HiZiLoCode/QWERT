import _ from "lodash";
import { KeyboardAPI } from "./api";
import { KeyCode } from "../types/types";
// 临时定义 MatrixInfo 类型
type MatrixInfo = {
  rows: number;
  cols: number;
} | null;
import {
  getByteToKey,
  getCodeForByte,
  getKeyCodeDict,
  getLabelForByte,
} from "./key-code/key2code";
import { KeyboardKey } from "../types/types_v1";

// 德语键名称映射
const germanKeyNames: Record<number, string> = {
  41: "Esc",
  28: "Z",
  29: "Y",
  58: "F1", 59: "F2", 60: "F3", 61: "F4", 62: "F5", 63: "F6",
  64: "F7", 65: "F8", 66: "F9", 67: "F10", 68: "F11", 69: "F12",
  70: "Druck", // PrtSc
  71: "Rollen", // Scroll Lock
  72: "Pause",
  73: "Einfg", // Insert
  74: "Pos1", // Home
  75: "Bild↑", // Page Up
  76: "Entf", // Delete
  77: "Ende", // End
  78: "Bild↓", // Page Down
  79: "→", // Right Arrow
  80: "←", // Left Arrow
  81: "↓", // Down Arrow
  82: "↑", // Up Arrow
  83: "Num", // Num Lock
  84: "Num /",
  85: "Num *",
  86: "Num -",
  87: "Num +",
  88: "Num Eingabe", // Num Enter
  89: "Num 1",
  90: "Num 2", 91: "Num 3", 92: "Num 4", 93: "Num 5",
  94: "Num 6", 95: "Num 7", 96: "Num 8", 97: "Num 9",
  98: "Num 0", 99: "Num ,",
  42: "Rück", // Backspace
  43: "Tab",
  44: "Leer", // Space
  45: "ß?", // Minus
  46: "´`", // Equal
  47: "Ü", // Left Bracket
  48: "+*", // Right Bracket
  49: "#'", // Backslash
  51: "Ö", // Semicolon
  52: "Ä", // Quote
  53: "^°", // Grave
  54: ",;", // Comma
  55: ".:", // Period
  56: "-_", // Slash
  57: "Festst", // Caps Lock
  40: "Eingabe", // Enter
  100: "<>|", // Non-US Backslash
  101: "Menü", // Menu
  135: "#'", // Non-US Hash
};

// 德语修饰键名称映射
const germanModifierNames = {
  ALT: "Alt",
  Shift: "Umsch",
  CTRL: "Strg",
  WIN: "Win"
};

// 获取当前语言（简单的检测函数）
const getCurrentLanguage = (): string => {
  // 尝试从多个地方获取语言设置
  const lang = (typeof window !== 'undefined' && window.navigator?.language) || 'en';
  return lang.toLowerCase();
};

// 获取本地化的键名称
const getLocalizedKeyName = (code: number): string => {
  const lang = getCurrentLanguage();

  if (lang.startsWith('de')) {
    console.log(germanKeyNames[code]);
    if (germanKeyNames[code]) {
      return germanKeyNames[code];
    } else {
      const kbKey = keyCodes.find((keycode) => keycode.code === code);
      return kbKey?.key || '';
    }
  }
  const kbKey = keyCodes.find((keycode) => keycode.code === code);
  return kbKey?.key || '';
};

// 获取本地化的修饰键名称
const getLocalizedModifierName = (modifier: string): string => {
  const lang = getCurrentLanguage();

  if (lang.startsWith('de')) {
    return germanModifierNames[modifier] || modifier;
  }

  return modifier;
};

const getLocalizedSideModifierName = (modifier: "Ctrl" | "Shift" | "Alt" | "Win", side: "L" | "R"): string => {
  return `${side}${getLocalizedModifierName(modifier)}`;
};

const getSideModifierNames = (mask: number): string[] => {
  const sideModifiers: Array<{ bit: number; modifier: "Ctrl" | "Shift" | "Alt" | "Win"; side: "L" | "R" }> = [
    { bit: 0, modifier: "Ctrl", side: "L" },
    { bit: 1, modifier: "Shift", side: "L" },
    { bit: 2, modifier: "Alt", side: "L" },
    { bit: 3, modifier: "Win", side: "L" },
    { bit: 4, modifier: "Ctrl", side: "R" },
    { bit: 5, modifier: "Shift", side: "R" },
    { bit: 6, modifier: "Alt", side: "R" },
    { bit: 7, modifier: "Win", side: "R" },
  ];

  return sideModifiers
    .filter(({ bit }) => ((mask >> bit) & 0x1) === 1)
    .map(({ modifier, side }) => getLocalizedSideModifierName(modifier, side));
};

export const basicKeyToByte = {
  _QK_MODS: 0x0100,
  _QK_MODS_MAX: 0x1fff,
  _QK_MOD_TAP: 0x6000,
  _QK_MOD_TAP_MAX: 0x7fff,
  _QK_LAYER_TAP: 0x4000,
  _QK_LAYER_TAP_MAX: 0x4fff,
  _QK_LAYER_MOD: 0x5900,
  _QK_LAYER_MOD_MAX: 0x59ff,
  _QK_TO: 0x5010,
  _QK_TO_MAX: 0x501f,
  _QK_MOMENTARY: 0x5100,
  _QK_MOMENTARY_MAX: 0x511f,
  _QK_DEF_LAYER: 0x5200,
  _QK_DEF_LAYER_MAX: 0x521f,
  _QK_TOGGLE_LAYER: 0x5300,
  _QK_TOGGLE_LAYER_MAX: 0x531f,
  _QK_ONE_SHOT_LAYER: 0x5400,
  _QK_ONE_SHOT_LAYER_MAX: 0x541f,
  _QK_ONE_SHOT_MOD: 0x5500,
  _QK_ONE_SHOT_MOD_MAX: 0x55ff,
  _QK_LAYER_TAP_TOGGLE: 0x5800,
  _QK_LAYER_TAP_TOGGLE_MAX: 0x581f,
  _QK_LAYER_MOD_MASK: 0x0f,
  _QK_MACRO: 0x7702,
  _QK_MACRO1: 0x7703,
  _QK_MACRO2: 0x7704,
  _QK_MACRO3: 0x7705,
  _QK_MACRO4: 0x7706,
  _QK_MACRO5: 0x7707,
  _QK_MACRO6: 0x7708,
  _QK_MACRO7: 0x7709,
  _QK_MACRO8: 0x7710,
  _QK_MACRO9: 0x771a,
  _QK_MACRO10: 0x771b,
  _QK_MACRO11: 0x771c,
  _QK_MACRO12: 0x771d,
  _QK_MACRO13: 0x771e,
  _QK_MACRO14: 0x771f,
  _QK_MACRO15: 0x7720,
  _QK_MACRO_MAX: 0x777f,
  _QK_KB: 0x5f80,
  _QK_KB_MAX: 0x5f8f,
  KC_NO: 0x0000,
  KC_TRNS: 0x0001,
  KC_A: 0x0004,
  KC_B: 0x0005,
  KC_C: 0x0006,
  KC_D: 0x0007,
  KC_E: 0x0008,
  KC_F: 0x0009,
  KC_G: 0x000a,
  KC_H: 0x000b,
  KC_I: 0x000c,
  KC_J: 0x000d,
  KC_K: 0x000e,
  KC_L: 0x000f,
  KC_M: 0x0010,
  KC_N: 0x0011,
  KC_O: 0x0012,
  KC_P: 0x0013,
  KC_Q: 0x0014,
  KC_R: 0x0015,
  KC_S: 0x0016,
  KC_T: 0x0017,
  KC_U: 0x0018,
  KC_V: 0x0019,
  KC_W: 0x001a,
  KC_X: 0x001b,
  KC_Y: 0x001c,
  KC_Z: 0x001d,
  KC_1: 0x001e,
  KC_2: 0x001f,
  KC_3: 0x0020,
  KC_4: 0x0021,
  KC_5: 0x0022,
  KC_6: 0x0023,
  KC_7: 0x0024,
  KC_8: 0x0025,
  KC_9: 0x0026,
  KC_0: 0x0027,
  KC_ENT: 0x0028,
  KC_ESC: 0x0029,
  KC_BSPC: 0x002a,
  KC_TAB: 0x002b,
  KC_SPC: 0x002c,
  KC_MINS: 0x002d,
  KC_EQL: 0x002e,
  KC_LBRC: 0x002f,
  KC_RBRC: 0x0030,
  KC_BSLS: 0x0031,
  KC_NUHS: 0x0032,
  KC_SCLN: 0x0033,
  KC_QUOT: 0x0034,
  KC_GRV: 0x0035,
  KC_COMM: 0x0036,
  KC_DOT: 0x0037,
  KC_SLSH: 0x0038,
  KC_CAPS: 0x0039,
  KC_F1: 0x003a,
  KC_F2: 0x003b,
  KC_F3: 0x003c,
  KC_F4: 0x003d,
  KC_F5: 0x003e,
  KC_F6: 0x003f,
  KC_F7: 0x0040,
  KC_F8: 0x0041,
  KC_F9: 0x0042,
  KC_F10: 0x0043,
  KC_F11: 0x0044,
  KC_F12: 0x0045,
  KC_PSCR: 0x0046,
  KC_SLCK: 0x0047,
  KC_PAUS: 0x0048,
  KC_INS: 0x0049,
  KC_HOME: 0x004a,
  KC_PGUP: 0x004b,
  KC_DEL: 0x004c,
  KC_END: 0x004d,
  KC_PGDN: 0x004e,
  KC_RGHT: 0x004f,
  KC_LEFT: 0x0050,
  KC_DOWN: 0x0051,
  KC_UP: 0x0052,
  KC_NLCK: 0x0053,
  KC_PSLS: 0x0054,
  KC_PAST: 0x0055,
  KC_PMNS: 0x0056,
  KC_PPLS: 0x0057,
  KC_PENT: 0x0058,
  KC_P1: 0x0059,
  KC_P2: 0x005a,
  KC_P3: 0x005b,
  KC_P4: 0x005c,
  KC_P5: 0x005d,
  KC_P6: 0x005e,
  KC_P7: 0x005f,
  KC_P8: 0x0060,
  KC_P9: 0x0061,
  KC_P0: 0x0062,
  KC_PDOT: 0x0063,
  KC_NUBS: 0x0064,
  KC_APP: 0x0065,
  KC_POWER: 0x0066,
  KC_PEQL: 0x0067,
  KC_F13: 0x0068,
  KC_F14: 0x0069,
  KC_F15: 0x006a,
  KC_F16: 0x006b,
  KC_F17: 0x006c,
  KC_F18: 0x006d,
  KC_F19: 0x006e,
  KC_F20: 0x006f,
  KC_F21: 0x0070,
  KC_F22: 0x0071,
  KC_F23: 0x0072,
  KC_F24: 0x0073,
  KC_EXECUTE: 0x0074,
  KC_HELP: 0x0075,
  KC_MENU: 0x0076,
  KC_SELECT: 0x0077,
  KC_STOP: 0x0078,
  KC_AGAIN: 0x0079,
  KC_UNDO: 0x007a,
  KC_CUT: 0x007b,
  KC_COPY: 0x007c,
  KC_PASTE: 0x007d,
  KC_FIND: 0x007e,
  KC_LCAP: 0x0082,
  KC_LNUM: 0x0083,
  KC_LSCR: 0x0084,
  KC_PCMM: 0x0085,
  KC_KP_EQUAL_AS400: 0x0086,
  KC_RO: 0x0087,
  KC_KANA: 0x0088,
  KC_JYEN: 0x0089,
  KC_HENK: 0x008a,
  KC_MHEN: 0x008b,
  KC_INT6: 0x008c,
  KC_INT7: 0x008d,
  KC_INT8: 0x008e,
  KC_INT9: 0x008f,
  KC_HAEN: 0x0090,
  KC_HANJ: 0x0091,
  KC_LANG3: 0x0092,
  KC_LANG4: 0x0093,
  KC_LANG5: 0x0094,
  KC_LANG6: 0x0095,
  KC_LANG7: 0x0096,
  KC_LANG8: 0x0097,
  KC_LANG9: 0x0098,
  KC_ERAS: 0x0099,
  KC_SYSREQ: 0x009a,
  KC_CANCEL: 0x009b,
  KC_CLR: 0x009c,
  KC_CLEAR: 0x009c,
  KC_PRIOR: 0x009d,
  KC_OUT: 0x00a0,
  KC_OPER: 0x00a1,
  KC_CLEAR_AGAIN: 0x00a2,
  KC_CRSEL: 0x00a3,
  KC_EXSEL: 0x00a4,
  KC_PWR: 0x00a5,
  KC_SLEP: 0x00a6,
  KC_WAKE: 0x00a7,
  KC_MUTE: 0x10e2,
  KC_VOLU: 0x10e9,
  KC_VOLD: 0x10ea,
  KC_MNXT: 0x10b5,
  KC_MPRV: 0x10b6,
  KC_MSTP: 0x10b7,
  KC_MPLY: 0x10cd,
  KC_MPLYER: 0x1183,
  KC_MSEL: 0x00af,
  KC_EJCT: 0x00b0,
  KC_MAIL: 0x118a,
  KC_CALC: 0x1192,
  KC_MYCM: 0x1194,
  KC_WWW_SEARCH: 0x1221,
  KC_WWW_HOME: 0x1223,
  KC_WWW_BACK: 0x00b6,
  KC_WWW_FORWARD: 0x00b7,
  KC_WWW_STOP: 0x00b8,
  KC_WWW_REFRESH: 0x00b9,
  KC_WWW_FAVORITES: 0x00ba,
  KC_MFFD: 0x00bb,
  KC_MRWD: 0x00bc,
  KC_BRIU: 0x00bd,
  KC_BRID: 0x00be,
  KC_LCTL: 0x00e0,
  KC_LSFT: 0x00e1,
  KC_LALT: 0x00e2,
  KC_LGUI: 0x00e3,
  KC_RCTL: 0x00e4,
  KC_RSFT: 0x00e5,
  KC_RALT: 0x00e6,
  KC_RGUI: 0x00e7,
  KC_MS_UP: 0x00f0,
  KC_MS_DOWN: 0x00f1,
  KC_MS_LEFT: 0x00f2,
  KC_MS_RIGHT: 0x00f3,
  KC_MS_BTN1: 0x00f4,
  KC_MS_BTN2: 0x00f5,
  KC_MS_BTN3: 0x00f6,
  KC_MS_BTN4: 0x00f7,
  KC_MS_BTN5: 0x00f8,
  KC_MS_WH_UP: 0x00f9,
  KC_MS_WH_DOWN: 0x00fa,
  KC_MS_WH_LEFT: 0x00fb,
  KC_MS_WH_RIGHT: 0x00fc,
  KC_MS_ACCEL0: 0x00fd,
  KC_MS_ACCEL1: 0x00fe,
  KC_MS_ACCEL2: 0x00ff,
  RESET: 0x5c00,
  DEBUG: 0x5c01,
  MAGIC_TOGGLE_NKRO: 0x5c14,
  KC_GESC: 0x5c16,
  AU_ON: 0x5c1d,
  AU_OFF: 0x5c1e,
  AU_TOG: 0x5c1f,
  CLICKY_TOGGLE: 0x5c20,
  CLICKY_ENABLE: 0x5c21,
  CLICKY_DISABLE: 0x5c22,
  CLICKY_UP: 0x5c23,
  CLICKY_DOWN: 0x5c24,
  CLICKY_RESET: 0x5c25,
  MU_ON: 0x5c26,
  MU_OFF: 0x5c27,
  MU_TOG: 0x5c28,
  MU_MOD: 0x5c29,
  BL_ON: 0x5cbb,
  BL_OFF: 0x5cbc,
  BL_DEC: 0x5cbd,
  BL_INC: 0x5cbe,
  BL_TOGG: 0x5cbf,
  BL_STEP: 0x5cc0,
  BL_BRTG: 0x5cc1,
  RGB_TOG: 0x5cc2,
  RGB_MOD: 0x5cc3,
  RGB_RMOD: 0x5cc4,
  RGB_HUI: 0x5cc5,
  RGB_HUD: 0x5cc6,
  RGB_SAI: 0x5cc7,
  RGB_SAD: 0x5cc8,
  RGB_VAI: 0x5cc9,
  RGB_VAD: 0x5cca,
  RGB_SPI: 0x5ccb,
  RGB_SPD: 0x5ccc,
  RGB_M_P: 0x5ccd,
  RGB_M_B: 0x5cce,
  RGB_M_R: 0x5ccf,
  RGB_M_SW: 0x5cd0,
  RGB_M_SN: 0x5cd1,
  RGB_M_K: 0x5cd2,
  RGB_M_X: 0x5cd3,
  RGB_M_G: 0x5cd4,
  KC_LSPO: 0x5cd7,
  KC_RSPC: 0x5cd8,
  KC_SFTENT: 0x5cd9,
  KC_LCPO: 0x5cf3,
  KC_RCPC: 0x5cf4,
  KC_LAPO: 0x5cf5,
  KC_RAPC: 0x5cf6,
  BR_INC: 0x5f00,
  BR_DEC: 0x5f01,
  EF_INC: 0x5f02,
  EF_DEC: 0x5f03,
  ES_INC: 0x5f04,
  ES_DEC: 0x5f05,
  H1_INC: 0x5f06,
  H1_DEC: 0x5f07,
  S1_INC: 0x5f08,
  S1_DEC: 0x5f09,
  H2_INC: 0x5f0a,
  H2_DEC: 0x5f0b,
  S2_INC: 0x5f0c,
  S2_DEC: 0x5f0d,
  FN_MO13: 0x5f10,
  FN_MO23: 0x5f11,
};

export const keyCode = [
  { code: 0x0004, key: "A" },
  { code: 0x0005, key: "B" },
  { code: 0x0006, key: "C" },
  { code: 0x0007, key: "D" },
  { code: 0x0008, key: "E" },
  { code: 0x0009, key: "F" },
  { code: 0x000a, key: "G" },
  { code: 0x000b, key: "H" },
  { code: 0x000c, key: "I" },
  { code: 0x000d, key: "J" },
  { code: 0x000e, key: "K" },
  { code: 0x000f, key: "L" },
  { code: 0x0010, key: "M" },
  { code: 0x0011, key: "N" },
  { code: 0x0012, key: "O" },
  { code: 0x0013, key: "P" },
  { code: 0x0014, key: "Q" },
  { code: 0x0015, key: "R" },
  { code: 0x0016, key: "S" },
  { code: 0x0017, key: "T" },
  { code: 0x0018, key: "U" },
  { code: 0x0019, key: "V" },
  { code: 0x001a, key: "W" },
  { code: 0x001b, key: "X" },
  { code: 0x001c, key: "Y" },
  { code: 0x001d, key: "Z" },
  { code: 0x001e, key: "1" },
  { code: 0x001f, key: "2" },
  { code: 0x0020, key: "3" },
  { code: 0x0021, key: "4" },
  { code: 0x0022, key: "5" },
  { code: 0x0023, key: "6" },
  { code: 0x0024, key: "7" },
  { code: 0x0025, key: "8" },
  { code: 0x0026, key: "9" },
  { code: 0x0027, key: "0" },
];

export const matrixKeycodes = [
  // Row 0
  basicKeyToByte.KC_ESC,
  basicKeyToByte.KC_F1,
  basicKeyToByte.KC_F2,
  basicKeyToByte.KC_F3,
  basicKeyToByte.KC_F4,
  basicKeyToByte.KC_F5,
  basicKeyToByte.KC_F6,
  basicKeyToByte.KC_F7,
  basicKeyToByte.KC_F8,
  basicKeyToByte.KC_F9,
  basicKeyToByte.KC_F10,
  basicKeyToByte.KC_F11,
  basicKeyToByte.KC_F12,
  basicKeyToByte.KC_PSCR,
  basicKeyToByte.KC_SLCK,
  basicKeyToByte.KC_PAUS,
  basicKeyToByte.KC_SLEP,
  basicKeyToByte.KC_MUTE,
  basicKeyToByte.KC_VOLD,
  basicKeyToByte.KC_VOLU,
  // Row 1
  basicKeyToByte.KC_GRV,
  basicKeyToByte.KC_1,
  basicKeyToByte.KC_2,
  basicKeyToByte.KC_3,
  basicKeyToByte.KC_4,
  basicKeyToByte.KC_5,
  basicKeyToByte.KC_6,
  basicKeyToByte.KC_7,
  basicKeyToByte.KC_8,
  basicKeyToByte.KC_9,
  basicKeyToByte.KC_0,
  basicKeyToByte.KC_MINS,
  basicKeyToByte.KC_EQL,
  basicKeyToByte.KC_BSPC,
  basicKeyToByte.KC_INS,
  basicKeyToByte.KC_HOME,
  basicKeyToByte.KC_PGUP,
  basicKeyToByte.KC_NLCK,
  basicKeyToByte.KC_PSLS,
  basicKeyToByte.KC_PAST,
  basicKeyToByte.KC_PMNS,
  // Row 2
  basicKeyToByte.KC_TAB,
  basicKeyToByte.KC_Q,
  basicKeyToByte.KC_W,
  basicKeyToByte.KC_E,
  basicKeyToByte.KC_R,
  basicKeyToByte.KC_T,
  basicKeyToByte.KC_Y,
  basicKeyToByte.KC_U,
  basicKeyToByte.KC_I,
  basicKeyToByte.KC_O,
  basicKeyToByte.KC_P,
  basicKeyToByte.KC_LBRC,
  basicKeyToByte.KC_RBRC,
  basicKeyToByte.KC_BSLS,
  basicKeyToByte.KC_DEL,
  basicKeyToByte.KC_END,
  basicKeyToByte.KC_PGDN,
  basicKeyToByte.KC_P7,
  basicKeyToByte.KC_P8,
  basicKeyToByte.KC_P9,
  basicKeyToByte.KC_PPLS,
  // Row 3
  basicKeyToByte.KC_CAPS,
  basicKeyToByte.KC_A,
  basicKeyToByte.KC_S,
  basicKeyToByte.KC_D,
  basicKeyToByte.KC_F,
  basicKeyToByte.KC_G,
  basicKeyToByte.KC_H,
  basicKeyToByte.KC_J,
  basicKeyToByte.KC_K,
  basicKeyToByte.KC_L,
  basicKeyToByte.KC_SCLN,
  basicKeyToByte.KC_QUOT,
  basicKeyToByte.KC_ENT,
  basicKeyToByte.KC_P4,
  basicKeyToByte.KC_P5,
  basicKeyToByte.KC_P6,
  // Row 4
  basicKeyToByte.KC_LSFT,
  basicKeyToByte.KC_Z,
  basicKeyToByte.KC_X,
  basicKeyToByte.KC_C,
  basicKeyToByte.KC_V,
  basicKeyToByte.KC_B,
  basicKeyToByte.KC_N,
  basicKeyToByte.KC_M,
  basicKeyToByte.KC_COMM,
  basicKeyToByte.KC_DOT,
  basicKeyToByte.KC_SLSH,
  basicKeyToByte.KC_RSFT,
  basicKeyToByte.KC_UP,
  basicKeyToByte.KC_P1,
  basicKeyToByte.KC_P2,
  basicKeyToByte.KC_P3,
  basicKeyToByte.KC_PENT,
  // Row 5
  basicKeyToByte.KC_LCTL,
  basicKeyToByte.KC_LGUI,
  basicKeyToByte.KC_LALT,
  basicKeyToByte.KC_SPC,
  basicKeyToByte.KC_RALT,
  basicKeyToByte.KC_RGUI,
  basicKeyToByte.KC_MENU,
  basicKeyToByte.KC_RCTL,
  basicKeyToByte.KC_LEFT,
  basicKeyToByte.KC_DOWN,
  basicKeyToByte.KC_RGHT,
  basicKeyToByte.KC_P0,
  basicKeyToByte.KC_PDOT,
];

export const basicKey = [
  { code: "KC_ESC", name: "Esc" },
  { code: "KC_F1", name: "F1" },
  { code: "KC_F2", name: "F2" },
  { code: "KC_F3", name: "F3" },
  { code: "KC_F4", name: "F4" },
  { code: "KC_F5", name: "F5" },
  { code: "KC_F6", name: "F5" },
  { code: "KC_F7", name: "F7" },
  { code: "KC_F8", name: "F8" },
  { code: "KC_F9", name: "F9" },
  { code: "KC_F10", name: "F10" },
  { code: "KC_F11", name: "F11" },
  { code: "KC_F12", name: "F12" },
  { code: "KC_PSCR", name: "PrtSc" },
  { code: "KC_SLCK", name: "Scroll" },
  { code: "KC_PAUS", name: "Pause" },
  { code: "KC_SLEP", name: "Sleep" },
  { code: "KC_MUTE", name: "Mute" },
  { code: "KC_VOLD", name: "Vol-" },
  { code: "KC_VOLU", name: "Vol+" },
  // Row 1
  { code: "KC_GRV", name: "`" },
  { code: "KC_1", name: "!\n1" },
  { code: "KC_2", name: "@\n2" },
  { code: "KC_3", name: "#\n3" },
  { code: "KC_4", name: "$\n4" },
  { code: "KC_5", name: "%\n5" },
  { code: "KC_6", name: "^\n6" },
  { code: "KC_7", name: "&\n7" },
  { code: "KC_8", name: "*\n8" },
  { code: "KC_9", name: "(\n9" },
  { code: "KC_0", name: ")\n0" },
  { code: "KC_MINS", name: "_\n-" },
  { code: "KC_EQL", name: "+\n=" },
  { code: "KC_BSPC", name: "Backspace" },
  { code: "KC_INS", name: "Ins" },
  { code: "KC_HOME", name: "Home" },
  { code: "KC_PGUP", name: "PgUp" },
  { code: "KC_NLCK", name: "N.Lck" },
  { code: "KC_PSLS", name: "÷" },
  { code: "KC_PAST", name: "×" },
  { code: "KC_PMNS", name: "-" },
  // Row 2
  { code: "KC_TAB", name: "Tab" },
  { code: "KC_Q", name: "Q" },
  { code: "KC_W", name: "W" },
  { code: "KC_E", name: "E" },
  { code: "KC_R", name: "R" },
  { code: "KC_T", name: "T" },
  { code: "KC_Y", name: "Y" },
  { code: "KC_U", name: "U" },
  { code: "KC_I", name: "I" },
  { code: "KC_O", name: "O" },
  { code: "KC_P", name: "P" },
  { code: "KC_LBRC", name: "{\n[" },
  { code: "KC_RBRC", name: "}\n]" },
  { code: "KC_BSLS", name: "|\n\\" },
  { code: "KC_DEL", name: "Del" },
  { code: "KC_END", name: "End" },
  { code: "KC_PGDN", name: "PgDn" },
  { code: "KC_P7", name: "7" },
  { code: "KC_P8", name: "8" },
  { code: "KC_P9", name: "9" },
  { code: "KC_PPLS", name: "+" },
  // Row 3
  { code: "KC_CAPS", name: "Caps Lock" },
  { code: "KC_A", name: "A" },
  { code: "KC_S", name: "S" },
  { code: "KC_D", name: "D" },
  { code: "KC_F", name: "F" },
  { code: "KC_G", name: "G" },
  { code: "KC_H", name: "H" },
  { code: "KC_J", name: "J" },
  { code: "KC_K", name: "K" },
  { code: "KC_L", name: "L" },
  { code: "KC_SCLN", name: ":\n;" },
  { code: "KC_QUOT", name: "\"\n'" },
  { code: "KC_ENT", name: "Enter" },
  { code: "KC_P4", name: "4" },
  { code: "KC_P5", name: "5" },
  { code: "KC_P6", name: "6" },
  // Row 4
  { code: "KC_LSFT", name: "Left Shift" },
  { code: "KC_Z", name: "Z" },
  { code: "KC_X", name: "X" },
  { code: "KC_C", name: "C" },
  { code: "KC_V", name: "V" },
  { code: "KC_B", name: "B" },
  { code: "KC_N", name: "N" },
  { code: "KC_M", name: "M" },
  { code: "KC_COMM", name: "<\n," },
  { code: "KC_DOT", name: ">\n." },
  { code: "KC_SLSH", name: "?\n/" },
  { code: "KC_RSFT", name: "Right Shift" },
  { code: "KC_UP", name: "↑" },
  { code: "KC_P1", name: "1" },
  { code: "KC_P2", name: "2" },
  { code: "KC_P3", name: "3" },
  { code: "KC_PENT", name: "N.Ent" },
  // Row 5
  { code: "KC_LCTL", name: "Left Ctrl" },
  { code: "KC_LGUI", name: "LWin" },
  { code: "KC_LALT", name: "LAlt" },
  { code: "KC_SPC", name: "Space" },
  { code: "KC_RALT", name: "RAlt" },
  { code: "KC_RGUI", name: "RWin" },
  { code: "KC_MENU", name: "Menu" },
  { code: "KC_RCTL", name: "RCtl" },
  { code: "KC_LEFT", name: "←" },
  { code: "KC_DOWN", name: "↓" },
  { code: "KC_RGHT", name: "→" },
  { code: "KC_P0", name: "0" },
  { code: "KC_PDOT", name: "." },

  { code: "KC_TRNS", name: "▽" },
  { code: "_QK_MACRO", name: "M0" },
  { code: "_QK_MACRO1", name: "M1" },
  { code: "_QK_MACRO2", name: "M2" },
  { code: "_QK_MACRO3", name: "M3" },
  { code: "_QK_MACRO4", name: "M4" },
  { code: "_QK_MACRO5", name: "M5" },
  { code: "_QK_MACRO6", name: "M6" },
  { code: "_QK_MACRO7", name: "M7" },
  { code: "_QK_MACRO8", name: "M8" },
  { code: "_QK_MACRO9", name: "M9" },
  { code: "_QK_MACRO10", name: "M10" },
  { code: "_QK_MACRO11", name: "M11" },
  { code: "_QK_MACRO12", name: "M12" },
  { code: "_QK_MACRO13", name: "M13" },
  { code: "_QK_MACRO14", name: "M14" },
  { code: "_QK_MACRO15", name: "M15" },
  { code: "_QK_MACRO_MAX", name: "M99" },
];

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
export function eventCode2Keycode(code: string) {
  return evtToKeyByte[code as keyof typeof evtToKeyByte];
}
export function getIndexByEvent(evt: KeyboardEvent): number {
  const code = evt.code;
  const byte =
    evtToKeyByte[code as keyof typeof evtToKeyByte] ||
    evtToKeyByte[evt.key as keyof typeof evtToKeyByte];
  if (byte) {
    return matrixKeycodes.indexOf(byte);
  }
  return -1;
}

export function mapEvtToKeycode(evt: KeyboardEvent) {
  switch (evt.code) {
    case "Digit1": {
      return "KC_1";
    }
    case "Digit2": {
      return "KC_2";
    }
    case "Digit3": {
      return "KC_3";
    }
    case "Digit4": {
      return "KC_4";
    }
    case "Digit5": {
      return "KC_5";
    }
    case "Digit6": {
      return "KC_6";
    }
    case "Digit7": {
      return "KC_7";
    }
    case "Digit8": {
      return "KC_8";
    }
    case "Digit9": {
      return "KC_9";
    }
    case "Digit0": {
      return "KC_0";
    }
    case "KeyA": {
      return "KC_A";
    }
    case "KeyB": {
      return "KC_B";
    }
    case "KeyC": {
      return "KC_C";
    }
    case "KeyD": {
      return "KC_D";
    }
    case "KeyE": {
      return "KC_E";
    }
    case "KeyF": {
      return "KC_F";
    }
    case "KeyG": {
      return "KC_G";
    }
    case "KeyH": {
      return "KC_H";
    }
    case "KeyI": {
      return "KC_I";
    }
    case "KeyJ": {
      return "KC_J";
    }
    case "KeyK": {
      return "KC_K";
    }
    case "KeyL": {
      return "KC_L";
    }
    case "KeyM": {
      return "KC_M";
    }
    case "KeyN": {
      return "KC_N";
    }
    case "KeyO": {
      return "KC_O";
    }
    case "KeyP": {
      return "KC_P";
    }
    case "KeyQ": {
      return "KC_Q";
    }
    case "KeyR": {
      return "KC_R";
    }
    case "KeyS": {
      return "KC_S";
    }
    case "KeyT": {
      return "KC_T";
    }
    case "KeyU": {
      return "KC_U";
    }
    case "KeyV": {
      return "KC_V";
    }
    case "KeyW": {
      return "KC_W";
    }
    case "KeyX": {
      return "KC_X";
    }
    case "KeyY": {
      return "KC_Y";
    }
    case "KeyZ": {
      return "KC_Z";
    }
    case "Comma": {
      return "KC_COMM";
    }
    case "Period": {
      return "KC_DOT";
    }
    case "Semicolon": {
      return "KC_SCLN";
    }
    case "Quote": {
      return "KC_QUOT";
    }
    case "BracketLeft": {
      return "KC_LBRC";
    }
    case "BracketRight": {
      return "KC_RBRC";
    }
    case "Backquote": {
      return "KC_GRV";
    }
    case "Slash": {
      return "KC_SLSH";
    }
    case "Backspace": {
      return "KC_BSPC";
    }
    case "Backslash": {
      return "KC_BSLS";
    }
    case "Minus": {
      return "KC_MINS";
    }
    case "Equal": {
      return "KC_EQL";
    }
    case "IntlRo": {
      return "KC_RO";
    }
    case "IntlYen": {
      return "KC_JYEN";
    }
    case "AltLeft": {
      return "KC_LALT";
    }
    case "AltRight": {
      return "KC_RALT";
    }
    case "CapsLock": {
      return "KC_CAPS";
    }
    case "ControlLeft": {
      return "KC_LCTL";
    }
    case "ControlRight": {
      return "KC_RCTL";
    }
    case "MetaLeft": {
      return "KC_LGUI";
    }
    case "MetaRight": {
      return "KC_RGUI";
    }
    case "OSLeft": {
      return "KC_LGUI";
    }
    case "OSRight": {
      return "KC_RGUI";
    }
    case "ShiftLeft": {
      return "KC_LSFT";
    }
    case "ShiftRight": {
      return "KC_RSFT";
    }
    case "ContextMenu": {
      return "KC_APP";
    }
    case "Apps": {
      return "KC_APP";
    }
    case "Enter": {
      return "KC_ENT";
    }
    case "Space": {
      return "KC_SPC";
    }
    case "Tab": {
      return "KC_TAB";
    }
    case "Delete": {
      return "KC_DEL";
    }
    case "End": {
      return "KC_END";
    }
    case "Help": {
      return "KC_HELP";
    }
    case "Home": {
      return "KC_HOME";
    }
    case "Insert": {
      return "KC_INS";
    }
    case "PageDown": {
      return "KC_PGDN";
    }
    case "PageUp": {
      return "KC_PGUP";
    }
    case "ArrowDown": {
      return "KC_DOWN";
    }
    case "ArrowLeft": {
      return "KC_LEFT";
    }
    case "ArrowRight": {
      return "KC_RGHT";
    }
    case "ArrowUp": {
      return "KC_UP";
    }
    case "Escape": {
      return "KC_ESC";
    }
    case "PrintScreen": {
      return "KC_PSCR";
    }
    case "ScrollLock": {
      return "KC_SLCK";
    }
    case "Pause": {
      return "KC_PAUS";
    }
    case "F1": {
      return "KC_F1";
    }
    case "F2": {
      return "KC_F2";
    }
    case "F3": {
      return "KC_F3";
    }
    case "F4": {
      return "KC_F4";
    }
    case "F5": {
      return "KC_F5";
    }
    case "F6": {
      return "KC_F6";
    }
    case "F7": {
      return "KC_F7";
    }
    case "F8": {
      return "KC_F8";
    }
    case "F9": {
      return "KC_F9";
    }
    case "F10": {
      return "KC_F10";
    }
    case "F11": {
      return "KC_F11";
    }
    case "F12": {
      return "KC_F12";
    }
    case "F13": {
      return "KC_F13";
    }
    case "F14": {
      return "KC_F14";
    }
    case "F15": {
      return "KC_F15";
    }
    case "F16": {
      return "KC_F16";
    }
    case "F17": {
      return "KC_F17";
    }
    case "F18": {
      return "KC_F18";
    }
    case "F19": {
      return "KC_F19";
    }
    case "F20": {
      return "KC_F20";
    }
    case "F21": {
      return "KC_F21";
    }
    case "F22": {
      return "KC_F22";
    }
    case "F23": {
      return "KC_F23";
    }
    case "F24": {
      return "KC_F24";
    }
    case "NumLock": {
      return "KC_NLCK";
    }
    case "Numpad0": {
      return "KC_P0";
    }
    case "Numpad1": {
      return "KC_P1";
    }
    case "Numpad2": {
      return "KC_P2";
    }
    case "Numpad3": {
      return "KC_P3";
    }
    case "Numpad4": {
      return "KC_P4";
    }
    case "Numpad5": {
      return "KC_P5";
    }
    case "Numpad6": {
      return "KC_P6";
    }
    case "Numpad7": {
      return "KC_P7";
    }
    case "Numpad8": {
      return "KC_P8";
    }
    case "Numpad9": {
      return "KC_P9";
    }
    case "NumpadAdd": {
      return "KC_PPLS";
    }
    case "NumpadComma": {
      return "KC_COMM";
    }
    case "NumpadDecimal": {
      return "KC_PDOT";
    }
    case "NumpadDivide": {
      return "KC_PSLS";
    }
    case "NumpadEnter": {
      return "KC_PENT";
    }
    case "NumpadEqual": {
      return "KC_PEQL";
    }
    case "NumpadMultiply": {
      return "KC_PAST";
    }
    case "NumpadSubtract": {
      return "KC_PMNS";
    }
    case "AudioVolumeUp": {
      return "KC_VOLU";
    }
    case "AudioVolumeDown": {
      return "KC_VOLD";
    }
    case "AudioVolumeMute": {
      return "KC_MUTE";
    }
    default:
      console.error("Unreacheable keydown code", evt);
  }
}

export function getByteForLayerCode(
  keycode: string,
  basicKeyToByte: Record<string, number>
): number {
  const keycodeMatch = keycode.match(/([A-Za-z]+)\((\d+)\)/);
  if (keycodeMatch) {
    const [, code, layer] = keycodeMatch;
    const numLayer = parseInt(layer);
    switch (code) {
      case "TO": {
        return Math.min(
          basicKeyToByte._QK_TO + numLayer,
          basicKeyToByte._QK_TO_MAX
        );
      }
      case "MO": {
        return Math.min(
          basicKeyToByte._QK_MOMENTARY + numLayer,
          basicKeyToByte._QK_MOMENTARY_MAX
        );
      }
      case "DF": {
        return Math.min(
          basicKeyToByte._QK_DEF_LAYER + numLayer,
          basicKeyToByte._QK_DEF_LAYER_MAX
        );
      }
      case "TG": {
        return Math.min(
          basicKeyToByte._QK_TOGGLE_LAYER + numLayer,
          basicKeyToByte._QK_TOGGLE_LAYER_MAX
        );
      }
      case "OSL": {
        return Math.min(
          basicKeyToByte._QK_ONE_SHOT_LAYER + numLayer,
          basicKeyToByte._QK_ONE_SHOT_LAYER_MAX
        );
      }
      case "TT": {
        return Math.min(
          basicKeyToByte._QK_LAYER_TAP_TOGGLE + numLayer,
          basicKeyToByte._QK_LAYER_TAP_TOGGLE_MAX
        );
      }
      case "CUSTOM": {
        return Math.min(
          basicKeyToByte._QK_KB + numLayer,
          basicKeyToByte._QK_KB_MAX
        );
      }
      case "MACRO": {
        return Math.min(
          basicKeyToByte._QK_MACRO + numLayer,
          basicKeyToByte._QK_MACRO_MAX
        );
      }
      default: {
        throw new Error("Incorrect code");
      }
    }
  }
  throw new Error("No match found");
}

export function isLayerCode(code: string) {
  return /([A-Za-z]+)\((\d+)\)/.test(code);
}

export function codeToKey(code: number) {
  const res = keyCode.find((item) => item.code == code);
  return res?.key || "";
}

export function keyToCode(key: string) {
  const res = keyCode.find((item) => item.key == key);
  return res?.code || 0;
}

export function getCode(key: number) {
  let code = "";
  _.forEach(basicKeyToByte, (v, k) => {
    if (v === key) {
      code = k;
    }
  });
  return code;
}

export function getName(key: number) {
  const code = getCode(key);
  const { name } = _.find(basicKey, { code: code }) || { name: code };
  return name;
}

export const initKeyCode = async (
  kbapi: KeyboardAPI | undefined,
  layer: number,
  matrix: MatrixInfo | null,
  version: number
) => {
  if (kbapi == undefined || matrix == null) return [];
  let i = 0;
  let keycodes: KeyCode[][] = [];

  const basicKeyToByte = getKeyCodeDict(version);
  const bytetoKey = getByteToKey(basicKeyToByte);

  do {
    const rawMatrix = await kbapi.readRawMatrix(matrix, i);
    const keycode = rawMatrix.map((key: number) => {
      const code = getCodeForByte(key, basicKeyToByte, bytetoKey) || "";
      const name = getLabelForByte(key, basicKeyToByte, bytetoKey) || "";
      return {
        code,
        name,
        key,
        color: "",
      };
    });
    keycodes[i] = keycode;
  } while (++i < layer);
  return keycodes.flat(2);
};

const keyName = {
  KC_NO: "",
  KC_TRNS: "▽",
  KC_A: "A",
  KC_B: "B",
  KC_C: "C",
  KC_D: "D",
  KC_E: "E",
  KC_F: "F",
  KC_G: "G",
  KC_H: "H",
  KC_I: "I",
  KC_J: "J",
  KC_K: "K",
  KC_L: "L",
  KC_M: "M",
  KC_N: "N",
  KC_O: "O",
  KC_P: "P",
  KC_Q: "Q",
  KC_R: "R",
  KC_S: "S",
  KC_T: "T",
  KC_U: "U",
  KC_V: "V",
  KC_W: "W",
  KC_X: "X",
  KC_Y: "Y",
  KC_Z: "Z",
  KC_1: "1 !",
  KC_2: "2 @",
  KC_3: "3 #",
  KC_4: "4 $",
  KC_5: "5 %",
  KC_6: "6 ^",
  KC_7: "7 &",
  KC_8: "8 *",
  KC_9: "9 (",
  KC_0: "0 )",
  KC_ENT: "ENTER",
  KC_ESC: "ESC",
  KC_BSPC: "BACKSPACE",
  KC_TAB: "TAB",
  KC_SPC: "SPACE",
  KC_MINS: "- _",
  KC_EQL: "= +",
  KC_LBRC: "[ {",
  KC_RBRC: "] }",
  KC_BSLS: "\\ |",
  KC_SCLN: "; :",
  KC_QUOT: "' \"",
  KC_GRV: "`",
  KC_COMM: ", <",
  KC_DOT: ". >",
  KC_SLSH: "/ ?",
  KC_CAPS: "CAPS",
  KC_F1: "F1",
  KC_F2: "F2",
  KC_F3: "F3",
  KC_F4: "F4",
  KC_F5: "F5",
  KC_F6: "F6",
  KC_F7: "F7",
  KC_F8: "F8",
  KC_F9: "F9",
  KC_F10: "F10",
  KC_F11: "F11",
  KC_F12: "F12",
  KC_F13: "F13",
  KC_PSCR: "PR",
  KC_SLCK: "SC",
  KC_PAUS: "PS",
  KC_INS: "INS",
  KC_HOME: "HM",
  KC_PGUP: "PU",
  KC_DEL: "DEL",
  KC_END: "END",
  KC_PGDN: "PD",
  KC_RGHT: "→",
  KC_LEFT: "←",
  KC_DOWN: "↓",
  KC_UP: "↑",
  KC_NLCK: "N.Lck",
  KC_PSLS: "÷",
  KC_PAST: "×",
  KC_PMNS: "-",
  KC_PPLS: "+",
  KC_PENT: "N.Ent",
  KC_PDOT: ".",
  KC_PEQL: "=",
  KC_APP: "Menu",
  KC_HELP: "Help",
  KC_RO: "/",
  KC_LALT: "Alt",
  KC_RALT: "Alt",
  KC_LCTL: "Ctrl",
  KC_RCTL: "Ctrl",
  KC_LGUI: "Win",
  KC_RGUI: "Win",
  KC_LSFT: "Shift",
  KC_RSFT: "Shift",
  KC_VOLU: "Vol+",
  KC_VOLD: "Vol-",
  KC_MUTE: "Mute",
  KC_P1: "Num 1",
  KC_P2: "Num 2",
  KC_P3: "Num 3",
  KC_P4: "Num 4",
  KC_P5: "Num 5",
  KC_P6: "Num 6",
  KC_P7: "Num 7",
  KC_P8: "Num 8",
  KC_P9: "Num 9",
  KC_P0: "Num 0",
  KC_MAC_WIN: "多窗口",
  KC_MAC_TASK: "多任务",
};

export const getKeyByKeyNameValue = (value: string): string => {
  if (!value) return "";
  const normalized = String(value).replace(/\s+/g, " ").trim().toUpperCase();
  for (const [key, label] of Object.entries(keyName)) {
    const normalizedLabel = String(label).replace(/\s+/g, " ").trim().toUpperCase();
    if (normalizedLabel === normalized) {
      return key;
    }
  }
  return "";
};

export const evtKeyToName = {
  Digit1: keyName.KC_1,
  Digit2: keyName.KC_2,
  Digit3: keyName.KC_3,
  Digit4: keyName.KC_4,
  Digit5: keyName.KC_5,
  Digit6: keyName.KC_6,
  Digit7: keyName.KC_7,
  Digit8: keyName.KC_8,
  Digit9: keyName.KC_9,
  Digit0: keyName.KC_0,
  KeyA: keyName.KC_A,
  KeyB: keyName.KC_B,
  KeyC: keyName.KC_C,
  KeyD: keyName.KC_D,
  KeyE: keyName.KC_E,
  KeyF: keyName.KC_F,
  KeyG: keyName.KC_G,
  KeyH: keyName.KC_H,
  KeyI: keyName.KC_I,
  KeyJ: keyName.KC_J,
  KeyK: keyName.KC_K,
  KeyL: keyName.KC_L,
  KeyM: keyName.KC_M,
  KeyN: keyName.KC_N,
  KeyO: keyName.KC_O,
  KeyP: keyName.KC_P,
  KeyQ: keyName.KC_Q,
  KeyR: keyName.KC_R,
  KeyS: keyName.KC_S,
  KeyT: keyName.KC_T,
  KeyU: keyName.KC_U,
  KeyV: keyName.KC_V,
  KeyW: keyName.KC_W,
  KeyX: keyName.KC_X,
  KeyY: keyName.KC_Y,
  KeyZ: keyName.KC_Z,
  Comma: keyName.KC_COMM,
  Period: keyName.KC_DOT,
  Semicolon: keyName.KC_SCLN,
  Quote: keyName.KC_QUOT,
  BracketLeft: keyName.KC_LBRC,
  BracketRight: keyName.KC_RBRC,
  Backspace: keyName.KC_BSPC,
  Backquote: keyName.KC_GRV,
  Slash: keyName.KC_SLSH,
  Backslash: keyName.KC_BSLS,
  Minus: keyName.KC_MINS,
  Equal: keyName.KC_EQL,
  IntlRo: keyName.KC_RO,
  AltLeft: keyName.KC_LALT,
  AltRight: keyName.KC_RALT,
  CapsLock: keyName.KC_CAPS,
  ControlLeft: keyName.KC_LCTL,
  ControlRight: keyName.KC_RCTL,
  MetaLeft: keyName.KC_LGUI,
  MetaRight: keyName.KC_RGUI,
  OSLeft: keyName.KC_LGUI,
  OSRight: keyName.KC_RGUI,
  ShiftLeft: keyName.KC_LSFT,
  ShiftRight: keyName.KC_RSFT,
  ContextMenu: keyName.KC_APP,
  Enter: keyName.KC_ENT,
  Space: keyName.KC_SPC,
  Tab: keyName.KC_TAB,
  Delete: keyName.KC_DEL,
  End: keyName.KC_END,
  Help: keyName.KC_HELP,
  Home: keyName.KC_HOME,
  Insert: keyName.KC_INS,
  PageDown: keyName.KC_PGDN,
  PageUp: keyName.KC_PGUP,
  ArrowDown: keyName.KC_DOWN,
  ArrowLeft: keyName.KC_LEFT,
  ArrowRight: keyName.KC_RGHT,
  ArrowUp: keyName.KC_UP,
  Escape: keyName.KC_ESC,
  PrintScreen: keyName.KC_PSCR,
  ScrollLock: keyName.KC_SLCK,
  AudioVolumeUp: keyName.KC_VOLU,
  AudioVolumeDown: keyName.KC_VOLD,
  AudioVolumeMute: keyName.KC_MUTE,
  Pause: keyName.KC_PAUS,
  F1: keyName.KC_F1,
  F2: keyName.KC_F2,
  F3: keyName.KC_F3,
  F4: keyName.KC_F4,
  F5: keyName.KC_F5,
  F6: keyName.KC_F6,
  F7: keyName.KC_F7,
  F8: keyName.KC_F8,
  F9: keyName.KC_F9,
  F10: keyName.KC_F10,
  F11: keyName.KC_F11,
  F12: keyName.KC_F12,
  NumLock: keyName.KC_NLCK,
  NumpadAdd: keyName.KC_PPLS,
  NumpadComma: keyName.KC_COMM,
  NumpadDecimal: keyName.KC_PDOT,
  NumpadDivide: keyName.KC_PSLS,
  NumpadEnter: keyName.KC_PENT,
  NumpadEqual: keyName.KC_PEQL,
  NumpadMultiply: keyName.KC_PAST,
  NumpadSubtract: keyName.KC_PMNS,
  Numpad1: keyName.KC_P1,
  Numpad2: keyName.KC_P2,
  Numpad3: keyName.KC_P3,
  Numpad4: keyName.KC_P4,
  Numpad5: keyName.KC_P5,
  Numpad6: keyName.KC_P6,
  Numpad7: keyName.KC_P7,
  Numpad8: keyName.KC_P8,
  Numpad9: keyName.KC_P9,
  Numpad0: keyName.KC_P0,
};

// HID keycode -> { eventCode, displayName } 反查
const _hidKeycodeToEvtMap: Record<number, { eventCode: string; displayName: string }> = (() => {
  const map: Record<number, { eventCode: string; displayName: string }> = {};
  for (const [evtCode, hidCode] of Object.entries(evtToKeyByte)) {
    if (!(hidCode in map)) {
      const displayName = evtKeyToName[evtCode as keyof typeof evtKeyToName] ?? evtCode;
      map[hidCode] = { eventCode: evtCode, displayName: String(displayName) };
    }
  }
  return map;
})();

export function hidKeycode2EventCode(hidCode: number): { eventCode: string; displayName: string } {
  return _hidKeycodeToEvtMap[hidCode] ?? { eventCode: '', displayName: String(hidCode) };
}

const mouseCodeName = [
  "Mouse L-Button",
  "Mouse M-Button",
  "Mouse R-Button",
  "Mouse Backward",
  "Mouse Forward",
];
export const mouseCodeIcon = {
  "0": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="54"
      viewBox="0 0 40 54"
      fill="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M19.9997 2.17969V22.001H38V20.7538C38 10.4673 29.9133 2.17969 20 2.17969C19.9999 2.17969 19.9998 2.17969 19.9997 2.17969ZM2 33.4264V24.001H38V33.4264C38 43.7128 29.9133 52.0004 20 52.0004C10.0867 52.0004 2 43.7128 2 33.4264ZM0 20.7538C0 9.41929 8.92645 0.179688 20 0.179688C31.0735 0.179688 40 9.41929 40 20.7538V33.4264C40 44.7608 31.0735 54.0004 20 54.0004C8.92645 54.0004 0 44.7608 0 33.4264V20.7538Z"
        fill="currentColor"
      />
    </svg>
  ),
  "1": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="54"
      viewBox="0 0 40 54"
      fill="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M20 2.17969C10.0867 2.17969 2 10.4673 2 20.7538V22L38 22V20.7538C38 10.4673 29.9133 2.17969 20 2.17969ZM2 33.4264L2 24L38 24V33.4264C38 43.7128 29.9133 52.0004 20 52.0004C10.0867 52.0004 2 43.7128 2 33.4264ZM0 20.7538C0 9.41929 8.92645 0.179688 20 0.179688C31.0735 0.179688 40 9.41929 40 20.7538V33.4264C40 44.7608 31.0735 54.0004 20 54.0004C8.92645 54.0004 0 44.7608 0 33.4264V20.7538ZM23 10C23 8.34315 21.6569 7 20 7C18.3431 7 17 8.34315 17 10V15.5C17 17.1569 18.3431 18.5 20 18.5C21.6569 18.5 23 17.1569 23 15.5V10Z"
        fill="currentColor"
      />
    </svg>
  ),
  "2": (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="54"
      viewBox="0 0 40 54"
      fill="none"
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M19.9999 2.17969C10.0867 2.17975 2 10.4674 2 20.7538V22.001H20.0026C20.0008 21.9755 19.9999 21.9498 19.9999 21.9239V2.18613C19.9999 2.18398 19.9999 2.18183 19.9999 2.17969ZM2 33.4264V24.001H38V33.4264C38 43.7128 29.9133 52.0004 20 52.0004C10.0867 52.0004 2 43.7128 2 33.4264ZM0 20.7538C0 9.41929 8.92645 0.179688 20 0.179688C31.0735 0.179688 40 9.41929 40 20.7538V33.4264C40 44.7608 31.0735 54.0004 20 54.0004C8.92645 54.0004 0 44.7608 0 33.4264V20.7538Z"
        fill="currentColor"
      />
    </svg>
  ),
};

export const eventToKeyName = (key: string | number) => {
  if (key == "0" || key == "1" || key == "2") {
    return mouseCodeName[key] || "";
  } else {
    return evtKeyToName[key as keyof typeof evtKeyToName] || "";
  }
};

const basicKeyToByteV2 = {
  KC_NO: 0x0000,
  KC_TRNS: 0x0001,
  KC_A: 0x100004,
  KC_B: 0x100005,
  KC_C: 0x100006,
  KC_D: 0x100007,
  KC_E: 0x100008,
  KC_F: 0x100009,
  KC_G: 0x10000a,
  KC_H: 0x10000b,
  KC_I: 0x10000c,
  KC_J: 0x10000d,
  KC_K: 0x10000e,
  KC_L: 0x10000f,
  KC_M: 0x100010,
  KC_N: 0x100011,
  KC_O: 0x100012,
  KC_P: 0x100013,
  KC_Q: 0x100014,
  KC_R: 0x100015,
  KC_S: 0x100016,
  KC_T: 0x100017,
  KC_U: 0x100018,
  KC_V: 0x100019,
  KC_W: 0x10001a,
  KC_X: 0x10001b,
  KC_Y: 0x10001c,
  KC_Z: 0x10001d,
  KC_1: 0x10001e,
  KC_2: 0x10001f,
  KC_3: 0x100020,
  KC_4: 0x100021,
  KC_5: 0x100022,
  KC_6: 0x100023,
  KC_7: 0x100024,
  KC_8: 0x100025,
  KC_9: 0x100026,
  KC_0: 0x100027,
  KC_ENT: 0x100028,
  KC_ESC: 0x100029,
  KC_BSPC: 0x10002a,
  KC_TAB: 0x10002b,
  KC_SPC: 0x10002c,
  KC_MINS: 0x10002d,
  KC_EQL: 0x10002e,
  KC_LBRC: 0x10002f,
  KC_RBRC: 0x100030,
  KC_BSLS: 0x100031,
  KC_NUHS: 0x100032,
  KC_SCLN: 0x100033,
  KC_QUOT: 0x100034,
  KC_GRV: 0x100035,
  KC_COMM: 0x100036,
  KC_DOT: 0x100037,
  KC_SLSH: 0x100038,
  KC_CAPS: 0x100039,
  KC_F1: 0x10003a,
  KC_F2: 0x10003b,
  KC_F3: 0x10003c,
  KC_F4: 0x10003d,
  KC_F5: 0x10003e,
  KC_F6: 0x10003f,
  KC_F7: 0x100040,
  KC_F8: 0x100041,
  KC_F9: 0x100042,
  KC_F10: 0x100043,
  KC_F11: 0x100044,
  KC_F12: 0x100045,
  KC_PSCR: 0x100046,
  KC_SLCK: 0x100047,
  KC_PAUS: 0x100048,
  KC_INS: 0x100049,
  KC_HOME: 0x10004a,
  KC_PGUP: 0x10004b,
  KC_DEL: 0x10004c,
  KC_END: 0x10004d,
  KC_PGDN: 0x10004e,
  KC_RGHT: 0x10004f,
  KC_LEFT: 0x100050,
  KC_DOWN: 0x100051,
  KC_UP: 0x100052,
  KC_NLCK: 0x100053,
  KC_PSLS: 0x100054,
  KC_PAST: 0x100055,
  KC_PMNS: 0x100056,
  KC_PPLS: 0x100057,
  KC_PENT: 0x100058,
  KC_P1: 0x100059,
  KC_P2: 0x10005a,
  KC_P3: 0x10005b,
  KC_P4: 0x10005c,
  KC_P5: 0x10005d,
  KC_P6: 0x10005e,
  KC_P7: 0x10005f,
  KC_P8: 0x100060,
  KC_P9: 0x100061,
  KC_P0: 0x100062,
  KC_PDOT: 0x0063,
  KC_NUBS: 0x0064,
  KC_APP: 0x0065,
  KC_POWER: 0x0066,
  KC_PEQL: 0x0067,
  KC_F13: 0x0068,
  KC_F14: 0x0069,
  KC_F15: 0x006a,
  KC_F16: 0x006b,
  KC_F17: 0x006c,
  KC_F18: 0x006d,
  KC_F19: 0x006e,
  KC_F20: 0x006f,
  KC_F21: 0x0070,
  KC_F22: 0x0071,
  KC_F23: 0x0072,
  KC_F24: 0x0073,
  KC_EXECUTE: 0x0074,
  KC_HELP: 0x0075,
  KC_MENU: 0x0076,
  KC_SELECT: 0x0077,
  KC_STOP: 0x0078,
  KC_AGAIN: 0x0079,
  KC_UNDO: 0x007a,
  KC_CUT: 0x007b,
  KC_COPY: 0x007c,
  KC_PASTE: 0x007d,
  KC_FIND: 0x007e,
  KC_LCAP: 0x0082,
  KC_LNUM: 0x0083,
  KC_LSCR: 0x0084,
  KC_PCMM: 0x0085,
  KC_KP_EQUAL_AS400: 0x0086,
  KC_RO: 0x0087,
  KC_KANA: 0x0088,
  KC_JYEN: 0x0089,
  KC_HENK: 0x008a,
  KC_MHEN: 0x008b,
  KC_INT6: 0x008c,
  KC_INT7: 0x008d,
  KC_INT8: 0x008e,
  KC_INT9: 0x008f,
  KC_HAEN: 0x0090,
  KC_HANJ: 0x0091,
  KC_LANG3: 0x0092,
  KC_LANG4: 0x0093,
  KC_LANG5: 0x0094,
  KC_LANG6: 0x0095,
  KC_LANG7: 0x0096,
  KC_LANG8: 0x0097,
  KC_LANG9: 0x0098,
  KC_ERAS: 0x0099,
  KC_SYSREQ: 0x009a,
  KC_CANCEL: 0x009b,
  KC_CLR: 0x009c,
  KC_CLEAR: 0x009c,
  KC_PRIOR: 0x009d,
  KC_OUT: 0x00a0,
  KC_OPER: 0x00a1,
  KC_CLEAR_AGAIN: 0x00a2,
  KC_CRSEL: 0x00a3,
  KC_EXSEL: 0x00a4,
  KC_PWR: 0x00a5,
  KC_SLEP: 0x00a6,
  KC_WAKE: 0x00a7,
  KC_MUTE: 0x30e200,
  KC_VOLU: 0x30e900,
  KC_VOLD: 0x30ea00,
  KC_MNXT: 0x30b500,
  KC_MPRV: 0x30b600,
  KC_MSTP: 0x30b700,
  KC_MPLY: 0x30cd00,
  KC_MPLYER: 0x308301,
  KC_MSEL: 0x30af00,
  KC_EJCT: 0x30b000,
  KC_MAIL: 0x308a01,
  KC_CALC: 0x309201,
  KC_MYCM: 0x309401,
  KC_WWW_SEARCH: 0x1221,
  KC_WWW_HOME: 0x1223,
  KC_WWW_BACK: 0x00b6,
  KC_WWW_FORWARD: 0x00b7,
  KC_WWW_STOP: 0x00b8,
  KC_WWW_REFRESH: 0x00b9,
  KC_WWW_FAVORITES: 0x00ba,
  KC_MFFD: 0x30bb00,
  KC_MRWD: 0x30bc00,
  KC_BRIU: 0xf03200,
  KC_BRID: 0xf03300,
  KC_LCTL: 0x100100,
  KC_LSFT: 0x100200,
  KC_LALT: 0x100400,
  KC_LGUI: 0x100800,
  KC_RCTL: 0x101000,
  KC_RSFT: 0x102000,
  KC_RALT: 0x104000,
  KC_RGUI: 0x108000,
  KC_MS_UP: 0x00f0,
  KC_MS_DOWN: 0x00f1,
  KC_MS_LEFT: 0x00f2,
  KC_MS_RIGHT: 0x00f3,
  KC_MS_BTN1: 0x00f4,
  KC_MS_BTN2: 0x00f5,
  KC_MS_BTN3: 0x00f6,
  KC_MS_BTN4: 0x00f7,
  KC_MS_BTN5: 0x00f8,
  KC_MS_WH_UP: 0x00f9,
  KC_MS_WH_DOWN: 0x00fa,
  KC_MS_WH_LEFT: 0x00fb,
  KC_MS_WH_RIGHT: 0x00fc,
  KC_MS_ACCEL0: 0x00fd,
  KC_MS_ACCEL1: 0x00fe,
  KC_MS_ACCEL2: 0x00ff,
  KC_MAC_WIN: 0x6152,
  KC_MAC_TASK: 0x681b,
  KC_FN1: 0xf0ff01,
  KC_FN2: 0xf0ff02,
  KC_FN3: 0xf0ff03,
  KC_FN4: 0xf0ff04,
  KC_FN5: 0xf0ff05,
  KC_FN6: 0xf0ff06,
  KC_FN7: 0xf0ff07,
  KC_FN8: 0xf0ff08,
  KC_FN9: 0xf0ff09,
  KC_FN10: 0xf0ff10,
};

export const getKeyFromCode = (code: string) => {
  const keyByte = basicKeyToByteV2[code as keyof typeof basicKeyToByteV2];
  return {
    type: (keyByte >> 16) & 0xff,
    code1: (keyByte >> 8) & 0xff,
    code2: keyByte & 0xff,
    code3: 0,
  };
};

export const getNameFromKeyCode = (keycode: number) => {
  const code = _.findKey(basicKeyToByteV2, (v) => v == keycode);
  if (code) {
    return keyName[code as keyof typeof keyName] ?? "" + keycode;
  }
  return "" + keycode;
};

export const getMediaName = (keycode: number) => {
  const lang = getCurrentLanguage();

  // 德语媒体键名称
  const germanMediaNames = [
    { code: 0xb5, name: "Nächster" },
    { code: 0xb6, name: "Vorheriger" },
    { code: 0xb7, name: "Stopp" },
    { code: 0xcd, name: "Wiedergabe/Pause" },
    { code: 0xe2, name: "Stumm" },
    { code: 0xe9, name: "Lauter" },
    { code: 0xea, name: "Leiser" },
    { code: 0x183, name: "Player" },
    { code: 0x18a, name: "E-Mail" },
    { code: 0x192, name: "Rechner" },
  ];

  // 中文媒体键名称（默认）
  const chineseMediaNames = [
    { code: 0xb5, name: "下一曲" },
    { code: 0xb6, name: "上一曲" },
    { code: 0xb7, name: "停止" },
    { code: 0xcd, name: "播放/暂停" },
    { code: 0xe2, name: "静音" },
    { code: 0xe9, name: "音量+" },
    { code: 0xea, name: "音量-" },
    { code: 0x183, name: "播放器" },
    { code: 0x18a, name: "邮件" },
    { code: 0x192, name: "计算器" },
  ];

  // 德语额外的媒体键
  const germanExtraMediaNames = [
    { code: 0x194, name: "Computer" },
    { code: 0x221, name: "Suchen" },
    { code: 0x223, name: "Browser" },
    { code: 0x6f, name: "Helligkeit+" },
    { code: 0x70, name: "Helligkeit-" },
  ];

  // 中文额外的媒体键
  const chineseExtraMediaNames = [
    { code: 0x194, name: "我的电脑" },
    { code: 0x221, name: "搜索" },
    { code: 0x223, name: "浏览器" },
    { code: 0x6f, name: "亮度+" },
    { code: 0x70, name: "亮度-" },
  ];

  const extraMediaNames = lang.startsWith('de') ? germanExtraMediaNames : chineseExtraMediaNames;
  const mediaName = [...(lang.startsWith('de') ? germanMediaNames : chineseMediaNames), ...extraMediaNames];
  const key = mediaName.find((key) => key.code == keycode);
  if (key) {
    return key.name;
  }
  return keycode + "";
};

export const getSystemName = (code1: number, code2: number) => {
  const systemName = [
    { code1: 0, code2: 1, name: "Fn1" },
    { code1: 0, code2: 2, name: "Fn2" },
    { code1: 0, code2: 3, name: "Fn3" },
    { code1: 0, code2: 4, name: "Fn4" },
    { code1: 0, code2: 5, name: "Fn5" },
    { code1: 0, code2: 6, name: "Fn6" },
    { code1: 0, code2: 7, name: "Fn7" },
    { code1: 0, code2: 8, name: "Fn8" },
    { code1: 0, code2: 9, name: "Fn9" },
    { code1: 1, code2: 0, name: "复位" },
    { code1: 1, code2: 1, name: "Win" },
    { code1: 1, code2: 2, name: "Mac" },
    { code1: 3, code2: 9, name: "LockWIN" },
    { code1: 3, code2: 16, name: "切换灯效" },
    { code1: 3, code2: 18, name: "亮度+" },
    { code1: 3, code2: 19, name: "亮度-" },
    { code1: 3, code2: 20, name: "速度+" },
    { code1: 3, code2: 21, name: "速度-" },
  ];
  const key = systemName.find(
    (key) => key.code1 == code1 && key.code2 == code2
  );
  if (key) {
    return key.name;
  }
  return "";
};

export const key2KeyboardKey = (key: number) => {
  return {
    type: 0,
    code1: 0,
    code2: key,
    code3: 0,
    name: getNameFromKeyCode(key),
  } as KeyboardKey;
};

export const getKeyboardKeyFromKeycode = (
  keycode1: number,
  keycode2: number
) => {
  const type = (keycode1 >> 4) & 0b1111;
  let code1 = 0;
  let code2 = 0;
  let name = "";
  if (type < 6) {
    code2 = keycode2;
    name = getNameFromKeyCode(keycode2);
  }
  if (type == 1) {
    code2 = ((keycode1 & 0xf) << 8) | keycode2;
    name = getMediaName(code2);
  }

  if (type == 6 || type == 7) {
    name = keycode2 == 0x4 ? "控制" : keycode2 == 0x52 ? "窗口" : "任务";
    code2 = ((keycode1 & 0xf) << 8) | keycode2;
  }
  if (type == 15) {
    code1 = keycode1 & 0xf;
    code2 = keycode2 & 0xff;
    name = getSystemName(code1, code2);
  }
  return { type, code1, code2, name };
};

export const getKeycodeFromKeyboardKey = (key: KeyboardKey) => {
  const { type, code1, code2 } = key;
  let keycode1 = 0;
  let keycode2 = 0;
  if (type < 6) {
    keycode1 = code2;
    keycode2 = (code1 & 0xf) | (type << 4);
  }

  if (type == 6 || type == 7) {
    keycode1 = code2 & 0xff;
    keycode2 = ((code2 >> 8) & 0xf) | (type << 4);
  }
  if (type == 15) {
    keycode1 = code2;
    keycode2 = (code1 & 0xf) | (type << 4);
  }
  return [keycode1, keycode2];
};

export const getKeyCodeFromWebCode = (type: string, webCode: string) => {
  if (type == "mouse") {
    return (0x301 + parseInt(webCode)) | (0x7 << 12);
  }
  if (type == "key") {
    return evtToKeyByte[webCode as keyof typeof evtToKeyByte];
  }
  return -1;
};

export const emptyKey: KeyboardKey = {
  type: 0,
  code1: 0,
  code2: 0,
  code3: 0,
  name: "",
};

const keyCodes = [
  {
    code: 41,
    key: "Esc",
  },
  {
    code: 58,
    key: "F1",
  },
  {
    code: 59,
    key: "F2",
  },
  {
    code: 60,
    key: "F3",
  },
  {
    code: 61,
    key: "F4",
  },
  {
    code: 62,
    key: "F5",
  },
  {
    code: 63,
    key: "F6",
  },
  {
    code: 64,
    key: "F7",
  },
  {
    code: 65,
    key: "F8",
  },
  {
    code: 66,
    key: "F9",
  },
  {
    code: 67,
    key: "F10",
  },
  {
    code: 68,
    key: "F11",
  },
  {
    code: 69,
    key: "F12",
  },
  {
    code: 104,
    key: "F13",
  },
  {
    code: 70,
    key: "PrtSc",
  },
  {
    code: 71,
    key: "Scroll",
  },
  {
    code: 72,
    key: "Pause",
  },
  {
    code: 0,
    key: "",
  },
  {
    code: 53,
    key: "~\n`",
  },
  {
    code: 30,
    key: "!\n1",
  },
  {
    code: 31,
    key: "@\n2",
  },
  {
    code: 32,
    key: "#\n3",
  },
  {
    code: 33,
    key: "$\n4",
  },
  {
    code: 34,
    key: "%\n5",
  },
  {
    code: 35,
    key: "^\n6",
  },
  {
    code: 36,
    key: "&\n7",
  },
  {
    code: 37,
    key: "*\n8",
  },
  {
    code: 38,
    key: "(\n9",
  },
  {
    code: 39,
    key: ")\n0",
  },
  {
    code: 45,
    key: "_\n-",
  },
  {
    code: 46,
    key: "+\n=",
  },
  {
    code: 42,
    key: "Bksp",
  },
  {
    code: 73,
    key: "Ins",
  },
  {
    code: 76,
    key: "Del",
  },
  {
    code: 74,
    key: "Home",
  },
  {
    code: 83,
    key: "Num",
  },
  {
    code: 84,
    key: "/",
  },
  {
    code: 85,
    key: "*",
  },
  {
    code: 86,
    key: "-",
  },
  {
    code: 43,
    key: "Tab",
  },
  {
    code: 20,
    key: "Q",
  },
  {
    code: 26,
    key: "W",
  },
  {
    code: 8,
    key: "E",
  },
  {
    code: 21,
    key: "R",
  },
  {
    code: 23,
    key: "T",
  },
  {
    code: 28,
    key: "Y",
  },
  {
    code: 24,
    key: "U",
  },
  {
    code: 12,
    key: "I",
  },
  {
    code: 18,
    key: "O",
  },
  {
    code: 19,
    key: "P",
  },
  {
    code: 47,
    key: "{\n[",
  },
  {
    code: 48,
    key: "}\n]",
  },
  {
    code: 49,
    key: "|\n\\",
  },
  {
    code: 77,
    key: "End",
  },
  {
    code: 75,
    key: "PgUp",
  },
  {
    code: 78,
    key: "PgDn",
  },
  {
    code: 95,
    key: "7",
  },
  {
    code: 96,
    key: "8",
  },
  {
    code: 97,
    key: "9",
  },
  {
    code: 87,
    key: "+",
  },
  {
    code: 57,
    key: "Caps",
  },
  {
    code: 4,
    key: "A",
  },
  {
    code: 22,
    key: "S",
  },
  {
    code: 7,
    key: "D",
  },
  {
    code: 9,
    key: "F",
  },
  {
    code: 10,
    key: "G",
  },
  {
    code: 11,
    key: "H",
  },
  {
    code: 13,
    key: "J",
  },
  {
    code: 14,
    key: "K",
  },
  {
    code: 15,
    key: "L",
  },
  {
    code: 51,
    key: ":\n;",
  },
  {
    code: 52,
    key: "\"\n'",
  },
  {
    code: 40,
    key: "Enter",
  },
  {
    code: 92,
    key: "4",
  },
  {
    code: 93,
    key: "5",
  },
  {
    code: 94,
    key: "6",
  },
  {
    code: 29,
    key: "Z",
  },
  {
    code: 27,
    key: "X",
  },
  {
    code: 6,
    key: "C",
  },
  {
    code: 25,
    key: "V",
  },
  {
    code: 5,
    key: "B",
  },
  {
    code: 17,
    key: "N",
  },
  {
    code: 16,
    key: "M",
  },
  {
    code: 54,
    key: "<\n,",
  },
  {
    code: 55,
    key: ">\n.",
  },
  {
    code: 56,
    key: "?\n/",
  },
  {
    code: 82,
    key: "↑",
  },
  {
    code: 89,
    key: "1",
  },
  {
    code: 90,
    key: "2",
  },
  {
    code: 91,
    key: "3",
  },
  {
    code: 88,
    key: "Enter",
  },
  {
    code: 44,
    key: "Space",
  },
  {
    code: 175,
    key: "FN",
  },
  {
    code: 101,
    key: "Menu",
  },
  {
    code: 80,
    key: "←",
  },
  {
    code: 81,
    key: "↓",
  },
  {
    code: 79,
    key: "→",
  },
  {
    code: 98,
    key: "0",
  },
  {
    code: 99,
    key: ".",
  },
  {
    code: 100,
    key: "<>",
  },
  {
    code: 135,
    key: "\\",
  },
  {
    code: 404,
    key: "Calculator",
  },
  {
    code: 50,
    key: "|\n\\",
  }
];
// V2、V3版本
const customKeys = [
  { code: 1, code1: 0, key: "Fn0", icon: "FN_0" },
  { code: 2, code1: 0, key: "Fn1", icon: "FN_1" },
  { code: 3, code1: 0, key: "Fn2", icon: "FN_2" },
  { code: 4, code1: 0, key: "Fn3", icon: "FN_3" },
  { code: 5, code1: 0, key: "To0", icon: "TO_0" },
  { code: 6, code1: 0, key: "To1", icon: "TO_1" },
  { code: 7, code1: 0, key: "To2", icon: "TO_2" },
  { code: 8, code1: 0, key: "To3", icon: "TO_3" },
  { code: 9, code1: 0, key: "Key Light Toggle", icon: "/KeyType/custom_bl_toggle.svg" },
  { code: 10, code1: 0, key: "Key Light Mode +", icon: "/KeyType/custom_bl_mode_plus.svg" },
  { code: 11, code1: 0, key: "Key Light Mode -", icon: "/KeyType/custom_bl_mode_minus.svg" },
  { code: 12, code1: 0, key: "Key Light Hue +", icon: "/KeyType/custom_bl_hue_plus.svg" },
  { code: 13, code1: 0, key: "Key Light Hue -", icon: "/KeyType/custom_bl_hue_minus.svg" },
  { code: 14, code1: 0, key: "Key Light Bright +", icon: "/KeyType/custom_bl_bright_plus.svg" },
  { code: 15, code1: 0, key: "Key Light Bright -", icon: "/KeyType/custom_bl_bright_minus.svg" },
  { code: 16, code1: 0, key: "Key Light Speed +", icon: "/KeyType/custom_bl_speed_plus.svg" },
  { code: 17, code1: 0, key: "Key Light Speed -", icon: "/KeyType/custom_bl_speed_minus.svg" },
  { code: 18, code1: 0, key: "Color Board", icon: "/KeyType/custom_bl_color_board.svg" },
  { code: 19, code1: 0, key: "Custom Light 1", icon: "/KeyType/custom_bl_custom_light1.svg" },
  { code: 20, code1: 0, key: "Custom Light 2", icon: "/KeyType/custom_bl_custom_light2.svg" },
  { code: 21, code1: 0, key: "Custom Light 3", icon: "/KeyType/custom_bl_custom_light3.svg" },
  { code: 22, code1: 0, key: "Custom Light 4", icon: "/KeyType/custom_bl_custom_light4.svg" },
  { code: 23, code1: 0, key: "Custom Light 5", icon: "/KeyType/custom_bl_custom_light5.svg" },
  { code: 24, code1: 0, key: "Logo Light Toggle", icon: "/KeyType/custom_lg_tog.svg" },
  { code: 25, code1: 0, key: "Logo Light Mode +", icon: "/KeyType/custom_lg_mod.svg" },
  { code: 26, code1: 0, key: "Logo Light Mode -", icon: "/KeyType/custom_lg_rmod.svg" },
  { code: 27, code1: 0, key: "Logo Light Hue +", icon: "/KeyType/custom_lg_hui.svg" },
  { code: 28, code1: 0, key: "Logo Light Hue -", icon: "/KeyType/custom_lg_hud.svg" },
  { code: 29, code1: 0, key: "Logo Light Bright +", icon: "/KeyType/custom_lg_vai.svg" },
  { code: 30, code1: 0, key: "Logo Light Bright -", icon: "/KeyType/custom_lg_vad.svg" },
  { code: 31, code1: 0, key: "Logo Light Speed +", icon: "/KeyType/custom_lg_spi.svg" },
  { code: 32, code1: 0, key: "Logo Light Speed -", icon: "/KeyType/custom_lg_spd.svg" },
  { code: 33, code1: 0, key: "Side Light Toggle", icon: "💡➡️" },
  { code: 34, code1: 0, key: "Side Light Mode +", icon: "💡➡️➕" },
  { code: 35, code1: 0, key: "Side Light Mode -", icon: "💡➡️➖" },
  { code: 36, code1: 0, key: "Side Light Hue +", icon: "🌈➡️➕" },
  { code: 37, code1: 0, key: "Side Light Hue -", icon: "🌈➡️➖" },
  { code: 38, code1: 0, key: "Side Light Bright +", icon: "🔆➡️➕" },
  { code: 39, code1: 0, key: "Side Light Bright -", icon: "🔆➡️➖" },
  { code: 40, code1: 0, key: "Side Light Speed +", icon: "⚡➡️➕" },
  { code: 41, code1: 0, key: "Side Light Speed -", icon: "⚡➡️➖" },
  { code: 42, code1: 0, key: "Matrix Light Toggle", icon: "/KeyType/matrix_screen_toggle.svg" },
  { code: 43, code1: 0, key: "Matrix Light Mode +", icon: "/KeyType/matrix_screen_mode_plus.svg" },
  { code: 44, code1: 0, key: "Matrix Light Mode -", icon: "/KeyType/matrix_screen_mode_minus.svg" },
  { code: 45, code1: 0, key: "Matrix Light Hue +", icon: "/KeyType/matrix_screen_hue_plus.svg" },
  { code: 46, code1: 0, key: "Matrix Light Hue -", icon: "/KeyType/matrix_screen_hue_minus.svg" },
  { code: 47, code1: 0, key: "Matrix Light Bright +", icon: "/KeyType/matrix_screen_bright_plus.svg" },
  { code: 48, code1: 0, key: "Matrix Light Bright -", icon: "/KeyType/matrix_screen_bright_minus.svg" },
  { code: 49, code1: 0, key: "Matrix Light Speed +", icon: "/KeyType/matrix_screen_speed_plus.svg" },
  { code: 50, code1: 0, key: "Matrix Light Speed -", icon: "/KeyType/matrix_screen_speed_minus.svg" },
  { code: 51, code1: 0, key: "Reset", icon: "/KeyType/custom_kye_reset.svg" },
  { code: 52, code1: 0, key: "BLE Mode 1", icon: "/KeyType/custom_mode_ble1.svg" },
  { code: 53, code1: 0, key: "BLE Mode 2", icon: "/KeyType/custom_mode_ble2.svg" },
  { code: 54, code1: 0, key: "BLE Mode 3", icon: "/KeyType/custom_mode_ble3.svg" },
  { code: 55, code1: 0, key: "2.4G Mode", icon: "/KeyType/custom_mode_2p4g.svg" },
  { code: 56, code1: 0, key: "USB Mode", icon: "/KeyType/custom_mode_usb.svg" },
  { code: 57, code1: 0, key: "Battery Status", icon: "/KeyType/custom_batt_status.svg" },
  { code: 58, code1: 0, key: "6K/NK Toggle", icon: "/KeyType/custom_kye_six_nch.svg" },
  { code: 59, code1: 0, key: "Win Toggle", icon: "/KeyType/custom_kye_macwin_toggle.svg" },
  { code: 59, code1: 1, key: "MAC/Win Toggle", icon: "/KeyType/custom_kye_macwin_toggle.svg" },
  { code: 60, code1: 0, key: "Win Lock Toggle", icon: "/KeyType/custom_kye_win_lock_set.svg" },
  { code: 61, code1: 0, key: "WASD Toggle", icon: "🎮" },
  { code: 62, code1: 0, key: "Key Delay Toggle", icon: "⏳" },
  { code: 63, code1: 0, key: "F-Row Mode Toggle", icon: "🅵" },
  { code: 64, code1: 0, key: "Wheel Function Toggle", icon: "🎡" },
  { code: 65, code1: 0, key: "All Power Toggle", icon: "⚡" },
  { code: 66, code1: 0, key: "LCD Power Toggle", icon: "📺🔌" },
  { code: 67, code1: 0, key: "LCD Mode Toggle", icon: "📺⚙️" },
  { code: 68, code1: 0, key: "LCD GIF Mode Toggle", icon: "🎞️" },
  { code: 69, code1: 0, key: "LCD USB Toggle", icon: "📺🔌" },
  { code: 70, code1: 0, key: "Wheel Left", icon: "⬅️🎡" },
  { code: 71, code1: 0, key: "Wheel Right", icon: "➡️🎡" },
  { code: 72, code1: 0, key: "Wheel Confirm", icon: "✔️🎡" },
  { code: 73, code1: 0, key: "Test Mode", icon: "🧪" }
];
// V1版本
const formerCustom = [
  { code: 1, code1: 0, key: "MO0", icon: "FN_0" },
  { code: 2, code1: 0, key: "MO1", icon: "FN_1" },
  { code: 3, code1: 0, key: "MO2", icon: "FN_2" },
  { code: 4, code1: 0, key: "MO3", icon: "FN_3" },
  { code: 5, code1: 0, key: "TO0", icon: "TO_0" },
  { code: 6, code1: 0, key: "TO1", icon: "TO_1" },
  { code: 7, code1: 0, key: "TO2", icon: "TO_2" },
  { code: 8, code1: 0, key: "TO3", icon: "TO_3" },
  { code: 9, code1: 0, key: "BL_TOG", icon: "💡" },
  { code: 10, code1: 0, key: "BL_MOD", icon: "💡➕" },
  { code: 11, code1: 0, key: "BL_RMOD", icon: "💡➖" },
  { code: 12, code1: 0, key: "BL_HUI", icon: "🌈➕" },
  { code: 13, code1: 0, key: "BL_HUD", icon: "🌈➖" },
  { code: 14, code1: 0, key: "BL_VAI", icon: "🔆➕" },
  { code: 15, code1: 0, key: "BL_VAD", icon: "🔆➖" },
  { code: 16, code1: 0, key: "BL_SPI", icon: "⚡➕" },
  { code: 17, code1: 0, key: "BL_SPD", icon: "⚡➖" },
  { code: 18, code1: 0, key: "BL_DEFINE1", icon: "✨1" },
  { code: 19, code1: 0, key: "BL_DEFINE2", icon: "✨2" },
  { code: 20, code1: 0, key: "BL_DEFINE3", icon: "✨3" },
  { code: 21, code1: 0, key: "BL_DEFINE4", icon: "✨4" },
  { code: 22, code1: 0, key: "BL_DEFINE5", icon: "✨5" },
  { code: 23, code1: 0, key: "LG_TOG", icon: "💡🔆" },
  { code: 24, code1: 0, key: "LG_MOD", icon: "💡🔆➕" },
  { code: 25, code1: 0, key: "LG_RMOD", icon: "💡🔆➖" },
  { code: 26, code1: 0, key: "LG_HUI", icon: "🌈🔆➕" },
  { code: 27, code1: 0, key: "LG_HUD", icon: "🌈🔆➖" },
  { code: 28, code1: 0, key: "LG_VAI", icon: "🔆🔆➕" },
  { code: 29, code1: 0, key: "LG_VAD", icon: "🔆🔆➖" },
  { code: 30, code1: 0, key: "LG_SPI", icon: "⚡🔆➕" },
  { code: 31, code1: 0, key: "LG_SPD", icon: "⚡🔆➖" },
  { code: 32, code1: 0, key: "SD_TOG", icon: "💡➡️" },
  { code: 33, code1: 0, key: "SD_MOD", icon: "➡️➕" },
  { code: 34, code1: 0, key: "SD_RMOD", icon: "➡️➖" },
  { code: 35, code1: 0, key: "SD_HUI", icon: "🌈➡️➕" },
  { code: 36, code1: 0, key: "SD_HUD", icon: "🌈➡️➖" },
  { code: 37, code1: 0, key: "SD_VAI", icon: "🔆➡️➕" },
  { code: 38, code1: 0, key: "SD_VAD", icon: "🔆➡️➖" },
  { code: 39, code1: 0, key: "SD_SPI", icon: "⚡➡️➕" },
  { code: 40, code1: 0, key: "SD_SPD", icon: "⚡➡️➖" },
  { code: 41, code1: 0, key: "KYE_RESET", icon: "/KeyType/custom_kye_reset.svg" },
  { code: 42, code1: 0, key: "MODE_BLE1", icon: "/KeyType/custom_mode_ble1.svg" },
  { code: 43, code1: 0, key: "MODE_BLE2", icon: "/KeyType/custom_mode_ble2.svg" },
  { code: 44, code1: 0, key: "MODE_BLE3", icon: "/KeyType/custom_mode_ble3.svg" },
  { code: 45, code1: 0, key: "MODE_2P4G", icon: "/KeyType/custom_mode_2p4g.svg" },
  { code: 46, code1: 0, key: "MODE_USB", icon: "/KeyType/custom_mode_usb.svg" },
  { code: 47, code1: 0, key: "BATT_STATUS", icon: "/KeyType/custom_batt_status.svg" },
  { code: 48, code1: 0, key: "KYE_SIX_NCH", icon: "/KeyType/custom_kye_six_nch.svg" },
  { code: 49, code1: 0, key: "KYE_MAC_WINCH", icon: "/KeyType/custom_kye_macwin_toggle.svg" },
  { code: 50, code1: 0, key: "KYE_WIN_LOCK_SET", icon: "/KeyType/custom_kye_win_lock_set.svg" },
  { code: 51, code1: 0, key: "KYE_WASD_SET", icon: "🆆🅰️🆂🅳" },
  { code: 52, code1: 0, key: "KYE_SCAK_DELAY_SET", icon: "⏱️" }
];
const singleCustom = [
  { code: 1, code1: 0, key: "Fn0", icon: "FN_0" },
  { code: 2, code1: 0, key: "Fn1", icon: "FN_1" },
  { code: 3, code1: 0, key: "Fn2", icon: "FN_2" },
  { code: 4, code1: 0, key: "Fn3", icon: "FN_3" },
  { code: 5, code1: 0, key: "To0", icon: "TO_0" },
  { code: 6, code1: 0, key: "To1", icon: "TO_1" },
  { code: 7, code1: 0, key: "To2", icon: "TO_2" },
  { code: 8, code1: 0, key: "To3", icon: "TO_3" },
  { code: 9, code1: 0, key: "Key Light Toggle", icon: "💡" },
  { code: 10, code1: 0, key: "Key Light Mode +", icon: "💡➕" },
  { code: 11, code1: 0, key: "Key Light Mode -", icon: "💡➖" },
  { code: 12, code1: 0, key: "Key Light Hue +", icon: "🌈➕" },
  { code: 13, code1: 0, key: "Key Light Hue -", icon: "🌈➖" },
  { code: 14, code1: 0, key: "Key Light Bright +", icon: "🔆➕" },
  { code: 15, code1: 0, key: "Key Light Bright -", icon: "🔆➖" },
  { code: 16, code1: 0, key: "Key Light Speed +", icon: "⚡➕" },
  { code: 17, code1: 0, key: "Key Light Speed -", icon: "⚡➖" },
  { code: 19, code1: 0, key: "Custom Light 1   ", icon: "✨1️⃣" },
  { code: 20, code1: 0, key: "Logo Light Toggle", icon: "💡🔆" },
  { code: 21, code1: 0, key: "Logo Light Mode +", icon: "💡🔆➕" },
  { code: 22, code1: 0, key: "Logo Light Mode -", icon: "💡🔆➖" },
  { code: 23, code1: 0, key: "Logo Light Hue +", icon: "🌈🔆➕" },
  { code: 24, code1: 0, key: "Logo Light Hue -", icon: "🌈🔆➖" },
  { code: 25, code1: 0, key: "Logo Light Bright +", icon: "🔆🔆➕" },
  { code: 26, code1: 0, key: "Logo Light Bright -", icon: "🔆🔆➖" },
  { code: 27, code1: 0, key: "Logo Light Speed +", icon: "⚡🔆➕" },
  { code: 28, code1: 0, key: "Logo Light Speed -", icon: "⚡🔆➖" },
  { code: 29, code1: 0, key: "Side Light Toggle", icon: "💡➡️" },
  { code: 30, code1: 0, key: "Side Light Mode", icon: "➡️➕" },
  { code: 31, code1: 0, key: "Side Light Mode -", icon: "➡️➖" },
  { code: 32, code1: 0, key: "Side Light Hue +", icon: "🌈➡️➕" },
  { code: 33, code1: 0, key: "Side Light Hue -", icon: "🌈➡️➖" },
  { code: 34, code1: 0, key: "Side Light Bright +", icon: "🔆➡️➕" },
  { code: 35, code1: 0, key: "Side Light Bright -", icon: "🔆➡️➖" },
  { code: 36, code1: 0, key: "Side Light Speed +", icon: "⚡➡️➕" },
  { code: 37, code1: 0, key: "Side Light Speed -", icon: "⚡➡️➖" },

  { code: 38, code1: 0, key: "Reset", icon: "/KeyType/custom_kye_reset.svg" },
  { code: 39, code1: 0, key: "6K/NK Toggle", icon: "/KeyType/custom_kye_six_nch.svg" },
  { code: 40, code1: 0, key: "MAC/Win Toggle", icon: "/KeyType/custom_kye_macwin_toggle.svg" },
  { code: 41, code1: 0, key: "Win Lock Toggle", icon: "/KeyType/custom_kye_win_lock_set.svg" },
  { code: 42, code1: 0, key: "WASD Toggle", icon: "🆆🅰️🆂🅳" },
  { code: 43, code1: 0, key: "Key Delay Toggle", icon: "⏱️" },
  { code: 44, code1: 0, key: "F-Row Mode Toggle", icon: "⚙️" },
  { code: 45, code1: 0, key: "KYE_CHANGE_FLAG", icon: "🔁" },
  { code: 46, code1: 0, key: "BL_RTOG", icon: "💡🔄" }
]
const mouseKeys = [
  { "type": 32, "code1": 0, "code2": 1, "name": "Left Button", "icon": "/KeyType/mouse_left_button.svg" },
  { "type": 32, "code1": 0, "code2": 2, "name": "Right Button", "icon": "/KeyType/mouse_right_button.svg" },
  { "type": 32, "code1": 0, "code2": 4, "name": "Middle Button", "icon": "/KeyType/mouse_middle_button.svg" },
  { "type": 32, "code1": 5, "code2": 1, "name": "Scroll Up", "icon": "/KeyType/mouse_scroll_up.svg" },
  { "type": 32, "code1": 6, "code2": 1, "name": "Scroll Down", "icon": "/KeyType/mouse_scroll_down.svg" },
  { "type": 32, "code1": 0, "code2": 8, "name": "Forward", "icon": "/KeyType/mouse_forward.svg" },
  { "type": 32, "code1": 0, "code2": 16, "name": "Backward", "icon": "/KeyType/mouse_backward.svg" }
]
const mediaKeys = [
  { code: 131, code1: 0, key: "Player" },
  { code: 233, code1: 0, key: "Volume +", icon: "/KeyType/media_volume_plus.svg" },
  { code: 234, code1: 0, key: "Volume -", icon: "/KeyType/media_volume_minus.svg" },
  { code: 226, code1: 0, key: "Mute", icon: "/KeyType/media_mute.svg" },
  { code: 205, code1: 0, key: "Play", icon: "/KeyType/media_play_pause.svg" },
  { code: 183, code1: 0, key: "Stop", icon: "/KeyType/media_stop.svg" },
  { code: 182, code1: 0, key: "Prev Track", icon: "/KeyType/media_prev_track.svg" },
  { code: 181, code1: 0, key: "Next Track", icon: "/KeyType/media_next_track.svg" },
  { code: 131, code1: 1, key: "Multimedia", icon: "/KeyType/media_multimedia.svg" },
  { code: 111, code1: 0, key: "Screen Bright+", icon: "/KeyType/media_screen_bright_plus.svg" },
  { code: 112, code1: 0, key: "Screen Bright-", icon: "/KeyType/media_screen_bright_minus.svg" },
  { code: 35, code1: 2, key: "Homepage", icon: "/KeyType/media_homepage.svg" },
  { code: 39, code1: 2, key: "Web-Refresh", icon: "/KeyType/media_web_refresh.svg" },
  { code: 38, code1: 2, key: "Web-Stop", icon: "/KeyType/media_web_stop.svg" },
  { code: 37, code1: 2, key: "Web-Forward", icon: "/KeyType/media_web_forward.svg" },
  { code: 36, code1: 2, key: "Web-Backward", icon: "/KeyType/media_web_backward.svg" },
  { code: 42, code1: 2, key: "Web-Favorites", icon: "/KeyType/media_web_favorites.svg" },
  { code: 33, code1: 2, key: "Web-Search", icon: "/KeyType/media_web_search.svg" },
  { code: 146, code1: 1, key: "Calculator", icon: "/KeyType/media_calculator.svg" },
  { code: 148, code1: 1, key: "My Computer", icon: "/KeyType/media_my_computer.svg" },
  { code: 138, code1: 1, key: "Mail", icon: "/KeyType/media_mail.svg" },
  { code: 207, code1: 0, key: "Siri" },
  { code: 160, code1: 0, key: "Launchpad" },
  { code: 188, code1: 0, key: "Rewind" },
  { code: 187, code1: 0, key: "Fast Forward" },
  { code: 175, code1: 0, key: "Select" },
  { code: 176, code1: 0, key: "Eject" },
];
export const getKeyName = (key) => {
  if (key.type === 0x10) {
    const localizedKeyName = getLocalizedKeyName(key.code2);
    if (key.code1) {
      const modifiers = getSideModifierNames(key.code1);
      return [...modifiers, localizedKeyName].join("");
    }
    return localizedKeyName;
  }
  else if (key.type === 0x12) {
    const localizedKeyName = getLocalizedKeyName(key.code2);
    if (key.code1) {
      const modifiers = getSideModifierNames(key.code1);
      return [...modifiers, localizedKeyName].join("");
    }
    return localizedKeyName;
  }
  else if (key.type === 0x60 || key.type === 0x61) {
    return "M" + (key.code1 + 1);
  }
  else if (key.type === 0x20) {
    const lang = getCurrentLanguage();
    if (key.code1 == 0x81) {
      return lang.startsWith('de') ? "Ein/Aus" : "Power";
    }
    else if (key.code1 == 0x82) {
      return lang.startsWith('de') ? "Ruhezustand" : "Sleep";
    }
    else if (key.code1 == 0x83) {
      return lang.startsWith('de') ? "Aufwecken" : "WakeUp";
    }
  }
  else if (key.type == 0x40) {
    const kbKey = mouseKeys.find((mouseKey) => mouseKey.code1 == key.code1 && mouseKey.code2 == key.code2);
    return kbKey ? (kbKey.icon ? kbKey.icon : kbKey.name) : "";
  }
  else if (key.type === 0x30) {
    const kbKey = mediaKeys.find(
      (customKey) =>
        customKey.code === key.code1 && customKey.code1 === key.code2
    );

    return kbKey ? (kbKey.icon ? kbKey.icon : kbKey.key) : "";
  }
  else if (key.type === 0x50) {
    const keyboardMode = localStorage.getItem("keyboardMode") as any;
    const kbKey = ([singleCustom, formerCustom, customKeys][keyboardMode] || customKeys).find(
      (customKey) =>
        customKey.code === key.code1 && customKey.code1 === key.code2
    );

    return kbKey ? kbKey.icon ? kbKey.icon : kbKey.key : "";
  }

  return "";
};

export const getKeyCode = (type, code1, code2) => {
  let code = 0;
  if (type === 0x10) {
    code = code2;
    if (code1 != 0) {
      switch (code1) {
        case 0x01:
          code = 0xe0;
          break;
        case 0x02:
          code = 0xe1;
          break;
        case 0x04:
          code = 0xe2;
          break;
        case 0x08:
          code = 0xe3;
          break;
        case 0x10:
          code = 0xe4;
          break;
        case 0x20:
          code = 0xe5;
          break;
        case 0x40:
          code = 0xe6;
          break;
        case 0x80:
          code = 0xe7;
          break;
        default:
          break;
      }
    }
  } else if (type == 0x50) {
    if (code1 == 0x01) {
      code = 0xae;
    }
    else if (code1 == 0x02) {
      code = 0xaf;
    }
    else if (code1 == 0x03) {
      code = 0xb0;
    }
    else if (code1 == 0x04) {
      code = 0xb1;
    }
    else if (code1 == 0x05) {
      code = 0xb2;
    }
    else if (code1 == 0x06) {
      code = 0xb3;
    }
    else if (code1 == 0x07) {
      code = 0xb4;
    }
  } else if (type == 0x30) {
    switch (code1) {
      case 0x92:
        code = 0x194;
        break;
      case 226:
        code = 0x191;
        break;
      default: code1
        code = code1
        break;

    }
  }
  return code;
};
