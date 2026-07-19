## Mục tiêu

Thêm nút **"Tải file lên"** ở màn Editor để nạp thẳng nội dung một cuốn sách / bài dài vào textarea, không cần copy-paste. Chấp nhận `.txt`, `.md`, `.docx`, `.pdf` (chỉ PDF có sẵn chữ), `.epub`. Toàn bộ parse chạy trong trình duyệt, không cần backend — tương thích static build cho GitHub Pages.

## UX

- Trong `src/routes/index.tsx`, kế bên các nút "Đọc dọc / Dùng văn bản mẫu / Xoá", thêm nút **"Tải file lên"** mở `<input type="file">` ẩn với `accept=".txt,.md,.docx,.pdf,.epub"`.
- Khi chọn file:
  - Hiển thị trạng thái "Đang đọc file…" (disable nút, spinner text).
  - Parse thành plain text, đưa vào textarea (append thêm dấu `\n\n` nếu textarea đã có nội dung; nếu trống thì thay hẳn).
  - Nếu file có metadata tiêu đề (epub/docx), tự điền vào ô Tiêu đề khi ô đó đang trống.
  - Với sách nhiều chương, ghép các chương lại và chèn `# <tên chương>` trước mỗi chương — vừa khớp cú pháp tách chương sẵn có trong `src/lib/split-chapters.ts`, vừa giữ được cấu trúc chương khi xuất EPUB/PDF.
- Báo lỗi rõ ràng khi:
  - File lớn hơn 20 MB → từ chối.
  - PDF không có text layer (PDF scan) → nhắc user rằng cần bản PDF có chữ, không phải ảnh scan.
  - Định dạng không hỗ trợ → thông báo và bỏ qua.

## Kiến trúc code

Tạo `src/lib/import-file.ts` với 1 hàm public:

```ts
importFile(file: File): Promise<{ text: string; title?: string }>
```

Dispatch theo `file.name` extension (không tin `file.type`):

- `.txt` / `.md` → `await file.text()`, trả nguyên xi.
- `.docx` → dùng `mammoth` (`extractRawText({ arrayBuffer })`), trả `result.value`.
- `.pdf` → dùng `pdfjs-dist`:
  - Set `GlobalWorkerOptions.workerSrc` bằng `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()` để Vite bundle worker đúng cách (không fetch từ CDN → vẫn deploy tĩnh được).
  - Duyệt từng trang, gọi `getTextContent()`, ghép `item.str` với heuristic xuống dòng khi `hasEOL` hoặc khoảng cách y đổi.
  - Nếu tổng text rỗng → ném lỗi "PDF không có văn bản (có thể là ảnh scan)".
- `.epub` → dùng `jszip` (đã có) tự parse:
  - Đọc `META-INF/container.xml` → tìm `.opf`.
  - Parse `.opf` bằng `DOMParser` để lấy `<metadata><dc:title>` và thứ tự spine (`itemref` → `manifest item href`).
  - Với mỗi XHTML chương: parse bằng `DOMParser`, dùng `textContent` của `<body>`, tiêu đề chương lấy từ `<h1>/<h2>` đầu tiên (fallback: tên file).
  - Ghép lại thành `# <chương>\n\n<nội dung>\n\n# <chương kế>\n\n…`.

## Dependencies

Cài thêm: `mammoth`, `pdfjs-dist`. `jszip` đã có sẵn cho EPUB export nên tái dùng.

## Việc cần làm

1. `bun add mammoth pdfjs-dist`.
2. Tạo `src/lib/import-file.ts` với 4 hàm private `parseTxt / parseDocx / parsePdf / parseEpub` + dispatcher `importFile`.
3. Cập nhật `src/routes/index.tsx`:
   - State `importing: boolean`, ref `<input type="file">` ẩn.
   - Nút "Tải file lên" ở hàng nút hiện có; disable trong khi importing.
   - Handler `onChange`: gọi `importFile`, gộp vào state `text` + `title` (nếu trống), reset input value để có thể chọn lại cùng file.
   - Try/catch → `alert(err.message)` tiếng Việt.
4. Không đụng vào logic reader, export PDF, export EPUB, style.

## Kiểm chứng

- Typecheck sạch (`tsgo`).
- Trong preview: thử lần lượt 1 file `.txt`, `.md`, `.docx`, `.epub`, `.pdf` có text → nội dung xuất hiện trong textarea, bấm "Đọc dọc" hiển thị tategaki, EPUB xuất ra vẫn giữ chương.
- Thử `.pdf` scan (không text) → thấy alert giải thích rõ.

## Ngoài phạm vi

- Không OCR PDF ảnh (nặng, không phù hợp static site).
- Không hỗ trợ `.mobi` / `.azw3` (không có parser thuần JS đáng tin cậy).
- Không stream/chunk file khổng lồ (>20 MB) — với sách text thông thường, giới hạn này thoải mái.
