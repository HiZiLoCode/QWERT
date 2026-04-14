// standalone-matrix-to-key-info.ts
// 完全独立版本：不依赖当前项目的任何 hook / 函数 / 库

/** 描述单个物理按键（来自键盘布局） */
export interface SimpleKeyDef {
  w: number;
  h: number;
  x: number;
  y: number;
  row: number;
  col: number;
  encoderId?: number;
}

/** 输出的结构 */
export interface MatrixKeyInfo {
  code: string;
  name: string;
  key: string;
  row: number;
  col: number;
  w: number;
  h: number;
  x: number;
  y: number;
  index: number;
  encoderId?: number;
}

// code -> byte 映射（与 keyboard-demo/lib/keycode-parser.ts basicKeyToByte 完全一致）
const CODE_TO_BYTE: Record<string, number> = {
  // Quantum 范围
  _QK_MODS: 0x0100, _QK_MODS_MAX: 0x1fff,
  _QK_MOD_TAP: 0x6000, _QK_MOD_TAP_MAX: 0x7fff,
  _QK_LAYER_TAP: 0x4000, _QK_LAYER_TAP_MAX: 0x4fff,
  _QK_LAYER_MOD: 0x5900, _QK_LAYER_MOD_MAX: 0x59ff,
  _QK_TO: 0x5010, _QK_TO_MAX: 0x501f,
  _QK_MOMENTARY: 0x5100, _QK_MOMENTARY_MAX: 0x511f,
  _QK_DEF_LAYER: 0x5200, _QK_DEF_LAYER_MAX: 0x521f,
  _QK_TOGGLE_LAYER: 0x5300, _QK_TOGGLE_LAYER_MAX: 0x531f,
  _QK_ONE_SHOT_LAYER: 0x5400, _QK_ONE_SHOT_LAYER_MAX: 0x541f,
  _QK_ONE_SHOT_MOD: 0x5500, _QK_ONE_SHOT_MOD_MAX: 0x55ff,
  _QK_LAYER_TAP_TOGGLE: 0x5800, _QK_LAYER_TAP_TOGGLE_MAX: 0x581f,
  _QK_LAYER_MOD_MASK: 0x0f,
  _QK_MACRO: 0x7700, _QK_MACRO_MAX: 0x777f,
  _QK_KB: 0x7e00, _QK_KB_MAX: 0x7eff,
  // 基础按键
  KC_NO: 0x0000, KC_TRNS: 0x0001,
  KC_A: 0x0004, KC_B: 0x0005, KC_C: 0x0006, KC_D: 0x0007,
  KC_E: 0x0008, KC_F: 0x0009, KC_G: 0x000a, KC_H: 0x000b,
  KC_I: 0x000c, KC_J: 0x000d, KC_K: 0x000e, KC_L: 0x000f,
  KC_M: 0x0010, KC_N: 0x0011, KC_O: 0x0012, KC_P: 0x0013,
  KC_Q: 0x0014, KC_R: 0x0015, KC_S: 0x0016, KC_T: 0x0017,
  KC_U: 0x0018, KC_V: 0x0019, KC_W: 0x001a, KC_X: 0x001b,
  KC_Y: 0x001c, KC_Z: 0x001d,
  KC_1: 0x001e, KC_2: 0x001f, KC_3: 0x0020, KC_4: 0x0021,
  KC_5: 0x0022, KC_6: 0x0023, KC_7: 0x0024, KC_8: 0x0025,
  KC_9: 0x0026, KC_0: 0x0027,
  KC_ENT: 0x0028, KC_ESC: 0x0029, KC_BSPC: 0x002a, KC_TAB: 0x002b,
  KC_SPC: 0x002c, KC_MINS: 0x002d, KC_EQL: 0x002e,
  KC_LBRC: 0x002f, KC_RBRC: 0x0030, KC_BSLS: 0x0031,
  KC_NUHS: 0x0032, KC_SCLN: 0x0033, KC_QUOT: 0x0034,
  KC_GRV: 0x0035, KC_COMM: 0x0036, KC_DOT: 0x0037, KC_SLSH: 0x0038,
  KC_CAPS: 0x0039,
  KC_F1: 0x003a, KC_F2: 0x003b, KC_F3: 0x003c, KC_F4: 0x003d,
  KC_F5: 0x003e, KC_F6: 0x003f, KC_F7: 0x0040, KC_F8: 0x0041,
  KC_F9: 0x0042, KC_F10: 0x0043, KC_F11: 0x0044, KC_F12: 0x0045,
  KC_PSCR: 0x0046, KC_SLCK: 0x0047, KC_PAUS: 0x0048,
  KC_INS: 0x0049, KC_HOME: 0x004a, KC_PGUP: 0x004b,
  KC_DEL: 0x004c, KC_END: 0x004d, KC_PGDN: 0x004e,
  KC_RGHT: 0x004f, KC_LEFT: 0x0050, KC_DOWN: 0x0051, KC_UP: 0x0052,
  KC_NLCK: 0x0053, KC_PSLS: 0x0054, KC_PAST: 0x0055,
  KC_PMNS: 0x0056, KC_PPLS: 0x0057, KC_PENT: 0x0058,
  KC_P1: 0x0059, KC_P2: 0x005a, KC_P3: 0x005b, KC_P4: 0x005c,
  KC_P5: 0x005d, KC_P6: 0x005e, KC_P7: 0x005f, KC_P8: 0x0060,
  KC_P9: 0x0061, KC_P0: 0x0062, KC_PDOT: 0x0063,
  KC_NUBS: 0x0064, KC_APP: 0x0065, KC_POWER: 0x0066, KC_PEQL: 0x0067,
  KC_F13: 0x0068, KC_F14: 0x0069, KC_F15: 0x006a, KC_F16: 0x006b,
  KC_F17: 0x006c, KC_F18: 0x006d, KC_F19: 0x006e, KC_F20: 0x006f,
  KC_F21: 0x0070, KC_F22: 0x0071, KC_F23: 0x0072, KC_F24: 0x0073,
  KC_EXECUTE: 0x0074, KC_HELP: 0x0075, KC_MENU: 0x0076,
  KC_SELECT: 0x0077, KC_STOP: 0x0078, KC_AGAIN: 0x0079,
  KC_UNDO: 0x007a, KC_CUT: 0x007b, KC_COPY: 0x007c,
  KC_PASTE: 0x007d, KC_FIND: 0x007e,
  KC_LCAP: 0x0082, KC_LNUM: 0x0083, KC_LSCR: 0x0084,
  KC_PCMM: 0x0085, KC_KP_EQUAL_AS400: 0x0086,
  KC_RO: 0x0087, KC_KANA: 0x0088, KC_JYEN: 0x0089,
  KC_HENK: 0x008a, KC_MHEN: 0x008b,
  KC_INT6: 0x008c, KC_INT7: 0x008d, KC_INT8: 0x008e, KC_INT9: 0x008f,
  KC_HAEN: 0x0090, KC_HANJ: 0x0091,
  KC_LANG3: 0x0092, KC_LANG4: 0x0093, KC_LANG5: 0x0094,
  KC_LANG6: 0x0095, KC_LANG7: 0x0096, KC_LANG8: 0x0097, KC_LANG9: 0x0098,
  KC_ERAS: 0x0099, KC_SYSREQ: 0x009a, KC_CANCEL: 0x009b,
  KC_CLR: 0x009c, KC_CLEAR: 0x009c, KC_PRIOR: 0x009d,
  KC_OUT: 0x00a0, KC_OPER: 0x00a1, KC_CLEAR_AGAIN: 0x00a2,
  KC_CRSEL: 0x00a3, KC_EXSEL: 0x00a4,
  KC_PWR: 0x00a5, KC_SLEP: 0x00a6, KC_WAKE: 0x00a7,
  KC_MUTE: 0x00a8, KC_VOLU: 0x00a9, KC_VOLD: 0x00aa,
  KC_MNXT: 0x00ab, KC_MPRV: 0x00ac, KC_MSTP: 0x00ad, KC_MPLY: 0x00ae,
  KC_MSEL: 0x00af, KC_EJCT: 0x00b0, KC_MAIL: 0x00b1,
  KC_CALC: 0x00b2, KC_MYCM: 0x00b3,
  KC_WWW_SEARCH: 0x00b4, KC_WWW_HOME: 0x00b5, KC_WWW_BACK: 0x00b6,
  KC_WWW_FORWARD: 0x00b7, KC_WWW_STOP: 0x00b8,
  KC_WWW_REFRESH: 0x00b9, KC_WWW_FAVORITES: 0x00ba,
  KC_MFFD: 0x00bb, KC_MRWD: 0x00bc, KC_BRIU: 0x00bd, KC_BRID: 0x00be,
  // 鼠标键（keyboard-demo 值）
  KC_MS_UP: 0x00cd, KC_MS_DOWN: 0x00ce, KC_MS_LEFT: 0x00cf, KC_MS_RIGHT: 0x00d0,
  KC_MS_BTN1: 0x00d1, KC_MS_BTN2: 0x00d2, KC_MS_BTN3: 0x00d3,
  KC_MS_BTN4: 0x00d4, KC_MS_BTN5: 0x00d5,
  KC_MS_BTN6: 0x00d6, KC_MS_BTN7: 0x00d7, KC_MS_BTN8: 0x00d8,
  KC_MS_WH_UP: 0x00d9, KC_MS_WH_DOWN: 0x00da,
  KC_MS_WH_LEFT: 0x00db, KC_MS_WH_RIGHT: 0x00dc,
  KC_MS_ACCEL0: 0x00dd, KC_MS_ACCEL1: 0x00de, KC_MS_ACCEL2: 0x00df,
  // 修饰键
  KC_LCTL: 0x00e0, KC_LSFT: 0x00e1, KC_LALT: 0x00e2, KC_LGUI: 0x00e3,
  KC_RCTL: 0x00e4, KC_RSFT: 0x00e5, KC_RALT: 0x00e6, KC_RGUI: 0x00e7,
  // 特殊按键（keyboard-demo v12 值）
  RESET: 0x7c00, DEBUG: 0x7c02, QK_CLEAR_EEPROM: 0x7c03,
  MAGIC_TOGGLE_NKRO: 0x7013,
  MAGIC_SWAP_LCTL_LGUI: 0x7017, MAGIC_UNSWAP_LCTL_LGUI: 0x7018,
  MAGIC_SWAP_RCTL_RGUI: 0x7019, MAGIC_UNSWAP_RCTL_RGUI: 0x701a,
  MAGIC_SWAP_CTL_GUI: 0x701b, MAGIC_UNSWAP_CTL_GUI: 0x701c,
  MAGIC_TOGGLE_CTL_GUI: 0x701d,
  MAGIC_EE_HANDS_LEFT: 0x701e, MAGIC_EE_HANDS_RIGHT: 0x701f,
  KC_GESC: 0x7c16, VLK_TOG: 0x7c17,
  KC_LCPO: 0x7c18, KC_RCPC: 0x7c19,
  KC_LSPO: 0x7c1a, KC_RSPC: 0x7c1b,
  KC_LAPO: 0x7c1c, KC_RAPC: 0x7c1d,
  KC_SFTENT: 0x7c1e,
  OUT_AUTO: 0x7c20, OUT_USB: 0x7c21,
  KC_ASUP: 0x7c11, KC_ASDN: 0x7c10, KC_ASRP: 0x7c12,
  KC_ASTG: 0x7c15, KC_ASON: 0x7c13, KC_ASOFF: 0x7c14,
  // 背光（keyboard-demo 值）
  BL_ON: 0x7800, BL_OFF: 0x7801, BL_TOGG: 0x7802,
  BL_DEC: 0x7803, BL_INC: 0x7804, BL_STEP: 0x7805, BL_BRTG: 0x7806,
  // RGB（keyboard-demo 值）
  RGB_TOG: 0x7820, RGB_MOD: 0x7821, RGB_RMOD: 0x7822,
  RGB_HUI: 0x7823, RGB_HUD: 0x7824, RGB_SAI: 0x7825, RGB_SAD: 0x7826,
  RGB_VAI: 0x7827, RGB_VAD: 0x7828, RGB_SPI: 0x7829, RGB_SPD: 0x782a,
  RGB_M_P: 0x782b, RGB_M_B: 0x782c, RGB_M_R: 0x782d,
  RGB_M_SW: 0x782e, RGB_M_SN: 0x782f, RGB_M_K: 0x7830,
  RGB_M_X: 0x7831, RGB_M_G: 0x7832, RGB_MODE_RGBTEST: 0x7833,
  // WT Lighting
  BR_INC: 0x5f00, BR_DEC: 0x5f01, EF_INC: 0x5f02, EF_DEC: 0x5f03,
  ES_INC: 0x5f04, ES_DEC: 0x5f05,
  H1_INC: 0x5f06, H1_DEC: 0x5f07, S1_INC: 0x5f08, S1_DEC: 0x5f09,
  H2_INC: 0x5f0a, H2_DEC: 0x5f0b, S2_INC: 0x5f0c, S2_DEC: 0x5f0d,
  FN_MO13: 0x7c77, FN_MO23: 0x7c78,
  // 音频（keyboard-demo 值）
  AU_ON: 0x7480, AU_OFF: 0x7481, AU_TOG: 0x7482,
  CLICKY_TOGGLE: 0x748a, CLICKY_ENABLE: 0x748b, CLICKY_DISABLE: 0x748c,
  CLICKY_UP: 0x748d, CLICKY_DOWN: 0x748e, CLICKY_RESET: 0x748f,
  MU_ON: 0x7490, MU_OFF: 0x7491, MU_TOG: 0x7492, MU_MOD: 0x7493,
  // Haptic
  HPT_ON: 0x7c40, HPT_OFF: 0x7c41, HPT_TOG: 0x7c42, HPT_RST: 0x7c43,
  HPT_FBK: 0x7c44, HPT_BUZ: 0x7c45, HPT_MODI: 0x7c46, HPT_MODD: 0x7c47,
  HPT_CONT: 0x7c48, HPT_CONI: 0x7c49, HPT_COND: 0x7c4a,
  HPT_DWLI: 0x7c4b, HPT_DWLD: 0x7c4c,
  // Combos
  CMB_ON: 0x7c50, CMB_OFF: 0x7c51, CMB_TOG: 0x7c52,
  // Dynamic Macros
  DYN_REC_START1: 0x7c53, DYN_REC_START2: 0x7c54, DYN_REC_STOP: 0x7c55,
  DYN_MACRO_PLAY1: 0x7c56, DYN_MACRO_PLAY2: 0x7c57,
};

