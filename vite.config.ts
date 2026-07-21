// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inside the Lovable build/preview, the wrapper forces the Cloudflare preset (server runtime)
// so overrides to `nitro.preset` / `tanstackStart.prerender` are ignored — that's fine, Lovable
// preview still works. Outside Lovable (e.g. GitHub Actions), we opt into fully static output:
//   - nitro preset "static"  → no server runtime in the build output
//   - prerender the whole site → produces plain index.html + assets
// The resulting `dist/` can be hosted on GitHub Pages / any static host.
//
// For GitHub Pages under a project subpath (https://<user>.github.io/<repo>/), set
//   BASE_URL=/<repo>/ npm run build
// (the workflow in .github/workflows/deploy.yml does this automatically).
const base = process.env.BASE_URL || "/";
// Only opt into fully-static output when explicitly building for a static host
// (e.g. GitHub Actions sets STATIC_BUILD=1). Inside the Lovable sandbox the
// wrapper forces the Cloudflare preset and prerender crashes because its
// preview-server-plugin can't find the node-server entry.
const staticBuild = process.env.STATIC_BUILD === "1";

export default defineConfig({
  vite: {
    base,
  },
  tanstackStart: {
    server: { entry: "server" },
    ...(staticBuild
      ? {
          prerender: {
            enabled: true,
            crawlLinks: true,
            autoSubfolderIndex: true,
          },
        }
      : {}),
  },
  ...(staticBuild ? { nitro: { preset: "static" } } : {}),
});
