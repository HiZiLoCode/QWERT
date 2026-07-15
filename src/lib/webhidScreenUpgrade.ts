/**
 * WebHID screen OTA client — ported from usb_dual_bank_dfu webhid-demo/upgrade-webhid.js
 * Mirrors Python HID output-report upgrade path with OTA 0x1919 and keyboard 0x36B0.
 */

import {
  hidSendReportFast,
  hidSendReportWithRetry,
  resetHidOutputWriteLockChain,
  withHidOutputWriteLock,
} from './hidOutputWriteLock';
import { upgradeFlowLog, UF_SOURCE } from '@/utils/upgradeFlowLog';

const UFL = UF_SOURCE.SCREEN_OTA;
const ufl = {
  info: (m: string, d?: string) => upgradeFlowLog.info(UFL, m, d),
  warn: (m: string, d?: string) => upgradeFlowLog.warn(UFL, m, d),
  error: (m: string, d?: string) => upgradeFlowLog.error(UFL, m, d),
  debug: (m: string, d?: string) => upgradeFlowLog.debug(UFL, m, d),
  out: (label: string, data: ArrayLike<number>, reportId?: number) =>
    upgradeFlowLog.logOut(UFL, label, data, reportId),
  in: (label: string, data: ArrayLike<number>, reportId?: number) =>
    upgradeFlowLog.logIn(UFL, label, data, reportId),
};

export const WEBHID_UPGRADE_CONSTANTS = {
  KEYBOARD_VID: 0x36b0,
  KEYBOARD_PID: 0x3059,
  OTA_VID: 0x1919,
  OTA_PID: 0x1919,
  REPORT_ID: 0,
  REPORT_OUT_LENGTH: 64,
  BIN_HEADER_SIZE: 64,
  UPGRADE_CHUNK_SIZE: 4096,
  SEND_SIZE: 48,
  CMD_ID: 0xaa,
  OTA_PROTO_ADDR: 0xff,
  OTA_PROTO_IMAGE_ERASE: 0x61,
  OTA_PROTO_IMAGE_START: 0x65,
  OTA_PROTO_IMAGE_DATA: 0x66,
  IMAGE_FLASH_START_ADDR: 0,
  IMAGE_SEND_SIZE: 57,
  IMAGE_CHUNK_SIZE: 5700,
  /** Python `download_image_data`: start 后等待下载界面 */
  IMAGE_START_UI_WAIT_MS: 3000,
  /** Python `wait_reply` bulk / 最后一包图传 IN 超时 */
  IMAGE_BULK_REPLY_MS: 1000,
  /** Python `WAIT_TIME`：进升级模式后等待 OTA 设备 */
  OTA_ENTER_MODE_WAIT_MS: 1000,
  /** 与 Python `BULK_ACK_COUNT` / `ENABLE_BULK_ACK` 一致：每 100 包再等一次应答 */
  BULK_ACK_COUNT: 100,
  /** Python 图传 bulk 用 `wait_reply(..., 1000)`；WebHID 下 IN 常更晚，略加长避免未满 100 包就误判超时 */
  IMAGE_DATA_BULK_WAIT_REPLY_MS: 8000,
  /** 最后一包 0x66 后固件可能写 flash，IN 更慢 */
  IMAGE_DATA_FINAL_WAIT_REPLY_MS: 20000,
  IMAGE_ERASE_TIMEOUT_S: 50,
  SCREEN_KEEPALIVE_CMD: 0x1c,
  SCREEN_KEEPALIVE_INTERVAL_MS: 800,
  OTA_UPGRADE_PRE_CMD: 0xf0,
  /** 单包 OUT 在 OUT 锁上排队过久仍不返回时，主动失败以免界面一直停在「升级中」 */
  OTA_OUT_PACKET_WATCHDOG_MS: 15000,
  /** bulk（100 包）IN 超时或 OUT 失败后整段重发次数 */
  IMAGE_BULK_MAX_RETRIES: 3,
  /** bulk 重试前清队列/写锁后的等待 */
  IMAGE_BULK_RETRY_DELAY_MS: 350,
  /** 等 IN 时分片等待；满 100 包无有效应答后再短等一次 */
  OTA_ACK_PROBE_WAIT_MS: 2500,
  /** 100 包边界上快速探测 IN 的毫秒数（仅 bulk 计数满时 poll） */
  OTA_ACK_IN_POLL_MS: 5,
  OTA_ACK_PROBE_MAX_ROUNDS: 5,
} as const;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function calcChecksum(u8: Uint8Array) {
  let s = 0;
  for (let i = 0; i < u8.length; i++) s += u8[i];
  return s & 0xffff;
}

function padReport(data: Uint8Array, len: number) {
  const out = new Uint8Array(len);
  out.set(data.length > len ? data.subarray(0, len) : data, 0);
  return out;
}

function u8FromDataView(data: DataView) {
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}

/**
 * 屏幕等复合 HID 的 input report 常在首字节带 reportId，OTA 应答 `ff cmd status` 会整体后移。
 * 在前若干字节内扫描 `ff` + cmd，返回 status（第三字节）；找不到返回 null。
 */
function hasOtaPrefix(buf: Uint8Array): boolean {
  const addr = WEBHID_UPGRADE_CONSTANTS.OTA_PROTO_ADDR;
  const maxOff = Math.min(8, Math.max(0, buf.length - 3));
  for (let off = 0; off <= maxOff; off++) {
    if (buf[off] === addr) return true;
  }
  return false;
}

function parseOtaStatusByte(buf: Uint8Array, cmd: number): number | null {
  const addr = WEBHID_UPGRADE_CONSTANTS.OTA_PROTO_ADDR;
  const maxOff = Math.min(8, Math.max(0, buf.length - 3));
  for (let off = 0; off <= maxOff; off++) {
    if (buf[off] === addr && buf[off + 1] === cmd) {
      return buf[off + 2]!;
    }
  }
  return null;
}

export type HidOutputReportInfo = { reportId: number; byteLength: number };

type HidOutputReportDesc = {
  reportId?: number;
  items?: readonly { reportSize?: number; reportCount?: number }[];
};

type HidCollectionWithOutputs = NonNullable<HIDDevice['collections']>[number] & {
  outputReports?: readonly HidOutputReportDesc[];
};

