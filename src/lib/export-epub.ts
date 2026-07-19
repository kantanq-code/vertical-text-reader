import JSZip from "jszip";
import type { Chapter } from "./split-chapters";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphsToXhtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeXml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "tategaki";
}

export async function exportChaptersToEpub(opts: {
  title: string;
  author: string;
  chapters: Chapter[];
  font: "serif" | "sans";
}) {
  const { title, author, chapters, font } = opts;
  const zip = new JSZip();
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const fontFamily =
    font === "sans"
      ? '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'
      : '"Noto Serif JP", "Hiragino Mincho Pro", "Yu Mincho", serif';

  // mimetype MUST be the first file, stored (uncompressed).
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const css = `@charset "UTF-8";
html { -epub-writing-mode: vertical-rl; writing-mode: vertical-rl; }
body {
  font-family: ${fontFamily};
  line-height: 1.9;
  -epub-writing-mode: vertical-rl;
  writing-mode: vertical-rl;
  -webkit-writing-mode: vertical-rl;
  text-orientation: mixed;
  -epub-text-orientation: mixed;
}
h1, h2 { font-weight: 600; margin: 1em 0; }
p { text-indent: 1em; margin: 0 0 0.6em; }
`;
  zip.file("OEBPS/style.css", css);

  const items = chapters.map((c, i) => ({
    id: `chap${i + 1}`,
    href: `chap${i + 1}.xhtml`,
    title: c.title || `第${i + 1}章`,
    body: paragraphsToXhtml(c.body),
  }));

  for (const it of items) {
    zip.file(
      `OEBPS/${it.href}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ja" xml:lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(it.title)}</title>
  <link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${escapeXml(it.title)}</h1>
  ${it.body}
</body>
</html>`,
    );
  }

  const manifestItems = items
    .map(
      (it) =>
        `<item id="${it.id}" href="${it.href}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n    ");
  const spineItems = items
    .map((it) => `<itemref idref="${it.id}"/>`)
    .join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="ja">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(uid)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author || "Unknown")}</dc:creator>
    <dc:language>ja</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().split(".")[0]}Z</meta>
    <meta property="rendition:layout">reflowable</meta>
    <meta property="rendition:spread">auto</meta>
    <meta property="rendition:orientation">landscape</meta>
    <meta property="primary-writing-mode">vertical-rl</meta>
  </metadata>
  <manifest>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    ${manifestItems}
  </manifest>
  <spine page-progression-direction="rtl">
    ${spineItems}
  </spine>
</package>`,
  );

  const navList = items
    .map((it) => `<li><a href="${it.href}">${escapeXml(it.title)}</a></li>`)
    .join("\n      ");

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ja" xml:lang="ja">
<head>
  <meta charset="UTF-8"/>
  <title>目次</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目次</h1>
    <ol>
      ${navList}
    </ol>
  </nav>
</body>
</html>`,
  );

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(title)}.epub`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
