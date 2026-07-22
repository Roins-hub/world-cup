import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    host: "0.0.0.0",
    port: 5173,

    allowedHosts: [
      "world-cup-poduction.up.railway.app",
    ],

    proxy: {
      "/api": "http://localhost:4317",
      "/artifacts": "http://localhost:4317",
    },
  },
});
