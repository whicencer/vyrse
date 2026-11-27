import { defineConfig } from 'vite';

export default defineConfig({
  root: import.meta.dirname,
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  server: { host: true, port: 5173 },
});
