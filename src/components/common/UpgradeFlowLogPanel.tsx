'use client';

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import TerminalIcon from '@mui/icons-material/Terminal';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import {
  installUpgradeFlowLogConsoleApi,
  upgradeFlowLog,
  UF_SOURCE,
  type UpgradeFlowLogEntry,
  type UpgradeFlowLogLevel,
} from '@/utils/upgradeFlowLog';
import {
  extractIapAckFromLogText,
  formatHexByte,
  getIapAckMessage,
  getIapCmdName,
} from '@/utils/iapAckParse';
import {
  extractOtaAckFromLogText,
  formatHexByte as formatOtaHexByte,
  getOtaCmdName,
  getOtaStatusMessage,
  isOtaAckSuccess,
} from '@/utils/otaAckParse';

type LogDirection = keyof typeof DIRECTION_META;

const ALL_LEVELS: UpgradeFlowLogLevel[] = ['info', 'warn', 'error', 'debug'];

const SOURCE_LABELS: Record<string, string> = {
  [UF_SOURCE.KEYBOARD_IAP]: '键盘 IAP',
  [UF_SOURCE.KEYBOARD_8K]: '8K 键盘',
  [UF_SOURCE.SCREEN_OTA]: '屏幕 OTA',
  [UF_SOURCE.DONGLE_IAP]: '接收器 IAP',
};

const LEVEL_LABELS: Record<UpgradeFlowLogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

const LEVEL_COLORS: Record<UpgradeFlowLogLevel, string> = {
  info: '#38bdf8',
  warn: '#fbbf24',
  error: '#f87171',
  debug: '#94a3b8',
};

const DIRECTION_META = {
  out: { label: '下发', icon: ArrowUpwardIcon, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
  in: { label: '收到', icon: ArrowDownwardIcon, color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)' },
  exchange: { label: '收发', icon: SwapVertIcon, color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)' },
  flow: { label: '流程', icon: SwapVertIcon, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' },
} as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('zh-CN', { hour12: false })}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

function getEntryDirection(entry: UpgradeFlowLogEntry): keyof typeof DIRECTION_META {
  if (entry.exchange || entry.message.startsWith('⇄')) return 'exchange';
  if (entry.message.startsWith('>>')) return 'out';
  if (entry.message.startsWith('<<')) return 'in';
  return 'flow';
}

function getEntrySearchHaystack(entry: UpgradeFlowLogEntry): string {
  const ex = entry.exchange;
  return [
    entry.message,
    entry.detail ?? '',
    entry.source,
    entry.level,
    ex?.outLabel ?? '',
    ex?.outHex ?? '',
    ex?.inLabel ?? '',
    ex?.inHex ?? '',
  ].join(' ');
}

type DisplayItem =
  | { type: 'exchange'; entry: UpgradeFlowLogEntry }
  | { type: 'legacy-pair'; out: UpgradeFlowLogEntry; inn: UpgradeFlowLogEntry }
  | { type: 'single'; entry: UpgradeFlowLogEntry };

/** 将相邻 >> / << 合并为配对显示；exchange 字段条目单独渲染 */
function buildDisplayItems(entries: UpgradeFlowLogEntry[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.exchange) {
      items.push({ type: 'exchange', entry });
      continue;
    }
    if (entry.message.startsWith('>>')) {
      const next = entries[i + 1];
      if (next?.message.startsWith('<<')) {
        items.push({ type: 'legacy-pair', out: entry, inn: next });
        i++;
        continue;
      }
    }
    items.push({ type: 'single', entry });
  }
  return items;
}

function matchesSingleTerm(haystack: string, term: string): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;

  const lowerHaystack = haystack.toLowerCase();
  if (lowerHaystack.includes(q)) return true;

  const qCompact = q.replace(/\s+/g, '');
  const hayCompact = lowerHaystack.replace(/\s+/g, '');
  return qCompact.length > 0 && hayCompact.includes(qCompact);
}

function matchesSearch(entry: UpgradeFlowLogEntry, terms: string[]): boolean {
  const activeTerms = terms.map((t) => t.trim()).filter(Boolean);
  if (activeTerms.length === 0) return true;

  const haystack = getEntrySearchHaystack(entry);
  return activeTerms.every((term) => matchesSingleTerm(haystack, term));
}

function filterEntries(
  entries: readonly UpgradeFlowLogEntry[],
  opts: {
    searchTerms: string[];
    levels: Set<UpgradeFlowLogLevel>;
    sources: Set<string>;
    directions: Set<LogDirection>;
  },
): UpgradeFlowLogEntry[] {
  return entries.filter((entry) => {
    if (opts.levels.size > 0 && !opts.levels.has(entry.level)) return false;
    if (opts.sources.size > 0 && !opts.sources.has(entry.source)) return false;

    const dir = getEntryDirection(entry);
    if (opts.directions.size > 0 && !opts.directions.has(dir)) return false;

    return matchesSearch(entry, opts.searchTerms);
  });
}

