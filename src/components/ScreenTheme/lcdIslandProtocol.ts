/**
 * 灵动岛 / LCD：0x14 读功能区、0x15 写功能区、0x18 擦除（与协议表一致）
 *
 * 基础 / 个性化灵动岛在网页侧共用同一套上传 UI；固件侧为两套资源（展示与存储互相独立）。
 * 协议表固定 2 张：第 1 条=基础（逻辑区 0-based 下标 3–7），第 2 条=个性化（8–12）。
 * 下发 0x15：从 0x14 按 `logicalStartIndex` 原样拷贝 13 字节；只改正在保存的一侧 5 字节（岛0→3–7，岛1→8–12），另一侧保持读回字节不变；然后 [0] 情景=0、[1] 张数固定 0x02、[2] 使用大小按两岛 size 重算（线序：profile、张数、64K 使用大小、再两条 5 字节）。
 * 相册多图合并为一条 size（总长），meta 里张数不变。
 * 通过 0x18[7] islandMode 与侧栏 tab 选择擦除「基础」或「个性化」存储区。
 * 0x19 写 FLASH 分包 `buffer[7]`：与 0x18[7] 相同，仅 `0x00`=基础灵动岛、`0x01`=个性化（当前写入哪一侧就填哪个值）。
 * 0x18 擦除：`await setData` 只表示命令已送达，片内擦除仍异步；发 0x19 前须 `settleAfterLcdEraseCommand` 等足时间。
 */
import type { ScreenThemeTab, TransitionKind } from "./types";

/** 0x18 擦除 / 0x19 写图 buffer[7]：基础灵动岛（独立存储区） */
export const LCD_ERASE_ISLAND_BASIC = 0;
/** 0x18 擦除 / 0x19 写图 buffer[7]：个性化灵动岛（独立存储区） */
export const LCD_ERASE_ISLAND_PERSONAL = 1;

/** 侧栏「基础灵动岛」→ 0，「个性化」/「打字」等 → 1（与固件两套存储对应） */
export function screenThemeTabToEraseIslandMode(tab: ScreenThemeTab): 0 | 1 {
  return tab === "basic" ? LCD_ERASE_ISLAND_BASIC : LCD_ERASE_ISLAND_PERSONAL;
}

/**
 * 与 `mediaEditIsland`（基础/个性草稿轴）一致，供 0x18 擦除、0x19 写图与 `fillLcdEraseBuffer` 使用同一岛号。
 * 勿用 `screenThemeTabToEraseIslandMode(activeTab)` 上传媒体：`activeTab === "typing"` 时会错当成个性岛。
 */
export function lcdEraseIslandModeFromMediaIsland(island: "basic" | "personal"): 0 | 1 {
  return island === "basic" ? LCD_ERASE_ISLAND_BASIC : LCD_ERASE_ISLAND_PERSONAL;
}

/** 下发时 meta：`islandMode` 同时决定 0x15 补丁哪一侧 5 字节、0x18/0x19 目标（与 `mediaEditIsland` 一致） */
export type LcdScreenTransferMeta = {
  profile?: number;
  metaByte: number;
  /** 0=基础 1=个性：0x15 `islandBeingSaved`、0x18/0x19 buffer[7] */
  islandMode: 0 | 1;
};

/** 协议表：切换间隔 0–5 → 秒 */
export const LCD_INTERVAL_CODE_SECONDS = [3, 5, 10, 30, 60, 180] as const;

/**
 * 65 字节 HID 里 13 字节功能区起始下标（与 0x15 首包 `b0.set(logical, W15_FUN_FIRST)` 一致）。
 * 按实机抓包：从 0-based 下标 9 开始。
 */
export const LCD_REPORT_WORK_LOGICAL_OFFSET = 9;
const W15_FUN_FIRST = LCD_REPORT_WORK_LOGICAL_OFFSET;
const W15_FUN_LAST = 64;
const W15_BYTES_FIRST = W15_FUN_LAST - W15_FUN_FIRST + 1;
const W15_ENTRY_START = 12;
const W15_TAIL_NEXT = W15_FUN_LAST - W15_ENTRY_START + 1;
const W15_TAIL_LAST = 16;

