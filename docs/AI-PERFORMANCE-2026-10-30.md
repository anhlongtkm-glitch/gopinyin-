# Tối ưu thời gian chờ AI — 30/10/2026

## Thay đổi

- Bỏ các lớp xác thực/đồng bộ lặp trong client AI. Khi bắt đầu bài vẫn kiểm tra tài khoản và đồng bộ một lần. Với phiên proxy đang hoạt động, gửi token ngay; server vẫn xác minh token cho từng request. Gọi trực tiếp bằng key cá nhân vẫn kiểm tra tài khoản một lần mỗi request.
- Mọi entrypoint công khai giữ kiểm tra tài khoản; kết quả về sau khi đổi tài khoản, đăng xuất hoặc mất quyền học bị loại.
- Trả đợt có câu hợp lệ đầu tiên, dù ít hơn số lượng yêu cầu, để mở bài ngay. Chỉ thử thêm một lần khi toàn bộ phản hồi không dùng được; lỗi mạng/hạn mức/xác thực không tự gọi lặp.
- Giới hạn danh sách tránh trùng trong prompt còn 80 mục gần nhất. Vẫn dùng toàn bộ tập câu đã gặp để loại trùng tại máy, kể cả mục trùng trong cùng phản hồi.
- Với đợt mặc định 5 mục, tạo tiếp khi còn 3 mục thay vì 2. Vẫn chỉ một request nền, giữ ô nhập/IME, vị trí học và các kiểm tra đổi màn hình. Đợt lớn có mức dự trữ tối đa 6.

## Kiểm chứng

Kiểm thử trình duyệt và server dùng API giả; không gọi model thật hoặc tiêu thụ hạn mức AI.

- Mở bài proxy: chỉ một request `/auth/v1/user` tại bước bắt đầu, thay vì bốn như phép tái hiện trước sửa.
- Gọi AI proxy trong phiên đang học: không thêm request Auth hoặc kéo `learning_records` trước request AI. Đồng bộ tiến độ thông thường vẫn hoạt động độc lập.
- Key cá nhân và helper OpenRouter công khai: một lần kiểm tra tài khoản mỗi request.
- Phản hồi chứa hai mục hợp lệ, một mục trùng và một mục thiếu Pinyin: trả đúng hai mục sau một request; không chờ gọi bù.
- Prompt dài: chỉ gửi lịch sử gần nhất, vẫn loại mục cũ ngoài prompt.
- Phản hồi không dùng được: tối đa hai lượt. Token bị server từ chối vẫn báo lỗi; khách không gửi được request AI; phản hồi đến sau đăng xuất bị loại.
- Tạo tiếp sớm: request bắt đầu tại mục có index 2 trong bộ 5 mục. Học hết ba mục còn lại vẫn dùng request đang chờ, không nhân đôi.
- Kiểm thử lưu bài, tiếp tục bài, hạn mức, mạng, Gõ/Nói, điều hướng và Pinyin đều đạt.

Lượt hồi quy 11 bộ đạt 111 kiểm tra. Sau khi bổ sung ca đăng xuất/khách, bộ `ai_generation_flow.cjs` chạy lại đạt 9/9 (trước đó 8/8); không đổi mã chạy sau lượt hồi quy. Tổng số kiểm tra trong phiên bản các bộ mới nhất là 112.

```powershell
node tests/run.cjs ai_generation_flow.cjs ai_append_wait.cjs ai_recovery.cjs ai_save_flow.js ai_vocab_mode.js navigation-races.cjs service-reliability.cjs account-api.cjs serverless.cjs pinyin-tokenizer.cjs pinyin-alignment.cjs
```

## Giới hạn

Đã loại thời gian chờ thừa trong ứng dụng, chưa đo số giây phản hồi của model trên production. Tốc độ sinh của nhà cung cấp và đường truyền vẫn ảnh hưởng thời gian chờ. Đợt hợp lệ đầu tiên có thể ít mục hơn lựa chọn; ứng dụng tạo thêm khi gần hết. Thay đổi này không thay thế quy trình kiểm chứng ngôn ngữ đã đề xuất trong báo cáo Pinyin.

Tham khảo: [Supabase getUser thực hiện request mạng](https://supabase.com/docs/reference/javascript/auth-getuser), [getSession dùng để lấy token; server vẫn phải xác minh quyền](https://supabase.com/docs/reference/javascript/auth-getsession).
