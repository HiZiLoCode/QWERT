import fs from 'fs';

const MODIFIERS = new Set([
  'Esc', 'Del', 'Tap', 'Caps', 'Shift', 'Ctrl', 'Win', 'Alt', 'Fn', 'Back', 'Enter',
  'Home', 'PgUp', 'PgDn', 'Up', 'Left', 'Down', 'Right',
]);
const FUNCTION = new Set(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);

function colorFor(name) {
  if (name === 'Enter' || ['Up', 'Left', 'Down', 'Right'].includes(name)) return '#777777';
  if (MODIFIERS.has(name) || FUNCTION.has(name)) return '#aaaaaa';
  return '#cccccc';
}

function visualRowKey(y) {
  if (y >= 5) return 5;
  if (y >= 4) return 4;
  return Math.round(y * 4) / 4;
}

function buildKeymap(keys) {
  const rows = new Map();
  for (const k of keys) {
    const yKey = visualRowKey(k.y);
    if (!rows.has(yKey)) rows.set(yKey, []);
    rows.get(yKey).push(k);
  }

  const sortedYs = [...rows.keys()].sort((a, b) => a - b);
  const keymap = [];
  let prevColor = null;

  for (const baseY of sortedYs) {
    const rowKeys = rows.get(baseY).sort((a, b) => a.x - b.x);
    const row = [];
    let xEnd = 0;

    for (const k of rowKeys) {
      const yOff = Math.round((k.y - baseY) * 100) / 100;
      if (yOff > 0.01) row.push({ y: yOff });

      const gap = Math.round((k.x - xEnd) * 100) / 100;
      if (gap > 0.01) row.push({ x: gap });

      const c = colorFor(k.name);
      if (c !== prevColor) {
        row.push({ c });
        prevColor = c;
      }

      if (k.w !== 1 || k.h !== 1) {
        row.push({ w: k.w, h: k.h });
      }

      row.push(`${k.row},${k.col}`);
      xEnd = k.x + k.w;
    }
    keymap.push(row);
  }
  return keymap;
}

const layout = JSON.parse(fs.readFileSync('src/data/keyboardLayout/36B0_307E_0.json', 'utf8'));
const oddity = JSON.parse(fs.readFileSync('src/data/config/Oddity75.json', 'utf8'));

const config = {
  name: 'Neo Code 75',
  vendorId: '0x36B0',
  productId: '0x307E',
  keycodes: ['qmk_lighting'],
  menus: oddity.menus,
  customKeycodes: oddity.customKeycodes,
  matrix: { rows: 6, cols: 16 },
  layouts: {
    labels: [],
    keymap: buildKeymap(layout.layouts.keys),
  },
};

fs.writeFileSync('src/data/config/0x36B0_0x307E.json', JSON.stringify(config, null, '\t') + '\n');
console.log('visual rows:', config.layouts.keymap.length);
