/**
 * 解析 GIF 二进制，统计图像帧数量（不含纯扩展、无图像块的情况）。
 * 用于前端限制上传，避免超大动画。
 */
export function countGifFrames(buffer: ArrayBuffer): number {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14) return 0;
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) return 0;
  const v = String.fromCharCode(bytes[3], bytes[4], bytes[5]);
  if (v !== "87a" && v !== "89a") return 0;

  let i = 13;
  const packed = bytes[10];
  if (packed & 0x80) {
    const gct = 2 << (packed & 0x07);
    i += gct * 3;
  }

  let frames = 0;

  const skipSubBlocks = (from: number): number => {
    let p = from;
    while (p < bytes.length) {
      const size = bytes[p];
      if (size === 0) return p + 1;
      p += 1 + size;
    }
    return p;
  };

  while (i < bytes.length) {
    const b = bytes[i];
    if (b === 0x3b) break;

    if (b === 0x21) {
      i += 2;
      if (i > bytes.length) break;
      i = skipSubBlocks(i);
      continue;
    }

    if (b === 0x2c) {
      i += 1;
      if (i + 9 > bytes.length) break;
      i += 9;
      const localPacked = bytes[i - 1];
      if (localPacked & 0x80) {
        const lct = 2 << (localPacked & 0x07);
        i += lct * 3;
      }
      if (i >= bytes.length) break;
      i += 1;
      i = skipSubBlocks(i);
      frames += 1;
      continue;
    }

    break;
  }

  return frames;
}

export function isGifFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return file.type === "image/gif" || n.endsWith(".gif");
}
