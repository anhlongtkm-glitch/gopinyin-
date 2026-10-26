# Email tài khoản GoPinyin

Các mẫu HTML tiếng Việt này được dùng trong Supabase Dashboard → Authentication → Emails → Templates của project `sjhvmrvawgvqnzyxjkpt`.

Chỉnh nội dung hoặc bố cục chung tại `scripts/build-email-templates.mjs`, rồi chạy:

```sh
node scripts/build-email-templates.mjs
```

`subjects.json` ánh xạ file HTML với trang template trên Dashboard và tiêu đề email. Dán đúng Subject và toàn bộ nội dung HTML vào mục Source, lưu rồi mở lại để xác nhận. Chạy generator hoặc deploy web không tự cập nhật các mẫu trên Supabase.

Mẫu có nền sáng, logo PNG từ domain công khai, bảng bố cục tối đa 560px và CSS inline cho trình đọc email. Màu nút `#0a7868` bảo đảm chữ trắng dễ đọc; nút cao ít nhất 44px. Font hệ thống, không tải font hoặc JavaScript bên ngoài.

- Giữ nguyên `{{ .ConfirmationURL }}` ở nút và link dự phòng. Đây là link xác minh/khôi phục do Supabase cấp, có thông tin luồng và redirect; không thay bằng Site URL.
- `reauthentication.html` dùng `{{ .Token }}` để hiển thị mã OTP, không dùng nút xác minh.
- Không chèn metadata do người dùng nhập, mật khẩu hoặc token thật vào file nguồn.
- Giữ footer là thông báo email tự động; chưa có hộp thư hỗ trợ được xác nhận nên không thêm địa chỉ liên hệ giả định.
- Thiết kế và các biến của cả sáu mẫu đã được kiểm tra trên viewport 390px và 1440px. Việc render thực tế có thể khác nhẹ giữa Gmail, Outlook và các ứng dụng email.

Nguồn tham khảo: [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).
