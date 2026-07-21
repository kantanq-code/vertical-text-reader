import { PDFDocument, rgb, degrees, type PDFPage, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

// Nạp OTF Noto CJK JP (bản static, không phải variable) từ raw.githubusercontent.
// File ~25MB (Regular), CORS enabled, chỉ tải lần đầu rồi cache trong module.
// KHÔNG dùng variable font vì pdf-lib/fontkit chọn instance ExtraLight mặc định
// khiến nhiều glyph không render được ("invalid outline").
const FONT_URLS: Record<"serif" | "sans", string> = {
  serif:
    "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/OTF/Japanese/NotoSerifCJKjp-Regular.otf",
  sans: "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf",
};

const fontCache: Partial<Record<"serif" | "sans", ArrayBuffer>> = {};

async function loadFont(kind: "serif" | "sans"): Promise<ArrayBuffer> {
  const cached = fontCache[kind];
  if (cached) return cached;
  const res = await fetch(FONT_URLS[kind]);
  if (!res.ok) throw new Error(`Không tải được font (${res.status})`);
  const buf = await res.arrayBuffer();
  fontCache[kind] = buf;
  return buf;
}

export interface ExportChaptersToPdfOptions {
  title: string;
  chapters: { title: string; body: string }[];
  font: "serif" | "sans";
  fontSize: number;
  lineHeight: number;
  theme: { bg: string; fg: string };
  onProgress?: (done: number, total: number) => void;
}

// Chuỗi ký tự latin/số bán cần xoay 90° khi đứng trong dòng dọc.
const ROTATE_RE = /[A-Za-z0-9!-~]/;
// Punctuation cần offset vị trí (dấu chấm/phẩy ở góc trên-phải trong dọc).
const TOP_RIGHT_PUNCT = new Set(["。", "、", "，", "．"]);
// Ngoặc/dấu cần xoay khi in dọc (jsPDF/pdf-lib không tự chuyển vertical variant).
const ROTATE_PUNCT = new Set([
  "「",
  "」",
  "『",
  "』",
  "（",
  "）",
  "【",
  "】",
  "〈",
  "〉",
  "《",
  "》",
  "ー",
  "…",
  "―",
  "─",
  "－",
]);

function parseHexColor(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6})$/i);
  if (!m) return rgb(0, 0, 0);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255);
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "tategaki";
}

export async function exportChaptersToPdf(opts: ExportChaptersToPdfOptions) {
  opts.onProgress?.(0, 1);
  const fontBytes = await loadFont(opts.font);
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  // subset:false vì pdf-lib/fontkit tạo subset CFF không hợp lệ với poppler.
  // Bù lại phải nạp full OTF (~25MB) nhưng chỉ tải một lần và cache client-side.
  const font: PDFFont = await pdfDoc.embedFont(fontBytes, { subset: false });

  // Khổ giấy: A4 dọc — tỉ lệ ổn cho tategaki nhiều cột.
  const pw = 595.28;
  const ph = 841.89;
  const fs = opts.fontSize;
  const titleSize = fs * 1.3;
  const marginX = fs * 2;
  const marginY = fs * 2.2;
  const colAdvance = fs * opts.lineHeight;

  const bgColor = parseHexColor(opts.theme.bg);
  const fgColor = parseHexColor(opts.theme.fg);

  let page: PDFPage = pdfDoc.addPage([pw, ph]);
  const paintBg = (p: PDFPage) =>
    p.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: bgColor });
  paintBg(page);

  // Toạ độ của "đỉnh" ô ký tự hiện tại (trong hệ pdf-lib bottom-left).
  let colX = pw - marginX - fs; // góc trái của cột (rộng fs)
  let yTop = ph - marginY; // y của đỉnh ô hiện tại

  const newPage = () => {
    page = pdfDoc.addPage([pw, ph]);
    paintBg(page);
    colX = pw - marginX - fs;
    yTop = ph - marginY;
  };

  const newColumn = () => {
    colX -= colAdvance;
    yTop = ph - marginY;
    if (colX < marginX) newPage();
  };

  const drawChar = (ch: string, size: number) => {
    if (ch === "\n" || ch === "\r") return;
    if (yTop - size < marginY) newColumn();

    const cx = colX + fs / 2; // tâm ngang của cột
    if (ROTATE_RE.test(ch) || ROTATE_PUNCT.has(ch)) {
      // Xoay 90° CW: ký tự nằm ngang → in dọc.
      // Trong pdf-lib, rotate xoay quanh (x, y). Đặt (x, y) sao cho ký tự
      // sau xoay lấp đúng ô [colX .. colX+fs] × [yTop-size .. yTop].
      page.drawText(ch, {
        x: cx + size * 0.35,
        y: yTop - size * 0.15,
        size,
        font,
        color: fgColor,
        rotate: degrees(-90),
      });
    } else if (TOP_RIGHT_PUNCT.has(ch)) {
      // Đẩy dấu lên góc trên-phải của ô để giống bố cục dọc.
      page.drawText(ch, {
        x: cx - size * 0.15,
        y: yTop - size * 0.75,
        size,
        font,
        color: fgColor,
      });
    } else {
      // Ký tự CJK bình thường: căn giữa ô, baseline ~ y - size*0.85.
      const w = font.widthOfTextAtSize(ch, size);
      page.drawText(ch, {
        x: cx - w / 2,
        y: yTop - size * 0.88,
        size,
        font,
        color: fgColor,
      });
    }
    yTop -= size;
  };

  const totalUnits = Math.max(1, opts.chapters.length);

  for (let ci = 0; ci < opts.chapters.length; ci++) {
    const c = opts.chapters[ci];
    if (ci > 0) newColumn(); // sang cột mới cho tiêu đề chương

    // Tiêu đề: in đậm hơn bằng cỡ 1.3× (font Regular vẫn ổn, không có Bold).
    for (const ch of Array.from(c.title)) drawChar(ch, titleSize);

    // Khoảng trắng sau tiêu đề: sang cột mới.
    newColumn();

    const paras = c.body.split(/\n{2,}/);
    for (let pi = 0; pi < paras.length; pi++) {
      const para = paras[pi].replace(/\n/g, "");
      if (!para) continue;

      // Thụt đầu đoạn 1 ký tự (bằng cách bỏ trống 1 ô ở đầu cột).
      yTop -= fs;
      if (yTop - fs < marginY) newColumn();

      for (const ch of Array.from(para)) drawChar(ch, fs);

      // Khoảng cách đoạn: sang cột mới.
      if (pi < paras.length - 1) newColumn();
    }

    opts.onProgress?.(ci + 1, totalUnits);
    // Nhường main thread để UI cập nhật progress.
    await new Promise((r) => setTimeout(r, 0));
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(opts.title)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
