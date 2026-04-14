import { useState } from "react";
import { MacroAction, MacroProfile } from "../types/types_v1";
import { getKeyCodeFromWebCode } from "../keyboard/keycode";

function useMacro() {
    const [macroProfiles, setMacroProfiles] = useState<MacroProfile[]>([])
    const [macroActions, setMacroAction] = useState<MacroAction[]>([]);
    const [selectedMacro, setSelectedMacro] = useState<MacroProfile>();
    const [newMacroIndex, setNewMacroIndex] = useState<number>(1);

  return {
    macroProfiles,
    setMacroProfiles,
    selectedMacro, 
    setSelectedMacro,
    macroActions,
    setMacroAction,
    newMacroIndex,
    setNewMacroIndex,

    initMacroAction: (macroActions: MacroAction[]) => {
      setMacroAction(macroActions);
    },

    addMacroAction: (action: string, webCode: string, time: number) => {
        const type = action.replace('down', '').replace('up', '');
        if (action == 'keydown') {
            const code = getKeyCodeFromWebCode(type, webCode);
            setMacroAction((macroActions) => {
                return [...macroActions, {
                    code,
                    webCode,
                    action: 1,
                    down_delay: time,
                    up_delay: -1
                }]
            });
        }
        if (action == 'mousedown') {
            const code = getKeyCodeFromWebCode(type, webCode);
            setMacroAction((macroActions) => {
                return [...macroActions, {
                    code,
                    webCode,
                    action: 3,
                    down_delay: time,
                    up_delay: -1
                }]
            });
        }

        if (action == 'keyup' || action == 'mouseup') { 
            setMacroAction((macroActions) => {
                return macroActions.map((macroAction) => {
                    if (macroAction.webCode == webCode && macroAction.up_delay == -1) {
                        return {...macroAction, up_delay: time};
                    }
                    return macroAction;
                })
            });
        }       
    },
    removeMacroAction: (index: number) => {
        macroActions.splice(index, 1);
        setMacroAction([...macroActions]);
    },
    setMacroAction
  };
}

export default useMacro;
