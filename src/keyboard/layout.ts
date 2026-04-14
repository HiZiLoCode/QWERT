import { KeyboardKey, KeyLayout } from "../types/types";

export const scaleRect = (sw: number, sh: number, dw: number, dh: number) => {
  return dw / dh < sw / sh
    ? { w: dw, h: (dw * sh) / sw, s: dw / sw }
    : { w: (dh * sw) / sh, h: dh, s: dh / sh };
};

export const initKeyboardKey = (
  keyLayout: KeyLayout[],
  keys: KeyboardKey[],
  defaultKeys: KeyboardKey[],
  userKeys: KeyboardKey[]
) => {
  return keys.map((code, index) => {
    const defaultIndex = defaultKeys.findIndex((key) => diffKey(key, code));
    if (defaultIndex == -1) {
      return {
        ...keyLayout[index],
        default_key: code,
        key: code,
        index,
        name: code.name,
      };
    } else {
      return {
        ...keyLayout[index],
        default_key: defaultKeys[defaultIndex],
        key: userKeys[defaultIndex],
        index: defaultIndex,
      };
    }
  });
};

const diffKey = (key: KeyboardKey, key1: KeyboardKey) => {
  return (
    key.type == key1.type && key.code1 == key1.code1 && key.code2 == key1.code2
  );
};
