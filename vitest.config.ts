import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The same `@/*` → project root mapping tsconfig.json gives the app, so a
  // module under test can use the import style the rest of the codebase does.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['{app,components,lib}/**/*.test.ts'],
  },
});
