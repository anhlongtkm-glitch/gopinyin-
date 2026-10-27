# GoPinyin — ảnh duyệt xanh ngọc bích, ưu tiên Luyện gõ

Mở **http://localhost:8098/** để xem 14 ảnh chi tiết, hai bảng tổng hợp và bản mẫu riêng có thể bấm chuyển màn. Khởi động lại bằng `node design-review/jade-typing/serve.cjs`.

- [Bảng tổng quan và màu](overview-board.png).
- [Bảng danh mục HSK/Chủ đề và màn Gõ/Nói](typing-board.png).

Màu ngọc bích nhận diện `#0BA488` được lấy từ logo gốc. Phối nút xanh đậm `#087D69`, nền be `#F6F1E6`, matcha `#E5ECD5` và nền ngọc bích nhạt `#E0F3EB`. Luyện gõ có mục riêng, CTA Tổng quan riêng và hai tab HSK/Chủ đề. Game và Luyện nói vẫn hiện trên điều hướng chính.

Bộ ảnh gồm Tổng quan, Luyện gõ HSK, Luyện gõ Chủ đề, màn gõ, màn nói, Thanh điệu, Shadowing, Bài khóa, Game, Gấu, ba ảnh điện thoại và bảng Tùy chọn điện thoại. Pinyin được bật trong ảnh để đối chiếu vị trí; khi ghép vào ứng dụng, luyện gõ vẫn mặc định ẩn.

Đây là bản duyệt thiết kế, chưa sửa ứng dụng chính. Dữ liệu và chức năng mới là minh họa; không gọi API, xin quyền micro, cập nhật tài khoản hoặc tiến độ. Các bộ HSK/chủ đề trong ảnh chưa phải nội dung đã được biên soạn và xác nhận đầy đủ.

`verification.json` ghi lại kiểm tra desktop 1440px, điện thoại 390/360px, ảnh lỗi, lỗi JavaScript, chiều rộng, bảng Tùy chọn và đối chiếu hash các tệp ứng dụng. Ảnh được chụp bằng Chrome từ HTML/CSS riêng. Các CSS nền được tái sử dụng từ prototype trước; không nhập các file này vào build của web thật.
