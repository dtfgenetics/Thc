import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { roomApiPlugin } from './dev/roomApiPlugin';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/games/high-land/' : '/',
  plugins: [roomApiPlugin(), react()]
}));
