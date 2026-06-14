import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

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
