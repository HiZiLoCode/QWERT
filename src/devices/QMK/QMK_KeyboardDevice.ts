import { KeyboardAPI } from "../KeyboardAPI";
import { LightingParseRule, DEFAULT_LIGHTING_PARSE_RULE, PARSE_LIGHTING_GROUP } from "@/utils/fileConversion";
// VIA 命令 ID
import { tagDevice, WebHid } from "../WebHid";
import type { WebHidDevice } from "../../types/types";
import { LightingEffect } from "@/types/leyout";
const COMMAND_START = 0x00; // 这是 HID 报告 ID
const PER_KEY_RGB_CHANNEL_COMMAND = [0, 1];

// 定义 API 命令枚举
enum APICommand {
    GET_PROTOCOL_VERSION = 0x01, // 获取协议版本
    GET_KEYBOARD_VALUE = 0x02, // 获取键盘值
    SET_KEYBOARD_VALUE = 0x03, // 设置键盘值
    DYNAMIC_KEYMAP_GET_KEYCODE = 0x04, // 获取动态键盘映射的按键码
    DYNAMIC_KEYMAP_SET_KEYCODE = 0x05, // 设置动态键盘映射的按键码
    //  DYNAMIC_KEYMAP_CLEAR_ALL = 0x06,
    DYNAMIC_KEYMAP_CLEAR_ALL = 0x06, // 清空全部 keymap 为默认值
    CUSTOM_MENU_SET_VALUE = 0x07, // 设置自定义菜单的值
    CUSTOM_MENU_GET_VALUE = 0x08, // 获取自定义菜单的值
    CUSTOM_MENU_SAVE = 0x09, // 保存自定义菜单
    EEPROM_RESET = 0x0a, // 重置 EEPROM
    BOOTLOADER_JUMP = 0x0b, // 跳转到引导加载程序
    DYNAMIC_KEYMAP_MACRO_GET_COUNT = 0x0c, // 获取宏数量
    DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE = 0x0d, // 获取宏缓冲区大小
    DYNAMIC_KEYMAP_MACRO_GET_BUFFER = 0x0e, // 获取宏缓冲区
    DYNAMIC_KEYMAP_MACRO_SET_BUFFER = 0x0f, // 设置宏缓冲区
    DYNAMIC_KEYMAP_MACRO_RESET = 0x10, // 重置宏
    DYNAMIC_KEYMAP_GET_LAYER_COUNT = 0x11, // 获取动态键盘层数
    DYNAMIC_KEYMAP_GET_BUFFER = 0x12, // 获取键盘映射缓冲区
    DYNAMIC_KEYMAP_SET_BUFFER = 0x13, // 设置键盘映射缓冲区
    DYNAMIC_KEYMAP_GET_ENCODER = 0x14, // 获取旋转编码器的值
    DYNAMIC_KEYMAP_SET_ENCODER = 0x15, // 设置旋转编码器的值

    // 已废弃：
    BACKLIGHT_CONFIG_SET_VALUE = 0x07, // 设置背光配置
    BACKLIGHT_CONFIG_GET_VALUE = 0x08, // 获取背光配置
    BACKLIGHT_CONFIG_SAVE = 0x09, // 保存背光配置
}

// 将 API 命令值映射为命令名称
const APICommandValueToName = Object.entries(APICommand).reduce(
    (acc: any, [key, value]) => ({ ...acc, [value]: key }),
    {} as Record<APICommand, string>,
);

