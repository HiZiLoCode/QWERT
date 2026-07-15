import { formatIapAckStatus, parseIapAck } from './iapAckParse';
import { formatOtaAckStatus, parseOtaAck } from './otaAckParse';

export type UpgradeFlowLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type UpgradeFlowLogEntry = {
  id: number;
  ts: number;
  level: UpgradeFlowLogLevel;
  source: string;
  message: string;
  detail?: string;
  /** 一笔下发 + 一笔收到的配对原始数据 */
  exchange?: {
    outLabel: string;
    outHex: string;
    inLabel: string;
    inHex: string;
    reportId?: number;
  };
};

export const UF_SOURCE = {
  KEYBOARD_IAP: 'keyboard-iap',
  KEYBOARD_8K: 'keyboard-8k',
  SCREEN_OTA: 'screen-ota',
  DONGLE_IAP: 'dongle-iap',
} as const;

type Listener = () => void;

const MAX_ENTRIES = 3000;
const DEFAULT_HEX_MAX = 64;

/** 将字节数组格式化为十六进制字符串 */
export function formatBytesHex(data: ArrayLike<number>, maxBytes = DEFAULT_HEX_MAX): string {
  const len = data.length;
  if (len === 0) return '(empty)';
  const n = Math.min(len, maxBytes);
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    parts.push(Number(data[i]).toString(16).padStart(2, '0').toUpperCase());
  }
  const hex = parts.join(' ');
  return len > maxBytes ? `${hex} …(+${len - maxBytes}B)` : hex;
}

