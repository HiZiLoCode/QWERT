/** 与 `GifConverter` 一致：大帧数 QGIF 压缩前扩展 WASM 堆，降低 OOM / 标签页崩溃概率 */
export async function tryExtendQgifWasmMemory(qgifModule: {
  _getMemoryPages?: () => number;
  _extendMemory?: (pages: number) => void;
}): Promise<void> {
  try {
    const get = qgifModule._getMemoryPages;
    const ext = qgifModule._extendMemory;
    if (typeof get !== "function" || typeof ext !== "function") return;
    const currentPages = get();
    const targetPages = Math.ceil((currentPages * 1.5) / 64) * 64;
    if (targetPages > currentPages) {
      ext(targetPages);
    }
  } catch {
    // 忽略：部分构建的 qgif 无扩展接口
  }
}