// 键盘值枚举
export enum KeyboardValue {
    UPTIME = 0x01, // 运行时间
    LAYOUT_OPTIONS = 0x02, // 布局选项
    SWITCH_MATRIX_STATE = 0x03, // 开关矩阵状态
    FIRMWARE_VERSION = 0x04, // 固件版本
    DEVICE_INDICATION = 0x05, // 设备指示灯
}
export const QMK_connectHID = async (
    mode: string = "demo",
    requestAuthorize?: boolean,
    selectedDevices?: WebHidDevice[]
): Promise<QMK_KeyboardDevice | undefined> => {
    // 检查 WebHID 支持
    const support = checkWebHIDSupport();

    if (!support.isSupported) {
        const errorMessage = `您的浏览器 (${support.browserName}) 不支持 WebHID。\n请使用 ${support.recommendedBrowser} 访问。`;
        throw new Error(errorMessage);
    }

    try {
        const devices = selectedDevices ?? await WebHid.devices(requestAuthorize);
        // devices.
        if (devices?.length > 0) {
            const keyboard = new QMK_KeyboardDevice(new KeyboardAPI(devices[0].address, 1));
            const version = await keyboard.getProtocolVersion();
            if (version !== -1 && version !== 0) {
                console.log(`当前键盘为QMK键盘,协议版本为V${version}`);
                keyboard.version = version;
                return keyboard;
            } else {
                undefined
            }
        }
    } catch (error) {
        // QMK 探测失败不应阻断后续“普通键盘”连接回退流程
        // 例如：用户取消授权弹窗、设备暂时忙、或该设备根本不是 QMK
        console.warn("[QMK] 探测/连接失败，将回退到普通键盘连接流程:", error);
        return undefined;
    }
};
// RGB Backlight Value IDs
// const BACKLIGHT_USE_SPLIT_BACKSPACE = 0x01;
// const BACKLIGHT_USE_SPLIT_LEFT_SHIFT = 0x02;
// const BACKLIGHT_USE_SPLIT_RIGHT_SHIFT = 0x03;
// const BACKLIGHT_USE_7U_SPACEBAR = 0x04;
// const BACKLIGHT_USE_ISO_ENTER = 0x05;
// const BACKLIGHT_DISABLE_HHKB_BLOCKER_LEDS = 0x06;
// const BACKLIGHT_DISABLE_WHEN_USB_SUSPENDEd = 0x07;
// const BACKLIGHT_DISABLE_AFTER_TIMEOUT = 0x08;
const BACKLIGHT_BRIGHTNESS = 0x09; // 背光亮度
const BACKLIGHT_EFFECT = 0x0a; // 背光效果
// const BACKLIGHT_EFFECT_SPEED = 0x0b;
const BACKLIGHT_COLOR_1 = 0x0c; // 背光颜色 1
const BACKLIGHT_COLOR_2 = 0x0d; // 背光颜色 2
// const BACKLIGHT_CAPS_LOCK_INDICATOR_COLOR = 0x0e;
// const BACKLIGHT_CAPS_LOCK_INDICATOR_ROW_Col = 0x0f;
// const BACKLIGHT_LAYER_1_INDICATOR_COLOR = 0x10;
// const BACKLIGHT_LAYER_1_INDICATOR_ROW_COL = 0x11;
// const BACKLIGHT_LAYER_2_INDICATOR_COLOR = 0x12;
// const BACKLIGHT_LAYER_2_INDICATOR_ROW_COL = 0x13;
// const BACKLIGHT_LAYER_3_INDICATOR_COLOR = 0x14;
// const BACKLIGHT_LAYER_3_INDICATOR_ROW_COL = 0x15;
// const BACKLIGHT_ALPHAS_MODS = 0x16;
const BACKLIGHT_CUSTOM_COLOR = 0x17; // 自定义背光颜色

// 定义协议版本
export const PROTOCOL_ALPHA = 7;
export const PROTOCOL_BETA = 8;
export const PROTOCOL_GAMMA = 9;

// 缓存已连接设备
const cache: { [addr: string]: { hid: any } } = {};

// 比较两个数组是否相等
const eqArr = <T>(arr1: T[], arr2: T[]) => {
    if (arr1.length !== arr2.length) {
        return false;
    }
    return arr1.every((val, idx) => arr2[idx] === val);
};

// 将 2 个字节转换为 16 位值
export const shiftTo16Bit = ([hi, lo]: [number, number]): number =>
    (hi << 8) | lo;

// 将 16 位值拆分为 2 个字节
export const shiftFrom16Bit = (value: number): [number, number] => [
    value >> 8,
    value & 255,
];

// 将缓冲区数据转换为 16 位值
const shiftBufferTo16Bit = (buffer: number[]): number[] => {
    const shiftedBuffer = [];
    for (let i = 0; i < buffer.length; i += 2) {
        shiftedBuffer.push(shiftTo16Bit([buffer[i], buffer[i + 1]]));
    }
    return shiftedBuffer;
};

