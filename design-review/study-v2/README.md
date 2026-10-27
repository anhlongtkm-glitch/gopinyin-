# Bản duyệt bố cục luyện tập v2

Đây là bản mẫu riêng theo yêu cầu duyệt ảnh trước khi sửa giao diện chính. Không ghép vào build, không thay đổi tệp trong `src/`, API, tài khoản hoặc tiến độ. Thao tác trong bản mẫu dùng câu ví dụ cục bộ; micro và nghe mẫu chỉ minh họa trạng thái.

## Hướng trình bày

- Hai chế độ dùng cùng một khung, cùng vị trí câu, nghĩa, phản hồi và hàng hành động. Phần khác nhau là ô gõ hoặc cụm micro.
- Thứ tự chung: **chữ Hán → Pinyin dưới từng chữ → nghĩa tiếng Việt**. Pinyin chỉ hiển thị một lần, không lặp thêm dòng phiên âm cả câu.
- Desktop: Hán tự 40px, Pinyin 17px, tiếng Việt 18px. Mobile: 30px / 14px / 16px. Inter cho tiếng Việt/Pinyin, Noto Sans SC cho Hán tự.
- Màn gõ vẫn mặc định ẩn Pinyin; ảnh duyệt bật gợi ý để đối chiếu căn chỉnh. Tắt/bật giữ nguyên khoảng chữ để tránh nhảy bố cục.
- Tùy chọn nằm đầu màn. Bảng có ba tab Hiển thị / Âm thanh / Bài học; đóng bảng giữ nội dung đang nhập.
- Thống kê gọn trên một hàng, không có ba thẻ lớn đẩy câu xuống. Nút Câu tiếp ở một vị trí chung, luôn nhìn thấy ở các kích thước duyệt.

## Xem ảnh và bản tương tác

- [Bảng ảnh điện thoại](review.html), [bảng ảnh desktop](review.html?desktop=1).
- [Luyện gõ desktop](desktop-typing.png), [luyện phát âm desktop](desktop-pron.png).
- [Luyện gõ mobile](mobile-typing.png), [luyện phát âm mobile](mobile-pron.png).
- [Tùy chọn mobile — Hiển thị](mobile-options-display.png), [Âm thanh](mobile-options-audio.png), [Bài học](mobile-options-lesson.png).
- Mở `index.html` trực tiếp hoặc chạy `node design-review/study-v2/serve.cjs`, rồi vào `http://localhost:8093/review.html`.

## Đối chiếu bản mẫu

Đã kiểm tra hai chế độ ở 1440×900, 1280×720, 390×844 và 360×740. Không cuộn trang ở các kích thước/câu mẫu này; khối câu của hai chế độ có cùng chiều cao. Cả 24 tổ hợp bảng tùy chọn đều vừa màn hình, không cuộn nội dung. Số đo nằm ở `preview-metrics.json`.

Bản duyệt chưa thay thế nghiệm thu câu dài, kết quả phát âm thật, bàn phím ảo và zoom khi tích hợp. Khi được duyệt, cần giữ hành vi học/IME/phím tắt hiện có và cho phép nội dung dài hoặc vùng nhìn bị thu nhỏ vẫn tiếp cận được.
