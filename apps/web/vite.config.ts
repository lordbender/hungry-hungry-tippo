import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          keycloak: ["keycloak-js"],
          mui: ["@mui/material", "@mui/icons-material"]
        }
      }
    }
  },
  server: {
    port: Number(process.env.WEB_PORT ?? 5173)
  }
});