export function listHidOutputReports(device: HIDDevice): HidOutputReportInfo[] {
  const results: HidOutputReportInfo[] = [];
  const seen = new Set<string>();
  const collections = device.collections;
  if (!collections?.length) return results;

  for (const col of collections) {
    const reports = (col as HidCollectionWithOutputs).outputReports;
    if (!reports?.length) continue;
    for (const rep of reports) {
      let bits = 0;
      const items = rep.items;
      if (items?.length) {
        for (const item of items) {
          const rs = item.reportSize;
          const rc = item.reportCount;
          if (typeof rs === 'number' && typeof rc === 'number') bits += rs * rc;
        }
      }
      const byteLength = bits > 0 ? Math.ceil(bits / 8) : 0;
      const reportId = rep.reportId !== undefined ? rep.reportId & 0xff : 0;
      if (byteLength <= 0) continue;
      const key = `${reportId}:${byteLength}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ reportId, byteLength });
    }
  }
  results.sort((a, b) => b.byteLength - a.byteLength);
  return results;
}

function buildOutputSendCandidates(
  device: HIDDevice,
  preferredReportId: number,
  preferredLength: number
): HidOutputReportInfo[] {
  const fromDesc = listHidOutputReports(device);
  const fallbacks: HidOutputReportInfo[] = [
    { reportId: preferredReportId, byteLength: preferredLength },
    { reportId: 0, byteLength: 64 },
    { reportId: 0, byteLength: 32 },
    { reportId: 0, byteLength: 16 },
    { reportId: 0, byteLength: 8 },
    { reportId: 1, byteLength: 64 },
    { reportId: 1, byteLength: 32 },
    { reportId: 2, byteLength: 64 },
    { reportId: 3, byteLength: 64 },
    { reportId: 0, byteLength: 20 },
    { reportId: 0, byteLength: 40 },
  ];
  const out = [...fromDesc];
  for (const f of fallbacks) {
    if (!out.some((x) => x.reportId === f.reportId && x.byteLength === f.byteLength)) out.push(f);
  }
  return out;
}

function buildOtaPacket(cmdCode: number, dataBytes: Uint8Array, apduSize?: number) {
  const addr = WEBHID_UPGRADE_CONSTANTS.OTA_PROTO_ADDR;
  const apdu = apduSize ?? dataBytes.length;
  const packetSize = 5 + apdu + 2;
  const packet = new Uint8Array(packetSize);
  packet[0] = addr;
  packet[1] = cmdCode;
  packet[2] = 0x01;
  packet[3] = apdu & 0xff;
  packet[4] = (apdu >> 8) & 0xff;
  for (let i = 0; i < apdu; i++) {
    packet[5 + i] = i < dataBytes.length ? dataBytes[i]! : 0;
  }
  const cksum = calcChecksum(packet.subarray(0, packetSize - 2));
  packet[packetSize - 2] = cksum & 0xff;
  packet[packetSize - 1] = (cksum >> 8) & 0xff;
  return packet;
}

/** 已打开的屏幕 HID（与动效页 deviceComm 一致）：经此下发 0x10；OTA 与屏幕共用同一 HIDDevice */
export type ScreenHidForOtaPrep = {
  setData(data: number[]): Promise<unknown>;
  getScreenHidDevice?: () => HIDDevice | undefined;
  clearOtaStaleBuffers?: () => void;
  /** 清主连接队列 + 读缓冲；与 OTA 共用屏幕 HID 时二次升级前避免 100 包 bulk 等 IN 错位卡住 */
  resetLcdStateForOta?: () => void;
};

/** 与 KeyboardDevice.lightOff 一致：退出 OTA 时灭屏走键盘协议，不经屏幕 HID */
export type KeyboardLightOffCapable = {
  lightOff: () => Promise<boolean>;
};

export type WebHidUpgradeClientOptions = {
  reportId?: number;
  reportOutLength?: number;
  keyboardVid?: number;
  keyboardPid?: number;
  otaVid?: number;
  otaPid?: number;
  screenDeviceComm?: ScreenHidForOtaPrep;
  /** 0xe1 只发往键盘；走屏幕 OTA 退出时需传已连接键盘的 HIDDevice */
  keyboardHidForExit?: HIDDevice;
  /** 灭屏用 KeyboardDevice.lightOff；有则不再经屏幕发 0xaa 0x10 关屏 */
  keyboardForLightOff?: KeyboardLightOffCapable;
};

export class WebHidUpgradeClient {
  reportId: number;
  reportOutLength: number;
  private readonly keyboardVid: number;
  private readonly keyboardPid: number;
  private readonly otaVid: number;
  private readonly otaPid: number;
  private readonly screenDeviceComm?: ScreenHidForOtaPrep;
  private readonly keyboardHidForExit?: HIDDevice;
  private readonly keyboardForLightOff?: KeyboardLightOffCapable;
  /** OTA 与屏幕为同一 WebHID 时不在 closeAll 里 close，避免断开主连接 */
  private _otaBorrowedFromScreen = false;
  keyboard: HIDDevice | null = null;
  ota: HIDDevice | null = null;
  private readonly _outputProfileByDevice = new WeakMap<HIDDevice, HidOutputReportInfo>();
  private _otaScreenKeepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private _otaScreenKeepaliveOn = false;
  private _otaScreenKeepaliveIntervalMs: number;
  private _otaScreenKeepaliveCmd: number;
  private _keepaliveSuspendDepth = 0;
  /** 图传/固件数据热路径：跳过逐包日志、走 hidSendReportFast */
  private _otaXferHotPath = false;
  /** burst OUT 期间由 tap 缓存 IN，避免应答在无 listener 时丢失 */
  private _otaInTap: {
    active: boolean;
    device: HIDDevice | null;
    handler: ((e: HIDInputReportEvent) => void) | null;
    queue: Uint8Array[];
  } = { active: false, device: null, handler: null, queue: [] };

  constructor(opts: WebHidUpgradeClientOptions = {}) {
    this.reportId = opts.reportId ?? WEBHID_UPGRADE_CONSTANTS.REPORT_ID;
    this.reportOutLength = opts.reportOutLength ?? WEBHID_UPGRADE_CONSTANTS.REPORT_OUT_LENGTH;
    this.keyboardVid = opts.keyboardVid ?? WEBHID_UPGRADE_CONSTANTS.KEYBOARD_VID;
    this.keyboardPid = opts.keyboardPid ?? WEBHID_UPGRADE_CONSTANTS.KEYBOARD_PID;
    this.otaVid = opts.otaVid ?? WEBHID_UPGRADE_CONSTANTS.OTA_VID;
    this.otaPid = opts.otaPid ?? WEBHID_UPGRADE_CONSTANTS.OTA_PID;
    this.screenDeviceComm = opts.screenDeviceComm;
    this.keyboardHidForExit = opts.keyboardHidForExit;
    this.keyboardForLightOff = opts.keyboardForLightOff;
    this._otaScreenKeepaliveIntervalMs = WEBHID_UPGRADE_CONSTANTS.SCREEN_KEEPALIVE_INTERVAL_MS;
    this._otaScreenKeepaliveCmd = WEBHID_UPGRADE_CONSTANTS.SCREEN_KEEPALIVE_CMD;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.hid;
  }

  async requestKeyboardDevice(): Promise<HIDDevice> {
    const filters = [{ vendorId: this.keyboardVid, productId: this.keyboardPid }];
    const list = await navigator.hid.requestDevice({ filters });
    if (!list.length) throw new Error('No device selected');
    this.keyboard = list[0]!;
    return this.keyboard;
  }

  async requestOtaDevice(): Promise<HIDDevice> {
    const filters = [{ vendorId: this.otaVid, productId: this.otaPid }];
    const list = await navigator.hid.requestDevice({ filters });
    if (!list.length) throw new Error('No device selected');
    this.ota = list[0]!;
    this._otaBorrowedFromScreen = false;
    return this.ota;
  }

  /**
   * 丢弃底层 HID 上已到达但未消费的 inputreport（与 LCD read 队列无关），减轻二次 OTA bulk 等应答错位。
   */
  private async discardQueuedOtaInReports(maxRounds = 32, sliceMs = 40) {
    if (!this.ota) return;
    for (let i = 0; i < maxRounds; i++) {
      const u8 = await this.waitInputReport(this.ota, () => true, sliceMs);
      if (!u8) break;
    }
  }

  /**
   * 已连屏幕时直接使用当前 HID 作为 OTA；否则弹窗选择 0x1919。
   * 同页第二次升级：对已打开的 handle **不再 close/open**（易触发 OS disconnect、OUT 在几十包后挂死）；仅清队列、写锁链与排空 IN。
   * 若 handle 未打开则 `open()`；固件侧彻底掉线时请用户重新插拔后再连。
   */
  async requestAndOpenOtaDevice(): Promise<void> {
    const comm = this.screenDeviceComm;
    const pick = comm?.getScreenHidDevice?.();
    if (comm && pick) {
      comm.resetLcdStateForOta?.();
      this.forgetOutputProfile(pick);
      resetHidOutputWriteLockChain(pick);
      try {
        if (!pick.opened) {
          await pick.open();
        }
      } catch (e) {
        ufl.warn('requestAndOpenOtaDevice: screen HID open', String(e));
      }
      this.ota = pick;
      this._otaBorrowedFromScreen = true;
      await this.open(this.ota);
      resetHidOutputWriteLockChain(pick);
      comm.resetLcdStateForOta?.();
      await this.discardQueuedOtaInReports(96, 45);
      return;
    }
    const ota = await this.requestOtaDevice();
    await this.open(ota);
  }

  async open(device: HIDDevice) {
    if (!device.opened) await device.open();
  }

  async sendReport(device: HIDDevice, payload: Uint8Array) {
    return withHidOutputWriteLock(device, async () => {
      const cached = this._outputProfileByDevice.get(device);
      if (cached) {
        const padded = padReport(payload, cached.byteLength);
        if (!this._otaXferHotPath) {
          ufl.out('OTA OUT', padded, cached.reportId);
        }
        if (this._otaXferHotPath) {
          await hidSendReportFast(device, cached.reportId, padded);
        } else {
          await hidSendReportWithRetry(device, cached.reportId, padded);
        }
        return;
      }

      const candidates = buildOutputSendCandidates(device, this.reportId, this.reportOutLength);
      let lastErr: Error | null = null;
      for (const c of candidates) {
        try {
          const padded = padReport(payload, c.byteLength);
          if (!this._otaXferHotPath) {
            ufl.out('OTA OUT', padded, c.reportId);
          }
          if (this._otaXferHotPath) {
            await hidSendReportFast(device, c.reportId, padded);
          } else {
            await hidSendReportWithRetry(device, c.reportId, padded);
          }
          this._outputProfileByDevice.set(device, c);
          return;
        } catch (e) {
          lastErr = e instanceof Error ? e : new Error(String(e));
        }
      }
      const hint =
        'HID output report length mismatch. Check listHidOutputReports(device) or set reportId/reportOutLength.';
      throw new Error(`${lastErr?.message || 'sendReport failed'} — ${hint}`);
    });
  }

  private _enterOtaXferHotPath() {
    this._otaXferHotPath = true;
    this.startOtaInTap();
  }

  private _leaveOtaXferHotPath() {
    this._otaXferHotPath = false;
    this.stopOtaInTap();
  }

  private startOtaInTap() {
    if (!this.ota || this._otaInTap.active) return;
    const device = this.ota;
    const handler = (e: HIDInputReportEvent) => {
      const ev = e as HIDInputReportEvent & { device?: HIDDevice };
      if (ev.device != null && ev.device !== device) return;
      const u8 = u8FromDataView(e.data);
      if (!hasOtaPrefix(u8)) return;
      if (!this._otaXferHotPath) return;
      if (this._otaInTap.queue.length > 48) {
        this._otaInTap.queue.shift();
      }
      this._otaInTap.queue.push(u8);
    };
    device.addEventListener('inputreport', handler);
    this._otaInTap = { active: true, device, handler, queue: [] };
  }

  private stopOtaInTap() {
    const { device, handler } = this._otaInTap;
    if (device && handler) {
      device.removeEventListener('inputreport', handler);
    }
    this._otaInTap = { active: false, device: null, handler: null, queue: [] };
  }

  private clearOtaInTapQueue() {
    this._otaInTap.queue.length = 0;
  }

  /** 从 tap 队列取指定 cmd 的 status；未找到返回 null */
  private takeOtaStatusFromTap(expectedCmd: number): number | null {
    const q = this._otaInTap.queue;
    for (let i = 0; i < q.length; i++) {
      const buf = q[i]!;
      const st = parseOtaStatusByte(buf, expectedCmd);
      if (st !== null) {
        q.splice(i, 1);
        if (!this._otaXferHotPath) {
          ufl.in('OTA IN tap', buf);
        }
        return st;
      }
    }
    return null;
  }

  private async waitOtaStatusFromTap(expectedCmd: number, timeoutMs: number): Promise<number | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const st = this.takeOtaStatusFromTap(expectedCmd);
      if (st !== null) return st;
      await sleep(4);
    }
    return null;
  }

  private async sendReportWithOtaWatchdog(
    device: HIDDevice,
    payload: Uint8Array,
    timeoutMs: number,
    errDetail: string
  ): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errDetail)), timeoutMs);
        this.sendReport(device, payload)
          .then(() => resolve())
          .catch(reject);
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }

  /** 图传/固件数据热路径 OUT（无 per-packet watchdog，靠 burst + 抽样 IN） */
  private async sendOtaDataReportFast(payload: Uint8Array): Promise<void> {
    if (!this.ota) throw new Error('Connect OTA device first');
    await this.sendReport(this.ota, payload);
  }

  /** 图传/固件数据 OUT：带看门狗，用于非热路径或重试 */
  private async sendOtaDataReport(payload: Uint8Array): Promise<void> {
    if (!this.ota) throw new Error('Connect OTA device first');
    const { OTA_OUT_PACKET_WATCHDOG_MS } = WEBHID_UPGRADE_CONSTANTS;
    try {
      await this.sendReportWithOtaWatchdog(
        this.ota,
        payload,
        OTA_OUT_PACKET_WATCHDOG_MS,
        'OTA 数据包 OUT 超时（15s）。HID 写锁或设备无响应，请拔插数据线后重试。',
      );
    } catch (e) {
      if (this._otaBorrowedFromScreen) {
        const d = this.screenDeviceComm?.getScreenHidDevice?.();
        if (d) resetHidOutputWriteLockChain(d);
      }
      throw e;
    }
  }

  forgetOutputProfile(device: HIDDevice | null) {
    if (device) this._outputProfileByDevice.delete(device);
  }

  async sendHidCommand(device: HIDDevice, cmdCode: number, params: number[] = []) {
    const body = new Uint8Array([WEBHID_UPGRADE_CONSTANTS.CMD_ID, cmdCode, ...params]);
    await this.sendReport(device, body);
  }

  private _armOtaScreenKeepaliveTimer() {
    if (this._otaScreenKeepaliveTimer != null) {
      clearInterval(this._otaScreenKeepaliveTimer);
      this._otaScreenKeepaliveTimer = null;
    }
    const cmd = this._otaScreenKeepaliveCmd;
    const tick = async () => {
      if (!this._otaScreenKeepaliveOn || !this.ota?.opened) return;
      try {
        await this.sendHidCommand(this.ota, cmd, []);
      } catch (e) {
        ufl.warn('OTA screen keepalive', String(e));
      }
    };
    void tick();
    this._otaScreenKeepaliveTimer = setInterval(() => {
      void tick();
    }, this._otaScreenKeepaliveIntervalMs);
  }

  private _suspendOtaScreenKeepaliveForTransfer() {
    if (this._keepaliveSuspendDepth++ > 0) return;
    if (this._otaScreenKeepaliveTimer != null) {
      clearInterval(this._otaScreenKeepaliveTimer);
      this._otaScreenKeepaliveTimer = null;
    }
  }

  private _resumeOtaScreenKeepaliveAfterTransfer() {
    if (--this._keepaliveSuspendDepth > 0) return;
    this._keepaliveSuspendDepth = 0;
    if (this._otaScreenKeepaliveOn && this.ota?.opened) {
      this._armOtaScreenKeepaliveTimer();
    }
  }

  startOtaScreenKeepalive(opts: { intervalMs?: number; cmd?: number } = {}) {
    this.stopOtaScreenKeepalive();
    if (!this.ota) throw new Error('Connect OTA device first');
    this._otaScreenKeepaliveCmd = opts.cmd ?? WEBHID_UPGRADE_CONSTANTS.SCREEN_KEEPALIVE_CMD;
    this._otaScreenKeepaliveIntervalMs =
      opts.intervalMs ?? WEBHID_UPGRADE_CONSTANTS.SCREEN_KEEPALIVE_INTERVAL_MS;
    this._otaScreenKeepaliveOn = true;
    this._keepaliveSuspendDepth = 0;
    this._armOtaScreenKeepaliveTimer();
  }

  stopOtaScreenKeepalive() {
    this._otaScreenKeepaliveOn = false;
    this._keepaliveSuspendDepth = 0;
    if (this._otaScreenKeepaliveTimer != null) {
      clearInterval(this._otaScreenKeepaliveTimer);
      this._otaScreenKeepaliveTimer = null;
    }
  }

  private async sendAaSubToScreen(cmd: number, tail: number[] = []) {
    const comm = this.screenDeviceComm;
    if (!comm) throw new Error('screenDeviceComm not configured');
    const buf = new Array(65).fill(0);
    buf[1] = WEBHID_UPGRADE_CONSTANTS.CMD_ID;
    buf[2] = cmd;
    for (let i = 0; i < tail.length; i++) buf[3 + i] = tail[i]!;
    await comm.setData(buf);
  }

  async enterUpgradeMode() {
    if (this.screenDeviceComm) {
      // 已连屏幕即可走 OTA，无需再发 0xe0
      await this.sendAaSubToScreen(0x10);
      return;
    }
    if (!this.keyboard) throw new Error('Connect keyboard device first');
    await this.open(this.keyboard);
    await this.sendHidCommand(this.keyboard, 0x10, []);
    await sleep(100);
    await this.sendHidCommand(this.keyboard, 0xe0, []);
    await sleep(WEBHID_UPGRADE_CONSTANTS.OTA_ENTER_MODE_WAIT_MS);
  }

  async exitUpgradeMode() {
    if (this.screenDeviceComm) {
      try {
        if (this.keyboardForLightOff) {
          await this.keyboardForLightOff.lightOff();
        } else {
          await this.sendAaSubToScreen(0x10);
        }
        await sleep(100);
        // 0xe1 为键盘侧退出 OTA，经屏幕 setData 下发无效；改由已连接键盘 HID 发送
        const kbd = this.keyboardHidForExit;
        if (kbd) {
          await this.open(kbd);
          await this.sendHidCommand(kbd, 0xe1, [0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);
          await sleep(100);
        } else {
          ufl.warn('exitUpgradeMode', 'keyboardHidForExit missing, skip 0xe1');
        }
      } catch (e) {
        ufl.warn('exitUpgradeMode (screen + keyboard exit)', String(e));
      }
      return;
    }
    if (!this.keyboard) return;
    try {
      await this.open(this.keyboard);
      await this.sendHidCommand(this.keyboard, 0x10, []);
      await sleep(100);
      await this.sendHidCommand(this.keyboard, 0xe1, [0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01]);
      await sleep(100);
    } catch (e) {
      ufl.warn('exitUpgradeMode', String(e));
    }
  }

  async sendOtaUpgradeCommand0xf0() {
    if (!this.ota) throw new Error('Connect OTA device first');
    await this.open(this.ota);
    await this.sendHidCommand(this.ota, WEBHID_UPGRADE_CONSTANTS.OTA_UPGRADE_PRE_CMD, []);
    await sleep(1000);
  }

  async finalizeUpgradeSession() {
    this.stopOtaScreenKeepalive();
    if (this.ota) this.forgetOutputProfile(this.ota);
    await this.exitUpgradeMode();
    try {
      this.screenDeviceComm?.resetLcdStateForOta?.();
      const screenDev = this.screenDeviceComm?.getScreenHidDevice?.();
      if (screenDev) resetHidOutputWriteLockChain(screenDev);
      if (this.ota?.opened) await this.discardQueuedOtaInReports(64, 45);
    } catch {
      /* */
    }
  }

  waitInputReport(device: HIDDevice, match: (u8: Uint8Array) => boolean, timeoutMs = 5000) {
    return new Promise<Uint8Array | null>((resolve) => {
      const done = (v: Uint8Array | null) => {
        clearTimeout(t);
        device.removeEventListener('inputreport', handler);
        resolve(v);
      };
      const t = setTimeout(() => done(null), timeoutMs);
      const handler = (e: HIDInputReportEvent) => {
        const ev = e as HIDInputReportEvent & { device?: HIDDevice };
        // 部分环境不填 device；误过滤会导致「抓包有 IN、JS 永远等不到」
        if (ev.device != null && ev.device !== device) return;
        const u8 = u8FromDataView(e.data);
        if (match(u8)) {
          ufl.in('OTA IN', u8, e.reportId);
          done(u8);
        }
      };
      device.addEventListener('inputreport', handler);
    });
  }

  async waitOtaStatus(expectedSecondByte: number, timeoutMs = 5000) {
    if (!this.ota) throw new Error('Connect OTA device first');
    if (this._otaInTap.active) {
      return this.waitOtaStatusFromTap(expectedSecondByte, timeoutMs);
    }
    const u8 = await this.waitInputReport(
      this.ota,
      (buf) => parseOtaStatusByte(buf, expectedSecondByte) !== null,
      timeoutMs
    );
    return u8 ? parseOtaStatusByte(u8, expectedSecondByte)! : null;
  }

  /**
   * 等价 Python `wait_reply(comm_fd, expected_cmd, timeout)`。
   * 热路径下 IN 由 tap 缓存，burst OUT 期间到达的应答不会丢。
   */
  async waitReplyOta(expectedSecondByte: number, timeoutMs: number): Promise<number | null> {
    if (!this.ota) throw new Error('Connect OTA device first');
    if (this._otaInTap.active) {
      return this.waitOtaStatusFromTap(expectedSecondByte, timeoutMs);
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const remaining = timeoutMs - (Date.now() - start);
      const slice = Math.min(1000, Math.max(1, remaining));
      const st = await this.waitOtaStatus(expectedSecondByte, slice);
      if (st !== null) return st;
    }
    return null;
  }

  buildUpgradeStartPacket(upgradeType: number, dataSize: number) {
    const packet = new Uint8Array(20);
    packet[0] = 0xff;
    packet[1] = 0x64;
    packet[2] = upgradeType;
    packet[3] = WEBHID_UPGRADE_CONSTANTS.SEND_SIZE & 0xff;
    packet[4] = (WEBHID_UPGRADE_CONSTANTS.SEND_SIZE >> 8) & 0xff;
    if (dataSize > 0) {
      const v = new DataView(packet.buffer);
      v.setUint32(5, dataSize >>> 0, true);
    }
    const cksum = calcChecksum(packet.subarray(0, 18));
    packet[18] = cksum & 0xff;
    packet[19] = (cksum >> 8) & 0xff;
    return packet;
  }

  /**
   * 与 Python `download_fw_data` 一致：仅连续发送 0xff 0x68 分包，不在此处读 IN。
   * 应答在 `transferFirmware` 里每段发送结束后用 `waitOtaStatus(0x70)` 收取。
   */
  async downloadFwData(fwSlice: Uint8Array): Promise<void> {
    if (!this.ota) throw new Error('Connect OTA device first');
    if (!fwSlice.length) return;
    const sendSize = WEBHID_UPGRADE_CONSTANTS.SEND_SIZE;
    const device = this.ota;
    const sendOne = async (chunk: Uint8Array) => {
      const header = new Uint8Array([0xff, 0x68]);
      const part = new Uint8Array(header.length + chunk.length);
      part.set(header, 0);
      part.set(chunk, header.length);
      const cksum = calcChecksum(part);
      const tail = new Uint8Array([cksum & 0xff, (cksum >> 8) & 0xff]);
      const packet = new Uint8Array(part.length + tail.length);
      packet.set(part, 0);
      packet.set(tail, part.length);
      if (this._otaXferHotPath) {
        await this.sendOtaDataReportFast(packet);
      } else {
        await this.sendOtaDataReport(packet);
      }
    };

    if (this._otaXferHotPath) {
      const cached = this._outputProfileByDevice.get(device);
      if (cached) {
        await withHidOutputWriteLock(device, async () => {
          for (let i = 0; i < fwSlice.length; i += sendSize) {
            let chunk = fwSlice.subarray(i, i + sendSize);
            if (chunk.length < sendSize) {
              const p = new Uint8Array(sendSize);
              p.set(chunk);
              chunk = p;
            }
            const header = new Uint8Array([0xff, 0x68]);
            const part = new Uint8Array(header.length + chunk.length);
            part.set(header, 0);
            part.set(chunk, header.length);
            const cksum = calcChecksum(part);
            const tail = new Uint8Array([cksum & 0xff, (cksum >> 8) & 0xff]);
            const packet = new Uint8Array(part.length + tail.length);
            packet.set(part, 0);
            packet.set(tail, part.length);
            await hidSendReportFast(device, cached.reportId, padReport(packet, cached.byteLength));
          }
        });
        return;
      }
    }

    for (let i = 0; i < fwSlice.length; i += sendSize) {
      let chunk = fwSlice.subarray(i, i + sendSize);
      if (chunk.length < sendSize) {
        const p = new Uint8Array(sendSize);
        p.set(chunk);
        chunk = p;
      }
      await sendOne(chunk);
    }
  }

  async transferFirmware(
    firmware: ArrayBuffer | Uint8Array,
    onProgress?: (ratio01: number) => void
  ) {
    const fw = firmware instanceof Uint8Array ? firmware : new Uint8Array(firmware);
    if (!this.ota) throw new Error('Connect OTA device first');
    this._suspendOtaScreenKeepaliveForTransfer();
    this._enterOtaXferHotPath();
    try {
      await this.open(this.ota);
      if (this._otaBorrowedFromScreen) {
        this.screenDeviceComm?.resetLcdStateForOta?.();
        const d = this.screenDeviceComm?.getScreenHidDevice?.();
        if (d) resetHidOutputWriteLockChain(d);
        await sleep(80);
        await this.discardQueuedOtaInReports(48, 40);
      }

      const { BIN_HEADER_SIZE, UPGRADE_CHUNK_SIZE } = WEBHID_UPGRADE_CONSTANTS;
      if (fw.length < BIN_HEADER_SIZE) throw new Error('Firmware smaller than bin header');
      const payloadLen = fw.length - BIN_HEADER_SIZE;
      if (payloadLen <= 0) throw new Error('Firmware has no payload after bin header');

      /** 与 Python `download_firmware` / `send_upgrade_start_cmd(..., data_size=len(fw_data))` 一致：整文件长度 */
      const fwTotalLen = fw.length;
      let reply: number | null = null;
      const { OTA_OUT_PACKET_WATCHDOG_MS } = WEBHID_UPGRADE_CONSTANTS;
      for (let i = 0; i < 10; i++) {
        await this.sendReportWithOtaWatchdog(
          this.ota,
          this.buildUpgradeStartPacket(0x01, fwTotalLen),
          OTA_OUT_PACKET_WATCHDOG_MS,
          `固件起始命令 OUT 超时。请确认升级中已禁止屏幕轮询（setDownLoad + setIsDownloading）。`
        );
        reply = await this.waitReplyOta(0x70, 5000);
        if (reply === 0x00) break;
        await sleep(100);
      }
      if (reply !== 0x00) throw new Error(`Firmware start failed, status=${reply}`);

      const imgHeader = fw.subarray(0, BIN_HEADER_SIZE);
      await this.downloadFwData(imgHeader);
      reply = await this.waitReplyOta(0x70, 5000);
      if (reply !== 0x01) throw new Error(`Firmware header verification failed, status=${reply}`);
      onProgress?.(BIN_HEADER_SIZE / fw.length);

      for (let off = BIN_HEADER_SIZE; off < fw.length; off += UPGRADE_CHUNK_SIZE) {
        const chunk = fw.subarray(off, off + UPGRADE_CHUNK_SIZE);
        await this.downloadFwData(chunk);
        const chunkEnd = off + chunk.length;
        reply = await this.waitReplyOta(0x70, 5000);
        if (reply !== 0x02) {
          reply = await this.waitFirmwareChunkAckWithProbes(fw, off, chunkEnd);
        }
        if (reply !== 0x02) throw new Error(`Firmware chunk failed at ${off}, status=${reply}`);
        onProgress?.(Math.min(1, chunkEnd / fw.length));
      }

      reply = await this.waitReplyOta(0x70, 5000);
      if (reply !== 0x03) throw new Error(`Firmware completion failed, status=${reply}`);
      onProgress?.(1);
      return true;
    } finally {
      this._leaveOtaXferHotPath();
      this._resumeOtaScreenKeepaliveAfterTransfer();
    }
  }

  async sendImageErase(startAddr: number, size: number) {
    if (!this.ota) throw new Error('Connect OTA device first');
    const eraseData = new Uint8Array(8);
    const dv = new DataView(eraseData.buffer);
    dv.setUint32(0, startAddr >>> 0, true);
    dv.setUint32(4, size >>> 0, true);
    const { OTA_PROTO_IMAGE_ERASE } = WEBHID_UPGRADE_CONSTANTS;
    const packet = buildOtaPacket(OTA_PROTO_IMAGE_ERASE, eraseData, 8);

    const deadline = Date.now() + WEBHID_UPGRADE_CONSTANTS.IMAGE_ERASE_TIMEOUT_S * 1000;
    let eraseCmdSent = false;
    while (Date.now() < deadline) {
      const ackP = this.waitInputReport(
        this.ota,
        (buf) => parseOtaStatusByte(buf, OTA_PROTO_IMAGE_ERASE) !== null,
        2500
      );
      if (!eraseCmdSent) {
        await this.sendReportWithOtaWatchdog(
          this.ota,
          packet,
          WEBHID_UPGRADE_CONSTANTS.OTA_OUT_PACKET_WATCHDOG_MS,
          '图传擦除命令 OUT 超时。请确认升级中已禁止屏幕轮询（setDownLoad + setIsDownloading）。'
        );
        eraseCmdSent = true;
      }
      const u8 = await ackP;
      if (!u8) continue;
      const st = parseOtaStatusByte(u8, OTA_PROTO_IMAGE_ERASE);
      if (st == null) continue;
      if (st === 0x10) return true;
      if (st === 0x11) {
        await sleep(500);
        continue;
      }
      throw new Error(`Image erase failed, status=0x${st.toString(16)}`);
    }
    throw new Error('Image erase timeout');
  }

  async sendImageStart(imageSize: number, startAddr: number) {
    if (!this.ota) throw new Error('Connect OTA device first');
    const startData = new Uint8Array(8);
    const dv = new DataView(startData.buffer);
    dv.setUint32(0, imageSize >>> 0, true);
    startData[4] = startAddr & 0xff;
    startData[5] = (startAddr >> 8) & 0xff;
    startData[6] = (startAddr >> 16) & 0xff;
    startData[7] = 0x00;
    const { OTA_PROTO_IMAGE_START } = WEBHID_UPGRADE_CONSTANTS;
    const packet = buildOtaPacket(OTA_PROTO_IMAGE_START, startData, 8);
    const matchStart = (buf: Uint8Array) => parseOtaStatusByte(buf, OTA_PROTO_IMAGE_START) !== null;

    const firstAck = this.waitInputReport(this.ota, matchStart, 1200);
    await this.sendReportWithOtaWatchdog(
      this.ota,
      packet,
      WEBHID_UPGRADE_CONSTANTS.OTA_OUT_PACKET_WATCHDOG_MS,
      '图传开始命令 OUT 超时。请确认升级中已禁止屏幕轮询（setDownLoad + setIsDownloading）。'
    );
    for (let k = 0; k < 10; k++) {
      const u8 = k === 0 ? await firstAck : await this.waitInputReport(this.ota, matchStart, 1200);
      const st = u8 ? parseOtaStatusByte(u8, OTA_PROTO_IMAGE_START) : null;
      if (st === 0x00) return true;
      await sleep(100);
    }
    throw new Error('Image start timeout');
  }

  buildImageDataPacketFast(offset: number, data57: Uint8Array) {
    const header = new Uint8Array([0xff, WEBHID_UPGRADE_CONSTANTS.OTA_PROTO_IMAGE_DATA]);
    const off = new Uint8Array([offset & 0xff, (offset >> 8) & 0xff, (offset >> 16) & 0xff]);
    const part = new Uint8Array(header.length + off.length + data57.length);
    part.set(header, 0);
    part.set(off, header.length);
    part.set(data57, header.length + off.length);
    const cksum = calcChecksum(part);
    const tail = new Uint8Array([cksum & 0xff, (cksum >> 8) & 0xff]);
    const out = new Uint8Array(part.length + tail.length);
    out.set(part, 0);
    out.set(tail, part.length);
    return out;
  }

  /** bulk/图传重试前：清 IN 队列、LCD 指令队列与 HID OUT 写锁链 */
  private async prepareOtaTransferRetry(reason: string) {
    ufl.warn('OTA 图传 bulk 重试', reason);
    if (this._otaBorrowedFromScreen) {
      this.screenDeviceComm?.resetLcdStateForOta?.();
      const d = this.screenDeviceComm?.getScreenHidDevice?.();
      if (d) resetHidOutputWriteLockChain(d);
    }
    if (this.ota) await this.discardQueuedOtaInReports(64, 45);
    this.clearOtaInTapQueue();
    await sleep(WEBHID_UPGRADE_CONSTANTS.IMAGE_BULK_RETRY_DELAY_MS);
  }

  private isImageDataAckOk(st: number | null, expectFinal: boolean): boolean {
    if (st === null) return false;
    return expectFinal ? st === 0x03 : st === 0x02 || st === 0x03;
  }

  /** 热路径：单次持锁连续发多包 0x66 */
  private async sendImageBurst(
    img: Uint8Array,
    startAddr: number,
    fromByte: number,
    toByte: number,
    imageSize: number
  ): Promise<number> {
    if (!this.ota || fromByte >= toByte) return fromByte;
    const { IMAGE_SEND_SIZE } = WEBHID_UPGRADE_CONSTANTS;
    const device = this.ota;
    const cached = this._outputProfileByDevice.get(device);

    const emit = async (fileByte: number) => {
      let sendData = img.subarray(fileByte, Math.min(fileByte + IMAGE_SEND_SIZE, imageSize));
      if (sendData.length < IMAGE_SEND_SIZE) {
        const p = new Uint8Array(IMAGE_SEND_SIZE);
        p.set(sendData);
        sendData = p;
      }
      const packet = this.buildImageDataPacketFast(startAddr + fileByte, sendData);
      if (cached && this._otaXferHotPath) {
        await hidSendReportFast(device, cached.reportId, padReport(packet, cached.byteLength));
      } else if (this._otaXferHotPath) {
        await this.sendOtaDataReportFast(packet);
      } else {
        await this.sendOtaDataReport(packet);
      }
    };

    if (cached && this._otaXferHotPath) {
      await withHidOutputWriteLock(device, async () => {
        for (let fb = fromByte; fb < toByte; fb += IMAGE_SEND_SIZE) {
          let sendData = img.subarray(fb, Math.min(fb + IMAGE_SEND_SIZE, imageSize));
          if (sendData.length < IMAGE_SEND_SIZE) {
            const p = new Uint8Array(IMAGE_SEND_SIZE);
            p.set(sendData);
            sendData = p;
          }
          const packet = this.buildImageDataPacketFast(startAddr + fb, sendData);
          await hidSendReportFast(device, cached.reportId, padReport(packet, cached.byteLength));
        }
      });
      return Math.min(toByte, imageSize);
    }

    for (let fb = fromByte; fb < toByte; fb += IMAGE_SEND_SIZE) {
      await emit(fb);
    }
    return Math.min(toByte, imageSize);
  }

  /**
   * 与 Python `download_image_data_chunk_fast` 一致：
   * 在 [chunkFileStart, chunkFileEnd) 内 burst 发 0x66；满 100 包 wait_reply(1000ms) 收 0x02 并继续；
   * 全图最后一包 wait_reply 收 0x03。
   */
  private async downloadImageChunkFast(
    img: Uint8Array,
    startAddr: number,
    chunkFileStart: number,
    chunkFileEnd: number,
    imageSize: number,
    onProgress?: (sentEnd: number) => void
  ): Promise<number | null> {
    const {
      BULK_ACK_COUNT,
      IMAGE_SEND_SIZE,
      OTA_PROTO_IMAGE_DATA,
      IMAGE_BULK_REPLY_MS,
    } = WEBHID_UPGRADE_CONSTANTS;

    let sentEnd = chunkFileStart;
    let packetsSinceReset = 0;

    while (sentEnd < chunkFileEnd) {
      const packetsUntilBulk = BULK_ACK_COUNT - packetsSinceReset;
      const remainingInChunk = Math.ceil((chunkFileEnd - sentEnd) / IMAGE_SEND_SIZE);
      const burstPackets = Math.min(packetsUntilBulk, remainingInChunk);
      const burstEnd = Math.min(chunkFileEnd, sentEnd + burstPackets * IMAGE_SEND_SIZE);

      const sentBefore = sentEnd;
      sentEnd = await this.sendImageBurst(img, startAddr, sentEnd, burstEnd, imageSize);
      packetsSinceReset += Math.ceil((sentEnd - sentBefore) / IMAGE_SEND_SIZE);
      onProgress?.(sentEnd);

      const isFinalInImage = sentEnd >= imageSize;

      if (isFinalInImage) {
        let st = this.takeOtaStatusFromTap(OTA_PROTO_IMAGE_DATA);
        if (st === null) {
          st = await this.waitReplyOta(OTA_PROTO_IMAGE_DATA, IMAGE_BULK_REPLY_MS);
        }
        if (st === 0x03) return st;
        st = await this.waitImageDataAck(true);
        return st;
      }

      if (packetsSinceReset < BULK_ACK_COUNT) {
        continue;
      }

      // Python: 满 100 包 wait_reply(1000)；收到 0x02 立即继续 burst，无二次 8s 死等
      let st = this.takeOtaStatusFromTap(OTA_PROTO_IMAGE_DATA);
      if (st === null) {
        st = await this.waitReplyOta(OTA_PROTO_IMAGE_DATA, IMAGE_BULK_REPLY_MS);
      }
      if (st === 0x02) {
        packetsSinceReset = 0;
        continue;
      }
      if (st === 0x03) return st;
      if (st !== null) {
        ufl.info('OTA 图传 IN 重新计数 bulk', `status=0x${st.toString(16)} pos=0x${sentEnd.toString(16)}`);
        packetsSinceReset = 0;
        continue;
      }

      ufl.warn(
        'OTA bulk 100包 1s 内无应答',
        `pos=0x${sentEnd.toString(16)} chunk=0x${chunkFileStart.toString(16)}`
      );
      return null;
    }

    return 0x02;
  }

  /** 热路径：单次持锁连续发多包 0x68（固件探测补发） */
  private async sendFirmwareBurst(
    fw: Uint8Array,
    fromOff: number,
    toOff: number
  ): Promise<number> {
    if (!this.ota || fromOff >= toOff) return fromOff;
    const { SEND_SIZE } = WEBHID_UPGRADE_CONSTANTS;
    const device = this.ota;
    const cached = this._outputProfileByDevice.get(device);

    const buildPacket = (chunk: Uint8Array) => {
      const header = new Uint8Array([0xff, 0x68]);
      const part = new Uint8Array(header.length + chunk.length);
      part.set(header, 0);
      part.set(chunk, header.length);
      const cksum = calcChecksum(part);
      const tail = new Uint8Array([cksum & 0xff, (cksum >> 8) & 0xff]);
      const packet = new Uint8Array(part.length + tail.length);
      packet.set(part, 0);
      packet.set(tail, part.length);
      return packet;
    };

    const emitOne = async (off: number) => {
      let chunk = fw.subarray(off, Math.min(off + SEND_SIZE, fw.length));
      if (chunk.length < SEND_SIZE) {
        const p = new Uint8Array(SEND_SIZE);
        p.set(chunk);
        chunk = p;
      }
      const packet = buildPacket(chunk);
      if (cached && this._otaXferHotPath) {
        await hidSendReportFast(device, cached.reportId, padReport(packet, cached.byteLength));
      } else if (this._otaXferHotPath) {
        await this.sendOtaDataReportFast(packet);
      } else {
        await this.sendOtaDataReport(packet);
      }
    };

    if (cached && this._otaXferHotPath) {
      await withHidOutputWriteLock(device, async () => {
        for (let off = fromOff; off < toOff; off += SEND_SIZE) {
          let chunk = fw.subarray(off, Math.min(off + SEND_SIZE, fw.length));
          if (chunk.length < SEND_SIZE) {
            const p = new Uint8Array(SEND_SIZE);
            p.set(chunk);
            chunk = p;
          }
          const packet = buildPacket(chunk);
          await hidSendReportFast(device, cached.reportId, padReport(packet, cached.byteLength));
        }
      });
      return Math.min(toOff, fw.length);
    }

    for (let off = fromOff; off < toOff; off += SEND_SIZE) {
      await emitOne(off);
    }
    return Math.min(toOff, fw.length);
  }

  /** 固件补发探测：仅在 bulk 100 包边界 poll IN */
  private async streamFirmwareProbeWithInCheck(
    fw: Uint8Array,
    startOff: number
  ): Promise<{ status: number | null; endOff: number }> {
    const {
      BULK_ACK_COUNT,
      SEND_SIZE,
      OTA_ACK_IN_POLL_MS,
      OTA_ACK_PROBE_WAIT_MS,
    } = WEBHID_UPGRADE_CONSTANTS;
    let off = startOff;
    let packetsSinceReset = 0;

    while (off < fw.length) {
      const packetsUntilBulk = BULK_ACK_COUNT - packetsSinceReset;
      const remainingPackets = Math.ceil((fw.length - off) / SEND_SIZE);
      const burstPackets = Math.min(packetsUntilBulk, remainingPackets);
      const burstEnd = Math.min(fw.length, off + burstPackets * SEND_SIZE);

      const offBefore = off;
      off = await this.sendFirmwareBurst(fw, off, burstEnd);
      const burstCount = Math.ceil((off - offBefore) / SEND_SIZE);
      packetsSinceReset += burstCount;

      const isLast = off >= fw.length;
      if (!isLast && packetsSinceReset < BULK_ACK_COUNT) {
        continue;
      }

      const st = await this.waitReplyOta(0x70, OTA_ACK_IN_POLL_MS);
      if (st === 0x02) {
        return { status: st, endOff: off };
      }
      if (st !== null) {
        ufl.info('OTA 固件 IN 重新计数 bulk', `status=0x${st.toString(16)} off=0x${off.toString(16)}`);
        packetsSinceReset = 0;
        continue;
      }

      const bulkSt = await this.waitReplyOta(0x70, OTA_ACK_PROBE_WAIT_MS);
      if (bulkSt === 0x02) {
        return { status: bulkSt, endOff: off };
      }
      ufl.warn(
        'OTA 固件 bulk 100包无有效应答，继续发送',
        `off=0x${off.toString(16)} last=0x${(bulkSt ?? -1).toString(16)}`
      );
      packetsSinceReset = 0;
    }

    return { status: null, endOff: off };
  }

  /** 固件 4K 块：主路径 wait_reply；无应答时再补发探测 */
  private async waitFirmwareChunkAckWithProbes(
    fw: Uint8Array,
    chunkOff: number,
    chunkEnd: number
  ): Promise<number | null> {
    let st = await this.waitReplyOta(0x70, WEBHID_UPGRADE_CONSTANTS.OTA_ACK_PROBE_WAIT_MS);
    if (st === 0x02) return st;

    ufl.warn('OTA 固件块无应答，补发探测包', `off=0x${chunkOff.toString(16)}`);
    const probe = await this.streamFirmwareProbeWithInCheck(fw, chunkEnd);
    if (probe.status === 0x02) return probe.status;

    st = await this.waitReplyOta(0x70, 5000);
    if (st === 0x02) return st;
    await sleep(120);
    return this.waitReplyOta(0x70, 5000);
  }

  /** 图传 0x66 bulk/最后一包：多次 waitReply，与原先三次等待一致 */
  private async waitImageDataAck(expectFinal: boolean): Promise<number | null> {
    const { OTA_PROTO_IMAGE_DATA, IMAGE_DATA_BULK_WAIT_REPLY_MS, IMAGE_DATA_FINAL_WAIT_REPLY_MS } =
      WEBHID_UPGRADE_CONSTANTS;
    const primaryMs = expectFinal ? IMAGE_DATA_FINAL_WAIT_REPLY_MS : IMAGE_DATA_BULK_WAIT_REPLY_MS;
    let st = await this.waitReplyOta(OTA_PROTO_IMAGE_DATA, primaryMs);
    if (this.isImageDataAckOk(st, expectFinal)) return st;
    await sleep(120);
    st = await this.waitReplyOta(
      OTA_PROTO_IMAGE_DATA,
      expectFinal ? 4000 : IMAGE_DATA_BULK_WAIT_REPLY_MS
    );
    if (this.isImageDataAckOk(st, expectFinal)) return st;
    await sleep(200);
    st = await this.waitReplyOta(OTA_PROTO_IMAGE_DATA, primaryMs);
    return st;
  }

  async transferImage(
    imageData: Uint8Array,
    startAddr: number = WEBHID_UPGRADE_CONSTANTS.IMAGE_FLASH_START_ADDR as number,
    onProgress?: (ratio01: number) => void
  ) {
    const img = imageData instanceof Uint8Array ? imageData : new Uint8Array(imageData);
    if (!img.length) throw new Error('Image buffer is empty');
    if (!this.ota) throw new Error('Connect OTA device first');
    this._suspendOtaScreenKeepaliveForTransfer();
    this._enterOtaXferHotPath();
    try {
      await this.open(this.ota);
      if (this._otaBorrowedFromScreen) {
        this.screenDeviceComm?.resetLcdStateForOta?.();
        const d = this.screenDeviceComm?.getScreenHidDevice?.();
        if (d) resetHidOutputWriteLockChain(d);
        await sleep(80);
        await this.discardQueuedOtaInReports(48, 40);
      }

      const { IMAGE_BULK_MAX_RETRIES, IMAGE_CHUNK_SIZE, IMAGE_START_UI_WAIT_MS } =
        WEBHID_UPGRADE_CONSTANTS;
      const imageSize = img.length;

      // Python download_image_data: 0x65 start -> sleep(3) -> 0x61 erase -> 5700 分块 0x66
      ufl.info('OTA 图传步骤 1/3', '发送 IMAGE_START 0x65');
      await this.sendImageStart(imageSize, startAddr);
      ufl.info('OTA 图传步骤 2/3', `等待下载界面 ${IMAGE_START_UI_WAIT_MS}ms`);
      await sleep(IMAGE_START_UI_WAIT_MS);
      ufl.info('OTA 图传步骤 3/3', '发送 IMAGE_ERASE 0x61');
      await this.sendImageErase(startAddr, imageSize);
      ufl.info('OTA 图传数据', '开始发送 IMAGE_DATA 0x66');

      for (let chunkOff = 0; chunkOff < imageSize; chunkOff += IMAGE_CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkOff + IMAGE_CHUNK_SIZE, imageSize);
        let chunkStatus: number | null = null;
        let lastFailDetail = '';

        for (let attempt = 0; attempt <= IMAGE_BULK_MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            await this.prepareOtaTransferRetry(
              `图传 chunk 0x${chunkOff.toString(16)} 第 ${attempt}/${IMAGE_BULK_MAX_RETRIES} 次 ${lastFailDetail}`
            );
          }
          try {
            chunkStatus = await this.downloadImageChunkFast(
              img,
              startAddr,
              chunkOff,
              chunkEnd,
              imageSize,
              (end) => {
                onProgress?.(Math.min(1, end / imageSize));
              }
            );
            if (chunkStatus === 0x03) {
              onProgress?.(1);
              ufl.info('OTA image 传输完成', `size=0x${imageSize.toString(16)}`);
              return true;
            }
            if (chunkStatus === 0x02) break;
            lastFailDetail = `status=${chunkStatus ?? 'null'}`;
          } catch (e) {
            lastFailDetail = e instanceof Error ? e.message : String(e);
            ufl.warn('OTA image chunk OUT 失败', lastFailDetail);
          }
        }

        if (chunkStatus !== 0x02 && chunkStatus !== 0x03) {
          throw new Error(
            `Image chunk failed at 0x${chunkOff.toString(16)} after ${IMAGE_BULK_MAX_RETRIES} retries: ${lastFailDetail}`
          );
        }
      }

      onProgress?.(1);
      return true;
    } finally {
      this._leaveOtaXferHotPath();
      this._resumeOtaScreenKeepaliveAfterTransfer();
    }
  }

  async transferImageThenFirmware(
    opts: {
      firmware: ArrayBuffer | Uint8Array;
      image?: ArrayBuffer | Uint8Array | null;
      imageStartAddr?: number;
      /** doneBytes / totalBytes，按图包+固件实际字节加权 */
      onProgress?: (doneBytes: number, totalBytes: number) => void;
    }
  ) {
    const { firmware, image = null, imageStartAddr = WEBHID_UPGRADE_CONSTANTS.IMAGE_FLASH_START_ADDR, onProgress } =
      opts;
    const len = (b: ArrayBuffer | Uint8Array | null | undefined) => {
      if (!b) return 0;
      if (b instanceof ArrayBuffer) return b.byteLength;
      return b.byteLength;
    };
    const hasImage = len(image) > 0;
    const hasFw = len(firmware) > 0;
    if (!hasImage && !hasFw) throw new Error('Provide image and/or firmware buffer');

    const imgLen = len(image);
    const fwLen = len(firmware);
    const totalBytes = imgLen + fwLen;

    const emitBytes = (imgDone: number, fwDone: number) => {
      if (!onProgress || totalBytes <= 0) return;
      onProgress(Math.min(totalBytes, imgDone + fwDone), totalBytes);
    };

    if (hasImage && hasFw) {
      const im = image instanceof Uint8Array ? image : new Uint8Array(image as ArrayBuffer);
      await this.transferImage(im, imageStartAddr, (r) => {
        emitBytes(Math.min(imgLen, Math.floor(r * imgLen)), 0);
      });
      await sleep(120);
      const fw = firmware instanceof Uint8Array ? firmware : new Uint8Array(firmware as ArrayBuffer);
      await this.transferFirmware(fw, (r) => {
        emitBytes(imgLen, Math.min(fwLen, Math.floor(r * fwLen)));
      });
    } else if (hasImage) {
      const im = image instanceof Uint8Array ? image : new Uint8Array(image as ArrayBuffer);
      await this.transferImage(im, imageStartAddr, (r) => {
        emitBytes(Math.min(imgLen, Math.floor(r * imgLen)), 0);
      });
    } else {
      const fw = firmware instanceof Uint8Array ? firmware : new Uint8Array(firmware as ArrayBuffer);
      await this.transferFirmware(fw, (r) => {
        emitBytes(0, Math.min(fwLen, Math.floor(r * fwLen)));
      });
    }
    return true;
  }

  closeAll() {
    this.stopOtaScreenKeepalive();
    try {
      if (this.keyboard) this.forgetOutputProfile(this.keyboard);
      if (this.keyboard?.opened) void this.keyboard.close();
    } catch {
      /* */
    }
    try {
      if (this.ota) this.forgetOutputProfile(this.ota);
      if (!this._otaBorrowedFromScreen && this.ota?.opened) void this.ota.close();
    } catch {
      /* */
    }
    this.keyboard = null;
    this.ota = null;
    this._otaBorrowedFromScreen = false;
  }
}