// byte -> code 反转映射
const BYTE_TO_CODE: Record<number, string> = Object.entries(CODE_TO_BYTE).reduce(
  (acc, [code, byte]) => { acc[byte as number] = code; return acc; },
  {} as Record<number, string>,
);

// ============================================================
// 自定义按键（customKeycodes）支持
// ============================================================

/** 当前键盘定义的自定义按键列表（由调用方注入） */
let _customKeycodes: Array<{ name: string; title: string; shortName: string }> | null = null;

/** 注入自定义按键表（在加载键盘定义后调用） */
export function setCustomKeycodes(
  keycodes: Array<{ name: string; title: string; shortName: string }> | null | undefined
) {
  _customKeycodes = keycodes ?? null;
}

/** 清除自定义按键表 */
export function clearCustomKeycodes() {
  _customKeycodes = null;
}

// QK_KB 范围（与 keyboard-demo 一致）
const QK_KB     = 0x7e00;
const QK_KB_MAX = 0x7eff;

function _getCustomKeycodeName(byte: number): string | null {
  if (!_customKeycodes || byte < QK_KB || byte > QK_KB_MAX) return null;
  const index = byte - QK_KB;
  if (index >= _customKeycodes.length) return null;
  const kc = _customKeycodes[index];
  return kc.shortName || kc.name || null;
}

