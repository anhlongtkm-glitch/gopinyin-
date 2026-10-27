# Dọn mã và cấu trúc dự án — 27/10/2026

## Mã nguồn

- Chuyển bộ chọn HSK/chủ đề và Học tiếp từ tên tạm `app/approved-experience.js` sang `features/practice/catalog-controller.js`.
- Giữ cache nhóm bài theo cấp và nguồn dữ liệu; không tạo lại hàng nghìn đối tượng câu mỗi lần tìm kiếm hoặc đổi màn. Mỗi thẻ chỉ đọc tiến độ một lần khi dựng.
- Chỉ dựng lại danh mục/Học tiếp khi thư viện đang hiện. Kiểm tra hồi quy giữ nguyên DOM danh mục khi vào bài học; không thay ID bộ, ID câu, thứ tự câu hoặc khóa tiến độ.
- Chuyển menu Công cụ về điều hướng ứng dụng. Đặt nhóm Game sắp ra mắt vào HTML thay vì chuyển các thẻ bằng JavaScript lúc khởi động.
- Gom ba bước khởi tạo kho bài thành một hàm sở hữu state. Lịch sử gõ tách state và gắn sự kiện bằng tên rõ nghĩa; bỏ hậu tố `2/3` và wrapper không làm thêm việc.
- Tách bộ tải YouTube API ra `features/shadowing/youtube-api.js`; controller giữ phiên player và micro. Dùng lại `shared/utils.js` cho escape HTML thay vì sao chép hàm.
- Loại các import không dùng. Đối chiếu đồ thị bundle: ba file JavaScript không thuộc main bundle là `public-config`, `theme-preload`, `storage-import`; chúng được build/inline riêng nên vẫn cần giữ.

## File cũ và tài liệu

- Đưa 82 file, khoảng 21,2 MiB ra khỏi cây mã nguồn đang quản lý: ảnh kiểm thử sinh tự động, sáu script chụp/probe thủ công dùng giao diện cũ, prototype Shadowing đã thay bằng ứng dụng thật, bản triển khai Jade nháp đã bị thay thế và báo cáo kiểm thử sinh tự động.
- Các kiểm thử nghiệp vụ vẫn giữ. Ảnh từ regression nằm dưới `.cache/`; thêm ignore cho ảnh PNG phát sinh trực tiếp trong `tests/`.
- Giữ `design-review/jade-typing` làm chuẩn đã duyệt, bộ ảnh triển khai hiện hành, kế hoạch người dùng đang đọc và toàn bộ 44 tài nguyên gấu dùng trong allowlist build.
- Sửa liên kết/tên module trong tài liệu để trỏ đến mã và preview hiện hành; README/Architecture dùng đúng Node 24.x và 27 suite.

Bản cũ được lưu có thể khôi phục tại `.cache/cleanup-archive-20261027/`, kèm `manifest.json` ghi đường dẫn, kích thước và SHA-256. Không đưa kho lưu này vào commit. Bộ duyệt tự động từ chối xóa vĩnh viễn hàng loạt vì có bản mẫu chưa commit; phương án lưu trữ này giữ khả năng phục hồi.

## Kiểm chứng

Kết quả sau dọn mã: **27 suite / 398 kiểm tra qua**, build qua; đồ thị bundle không còn named import không dùng. Báo cáo được sinh dưới `.cache/test-run/`, không commit file sinh tự động.

- `npm.cmd test`: toàn bộ kiểm thử nghiệp vụ, tài khoản, điều hướng, Gõ/Nói, Game, Shadowing và bố cục.
- `npm.cmd run test:build`: HTML ghép, ID duy nhất, tài nguyên công khai, IIFE và kiểm tra `file://`.
- Thay đổi chỉ tổ chức/giảm công việc thừa; không đổi API, schema tài khoản hoặc cách chấm học.
