/**
 * 将源码中 fontSize / font-size 的 rem（按 1rem=16px）替换为 px。
 * 仅处理字面量 rem，不改动非字体的 rem（如 margin 的 pxToRem 调用需手工处理 Dropdown 等）。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', 'src');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function toPx(remStr) {
  const v = parseFloat(remStr);
  if (!Number.isFinite(v)) return null;
  return `${Math.round(v * 16)}px`;
}

function convert(content) {
  let s = content;
  // fontSize: '0.875rem' | "1.25rem" | '.95rem'
  s = s.replace(/fontSize:\s*(['"])((?:\d*\.)?\d+)\s*rem\1/g, (_, q, num) => {
    const px = toPx(num);
    return px != null ? `fontSize: ${q}${px}${q}` : _;
  });
  // font-size: 1.25rem;  (styled-components / raw CSS)
  s = s.replace(/font-size:\s*((?:\d*\.)?\d+)rem\s*;/g, (_, num) => {
    const px = toPx(num);
    return px != null ? `font-size: ${px};` : _;
  });
  s = s.replace(/font-size:\s*((?:\d*\.)?\d+)rem\s*\n/g, (_, num) => {
    const px = toPx(num);
    return px != null ? `font-size: ${px}\n` : _;
  });
  return s;
}

let changed = 0;
for (const file of walk(root)) {
  const raw = fs.readFileSync(file, 'utf8');
  const next = convert(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next);
    changed++;
  }
}
console.log(`convert-fontsize-rem-to-px: updated ${changed} files`);
