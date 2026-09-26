import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` throws unless the `react-server` condition is set, which
      // Next does and a test runner does not. Point it at the package's own
      // no-op entry: the guard stays real in the application and inert here.
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    // Only pure logic is covered: no database, no network, no React.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
