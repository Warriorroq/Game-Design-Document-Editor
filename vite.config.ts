import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    headers: {
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  preview: {
    headers: {
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
