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
  - gopinyin.io.vn
  - www.gopinyin.io.vn

## 3) DNS
Thêm record DNS theo hướng dẫn của Vercel:
- A / CNAME hoặc apex domain tùy từng nhà cung cấp

## 4) API cùng dự án

Các entry `api/ai.js`, `api/pron.js`, `api/status.js` dùng chung handler Node tại `server/pro-server.js`. Không mở cổng HTTP khi handler được import; chạy standalone vẫn dùng `node server/pro-server.js`.

Không dùng rewrite bắt mọi đường dẫn về HTML: điều hướng ứng dụng dùng hash `#/…`, còn `/api/*` phải được Vercel chuyển đến function. File riêng không có trong output trả 404.

Backend dùng `SUPABASE_*`, hoặc hai biến `GOPINYIN_SUPABASE_*` đã đặt cho web làm fallback xác minh tài khoản. Khóa provider chỉ đặt trong biến môi trường Vercel, không trong client hoặc Git.

- AI dùng key chung: đặt `AI_KEY_GEMINI`/`AI_KEY_OPENROUTER` và `GOPINYIN_AI_PROXY_URL=/api/ai`, rồi redeploy. Chưa có key chung thì vẫn dùng luồng key cá nhân hiện tại.
- Phát âm chuyên dụng: đặt `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, rồi redeploy. Endpoint mặc định đã là `/api/pron`. Chưa có key thì trả 501 cho tài khoản hợp lệ và app dùng đánh giá sơ bộ.
- `GET /api/status` chỉ công khai các cờ cấu hình, không kiểm tra quota hay chất lượng provider. Key được đặt không đồng nghĩa dịch vụ đã gọi thành công.
- Rate limiter vẫn thuộc bộ nhớ mỗi function instance; không xem đây là hạn mức toàn hệ thống khi scale nhiều instance.

Hướng dẫn runtime đối chiếu: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js).

## 5) Lưu ý
Frontend dùng HTML/CSS/JavaScript thuần. Build ghép HTML partials và đóng gói JS/CSS bằng esbuild.
Tài nguyên tĩnh lấy từ `dist/`; API được đóng gói riêng dưới dạng function. Không đưa `.env`, mã server hoặc dữ liệu thanh toán vào thư mục tĩnh.

Kiểm tra sau triển khai: `npm run check:production -- --browser --expect-local` sau khi build đúng commit. Lệnh chỉ đọc trang/cấu hình trạng thái và thử POST không có token để xác nhận bị chặn; không tạo tài khoản, không gọi provider hay ghi dữ liệu học. Artifact nằm trong `.cache/production/acceptance.json`.