/** 0x15 功能区 logical 最大长度（分包总长） */
export const W15_LOGICAL_MAX = W15_BYTES_FIRST + W15_TAIL_NEXT + W15_TAIL_LAST;

export type LcdImageWorkEntry = { metaByte: number; type: 0 | 1; size: number };

/** 0x14 读回的功能区逻辑区（与 buildWorkParamLogical15 布局一致，从应答包内偏移开始） */
export type ParsedLcdWork14 = {
  profile: number;
  imageCount: number;
  flashBlocks: number;
  entries: LcdImageWorkEntry[];
};

/** 带本次解析到的逻辑区在 report 内的起始下标（用于从原始应答逐字节拷贝） */
export type ParsedLcdWork14WithOffset = ParsedLcdWork14 & { logicalStartIndex: number };

/** 与 0x15 首包写入位置一致 */
export const LCD_READ14_LOGICAL_OFFSET = LCD_REPORT_WORK_LOGICAL_OFFSET;

/** 两张图时功能区逻辑区总长：profile + 张数 + 使用大小 + 2×(meta,type,size24)（头 3 字节） */
export const LCD_DUAL_ISLAND_WORK_LOGICAL_LEN = 3 + 2 * 5;

/** 下发 0x15 时情景模式固定 0 */
export const LCD_WORK_PARAM_PROFILE_SEND = 0;

/** 下发 0x15 时「图片张数」固定为 2（基础 + 个性） */
export const LCD_WORK_PARAM_IMAGE_COUNT_SEND = 0x02;

/** 另一套灵动岛在合并表中暂无数据时的占位（避免只写一条把第二条冲掉） */
export const LCD_EMPTY_ISLAND_WORK_ENTRY: LcdImageWorkEntry = { metaByte: 0, type: 0, size: 0 };

const MAX_LCD_RESOURCE_BYTES = 16 * 1024 * 1024;

function tryParseLcdWorkLogicalAt(resp: readonly number[], start: number): ParsedLcdWork14 | null {
  if (resp.length < start + 3) return null;
  const profile = resp[start] ?? 0;
  const imageCount = resp[start + 1] ?? 0;
  const flashBlocks = resp[start + 2] ?? 0;
  if (imageCount < 1 || imageCount > 16) return null;
  const needBytes = 3 + imageCount * 5;
  if (resp.length < start + needBytes) return null;
  const entries: LcdImageWorkEntry[] = [];
  let p = start + 3;
  for (let i = 0; i < imageCount; i++) {
    const metaByte = resp[p++] ?? 0;
    const typeRaw = resp[p++] ?? 0;
    const lo = resp[p++] ?? 0;
    const mid = resp[p++] ?? 0;
    const hi = resp[p++] ?? 0;
    const size = lo | (mid << 8) | (hi << 16);
    if (size < 0 || size > MAX_LCD_RESOURCE_BYTES) return null;
    const type: 0 | 1 = typeRaw === 1 ? 1 : 0;
    entries.push({ metaByte, type, size });
  }
  return { profile, imageCount, flashBlocks, entries };
}

/**
 * 解析 0x14 读功能区应答：与 buildWorkParamLogical15 相同顺序
 * [profile][imageCount][flashBlocks64k] + 每项 5 字节(meta,type,size24le)
 *
 * 先试 `LCD_READ14_LOGICAL_OFFSET`，再试相邻下标兼容报表差异。
 */
export function parseLcdWorkAreaFromRead14Response(resp: readonly number[]): ParsedLcdWork14WithOffset | null {
  const base = LCD_READ14_LOGICAL_OFFSET;
  let fallback: ParsedLcdWork14WithOffset | null = null;
  for (const start of [base, base + 1, base - 1, base + 2]) {
    if (start < 0) continue;
    const parsed = tryParseLcdWorkLogicalAt(resp, start);
    if (!parsed) continue;
    const out = { ...parsed, logicalStartIndex: start };
    if (parsed.imageCount === LCD_WORK_PARAM_IMAGE_COUNT_SEND) return out;
    if (!fallback) fallback = out;
  }
  return fallback;
}

