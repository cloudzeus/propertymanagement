import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/stubs/empty.ts"),
      "next/server": path.resolve(__dirname, "test/stubs/next-server.ts"),
      "next/headers": path.resolve(__dirname, "test/stubs/next-headers.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "app/**/*.test.ts"],
    server: {
      deps: {
        // Force these node_modules packages through Vite's module graph so the
        // "next/server" / "next/headers" aliases above actually apply — by default
        // vitest resolves node_modules deps natively (bypassing resolve.alias).
        inline: [/next-auth/, /@auth\/core/],
      },
    },
  },
});
