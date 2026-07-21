# Xuất PDF text thật cho tategaki

Thay cơ chế "chụp ảnh reader từng trang" bằng jsPDF vẽ chữ trực tiếp, có nhúng font Noto Serif JP / Sans JP. Kết quả: file vài trăm KB thay vì vài trăm MB, xuất một cuốn sách chỉ mất vài giây, và text trong PDF **copy/search được**.

## Thay đổi

### 1. Viết lại `src/lib/export-pdf.ts`

Bỏ hoàn toàn `html-to-image`. Thuật toán mới:

- **Trang giấy**: khổ mặc định giống reader (`pageWidthCss × pageHeightCss` từ container), lề `padding` cấu hình được.
- **Nhúng font**: tải file `.ttf` subset của Noto Serif JP / Noto Sans JP một lần (lazy, cache trong module), gọi `pdf.addFileToVFS()` + `pdf.addFont()`.
- **Layout dọc tự tay**:
  - Duyệt từng chương → đoạn → ký tự.
  - Bố trí ký tự theo **cột dọc từ trên xuống**, các cột xếp **từ phải sang trái** (tategaki).
  - Ký tự nghiêng ngang (`0-9`, latin) xoay 90° bằng `pdf.text(..., { angle: -90 })` — nhưng do đã có toggle 全角 nên phần lớn số đã là ký tự dọc tự nhiên.
  - Xử lý xuống dòng ở ranh giới cột: khi hết chiều cao thì sang cột mới bên trái; khi hết trang thì `pdf.addPage()`.
  - Đầu chương: chèn tiêu đề in đậm, cỡ 1.3×, break cột mới.
  - Đoạn: thụt lề đầu đoạn 1em (dịch y xuống), khoảng cách đoạn.
- **Tôn trọng cấu hình reader** hiện có: `font` (serif/sans), `fontSize`, `lineHeight`, `zenkakuNums`, tiêu đề file.
- **Punctuation dọc**: xử lý cơ bản cho `。、「」『』（）` — hầu hết font Noto đã có glyph vertical đúng khi vẽ nguyên chữ; các ký tự cần dịch offset (dấu chấm ở góc trên-phải) áp dụng bảng offset nhỏ.

Chữ ký hàm giữ nguyên để `index.tsx` không cần đổi nhiều:

```ts
exportReaderToPdf(element: HTMLElement, filename: string)
```

Nhưng bên trong sẽ **không dùng `element`** để chụp — thay vào đó đọc dataset trên element (font, size, lineHeight, theme, chapters JSON) mà `index.tsx` set lên trước khi gọi. Hoặc đổi chữ ký sang nhận trực tiếp `{ chapters, title, font, size, lineHeight, theme }` cho sạch.

Chọn phương án đổi chữ ký (sạch hơn), sửa nhẹ chỗ gọi ở `index.tsx`.

### 2. Nhúng font

- Thêm 2 file font subset đặt trong `src/assets/fonts/` (chỉ Kanji + Kana + Latin cơ bản; ~2-4MB mỗi file).
- Nạp qua `fetch(new URL('...', import.meta.url))` + `arrayBufferToBase64`, **lazy** — chỉ tải khi bấm "Xuất PDF".
- Cache Uint8Array trong biến module.

### 3. Cập nhật `src/routes/index.tsx`

- Đổi lời gọi `exportReaderToPdf` sang truyền `{ chapters, title, font, size, lineHeight, theme }` thay vì `readerRef.current`.
- Thêm progress: cập nhật state `pdfProgress` (chương hiện tại / tổng) hiển thị trên nút "Đang xuất…".
- Cho phép huỷ giữa chừng (AbortSignal đơn giản qua ref).

### 4. Gỡ phụ thuộc không dùng

- Gỡ `html-to-image` khỏi `package.json` (chỉ dùng cho PDF cũ).
- `jspdf` giữ nguyên.

## Đánh đổi đã thống nhất

- Bố cục PDF sẽ **không giống hệt reader 100%** — kerning, khoảng punctuation dọc, và line-break sẽ đơn giản hơn (không có justify tinh xảo như CSS). Đổi lại: text search/copy được, file nhẹ, nhanh hơn 10-50×.
- Font tải lần đầu ~5-8MB (cache HTTP sau đó).

## Chi tiết kỹ thuật

**Vòng lặp bố trí (pseudo)**:

```text
x = pageW - marginRight - fontSize   // cột đầu bên phải
y = marginTop
for each char c in stream:
    if c == '\n':                     // hết đoạn
        x -= fontSize * lineHeight
        y = marginTop + indent
        continue
    if y + fontSize > pageH - marginBottom:  // hết cột
        x -= fontSize * lineHeight
        y = marginTop
        if x < marginLeft:            // hết trang
            pdf.addPage(); x = pageW - marginRight - fontSize
    draw c at (x, y) with proper rotation for latin/digits
    y += fontSize * charAdvance(c)
```

**Kiểm chứng sau khi build**:
- Xuất bài báo ngắn (~500 chữ): PDF phải mở được, chữ hiển thị đúng, đọc dọc phải-sang-trái.
- Xuất文本 dài (~50k chữ mô phỏng こころ): thời gian < 10 giây, file < 5MB.