export type LcdWorkParam14ReadResult = {
  parsed: ParsedLcdWork14WithOffset;
  rawResponse: number[];
};

export async function readLcdWorkParam14(deviceComm: {
  setData: (data: number[]) => Promise<unknown>;
}): Promise<LcdWorkParam14ReadResult | null> {
  const readFuncBuffer = new Uint8Array(65);
  readFuncBuffer[1] = 0xaa;
  readFuncBuffer[2] = 0x14;
  readFuncBuffer[6] = 0x38;
  const resp = (await deviceComm.setData(Array.from(readFuncBuffer))) as number[] | undefined;
  if (!Array.isArray(resp)) return null;
  const parsed = parseLcdWorkAreaFromRead14Response(resp);
  if (!parsed) return null;
  return { parsed, rawResponse: [...resp] };
}

/** 协议第 3 字节「使用大小」：两岛各占 64K 块数之和，至少 1，最大 255 */
export function lcdWorkFlashUsageByteFromTwoEntries(e0: LcdImageWorkEntry, e1: LcdImageWorkEntry): number {
  const b0 = e0.size > 0 ? Math.ceil(e0.size / (64 * 1024)) : 0;
  const b1 = e1.size > 0 ? Math.ceil(e1.size / (64 * 1024)) : 0;
  const t = b0 + b1;
  return Math.min(255, Math.max(1, t));
}

/**
 * 从 0x14 原始应答按 `parsed.logicalStartIndex` 拷贝 13 字节，只改「正在保存」那一侧 5 字节，其余与读回一致；
 * 再写头：[0] 情景、[1] 张数 0x02、[2] 使用大小（两岛 64K 块累计）。
 */
export function buildDualIslandWorkLogical15FromReadPatch(
  rawResponse: readonly number[],
  parsed: ParsedLcdWork14WithOffset,
  opts: {
    islandBeingSaved: 0 | 1;
    newEntries: LcdImageWorkEntry[];
  },
): Uint8Array {
  const start = parsed.logicalStartIndex;
  const out = new Uint8Array(LCD_DUAL_ISLAND_WORK_LOGICAL_LEN);
  const copyLen = Math.min(LCD_DUAL_ISLAND_WORK_LOGICAL_LEN, Math.max(0, rawResponse.length - start));
  for (let i = 0; i < copyLen; i++) {
    out[i] = rawResponse[start + i] ?? 0;
  }
  const collapsed = collapseWorkEntriesToSingleIslandSlot(opts.newEntries);
  const base = 3 + opts.islandBeingSaved * 5;
  out[base] = collapsed.metaByte & 0xff;
  out[base + 1] = collapsed.type & 0xff;
  const s = Math.max(0, collapsed.size);
  out[base + 2] = s & 0xff;
  out[base + 3] = (s >> 8) & 0xff;
  out[base + 4] = (s >> 16) & 0xff;

  out[0] = LCD_WORK_PARAM_PROFILE_SEND;
  out[1] = LCD_WORK_PARAM_IMAGE_COUNT_SEND;
  const [e0, e1] = parseTwoIslandWorkEntriesFromWorkLogical(out);
  out[2] = lcdWorkFlashUsageByteFromTwoEntries(e0, e1);
  return out;
}

/** 从 13 字节功能区逻辑解析两条岛（用于 FLASH 偏移与块数） */
export function parseTwoIslandWorkEntriesFromWorkLogical(logical: Uint8Array): [LcdImageWorkEntry, LcdImageWorkEntry] {
  const e0: LcdImageWorkEntry = {
    metaByte: logical[3] ?? 0,
    type: (logical[4] ?? 0) === 1 ? 1 : 0,
    size: (logical[5] ?? 0) | ((logical[6] ?? 0) << 8) | ((logical[7] ?? 0) << 16),
  };
  const e1: LcdImageWorkEntry = {
    metaByte: logical[8] ?? 0,
    type: (logical[9] ?? 0) === 1 ? 1 : 0,
    size: (logical[10] ?? 0) | ((logical[11] ?? 0) << 8) | ((logical[12] ?? 0) << 16),
  };
  return [e0, e1];
}