function highlightText(text: string, terms: string[], highlightColor: string): React.ReactNode {
  const activeTerms = terms.map((t) => t.trim()).filter(Boolean);
  if (activeTerms.length === 0) return text;

  type Segment = { start: number; end: number };
  const matches: Segment[] = [];

  const lowerText = text.toLowerCase();
  for (const term of activeTerms) {
    const q = term.toLowerCase();
    if (!q) continue;
    let from = 0;
    while (from < lowerText.length) {
      const idx = lowerText.indexOf(q, from);
      if (idx < 0) break;
      matches.push({ start: idx, end: idx + q.length });
      from = idx + q.length;
    }
  }

  if (matches.length === 0) return text;

  matches.sort((a, b) => a.start - b.start);
  const merged: Segment[] = [];
  for (const seg of matches) {
    const last = merged[merged.length - 1];
    if (!last || seg.start > last.end) {
      merged.push({ ...seg });
    } else {
      last.end = Math.max(last.end, seg.end);
    }
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach((seg, i) => {
    if (cursor < seg.start) {
      nodes.push(text.slice(cursor, seg.start));
    }
    nodes.push(
      <Box
        key={`${seg.start}-${i}`}
        component="mark"
        sx={{
          bgcolor: highlightColor,
          color: 'inherit',
          px: 0.35,
          py: 0.1,
          borderRadius: '3px',
        }}
      >
        {text.slice(seg.start, seg.end)}
      </Box>,
    );
    cursor = seg.end;
  });
  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }
  return <>{nodes}</>;
}

