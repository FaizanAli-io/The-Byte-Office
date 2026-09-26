import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // Only pure logic is covered: no database, no network, no React.
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
