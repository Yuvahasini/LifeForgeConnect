import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8082,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Trailing slash ensures we only match actual API calls, not frontend routes.
      // e.g. "/blood/" matches "/blood/requests" but NOT "/blood-bridge"
      "/auth": { target: "http://localhost:8000", changeOrigin: true },
      "/blood/": { target: "http://localhost:8000", changeOrigin: true },
      "/thal/": { target: "http://localhost:8000", changeOrigin: true },
      "/platelet/": { target: "http://localhost:8000", changeOrigin: true },
      "/marrow/": { target: "http://localhost:8000", changeOrigin: true },
      "/organ/": { target: "http://localhost:8000", changeOrigin: true },
      "/milk/": { target: "http://localhost:8000", changeOrigin: true },
      "/stats": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));