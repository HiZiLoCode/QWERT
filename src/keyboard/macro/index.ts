import {
  ConnectedKeyboard,
  MacroAction,
  MacroProfile,
} from "@/types/types";
import { evtToCode, getByteToKey, getKeyCodeDict } from "../key-code/key2code";
import { useState } from "react";

export const initMcro = () => {
  if (window !== undefined) {
    const macroArr = window.localStorage.getItem("macro_arr");
    if (macroArr) {
      return JSON.parse(macroArr);
    }
  }
};

export const addMacroActionList = (
  actionList: MacroAction[],
  type: string,
  key: string | number,
  time: number
) => {
  if (type == "keydown" || type == "mousedown") {
    return [
      ...actionList,
      { key: key, type: type.slice(0, -4), down_delay: time, up_delay: -1 },
    ];
  } else {
    return actionList.map((action) => {
      if (action.key == key && action.up_delay == -1) {
        return { ...action, up_delay: time };
      } else {
        return action;
      }
    });
  }
};

// export const parseMacro = (macroData: number[], macroCount: number, kbVersion: number) => {
//     const macroArr: Macro[] = [...Array(macroCount)].map((_, i) => {return {name: 'M'+i, list: []}});
//     let macroActionList:MacroAction[] = [];
//     const byteToKey = getByteToKey(getKeyCodeDict(kbVersion));
//     const initMacroArr = macroArr.map((item) => {
//         let d = 0;
//         let t = [];
//         do {
//             d = macroData?.shift() || 0;
//             t.push(d);
//         } while (d != 0);

//         let i = 0;
//         macroActionList = [];
//         const macroAction:MacroAction = {key: 0, action: '', time: 0, delay: 0};
//         while(t[i] != 0 && t[i] != undefined) {
//             if (t[i] == 1) {
//                 if (t[i+1] == 2) {
//                     macroAction.action = 'keydown';
//                     macroAction.key = t[i+2];
//                 } else if(t[i+1] == 3) {
//                     macroAction.action = 'keyup';
//                     macroAction.key = t[i+2];
//                 }
//                 if (t[i+3] == 1 && t[i+4] == 4) {
//                     let delay = Array();
//                     while(t[5+i] >= 0x30 && t[5+i] < 0x40) {
//                         delay.push(t[5+i]-0x30)
//                         i = i + 1;
//                     }
//                     macroAction.delay = delay.length > 0 ? parseInt(delay.join('')) : 0;
//                     i = i + 6;
//                 } else {
//                     i = i + 3;
//                 }
//                 macroActionList.push({...macroAction});
//             }
//         }
//         return {...item, list: macroActionList};
//     })
//     return initMacroArr;
// }

// export const saveMacroToByte = (macro: Macro[]) => {
//     let data: number[] = [];
//     macro.map((item) => {
//         item.list.map((actionItem) => {
//             data.push(1);
//             if (actionItem.action == 'keydown') {
//                 data.push(2);
//             } else if (actionItem.action == 'keyup'){
//                 data.push(3);
//             }
//             data.push(actionItem.key)
//             if (actionItem?.delay) {
//                 data.push(1);
//                 data.push(4);
//                 actionItem.delay.toString().split('').map((i) => {
//                     data.push(parseInt(i)+0x30);
//                 });
//                 data.push(0x7c);
//             }
//         })
//         data.push(0);
//     })
//     return data;
// }
