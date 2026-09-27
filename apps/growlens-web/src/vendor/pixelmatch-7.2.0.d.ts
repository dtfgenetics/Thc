declare module './pixelmatch-7.2.0.js' {
  export type PixelmatchOptions = {
    threshold?: number;
    includeAA?: boolean;
    alpha?: number;
    diffColor?: [number, number, number];
    diffColorAlt?: [number, number, number];
    aaColor?: [number, number, number];
    diffMask?: boolean;
    checkerboard?: boolean;
  };
  export default function pixelmatch(
    img1: Uint8Array | Uint8ClampedArray,
    img2: Uint8Array | Uint8ClampedArray,
    output: Uint8Array | Uint8ClampedArray | undefined,
    width: number,
    height: number,
    options?: PixelmatchOptions,
  ): number;
}
