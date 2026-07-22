import { defineConfig } from "vite";

// 正式環境（sit-kevin nginx /defense/）設 VITE_BASE=/defense/
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        // OAuth cookie 需轉發
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            if (req.headers.cookie) {
              proxyReq.setHeader("cookie", req.headers.cookie);
            }
          });
        },
      },
    },
  },
  build: {
    target: "es2022",
  },
});
