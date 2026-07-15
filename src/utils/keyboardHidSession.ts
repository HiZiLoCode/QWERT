import { releaseAllKeyboardApiSessions, releaseKeyboardApiSession } from '@/devices/KeyboardAPI';
import {
  releaseAllVendorHidSessions,
  releaseVendorHidSessionsForPhysicalDevice,
} from '@/devices/WebHid';

let reconcilePauseUntil = 0;
let userSessionDepth = 0;

/** 拔线 / 升级刷新后短暂暂停 reconcile / initState，避免与重枚举并发写 HID 导致 tab 崩溃 */
export function pauseKeyboardHidReconcile(ms: number) {
  reconcilePauseUntil = Math.max(reconcilePauseUntil, Date.now() + Math.max(0, ms));
}

export function isKeyboardHidReconcilePaused(): boolean {
  return Date.now() < reconcilePauseUntil;
}

/** 用户主动连接/授权进行中：禁止后台 reconcile / initState 与 requestDevice 并发访问 HID */
export function beginKeyboardHidUserSession() {
  userSessionDepth += 1;
  pauseKeyboardHidReconcile(300_000);
}

export function endKeyboardHidUserSession() {
  userSessionDepth = Math.max(0, userSessionDepth - 1);
  if (userSessionDepth === 0) {
    pauseKeyboardHidReconcile(800);
  }
}

export function isKeyboardHidUserSessionActive(): boolean {
  return userSessionDepth > 0;
}

let authorizePickerOpen = false;

/** 仅授权弹窗等待期间为 true，用于跳过 USB remove（勿与整段连接流程混淆） */
export function setKeyboardAuthorizePickerOpen(open: boolean) {
  authorizePickerOpen = open;
}

export function isKeyboardAuthorizePickerOpen(): boolean {
  return authorizePickerOpen;
}

/** 仅清空驱动内 HID 缓存，不调用 getDevices / close（授权弹窗前使用） */
export function clearKeyboardHidDriverCaches() {
  releaseAllKeyboardApiSessions();
  releaseAllVendorHidSessions();
}

export function releaseKeyboardHidSessionForAddress(address: string | undefined | null) {
  if (!address) return;
  releaseKeyboardApiSession(address);
  releaseVendorHidSessionsForPhysicalDevice(undefined, address);
}

/** USB disconnect 事件：按物理 HID 句柄与逻辑 address 一并释放缓存会话 */
export function releaseKeyboardHidSessionForDisconnect(device: HIDDevice | undefined | null) {
  if (!device) return;
  pauseKeyboardHidReconcile(2000);
  const taggedAddress = (device as { _address?: string })._address;
  if (taggedAddress) {
    releaseKeyboardApiSession(taggedAddress);
  }
  releaseVendorHidSessionsForPhysicalDevice(device, taggedAddress);
}

/**
 * 固件升级完成刷新前 / 用户主动连接前：关闭全部已授权 HID 并清空驱动内缓存。
 * 避免 IAP→APP 重枚举后仍使用 Boot 阶段残留句柄导致授权后 tab 闪退。
 */
export async function releaseAllKeyboardHidSessions(): Promise<void> {
  pauseKeyboardHidReconcile(3500);
  clearKeyboardHidDriverCaches();

  if (typeof navigator === 'undefined' || !('hid' in navigator)) {
    return;
  }

  try {
    const devices = await navigator.hid.getDevices();
    await Promise.all(
      devices.map(async (device) => {
        try {
          if (device.opened) {
            await device.close();
          }
        } catch {
          /* ignore */
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

export async function waitForKeyboardHidReconcileIdle(
  isInFlight: () => boolean,
  maxMs = 30_000,
): Promise<void> {
  const start = Date.now();
  while (isInFlight() && Date.now() - start < maxMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  if (isInFlight()) {
    console.warn('[HID] reconcile 仍在进行，延长暂停以避免与授权并发');
    pauseKeyboardHidReconcile(15_000);
  }
}

const HID_ENUM_STABILIZE_MS = 800;

/** requestDevice 返回后等待系统枚举稳定，再 getDevices / open */
export async function waitForHidEnumerationStable(
  ms: number = HID_ENUM_STABILIZE_MS,
): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}
