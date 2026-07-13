import { describe, expect, it } from 'vitest';
import {
  calculateImageDimensions,
  MAX_SOURCE_IMAGE_BYTES,
  validateSourceImage,
} from './imageProcessor';

describe('GrowLens image processor', () => {
  it('scales landscape images to the configured longest edge', () => {
    expect(calculateImageDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales portrait images without changing aspect ratio', () => {
    expect(calculateImageDimensions(2000, 4000, 1600)).toEqual({ width: 800, height: 1600 });
  });

  it('does not enlarge images that already fit', () => {
    expect(calculateImageDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('rejects invalid dimensions', () => {
    expect(() => calculateImageDimensions(0, 100)).toThrow('Image dimensions are invalid.');
  });

  it('rejects unsupported and oversized source files', () => {
    const unsupported = new File(['text'], 'notes.txt', { type: 'text/plain' });
    expect(() => validateSourceImage(unsupported)).toThrow('Use a JPEG, PNG, or WebP image.');

    const oversized = new File([new Uint8Array(MAX_SOURCE_IMAGE_BYTES + 1)], 'large.jpg', { type: 'image/jpeg' });
    expect(() => validateSourceImage(oversized)).toThrow('larger than 15 MB');
  });
});
