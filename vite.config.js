import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the same build works at
// https://<user>.github.io/FilaScribe/ and inside the Android app.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.0.0'),
    // Where this build came from (set by the workflows; empty for local builds)
    __BUILD__: JSON.stringify({
      repo: process.env.GITHUB_REPOSITORY || '',
      pr: process.env.BUILD_PR || '',
      run: process.env.BUILD_RUN || '',
      commit: process.env.BUILD_COMMIT || '',
      tag: process.env.BUILD_TAG || '',
    }),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    // The brand-colors snapshot is one ~610 kB chunk (135 kB gzipped), loaded
    // only after the page appears
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['tests/**/*.test.js'],
  },
});
