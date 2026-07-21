import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const outputDir = "dist/client";
const assetsDir = join(outputDir, "assets");

function normalizeBase(value) {
  const base = value || "/";
  if (base === "/") return "/";
  return `/${base.replace(/^\/+|\/+$/g, "")}/`;
}

const base = normalizeBase(process.env.BASE_URL);
const assetHref = (file) => `${base}assets/${file}`;

const assets = await readdir(assetsDir);

const entryCandidates = assets.filter((file) => /^index-.*\.js$/.test(file));
let entry = "";
for (const file of entryCandidates) {
  const source = await readFile(join(assetsDir, file), "utf8");
  if (source.includes("hydrateRoot(document")) {
    entry = file;
    break;
  }
}

if (!entry) {
  throw new Error("Could not find the client entry bundle in dist/client/assets.");
}

const stylesheet = assets.find((file) => /^styles-.*\.css$/.test(file));

const html = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Tategaki — Đọc văn bản Nhật theo chiều dọc</title>
    <meta name="description" content="Dán văn bản tiếng Nhật và đọc theo chiều dọc như báo, sách Nhật. Xuất PDF hoặc EPUB tategaki ngay trong trình duyệt." />
    <meta property="og:title" content="Tategaki — Đọc văn bản Nhật theo chiều dọc" />
    <meta property="og:description" content="Dán văn bản tiếng Nhật và đọc theo chiều dọc. Xuất PDF/EPUB tategaki." />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="${base}favicon.ico" type="image/x-icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&family=Noto+Sans+JP:wght@400;600;700&display=swap" />
    ${stylesheet ? `<link rel="stylesheet" href="${assetHref(stylesheet)}" />` : ""}
    <script type="module" src="${assetHref(entry)}"></script>
  </head>
  <body></body>
</html>
`;

await writeFile(join(outputDir, "index.html"), html);
await writeFile(join(outputDir, "404.html"), html);