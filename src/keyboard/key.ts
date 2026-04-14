import { KeyboardLayoutKey } from "../types/types";

export const isLayerCode = (code: string) => {
  return /([A-Za-z]+)\((\d+)\)/.test(code);
};

export const getComboKeyProps = (
  k: KeyboardLayoutKey
): {
  clipPath: null | string;
  normalizedRects:
    | null
    | [[number, number, number, number], [number, number, number, number]];
} => {
  if (k.w2 === undefined || k.h2 === undefined) {
    return { clipPath: null, normalizedRects: null };
  }

  const { x, y, x2 = 0, y2 = 0, w, w2, h, h2 } = k;
  const boundingBoxWidth = Math.max(k.w, k.w2);
  const boundingBoxHeight = Math.max(k.h, k.h2);
  const minX = Math.min(x, x + x2);
  const minY = Math.min(y, y + y2);
  const [nx, nx2, ny, ny2, nw, nw2, nh, nh2] =
    w === boundingBoxWidth
      ? [x + x2 - minX, x - minX, y + y2 - minY, y - minY, w2, w, h2, h]
      : [x - minX, x + x2 - minX, y - minY, y + y2 - minY, w, w2, h, h2];
  const getPolygonPath = (corners: number[][]) =>
    `polygon(${corners.map((c) => `${100 * c[0]}% ${100 * c[1]}%`).join(",")})`;

  const corners = [
    [nx2 / boundingBoxWidth, ny2 / boundingBoxHeight],
    [nx / boundingBoxWidth, ny2 / boundingBoxHeight],
    [nx / boundingBoxWidth, ny / boundingBoxHeight],
    [(nx + nw) / boundingBoxWidth, ny / boundingBoxHeight],
    [(nx + nw) / boundingBoxWidth, ny2 / boundingBoxHeight],
    [(nx2 + nw2) / boundingBoxWidth, ny2 / boundingBoxHeight],
    [(nx2 + nw2) / boundingBoxWidth, (ny2 + nh2) / boundingBoxHeight],
    [(nx + nw) / boundingBoxWidth, (ny2 + nh2) / boundingBoxHeight],
    [(nx + nw) / boundingBoxWidth, (ny + nh) / boundingBoxHeight],
    [nx / boundingBoxWidth, (ny + nh) / boundingBoxHeight],
    [nx / boundingBoxWidth, (ny2 + nh2) / boundingBoxHeight],
    [nx2 / boundingBoxWidth, (ny2 + nh2) / boundingBoxHeight],
  ];
  return {
    clipPath: getPolygonPath(corners),
    normalizedRects: [
      [nx, ny, nw, nh],
      [nx2, ny2, nw2, nh2],
    ],
  };
};
