import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Integration tests hammer a live WordPress container with sequential
    // HTTP round-trips (4–6 per test). The vitest default (5000 ms) is not
    // enough under host load.
    //
    // The value is derived from waitForRule's budget, not chosen freely:
    // after setProtectRule the rule becomes observable only with a delay
    // that was MEASURED at up to 38.8 s under load ~77, so waitForRule
    // polls for 60 s (delta.test.ts). A harness timeout below that budget
    // makes the budget decorative — vitest would kill the test before
    // waitForRule ever gives up. 90 s covers the 60 s wait plus the
    // 4–6 round-trips around it, and still fails a genuine hang.
    testTimeout: 90000,
    hookTimeout: 90000,
    exclude: [
      'docs/**',
      '**/docs/archive/**',
      'node_modules/**',
      'dist/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/cli.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
