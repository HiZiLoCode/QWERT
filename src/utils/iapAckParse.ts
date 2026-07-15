export type IapAckInfo = {
  errCode: number;
  rspCmd: number | null;
};

const IAP_CMD_ACK = 0xb0;

const IAP_CMD_NAMES: Record<number, string> = {
  0xa0: 'START',
  0xa1: 'FLASH_WRITE',
  0xa2: 'FLASH_READ',
  0xa3: 'REBOOT',
  0xa4: 'SWITCH_APP',
  0xc0: 'SWITCH_BOOT',
  0xb0: 'ACK',
};

const ACK_CODE_MESSAGES: Record<number, string> = {
  0x00: '操作成功',
  0xe0: '未知命令',
  0xe1: '长度错误',
  0xe2: 'CRC错误',
  0xe3: '块号错误',
  0xe4: '块大小错误',
  0xe5: '写入偏移错误',
  0xe6: '读取偏移错误',
  0xe7: '参数错误',
  0xe8: 'Flash操作失败',
  0xe9: '状态不满足',
  0xf0: 'Header标识错误',
  0xf1: 'Header芯片ID错误',
  0xf3: 'Header硬件版本错误',
  0xf4: 'Header软件版本错误',
  0xf5: 'Header校验信息错误',
  0xf6: 'Header块信息错误',
};

function bccCheck(data: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += Number(data[i]);
  }
  return sum & 0xff;
}

export function getIapAckMessage(code: number): string {
  return ACK_CODE_MESSAGES[code] ?? `未知错误码 0x${code.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function getIapCmdName(cmd: number | null | undefined): string {
  if (cmd === null || cmd === undefined) return '未知';
  return IAP_CMD_NAMES[cmd] ?? `0x${cmd.toString(16).toUpperCase().padStart(2, '0')}`;
}

export function formatHexByte(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`;
}

/** 格式化 IAP ACK 状态：ErrCode + rspCmd */
export function formatIapAckStatus(ack: IapAckInfo): string {
  const err = `${formatHexByte(ack.errCode)} (${getIapAckMessage(ack.errCode)})`;
  if (ack.rspCmd === null) {
    return `ErrCode=${err}`;
  }
  return `ErrCode=${err} rspCmd=${formatHexByte(ack.rspCmd)} (${getIapCmdName(ack.rspCmd)})`;
}

/** 从原始 HID 数据解析 IAP ACK（支持直连 B0 与传输层 AA 两种格式） */
export function parseIapAck(data: ArrayLike<number>): IapAckInfo | null {
  if (data.length < 2) return null;

  // 格式1：直连 [0]=B0 [1]=ErrCode [2]=rspCmd
  if (data[0] === IAP_CMD_ACK) {
    return {
      errCode: Number(data[1]),
      rspCmd: data.length > 2 ? Number(data[2]) : null,
    };
  }

  if (data[0] !== 0xaa) return null;

  // 格式2：传输层 aa ... [6]=B0 [7]=ErrCode [8]=rspCmd
  if (data.length > 7 && data[6] === IAP_CMD_ACK) {
    return {
      errCode: Number(data[7]),
      rspCmd: data.length > 8 ? Number(data[8]) : null,
    };
  }

  if (data.length < 10) return null;

  const zeroHeader = Array.from({ length: 9 }, (_, i) => data[i + 1]).every((b) => b === 0);
  if (zeroHeader) return null;

  const len = Number(data[4]) | (Number(data[5]) << 8);
  if (len === 0 || 6 + len > data.length) return null;

  const bccCalc = bccCheck(Array.from({ length: 5 + len }, (_, i) => data[i + 1]));
  if (data[6 + len] !== bccCalc) return null;
  if (data[6] !== IAP_CMD_ACK) return null;

  return {
    errCode: Number(data[7]),
    rspCmd: data.length > 8 ? Number(data[8]) : null,
  };
}

/** 从日志 hex 文本中尝试解析 ACK（如 "AA 00 ... B0 E9 A0"） */
export function parseIapAckFromHexText(text: string): IapAckInfo | null {
  const bytes = text
    .replace(/[^0-9a-fA-F]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => parseInt(h, 16));

  if (bytes.length < 2 || bytes.some((b) => Number.isNaN(b))) return null;

  // 优先在 hex 流中定位 B0 应答头
  for (let i = 0; i < bytes.length - 1; i++) {
    if (bytes[i] !== IAP_CMD_ACK) continue;
    const ack = parseIapAck(bytes.slice(i));
    if (ack) return ack;
  }

  return parseIapAck(bytes);
}

/** 从日志 message/detail 文本提取已格式化的 ACK 状态 */
export function extractIapAckFromLogText(message: string, detail?: string): IapAckInfo | null {
  const combined = `${message} ${detail ?? ''}`;

  const errMatch = combined.match(/ErrCode\s*=\s*0x([0-9a-fA-F]{1,2})/i);
  const cmdMatch = combined.match(/rspCmd\s*=\s*0x([0-9a-fA-F]{1,2})/i);
  if (errMatch) {
    return {
      errCode: parseInt(errMatch[1], 16),
      rspCmd: cmdMatch ? parseInt(cmdMatch[1], 16) : null,
    };
  }

  return parseIapAckFromHexText(detail ?? combined);
}
