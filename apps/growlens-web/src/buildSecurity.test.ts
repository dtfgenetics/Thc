import { describe, expect, it } from 'vitest';
import viteConfig from '../vite.config';

describe('GrowLens production build security', () => {
  it('uses subdirectory-safe asset paths without publishing source maps', () => {
    expect(viteConfig.base).toBe('./');
    expect(viteConfig.build?.sourcemap).toBe(false);
    expect(viteConfig.build?.emptyOutDir).toBe(true);
  });
});
