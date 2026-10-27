# Cấu hình Học bằng AI

Người học đăng nhập, chọn câu hoặc từ vựng, nhập chủ đề và tạo bài. Website mặc định gọi `/api/ai`; API key nằm trên máy chủ, người học không phải nhập key. Bộ đã lưu giữ chủ đề, loại nội dung và số lượng để học tiếp và tự tạo thêm khi còn dưới ba mục.

## Hosting cùng dự án

1. Tạo API key cho dự án Gemini có hạn mức miễn phí trong Google AI Studio. Dùng dự án không bật thanh toán nếu yêu cầu không phát sinh phí; khả năng sử dụng và hạn mức do Google quyết định.
2. Đặt `AI_KEY_GEMINI` trong biến môi trường phía máy chủ. Không thêm key vào mã frontend, Git hoặc biến có tiền tố công khai.
3. Đặt `GOPINYIN_AI_PROXY_URL=/api/ai` khi build, hoặc để trống để dùng endpoint mặc định. Giữ cấu hình Supabase hiện có để API xác minh tài khoản.
4. Triển khai lại cả web và các function `api/ai.js`, `api/status.js`. Model mặc định đọc từ `src/data/ai-models.json`; máy chủ có thể dùng `AI_MODEL_GEMINI` để chọn model được cấp miễn phí cho tài khoản đó.

Luồng dùng chung chỉ gọi Gemini, không tự chuyển sang nhà cung cấp hoặc model trả phí. Thông tin model, điều kiện miễn phí và hạn mức cần đối chiếu với [bảng giá Gemini](https://ai.google.dev/gemini-api/docs/pricing) và [hạn mức API](https://ai.google.dev/gemini-api/docs/rate-limits) của tài khoản trước khi triển khai.

## Chạy local

Web local `npm start` phục vụ nội dung tĩnh; API cần một tiến trình riêng. Tạo `.env.local` từ `.env.example`, điền cấu hình Supabase và `AI_KEY_GEMINI`, rồi đổi `GOPINYIN_AI_PROXY_URL` thành `http://localhost:8787/api/ai`.

Chạy trong hai terminal:

```powershell
node --env-file=.env.local server/pro-server.js
```

```powershell
npm start
```

Build tự nạp `.env.local`; API standalone phải nhận `--env-file` như trên. Khi dùng backend khác origin trên hosting, đặt `ALLOWED_ORIGIN` bằng origin của web và trỏ `GOPINYIN_AI_PROXY_URL` đến endpoint HTTPS đó.

## Trạng thái và kiểm tra

- Thiếu key máy chủ: API trả `503` với mã `ai_not_configured`; giao diện giải thích chủ website cần đặt `AI_KEY_GEMINI` và triển khai lại.
- Hết lượt hoặc quá tải: API giữ `429` và `Retry-After`; tạo thêm tự dừng, vẫn học được nội dung hiện có. Nút **Thử lại** tôn trọng thời gian chờ. Lỗi mạng cũng dừng tạo thêm để tránh gọi lặp.
- `GET /api/status` chỉ cho biết đã đặt key hay chưa, không xác nhận quota hoặc một lượt tạo bài thành công. Không gửi key qua endpoint này.
- Chạy `node tests/serverless.cjs` và bộ `ai_recovery.cjs` trong test runner để kiểm tra bằng dữ liệu giả, không gọi Gemini thật.

Hook cũ `window.__gpAiProxy` vẫn được hỗ trợ khi không đặt URL công khai. Các trang nhúng cũ muốn dùng key cá nhân có thể đặt `window.APP_CONFIG.AI_PROXY_URL=false` trước khi khởi tạo ứng dụng; chế độ này giữ giao diện cấu hình key hiện có.
