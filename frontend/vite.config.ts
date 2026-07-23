import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Tailwind v4 entra como plugin do Vite — sem postcss.config, sem tailwind.config.js:
  // todo o tema (paleta, fontes, raios) vive em CSS, no @theme de src/styles/index.css.
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
