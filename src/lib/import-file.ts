// Client-side file importers: .txt, .md, .docx, .pdf (text-only), .epub

const MAX_BYTES = 20 * 1024 * 1024;

export type ImportResult = { text: string; title?: string };

export async function importFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_BYTES) {
    throw new Error("File quá lớn (>20MB). Vui lòng thử file nhỏ hơn.");
  }
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  switch (ext) {
    case "txt":
    case "md":
      return { text: await file.text() };
    case "docx":
      return parseDocx(file);
    case "pdf":
      return parsePdf(file);
    case "epub":
      return parseEpub(file);
    default:
      throw new Error(
        `Định dạng .${ext} chưa được hỗ trợ. Hãy dùng .txt, .md, .docx, .pdf, hoặc .epub.`,
      );
  }
}

async function parseDocx(file: File): Promise<ImportResult> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = (result.value ?? "").trim();
  if (!text) throw new Error("File .docx không có văn bản.");
  return { text, title: stripExt(file.name) };
}

async function parsePdf(file: File): Promise<ImportResult> {
  const pdfjs = await import("pdfjs-dist");
  // Point worker to a bundled URL so the app stays static (no CDN fetch).
  const workerUrl = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let last: { y: number } | null = null;
    let pageText = "";
    for (const item of content.items as Array<{
      str: string;
      hasEOL?: boolean;
      transform?: number[];
    }>) {
      const y = item.transform ? item.transform[5] : 0;
      if (last && Math.abs(y - last.y) > 2) pageText += "\n";
      pageText += item.str;
      if (item.hasEOL) pageText += "\n";
      last = { y };
    }
    parts.push(pageText.trim());
  }
  const text = parts.join("\n\n").trim();
  if (!text) {
    throw new Error(
      "PDF không có văn bản (có thể là ảnh scan). Ứng dụng chưa hỗ trợ OCR.",
    );
  }
  return { text, title: stripExt(file.name) };
}

async function parseEpub(file: File): Promise<ImportResult> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) throw new Error("EPUB không hợp lệ: thiếu container.xml");
  const containerXml = await containerFile.async("string");
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, "application/xml");
  const opfPath = containerDoc
    .querySelector("rootfile")
    ?.getAttribute("full-path");
  if (!opfPath) throw new Error("EPUB không hợp lệ: thiếu rootfile.");

  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error("EPUB không hợp lệ: không đọc được .opf.");
  const opfXml = await opfFile.async("string");
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  const bookTitle =
    opfDoc.getElementsByTagName("dc:title")[0]?.textContent?.trim() ||
    stripExt(file.name);

  // Build id -> href map from manifest
  const manifest: Record<string, string> = {};
  for (const item of Array.from(opfDoc.getElementsByTagName("item"))) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest[id] = href;
  }

  // Spine order
  const spineRefs = Array.from(opfDoc.getElementsByTagName("itemref"))
    .map((el) => el.getAttribute("idref"))
    .filter((x): x is string => !!x);

  const opfDir = opfPath.includes("/")
    ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1)
    : "";

  const chapters: string[] = [];
  for (const idref of spineRefs) {
    const href = manifest[idref];
    if (!href) continue;
    const path = resolvePath(opfDir, href.split("#")[0]);
    const entry = zip.file(path);
    if (!entry) continue;
    const html = await entry.async("string");
    const doc = parser.parseFromString(html, "application/xhtml+xml");
    const body = doc.querySelector("body");
    if (!body) continue;
    const headingEl = body.querySelector("h1, h2, h3, title");
    const chapterTitle =
      headingEl?.textContent?.trim() || stripExt(path.split("/").pop() ?? "");
    // Remove heading node so it isn't duplicated in body text
    if (headingEl) headingEl.remove();
    const bodyText = (body.textContent ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (!bodyText) continue;
    chapters.push(`# ${chapterTitle}\n\n${bodyText}`);
  }

  if (chapters.length === 0) throw new Error("EPUB rỗng hoặc không đọc được.");

  return { text: chapters.join("\n\n"), title: bookTitle };
}

function resolvePath(dir: string, rel: string): string {
  const parts = (dir + rel).split("/");
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "..") stack.pop();
    else if (p !== "." && p !== "") stack.push(p);
  }
  return stack.join("/");
}

function stripExt(name: string): string {
  return name.replace(/\.[^./\\]+$/, "");
}
