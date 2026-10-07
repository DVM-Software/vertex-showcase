import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run dev` serves the film from src/ with live reload.
// `npm run build` packs everything (three.js, font, styles, code) into one
// HTML file that opens with a double-click and needs no network.
export default defineConfig({
  server: { port: 5190, open: false },
  plugins: [viteSingleFile()],
  build: { assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
});
