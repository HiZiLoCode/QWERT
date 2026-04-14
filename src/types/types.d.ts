import { KeyboardAPI } from "../keyboard/api"
import { LWKey, MatrixInfo } from "./types.common"

export type KeyboardDefinition = {
    name: string,
    vendorId: string,
    productId: string,
    firmwareVersion?: number,
    matrix: MatrixInfo,
    leyouts: {
        width: number,
        height: number,
        keys: LWKey[],
        optionKeys: {
            [m: string]: {
                [n: string]: LWKey[]
            }
        }
    }
}

export type Keymap = number[];
export type Layer = {
    keymap: Keymap;
    isLoaded: boolean;
};

export type DeviceInfo = {
    vendorId: number;
    productId: number;
    productName: string;
    protocol?: number;
};

export type Device = DeviceInfo & {
    address: string;
    productName: string;
    interface: number;
};

export type KBDevice = Device & {
    device: HIDDevice
}

export type WebHidDevice = Device & {
    _device: HIDDevice
}

export type AuthorizedDevice = DeviceInfo & {
    path: string;
    vendorProductId: number;
    protocol: number;
    hasResolvedDefinition: false;
};

export type ConnectedDevice = DeviceInfo & {
    path: string;
    vendorProductId: number;
    protocol: number;
    hasResolvedDefinition: true;
};

export type WebKbDevice = Device & {
    _device: HIDDevice;
};

export type KeyColor = {
    row: number,
    col: number,
    color?: string,
    h?: number,
    s?: number,
}

export type LightColor = {
    effect: number,
    custom: boolean,
    color?: string,
    keyColor?: KeyColor[]
}

export type SliderStep = {
    min: number,
    max: number,
    step: number,
}

export type KeyboardLighting = {
    speed: SliderStep,
    lightness: SliderStep
}

export type ConnectedKeyboard = {
    productName: string,
    vendorId: number,
    productId: number,
    api?: KeyboardAPI,
    macroCount: number,
    layer: number,
    matrix?: MatrixInfo,
    layouts?: KeyboardLayout,
    layoutMode?: string,
    version?: number,
    lighting?: KeyboardLighting,
    lightColor?: LightColor,
    keyCodeDict: Record<string, number>
}

export type EditItem = {
    action: string,
    oldValue: string,
    newValue: string
}

export type KeyItem = {
    row: number,
    col: number,
    w: number,
    h: number,
    x: number,
    y: number,
    rx: number,
    ry: number,
    d: boolean,
    w2?: number,
    h2?: number,
    x2?: number,
    y2?: number,
    ei?: number,
    color: string,
}

export type KeyCode = {
    code: string,
    name: string,
    key: number,
    color: string
}

export type TestKeyboardDefinition = KeyboardDefinition;

export type KbKey = {
    code: string,
    name: string,
}

export type KeyboardKey = {
    type: number,
    code1: number,
    code2: number,
    code3?: number,
    name?: string,
    index?: number
}

export type DKSKey = {
    key: KeyboardKey,
    downStart?: number,
    downEnd?: number,
    upStart?: number,
    upEnd?: number
}

export type AdvancedKeyItem = {
    type: string,
    index?: number,
    col?: number,
    row?: number,
    key?: KeyboardKey,
    mtDownKey?: KeyboardKey,
    mtClickKey?: KeyboardKey,
    mtTime?: number,
    dksPoint?: number[],
    dksKeys?: DKSKey[],
    socdKeys?: KeyboardKey[],
    tglKey?: KeyboardKey
}

//Macro

export type MacroAction = {
    key: string | number,
    type: string,
    down_delay: number,
    up_delay: number
}

export type MacroProfile = {
    name: string,
    list: MacroAction[]
}


export type KeyCodeItem = {
    name: string,
    code: string,
    title?: string | undefined,
    width?: number | undefined,
    shortName?: string | undefined,
    keys?: string | undefined,
}

export type KeyInfo = {
    type: number,
    code1: number,
    code2: number,
    code3: number,
    name?: string,
    lang?: string,
    index?: number
}



export type SliderConfig = {
    min: number,
    max: number,
    step: number
}

export type KeyLayout = {
    row: number,
    col: number,
    x: number,
    y: number,
    r: number,
    rx: number,
    ry: number,
    d: boolean,
    h: number,
    w: number,
    x2?: number,
    y2?: number,
    w2?: number,
    h2?: number,
    ei?: boolean,
    color: string,
    name?: string
}

// export type KeyboardLayout = {
//     name: string,
//     lighting: {
//         effect: Array<Array<string|number>>,
//         speed: SliderConfig,
//         brightness: SliderConfig
//     }
//     layouts: {
//         width: number,
//         height: number,
//         bg_width: number,
//         bg_height: number,
//         lg_bg_width: number,
//         lg_bg_height: number,
//         key_scale: number,
//         key_lg_scale: number,
//         key_index_max: number,
//         keys: KeyLayout[],
//         codes: KeyboardKey[],
//         matrix: {
//             rows: number,
//             cols: number
//         }
//     },
//     vendorProductId: number
// }

export type KeyboardLayoutKey = KeyLayout & { default_key: KeyboardKey, key: KeyboardKey, index: number }

export type KeyTrigger = {
    profile_id?: number,
    key_code?: number,
    switch_type: number,
    key_mode: number,
    key_max_length: number,
    key_actuation: number,
    rt_press: number,
    rt_release: number,
    deadzone_status?: number,
    press_deadzone: number,
    release_deadzone: number
}

export type KeyTravel = KeyTrigger;

export type useKeyboardReturnProps = {
    travelMultiSelect: Array<boolean>,
    remapSelectIndex: number,
    advancedKeys: AdvancedKeyItem[],
    setTravelSelect: Function,
    travelSelectAll: Function,
    travelUnselectAll: Function,
    travelRevSelect: Function,
    travelSelectIndex: Function,
    setRemapSelect: Function
    changeKeysTravel: Function,
    addAdvancedKey: Function,
    keysTravel: KeyTravel[]
}

export type AdvancedKey = {
    type: string,
    keys: KeyInfo[],
}

export type DeviceInfo = {
    vendorId: number;
    productId: number;
    productName: string;
    protocol?: number;
    ic_type?: number;
    firmware_version?: number;
    report_max?: number;
    charge_flag?: number;
    battery_value?: number;
    connect_status?: number;
};

export type FilterDevice = {
    vendorId?: number,
    productId?: number,
    usagePage: number,
    usage: number,
    setLighttMatrixCustomData?: (index: number, r: number, g: number, b: number) => Promise<void>;
    sendFrameData?: (r: number, g: number, b: number, rows: number, cols: number) => Promise<void>;
    resetDevice?: () => Promise<void>;
}

export type Device = DeviceInfo & {
    address: string;
    productName: string;
    interface: number;
};

export type MouseDevice = Device & {
    _device: HIDDevice;
};

export type WebHidDevice = Device & {
    _device: HIDDevice,
    reportId: number,
    reportSize: number,
    reportCount: number
}
export type screenInfo = {
    width: number;
    height: number;
    maxSereen: number;
}