import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend al que el server de desarrollo manda /api/v1. Por defecto el monolito local; con
// API_PROXY_TARGET se puede apuntar a otro (por ejemplo, el de AWS) sin tocar este archivo.
const apiTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8080";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api/v1": {
        target: apiTarget,
        changeOrigin: true
      },
      "/api/v1/auth": {
        target: apiTarget,
        changeOrigin: true
      }
    }
  }
});