/**
 * 同一侧多张 QGIF（相册）合并为协议里的一条 5 字节：共用首条的 meta/type，size 为各文件字节数之和。
 */
export function collapseWorkEntriesToSingleIslandSlot(entries: readonly LcdImageWorkEntry[]): LcdImageWorkEntry {
  if (entries.length === 0) return LCD_EMPTY_ISLAND_WORK_ENTRY;
  if (entries.length === 1) return entries[0]!;
  const metaByte = entries[0]!.metaByte;
  const type: 0 | 1 = entries.some((e) => e.type === 1) ? 1 : 0;
  const size = entries.reduce((s, e) => s + Math.max(0, e.size), 0);
  return { metaByte, type, size };
}

/** 第 entryIndex 条资源在合并 FLASH 映像中的起始字节偏移（64K 对齐步进） */
export function lcdFlashByteOffsetForWorkEntryIndex(
  entries: readonly LcdImageWorkEntry[],
  entryIndex: number,
): number {
  let off = 0;
  for (let i = 0; i < entryIndex && i < entries.length; i++) {
    const sz = entries[i].size;
    if (sz <= 0) continue;
    off += Math.ceil(sz / (64 * 1024)) * (64 * 1024);
  }
  return off;
}

/**
 * 配置字节：bit7-6 张数(0=1张…3=4张)，bit5-3 动画(0–4)，bit2-0 间隔(0–5)
 */
export function encodeLcdImageMetaByte(opts: {
  imageSlotCount: number;
  animType: number;
  intervalCode: number;
}): number {
  const countBits = Math.min(Math.max(opts.imageSlotCount - 1, 0), 3) << 6;
  const animBits = (Math.min(Math.max(opts.animType, 0), 7) & 7) << 3;
  const intervalBits = Math.min(Math.max(opts.intervalCode, 0), 7) & 7;
  return countBits | animBits | intervalBits;
}

export function secondsToLcdIntervalCode(sec: number): number {
  const s = Math.round(sec);
  const exact = LCD_INTERVAL_CODE_SECONDS.indexOf(s as (typeof LCD_INTERVAL_CODE_SECONDS)[number]);
  if (exact >= 0) return exact;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LCD_INTERVAL_CODE_SECONDS.length; i++) {
    const d = Math.abs(LCD_INTERVAL_CODE_SECONDS[i] - s);
    if (d < bestDiff) {
      bestDiff = d;
      best = i;
    }
  }
  return best;
}

/** 与协议表一致：0 无动画，1 上→下，2 下→上，3 左→右，4 右→左 */
export function transitionKindToLcdAnimType(kind: TransitionKind): number {
  switch (kind) {
    case "none":
      return 0;
    case "ttb":
      return 1;
    case "btt":
      return 2;
    case "ltr":
      return 3;
    case "rtl":
      return 4;
    default:
      return 0;
  }
}

/**
 * 0x15 逻辑缓冲区：[0]情景 profile，[1]图片张数，[2]占用 FLASH(64K 块，多图累计)，
 * 之后每张 5 字节：配置、类型(0=GIF 1=普通图)、尺寸 24bit 小端。
 */
export function buildWorkParamLogical15(
  profile: number,
  imageCount: number,
  flashBlocks64k: number,
  entries: LcdImageWorkEntry[],
): Uint8Array {
  const logicalLen = 3 + entries.length * 5;
  const logical = new Uint8Array(logicalLen);
  logical[0] = profile & 0xff;
  logical[1] = imageCount & 0xff;
  logical[2] = flashBlocks64k & 0xff;
  let p = 3;
  for (const e of entries) {
    logical[p++] = e.metaByte & 0xff;
    logical[p++] = e.type & 0xff;
    const s = e.size;
    logical[p++] = s & 0xff;
    logical[p++] = (s >> 8) & 0xff;
    logical[p++] = (s >> 16) & 0xff;
  }
  return logical;
}

