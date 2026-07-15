/**
 * 键盘 IAP 升级中断恢复：localStorage 仅保存续升所需的最小信息。
 * 目标版本号始终以 deviceInfo 为准，禁止用历史记录覆盖界面提示。
 */
export const FIRMWARE_UPGRADE_STATE_KEY = 'firmwareUpgradeState';

/** 超过此时长且 Boot 不在线，视为可丢弃的残留状态 */
export const FIRMWARE_UPGRADE_STATE_MAX_AGE_MS = 30 * 60 * 1000;

export type PersistedFirmwareUpgradeState = {
  isUpgrading?: boolean;
  startTime?: string;
  deviceInfo?: {
    vendorId?: number;
    productId?: number;
    firmwareFile?: string;
    currentVersion?: string;
    /** 仅用于检测配置是否已更新，不用于界面展示 */
    upgradeVersion?: string;
  };
  step?: string;
};

export type FirmwareUpgradePersistStep =
  | 'starting'
  | 'awaiting-boot-auth'
  | 'waiting-iap'
  | 'flashing';

export function isActiveFirmwareUpgradeState(
  opts: {
    vendorId?: number;
    productId?: number;
    currentUpgradeVersion?: string;
  } = {},
): boolean {
  const state = readFirmwareUpgradeState();
  if (!state?.isUpgrading || !state.deviceInfo?.firmwareFile) return false;
  // 续升/历史版本：以 localStorage 中用户选定的目标版本为准，勿与 deviceInfo 最新版比较
  return getDiscardFirmwareUpgradeStateReason(state, {
    vendorId: opts.vendorId,
    productId: opts.productId,
    currentUpgradeVersion: state.deviceInfo.upgradeVersion,
  }) === null;
}

export function readFirmwareUpgradeState(): PersistedFirmwareUpgradeState | null {
  try {
    const raw = localStorage.getItem(FIRMWARE_UPGRADE_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedFirmwareUpgradeState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveFirmwareUpgradeState(state: PersistedFirmwareUpgradeState): void {
  try {
    localStorage.setItem(FIRMWARE_UPGRADE_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('[firmwareUpgradeState] save failed', e);
  }
}

export function clearFirmwareUpgradeState(): void {
  try {
    localStorage.removeItem(FIRMWARE_UPGRADE_STATE_KEY);
  } catch (e) {
    console.warn('[firmwareUpgradeState] clear failed', e);
  }
}

export function isFirmwareUpgradeStateExpired(state: PersistedFirmwareUpgradeState): boolean {
  if (!state.startTime) return true;
  const started = Date.parse(state.startTime);
  if (!Number.isFinite(started)) return true;
  return Date.now() - started > FIRMWARE_UPGRADE_STATE_MAX_AGE_MS;
}

export function isFirmwareUpgradeStateConfigStale(
  state: PersistedFirmwareUpgradeState,
  currentUpgradeVersion: string,
): boolean {
  const saved = state.deviceInfo?.upgradeVersion?.trim();
  const current = currentUpgradeVersion.trim();
  if (!saved || !current) return false;
  return saved !== current;
}

export type DiscardFirmwareUpgradeStateReason =
  | 'expired'
  | 'no-firmware-file'
  | 'device-mismatch'
  | 'config-version-changed';

export function getDiscardFirmwareUpgradeStateReason(
  state: PersistedFirmwareUpgradeState,
  opts: {
    vendorId?: number;
    productId?: number;
    currentUpgradeVersion?: string;
  } = {},
): DiscardFirmwareUpgradeStateReason | null {
  if (!state.deviceInfo?.firmwareFile) return 'no-firmware-file';
  if (isFirmwareUpgradeStateExpired(state)) return 'expired';

  const { vendorId, productId, currentUpgradeVersion } = opts;
  if (vendorId != null && productId != null) {
    const dv = state.deviceInfo.vendorId;
    const dp = state.deviceInfo.productId;
    if (dv != null && dv !== vendorId) return 'device-mismatch';
    if (dp != null && dp !== productId) return 'device-mismatch';
  }

  if (currentUpgradeVersion && isFirmwareUpgradeStateConfigStale(state, currentUpgradeVersion)) {
    return 'config-version-changed';
  }

  return null;
}

/** Boot/IAP 阶段无法读取 APP 固件版本，界面不应展示「当前版本」 */
export function isIapBootUpgradePersistStep(step?: string): boolean {
  return step === 'waiting-iap' || step === 'awaiting-boot-auth' || step === 'flashing';
}

export function resolveKeyboardUpgradeCurrentVersion(opts: {
  deviceVersion?: string;
  persistedCurrentVersion?: string;
  upgradeStep?: string;
  iapBootConnected?: boolean;
}): string | undefined {
  if (opts.iapBootConnected) return undefined;
  if (isIapBootUpgradePersistStep(opts.upgradeStep)) return undefined;
  const version = opts.deviceVersion?.trim() || opts.persistedCurrentVersion?.trim();
  return version || undefined;
}