function LogExchangeLine({
  entry,
  searchTerms,
  isDark,
}: {
  entry: UpgradeFlowLogEntry;
  searchTerms: string[];
  isDark: boolean;
}) {
  const ex = entry.exchange!;
  const meta = DIRECTION_META.exchange;
  const DirIcon = meta.icon;
  const highlightBg = isDark ? 'rgba(250, 204, 21, 0.35)' : 'rgba(250, 204, 21, 0.55)';
  const ack = entry.source === UF_SOURCE.SCREEN_OTA
    ? null
    : extractIapAckFromLogText(ex.inLabel, ex.inHex);
  const otaAck = entry.source === UF_SOURCE.SCREEN_OTA
    ? extractOtaAckFromLogText(ex.inLabel, ex.inHex)
    : null;
  const ackErrColor = ack && ack.errCode !== 0 ? LEVEL_COLORS.error : '#4ade80';
  const otaAckColor = otaAck && !isOtaAckSuccess(otaAck) ? LEVEL_COLORS.error : '#4ade80';
  const ridLabel =
    ex.reportId !== undefined ? ` rid=0x${ex.reportId.toString(16).toUpperCase()}` : '';

  const renderDataRow = (
    kind: 'out' | 'in',
    label: string,
    hex: string,
  ) => {
    const rowMeta = DIRECTION_META[kind];
    const RowIcon = rowMeta.icon;
    return (
      <Box
        sx={{
          pl: 1,
          py: 0.45,
          borderLeft: `2px solid ${alpha(rowMeta.color, 0.5)}`,
          bgcolor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.025)',
          borderRadius: '0 6px 6px 0',
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.25 }}>
          <RowIcon sx={{ fontSize: 12, color: rowMeta.color }} />
          <Typography
            sx={{
              fontSize: '11px',
              fontWeight: 700,
              color: rowMeta.color,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            {kind === 'out' ? '>>' : '<<'} {label}
          </Typography>
        </Stack>
        <Typography
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '11px',
            lineHeight: 1.55,
            color: isDark ? alpha(rowMeta.color, 0.9) : 'text.secondary',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {highlightText(hex, searchTerms, highlightBg)}
        </Typography>
      </Box>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        py: 0.85,
        px: 1,
        mx: -0.5,
        borderRadius: '8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.35,
          pt: 0.15,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.35,
            px: 0.75,
            py: 0.2,
            borderRadius: '6px',
            bgcolor: meta.bg,
            color: meta.color,
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          <DirIcon sx={{ fontSize: 11 }} />
          {meta.label}
        </Box>
        <Typography
          sx={{
            fontSize: '10px',
            color: 'text.disabled',
            fontFamily: 'ui-monospace, monospace',
            lineHeight: 1.2,
          }}
        >
          {formatTime(entry.ts)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
          <Chip
            size="small"
            label={LEVEL_LABELS[entry.level]}
            sx={{
              height: 18,
              fontSize: '10px',
              fontWeight: 700,
              bgcolor: alpha(LEVEL_COLORS[entry.level], isDark ? 0.18 : 0.12),
              color: LEVEL_COLORS[entry.level],
              border: `1px solid ${alpha(LEVEL_COLORS[entry.level], 0.35)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            size="small"
            label={SOURCE_LABELS[entry.source] ?? entry.source}
            sx={{
              height: 18,
              fontSize: '10px',
              fontWeight: 500,
              bgcolor: isDark ? 'rgba(134, 239, 172, 0.1)' : 'rgba(34, 197, 94, 0.08)',
              color: isDark ? '#86efac' : '#15803d',
              border: `1px solid ${alpha('#22c55e', 0.25)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          {otaAck ? (
            <>
              <Chip
                size="small"
                label={`OTA ${formatOtaHexByte(otaAck.cmd)}`}
                title={getOtaCmdName(otaAck.cmd)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(DIRECTION_META.flow.color, isDark ? 0.16 : 0.1),
                  color: DIRECTION_META.flow.color,
                  border: `1px solid ${alpha(DIRECTION_META.flow.color, 0.35)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              <Chip
                size="small"
                label={`ST ${formatOtaHexByte(otaAck.status)}`}
                title={getOtaStatusMessage(otaAck.cmd, otaAck.status)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(otaAckColor, isDark ? 0.18 : 0.12),
                  color: otaAckColor,
                  border: `1px solid ${alpha(otaAckColor, 0.4)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </>
          ) : ack ? (
            <>
              <Chip
                size="small"
                label={`Err ${formatHexByte(ack.errCode)}`}
                title={getIapAckMessage(ack.errCode)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(ackErrColor, isDark ? 0.18 : 0.12),
                  color: ackErrColor,
                  border: `1px solid ${alpha(ackErrColor, 0.4)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              {ack.rspCmd !== null ? (
                <Chip
                  size="small"
                  label={`CMD ${formatHexByte(ack.rspCmd)}`}
                  title={getIapCmdName(ack.rspCmd)}
                  sx={{
                    height: 18,
                    fontSize: '10px',
                    fontWeight: 700,
                    bgcolor: alpha(DIRECTION_META.flow.color, isDark ? 0.16 : 0.1),
                    color: DIRECTION_META.flow.color,
                    border: `1px solid ${alpha(DIRECTION_META.flow.color, 0.35)}`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ) : null}
            </>
          ) : null}
          <Typography
            component="span"
            sx={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              fontWeight: 600,
              color: meta.color,
            }}
          >
            ⇄ 收发{ridLabel}
          </Typography>
        </Stack>

        <Stack gap={0.45}>
          {renderDataRow('out', ex.outLabel, ex.outHex)}
          {renderDataRow('in', ex.inLabel, ex.inHex)}
        </Stack>
      </Box>
    </Box>
  );
}

function LogLegacyPairLine({
  out,
  inn,
  searchTerms,
  isDark,
}: {
  out: UpgradeFlowLogEntry;
  inn: UpgradeFlowLogEntry;
  searchTerms: string[];
  isDark: boolean;
}) {
  const synthetic: UpgradeFlowLogEntry = {
    ...out,
    message: '⇄ 收发',
    exchange: {
      outLabel: out.detail?.split(' | ')[0] ?? out.message,
      outHex: out.detail?.split(' | ').slice(1).join(' | ') ?? '',
      inLabel: inn.detail?.split(' | ')[0] ?? inn.message,
      inHex: inn.detail?.split(' | ').slice(1).join(' | ') ?? '',
    },
  };
  return <LogExchangeLine entry={synthetic} searchTerms={searchTerms} isDark={isDark} />;
}

function LogLine({
  entry,
  searchTerms,
  isDark,
}: {
  entry: UpgradeFlowLogEntry;
  searchTerms: string[];
  isDark: boolean;
}) {
  const dir = getEntryDirection(entry);
  const meta = DIRECTION_META[dir];
  const DirIcon = meta.icon;
  const highlightBg = isDark ? 'rgba(250, 204, 21, 0.35)' : 'rgba(250, 204, 21, 0.55)';
  const ack = entry.source === UF_SOURCE.SCREEN_OTA
    ? null
    : extractIapAckFromLogText(entry.message, entry.detail);
  const otaAck = entry.source === UF_SOURCE.SCREEN_OTA
    ? extractOtaAckFromLogText(entry.message, entry.detail)
    : null;
  const ackErrColor = ack && ack.errCode !== 0 ? LEVEL_COLORS.error : '#4ade80';
  const otaAckColor = otaAck && !isOtaAckSuccess(otaAck) ? LEVEL_COLORS.error : '#4ade80';

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1.25,
        py: 0.85,
        px: 1,
        mx: -0.5,
        borderRadius: '8px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        transition: 'background-color 0.15s ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.35,
          pt: 0.15,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.35,
            px: 0.75,
            py: 0.2,
            borderRadius: '6px',
            bgcolor: meta.bg,
            color: meta.color,
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          <DirIcon sx={{ fontSize: 11 }} />
          {meta.label}
        </Box>
        <Typography
          sx={{
            fontSize: '10px',
            color: 'text.disabled',
            fontFamily: 'ui-monospace, monospace',
            lineHeight: 1.2,
          }}
        >
          {formatTime(entry.ts)}
        </Typography>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.5} sx={{ mb: entry.detail ? 0.4 : 0 }}>
          <Chip
            size="small"
            label={LEVEL_LABELS[entry.level]}
            sx={{
              height: 18,
              fontSize: '10px',
              fontWeight: 700,
              bgcolor: alpha(LEVEL_COLORS[entry.level], isDark ? 0.18 : 0.12),
              color: LEVEL_COLORS[entry.level],
              border: `1px solid ${alpha(LEVEL_COLORS[entry.level], 0.35)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            size="small"
            label={SOURCE_LABELS[entry.source] ?? entry.source}
            sx={{
              height: 18,
              fontSize: '10px',
              fontWeight: 500,
              bgcolor: isDark ? 'rgba(134, 239, 172, 0.1)' : 'rgba(34, 197, 94, 0.08)',
              color: isDark ? '#86efac' : '#15803d',
              border: `1px solid ${alpha('#22c55e', 0.25)}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          {otaAck ? (
            <>
              <Chip
                size="small"
                label={`OTA ${formatOtaHexByte(otaAck.cmd)}`}
                title={getOtaCmdName(otaAck.cmd)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(DIRECTION_META.flow.color, isDark ? 0.16 : 0.1),
                  color: DIRECTION_META.flow.color,
                  border: `1px solid ${alpha(DIRECTION_META.flow.color, 0.35)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              <Chip
                size="small"
                label={`ST ${formatOtaHexByte(otaAck.status)}`}
                title={getOtaStatusMessage(otaAck.cmd, otaAck.status)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(otaAckColor, isDark ? 0.18 : 0.12),
                  color: otaAckColor,
                  border: `1px solid ${alpha(otaAckColor, 0.4)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            </>
          ) : ack ? (
            <>
              <Chip
                size="small"
                label={`Err ${formatHexByte(ack.errCode)}`}
                title={getIapAckMessage(ack.errCode)}
                sx={{
                  height: 18,
                  fontSize: '10px',
                  fontWeight: 700,
                  bgcolor: alpha(ackErrColor, isDark ? 0.18 : 0.12),
                  color: ackErrColor,
                  border: `1px solid ${alpha(ackErrColor, 0.4)}`,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
              {ack.rspCmd !== null ? (
                <Chip
                  size="small"
                  label={`CMD ${formatHexByte(ack.rspCmd)}`}
                  title={getIapCmdName(ack.rspCmd)}
                  sx={{
                    height: 18,
                    fontSize: '10px',
                    fontWeight: 700,
                    bgcolor: alpha(DIRECTION_META.flow.color, isDark ? 0.16 : 0.1),
                    color: DIRECTION_META.flow.color,
                    border: `1px solid ${alpha(DIRECTION_META.flow.color, 0.35)}`,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ) : null}
            </>
          ) : null}
          <Typography
            component="span"
            sx={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '12px',
              fontWeight: dir !== 'flow' ? 600 : 500,
              color: meta.color,
              lineHeight: 1.45,
            }}
          >
            {highlightText(entry.message, searchTerms, highlightBg)}
          </Typography>
        </Stack>

        {entry.detail ? (
          <Box
            sx={{
              mt: 0.35,
              pl: 1,
              py: 0.5,
              borderLeft: `2px solid ${alpha(meta.color, 0.45)}`,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '11px',
              lineHeight: 1.55,
              color: isDark ? alpha(meta.color, 0.85) : 'text.secondary',
              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.025)',
              borderRadius: '0 6px 6px 0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {highlightText(entry.detail, searchTerms, highlightBg)}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function SearchFilterBox({
  searchTerms,
  searchInput,
  onInputChange,
  onAdd,
  onRemoveTerm,
  onClearInput,
  cardBg,
  isDark,
  primary,
  theme,
}: {
  searchTerms: string[];
  searchInput: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onRemoveTerm: (term: string) => void;
  onClearInput: () => void;
  cardBg: string;
  isDark: boolean;
  primary: string;
  theme: Theme;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box
      onClick={() => inputRef.current?.focus()}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.5,
        px: 1.25,
        py: 0.75,
        minHeight: 42,
        borderRadius: '12px',
        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.2 : 0.8)}`,
        bgcolor: cardBg,
        cursor: 'text',
        '&:focus-within': {
          borderColor: primary,
          boxShadow: `0 0 0 1px ${alpha(primary, 0.25)}`,
        },
      }}
    >
      <SearchIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
      {searchTerms.map((term) => (
        <Chip
          key={term}
          size="small"
          label={term}
          onDelete={(e) => {
            e.stopPropagation();
            onRemoveTerm(term);
          }}
          onClick={(e) => e.stopPropagation()}
          sx={{ height: 24, fontSize: '11px', maxWidth: '100%' }}
        />
      ))}
      <Box
        component="input"
        ref={inputRef}
        value={searchInput}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
            inputRef.current?.focus();
          }
          if (e.key === 'Backspace' && !searchInput && searchTerms.length > 0) {
            onRemoveTerm(searchTerms[searchTerms.length - 1]);
          }
        }}
        placeholder={searchTerms.length === 0 ? '输入关键词或 hex，Enter 添加（可叠加多个）' : '继续输入下一个条件…'}
        sx={{
          flex: 1,
          minWidth: 120,
          border: 'none',
          outline: 'none',
          bgcolor: 'transparent',
          color: 'text.primary',
          fontSize: '13px',
          py: 0.5,
          '&::placeholder': { color: 'text.disabled', opacity: 1 },
        }}
      />
      {searchInput ? (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onClearInput();
            inputRef.current?.focus();
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      ) : null}
      <Button
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
          inputRef.current?.focus();
        }}
        disabled={!searchInput.trim()}
        sx={{ textTransform: 'none', minWidth: 48, fontSize: '12px', flexShrink: 0 }}
      >
        添加
      </Button>
    </Box>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Typography
        sx={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'text.secondary',
          mb: 0.75,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function SelectChip({
  active,
  label,
  onClick,
  activeColor,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  activeColor?: string;
}) {
  const theme = useTheme();
  const color = activeColor ?? theme.palette.primary.main;

  return (
    <Chip
      size="small"
      label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      sx={{
        height: 28,
        fontSize: '12px',
        fontWeight: active ? 600 : 500,
        borderRadius: '8px',
        cursor: 'pointer',
        bgcolor: active ? alpha(color, 0.15) : 'transparent',
        color: active ? color : 'text.secondary',
        border: `1px solid ${active ? alpha(color, 0.45) : alpha(theme.palette.divider, 0.9)}`,
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: active ? alpha(color, 0.2) : alpha(theme.palette.action.hover, 0.06),
          borderColor: active ? alpha(color, 0.6) : alpha(theme.palette.divider, 1),
        },
      }}
    />
  );
}

const LOG_PANEL_WIDTH = 900;
const LOG_PANEL_MIN_VISIBLE = 120;

function clampPanelPosition(x: number, y: number) {
  const maxX = Math.max(0, window.innerWidth - LOG_PANEL_MIN_VISIBLE);
  const maxY = Math.max(0, window.innerHeight - LOG_PANEL_MIN_VISIBLE);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

function getDefaultPanelPosition() {
  const w = Math.min(LOG_PANEL_WIDTH, window.innerWidth - 32);
  return clampPanelPosition(
    Math.max(16, (window.innerWidth - w) / 2),
    Math.max(16, (window.innerHeight - 480) / 2),
  );
}

export default function UpgradeFlowLogPanel() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const primary = theme.palette.primary.main;
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [directions, setDirections] = useState<Set<LogDirection>>(() => new Set());
  const [levels, setLevels] = useState<Set<UpgradeFlowLogLevel>>(() => new Set());

  const visible = useSyncExternalStore(
    (cb) => upgradeFlowLog.subscribe(cb),
    () => upgradeFlowLog.isPanelVisible(),
    () => false,
  );

  const entries = useSyncExternalStore(
    (cb) => upgradeFlowLog.subscribe(cb),
    () => upgradeFlowLog.getEntries(),
    () => [] as readonly UpgradeFlowLogEntry[],
  );

  const allSources = useMemo(() => {
    const known = Object.values(UF_SOURCE);
    const fromLogs = entries.map((e) => e.source);
    return Array.from(new Set([...known, ...fromLogs]));
  }, [entries]);

  const [sources, setSources] = useState<Set<string>>(() => new Set());

  const allSearchTerms = useMemo(() => {
    const draft = searchInput.trim();
    return draft ? [...searchTerms, draft] : searchTerms;
  }, [searchTerms, searchInput]);

  const filteredEntries = useMemo(
    () => filterEntries(entries, { searchTerms: allSearchTerms, levels, sources, directions }),
    [entries, allSearchTerms, levels, sources, directions],
  );

  const displayItems = useMemo(() => buildDisplayItems(filteredEntries), [filteredEntries]);

  const stats = useMemo(() => {
    const out = filteredEntries.filter((e) => getEntryDirection(e) === 'out').length;
    const inn = filteredEntries.filter((e) => getEntryDirection(e) === 'in').length;
    const exchange = filteredEntries.filter((e) => getEntryDirection(e) === 'exchange').length;
    const err = filteredEntries.filter((e) => e.level === 'error').length;
    return { out, in: inn, exchange, err };
  }, [filteredEntries]);

  const hasChipFilters =
    directions.size > 0 || levels.size > 0 || sources.size > 0;

  const hasActiveFilter =
    searchTerms.length > 0 ||
    searchInput.trim().length > 0 ||
    hasChipFilters;

  useEffect(() => {
    installUpgradeFlowLogConsoleApi();
  }, []);

  useEffect(() => {
    if (!visible) return;
    setPanelPos((prev) => prev ?? getDefaultPanelPosition());
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onResize = () => {
      setPanelPos((prev) => (prev ? clampPanelPosition(prev.x, prev.y) : prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [visible]);

  const handleDragPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="button"], .MuiIconButton-root, input, textarea, a')) {
      return;
    }
    const pos = panelPos ?? getDefaultPanelPosition();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handleDragPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPanelPos(
      clampPanelPosition(
        dragRef.current.origX + dx,
        dragRef.current.origY + dy,
      ),
    );
  };

  const handleDragPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    if (!visible || !autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayItems, visible, autoScroll]);

  const toggleInSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const addSearchTerms = (raw?: string) => {
    const text = (raw ?? searchInput).trim();
    if (!text) return;
    const parts = text.split(/[\s,，;；]+/).filter(Boolean);
    setSearchTerms((prev) => {
      const next = [...prev];
      for (const part of parts) {
        if (!next.includes(part)) next.push(part);
      }
      return next;
    });
    setSearchInput('');
    setFiltersOpen(true);
  };

  const removeSearchTerm = (term: string) => {
    setSearchTerms((prev) => prev.filter((t) => t !== term));
  };

  const applyFilterToggle = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    toggleInSet(setter, value);
    setFiltersOpen(true);
  };

  const toggleLevel = (level: UpgradeFlowLogLevel) => applyFilterToggle(setLevels, level);
  const toggleSource = (source: string) => applyFilterToggle(setSources, source);
  const toggleDirection = (dir: LogDirection) => applyFilterToggle(setDirections, dir);

  const resetFilters = () => {
    setSearchInput('');
    setSearchTerms([]);
    setDirections(new Set());
    setLevels(new Set());
    setSources(new Set());
    setFiltersOpen(true);
  };

  const directionOptions: { value: LogDirection; label: string; color: string }[] = [
    { value: 'exchange', label: '收发 ⇄', color: DIRECTION_META.exchange.color },
    { value: 'out', label: '下发 >>', color: DIRECTION_META.out.color },
    { value: 'in', label: '收到 <<', color: DIRECTION_META.in.color },
    { value: 'flow', label: '流程', color: DIRECTION_META.flow.color },
  ];

  const panelBg = isDark ? '#14171c' : '#f8fafc';
  const cardBg = isDark ? '#0c0e12' : '#ffffff';
  const terminalBg = isDark ? '#080a0d' : '#f1f5f9';

  return (
    <Dialog
      open={visible}
      hideBackdrop
      disableScrollLock
      disableEscapeKeyDown
      onClose={(_e, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      maxWidth={false}
      sx={{
        pointerEvents: 'none',
        '& .MuiDialog-container': {
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        },
      }}
      PaperProps={{
        ref: panelRef,
        sx: {
          pointerEvents: 'auto',
          position: 'fixed',
          m: 0,
          width: `min(${LOG_PANEL_WIDTH}px, calc(100vw - 32px))`,
          maxWidth: `${LOG_PANEL_WIDTH}px`,
          left: panelPos?.x ?? '50%',
          top: panelPos?.y ?? '50%',
          transform: panelPos ? 'none' : 'translate(-50%, -50%)',
          bgcolor: panelBg,
          backgroundImage: 'none',
          borderRadius: '18px',
          border: `1px solid ${isDark ? alpha(primary, 0.35) : 'rgba(15, 23, 42, 0.08)'}`,
          boxShadow: isDark
            ? `0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px ${alpha(primary, 0.08)}`
            : '0 24px 60px rgba(15, 23, 42, 0.12)',
          maxHeight: '88vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      {/* Header — 拖动区域 */}
      <Box
        onPointerDown={handleDragPointerDown}
        onPointerMove={handleDragPointerMove}
        onPointerUp={handleDragPointerUp}
        onPointerCancel={handleDragPointerUp}
        sx={{
          px: 2.5,
          pt: 2,
          pb: 1.5,
          flexShrink: 0,
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
          background: isDark
            ? `linear-gradient(135deg, ${alpha(primary, 0.12)} 0%, transparent 60%)`
            : `linear-gradient(135deg, ${alpha(primary, 0.06)} 0%, transparent 60%)`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.12 : 0.6)}`,
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(primary, isDark ? 0.2 : 0.1),
                color: primary,
                flexShrink: 0,
              }}
            >
              <TerminalIcon />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" alignItems="center" gap={0.75}>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, lineHeight: 1.3 }}>
                  升级流程日志
                </Typography>
                <DragIndicatorIcon sx={{ fontSize: 18, color: 'text.disabled', opacity: 0.7 }} />
              </Stack>
              <Typography sx={{ fontSize: '12px', color: 'text.secondary', mt: 0.25 }}>
                可拖动 · 点击页面其他区域不会关闭 · 控制台 <code style={{ fontSize: '11px' }}>upgradeFlowLog.show()</code>
              </Typography>
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            flexShrink={0}
            sx={{ cursor: 'default' }}
          >
            <Tooltip title={autoScroll ? '关闭自动滚动' : '开启自动滚动'}>
              <Button
                size="small"
                variant={autoScroll ? 'contained' : 'outlined'}
                onClick={() => setAutoScroll((v) => !v)}
                sx={{
                  textTransform: 'none',
                  minWidth: 80,
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  boxShadow: autoScroll ? `0 4px 14px ${alpha(primary, 0.35)}` : 'none',
                }}
              >
                {autoScroll ? '自动滚动' : '手动滚动'}
              </Button>
            </Tooltip>
            <Tooltip title="清空日志">
              <IconButton
                size="small"
                onClick={() => upgradeFlowLog.clear()}
                sx={{
                  borderRadius: '10px',
                  border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton
              size="small"
              onClick={() => upgradeFlowLog.hidePanel()}
              sx={{ borderRadius: '10px' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Stack>

        {/* Stats bar */}
        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1.5 }}>
          <Chip
            size="small"
            label={`${filteredEntries.length} / ${entries.length} 条`}
            sx={{
              height: 24,
              fontWeight: 600,
              fontSize: '11px',
              bgcolor: alpha(primary, isDark ? 0.15 : 0.08),
              color: primary,
              border: `1px solid ${alpha(primary, 0.25)}`,
            }}
          />
          <Chip size="small" label={`收发 ${stats.exchange}`} sx={{ height: 24, fontSize: '11px', color: DIRECTION_META.exchange.color, bgcolor: DIRECTION_META.exchange.bg }} />
          <Chip size="small" label={`下发 ${stats.out}`} sx={{ height: 24, fontSize: '11px', color: DIRECTION_META.out.color, bgcolor: DIRECTION_META.out.bg }} />
          <Chip size="small" label={`收到 ${stats.in}`} sx={{ height: 24, fontSize: '11px', color: DIRECTION_META.in.color, bgcolor: DIRECTION_META.in.bg }} />
          {stats.err > 0 ? (
            <Chip size="small" label={`错误 ${stats.err}`} sx={{ height: 24, fontSize: '11px', color: LEVEL_COLORS.error, bgcolor: alpha(LEVEL_COLORS.error, 0.12) }} />
          ) : null}
          {hasActiveFilter ? (
            <Chip size="small" label="已筛选" color="warning" variant="outlined" sx={{ height: 24, fontSize: '11px' }} />
          ) : null}
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
          minHeight: 0,
          flex: 1,
          overflow: 'auto',
        }}
      >
        <SearchFilterBox
          searchTerms={searchTerms}
          searchInput={searchInput}
          onInputChange={setSearchInput}
          onAdd={() => addSearchTerms()}
          onRemoveTerm={removeSearchTerm}
          onClearInput={() => setSearchInput('')}
          cardBg={cardBg}
          isDark={isDark}
          primary={primary}
          theme={theme}
        />

        <Paper
          elevation={0}
          sx={{
            borderRadius: '10px',
            border: `1px dashed ${hasActiveFilter ? alpha(primary, 0.35) : alpha(theme.palette.divider, isDark ? 0.2 : 0.6)}`,
            bgcolor: hasActiveFilter
              ? alpha(primary, isDark ? 0.06 : 0.04)
              : isDark
                ? 'rgba(255,255,255,0.02)'
                : 'rgba(0,0,0,0.015)',
            px: 1.25,
            py: 1,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: 'text.secondary' }}>
              {hasActiveFilter ? '已叠加筛选（点击标签可移除）' : '当前筛选条件'}
            </Typography>
            <Button
              size="small"
              startIcon={<FilterAltOffIcon sx={{ fontSize: '14px !important' }} />}
              onClick={resetFilters}
              disabled={!hasActiveFilter}
              sx={{ textTransform: 'none', fontSize: '12px', py: 0.25 }}
            >
              全部清除
            </Button>
          </Stack>
          {hasActiveFilter ? (
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {searchTerms.length > 0 ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`搜索: ${searchTerms.join(' + ')}`}
                  onDelete={() => setSearchTerms([])}
                  sx={{ height: 24, fontSize: '11px', maxWidth: '100%' }}
                />
              ) : null}
              {Array.from(directions).map((dir) => (
                <Chip
                  key={`dir-${dir}`}
                  size="small"
                  label={`方向: ${DIRECTION_META[dir].label}`}
                  onDelete={() => toggleDirection(dir)}
                  sx={{
                    height: 24,
                    fontSize: '11px',
                    color: DIRECTION_META[dir].color,
                    border: `1px solid ${alpha(DIRECTION_META[dir].color, 0.35)}`,
                  }}
                />
              ))}
              {Array.from(levels).map((lv) => (
                <Chip
                  key={`level-${lv}`}
                  size="small"
                  label={`级别: ${LEVEL_LABELS[lv]}`}
                  onDelete={() => toggleLevel(lv)}
                  sx={{
                    height: 24,
                    fontSize: '11px',
                    color: LEVEL_COLORS[lv],
                    border: `1px solid ${alpha(LEVEL_COLORS[lv], 0.35)}`,
                  }}
                />
              ))}
              {Array.from(sources).map((src) => (
                <Chip
                  key={`src-${src}`}
                  size="small"
                  label={`来源: ${SOURCE_LABELS[src] ?? src}`}
                  onDelete={() => toggleSource(src)}
                  sx={{ height: 24, fontSize: '11px' }}
                />
              ))}
              {!hasChipFilters && searchTerms.length === 0 && searchInput.trim() ? (
                <Typography sx={{ fontSize: '11px', color: 'text.disabled', alignSelf: 'center' }}>
                  按 Enter 或点「添加」确认搜索条件
                </Typography>
              ) : null}
            </Stack>
          ) : (
            <Typography sx={{ fontSize: '12px', color: 'text.disabled' }}>
              暂无筛选，可在下方选择方向/级别/来源，或在上方搜索框继续添加关键词
            </Typography>
          )}
        </Paper>

        {/* Filter toolbar */}
        <Paper
          elevation={0}
          sx={{
            borderRadius: '12px',
            border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.15 : 0.7)}`,
            bgcolor: cardBg,
            overflow: 'hidden',
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: 1.5,
              py: 0.75,
              cursor: 'pointer',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
            }}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
              筛选条件
              {hasActiveFilter ? (
                <Box component="span" sx={{ ml: 0.75, fontSize: '11px', fontWeight: 600, color: primary }}>
                  已选 {searchTerms.length + (searchInput.trim() ? 1 : 0) + directions.size + levels.size + sources.size} 项
                </Box>
              ) : null}
            </Typography>
            <Stack direction="row" alignItems="center" gap={0.5}>
              <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
                点击叠加，可多选
              </Typography>
              <IconButton size="small">{filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}</IconButton>
            </Stack>
          </Stack>

          <Collapse in={filtersOpen}>
            <Stack spacing={1.5} sx={{ px: 1.5, pb: 1.5, pt: 0.5 }}>
              <FilterSection title="方向">
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {directionOptions.map((opt) => (
                    <SelectChip
                      key={opt.value}
                      active={directions.has(opt.value)}
                      label={opt.label}
                      activeColor={opt.color}
                      onClick={() => toggleDirection(opt.value)}
                    />
                  ))}
                </Stack>
              </FilterSection>

              <FilterSection title="级别">
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {ALL_LEVELS.map((lv) => (
                    <SelectChip
                      key={lv}
                      active={levels.has(lv)}
                      label={LEVEL_LABELS[lv]}
                      activeColor={LEVEL_COLORS[lv]}
                      onClick={() => toggleLevel(lv)}
                    />
                  ))}
                </Stack>
              </FilterSection>

              <FilterSection title="来源">
                <Stack direction="row" flexWrap="wrap" gap={0.75}>
                  {allSources.map((src) => (
                    <SelectChip
                      key={src}
                      active={sources.has(src)}
                      label={SOURCE_LABELS[src] ?? src}
                      onClick={() => toggleSource(src)}
                    />
                  ))}
                </Stack>
              </FilterSection>
            </Stack>
          </Collapse>
        </Paper>

        {/* Log terminal */}
        <Box
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
            setAutoScroll(atBottom);
          }}
          sx={{
            flex: 1,
            minHeight: 180,
            maxHeight: hasActiveFilter ? 360 : 460,
            overflow: 'auto',
            borderRadius: '12px',
            border: `1px solid ${isDark ? alpha(primary, 0.2) : alpha(theme.palette.divider, 0.8)}`,
            bgcolor: terminalBg,
            backgroundImage: isDark
              ? 'radial-gradient(ellipse at top, rgba(56,189,248,0.03) 0%, transparent 50%)'
              : 'none',
            px: 1,
            py: 0.5,
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(primary, 0.25),
              borderRadius: 3,
            },
          }}
        >
          {entries.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6, px: 2 }}>
              <TerminalIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1, opacity: 0.4 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                暂无日志
              </Typography>
              <Typography sx={{ color: 'text.disabled', fontSize: '12px', mt: 0.5, textAlign: 'center' }}>
                开始升级后，收发数据将实时显示在这里
              </Typography>
            </Stack>
          ) : filteredEntries.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6, px: 2 }}>
              <SearchIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1, opacity: 0.4 }} />
              <Typography sx={{ color: 'text.secondary', fontSize: '14px', fontWeight: 500 }}>
                无匹配结果
              </Typography>
              <Typography sx={{ color: 'text.disabled', fontSize: '12px', mt: 0.5 }}>
                试试调整搜索词或筛选条件
              </Typography>
              {hasActiveFilter ? (
                <Button
                  size="small"
                  startIcon={<FilterAltOffIcon />}
                  onClick={resetFilters}
                  sx={{ mt: 1.5, textTransform: 'none', borderRadius: '8px' }}
                >
                  重置筛选
                </Button>
              ) : null}
            </Stack>
          ) : (
            displayItems.map((item) => {
              if (item.type === 'exchange') {
                return (
                  <LogExchangeLine
                    key={item.entry.id}
                    entry={item.entry}
                    searchTerms={allSearchTerms}
                    isDark={isDark}
                  />
                );
              }
              if (item.type === 'legacy-pair') {
                return (
                  <LogLegacyPairLine
                    key={`${item.out.id}-${item.inn.id}`}
                    out={item.out}
                    inn={item.inn}
                    searchTerms={allSearchTerms}
                    isDark={isDark}
                  />
                );
              }
              return (
                <LogLine key={item.entry.id} entry={item.entry} searchTerms={allSearchTerms} isDark={isDark} />
              );
            })
          )}
        </Box>
      </Box>
    </Dialog>
  );
}