// ============================================================
// 完整按键显示名称表（参考 keyboard-demo/lib/keycode-names.ts）
// ============================================================
const KEYCODE_DISPLAY_NAMES: Record<string, string> = {
  KC_NO: '', KC_TRNS: '▽',
  // 字母（单字母直接大写显示）
  KC_A:'A',KC_B:'B',KC_C:'C',KC_D:'D',KC_E:'E',KC_F:'F',KC_G:'G',KC_H:'H',
  KC_I:'I',KC_J:'J',KC_K:'K',KC_L:'L',KC_M:'M',KC_N:'N',KC_O:'O',KC_P:'P',
  KC_Q:'Q',KC_R:'R',KC_S:'S',KC_T:'T',KC_U:'U',KC_V:'V',KC_W:'W',KC_X:'X',
  KC_Y:'Y',KC_Z:'Z',
  // 数字行（带 Shift 符号双行显示）
  KC_1:'!\n1',KC_2:'@\n2',KC_3:'#\n3',KC_4:'$\n4',KC_5:'%\n5',
  KC_6:'^\n6',KC_7:'&\n7',KC_8:'*\n8',KC_9:'(\n9',KC_0:')\n0',
  // 符号键
  KC_MINS:'_\n-',KC_EQL:'+\n=',KC_GRV:'~\n`',
  KC_LBRC:'{\n[',KC_RBRC:'}\n]',KC_BSLS:'|\\\n\\\\',
  KC_NUHS:'#\n~',KC_SCLN:':\n;',KC_QUOT:'"\n\'',
  KC_COMM:'<\n,',KC_DOT:'>\n.',KC_SLSH:'?\n/',KC_NUBS:'|\n\\',
  // 功能键
  KC_ESC:'Esc',KC_F1:'F1',KC_F2:'F2',KC_F3:'F3',KC_F4:'F4',
  KC_F5:'F5',KC_F6:'F6',KC_F7:'F7',KC_F8:'F8',KC_F9:'F9',
  KC_F10:'F10',KC_F11:'F11',KC_F12:'F12',
  KC_F13:'F13',KC_F14:'F14',KC_F15:'F15',KC_F16:'F16',
  KC_F17:'F17',KC_F18:'F18',KC_F19:'F19',KC_F20:'F20',
  KC_F21:'F21',KC_F22:'F22',KC_F23:'F23',KC_F24:'F24',
  // 编辑键
  KC_PSCR:'PrtSc',KC_SLCK:'ScrLk',KC_PAUS:'Pause',
  KC_INS:'Ins',KC_HOME:'Home',KC_PGUP:'PgUp',
  KC_DEL:'Del',KC_END:'End',KC_PGDN:'PgDn',
  KC_RGHT:'→',KC_LEFT:'←',KC_DOWN:'↓',KC_UP:'↑',
  // 主要键
  KC_TAB:'Tab',KC_BSPC:'Bksp',KC_ENT:'Enter',KC_SPC:'Space',KC_CAPS:'Caps',KC_APP:'Menu',
  // 小键盘 — 显示为普通数字/符号（与 keyboard-demo 一致）
  KC_NLCK:'Num\nLock',
  KC_PSLS:'/',KC_PAST:'*',KC_PMNS:'-',KC_PPLS:'+',
  KC_PENT:'Num\nEnt',
  KC_P0:'0',KC_P1:'1',KC_P2:'2',KC_P3:'3',KC_P4:'4',
  KC_P5:'5',KC_P6:'6',KC_P7:'7',KC_P8:'8',KC_P9:'9',
  KC_PDOT:'.',KC_PEQL:'=',KC_PCMM:',',
  // 修饰键
  KC_LCTL:'LCtrl',KC_LSFT:'LShift',KC_LALT:'LAlt',KC_LGUI:'LWin',
  KC_RCTL:'RCtrl',KC_RSFT:'RShift',KC_RALT:'RAlt',KC_RGUI:'RWin',
  // 媒体键
  KC_MUTE:'Mute',KC_VOLU:'Vol+',KC_VOLD:'Vol-',
  KC_MNXT:'Next',KC_MPRV:'Prev',KC_MSTP:'Stop',KC_MPLY:'Play',
  KC_MSEL:'Select',KC_EJCT:'Eject',KC_MAIL:'Mail',KC_CALC:'Calc',
  KC_MYCM:'MyPC',KC_MFFD:'FFwd',KC_MRWD:'Rwd',
  KC_WWW_SEARCH:'Search',KC_WWW_HOME:'WWW\nHome',KC_WWW_BACK:'Back',
  KC_WWW_FORWARD:'Fwd',KC_WWW_STOP:'WWW\nStop',
  KC_WWW_REFRESH:'Refresh',KC_WWW_FAVORITES:'Fav',
  // 电源
  KC_PWR:'Power',KC_POWER:'Power',KC_SLEP:'Sleep',KC_WAKE:'Wake',
  KC_BRIU:'Bri+',KC_BRID:'Bri-',
  // QMK 特殊键
  KC_GESC:'Esc/`',KC_LSPO:'LS(',KC_RSPC:'RS)',
  KC_LCPO:'LC(',KC_RCPC:'RC)',KC_LAPO:'LA(',KC_RAPC:'RA(',
  KC_SFTENT:'Sft\nEnt',
  // 鼠标
  KC_MS_UP:'Ms↑',KC_MS_DOWN:'Ms↓',KC_MS_LEFT:'Ms←',KC_MS_RIGHT:'Ms→',
  KC_MS_BTN1:'Btn1',KC_MS_BTN2:'Btn2',KC_MS_BTN3:'Btn3',
  KC_MS_BTN4:'Btn4',KC_MS_BTN5:'Btn5',KC_MS_BTN6:'Btn6',
  KC_MS_BTN7:'Btn7',KC_MS_BTN8:'Btn8',
  KC_MS_WH_UP:'Wh↑',KC_MS_WH_DOWN:'Wh↓',
  KC_MS_WH_LEFT:'Wh←',KC_MS_WH_RIGHT:'Wh→',
  KC_MS_ACCEL0:'Acc0',KC_MS_ACCEL1:'Acc1',KC_MS_ACCEL2:'Acc2',
  // 系统/功能
  RESET:'Reset',DEBUG:'Debug',MAGIC_TOGGLE_NKRO:'NKRO',
  // 背光
  BL_ON:'BL On',BL_OFF:'BL Off',BL_DEC:'BL-',BL_INC:'BL+',
  BL_TOGG:'BL Tog',BL_STEP:'BL Step',BL_BRTG:'BR Tog',
  // RGB
  RGB_TOG:'RGB\nTog',RGB_MOD:'RGB\nMod+',RGB_RMOD:'RGB\nMod-',
  RGB_HUI:'RGB\nHue+',RGB_HUD:'RGB\nHue-',
  RGB_SAI:'RGB\nSat+',RGB_SAD:'RGB\nSat-',
  RGB_VAI:'RGB\nBri+',RGB_VAD:'RGB\nBri-',
  RGB_SPI:'RGB\nSpd+',RGB_SPD:'RGB\nSpd-',
  RGB_M_P:'RGB\nPlain',RGB_M_B:'RGB\nBreathe',
  RGB_M_R:'RGB\nRainbow',RGB_M_SW:'RGB\nSwirl',
  RGB_M_SN:'RGB\nSnake',RGB_M_K:'RGB\nKnight',
  RGB_M_X:'RGB\nXmas',RGB_M_G:'RGB\nGrad',
  // WT Lighting
  BR_INC:'BR+',BR_DEC:'BR-',EF_INC:'EF+',EF_DEC:'EF-',
  ES_INC:'ES+',ES_DEC:'ES-',
  H1_INC:'H1+',H1_DEC:'H1-',S1_INC:'S1+',S1_DEC:'S1-',
  H2_INC:'H2+',H2_DEC:'H2-',S2_INC:'S2+',S2_DEC:'S2-',
  FN_MO13:'Fn1(3)',FN_MO23:'Fn2(3)',
  // 音频
  AU_ON:'Au On',AU_OFF:'Au Off',AU_TOG:'Au Tog',
  CLICKY_TOGGLE:'Clk Tog',CLICKY_ENABLE:'Clk On',CLICKY_DISABLE:'Clk Off',
  CLICKY_UP:'Clk+',CLICKY_DOWN:'Clk-',CLICKY_RESET:'Clk Rst',
  MU_ON:'Mus On',MU_OFF:'Mus Off',MU_TOG:'Mus Tog',MU_MOD:'Mus Mod',
  // 国际键
  KC_KANA:'かな',KC_JYEN:'¥',KC_HENK:'変換',KC_MHEN:'無変換',
  KC_HAEN:'한영',KC_HANJ:'漢字',KC_RO:'Ro',
  // 编辑/系统
  KC_UNDO:'Undo',KC_CUT:'Cut',KC_COPY:'Copy',KC_PASTE:'Paste',
  KC_FIND:'Find',KC_AGAIN:'Again',KC_HELP:'Help',
  KC_EXECUTE:'Exec',KC_ERAS:'AltErs',KC_SYSREQ:'SysRq',
  KC_CANCEL:'Cancel',KC_CLEAR:'Clear',KC_PRIOR:'Prior',
  KC_CRSEL:'CrSel',KC_EXSEL:'ExSel',
};

