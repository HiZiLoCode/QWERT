declare module "omggif" {
  export class GifWriter {
    constructor(
      buf: Uint8Array,
      width: number,
      height: number,
      gopts?: { loop?: number | null; palette?: number[] | null; background?: number },
    );
    addFrame(
      x: number,
      y: number,
      w: number,
      h: number,
      indexed_pixels: Uint8Array,
      opts?: {
        delay?: number;
        palette?: number[] | null;
        disposal?: number;
        transparent?: number | null;
      },
    ): number;
    end(): number;
    getOutputBuffer(): Uint8Array;
    getOutputBufferPosition(): number;
  }
}
