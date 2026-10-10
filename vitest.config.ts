import { defineConfig } from 'vitest/config';

// Unit tests exercise only the pure engine/content layer (no DOM required).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