export function fillLcdEraseBuffer(flashBlocks: number, islandMode: 0 | 1): Uint8Array {
  const eraseBuffer = new Uint8Array(65);
  eraseBuffer[1] = 0xaa;
  eraseBuffer[2] = 0x18;
  eraseBuffer[6] = 0x38;
  eraseBuffer[7] = islandMode;
  eraseBuffer[9] = flashBlocks & 0xff;
  return eraseBuffer;
}

const LCD_ERASE_SETTLE_MIN_MS = 2000;
const LCD_ERASE_SETTLE_MS_PER_64K_BLOCK = 650;
const LCD_WRITE19_PACKET_INTERVAL_MS = 1;

/**
 * 在 `await deviceComm.setData(fillLcdEraseBuffer(...))` 之后、任何 0x19 之前调用。
 * HID 应答不表示擦除结束，需按块数留足异步擦写时间。
 */
export async function settleAfterLcdEraseCommand(flashBlocks: number): Promise<void> {
  const n = Math.max(1, flashBlocks | 0);
  const ms = Math.max(LCD_ERASE_SETTLE_MIN_MS, n * LCD_ERASE_SETTLE_MS_PER_64K_BLOCK);
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * 严格顺序：0x18 发送并收到应答 -> 等待擦除完成 -> 才允许后续 0x19。
 */
export async function sendLcdEraseAndWait(
  deviceComm: { setData: (data: number[]) => Promise<unknown> },
  flashBlocks: number,
  islandMode: 0 | 1,
): Promise<number[]> {
  const eraseBuffer = fillLcdEraseBuffer(flashBlocks, islandMode);
  const resp = await deviceComm.setData(Array.from(eraseBuffer));
  if (!Array.isArray(resp)) {
    throw new Error("LCD 0x18 erase did not return a response");
  }
  await settleAfterLcdEraseCommand(flashBlocks);
  return [...resp];
}

/** 0x19 分包节流：协议要求每包至少 1.1ms 间隔，这里按 2ms 保守执行。 */
export async function settleBetweenLcd19Packets(): Promise<void> {
  await new Promise((r) => setTimeout(r, LCD_WRITE19_PACKET_INTERVAL_MS));
}

export async function sendScreenWorkParam15Packets(
  deviceComm: { setData: (data: number[]) => Promise<unknown> },
  logical: Uint8Array,
) {
  if (logical.length > W15_LOGICAL_MAX) {
    throw new Error(`Screen 0x15 work area overflow: ${logical.length} bytes (max ${W15_LOGICAL_MAX})`);
  }

  const b0 = new Uint8Array(65);
  b0[1] = 0xaa;
  b0[2] = 0x15;
  b0[6] = 0x38;
  const n0 = Math.min(W15_BYTES_FIRST, logical.length);
  b0.set(logical.subarray(0, n0), W15_FUN_FIRST);
  await deviceComm.setData(Array.from(b0));

  if (logical.length <= W15_BYTES_FIRST) return;

  const b1 = new Uint8Array(65);
  b1[1] = 0xaa;
  b1[2] = 0x15;
  b1[3] = 56;
  b1[6] = 0x38;
  const start1 = W15_BYTES_FIRST;
  const n1 = Math.min(W15_TAIL_NEXT, logical.length - start1);
  b1.set(logical.subarray(start1, start1 + n1), W15_ENTRY_START);
  await deviceComm.setData(Array.from(b1));

  const after1 = W15_BYTES_FIRST + W15_TAIL_NEXT;
  if (logical.length <= after1) return;

  const b2 = new Uint8Array(65);
  b2[1] = 0xaa;
  b2[2] = 0x15;
  b2[3] = 112;
  b2[6] = 0x10;
  const n2 = Math.min(W15_TAIL_LAST, logical.length - after1);
  b2.set(logical.subarray(after1, after1 + n2), W15_ENTRY_START);
  await deviceComm.setData(Array.from(b2));
}
