import { isFirmwareVersionUpgradeable } from '@/utils/firmwareVersionCompare';
import {
  isKeyboardDriverUpgradeDisabled,
  isScreenDriverUpgradeDisabled,
} from '@/config/deviceInfo';

export function hasFirmwareFilePath(path: string | undefined | null): boolean {
  return Boolean(String(path ?? '').trim());
}

export function hasFirmwareVersionLabel(version: string | undefined | null): boolean {
  return Boolean(String(version ?? '').trim());
}

/** deviceInfo / changelog 是否已配置可升级的键盘固件包 */
export function isKeyboardFirmwarePackageConfigured(params: {
  targetVersion?: string;
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  if (
    params.vendorId != null &&
    params.productId != null &&
    isKeyboardDriverUpgradeDisabled(params.vendorId, params.productId, params.keySegment ?? 0)
  ) {
    return false;
  }
  return (
    hasFirmwareVersionLabel(params.targetVersion) &&
    hasFirmwareFilePath(params.firmwareFile)
  );
}

/** deviceInfo / changelog 是否已配置可升级的屏幕固件包 */
export function isScreenFirmwarePackageConfigured(params: {
  targetVersion?: string;
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  if (
    params.vendorId != null &&
    params.productId != null &&
    isScreenDriverUpgradeDisabled(params.vendorId, params.productId, params.keySegment ?? 0)
  ) {
    return false;
  }
  return (
    hasFirmwareVersionLabel(params.targetVersion) &&
    hasFirmwareFilePath(params.firmwareFile)
  );
}

/** 设置页「检查更新」/ 同版本重刷：须版本可读、已配置文件路径且当前 ≤ 目标 */
export function canInitiateKeyboardFirmwareUpgrade(params: {
  currentVersion?: string;
  targetVersion?: string;
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  if (!isKeyboardFirmwarePackageConfigured(params)) return false;
  if (!hasFirmwareVersionLabel(params.currentVersion)) return false;
  return isFirmwareVersionUpgradeable(params.currentVersion, params.targetVersion);
}

export function canInitiateScreenFirmwareUpgrade(params: {
  currentVersion?: string;
  targetVersion?: string;
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  if (!isScreenFirmwarePackageConfigured(params)) return false;
  if (!hasFirmwareVersionLabel(params.currentVersion)) return false;
  return isFirmwareVersionUpgradeable(params.currentVersion, params.targetVersion);
}

/** 历史版本列表中单条是否允许点「升级」 */
export function canUpgradeToKeyboardRelease(params: {
  version?: string;
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  return isKeyboardFirmwarePackageConfigured({
    targetVersion: params.version,
    firmwareFile: params.firmwareFile,
    vendorId: params.vendorId,
    productId: params.productId,
    keySegment: params.keySegment,
  });
}

export function canUpgradeToScreenRelease(params: {
  version?: string;
  /** changelog 条目字段 */
  screenFirmwareFile?: string;
  /** SettingPanel 历史升级回调字段（与 screenFirmwareFile 同义） */
  firmwareFile?: string;
  vendorId?: number;
  productId?: number;
  keySegment?: number;
}): boolean {
  return isScreenFirmwarePackageConfigured({
    targetVersion: params.version,
    firmwareFile: params.screenFirmwareFile ?? params.firmwareFile,
    vendorId: params.vendorId,
    productId: params.productId,
    keySegment: params.keySegment,
  });
}
