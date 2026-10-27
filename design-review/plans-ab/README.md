# GoPinyin — ảnh duyệt Plan A / B

Mở **http://localhost:8097/** để xem hai bảng tổng hợp, 18 ảnh chi tiết và bản mẫu có thể bấm chuyển màn. Nếu cần khởi động lại: `node design-review/plans-ab/serve.cjs`.

Hai plan đều dùng bố cục Phiêu Lưu, màu ngà–xanh rừng–đồng nhạt của Jade, gấu thương hiệu hiện có và HSK 1 làm bộ thí điểm. HSK tự chọn và Game riêng đều hiện trong điều hướng.

- **Plan A:** HSK và các phòng luyện độc lập, chọn kỹ năng trực tiếp. [Bảng ảnh A](a-board.png).
- **Plan B:** hành trình sáu trạm, mỗi trạm nối các phiên Nghe/Thanh điệu, Đọc/Gõ và Shadowing. [Bảng ảnh B](b-board.png).

Mỗi plan có ảnh desktop của Tổng quan/Hành trình, HSK, Thanh điệu, Shadowing, Bài khóa, Game và Gấu; thêm hai ảnh điện thoại cho Tổng quan và Gấu. Mở từng ảnh qua trang so sánh để đọc ở độ phân giải đầy đủ.

Đây là prototype riêng phục vụ nhận xét, chưa phải tính năng được tích hợp. Số liệu, điểm, nhiệm vụ, huy hiệu và cấp gấu là dữ liệu mẫu. Không gọi API, xin quyền micro hoặc lưu dữ liệu tài khoản. Hình phụ kiện theo level chưa được sản xuất; màn gấu thể hiện mốc mở và loại phụ kiện dự kiến.

Chạy `.cache/capture-plans-ab.cjs` để tái tạo ảnh bằng Chrome. `verification.json` ghi lại kiểm tra ảnh, lỗi JavaScript, chiều rộng desktop/mobile và đối chiếu hash các tệp ứng dụng. Không sửa `src/`, API, server, dữ liệu hoặc build của web chính trong lần dựng ảnh này.