class UpgradeFlowLogStore {
  private entries: UpgradeFlowLogEntry[] = [];
  private nextId = 1;
  private listeners = new Set<Listener>();
  private enabled = true;
  private consoleMirror = false;
  private panelVisible = false;
  private dataLogEnabled = true;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  getEntries(): readonly UpgradeFlowLogEntry[] {
    return this.entries;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isConsoleMirror(): boolean {
    return this.consoleMirror;
  }

  isPanelVisible(): boolean {
    return this.panelVisible;
  }

  isDataLogEnabled(): boolean {
    return this.dataLogEnabled;
  }

  setDataLogEnabled(value: boolean): void {
    this.dataLogEnabled = value;
    this.emit();
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.emit();
  }

  setConsoleMirror(value: boolean): void {
    this.consoleMirror = value;
    this.emit();
  }

  setPanelVisible(value: boolean): void {
    this.panelVisible = value;
    this.emit();
  }

  showPanel(): void {
    this.setPanelVisible(true);
  }

  hidePanel(): void {
    this.setPanelVisible(false);
  }

  togglePanel(): boolean {
    this.setPanelVisible(!this.panelVisible);
    return this.panelVisible;
  }

  clear(): void {
    this.entries = [];
    this.emit();
  }

  /** 记录一笔下发 + 一笔收到（配对显示） */
  logExchange(
    source: string,
    outLabel: string,
    outData: ArrayLike<number>,
    inLabel: string,
    inData: ArrayLike<number> | null,
    reportId?: number,
    maxBytes = DEFAULT_HEX_MAX,
  ): void {
    if (!this.enabled || !this.dataLogEnabled) return;
    const rid = reportId !== undefined ? reportId : undefined;
    const inHex = inData && inData.length > 0 ? formatBytesHex(inData, maxBytes) : '(无应答)';
    const ackSuffix = inData ? formatInAckSuffix(source, inData) : '';
    this.log('info', source, '⇄ 收发', undefined, {
      exchange: {
        outLabel,
        outHex: formatBytesHex(outData, maxBytes),
        inLabel,
        inHex: `${inHex}${ackSuffix}`,
        reportId: rid,
      },
    });
  }

  log(
    level: UpgradeFlowLogLevel,
    source: string,
    message: string,
    detail?: string,
    extra?: Pick<UpgradeFlowLogEntry, 'exchange'>,
  ): void {
    if (!this.enabled) {
      return;
    }

    const entry: UpgradeFlowLogEntry = {
      id: this.nextId++,
      ts: Date.now(),
      level,
      source,
      message,
      detail,
      ...extra,
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }

    this.emit();
  }

  info(source: string, message: string, detail?: string): void {
    this.log('info', source, message, detail);
  }

  warn(source: string, message: string, detail?: string): void {
    this.log('warn', source, message, detail);
  }

  error(source: string, message: string, detail?: string): void {
    this.log('error', source, message, detail);
  }

  debug(source: string, message: string, detail?: string): void {
    this.log('debug', source, message, detail);
  }

  /** 记录下发原始数据 */
  logOut(
    source: string,
    label: string,
    data: ArrayLike<number>,
    reportId?: number,
    maxBytes = DEFAULT_HEX_MAX,
  ): void {
    if (!this.enabled || !this.dataLogEnabled) return;
    const rid = reportId !== undefined ? ` rid=0x${reportId.toString(16).toUpperCase()}` : '';
    this.log('info', source, `>> 下发${rid}`, `${label} | ${formatBytesHex(data, maxBytes)}`);
  }

  /** 记录收到原始数据 */
  logIn(
    source: string,
    label: string,
    data: ArrayLike<number>,
    reportId?: number,
    maxBytes = DEFAULT_HEX_MAX,
  ): void {
    if (!this.enabled || !this.dataLogEnabled) return;
    const rid = reportId !== undefined ? ` rid=0x${reportId.toString(16).toUpperCase()}` : '';
    const ackSuffix = formatInAckSuffix(source, data);
    this.log('info', source, `<< 收到${rid}`, `${label} | ${formatBytesHex(data, maxBytes)}${ackSuffix}`);
  }
}

function formatInAckSuffix(source: string, data: ArrayLike<number>): string {
  if (source === UF_SOURCE.SCREEN_OTA) {
    const ota = parseOtaAck(data);
    return ota ? ` | ${formatOtaAckStatus(ota)}` : '';
  }
  const ack = parseIapAck(data);
  return ack ? ` | ${formatIapAckStatus(ack)}` : '';
}

export const upgradeFlowLog = new UpgradeFlowLogStore();

export type UpgradeFlowLogConsoleApi = {
  show: () => void;
  hide: () => void;
  toggle: () => boolean;
  enable: () => void;
  disable: () => void;
  mirrorOn: () => void;
  mirrorOff: () => void;
  dataOn: () => void;
  dataOff: () => void;
  toggleData: () => boolean;
  clear: () => void;
  logs: () => readonly UpgradeFlowLogEntry[];
  help: () => string;
};

const HELP_TEXT = `
升级流程日志控制台 API（window.upgradeFlowLog）:
  show()       - 显示日志弹窗
  hide()       - 隐藏日志弹窗
  toggle()     - 切换弹窗显示
  enable()     - 开启日志采集
  disable()    - 关闭日志采集
  mirrorOn()   - （已禁用）不再输出到浏览器 console
  mirrorOff()  - 仅写入弹窗
  dataOn()     - 开启收发原始数据(hex)记录
  dataOff()    - 关闭收发原始数据记录
  toggleData() - 切换收发数据记录
  clear()      - 清空日志
  logs()       - 获取当前日志数组
  help()       - 显示本帮助
`.trim();

export function installUpgradeFlowLogConsoleApi(): void {
  if (typeof window === 'undefined') {
    return;
  }

  const api: UpgradeFlowLogConsoleApi = {
    show: () => upgradeFlowLog.showPanel(),
    hide: () => upgradeFlowLog.hidePanel(),
    toggle: () => upgradeFlowLog.togglePanel(),
    enable: () => upgradeFlowLog.setEnabled(true),
    disable: () => upgradeFlowLog.setEnabled(false),
    mirrorOn: () => upgradeFlowLog.setConsoleMirror(true),
    mirrorOff: () => upgradeFlowLog.setConsoleMirror(false),
    dataOn: () => upgradeFlowLog.setDataLogEnabled(true),
    dataOff: () => upgradeFlowLog.setDataLogEnabled(false),
    toggleData: () => {
      upgradeFlowLog.setDataLogEnabled(!upgradeFlowLog.isDataLogEnabled());
      return upgradeFlowLog.isDataLogEnabled();
    },
    clear: () => upgradeFlowLog.clear(),
    logs: () => upgradeFlowLog.getEntries(),
    help: () => HELP_TEXT,
  };

  (window as Window & { upgradeFlowLog?: UpgradeFlowLogConsoleApi }).upgradeFlowLog = api;
}

declare global {
  interface Window {
    upgradeFlowLog?: UpgradeFlowLogConsoleApi;
  }
}