// 将 16 位缓冲区数据转换为字节
const shiftBufferFrom16Bit = (buffer: number[]): number[] =>
    buffer.map(shiftFrom16Bit).flatMap((value) => value);
// 定义命令类型
type Command = number;
type HIDAddress = string;
type Layer = number;
type Row = number;
type Column = number;
type CommandQueueArgs = [number, Array<number>] | (() => Promise<void>);
type CommandQueueEntry = {
    res: (val?: any) => void;
    rej: (error?: any) => void;
    args: CommandQueueArgs;
};
type CommandQueue = Array<CommandQueueEntry>;

// 定义全局命令队列
const globalCommandQueue: {
    [kbAddr: string]: { isFlushing: boolean; commandQueue: CommandQueue };
} = {};

// 判断设备是否可以连接
export const canConnect = (device) => {
    try {
        new QMK_KeyboardDevice(device.path); // 尝试连接设备
        return true; // 连接成功
    } catch (e) {
        console.error('Skipped ', device, e); // 连接失败
        return false;
    }
};
// WebHID 支持检测接口
interface BrowserSupport {
    isSupported: boolean;
    browserName: string;
    recommendedBrowser: string;
}
/**
 * 检查浏览器是否支持 WebHID
 * @returns BrowserSupport 对象
 */
const checkWebHIDSupport = (): BrowserSupport => {
    // 检测当前浏览器
    const getBrowser = (): string => {
        const userAgent = navigator.userAgent;
        if (userAgent.indexOf("Chrome") > -1) return "Chrome";
        if (userAgent.indexOf("Firefox") > -1) return "Firefox";
        if (userAgent.indexOf("Safari") > -1) return "Safari";
        if (userAgent.indexOf("Edge") > -1) return "Edge";
        return "Unknown";
    };

    const browserName = getBrowser();
    const isSupported = "hid" in navigator;

    return {
        isSupported,
        browserName,
        recommendedBrowser: "Chrome 89+ 或 Edge 89+",
    };
};
export interface ParsedLightingResult {
    effects: Record<string, LightingEffect[]>
    maxBrightness: Record<string, [number, number]>
    maxSpeed: Record<string, [number, number]>
}
export class QMK_KeyboardDevice {
    // 存储设备地址的变量
    api: KeyboardAPI;
    vendorId: number = 0;
    productId: number = 0;
    productName: string = "Test Keyboard";
    listeners: Array<{ name: string; fn: Function }> = [];
    test: boolean = false;
    keys: number[] = [];
    deviceMode: number = 0
    version: number = 0;
    constructor(api: KeyboardAPI) {
        // 在构造函数中也检查 WebHID 支持
        const support = checkWebHIDSupport();
        if (!support.isSupported) {
            throw new Error(
                `您的浏览器 (${support.browserName}) 不支持 WebHID。\n请使用 ${support.recommendedBrowser} 访问。`
            );
        }

        this.api = api;
        this.test = api.test;
        const hid = this.api.getHID();
        this.vendorId = hid.vendorId;
        this.productId = hid.productId;
        this.productName = hid.productName;
        this.deviceMode = hid.productId === 12290 ? 1 : 0
        this.addListeners();
        this.version
    }
    addListeners() {
        const fn = (evt: HIDInputReportEvent) => {
            const data = Array.from(new Uint8Array(evt.data.buffer));
            if (data[0] == 0xaa && data[1] == 0xd0) {
                const listener = this.listeners.find(
                    (listener) => listener.name == "devNotify"
                );

                if (listener) {
                    console.log("11111", listener);
                    listener.fn(data);
                }
            }
        };
        this.api.getHID().addListeners(fn);
    }

