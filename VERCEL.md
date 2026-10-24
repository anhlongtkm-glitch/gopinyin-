# Deploy lên Vercel

## 1) Upload project
- Push project lên GitHub.
- Truy cập Vercel Dashboard.
- Import repository.
- Chọn framework: "Other" / Static site.

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
Dự án này là static frontend, nên không cần build command phức tạp.
Vercel sẽ phục vụ trực tiếp file HTML/CSS/JS từ root folder.
