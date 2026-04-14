import { KeyboardKey, ProfileContent } from "../types/types_v1";

export const emptyMacros = [
  { name: "M1", list: [] },
];

export const emptyProfile: ProfileContent = {
  detail: { name: "" },
  userKeys: {},
  travelKeys: [],
  light: {
    effect: 0,
    brightness: 4,
    speed: 4,
    sleep: 20,
    direct: 0,
    superRet: 0,
    light: 1,
  },
  globalTravel: { actuation: 2000, pressDeadzone: 1000, releaseDeadzone: 1000 },
  reportRate: 0,
  colorKeys: { 0: [] },
  advancedKeys: [],
  macro: emptyMacros,
};

export const emptyKey: KeyboardKey = {
  type: 0,
  code1: 0,
  code2: 0,
  code3: 0,
};

export const emptyColorKeys = new Array(92).fill("");
