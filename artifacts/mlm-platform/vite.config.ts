import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

async function loadReplitPlugins() {
  try {
    const [cartographerMod, bannerMod] = await Promise.all([
      import("@replit/vite-plugin-cartographer"),
      import("@replit/vite-plugin-dev-banner"),
    ]);
    return [
      cartographerMod.cartographer({ root: workspaceRoot }),
      bannerMod.devBanner(),
    ];
  } catch {
    return [];
  }
}

const replitPlugins =
  process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
    ? await loadReplitPlugins()
    : [];

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss(), runtimeErrorOverlay(), ...replitPlugins],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "attached_assets",
      ),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/api": {
        target: process.env.API_URL || "http://localhost:8080",
        changeOrigin: true,
      },
    },
    fs: {
      strict: true,
      allow: [workspaceRoot],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
