import { defineConfig } from 'vitest/config';

// Unit tests exercise only the pure engine/content layer (no DOM required).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // The app formats clock times in the reader's local zone, and the golden SBAR fixture was
    // captured at UTC+3. Pin the zone so the suite is identical on a developer machine and in CI
    // (which runs in UTC) — without this the golden comparison failed the deploy pipeline.
    env: { TZ: 'Asia/Riyadh' },
  },
});
