import { LightingEffect } from "@/types/leyout"
import basicKeyToByte from './key-to-byte/default';
import v10BasicKeyToByte from './key-to-byte/v10';
import v11BasicKeyToByte from './key-to-byte/v11';
import v12BasicKeyToByte from './key-to-byte/v12';
import { getKeycodes } from "./key-to-byte/qmk_keyCode";


export interface IKeycode {
    name: string;
    code: string;
    title?: string;
    shortName?: string;
    keys?: string;
    width?: number;
    type?: 'container' | 'text' | 'layer';
    layer?: number;
}
function FIND_ITEM(
    items: any[],
    matcher?: (item: any) => boolean
) {
    if (!matcher) return undefined
    return items.find(matcher)
}
export interface LightingParseRule {
    effect: (item: any) => boolean
    brightness?: (item: any) => boolean
    speed?: (item: any) => boolean
    color?: (item: any) => boolean
}

export const DEFAULT_LIGHTING_PARSE_RULE: LightingParseRule = {
    effect: item => item.type === 'dropdown',
    brightness: item => item.type === 'range' && item.label === 'Brightness',
    speed: item => item.type === 'range' && item.label === 'Effect Speed',
    color: item => item.type === 'color',
}
function PARSE_EXCLUDED_VALUES(showIf?: string): number[] {
    if (!showIf) return []

    const regex = /!=\s*(\d+)/g
    const result: number[] = []

    let match: RegExpExecArray | null
    while ((match = regex.exec(showIf))) {
        result.push(Number(match[1]))
    }

    return result
}
export function PARSE_LIGHTING_GROUP(
    group: any,
    langPrefix: string,
    rule: LightingParseRule
): LightingEffect[] {
    const items = group.content as any[]

    const effectItem = FIND_ITEM(items, rule.effect)
    if (!effectItem) return []

    const brightnessItem = FIND_ITEM(items, rule.brightness)
    const speedItem = FIND_ITEM(items, rule.speed)
    const colorItem = FIND_ITEM(items, rule.color)

    const excludedColorValues = PARSE_EXCLUDED_VALUES(colorItem?.showIf)

    return effectItem.options.map(([name, value]: [string, number]) => {
        const brightness =
            !!brightnessItem &&
            (!brightnessItem.showIf || !brightnessItem.showIf.includes(`!= ${value}`))

        const speed =
            !!speedItem &&
            (!speedItem.showIf || !speedItem.showIf.includes(`!= ${value}`))

        const color =
            !!colorItem &&
            value !== 0 &&
            !excludedColorValues.includes(value)

        return {
            name,
            lang: `${langPrefix}.${name.replace(/\s+/g, '_')}`,
            value,
            brightness,
            speed,
            direction: false,
            color,
            palette: false,
        }
    })
}
export const getBasicKeyToByte =
    (connectedDevice) => {
        const basicKeyToByte = getBasicKeyDict(
            connectedDevice ? connectedDevice.protocol : 0,
        );
        return { basicKeyToByte, byteToKey: getByteToKey(basicKeyToByte) };
    }
export function getBasicKeyDict(version: number) {
    switch (version) {
        case 13:
        case 12: {
            return v12BasicKeyToByte;
        }
        case 11: {
            return v11BasicKeyToByte;
        }
        case 10: {
            return v10BasicKeyToByte;
        }
        default: {
            return basicKeyToByte;
        }
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
export const keycodesList = getKeycodes().reduce<IKeycode[]>(
    (p, n) => p.concat(n.keycodes),
    [],
);
