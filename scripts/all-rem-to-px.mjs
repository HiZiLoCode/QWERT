/**
 * 将源码中的 CSS rem 单位转为 px（1rem = 16px）。
 * 匹配 -?数字 rem 词边界，避免误伤 remaining、remove 等标识符。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

const REM_RE = /-?(?:\d+\.?\d*|\.\d+)\s*rem\b/gi;

function remToPx(match) {
  const compact = match.replace(/\s/g, '');
  const neg = /^-/i.test(compact);
  const numStr = compact.replace(/^-/i, '').replace(/rem$/i, '');
  const n = parseFloat(numStr);
  if (!Number.isFinite(n)) return match;
  const px = n * 16 * (neg ? -1 : 1);
  const rounded = Math.round(px);
  if (Math.abs(px - rounded) < 1e-6) return `${rounded}px`;
  const t = Math.round(px * 100) / 100;
  return `${t}px`;
}

function convert(content) {
  return content.replace(REM_RE, remToPx);
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|css)$/i.test(ent.name)) out.push(p);
  }
  return out;
}

let files = 0;
for (const file of walk(srcRoot)) {
  const raw = fs.readFileSync(file, 'utf8');
  const next = convert(raw);
  if (next !== raw) {
    fs.writeFileSync(file, next);
    files++;
  }
}
console.log(`all-rem-to-px: updated ${files} files under src/`);
