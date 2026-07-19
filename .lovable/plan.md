## Nguyên nhân

Không phải do văn bản dài. Console báo rõ:

```
Error: Attempting to parse an unsupported color function "oklch"
  at html2canvas parseBackgroundColor
```

Tailwind v4 (dự án đang dùng) sinh mọi biến màu mặc định dưới dạng `oklch(...)`. Thư viện `html2canvas` chỉ hiểu `rgb/hsl/hex`, gặp `oklch` là ném lỗi và huỷ toàn bộ quá trình chụp — nên PDF không xuất được, bất kể văn bản ngắn hay dài. Vùng reader tuy đã set màu hex inline, nhưng các phần tử con vẫn kế thừa/động chạm tới biến `--color-*` (ví dụ `color`, `border`, `background` mặc định từ `styles.css`/preflight), đủ để `html2canvas` gặp `oklch` và fail.

## Cách sửa

Thay `html2canvas` bằng **`html-to-image`** — cùng mục đích (DOM → ảnh trong trình duyệt) nhưng dùng `SVG <foreignObject>` nên hỗ trợ đầy đủ CSS hiện đại: `oklch`, `color-mix`, `lch`, gradient mới… Không cần bỏ Tailwind v4 hay viết lại theme.

### Việc cần làm

1. `bun remove html2canvas` và `bun add html-to-image`.
2. Viết lại `src/lib/export-pdf.ts`:
   - Dùng `toCanvas(element, { pixelRatio: 2, backgroundColor, width: scrollWidth, height: scrollHeight, cacheBust: true })` thay cho `html2canvas(...)`.
   - Phần logic còn lại (cắt canvas thành nhiều trang A4 theo chiều ngang, xếp phải → trái, `jsPDF.addImage`) giữ nguyên.
   - Trước khi chụp: `await document.fonts.ready` để font Noto Serif/Sans JP đã load xong (tránh chụp nhầm font hệ thống).
3. Cập nhật thông báo lỗi trong `src/routes/index.tsx` cho chính xác hơn (không đổ lỗi cho "văn bản dài" nữa; nói chung là "Xuất PDF thất bại, vui lòng thử lại hoặc dùng EPUB").
4. Không đụng tới logic tategaki, EPUB, hay style.

### Kiểm chứng

- Build/typecheck sạch.
- Ở preview: dán văn bản mẫu (đã có nút "Dùng văn bản mẫu") → "Đọc dọc" → "Xuất PDF" → file tải về mở ra thấy chữ dọc, phải sang trái, nhiều trang A4.
- Kiểm tra thêm với bài báo Nhật thật để chắc không còn lỗi `oklch`.

### Ngoài phạm vi

- Không đổi theme sang màu rgb/hex thủ công (giải pháp đó hạn chế và dễ vỡ khi user thêm class Tailwind mới).
- Không thay đổi cách render tategaki hay cấu trúc EPUB.
