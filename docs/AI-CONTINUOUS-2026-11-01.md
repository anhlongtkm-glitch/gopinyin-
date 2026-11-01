# Học bằng AI: màn gộp và nhịp 10–5–10 — 01/11/2026

## Hành vi đã chốt

- Một màn Học bằng AI hiển thị đồng thời form tạo bài và các bộ đã lưu, không chia thành hai tab.
- Câu và Từ vựng là hai lựa chọn bật/tắt trực tiếp. Bật cả hai tạo bài xen kẽ hai loại; không chọn loại nào thì yêu cầu chọn trước khi gửi.
- Bắt đầu bằng yêu cầu tạo 10 mục. Cứ học thêm 5 mục, tự yêu cầu thêm 10 mục theo cùng chủ đề, trình độ và loại nội dung. Không hỏi xác nhận từng đợt bổ sung.
- Khi bắt đầu một bài mới, hỏi Lưu và học hoặc Học tạm. Có thể sửa tên bài ngay trong hộp hỏi. Đóng hoặc nhấn Escape hủy tạo bài và không gọi AI.
- Bỏ tùy chọn Lưu bài để học tiếp và Số mục mỗi đợt tạo khỏi form. Chỉ hiện thiết lập nhà cung cấp/API key khi không có dịch vụ AI dùng chung.

## Lưu tiến độ và xử lý tác vụ

- Mốc bổ sung được lưu cùng bài; học tiếp không tạo lặp lại một mốc đã bổ sung thành công.
- Chỉ chạy một yêu cầu bổ sung tại một thời điểm. Nếu học nhanh hơn tốc độ trả kết quả, các mốc đã học được xử lý tuần tự khi yêu cầu trước kết thúc.
- Nội dung bổ sung không dựng lại câu đang làm, không xóa văn bản IME và không thay vị trí con trỏ.
- Đổi màn, đổi tài khoản, chuyển Gõ/Nói hoặc ẩn tab vô hiệu hóa phản hồi cũ. Không dùng kết quả cũ để nối vào bài khác.
- Hết hạn mức hoặc lỗi mạng giữ nguyên phần bài đã có, dừng gọi tự động và hiện Thử lại. Không hỏi lưu lại bài khi bấm Thử lại.
- Yêu cầu AI tạo đủ 10 mục. Nếu phản hồi thiếu mục hợp lệ, chỉ thử bù trong số lượt giới hạn; báo rõ phần đã nhận và cho học phần đó, không tạo dữ liệu giả để đủ số.

## Kiểm thử

Các suite liên quan: `ai-workflow.cjs`, `ai_save_flow.js`, `ai_vocab_mode.js`, `ai_generation_flow.cjs`, `ai_append_wait.cjs`, `ai_edit_flow.cjs`, `ai_recovery.cjs`, `navigation-races.cjs`. Phủ lưu/học tạm/hủy, lựa chọn cả hai loại, mốc 5/10/15, IME, lỗi hạn mức, phản hồi chậm, chỉnh yêu cầu, tải lại và thao tác bàn phím.

Ảnh sáng/tối ở desktop/mobile: `.cache/ai-workflow/`. Kiểm tra màn gộp ở 360/390/768/1024/1440px; hộp sửa yêu cầu còn được kiểm tra tại 320px và chiều cao nhỏ để mô phỏng bàn phím.

Kiểm thử dùng API AI giả lập local. Chưa gọi dịch vụ AI thật và chưa triển khai bản sửa lên web đang chạy.

Kết quả cuối: **73 kiểm tra đạt trong 10 suite liên quan, không có suite lỗi** (tổng hợp các lượt chạy AI, điều hướng, giao diện và tài khoản). Báo cáo: `.cache/ai-workflow/verification.json`. Lượt kiểm tra cuối riêng `ai-workflow.cjs` đạt 5 nhóm kiểm tra, bao gồm Enter để lưu bài. `node tests/build.cjs` đạt kiểm tra HTML, ID, bundle và mở bằng `file://`; `git diff --check` không có lỗi khoảng trắng.