// Shift 组合键显示名称
const SHIFT_DISPLAY_NAMES: Record<string, string> = {
  'S(KC_GRV)':'~','S(KC_1)':'!','S(KC_2)':'@','S(KC_3)':'#',
  'S(KC_4)':'$','S(KC_5)':'%','S(KC_6)':'^','S(KC_7)':'&',
  'S(KC_8)':'*','S(KC_9)':'(','S(KC_0)':')',
  'S(KC_MINS)':'_','S(KC_EQL)':'+',
  'S(KC_LBRC)':'{','S(KC_RBRC)':'}','S(KC_BSLS)':'|',
  'S(KC_SCLN)':':','S(KC_QUOT)':'"',
  'S(KC_COMM)':'<','S(KC_DOT)':'>','S(KC_SLSH)':'?',
  'LSFT(KC_GRV)':'~','LSFT(KC_1)':'!','LSFT(KC_2)':'@',
  'LSFT(KC_3)':'#','LSFT(KC_4)':'$','LSFT(KC_5)':'%',
  'LSFT(KC_6)':'^','LSFT(KC_7)':'&','LSFT(KC_8)':'*',
  'LSFT(KC_9)':'(','LSFT(KC_0)':')',
  'LSFT(KC_MINS)':'_','LSFT(KC_EQL)':'+',
  'LSFT(KC_COMM)':'<','LSFT(KC_DOT)':'>','LSFT(KC_SLSH)':'?',
};

