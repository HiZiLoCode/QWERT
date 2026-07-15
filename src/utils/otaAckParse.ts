export type OtaAckInfo = {
  cmd: number;
  status: number;
};

const OTA_CMD_NAMES: Record<number, string> = {
  0x61: 'IMAGE_ERASE',
  0x65: 'IMAGE_START',
  0x66: 'IMAGE_DATA',
  0x64: 'FW_START',
  0x68: 'FW_DATA',
  0x70: 'FW_STATUS',
};

const OTA_STATUS_MESSAGES: Record<number, Record<number, string>> = {
  0x61: { 0x10: '擦除完成', 0x11: '擦除中' },
  0x65: { 0x00: '开始就绪' },
  0x66: { 0x02: '块应答成功', 0x03: '图传完成' },
  0x70: {
    0x00: '固件起始就绪',
    0x01: 'Header 校验通过',
    0x02: '数据块写入成功',
    0x03: '固件写入完成',
  },
  0x64: { 0x00: '起始命令已接受' },
};

export function formatHexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function getOtaCmdName(cmd: number): string {
  return OTA_CMD_NAMES[cmd] ?? formatHexByte(cmd);
}

export function getOtaStatusMessage(cmd: number, status: number): string {
  return OTA_STATUS_MESSAGES[cmd]?.[status] ?? `状态 ${formatHexByte(status)}`;
}

/** OTA 应答是否视为成功（用于日志着色） */
export function isOtaAckSuccess(ack: OtaAckInfo): boolean {
  const { cmd, status } = ack;
  if (cmd === 0x61) return status === 0x10 || status === 0x11;
  if (cmd === 0x65) return status === 0x00;
  if (cmd === 0x66) return status === 0x02 || status === 0x03;
  if (cmd === 0x70) return status >= 0x00 && status <= 0x03;
  if (cmd === 0x64) return status === 0x00;
  return false;
}

export function formatOtaAckStatus(ack: OtaAckInfo): string {
  const cmdLabel = getOtaCmdName(ack.cmd);
  const stLabel = getOtaStatusMessage(ack.cmd, ack.status);
  return `OTA ${formatHexByte(ack.cmd)} (${cmdLabel}) status=${formatHexByte(ack.status)} (${stLabel})`;
}

/** 从 HID IN 扫描 `ff cmd status`（与 webhidScreenUpgrade.parseOtaStatusByte 一致） */
export function parseOtaAck(data: ArrayLike<number>): OtaAckInfo | null {
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const addr = 0xff;
  const maxOff = Math.min(8, Math.max(0, buf.length - 3));
  for (let off = 0; off <= maxOff; off++) {
    if (buf[off] === addr) {
      return { cmd: buf[off + 1]!, status: buf[off + 2]! };
    }
  }
  return null;
}

export function parseOtaAckFromHexText(text: string): OtaAckInfo | null {
  const bytes = text
    .replace(/[^0-9a-fA-F]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => parseInt(h, 16));
  if (bytes.length < 3 || bytes.some((b) => Number.isNaN(b))) return null;
  return parseOtaAck(bytes);
}

export function extractOtaAckFromLogText(message: string, detail?: string): OtaAckInfo | null {
  const combined = `${message} ${detail ?? ''}`;
  const m = combined.match(/OTA\s+0x([0-9a-fA-F]{1,2})\s+\([^)]+\)\s+status=0x([0-9a-fA-F]{1,2})/i);
  if (m) {
    return { cmd: parseInt(m[1], 16), status: parseInt(m[2], 16) };
  }
  return parseOtaAckFromHexText(detail ?? combined);
}
