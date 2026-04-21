/**
 * 键盘固件版本更新记录（按设备区分，与 deviceInfo 的 key 规则一致）。
 *
 * 发布新固件说明时请：
 * 1. 找到对应设备的 key：`0x{VID}_0x{PID}_{keyboardID}`（与 src/config/deviceInfo.ts 中条目一致，第三段与 getDeviceUpgradeFile 使用的 keyboardID 相同）
 * 2. 在该设备数组中维护记录：**建议把最新可升级目标（与 upgradeVersion 一致）或最新已发布版本放在最前**，其余按新→旧排列
 *
 * version 字符串须与界面展示一致：
 * - 当前版本：设备 firmwareVer 转十六进制大写（无 0x），例如 104 → "68"
 * - 与 deviceInfo.upgradeVersion 一致时可用十进制字符串，例如 "102"
 */
import { deviceInfoKey } from '@/config/deviceInfo';

export type FirmwareRelease = {
    version: string;
    date: string;
    changes: {
        zh: string[];
        en: string[];
    };
};

/** 设备 key → 该机型固件版本列表（含可选的「目标升级版本」说明，新在前） */
export const FIRMWARE_CHANGELOG_BY_DEVICE: Record<string, FirmwareRelease[]> = {
    '0x36B0_0x3059_0': [
        {
            version: '106',
            date: '2026-04-17',
            changes: {
                zh: ['1、背光最低亮度时背光会熄灭问题', '2、优化蓝牙模式睡眠后屏幕模式指示错误问题', '3、优化触摸条卡顿问题'],
                en: ['1、The backlight will turn off when the backlight is at the lowest brightness', '2、Optimize the screen mode indicator error problem after sleep in Bluetooth mode', '3、Optimize the touch bar stuttering problem'],
            },
        },
        {
            version: '107',
            date: '2026-04-18',
            changes: {
                zh: ['1、解决拾音灯卡死问题', '2、解决蓝牙模式屏幕会卡死无法切换问题', '3、优化屏幕上电闪烁问题', '4、适配免驱升级包'],
                en: ['1、Solve the pickup light freezing problem', '2、Solve the screen freezing problem in Bluetooth mode', '3、Optimize the screen power-on flicker problem', '4、Adapt the no-driver upgrade package'],
            },
        },
    ],
    default: [],
};

export function getFirmwareReleasesForDevice(
    vendorId: number,
    productId: number,
    keySegment: number = 0
): FirmwareRelease[] {
    const k = deviceInfoKey(vendorId, productId, keySegment);
    const list = FIRMWARE_CHANGELOG_BY_DEVICE[k];
    if (list?.length) return list;
    return FIRMWARE_CHANGELOG_BY_DEVICE.default ?? [];
}

export function findFirmwareRelease(
    releases: FirmwareRelease[],
    versionLabel: string | undefined
): FirmwareRelease | undefined {
    if (!versionLabel) return undefined;
    const t = versionLabel.trim().toUpperCase().replace(/^V/i, '');
    return releases.find((r) => r.version.toUpperCase() === t);
}
