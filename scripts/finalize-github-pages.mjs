import { copyFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = "dist/github-pages";
const githubPagesHtml = join(outputDir, "index.github-pages.html");
const indexHtml = join(outputDir, "index.html");
const notFoundHtml = join(outputDir, "404.html");

try {
  await rename(githubPagesHtml, indexHtml);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    // Vite may already emit index.html in a future version/config.
  } else {
    throw error;
  }
}

await copyFile(indexHtml, notFoundHtml);
await writeFile(join(outputDir, ".nojekyll"), "");