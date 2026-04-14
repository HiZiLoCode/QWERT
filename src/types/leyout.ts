export interface LightingEffect {
    /** 显示名称 */
    name: string
    /** 多语言 key（字符串形式） */
    lang: string
    /** 固件或协议中的模式值 */
    value: number

    /** 是否支持亮度 */
    brightness: boolean
    /** 是否支持速度 */
    speed: boolean
    /** 是否支持方向 */
    direction: boolean
    /** 是否支持单色 */
    color: boolean
    /** 是否支持调色板 */
    palette: boolean
}
export interface LightingRange {
    min: number
    max: number
    step: number
}
export interface LightingConfig {
    effects: Record<string, LightingEffect[]>
    speed: LightingRange
    brightness: LightingRange
    maxBrightness: Record<string, LightingLimitRange>
    maxSpeed: Record<string, LightingLimitRange>
}
export interface KeyboardKey {
    row: number
    col: number

    /** 画布坐标 */
    x: number
    y: number

    /** 宽高（单位 key） */
    w: number
    h: number

    /** 键值（HID / QMK code） */
    code: number

    /** key index */
    index: number

    /** 显示名称 */
    name: string

    /** 模式（普通 / Fn / 特殊） */
    mode: number
}
export interface KeyboardLayout {
    width: number
    height: number

    bg_width: number
    bg_height: number

    lg_bg_width: number
    lg_bg_height: number

    key_scale: number
    key_lg_scale: number

    key_index_max: number

    /** 可选功能键（旋钮、滚轮等） */
    optionKeys: Record<string, unknown>

    keys: KeyboardKey[]
}
export interface MatrixConfig {
    rows: number
    cols: number
}
export interface KeyboardConfig {
    /** 键盘型号 */
    name: string
    lighting: LightingConfig
    layouts: KeyboardLayout
    matrix: MatrixConfig
}
export type LightingLimitRange = [number, number]
export const DEFAULT_KEYBOARD_CONFIG: KeyboardConfig = {
    name: '',

    lighting: {
        effects: {},

        brightness: {
            min: 0,
            max: 100,
            step: 1
        },
        speed: {
            min: 0,
            max: 100,
            step: 1
        },
        maxBrightness: {},
        maxSpeed: {}
    },

    layouts: {
        width: 0,
        height: 0,

        bg_width: 0,
        bg_height: 0,

        lg_bg_width: 0,
        lg_bg_height: 0,

        key_scale: 1,
        key_lg_scale: 1,

        key_index_max: 0,

        optionKeys: {},
        keys: []
    },

    matrix: {
        rows: 0,
        cols: 0
    }
}