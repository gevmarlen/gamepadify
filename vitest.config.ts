import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: { gamepadify: fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/unit/**/*.test.ts'], restoreMocks: true },
});
