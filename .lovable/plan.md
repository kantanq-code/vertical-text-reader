
## Mục tiêu
Webapp **tĩnh** (deploy được lên GitHub Pages): dán văn bản tiếng Nhật → hiển thị theo chiều dọc (tategaki) như báo/sách Nhật, có thể xuất PDF hoặc EPUB. Không backend, không database, không tài khoản.

## Giao diện (trang `/`)
Viết lại `src/routes/index.tsx` thành trang chính gồm 2 chế độ:

1. **Editor**
   - `<textarea>` lớn để dán văn bản (đoạn, bài, hoặc cả cuốn sách).
   - Ô **Tiêu đề**, **Tác giả** (tuỳ chọn, dùng cho PDF/EPUB).
   - Tuỳ chọn: cỡ chữ (nhỏ/vừa/lớn), font (Noto Serif JP / Noto Sans JP), nền (trắng / kem giấy báo / tối), khoảng cách dòng.
   - Nút **"Đọc dọc"** → chuyển sang Reader.

2. **Reader (tategaki)**
   - CSS `writing-mode: vertical-rl; text-orientation: mixed;` — đọc phải→trái, trên→dưới, dấu câu Nhật tự nhiên.
   - Cuộn ngang mượt; scroll-snap theo cột trên mobile.
   - Thanh công cụ nổi: quay lại editor, đổi cỡ chữ nhanh, **Xuất PDF**, **Xuất EPUB**.

## Xuất file (100% client-side)
- **PDF**: `jspdf` + `html2canvas` chụp nội dung reader thành nhiều trang A4 dọc, giữ nguyên tategaki. Tên file: `<tiêu đề>.pdf`.
- **EPUB**: `jszip` tự tạo cấu trúc EPUB 3 tối thiểu (mimetype, container.xml, content.opf, nav.xhtml, style.css, chapter.xhtml) với `writing-mode: vertical-rl` + `-epub-writing-mode: vertical-rl` để Apple Books / Thorium / KOReader render dọc.
- Tách chương tự động: dòng bắt đầu bằng `# ` hoặc nhiều dòng trống liên tiếp → chương mới; nếu không có → 1 chương.

## Static build cho GitHub Pages
- Bật prerender/SSG trong `vite.config.ts` để build ra HTML tĩnh trong `dist/` (không cần server Node).
- Thêm file `public/.nojekyll` để GitHub Pages không bỏ qua thư mục có dấu `_`.
- Thêm `public/404.html` = copy `index.html` để SPA fallback hoạt động khi refresh sâu.
- README ngắn: hướng dẫn build (`bun run build`) và deploy nhánh `gh-pages` (hoặc GitHub Actions).
- Nếu host tại subpath (`username.github.io/<repo>/`), người dùng cần chỉnh `base` trong `vite.config.ts` — tôi sẽ để mặc định `/` và ghi chú cách đổi trong README.

## Chi tiết kỹ thuật
- Stack hiện tại (TanStack Start + React 19 + Tailwind v4), chỉ chỉnh frontend.
- Cài thêm: `jspdf`, `html2canvas`, `jszip`.
- Nạp font Noto Serif JP + Noto Sans JP qua `<link>` trong `head()` của `src/routes/__root.tsx`.
- Cập nhật metadata `head()`: title "Tategaki – Đọc văn bản Nhật theo chiều dọc", description, og/twitter tags.
- File mới:
  - `src/routes/index.tsx` (viết lại)
  - `src/components/tategaki-reader.tsx`
  - `src/components/tategaki-toolbar.tsx`
  - `src/lib/export-pdf.ts`
  - `src/lib/export-epub.ts`
  - `src/lib/split-chapters.ts`
  - `public/.nojekyll`, `public/404.html`
- Lưu văn bản + tuỳ chọn gần nhất vào `localStorage` (đọc trong `useEffect` để tránh hydration mismatch).

## Ngoài phạm vi
- Không furigana (theo yêu cầu).
- Không OCR ảnh báo giấy — chỉ xử lý văn bản dán vào.
- Không backend, không auth, không đồng bộ đa thiết bị.
