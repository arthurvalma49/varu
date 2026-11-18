import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png}", "**/*latin*.woff2"] },
      manifest: {
        name: "Varu – puudumiste arvestus",
        short_name: "Varu",
        description: "Kui palju tunde võid veel puududa, enne kui aine läheb üle kooli piiri.",
        lang: "et",
        theme_color: "#14161c",
        background_color: "#14161c",
        display: "standalone",
        start_url: ".",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
});
