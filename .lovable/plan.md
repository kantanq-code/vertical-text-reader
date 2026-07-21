## Kế hoạch sửa lỗi GitHub Actions static build

**Mục tiêu:** GitHub Actions build thành công và deploy được web tĩnh lên GitHub Pages, đúng với yêu cầu app chạy client-side/static.

### Nguyên nhân từ log
- Build client đã xong và tạo assets trong `.output/public`.
- Lỗi xảy ra ở nhánh `STATIC_BUILD=1`: cấu hình hiện tại ép `nitro.preset = "static"` + `tanstackStart.prerender`.
- Prerender báo `/` là `404`, sau đó Nitro tiếp tục build SSR và fail với lỗi `rollupOptions.input should not be an html file when building for SSR`.
- Với app này, không cần prerender bằng server runtime; chỉ cần deploy phần client assets + `404.html` fallback là đủ cho GitHub Pages.

### Các thay đổi sẽ làm
1. **Sửa `vite.config.ts`**
   - Bỏ logic `STATIC_BUILD`, `nitro.preset: "static"`, và `tanstackStart.prerender`.
   - Giữ `base = process.env.BASE_URL || "/"` để assets chạy đúng dưới URL dạng `https://<user>.github.io/<repo>/`.
   - Giữ `tanstackStart.server.entry = "server"` cho môi trường Lovable, nhưng không cố biến Nitro thành static trong workflow nữa.

2. **Sửa `.github/workflows/deploy.yml`**
   - Bỏ `STATIC_BUILD: "1"` khỏi bước build.
   - Giữ `BASE_URL: /${{ github.event.repository.name }}/`.
   - Cập nhật bước locate output để ưu tiên `.output/public`, rồi mới fallback các thư mục cũ nếu cần.
   - Giữ bước copy `index.html` thành `404.html` và tạo `.nojekyll`.

3. **Kiểm tra sau khi sửa**
   - Chạy build tương ứng workflow GitHub Pages với `BASE_URL=/vertical-text-reader/`.
   - Xác nhận có `index.html` trong output tĩnh.
   - Xác nhận workflow sẽ upload đúng folder static lên Pages.

### Kết quả mong đợi
- GitHub Actions không còn chạy nhánh prerender/Nitro static gây lỗi.
- GitHub Pages nhận thư mục `.output/public` làm artifact.
- App chạy như một SPA/static site, phù hợp vì mọi chức năng nhập văn bản, upload file, đọc dọc, xuất PDF/EPUB đều chạy trong trình duyệt.