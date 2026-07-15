import { deviceInfo } from "@/config/deviceInfo";
import { getFirmwareReleasesForDevice } from "@/config/firmwareChangelog";

export type BootRecoveryKeyboardOption = {
  key: string;
  name: string;
  vendorId: number;
  productId: number;
  devMode: number;
  upgradeVersion: string;
  updateFile: string;
};

function parseDeviceInfoHexId(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = parseInt(trimmed.replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Boot 救砖：列出所有具备键盘固件包（deviceInfo 或 changelog）的机型 */
export function listBootRecoveryKeyboardOptions(): BootRecoveryKeyboardOption[] {
  const options: BootRecoveryKeyboardOption[] = [];

  for (const key of Object.keys(deviceInfo)) {
    const row = deviceInfo[key];
    if (!row || typeof row !== "object") continue;
    if (row.iapBoot === true) continue;

    const vendorId = parseDeviceInfoHexId(row.vendorId);
    const productId = parseDeviceInfoHexId(row.productId);
    if (!vendorId || !productId) continue;

    const devModeMatch = key.match(/_(\d+)$/);
    const devMode = devModeMatch ? parseInt(devModeMatch[1], 10) : 0;

    const releases = getFirmwareReleasesForDevice(vendorId, productId, devMode);
    const latestReleaseWithFile = releases.find(
      (release) => typeof release.firmwareFile === "string" && release.firmwareFile.trim(),
    );

    const updateFile =
      (typeof row.updateFile === "string" ? row.updateFile.trim() : "") ||
      latestReleaseWithFile?.firmwareFile?.trim() ||
      "";
    if (!updateFile) continue;

    const upgradeVersion =
      (typeof row.upgradeVersion === "string" ? row.upgradeVersion.trim() : "") ||
      latestReleaseWithFile?.version?.trim() ||
      "";
    if (!upgradeVersion) continue;

    options.push({
      key,
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : key,
      vendorId,
      productId,
      devMode,
      upgradeVersion,
      updateFile,
    });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name, "zh"));
}