// ============================================================
// 高级按键解析（ported from keyboard-demo/lib/advanced-keys.ts）
// ============================================================
// 与 keyboard-demo basicKeyToByte 完全对齐的范围常量
const _QK_MODS             = 0x0100; const _QK_MODS_MAX             = 0x1fff;
const _QK_MOD_TAP          = 0x6000; const _QK_MOD_TAP_MAX          = 0x7fff;
const _QK_LAYER_TAP        = 0x4000; const _QK_LAYER_TAP_MAX        = 0x4fff;
const _QK_LAYER_MOD        = 0x5900; const _QK_LAYER_MOD_MAX        = 0x59ff;
const _QK_TO               = 0x5010; const _QK_TO_MAX               = 0x501f;
const _QK_MOMENTARY        = 0x5100; const _QK_MOMENTARY_MAX        = 0x511f;
const _QK_DEF_LAYER        = 0x5200; const _QK_DEF_LAYER_MAX        = 0x521f;
const _QK_TOGGLE_LAYER     = 0x5300; const _QK_TOGGLE_LAYER_MAX     = 0x531f;
const _QK_ONE_SHOT_LAYER   = 0x5400; const _QK_ONE_SHOT_LAYER_MAX   = 0x541f;
const _QK_ONE_SHOT_MOD     = 0x5500; const _QK_ONE_SHOT_MOD_MAX     = 0x55ff;
const _QK_LAYER_TAP_TOGGLE = 0x5800; const _QK_LAYER_TAP_TOGGLE_MAX = 0x581f;
const _QK_LAYER_MOD_MASK   = 0x0f;
// QMK v12+ 使用 0x7700/0x7e00（与 VIA v12 一致）
const _QK_MACRO_V12        = 0x7700; const _QK_MACRO_V12_MAX        = 0x777f;
const _QK_KB_V12           = 0x7e00; const _QK_KB_V12_MAX           = 0x7eff;
// QMK v11 使用 0x7702/0x7f00（与 VIA v11 一致）
const _QK_MACRO_V11        = 0x7702; const _QK_MACRO_V11_MAX        = 0x7711;
const _QK_KB_V11           = 0x7f00; const _QK_KB_V11_MAX           = 0x7fff;
// QMK v10 使用 0x5f12/0x5f80（与 VIA v10 一致）
const _QK_MACRO_V10        = 0x5f12; const _QK_MACRO_V10_MAX        = 0x5f21;
const _QK_KB_V10           = 0x5f80; const _QK_KB_V10_MAX           = 0x5f8f;

const _MOD_LCTL = 0x0100; const _MOD_LSFT = 0x0200;
const _MOD_LALT = 0x0400; const _MOD_LGUI = 0x0800;
const _MOD_RCTL = 0x1100; const _MOD_RSFT = 0x1200;
const _MOD_RALT = 0x1400; const _MOD_RGUI = 0x1800;
const _MOD_RMODS_MIN = 0x1000;

const _modValToKey: Record<number, string> = {
  [_MOD_LCTL]:'LCTL',[_MOD_LSFT]:'LSFT',[_MOD_LALT]:'LALT',[_MOD_LGUI]:'LGUI',
  [_MOD_RCTL]:'RCTL',[_MOD_RSFT]:'RSFT',[_MOD_RALT]:'RALT',[_MOD_RGUI]:'RGUI',
  [_MOD_LSFT|_MOD_LGUI]:'SGUI',
  [_MOD_LALT|_MOD_LGUI]:'LAG',
  [_MOD_LCTL|_MOD_LALT]:'LCA',
  [_MOD_LSFT|_MOD_LALT]:'LSA',
  [_MOD_LCTL|_MOD_LALT|_MOD_LGUI]:'LCAG',
  [_MOD_LCTL|_MOD_LALT|_MOD_LSFT]:'MEH',
  [_MOD_LCTL|_MOD_LALT|_MOD_LSFT|_MOD_LGUI]:'HYPR',
};

const _modMaskBits: [number, string][] = [
  [0x01,'LCTL'],[0x02,'LSFT'],[0x04,'LALT'],[0x08,'LGUI'],
  [0x11,'RCTL'],[0x12,'RSFT'],[0x14,'RALT'],[0x18,'RGUI'],
];

function _modMaskToString(mask: number): string {
  if (_modValToKey[mask]) return _modValToKey[mask];
  const parts: string[] = [];
  for (const [v, k] of _modMaskBits) {
    if ((v & mask) === v) parts.push(k);
  }
  return parts.length ? parts.join('|') : `0x${mask.toString(16)}`;
}

