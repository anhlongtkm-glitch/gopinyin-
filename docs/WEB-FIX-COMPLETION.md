# Trạng thái chốt sửa web — 26/10/2026

Tài liệu này tổng hợp trạng thái mới nhất của lộ trình. Các báo cáo đợt trước giữ nguyên số đo và kết quả tại thời điểm thực hiện.

Đợt đồng bộ giao diện và mascot tiếp theo đã bổ sung 16 tư thế gấu 3D, sáu biểu cảm, điều hướng mobile và các thao tác học thuận tiện; kết quả bản tích hợp là 24 suite, 369 checks đạt và kiểm tra build đạt. Chi tiết, ảnh đối chiếu và phần nghiệm thu thiết bị thật còn lại nằm tại [UI-MASCOT-RESULTS.md](UI-MASCOT-RESULTS.md). Các số liệu 354 checks bên dưới được giữ như kết quả lịch sử của đợt sửa trước.

## Bản sửa cuối trong đợt này

- Thao tác chờ đăng nhập gắn với lần điều hướng đã tạo ra nó. Đăng nhập sau khi Back hoặc chọn màn khác không mở lại game/bài cũ. Đăng nhập và đăng ký có phiên hợp lệ vẫn tiếp tục thao tác đang chờ đúng một lần.
- Khi phiên hết hạn, chỉ thao tác còn hiệu lực được yêu cầu đăng nhập lại; kết quả xác thực cũ không tạo lại hộp đăng nhập cho thao tác đã bỏ. Thao tác hiện tại vẫn tiếp tục được sau bước dọn dữ liệu và chuyển về Dashboard.
- Khôi phục link bài ban đầu chờ tài khoản sẵn sàng nhưng không chiếm lại màn sau lựa chọn mới, kể cả lúc URL chưa đổi vì đang mở hộp đăng nhập. Lỗi kích hoạt tài khoản/đọc session kết thúc trạng thái chờ để xử lý route và cho phép thử đăng nhập lại.
- Nếu bộ câu không còn tồn tại, chỉ lần khôi phục còn hiệu lực được chuyển về thư viện.
- Phục hồi tiến độ cũ/import: giữ thứ tự hợp lệ, loại chỉ số trùng/hỏng, bổ sung câu thiếu và giới hạn con trỏ. Câu mới thêm không bị xem là đã học chỉ vì con trỏ cũ quá lớn.
- Thống kê thiếu/hỏng được đưa về số hữu hạn, không âm; không kế thừa thống kê bộ trước. Danh sách sai/lịch ôn sai kiểu không làm hỏng thao tác mở bài. Bộ mới khôi phục mặc định hiển thị Hán tự.

Không đổi schema, khóa lưu trữ, RLS, chính sách đăng nhập hoặc cách tính lịch ôn. Dữ liệu hợp lệ vẫn dùng được.

## Đối chiếu lộ trình

| Nhóm | Đã thực hiện | Phần nghiệm thu còn lại |
| --- | --- | --- |
| Dashboard và nội dung | Thống kê riêng từng tài khoản, combo cao nhất, tổng 4.969 câu HSK, tài liệu/domain thống nhất | Theo dõi phản hồi sử dụng thực tế |
| AI/phát âm và backend | Nối cấu hình proxy, timeout, retry/backoff, căn chỉnh điểm theo chữ, quota/concurrency, kiểm tra body, API Vercel và trạng thái dịch vụ | Gọi provider thật sau khi có key; kiểm tra micro/âm thanh trên thiết bị thật |
| Hiệu năng và đồng bộ | Minify, asset có hash/cache, trì hoãn vocab pack, danh sách metadata, đối chiếu version trước khi lấy payload, chống ghi chéo tài khoản | Core Web Vitals và tải tài khoản lớn trên thiết bị/mạng thật trước khi đổi cơ chế lưu cache |
| Điều hướng và tương tác | Link bài, Back/Forward, focus/Tab/Escape, khôi phục bài, chặn phản hồi AI/phát âm/xác thực cũ | Kiểm tra zoom, bàn phím ảo và thao tác trên điện thoại thật |
| Luyện tập và lịch ôn | Lưu hoàn thành trước Space, làm lại sạch, ôn tối đa 20 câu, giữ vị trí bài chính, lịch 1/3/ngày nhân đôi và sai sau 10 phút | Thử nhiều ngày với người học để đánh giá hiệu quả |

Phần sửa mã trong phạm vi trên đã có kiểm thử hồi quy. Các mục nghiệm thu thực tế chưa được đánh dấu hoàn tất thay cho bằng chứng còn thiếu. Chuyển cache sang IndexedDB, tách bundle sâu hơn hoặc đổi framework chưa có số đo đủ để đưa vào đợt sửa này.

## Kiểm chứng

- `npm.cmd test`: 23 suite, 354 checks đạt; không có suite thất bại.
- `npm.cmd run test:build`: đạt ghép HTML, ID duy nhất, allowlist tài nguyên, classic IIFE và mở `file://`.
- Hai suite mới: `auth-navigation.cjs` (9 nhóm) và `progress-restore.cjs` (8 nhóm). `navigation-races.cjs` bổ sung hai ca browser về đăng nhập sau Back và tiếp tục game khi không đổi màn.
- Kiểm thử Auth/dữ liệu dùng fixture cục bộ, không ghi dữ liệu tài khoản production, không gọi AI hoặc xin micro thật.
- Sau triển khai, dùng `npm.cmd run check:production -- --browser --expect-local` để đối chiếu HTML/asset với đúng bản build, kiểm tra API, file riêng và sáu màn khách ở 1440px/390px. Artifact nằm tại `.cache/production/acceptance.json`, không commit.

Người dùng đã xác nhận chưa có key dịch vụ. Chưa nghiệm thu tạo câu AI hoặc chấm phát âm chuyên dụng qua provider thật. Khi có key, cấu hình ở backend theo [VERCEL.md](../VERCEL.md), rồi kiểm tra bằng tài khoản thử đã xác minh; không đưa key vào Git hoặc chat.

Chi tiết các đợt: [kết quả đầu](WEB-IMPROVEMENT-RESULTS.md), [hiệu năng/đồng bộ](WEB-PERFORMANCE-PHASE-2.md), [luồng học](LEARNING-FLOW-FIXES.md), [phản hồi bất đồng bộ](ASYNC-FLOW-FIXES.md), [nghiệm thu API production ban đầu](PRODUCTION-ACCEPTANCE.md).
