/**
 * 解析 `public/` 下静态资源 URL。`next.config` 中 `assetPrefix: "./"` 且静态导出时，
 * 仅用根路径 `/foo.svg` 作 `<img src>` 或 `fetch` 可能 404，需补充相对当前页的 `./foo.svg`。
 */

export function getPublicAssetUrlCandidates(absolutePath: string): string[] {
  const trimmed = absolutePath.trim();
  if (!trimmed) return [''];

  const attempts: string[] = [];

  if (typeof window !== 'undefined' && trimmed.startsWith('/')) {
    try {
      attempts.push(new URL(`.${trimmed}`, window.location.href).href);
    } catch {
      /* ignore */
    }
    attempts.push(`${window.location.origin}${trimmed}`);
  }

  attempts.push(trimmed);
  return [...new Set(attempts)];
}

/** 首选 URL（与 `getPublicAssetUrlCandidates` 顺序一致） */
export function resolvePublicAssetUrl(absolutePath: string): string {
  return getPublicAssetUrlCandidates(absolutePath)[0] ?? absolutePath;
}
