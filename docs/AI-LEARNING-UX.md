# Luồng học AI

## Tạo và tìm lại bài

- Người học tự viết chủ đề và yêu cầu trong prompt. Form cho chọn loại nội dung và HSK 1–9/Không giới hạn.
- “Lưu bài để học tiếp” bật mặc định; tên không bắt buộc, mặc định lấy từ chủ đề, tối đa 80 ký tự. Tắt lưu là học tạm trong bộ nhớ.
- Tạo xong vào học trực tiếp. AI tiếp tục sinh khi gần hết; số mục mỗi đợt 3/5/10 nằm trong tùy chọn nâng cao, mặc định 5.
- Bài gần nhất sắp theo `lastStudiedAt`, dùng `createdAt` để phân định; đổi tên, sửa prompt và sinh nền không tự nâng thời điểm học. Tìm kiếm theo tên/chủ đề không ẩn lối tắt bài gần nhất.

## Sửa yêu cầu của bài đã lưu

- Có thể mở từ thẻ bài hoặc màn học; chỉ đổi prompt và trình độ. Giữ ID, tên, loại nội dung và thống kê của bài.
- Giữ các mục đã học, mục hiện tại và các mục có lịch ôn/lỗi; thay phần chờ chưa học. Nếu vừa trả lời đúng nhưng chưa bấm Câu tiếp, không giữ nhầm mục cũ tiếp theo.
- Ánh xạ lại chỉ số theo thứ tự học thực tế; giữ ID nội dung được bảo toàn, tạo ID duy nhất cho mục mới. Trong phiên ôn, bảo toàn toàn bộ hàng ôn và sinh mới khi trở về học chính.
- Mở bảng sửa tạm dừng việc nhận nội dung nền. Lưu thành công đổi phiên bản yêu cầu; phản hồi cũ bị loại. Yêu cầu mới chờ tác vụ cũ giải phóng vị trí, không sinh hai đợt song song.
- Hủy/Escape không thay đổi dữ liệu, trả focus về nút mở. Prompt trống báo ngay trong bảng. Đăng xuất hoặc đổi màn đóng bảng.

## Lưu và đồng bộ

- Dùng dữ liệu bài và tiến độ hiện có, không đổi API hay schema máy chủ.
- `writeRecords` ghi bài và tiến độ vào cùng bản lưu cục bộ; lỗi dung lượng hoàn tác cả hai trong bộ nhớ. Đồng bộ máy chủ tiếp tục dùng outbox và cơ chế xử lý xung đột hiện có.
- Chỉ cập nhật hàng học trong phiên sau khi lưu cục bộ thành công. Sinh thêm thất bại vẫn giữ nội dung đang học và cung cấp Thử lại. Không phục hồi âm thầm hàng chờ theo prompt cũ.
- Hiển thị trạng thái lưu tại máy, chờ đồng bộ, đã đồng bộ hoặc lỗi từ trạng thái tài khoản; không dùng thông báo lưu tại máy để khẳng định đã lưu máy chủ.

## Kiểm thử

`node tests/run.cjs ai_save_flow.js ai_edit_flow.cjs ai_generation_flow.cjs ai_vocab_mode.js ai_recovery.cjs ai_append_wait.cjs navigation-races.cjs account-sync.cjs`

Ca sửa yêu cầu bao gồm thứ tự xáo trộn, giữ chữ đang nhập, phản hồi cũ, hạn mức, lỗi dung lượng, ôn lỗi, mục vừa hoàn thành, bài đã hết, tải lại, đóng khi đăng xuất và focus bàn phím. Ảnh sáng/tối của trang AI và bảng sửa tại 320/390/768/1440px lưu trong `.cache/test-run/`; 720px kiểm tra vùng bố cục tương đương màn 1440px phóng 200%.

Nghiệm thu trên điện thoại thật vẫn cần kiểm tra bàn phím hệ thống, IME và thay đổi chiều cao viewport. Kiểm thử AI dùng phản hồi giả, không tiêu tốn lượt AI thật.
