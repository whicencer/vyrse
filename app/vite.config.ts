import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // The shared .env lives in the repo root, one level above the app.
  const env = loadEnv(mode, `${import.meta.dirname}/..`, '');

  return {
    root: import.meta.dirname,
    // Baked into the bundle: anyone who has the app build can read it.
    define: { __WS_CONNECTION_SECRET__: JSON.stringify(env.WS_CONNECTION_SECRET ?? '') },
    build: { outDir: '../dist/glasses', emptyOutDir: true, target: 'es2022' },
    server: { host: true, port: 5173 },
  };
});
