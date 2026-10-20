import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages sirve la web en https://josemtx.github.io/geolab-confital/
// Dos páginas: la historia (index.html) y el panel de datos (datos/index.html).
export default defineConfig({
  base: "/geolab-confital/",
  build: {
    rollupOptions: {
      input: { inicio: resolve(__dirname, "index.html"), datos: resolve(__dirname, "datos/index.html") },
    },
  },
});
