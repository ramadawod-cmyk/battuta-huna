import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts on purpose: these are pure logic tests (no DOM, no
// React rendering), so there's no need to pull in the React/Tailwind/PWA plugins for
// every test run.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
