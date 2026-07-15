/**
 * 同一 HIDDevice 上 WebHID 的 sendReport 不可安全并发（OTA 直连 + LCD hid_write 会互抢）。
 * 按 device 串行化 OUT，并对瞬时失败重试，减轻 “Failed to write the report”。
 */

const writeChains = new WeakMap<HIDDevice, Promise<unknown>>();

const WRITE_RETRY = 5;
const BASE_BACKOFF_MS = 18;

function isRetriableWriteError(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e ?? '');
  return /write the report|failed to write|notallowed|invalid state|network|busy|disconnect|reset/i.test(
    msg
  );
}

export function isHidWriteNotAllowedError(e: unknown): boolean {
  const name = (e as Error)?.name ?? '';
  const msg = String((e as Error)?.message ?? e ?? '');
  return name === 'NotAllowedError' || /failed to write the report/i.test(msg);
}

/** 对同一 device 串行执行 fn（fn 内应完成一次或多次 sendReport） */
export async function withHidOutputWriteLock<T>(device: HIDDevice, fn: () => Promise<T>): Promise<T> {
  const prev = writeChains.get(device) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(fn);
  writeChains.set(device, next.then(() => {}).catch(() => {}));
  return next;
}

/**
 * 同一 JS `HIDDevice` close/open 或跨 OTA 后复用：清空 OUT 串行链尾，避免仍排在已失效会话的 promise 后（二次升级常卡在几十包）。
 * 须在设备已 close 或已 open 且上层确认无并发 OUT 时调用。
 */
export function resetHidOutputWriteLockChain(device: HIDDevice): void {
  writeChains.set(device, Promise.resolve());
}

/** 0x19 连续 OUT 热路径：成功即返回，失败再走重试退避 */
export async function hidSendReportFast(
  device: HIDDevice,
  reportId: number,
  data: BufferSource,
): Promise<void> {
  try {
    await device.sendReport(reportId, data);
    return;
  } catch (e) {
    if (!isRetriableWriteError(e)) throw e;
  }
  return hidSendReportWithRetry(device, reportId, data);
}

export async function hidSendReportWithRetry(
  device: HIDDevice,
  reportId: number,
  data: BufferSource
): Promise<void> {
  let last: unknown;
  for (let i = 0; i < WRITE_RETRY; i++) {
    try {
      await device.sendReport(reportId, data);
      return;
    } catch (e) {
      last = e;
      if (i < WRITE_RETRY - 1 && isRetriableWriteError(e)) {
        await new Promise((r) => setTimeout(r, BASE_BACKOFF_MS + i * 40));
        continue;
      }
      throw e;
    }
  }
  throw last;
}
