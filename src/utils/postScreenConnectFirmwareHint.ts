import { getScreenUpgradeVersion } from '@/config/deviceInfo';
import type { screenInfo } from '@/types/types';

export type ShowFirmwareUpdateCardFn = (options: {
    variant: 'screen' | 'keyboard';
    targetVersionLabel: string;
    currentVersionLabel: string;
    extraHint?: string;
    duration?: number;
    onGoNow: () => void;
}) => void;

type TFn = (key: string, options?: Record<string, string>) => string;

/**
 * 与 SettingPanel `screenVerFromContext` / `screenDeviceVersion` 一致：
 * 从 `getScreenSize().firmware_version` 得到数值后，用十六进制大写字符串作为「屏显版本号」（如 276 → "114"），
 * 再与 `getScreenUpgradeVersion` 返回的目标串做 `parseInt(..., 10)` 比较；卡片「当前版本」也使用该字符串，勿用十进制原数。
 * @returns 是否已弹出固件升级提示
 */
export function notifyFirmwareUpdateAfterScreenConnect(params: {
    screenInfo?: screenInfo;
    fwVid: number;
    fwPid: number;
    firmwareChangelogKeySegment: number;
    keyboardNeedsUpgrade?: boolean;
    keyboardDeviceVersion?: string;
    keyboardUpgradeVersion?: string;
    demoSession?: boolean;
    showFirmwareUpdateCard: ShowFirmwareUpdateCardFn;
    /** 打开主区域「设置」并切到固件子页 */
    onNavigateToSettingsFirmware: () => void;
    t: TFn;
}): boolean {
    if (params.demoSession) return false;

    /** 与设置页「当前版本: V114」同源：十六进制大写数字串，按十进制与目标版本比较 */
    const screenVersionDisplay =
        params.screenInfo?.firmware_version == null
            ? ''
            : Number(params.screenInfo.firmware_version).toString(16).toUpperCase();
    const targetDec =
        params.fwVid && params.fwPid
            ? getScreenUpgradeVersion(params.fwVid, params.fwPid, params.firmwareChangelogKeySegment)
            : '';
    const screenNeeds = Boolean(
        targetDec &&
            screenVersionDisplay &&
            parseInt(screenVersionDisplay, 10) < parseInt(targetDec, 10),
    );

    const kbNeeds = Boolean(params.keyboardNeedsUpgrade);

    if (screenNeeds && screenVersionDisplay) {
        params.showFirmwareUpdateCard({
            variant: 'screen',
            targetVersionLabel: `v${targetDec}`,
            currentVersionLabel: `v${screenVersionDisplay}`,
            extraHint: kbNeeds ? params.t('2936') : undefined,
            onGoNow: params.onNavigateToSettingsFirmware,
        });
        return true;
    }

    if (kbNeeds) {
        const tv = params.keyboardUpgradeVersion?.trim();
        const cv = params.keyboardDeviceVersion?.trim();
        params.showFirmwareUpdateCard({
            variant: 'keyboard',
            targetVersionLabel: tv ? `v${tv}` : 'v…',
            currentVersionLabel: cv ? `v${cv}` : 'v…',
            onGoNow: params.onNavigateToSettingsFirmware,
        });
        return true;
    }

    return false;
}