    async getKeyboardLayout(deviceLayout: string) {
        console.log(deviceLayout, "-----------deviceLayout");

        const conf = await import(`@/data/keyboardLayout/${deviceLayout}.json`);
        return conf;
    }
    PARSE_MENUS_TO_LIGHTING_EFFECTS(
        menus: any[],
        rule: LightingParseRule = DEFAULT_LIGHTING_PARSE_RULE
    ): ParsedLightingResult {
        const lightingMenu = menus.find(m => m.label === 'Lighting')
        if (!lightingMenu) {
            return {
                effects: {},
                maxBrightness: {},
                maxSpeed: {}
            }
        }

        const result: ParsedLightingResult = {
            effects: {},
            maxBrightness: {},
            maxSpeed: {}
        }

        function findRangeItem(
            items: any[],
            label: string
        ): [number, number] | undefined {
            const item = items.find(
                i => i.type === 'range' && i.label === label
            )

            if (!item || !Array.isArray(item.options)) return undefined

            const [min, max] = item.options
            return [min, max]
        }
        lightingMenu.content.forEach((group: any) => {
            const items = group.content ?? []

            // 通过 contentId 前缀识别分组类型（不依赖 group.label 字符串）
            // id_qmk_rgb_matrix_* → 'backlight'
            // id_qmk_rgblight_*   → 'logo'
            const probe = items.find(
                (i: any) => Array.isArray(i.content) && i.content.length >= 3 && typeof i.content[0] === 'string'
            )
            let key: string
            if (probe) {
                const cid: string = probe.content[0]
                if (cid.startsWith('id_qmk_rgb_matrix_')) {
                    key = 'backlight'
                } else if (cid.startsWith('id_qmk_rgblight_')) {
                    key = 'logo'
                } else {
                    key = group.label  // 未知类型保留原始 label
                }
            } else {
                key = group.label
            }

            const langPrefix = `lighting.${key.toLowerCase()}`

            result.effects[key] = PARSE_LIGHTING_GROUP(group, langPrefix, rule)

            /** 2️⃣ maxBrightness */
            const brightnessRange = findRangeItem(items, 'Brightness')
            if (brightnessRange) {
                result.maxBrightness[key] = brightnessRange
            }

            /** 3️⃣ maxSpeed */
            const speedRange = findRangeItem(items, 'Effect Speed')
            if (speedRange) {
                result.maxSpeed[key] = speedRange
            }
        })

        return result
    }
    async sendDeviceDataV2(command, bytes?) {
        const buffer = await this.api.sendDeviceData(command, bytes);
        return buffer
    }
    // 获取当前设备的字节缓冲区
    async getByteBuffer(): Promise<Uint8Array> {
        return this.api.getHID().readP(); // 调用HID设备的读取方法
    }

    // 获取协议版本
    async getProtocolVersion() {
        try {
            const [, hi, lo] = await this.sendDeviceDataV2(APICommand.GET_PROTOCOL_VERSION);
            this.version = shiftTo16Bit([hi, lo]); // 将高低字节转换为16位协议版本
            return shiftTo16Bit([hi, lo]); // 将高低字节转换为16位协议版本
        } catch (e) {
            return -1; // 出现异常时返回-1表示错误
        }
    }

    // 获取指定层、行、列的键位
    async getKey(layer: Layer, row: Row, col: Column) {
        const buffer = await this.sendDeviceDataV2(

            [APICommand.DYNAMIC_KEYMAP_GET_KEYCODE, layer, row, col],
        );
        return shiftTo16Bit([buffer[4], buffer[5]]); // 返回转换后的16位键码
    }

    // 获取层数
    async getLayerCount() {
        const version = await this.getProtocolVersion();
        if (version >= PROTOCOL_BETA) {
            const [, count] = await this.sendDeviceDataV2(
                APICommand.DYNAMIC_KEYMAP_GET_LAYER_COUNT,
            );
            return count; // 如果版本是BETA或更高，返回层数
        }
        return 4; // 默认返回4层
    }

    // 根据协议版本读取原始矩阵数据
    async readRawMatrix(matrix, layer: number): Promise<any> {
        // 优先使用已缓存的版本，避免每次重复发 HID 请求
        const version = this.version > 0 ? this.version : await this.getProtocolVersion();
        if (version >= PROTOCOL_BETA) {
            return this.fastReadRawMatrix(matrix, layer); // 快速读取
        }
        if (version === PROTOCOL_ALPHA) {
            return this.slowReadRawMatrix(matrix, layer); // 慢速读取
        }
        throw new Error('Unsupported protocol version'); // 如果协议不支持，则抛出异常
    }

