import { getPublicAssetUrlCandidates } from '@/utils/resolvePublicAssetUrl';

const DEFAULT_CONCURRENCY = 8;

function preloadOne(path: string): Promise<void> {
  const candidates = getPublicAssetUrlCandidates(path);
  return new Promise((resolve) => {
    let index = 0;
    const img = new Image();
    img.decoding = 'async';

    const tryNext = () => {
      if (index >= candidates.length) {
        resolve();
        return;
      }
      const url = candidates[index]!;
      index += 1;
      img.onload = () => resolve();
      img.onerror = tryNext;
      img.src = url;
    };

    tryNext();
  });
}

/**
 * 后台预加载 `public/` 资源，降低键位池首次展开时图标空白。
 * `priority` 路径会先进入队列（如侧栏、设置 Tab 图标）。
 */
export function preloadPublicAssets(
  paths: readonly string[],
  options?: { priority?: readonly string[]; concurrency?: number },
): void {
  if (typeof window === 'undefined') return;

  const prioritySet = new Set(options?.priority ?? []);
  const unique = [...new Set(paths.map((p) => p.trim()).filter(Boolean))];
  const ordered = [
    ...unique.filter((p) => prioritySet.has(p)),
    ...unique.filter((p) => !prioritySet.has(p)),
  ];

  const concurrency = Math.max(1, options?.concurrency ?? DEFAULT_CONCURRENCY);
  let cursor = 0;
  let active = 0;

  const pump = () => {
    while (active < concurrency && cursor < ordered.length) {
      const path = ordered[cursor++]!;
      active += 1;
      void preloadOne(path).finally(() => {
        active -= 1;
        pump();
      });
    }
  };

  pump();
}
