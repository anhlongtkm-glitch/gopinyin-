# Deploy lên Vercel

## 1) Upload project
- Push project lên GitHub.
- Truy cập Vercel Dashboard.
- Import repository.
- Chọn framework: "Other" / Static site.
- Build command: `npm run build`.
- Output directory: `dist`.
- Giữ bước cài devDependencies vì esbuild dùng khi build; lockfile được lưu trong repository.

## 2) Domain
Sau khi deploy xong, vào:
- Project > Settings > Domains
- Nhập domain muốn dùng, ví dụ:
  - gopinyin.app
  - www.gopinyin.app

## 3) DNS
Thêm record DNS theo hướng dẫn của Vercel:
- A / CNAME hoặc apex domain tùy từng nhà cung cấp

## 4) Alias đã cấu hình sẵn
Trong [vercel.json](vercel.json), các alias đã thêm sẵn:
- gopinyin.app
- www.gopinyin.app

> Bạn vẫn cần nhập domain trong dashboard Vercel để xác nhận và gắn DNS.

## 5) Lưu ý
Frontend dùng HTML/CSS/JavaScript thuần. Build ghép HTML partials và đóng gói JS/CSS bằng esbuild.
Vercel chỉ phục vụ `dist/`; không triển khai toàn bộ thư mục mã nguồn. Không đưa `.env`, mã server hoặc dữ liệu thanh toán vào thư mục này.
