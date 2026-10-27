# GoPinyin — bản duyệt ba phong cách

Mở **http://localhost:8096/** để so sánh ba phương án, xem các ảnh lớn và thử bản mẫu. Nếu server chưa chạy: `node design-review/concepts-v3/serve.cjs`.

- [Kế hoạch chi tiết cả ba phương án](plans.md).
- [01 · Gấu Phiêu Lưu](adventure-board.png).
- [02 · Jade Studio](jade-board.png).
- [03 · Neon Lab](neon-board.png).

Mỗi phương án có bốn ảnh: tổng quan desktop, màn học desktop, tổng quan mobile và màn học mobile. Ba bảng tổng hợp ghép hai ảnh thật của prototype và chú thích Thêm/Gom/Giảm. Ảnh được chụp bằng Chrome từ HTML/CSS riêng, dùng mascot hiện có; không phải ảnh chụp web đã triển khai.

`index.html?plan=adventure|jade|neon&screen=dashboard|study` mở bản tương tác. Có thể thử đi vào bài học, chuyển Gõ/Nói, ẩn hiện Hán/Pinyin/nghĩa và mở Tùy chọn. Micro, nghe mẫu, sóng âm, phản hồi và các chức năng mới chỉ minh họa; không gọi AI, xin quyền micro hay ghi dữ liệu thật.

Đã đối chiếu 42 trường hợp gồm desktop 1440px, mobile 390px, màn nhỏ 360px, màn ngang thấp và các bảng Tùy chọn. Không ghi nhận lỗi JavaScript, ảnh lỗi, tràn ngang hoặc cuộn nội dung trong các bảng được kiểm tra. `verification.json` chứa số đo và kiểm tra hash xác nhận không thay đổi các tệp ứng dụng trong `src/`, `server/`, `api/`, `scripts/`, `tests/`, `assets/` trong quá trình chụp.

Không sửa build, route, dữ liệu hoặc chức năng của ứng dụng chính ở lần đề xuất này. Sau khi chọn phương án mới triển khai từng luồng và kiểm thử nghiệp vụ của web thật.