function _topLevelModToString(byte: number): string {
  const kc = BYTE_TO_CODE[byte & 0x00ff] ?? `0x${(byte & 0xff).toString(16).toUpperCase()}`;
  const modV = byte & 0x1f00;
  if (_modValToKey[modV]) return `${_modValToKey[modV]}(${kc})`;
  const isRight = !!(modV & _MOD_RMODS_MIN);
  const candidates: [number, string][] = isRight
    ? [[_MOD_RCTL,'RCTL'],[_MOD_RSFT,'RSFT'],[_MOD_RALT,'RALT'],[_MOD_RGUI,'RGUI']]
    : [[_MOD_LCTL,'LCTL'],[_MOD_LSFT,'LSFT'],[_MOD_LALT,'LALT'],[_MOD_LGUI,'LGUI']];
  const enabled = candidates.filter(([m]) => (m & modV) === m).map(([,n]) => n);
  if (!enabled.length) return `0x${byte.toString(16).toUpperCase()}`;
  return enabled.join('(') + '(' + kc + ')'.repeat(enabled.length);
}

function _advancedKeycodeToString(byte: number): string | null {
  // ⚠️ 重要：MACRO/CUSTOM 的检查必须在 MT 之前！
  // 因为 MT 的范围 (0x6000-0x7fff) 包含了 MACRO v12 (0x7700-0x777f)
  
  // Macro / Custom (支持 v10/v11/v12 三个版本) - 必须最先检查！
  // v12: 0x7700-0x777f
  if (byte >= _QK_MACRO_V12 && byte <= _QK_MACRO_V12_MAX) return `MACRO(${byte - _QK_MACRO_V12})`;
  if (byte >= _QK_KB_V12    && byte <= _QK_KB_V12_MAX)    return `CUSTOM(${byte - _QK_KB_V12})`;
  // v11: 0x7702-0x7711
  if (byte >= _QK_MACRO_V11 && byte <= _QK_MACRO_V11_MAX) return `MACRO(${byte - _QK_MACRO_V11})`;
  if (byte >= _QK_KB_V11    && byte <= _QK_KB_V11_MAX)    return `CUSTOM(${byte - _QK_KB_V11})`;
  // v10: 0x5f12-0x5f21
  if (byte >= _QK_MACRO_V10 && byte <= _QK_MACRO_V10_MAX) return `MACRO(${byte - _QK_MACRO_V10})`;
  if (byte >= _QK_KB_V10    && byte <= _QK_KB_V10_MAX)    return `CUSTOM(${byte - _QK_KB_V10})`;
  
  // 特殊兼容：某些固件使用 0x5220 起作为 MO(n) 范围（keyboard-demo 特殊处理）
  if (byte >= 0x5220 && byte <= 0x5249) {
    const layer = byte - 0x5220;
    return `MO(${layer})`;
  }
  // QK_MODS: modifier + basic key (Shift, Ctrl, Alt, GUI combos)
  if (byte >= _QK_MODS && byte <= _QK_MODS_MAX)
    return _topLevelModToString(byte);
  // LT(layer, kc): layer tap
  if (byte >= _QK_LAYER_TAP && byte <= _QK_LAYER_TAP_MAX) {
    const layer = (byte >> 8) & 0xf;
    const kc = BYTE_TO_CODE[byte & 0xff] ?? `0x${(byte & 0xff).toString(16).toUpperCase()}`;
    return `LT(${layer},${kc})`;
  }
  // MT(mod, kc): mod tap - 必须在 MACRO 之后检查！
  if (byte >= _QK_MOD_TAP && byte <= _QK_MOD_TAP_MAX) {
    const mod = (byte >> 8) & 0x1f;
    const kc = BYTE_TO_CODE[byte & 0xff] ?? `0x${(byte & 0xff).toString(16).toUpperCase()}`;
    return `MT(${_modMaskToString(mod)},${kc})`;
  }
  // LM(layer, mod)
  if (byte >= _QK_LAYER_MOD && byte <= _QK_LAYER_MOD_MAX) {
    const shift = Math.log2(_QK_LAYER_MOD_MASK + 1);
    const rem = byte & ~_QK_LAYER_MOD;
    const layer = rem >> shift;
    const mod = rem & _QK_LAYER_MOD_MASK;
    return `LM(${layer},${_modMaskToString(mod)})`;
  }
  // OSM(mod): one-shot mod
  if (byte >= _QK_ONE_SHOT_MOD && byte <= _QK_ONE_SHOT_MOD_MAX)
    return `OSM(${_modMaskToString(byte & ~_QK_ONE_SHOT_MOD)})`;
  // Simple layer keys
  if (byte >= _QK_MOMENTARY        && byte <= _QK_MOMENTARY_MAX)        return `MO(${byte - _QK_MOMENTARY})`;
  if (byte >= _QK_DEF_LAYER        && byte <= _QK_DEF_LAYER_MAX)        return `DF(${byte - _QK_DEF_LAYER})`;
  if (byte >= _QK_TOGGLE_LAYER     && byte <= _QK_TOGGLE_LAYER_MAX)     return `TG(${byte - _QK_TOGGLE_LAYER})`;
  if (byte >= _QK_ONE_SHOT_LAYER   && byte <= _QK_ONE_SHOT_LAYER_MAX)   return `OSL(${byte - _QK_ONE_SHOT_LAYER})`;
  if (byte >= _QK_LAYER_TAP_TOGGLE && byte <= _QK_LAYER_TAP_TOGGLE_MAX) return `TT(${byte - _QK_LAYER_TAP_TOGGLE})`;
  if (byte >= _QK_TO               && byte <= _QK_TO_MAX)               return `TO(${byte - _QK_TO})`;
  return null;
}

