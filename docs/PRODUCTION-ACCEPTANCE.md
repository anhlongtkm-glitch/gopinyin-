# Kiểm chứng production — 26/10/2026

## Bản đã xác minh

- Website: `https://www.gopinyin.io.vn/`.
- Commit triển khai API: `16b1da3` — Deploy authenticated AI and pronunciation handlers as Vercel functions.
- GitHub status Vercel: success. [Deployment](https://vercel.com/long-b4d0/gopinyin-/HXpmiRHMHaBf8AtDrSewkyQVV3qj).
- Kiểm tra trực tiếp lúc 12:11 ngày 26/10/2026, giờ Việt Nam.
- Lệnh: `npm run check:production -- --browser --expect-local`.

## Kết quả thực tế

| Nội dung | Kết quả |
| --- | --- |
| Trang chính | HTTP 200 |
| JS/CSS có hash | HTTP 200, nội dung khớp build local, cache immutable |
| `GET /api/status` | HTTP 200 JSON, `apiVersion: 1` |
| `POST /api/ai`, không có token | HTTP 401 JSON |
| `POST /api/pron`, không có token | HTTP 401 JSON |
| `.env.local`, `server/pro-paid.json`, `server/pro-content.json` | HTTP 404 |
| Dashboard, thư viện, kho phát âm, AI, sảnh game, bảng xếp hạng | Mở được ở viewport 1440px và 390px; không tràn ngang, không có page runtime error |
| Xác minh cấu hình tài khoản backend | `accountConfigured: true` |

Trước sửa, `/api/ai` và `/api/pron` trả HTTP 200 HTML do rewrite SPA. Nay request đến đúng Node function. Ứng dụng dùng hash route nên vẫn điều hướng/khôi phục màn mà không cần rewrite bắt tất cả URL.

## Trạng thái provider

Backend đang chạy, nhưng readiness trả:

```json
{"gemini":false,"openrouter":false,"pronunciation":false}
```

Đây là cờ key có được đặt trong môi trường function hay chưa, không phải kết quả gọi provider. Chưa kiểm chứng tạo nội dung AI/chấm phát âm chuyên dụng thật vì chưa có key backend. Luồng AI bằng key cá nhân và đánh giá sơ bộ phát âm vẫn được giữ.

Để bật tiếp, đặt các key backend tương ứng trong Vercel, cấu hình `GOPINYIN_AI_PROXY_URL=/api/ai` nếu muốn AI dùng key chung, rồi redeploy. Không đưa key vào Git hoặc cấu hình trình duyệt. Xem [hướng dẫn Vercel](../VERCEL.md).

## Phạm vi kiểm thử

- Hồi quy cục bộ: 19 suite, 322 checks đạt; `test:build` đạt.
- Test serverless riêng kiểm tra import không mở cổng, body object/string/buffer đã parse, giới hạn kích thước, xác thực qua biến môi trường của deployment và status không lộ key.
- Acceptance production chỉ đọc trang/trạng thái và gửi POST không token để xác nhận bị chặn. Không tạo tài khoản, đổi mật khẩu, ghi tiến độ hoặc gọi provider.
- Chưa thay thế kiểm thử micro trên thiết bị thật, đăng nhập hợp lệ qua API mới, quota provider, đo Core Web Vitals thực tế hoặc thử lịch ôn nhiều ngày.

Artifact chi tiết cục bộ: `.cache/production/acceptance.json` (không commit).
