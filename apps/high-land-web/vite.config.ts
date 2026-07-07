import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/games/high-land/' : '/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Forks are slower to start but avoid intermittent Windows worker-thread
    // startup timeouts in clean worktrees and constrained CI runners.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 15000
  }
}));
