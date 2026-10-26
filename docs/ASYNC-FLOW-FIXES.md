# Chống phản hồi cũ ghi đè thao tác mới — 26/10/2026

## Điều hướng và bộ câu

- Mỗi lần chuyển màn/chọn bộ có một số thứ tự thao tác. Luồng con dùng lại số của thao tác cha, không tự tạo thêm một lần chuyển màn ngoài ý muốn.
- Sau bước xác thực hoặc tải nội dung, chỉ thao tác vẫn còn là thao tác mới nhất được thay đổi màn hình.
- Hai lần chọn bộ nhanh liên tiếp ưu tiên lần chọn sau. Request mở game/phát âm cũ không được kéo người dùng trở lại sau khi họ đã chọn một màn khác.
- Bộ câu mới được lấy xong và kiểm tra trước khi thay state đang học. Vị trí đã lưu và các guard tài khoản vẫn được giữ.

## AI và bản dịch

- Phiên tạo bài có danh tính riêng, gắn với tài khoản và lần thao tác. Các bước tạo nội dung, soát nghĩa, hỏi lưu, đặt tên và mở bài đều kiểm tra phiên còn hiệu lực sau khi await.
- Rời màn kết thúc phiên AI; đóng riêng hộp thoại thuộc phiên đó và mở lại nút tạo bài. Phản hồi/lỗi của request cũ không được đổi trạng thái nút của request mới.
- AI tạo thêm trong nền chỉ nối câu vào đúng phiên đã khởi tạo request. Không nối kết quả cũ vào bộ HSK hoặc bộ AI khác đang mở.
- Bản dịch nền ghi vào đúng mảng câu ban đầu; đổi bộ/tài khoản thì kết quả cũ bị bỏ qua.
- Dừng các vòng thử lại/soát nghĩa tiếp theo khi phiên đã hết hiệu lực. Request provider đã gửi đi chưa được abort ở tầng mạng; không tuyên bố hủy được phần xử lý provider đã nhận.
- Bộ AI được lưu có URL bài học để tải lại đúng bộ như các bộ câu khác.

## Phát âm và quyền micro

- Tải nguồn chỉ cập nhật nội dung khi nguồn, tài khoản và thao tác vẫn hợp lệ. Trong khi tải, không dùng câu của bộ cũ để bắt đầu lượt ghi âm mới.
- Rời màn hoặc đổi nguồn làm mất hiệu lực các lượt xin micro chưa hoàn tất. Nếu stream được cấp sau đó, track của stream ấy được dừng trước khi dùng để ghi âm.
- Đổi câu, bộ lọc, nguồn hoặc làm lại kết thúc lượt đánh giá cũ. Kết quả cũ không được lưu cho câu mới hoặc giải phóng trạng thái busy của lượt đánh giá mới.
- Chờ nhận dạng giọng nói và chờ dịch vụ chấm điểm đều kiểm tra lượt đang hoạt động trước khi dùng kết quả.
- Callback của recognizer cũ không sửa transcript/lỗi của recognizer mới. Thao tác dừng bình thường vẫn nhận kết quả cuối; thao tác hủy thì bỏ qua kết quả đến sau.
- Các lịch phát giọng mẫu kiểm tra lại câu và màn hiện tại trước khi đọc.

## Kiểm chứng

`tests/navigation-races.cjs` cố ý trì hoãn xác thực, AI, bản dịch, tải nguồn và quyền micro để trả kết quả sai thứ tự. `tests/pronunciation-races.cjs` dùng fixture kiểm tra đánh giá/ASR đến muộn và quyền sở hữu trạng thái busy.

Chạy riêng khi cần: `npm test -- navigation-races.cjs pronunciation-races.cjs pronounce.js`. Chạy toàn bộ bằng `npm test`. Các bài kiểm tra mới không gọi provider thật, không xin micro thật và không ghi tiến độ tài khoản production.

Kết quả cục bộ: 21 suite, 335 checks đạt, không có suite thất bại. `test:build` và production build đạt.
