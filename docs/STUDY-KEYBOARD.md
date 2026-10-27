# Bộ phím học GoPinyin

Đã áp dụng cùng một bộ phím số cho Luyện gõ và Luyện phát âm, thay cho bộ Enter/Space/F1 cũ.

| Phím | Thao tác |
| --- | --- |
| **1** | Ẩn / hiện chữ Hán |
| **2** | Ẩn / hiện Pinyin |
| **3** | Ẩn / hiện nghĩa tiếng Việt |
| **4** | Nghe mẫu câu hiện tại |
| **5** | Câu tiếp sau khi hoàn tất |
| **Enter** | Luyện nói: bắt đầu / dừng ghi âm. Luyện gõ: câu tiếp khi đã đúng |
| **0** | Chuyển giữa Gõ và Nói |
| **?** | Mở hướng dẫn phím tắt |

Các nút hiện nhãn phím tương ứng; số 1–4 nằm cạnh câu, số 5 trên Câu tiếp. Phím hàng số và bàn phím số đều dùng được. Tab / Shift+Tab chọn các điều khiển còn lại; Enter hoặc Space kích hoạt điều khiển đang được chọn. Escape đóng bảng đang mở.

Khi IME đang ghép hoặc chọn chữ, phím số và Enter dành cho IME. Một khoảng bảo vệ ngắn sau khi chốt chữ ngăn cú chọn chữ bị hiểu thành chuyển câu. Phím giữ, Ctrl/Alt/Meta, ô nhập khác, Tùy chọn và các hộp thoại không kích hoạt thao tác của màn học phía sau.

Phím 0 trở lại bài gõ đang mở và giữ nguyên nội dung nhập, câu, tiến độ và hiển thị; lần đầu chuyển sang Nói sẽ dùng cùng bộ đã chọn nếu hỗ trợ. Hai phần vẫn lưu tiến độ học riêng. Rời luyện nói dùng luồng tắt micro hiện có.

Hai màn dùng chung bố cục chữ Hán → Pinyin → nghĩa Việt và hàng hành động. Tùy chọn nằm đầu màn, mở bảng ba tab Hiển thị / Âm thanh / Bài học. Các điều khiển gốc được giữ nguyên ID và dữ liệu; bảng không sao chép trạng thái bài học.

## Kiểm chứng

- `npm.cmd test`: 24 bộ, 365 kiểm tra đạt.
- `npm.cmd run test:build`: đạt, gồm HTML hợp thành, ID duy nhất, danh sách tài nguyên và mở bằng `file://`.
- Kiểm tra riêng bộ phím số: IME, Enter ghi âm thật với thiết bị giả lập, giữ phím, số 5 khi chưa xong, câu cuối, Tab/Enter trong hộp thoại, phím 0 qua lại và giữ nội dung.
- Đối chiếu 56 trường hợp giao diện tại 1440, 1280, 1024, 768, 390, 360px và màn ngang thấp: không tràn ngang; cả 42 bảng tùy chọn vừa chiều cao, không cuộn nội dung. Ở 360×740, Câu tiếp của cả hai màn nằm trên thanh điều hướng dưới. Số đo tại `design-review/study-keyboard/metrics.json`.
- Ảnh giao diện thực: [Luyện gõ desktop](../design-review/study-keyboard/desktop-typing.png), [Luyện nói desktop](../design-review/study-keyboard/desktop-pron.png), [điện thoại](../design-review/study-keyboard/mobile-typing.png), [hướng dẫn phím](../design-review/study-keyboard/mobile-shortcuts.png).

Tài nguyên phím dùng chung: `src/shared/study/shortcuts.js`. Bảng hướng dẫn lấy trực tiếp nhãn từ bộ khai báo này để tránh lệch giữa hướng dẫn và hành vi.
