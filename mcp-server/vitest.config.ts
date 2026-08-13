import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Integration tests hammer a live WordPress container with sequential
    // HTTP round-trips (4–6 per test). The vitest default (5000 ms) is not
    // enough under host load — 30 s gives the container room without hiding
    // a genuine hang.
    testTimeout: 30000,
    hookTimeout: 30000,
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