/** 把 code 字符串转成人类可读的短标签（参考 keyboard-demo getKeycodeName） */
function _codeToDisplayName(code: string): string {
  // 1. 直接命中完整名称表
  if (code in KEYCODE_DISPLAY_NAMES) return KEYCODE_DISPLAY_NAMES[code];
  // 2. Shift 组合键
  if (code in SHIFT_DISPLAY_NAMES) return SHIFT_DISPLAY_NAMES[code];
  // 3. 十六进制未知键
  if (code.startsWith('0x')) return code;
  // 4. 层切换 MO/DF/TG/OSL/TT/TO
  for (const [prefix, label] of [
    ['MO','Fn'],['DF','DF'],['TG','TG'],['OSL','OSL'],['TT','TT'],['TO','TO'],
  ] as const) {
    const m = code.match(new RegExp(`^${prefix}\\((\\d+)\\)$`));
    if (m) return `${label}${m[1]}`;
  }
  // 5. LT(layer, kc)
  const lt = code.match(/^LT\((\d+),(.+)\)$/);
  if (lt) {
    const kc = _codeToDisplayName(lt[2]);
    return `LT${lt[1]}\n${kc}`;
  }
  // 6. MT(mod, kc)
  const mt = code.match(/^MT\((.+),(.+)\)$/);
  if (mt) {
    const mod = mt[1].replace(/MOD_/g,'').replace(/\|/g,'/');
    const kc = _codeToDisplayName(mt[2]);
    return `${mod}\n${kc}`;
  }
  // 7. LM(layer, mod)
  const lm = code.match(/^LM\((\d+),(.+)\)$/);
  if (lm) return `LM${lm[1]}\n${lm[2].replace(/MOD_/g,'')}`;
  // 8. OSM(mod)
  const osm = code.match(/^OSM\((.+)\)$/);
  if (osm) return `OSM\n${osm[1].replace(/MOD_/g,'')}`;
  // 9. S(kc) / LSFT(kc)
  const s = code.match(/^(?:S|LSFT)\((.+)\)$/);
  if (s) return `S(${_codeToDisplayName(s[1])})`;
  // 10. MACRO(n)
  const mac = code.match(/^MACRO\((\d+)\)$/);
  if (mac) return `M${mac[1]}`;
  // 11. CUSTOM(n)
  const cust = code.match(/^CUSTOM\((\d+)\)$/);
  if (cust) return `C${cust[1]}`;
  // 12. 修饰键组合 LCTL(x), LSFT(x), HYPR(x), MEH(x) 等
  const modCombo = code.match(/^(HYPR|MEH|LCAG|LSG|LAG|RSG|RAG|LCA|LSA|RSA|RCS|LCTL|LSFT|LALT|LGUI|RCTL|RSFT|RALT|RGUI|C|A|G)\((.+)\)$/);
  if (modCombo) {
    const mod = modCombo[1];
    const kc = _codeToDisplayName(modCombo[2]);
    return `${mod}\n${kc}`;
  }
  // 13. 去掉 KC_ 前缀，下划线换空格
  if (code.startsWith('KC_')) return code.replace(/^KC_/, '').replace(/_/g, ' ');
  return code.replace(/_/g, ' ');
}

/** 根据 16bit keycode(byte) 得到 {code, name} */
function decodeKeycode(byte: number): {code: string; name: string} {
  // 0) 空键
  if (byte === 0x0000) return { code: 'KC_NO', name: '' };
  // 1) 透传
  if (byte === 0x0001) return { code: 'KC_TRNS', name: '▽' };

  // 2) 自定义按键（customKeycodes，QK_KB 范围，与 keyboard-demo 一致）
  const customName = _getCustomKeycodeName(byte);
  if (customName !== null) {
    const idx = byte - QK_KB;
    return { code: `CUSTOM(${idx})`, name: customName };
  }

  // 3) 直接查基础按键表
  const directCode = BYTE_TO_CODE[byte];
  if (directCode && !directCode.startsWith('_QK')) {
    const name = _codeToDisplayName(directCode);
    return { code: directCode, name };
  }

  // 4) 高级按键解析（MT/LT/MO/TG/OSL/OSM/LM/TT/TO/DF/MACRO/CUSTOM/Mod+Key）
  const advanced = _advancedKeycodeToString(byte);
  if (advanced) {
    // 调试日志：输出宏按键的解析结果
    if (advanced.startsWith('MACRO(')) {
      console.log(`[keyLabelUtils] 解析宏按键: 0x${byte.toString(16).toUpperCase()} -> ${advanced} -> ${_codeToDisplayName(advanced)}`);
    }
    return { code: advanced, name: _codeToDisplayName(advanced) };
  }

  // 5) 未知按键：显示十六进制
  const hex = '0x' + byte.toString(16).toUpperCase().padStart(4, '0');
  console.warn(`[keyLabelUtils] 未知按键: 0x${byte.toString(16).toUpperCase()}`);
  return { code: hex, name: hex };
}

/**
 * 从 VIA definition 的 `layouts.keymap` 中提取"实际存在的按键坐标集合"，并为每个坐标生成显示用的尺寸/位置。
 * 说明：layouts.keymap 里只包含"物理存在的键"，矩阵中的空洞（没有焊键的位置）不会出现。
 */
function buildKeyDefMapFromLayoutKeymap(layoutKeymap: any[][]): Map<string, SimpleKeyDef> {
  const byMatrixIndex = new Map<string, SimpleKeyDef>();

  // KLE/VIA cursor semantics (matches @the-via/reader behaviour):
  // - xCursor resets to 0 at the start of each row
  // - yCursor is GLOBAL and persists across rows; at end of each row it advances by 1
  // - { x: N } is a DELTA added to xCursor
  // - { y: N } is a DELTA added to yCursor (can be negative, e.g. y:-1 to go back up)
  // - { w, h } set the dimensions for the NEXT key only, then reset to 1
    let xCursor = 0;
  let yCursor = 0;
    let currentW = 1;
    let currentH = 1;

  layoutKeymap.forEach((rowEntries) => {
    xCursor = 0;

    for (const entry of rowEntries) {
      if (typeof entry === "string") {
        const firstLine = entry.split("\n")[0].trim();
        const parts = firstLine.split(",");
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (Number.isNaN(r) || Number.isNaN(c)) {
          xCursor += currentW;
          currentW = 1;
          currentH = 1;
          continue;
        }
        const encoderMatch = entry.match(/\be(\d+)\b/i);
        const encoderId = encoderMatch ? parseInt(encoderMatch[1], 10) : undefined;
        const key: SimpleKeyDef = {
          w: currentW, h: currentH, x: xCursor, y: yCursor, row: r, col: c,
          ...(encoderId !== undefined ? { encoderId } : {}),
        };
        byMatrixIndex.set(`${r},${c}`, key);
        xCursor += currentW;
        currentW = 1;
        currentH = 1;
      } else if (entry && typeof entry === "object") {
        if (typeof entry.x === "number") xCursor += entry.x;
        if (typeof entry.y === "number") yCursor += entry.y;
        if (typeof entry.w === "number") currentW = entry.w;
        if (typeof entry.h === "number") currentH = entry.h;
      }
    }
    yCursor += 1;
  });

  return byMatrixIndex;
}

