// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// For GitHub Pages under a project subpath (https://<user>.github.io/<repo>/), set
//   BASE_URL=/<repo>/ npm run build
// (the workflow in .github/workflows/deploy.yml does this automatically).
const base = process.env.BASE_URL || "/";

export default defineConfig({
  vite: {
    base,
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});
