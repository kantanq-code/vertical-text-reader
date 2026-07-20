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

export default defineConfig({
  vite: {
    base,
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Prerender every reachable route to static HTML (single-page app "/" here).
    prerender: {
      enabled: true,
      crawlLinks: true,
      autoSubfolderIndex: true,
    },
    // SPA fallback: any unknown URL loads the shell so the client router can take over.
    // On GitHub Pages we also copy index.html → 404.html in the workflow to trigger this.
    pages: [{ path: "/", prerender: { enabled: true } }],
  },
  nitro: {
    preset: "static",
  },
});
