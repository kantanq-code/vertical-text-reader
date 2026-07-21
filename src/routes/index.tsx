import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { splitChapters } from "@/lib/split-chapters";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tategaki — Đọc văn bản Nhật theo chiều dọc" },
      {
        name: "description",
        content:
          "Dán văn bản tiếng Nhật và đọc theo chiều dọc như báo, sách Nhật. Xuất PDF hoặc EPUB tategaki ngay trong trình duyệt.",
      },
      { property: "og:title", content: "Tategaki — Đọc văn bản Nhật theo chiều dọc" },
      {
        property: "og:description",
        content:
          "Dán văn bản tiếng Nhật và đọc theo chiều dọc. Xuất PDF/EPUB tategaki.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type FontChoice = "serif" | "sans";
type Theme = "paper" | "white" | "dark";
type Size = "sm" | "md" | "lg" | "xl";

const SAMPLE = `# 序章
むかしむかし、あるところに、おじいさんとおばあさんが住んでいました。

おじいさんは山へしばかりに、おばあさんは川へせんたくに行きました。

# 第一章
おばあさんが川でせんたくをしていると、大きな桃がどんぶらこ、どんぶらこと流れてきました。`;

const STORAGE_KEY = "tategaki:v1";

const SIZE_PX: Record<Size, number> = { sm: 16, md: 20, lg: 24, xl: 30 };

const THEME_STYLES: Record<Theme, { bg: string; fg: string; muted: string }> = {
  paper: { bg: "#f5efe0", fg: "#231f18", muted: "#7a6f57" },
  white: { bg: "#ffffff", fg: "#111111", muted: "#666666" },
  dark: { bg: "#141414", fg: "#ececec", muted: "#8a8a8a" },
};

export function Index() {
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [font, setFont] = useState<FontChoice>("serif");
  const [theme, setTheme] = useState<Theme>("paper");
  const [size, setSize] = useState<Size>("md");
  const [lineHeight, setLineHeight] = useState(1.9);
  const [zenkakuNums, setZenkakuNums] = useState(true);
  const [mode, setMode] = useState<"editor" | "reader">("editor");
  const [busy, setBusy] = useState<"pdf" | "epub" | null>(null);
  const [importing, setImporting] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Load saved draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setText(s.text ?? "");
        setTitle(s.title ?? "");
        setAuthor(s.author ?? "");
        setFont(s.font ?? "serif");
        setTheme(s.theme ?? "paper");
        setSize(s.size ?? "md");
        setLineHeight(s.lineHeight ?? 1.9);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist draft
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ text, title, author, font, theme, size, lineHeight }),
      );
    } catch {
      /* ignore */
    }
  }, [text, title, author, font, theme, size, lineHeight]);

  const chapters = useMemo(() => {
    const raw = splitChapters(text, title || "本文");
    if (!zenkakuNums) return raw;
    const conv = (s: string) =>
      s.replace(/[0-9]/g, (d) =>
        String.fromCharCode(0xff10 + d.charCodeAt(0) - 0x30),
      );
    return raw.map((c) => ({ ...c, title: conv(c.title), body: conv(c.body) }));
  }, [text, title, zenkakuNums]);

  const themeStyle = THEME_STYLES[theme];
  const fontFamily =
    font === "sans"
      ? '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif'
      : '"Noto Serif JP", "Hiragino Mincho Pro", "Yu Mincho", serif';

  async function handleExportPdf() {
    if (!readerRef.current || busy) return;
    setBusy("pdf");
    try {
      const { exportReaderToPdf } = await import("@/lib/export-pdf");
      await exportReaderToPdf(readerRef.current, title || "tategaki");
    } catch (e) {
      console.error(e);
      alert("Xuất PDF thất bại. Vui lòng thử lại, hoặc dùng EPUB.");
    } finally {
      setBusy(null);
    }
  }

  async function handleExportEpub() {
    if (busy || chapters.length === 0) return;
    setBusy("epub");
    try {
      const { exportChaptersToEpub } = await import("@/lib/export-epub");
      await exportChaptersToEpub({
        title: title || "Tategaki",
        author,
        chapters,
        font,
      });
    } catch (e) {
      console.error(e);
      alert("Xuất EPUB thất bại.");
    } finally {
      setBusy(null);
    }
  }

  async function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again re-triggers change
    e.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    try {
      const { importFile } = await import("@/lib/import-file");
      const { text: imported, title: importedTitle } = await importFile(file);
      setText((prev) =>
        prev.trim() ? `${prev.trimEnd()}\n\n${imported}` : imported,
      );
      if (importedTitle && !title.trim()) setTitle(importedTitle);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Không đọc được file.");
    } finally {
      setImporting(false);
    }
  }



  if (mode === "reader") {
    return (
      <div
        className="min-h-screen w-full"
        style={{ backgroundColor: themeStyle.bg, color: themeStyle.fg }}
      >
        {/* Toolbar */}
        <div
          className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b px-3 py-2 backdrop-blur"
          style={{
            backgroundColor: `${themeStyle.bg}ee`,
            borderColor: `${themeStyle.muted}33`,
          }}
        >
          <button
            onClick={() => setMode("editor")}
            className="rounded-md border px-3 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: `${themeStyle.muted}66` }}
          >
            ← Chỉnh sửa
          </button>
          <div className="mx-1 h-5 w-px" style={{ backgroundColor: `${themeStyle.muted}55` }} />
          <span className="text-xs" style={{ color: themeStyle.muted }}>
            Cỡ chữ:
          </span>
          {(["sm", "md", "lg", "xl"] as Size[]).map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className="rounded px-2 py-1 text-xs"
              style={{
                backgroundColor: size === s ? `${themeStyle.muted}33` : "transparent",
                border: `1px solid ${themeStyle.muted}55`,
              }}
            >
              {s.toUpperCase()}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={handleExportPdf}
              disabled={busy !== null}
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              style={{ borderColor: `${themeStyle.muted}66` }}
            >
              {busy === "pdf" ? "Đang xuất…" : "Xuất PDF"}
            </button>
            <button
              onClick={handleExportEpub}
              disabled={busy !== null || chapters.length === 0}
              className="rounded-md px-3 py-1.5 text-sm text-white disabled:opacity-50"
              style={{ backgroundColor: "#1f6feb" }}
            >
              {busy === "epub" ? "Đang xuất…" : "Xuất EPUB"}
            </button>
          </div>
        </div>

        {/* Reader */}
        <div
          className="w-full overflow-x-auto overflow-y-hidden"
          style={{ scrollSnapType: "x mandatory" }}
        >
          <div
            ref={readerRef}
            lang="ja"
            style={{
              writingMode: "vertical-rl",
              WebkitWritingMode: "vertical-rl",
              textOrientation: "mixed",
              fontFamily,
              fontSize: SIZE_PX[size],
              lineHeight,
              color: themeStyle.fg,
              backgroundColor: themeStyle.bg,
              padding: "3rem 2.5rem",
              // Fixed generous height so long text spreads across columns
              height: "calc(100vh - 60px)",
              minWidth: "100%",
              boxSizing: "border-box",
              // Let content flow vertically first, then create new columns rightward
              columnFill: "auto",
            }}
          >
            {chapters.length === 0 ? (
              <p style={{ color: themeStyle.muted }}>
                Chưa có nội dung. Quay lại chỉnh sửa để dán văn bản.
              </p>
            ) : (
              chapters.map((c, i) => (
                <section
                  key={i}
                  style={{
                    marginInlineStart: i === 0 ? 0 : "2.5rem",
                    breakBefore: i === 0 ? "auto" : "column",
                  }}
                >
                  <h2
                    style={{
                      fontWeight: 600,
                      fontSize: SIZE_PX[size] * 1.3,
                      marginBlockEnd: "1.2em",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {c.title}
                  </h2>
                  {c.body.split(/\n{2,}/).map((para, j) => (
                    <p
                      key={j}
                      style={{
                        margin: 0,
                        marginInlineEnd: "1.2em",
                        textIndent: "1em",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {para}
                    </p>
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Editor mode
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tategaki — Đọc văn bản Nhật theo chiều dọc
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Dán một đoạn văn, một bài báo, hoặc cả cuốn sách. Chuyển sang chế độ
            đọc để xem tategaki (dọc, phải sang trái) như báo và sách Nhật. Có
            thể xuất PDF hoặc EPUB.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Mẹo: dòng bắt đầu bằng <code className="rounded bg-muted px-1"># </code>
            sẽ được tách thành chương riêng trong EPUB.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Tiêu đề
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: 朝日新聞 2026年7月19日"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Tác giả (tuỳ chọn)
            </span>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ví dụ: 夏目 漱石"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            Văn bản tiếng Nhật
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ここに日本語のテキストを貼り付けてください…"
            spellCheck={false}
            rows={16}
            className="w-full rounded-md border border-input bg-background px-3 py-3 font-mono text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring"
            style={{ fontFamily: '"Noto Sans JP", ui-monospace, monospace' }}
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Font
            </span>
            <select
              value={font}
              onChange={(e) => setFont(e.target.value as FontChoice)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="serif">Minchō (Noto Serif JP)</option>
              <option value="sans">Gothic (Noto Sans JP)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Nền
            </span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="paper">Giấy báo</option>
              <option value="white">Trắng</option>
              <option value="dark">Tối</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Cỡ chữ
            </span>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as Size)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="sm">Nhỏ</option>
              <option value="md">Vừa</option>
              <option value="lg">Lớn</option>
              <option value="xl">Rất lớn</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Khoảng cách dòng: {lineHeight.toFixed(1)}
            </span>
            <input
              type="range"
              min={1.4}
              max={2.6}
              step={0.1}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setMode("reader")}
            disabled={!text.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Đọc dọc →
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.docx,.pdf,.epub"
            onChange={handleFilePicked}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            {importing ? "Đang đọc file…" : "Tải file lên"}
          </button>
          <button
            onClick={() => {
              setText(SAMPLE);
              setTitle("桃太郎");
            }}
            className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Dùng văn bản mẫu
          </button>
          <button
            onClick={() => {
              if (confirm("Xoá toàn bộ văn bản?")) {
                setText("");
                setTitle("");
                setAuthor("");
              }
            }}
            className="ml-auto rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
          >
            Xoá
          </button>
        </div>

        <footer className="mt-10 text-xs text-muted-foreground">
          Toàn bộ xử lý chạy trong trình duyệt — văn bản không rời khỏi máy bạn.
          Hỗ trợ tải lên .txt, .md, .docx, .pdf (có sẵn chữ), .epub.
        </footer>

      </div>
    </div>
  );
}
