import { defineConfig } from 'vite';

export default defineConfig({
  // Phaser is ~1.3MB and is needed at startup, so splitting it out saves nothing meaningful;
  // just lift the cosmetic chunk-size warning above the Phaser bundle size.
  build: { chunkSizeWarningLimit: 1600 },
  test: { globals: true, environment: 'node' },
});