    // 获取键位映射缓冲区
    async getKeymapBuffer(offset: number, size: number): Promise<number[]> {
        if (size > 28) {
            throw new Error('Max data length is 28'); // 如果数据大小超过28，抛出异常
        }
        console.log(APICommand.DYNAMIC_KEYMAP_GET_BUFFER, ...shiftFrom16Bit(offset), size,);

        const res = await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_GET_BUFFER, [
            ...shiftFrom16Bit(offset), // 转换偏移量为16位
            size,
        ]);
        return [...res].slice(4, size + 4); // 返回有效数据部分
    }

    // 快速读取原始矩阵
    async fastReadRawMatrix(
        { rows, cols },
        layer: number,
    ): Promise<number[]> {
        const length = rows * cols;
        const MAX_KEYCODES_PARTIAL = 14; // 每次读取最多14个键码
        const bufferList = new Array<number>(
            Math.ceil(length / MAX_KEYCODES_PARTIAL),
        ).fill(0);
        const { res: promiseRes } = bufferList.reduce(
            ({ res, remaining }: { res: Promise<number[]>[]; remaining: number }) =>
                remaining < MAX_KEYCODES_PARTIAL
                    ? {
                        res: [
                            ...res,
                            this.getKeymapBuffer(
                                layer * length * 2 + 2 * (length - remaining),
                                remaining * 2,
                            ),
                        ],
                        remaining: 0,
                    }
                    : {
                        res: [
                            ...res,
                            this.getKeymapBuffer(
                                layer * length * 2 + 2 * (length - remaining),
                                MAX_KEYCODES_PARTIAL * 2,
                            ),
                        ],
                        remaining: remaining - MAX_KEYCODES_PARTIAL,
                    },
            { res: [], remaining: length },
        );
        const yieldedRes = await Promise.all(promiseRes);
        return yieldedRes.flatMap(shiftBufferTo16Bit); // 合并所有结果并转换为16位
    }

    // 慢速读取原始矩阵
    async slowReadRawMatrix(
        { rows, cols },
        layer: number,
    ): Promise<number[]> {
        const length = rows * cols;
        const res = new Array(length)
            .fill(0)
            .map((_, i) => this.getKey(layer, ~~(i / cols), i % cols)); // 按照行列遍历键位
        return Promise.all(res); // 等待所有键位的值
    }

    // 写入原始矩阵数据
    async writeRawMatrix(
        matrixInfo,
        keymap: number[][],
    ): Promise<void> {
        const version = await this.getProtocolVersion();
        if (version >= PROTOCOL_BETA) {
            return this.fastWriteRawMatrix(keymap); // 使用快速写入
        }
        if (version === PROTOCOL_ALPHA) {
            return this.slowWriteRawMatrix(matrixInfo, keymap); // 使用慢速写入
        }
    }

    // 慢速写入原始矩阵数据
    async slowWriteRawMatrix(
        { cols },
        keymap: number[][],
    ): Promise<void> {
        keymap.forEach(async (layer, layerIdx) =>
            layer.forEach(async (keycode, keyIdx) => {
                await this.setKey(layerIdx, ~~(keyIdx / cols), keyIdx % cols, keycode); // 按行列写入每个键值
            }),
        );
    }

    // 快速写入原始矩阵数据
    async fastWriteRawMatrix(keymap: number[][]): Promise<void> {
        const data = keymap.flatMap((layer) => layer.map((key) => key)); // 扁平化键位数组
        const shiftedData = shiftBufferFrom16Bit(data); // 转换为16位缓冲区
        const bufferSize = 28; // 每次写入28个字节
        for (let offset = 0; offset < shiftedData.length; offset += bufferSize) {
            const buffer = shiftedData.slice(offset, offset + bufferSize);
            await this.sendDeviceDataV2(
                APICommand.DYNAMIC_KEYMAP_SET_BUFFER,
                [
                    ...shiftFrom16Bit(offset),
                    buffer.length,
                    ...buffer,
                ],
            ); // 逐步写入数据
        }
    }

    // // 获取键盘设置值
    // async getKeyboardValue(
    //     command: KeyboardValue,
    //     parameters: number[],
    //     resultLength = 1,
    // ): Promise<number[]> {
    //     const bytes = [command, ...parameters];3 
    //     const res = await this.sendDeviceDataV2(APICommand.GET_KEYBOARD_VALUE, bytes);
    //     return res.slice(1 + bytes.length, 1 + bytes.length + resultLength); // 返回结果数据
    // }

    // // 设置键盘值
    // async setKeyboardValue(command: KeyboardValue, ...rest: number[]) {
    //     const bytes = [command, ...rest];
    //     await this.sendDeviceDataV2(APICommand.SET_KEYBOARD_VALUE, bytes); // 发送设置命令
    // }

    // 获取编码器值（VIA DYNAMIC_KEYMAP_GET_ENCODER）
    async getEncoderValue(
        layer: number,
        id: number,
        isClockwise: boolean,
    ): Promise<number> {
        const bytes = [layer, id, +isClockwise];
        const res = await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_GET_ENCODER, [...bytes]);
        return shiftTo16Bit([res[4], res[5]]); // 转换为16位编码器值
    }

    // 设置编码器值（VIA DYNAMIC_KEYMAP_SET_ENCODER）
    async setEncoderValue(
        layer: number,
        id: number,
        isClockwise: boolean,
        keycode: number,
    ): Promise<void> {
        const bytes = [layer, id, +isClockwise, ...shiftFrom16Bit(keycode)];
        await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_SET_ENCODER, [...bytes]); // 发送编码器设置命令
    }

    // 获取自定义菜单的值 (VIA CUSTOM_MENU_GET_VALUE)
    async getCustomMenuValue(commandBytes: number[]): Promise<number[]> {
        const res = await this.sendDeviceDataV2(
            APICommand.CUSTOM_MENU_GET_VALUE,
            commandBytes,
        );
        // 响应格式: [cmd, ...commandBytes, value]
        return Array.from(res).slice(1 + commandBytes.length);
    }

    // 设置自定义菜单的值 (VIA CUSTOM_MENU_SET_VALUE)
    async setCustomMenuValue(...args: number[]): Promise<void> {
        await this.sendDeviceDataV2(APICommand.CUSTOM_MENU_SET_VALUE, [...args]);
    }

    // 保存自定义菜单配置 (VIA CUSTOM_MENU_SAVE)
    async commitCustomMenu(channel: number): Promise<void> {
        await this.sendDeviceDataV2(APICommand.CUSTOM_MENU_SAVE, [channel]);
    }

    /**
     * 读取键盘当前灯光状态
     * 解析 VIA json menus 结构，对每个 range/dropdown/color 控件
     * 发送 CUSTOM_MENU_GET_VALUE 获取当前值
     * 返回 { [contentId]: value } 映射
     */
    async getLightingState(menus: any[]): Promise<Record<string, number>> {
        const result: Record<string, number> = {};
        const lightingMenu = menus.find((m: any) => m.label === 'Lighting');
        if (!lightingMenu) return result;

        const readableTypes = new Set(['range', 'dropdown', 'color']);

        const readItem = async (item: any) => {
            if (!item.type || !readableTypes.has(item.type)) return;
            if (!Array.isArray(item.content) || item.content.length < 3) return;
            const [contentId, channel, id] = item.content as [string, number, number];
            try {
                const res = await this.getCustomMenuValue([channel, id]);
                if (item.type === 'color') {
                    // color 控件返回 [hue, sat] 两个字节
                    result[`${contentId}_hue`] = res[0] ?? 0;
                    result[`${contentId}_sat`] = res[1] ?? 0;
                    // 同时保留原始 key 以兼容旧代码，取 hue 值
                    result[contentId] = res[0] ?? 0;
                } else {
                result[contentId] = res[0] ?? 0;
                }
            } catch (e) {
                console.warn(`[getLightingState] 读取 ${contentId} 失败:`, e);
            }
        };

        for (const group of lightingMenu.content) {
            for (const item of (group.content ?? [])) {
                await readItem(item);
            }
        }
        return result;
    }

    /**
     * 写入单个灯光控制值并保存
     * content 格式: [contentId, channel, id]
     */
    /**
     * 写入单个灯光控制值并保存
     * - range/dropdown: setLightingValue(channel, id, value)
     * - color (hue+sat): setLightingValue(channel, id, hue, sat)
     */
    async setLightingValue(channel: number, id: number, ...values: number[]): Promise<void> {
        await this.setCustomMenuValue(channel, id, ...values);
        await this.commitCustomMenu(channel);
    }

    // // 获取每个键的 RGB 背光矩阵
    // async getPerKeyRGBMatrix(ledIndexMapping: number[]): Promise<number[][]> {
    //     // 通过 HID 命令获取每个键的 RGB 值
    //     const res = await Promise.all(
    //         ledIndexMapping.map((ledIndex) =>
    //             // 向设备发送 HID 命令获取每个 LED 的 RGB 通道值
    //             this.sendDeviceDataV2(APICommand.CUSTOM_MENU_GET_VALUE, [
    //                 ...PER_KEY_RGB_CHANNEL_COMMAND,
    //                 ledIndex,
    //                 1, // 获取 1 个值
    //             ]),
    //         ),
    //     );
    //     // 解析返回的 RGB 数据，取出色调和饱和度部分
    //     return res.map((r) => [...r.slice(5, 7)]);
    // }

    // // 设置某个键的 RGB 背光值
    // async setPerKeyRGBMatrix(
    //     index: number,
    //     hue: number,
    //     sat: number,
    // ): Promise<void> {
    //     // 向设备发送 HID 命令设置键的 RGB 背光值
    //     await this.sendDeviceDataV2(APICommand.CUSTOM_MENU_SET_VALUE, [
    //         ...PER_KEY_RGB_CHANNEL_COMMAND,
    //         index,
    //         1, // 设置 1 个值
    //         hue, // 色调
    //         sat, // 饱和度
    //     ]);
    // }

    // // 获取背光的当前值
    // async getBacklightValue(
    //     command,
    //     resultLength = 1,
    // ): Promise<number[]> {
    //     const bytes = [command];
    //     // 向设备发送命令，获取背光值
    //     const res = await this.sendDeviceDataV2(
    //         APICommand.BACKLIGHT_CONFIG_GET_VALUE,
    //         bytes,
    //     );
    //     return res.slice(2, 2 + resultLength); // 返回获取的值
    // }

    // // 设置背光的值
    // async setBacklightValue(command, ...rest: number[]) {
    //     const bytes = [command, ...rest];
    //     // 向设备发送命令，设置背光值
    //     await this.sendDeviceDataV2(APICommand.BACKLIGHT_CONFIG_SET_VALUE, bytes);
    // }

    // // 获取背光的模式（效果）
    // async getRGBMode() {
    //     const bytes = [BACKLIGHT_EFFECT];
    //     const [, , val] = await this.sendDeviceDataV2(
    //         APICommand.BACKLIGHT_CONFIG_GET_VALUE,
    //         bytes,
    //     );
    //     return val; // 返回背光效果模式
    // }

    // // 获取当前亮度值
    // async getBrightness() {
    //     const bytes = [BACKLIGHT_BRIGHTNESS];
    //     const [, , brightness] = await this.sendDeviceDataV2(
    //         APICommand.BACKLIGHT_CONFIG_GET_VALUE,
    //         bytes,
    //     );
    //     return brightness; // 返回亮度值
    // }

    // // 获取指定编号的颜色
    // async getColor(colorNumber: number) {
    //     const bytes = [colorNumber === 1 ? BACKLIGHT_COLOR_1 : BACKLIGHT_COLOR_2];
    //     const [, , hue, sat] = await this.sendDeviceDataV2(
    //         APICommand.BACKLIGHT_CONFIG_GET_VALUE,
    //         bytes,
    //     );
    //     return { hue, sat }; // 返回色调和饱和度
    // }
    // // 设置指定编号的颜色
    // async setColor(colorNumber: number, hue: number, sat: number) {
    //     const bytes = [
    //         colorNumber === 1 ? BACKLIGHT_COLOR_1 : BACKLIGHT_COLOR_2,
    //         hue, // 色调
    //         sat, // 饱和度
    //     ];
    //     await this.sendDeviceDataV2(APICommand.BACKLIGHT_CONFIG_SET_VALUE, bytes);
    // }

    // // 获取自定义颜色
    // async getCustomColor(colorNumber: number) {
    //     const bytes = [BACKLIGHT_CUSTOM_COLOR, colorNumber];
    //     const [, , , hue, sat] = await this.sendDeviceDataV2(
    //         APICommand.BACKLIGHT_CONFIG_GET_VALUE,
    //         bytes,
    //     );
    //     return { hue, sat }; // 返回色调和饱和度
    // }

    // // 设置自定义颜色
    // async setCustomColor(colorNumber: number, hue: number, sat: number) {
    //     const bytes = [BACKLIGHT_CUSTOM_COLOR, colorNumber, hue, sat];
    //     await this.sendDeviceDataV2(APICommand.BACKLIGHT_CONFIG_SET_VALUE, bytes);
    // }

    // // 设置背光模式（效果）
    // async setRGBMode(effect: number) {
    //     const bytes = [BACKLIGHT_EFFECT, effect];
    //     await this.sendDeviceDataV2(APICommand.BACKLIGHT_CONFIG_SET_VALUE, bytes);
    // }

    // // 保存自定义菜单配置
    // async commitCustomMenu(channel: number) {
    //     await this.sendDeviceDataV2(APICommand.CUSTOM_MENU_SAVE, [channel]);
    // }

    // // 保存背光设置
    // async saveLighting() {
    //     await this.sendDeviceDataV2(APICommand.BACKLIGHT_CONFIG_SAVE);
    // }

    // // 重置 EEPROM 数据
    // async resetEEPROM() {
    //     await this.sendDeviceDataV2(APICommand.EEPROM_RESET);
    // }

    // // 跳转到引导程序
    // async jumpToBootloader() {
    //     await this.sendDeviceDataV2(APICommand.BOOTLOADER_JUMP);
    // }

    // 设置动态按键映射
    async setKey(layer: Layer, row: Row, column: Column, val: number) {
        const res = await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_SET_KEYCODE, [
            layer,
            row,
            column,
            ...shiftFrom16Bit(val),
        ]);
        return shiftTo16Bit([res[4], res[5]]); // 返回转换后的值
    }

    // 获取宏的数量（0x0C）
    async getMacroCount(): Promise<number> {
        const [, count] = await this.sendDeviceDataV2(
            APICommand.DYNAMIC_KEYMAP_MACRO_GET_COUNT,
        );
        return count;
    }

    // 获取宏缓冲区大小，字节数（0x0D）
    async getMacroBufferSize(): Promise<number> {
        const [, hi, lo] = await this.sendDeviceDataV2(
            APICommand.DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE,
        );
        return shiftTo16Bit([hi, lo]);
    }

    // 获取宏字节数据（0x0E）
    async getMacroBytes(): Promise<number[]> {
        const macroBufferSize = await this.getMacroBufferSize();
        const size = 28;
        const bytesP = [];
        for (let offset = 0; offset < macroBufferSize; offset += 28) {
            bytesP.push(
                this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_MACRO_GET_BUFFER, [
                    ...shiftFrom16Bit(offset),
                    size,
                ]),
            );
        }
        const allBytes = await Promise.all(bytesP);
        return allBytes.flatMap((bytes) => bytes.slice(4));
    }

    // 清空全部 keymap 为默认值（0x06 DYNAMIC_KEYMAP_CLEAR_ALL）
    async clearAllKeymaps(): Promise<void> {
        await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_CLEAR_ALL);
    }

    // 重置宏（0x10）
    async resetMacros(): Promise<void> {
        await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_MACRO_RESET);
    }

    // 设置宏字节数据（0x0F）
    async setMacroBytes(data: number[]): Promise<void> {
        const macroBufferSize = await this.getMacroBufferSize();
        if (data.length > macroBufferSize) {
            throw new Error(
                `Macro size (${data.length}) exceeds buffer size (${macroBufferSize})`,
            );
        }
        const lastOffset = macroBufferSize - 1;
        const lastOffsetBytes = shiftFrom16Bit(lastOffset);
        await this.resetMacros();
        try {
            await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [
                ...shiftFrom16Bit(lastOffset), 1, 0xff,
            ]);
            const bufferSize = 28;
            for (let offset = 0; offset < data.length; offset += bufferSize) {
                const buffer = data.slice(offset, offset + bufferSize);
                await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [
                    ...shiftFrom16Bit(offset), buffer.length, ...buffer,
                ]);
            }
        } finally {
            await this.sendDeviceDataV2(APICommand.DYNAMIC_KEYMAP_MACRO_SET_BUFFER, [
                ...lastOffsetBytes, 1, 0x00,
            ]);
        }
    }
}
