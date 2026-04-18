/**
 * 灵动岛动图：GIF 经 PNG 序列再经 WASM 压成 QGIF 后，体积常大于源 GIF。
 * 固件按 0x15 登记的 size 预留 FLASH；若实际 0x19 数据更大，末尾会花屏。
 *
 * 使用「全量一次 + 按比例缩帧少量重试」并每次让出主线程，避免对帧数二分导致
 * 连续十多次 WASM 压缩引发内存暴涨或长时间阻塞而页面崩溃。
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export async function compressPngFramesToQgifWithinPayloadLimit(
  pngFrames: Uint8Array[],
  fps: number,
  maxBytes: number,
  compressPngFramesToQgif: (frames: Uint8Array[], fpsArg: number) => Promise<Uint8Array>,
): Promise<{ bin: Uint8Array; usedFrames: number; trimmed: boolean }> {
  if (pngFrames.length === 0) {
    throw new Error("compressPngFramesToQgifWithinPayloadLimit: empty frames");
  }

  const nTotal = pngFrames.length;
  let bin = await compressPngFramesToQgif(pngFrames, fps);
  await yieldToMain();

  if (bin.length <= maxBytes) {
    return { bin, usedFrames: nTotal, trimmed: false };
  }

  let n = Math.max(
    1,
    Math.min(
      nTotal - 1,
      Math.floor(nTotal * (maxBytes / bin.length) * 0.93),
    ),
  );

  bin = await compressPngFramesToQgif(pngFrames.slice(0, n), fps);
  await yieldToMain();

  let guard = 0;
  while (bin.length > maxBytes && n > 1 && guard < 12) {
    const ratio = maxBytes / bin.length;
    let nextN = Math.max(1, Math.floor(n * ratio * 0.92));
    if (nextN >= n) nextN = n - 1;
    n = nextN;
    bin = await compressPngFramesToQgif(pngFrames.slice(0, n), fps);
    await yieldToMain();
    guard++;
  }

  if (bin.length <= maxBytes) {
    return { bin, usedFrames: n, trimmed: n < nTotal };
  }

  while (n > 1 && bin.length > maxBytes) {
    n -= 1;
    bin = await compressPngFramesToQgif(pngFrames.slice(0, n), fps);
    await yieldToMain();
  }

  if (bin.length <= maxBytes) {
    return { bin, usedFrames: n, trimmed: n < nTotal };
  }

  const single = await compressPngFramesToQgif(pngFrames.slice(0, 1), fps);
  await yieldToMain();
  if (single.length > maxBytes) {
    throw new Error("QGIF_SINGLE_FRAME_EXCEEDS_PAYLOAD_LIMIT");
  }
  return {
    bin: single,
    usedFrames: 1,
    trimmed: nTotal > 1,
  };
}