/**
 * 把设备返回的"矩阵序" keycodes 解析成可渲染的按键数组，并过滤掉 JSON 中不存在的矩阵空洞。
 */
function buildMatrixKeyInfoFromMatrix(
  keycodes: number[],
  layoutKeymap: any[][],
  matrix: { rows: number; cols: number }
): MatrixKeyInfo[] {
  const defMap = buildKeyDefMapFromLayoutKeymap(layoutKeymap);
  const { cols } = matrix;

  const result: MatrixKeyInfo[] = [];
  for (let index = 0; index < keycodes.length; index++) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const def = defMap.get(`${row},${col}`);
    if (!def) continue;
    const byte = keycodes[index];
    const { code, name } = decodeKeycode(byte);
    
    // 调试日志：输出所有宏按键的解析结果
    if ((byte >= 0x5f12 && byte <= 0x5f21) || 
        (byte >= 0x7702 && byte <= 0x7711) || 
        (byte >= 0x7700 && byte <= 0x777f)) {
      const version = byte >= 0x7700 && byte <= 0x777f ? 'v12' :
                      byte >= 0x7702 && byte <= 0x7711 ? 'v11' : 'v10';
      console.log(`[buildMatrixKeyInfo] ${version}宏: row=${row}, col=${col}, byte=0x${byte.toString(16).toUpperCase()} -> ${code} -> ${name}`);
    }
    
    result.push({
      code, name,
      key: `${code}-${row}-${col}`,
      row, col,
      w: def.w, h: def.h, x: def.x, y: def.y,
      index,
      ...(def.encoderId !== undefined ? { encoderId: def.encoderId } : {}),
    });
  }
  return result;
}

/**
 * 内部主函数：把从键盘读出的 16bit keycode 数组 + 物理键定义数组
 * 转成带 code/key/name/row/col/x/y/w/h/index 的对象数组。
 */
function buildMatrixKeyInfoStandalone(
  keycodes: number[],
  keyDefs: SimpleKeyDef[],
): MatrixKeyInfo[] {
  return keycodes.map((byte, index) => {
    const def = keyDefs[index];
    const {code, name} = decodeKeycode(byte);
    const row = def?.row ?? -1;
    const col = def?.col ?? -1;
    return {
      code, name,
      key: `${code}-${row}-${col}`,
      row, col,
      w: def?.w ?? 1, h: def?.h ?? 1,
      x: def?.x ?? 0, y: def?.y ?? 0,
      index,
    };
  });
}

/**
 * 根据 VIA definition 里的 `layouts.keymap` 结构，
 * 自动计算每个矩阵坐标对应的 `w / h / x / y`，生成 SimpleKeyDef 数组。
 */
function buildSimpleKeyDefsFromLayoutKeymap(
  layoutKeymap: any[][],
): SimpleKeyDef[] {
  const byMatrixIndex = new Map<string, SimpleKeyDef>();
  let xCursor = 0;
  let yCursor = 0;
  let currentW = 1;
  let currentH = 1;

  layoutKeymap.forEach((rowEntries) => {
    xCursor = 0;
    for (const entry of rowEntries) {
      if (typeof entry === 'string') {
        const firstLine = entry.split('\n')[0].trim();
        const parts = firstLine.split(',');
        const r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (Number.isNaN(r) || Number.isNaN(c)) {
          xCursor += currentW; currentW = 1; currentH = 1; continue;
        }
        const encoderMatch = entry.match(/\be(\d+)\b/i);
        const encoderId = encoderMatch ? parseInt(encoderMatch[1], 10) : undefined;
        const key: SimpleKeyDef = {
          w: currentW, h: currentH, x: xCursor, y: yCursor, row: r, col: c,
          ...(encoderId !== undefined ? { encoderId } : {}),
        };
        byMatrixIndex.set(`${r},${c}`, key);
        xCursor += currentW; currentW = 1; currentH = 1;
      } else if (entry && typeof entry === 'object') {
        if (typeof entry.x === 'number') xCursor += entry.x;
        if (typeof entry.y === 'number') yCursor += entry.y;
        if (typeof entry.w === 'number') currentW = entry.w;
        if (typeof entry.h === 'number') currentH = entry.h;
      }
    }
    yCursor += 1;
  });

  let maxRow = 0;
  let maxCol = 0;
  for (const key of byMatrixIndex.keys()) {
    const [rStr, cStr] = key.split(',');
    const r = parseInt(rStr, 10);
    const c = parseInt(cStr, 10);
    if (!Number.isNaN(r) && r > maxRow) maxRow = r;
    if (!Number.isNaN(c) && c > maxCol) maxCol = c;
  }

  const result: SimpleKeyDef[] = [];
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const key = `${r},${c}`;
      const def = byMatrixIndex.get(key) ?? {w: 1, h: 1, x: 0, y: 0, row: r, col: c};
      result.push(def);
    }
  }
  return result;
}

/**
 * 对外唯一使用的函数：
 *
 * 传入：
 * - `keycodes`  : 从键盘读出的 16bit keycode 数组（按矩阵顺序）
 * - `layoutKeymap`: VIA JSON 里的 `layouts.keymap`
 *
 * 返回：
 * - 每个键的 { code, key, name, row, col, x, y, w, h, index }
 */
export function buildMatrixKeyInfo(
  keycodes: number | number[],
  layoutKeymap: any[][],
  matrix?: { rows: number; cols: number },
): MatrixKeyInfo[] {
  const keycodesArray = Array.isArray(keycodes) ? keycodes : [keycodes];

  if (matrix?.cols) {
    return buildMatrixKeyInfoFromMatrix(keycodesArray, layoutKeymap, matrix);
  }

  const keyDefs = buildSimpleKeyDefsFromLayoutKeymap(layoutKeymap);
  return buildMatrixKeyInfoStandalone(keycodesArray, keyDefs);
}
