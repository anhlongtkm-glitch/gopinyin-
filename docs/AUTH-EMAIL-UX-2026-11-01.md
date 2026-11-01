# Cập nhật đăng nhập và phản hồi email — 01/11/2026

## Hành vi

- Đăng ký cần xác minh: hiển thị màn hướng dẫn kiểm tra email, địa chỉ nhận và mục Thư rác; không dùng thông báo lỗi cho thao tác thành công.
- Quay lại từ email: xác thực kết quả xử lý liên kết bằng SDK và kiểm tra người dùng trước khi thông báo xác minh thành công. Có nút bắt đầu học; thông báo không tự biến mất.
- Khôi phục mật khẩu: thông báo đã yêu cầu gửi thư; liên kết hợp lệ mở form mật khẩu mới với ô nhập lại. Sau khi lưu, hiện xác nhận thành công và nút tiếp tục học.
- Liên kết hết hạn, sai hoặc thiếu thông tin PKCE trên trình duyệt: hiện giải thích và hướng dẫn tiếp tục; luồng khôi phục cho phép yêu cầu thư mới. Phiên đăng nhập có sẵn không được dùng để coi liên kết lỗi là hợp lệ.
- Xử lý liên kết sau khi đã đăng xuất cục bộ; dọn tham số callback để tải lại trang không lặp màn thông báo.
- Thiết kế lại form theo tông xanh hiện có, giữ mascot, hỗ trợ sáng/tối và mobile. Thêm hiện/ẩn mật khẩu, kiểm tra trường bắt buộc và email, phản hồi đang xử lý, focus vào điều khiển đang hiển thị.

## Kiểm chứng

- `node tests/run.cjs accounts.cjs auth-navigation.cjs ui-experience.cjs`: **33 kiểm tra đạt, 0 suite lỗi**.
- `node tests/build.cjs`: đạt kiểm tra HTML, ID duy nhất, đóng gói và mở bằng `file://`.
- `node tests/run.cjs`: **464 kiểm tra đạt; 40/42 suite đạt**. Hai suite còn lỗi:
  - `improvements.cjs`: focus sau Escape không trở về `aiStartBtn`.
  - `verify_pron_studied.js`: câu gõ đúng chưa chuyển sang câu tiếp theo theo kỳ vọng của test.
- Đã dựng bản riêng dùng mã auth và hộp thoại tại `HEAD` trước thay đổi, tái hiện cùng hai lỗi trên. Không sửa các luồng học này trong hạng mục xác thực.
- Test email dùng SDK Supabase thật với dịch vụ giả lập local, bao gồm đăng ký chưa xác minh, trao đổi mã PKCE, đăng xuất trước callback, đổi mật khẩu, liên kết lỗi khi đã có phiên, dọn URL và tải lại trang.

Ảnh kiểm tra sáng/tối, desktop/mobile: `.cache/accounts/auth-*.png`. Kết quả hồi quy: `.cache/test-run/results.json`; log đối chiếu: `.cache/baseline-*.log`.

## Giới hạn nghiệm thu

Chưa triển khai lên web đang chạy và chưa gửi thư thật. Cần nghiệm thu email thực tế với cấu hình Supabase của môi trường triển khai, bao gồm URL chuyển hướng cho `?account=verified` và `?account=recovery`. Luồng PKCE yêu cầu mở liên kết trên cùng trình duyệt đã đăng ký/yêu cầu khôi phục; giao diện đã giải thích điều này.

Tài liệu tham chiếu: [Supabase resetPasswordForEmail](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail), [Supabase onAuthStateChange](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
