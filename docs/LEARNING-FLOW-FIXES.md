# Sửa luồng hoàn thành câu và ôn tập — 26/10/2026

## Những lỗi đã sửa

- Hoàn thành câu nhưng tải lại/đổi màn trước khi nhấn Space: trước đây chỉ lưu vị trí câu hiện tại, dễ phải làm lại và tính điểm lần nữa. Tiến độ bài chính nay lưu vị trí câu tiếp theo ngay khi chấm đúng; Space vẫn là thao tác chuyển màn câu trong phiên hiện tại.
- Câu cuối được lưu hoàn tất ngay khi chấm đúng; mở lại hiển thị màn hoàn thành, không bắt gõ lại câu cuối.
- Phản hồi đúng và thanh tiến độ trên màn học cập nhật ngay khi hoàn thành câu. Mở bộ khác xóa trạng thái chờ Space của bộ cũ.
- Sự kiện sai đến muộn sau khi câu đã đúng hoặc không còn câu hợp lệ không thay đổi thống kê. Nhiều lỗi gõ trong cùng lượt chỉ cộng một lần sai và một lần thử sai.
- Câu đã đánh dấu yếu chỉ được bỏ đánh dấu sau một lượt hoàn thành không có lỗi. Sửa đúng trong lượt vừa sai vẫn giữ lịch ôn sau 10 phút và giữ câu trong danh sách yếu; một lượt đúng sạch mới tăng khoảng cách ôn. Áp dụng cả lượt học chính, ôn sai và ôn đến hạn.
- Khi xóa đánh dấu sai, đối chiếu ID theo chuỗi để tương thích dữ liệu cũ lưu ID dạng chuỗi/số.
- Nút làm lại bắt đầu lượt mới: xóa cờ lỗi của lượt trước và đặt lại mốc đo thời gian. Một lượt làm lại đúng sạch được ghi nhận bình thường, không mang lỗi cũ sang.
- Audio chờ phát sau khi làm đúng kiểm tra cả bộ câu và việc màn học còn hiển thị, tránh đọc câu cũ sau khi đổi bộ/rời màn.
- Hộp thoại hướng dẫn và lịch sử ghi nhớ/trả focus về nút mở, dùng cùng helper với các modal đã sửa trước đó.

## Tương thích dữ liệu

Không đổi schema, khóa lưu trữ hay định dạng progress. `mainIndex` vẫn là vị trí tiếp tục học, nay được cập nhật ngay khi hoàn thành thay vì đợi Space. Dữ liệu cũ vẫn đọc được; không đoán hay tự tăng vị trí các phiên cũ chưa lưu trạng thái hoàn thành.

Phiên ôn giữ nguyên vị trí bài chính. Không thay đổi điều kiện đăng nhập, mạng, hạn mức AI hoặc cấu hình provider.

## Kiểm chứng

Các ca hồi quy browser mới kiểm tra: reload trước Space, câu cuối, lỗi đến muộn, lỗi lặp trong một lượt, ôn sai rồi sửa đúng rồi làm lại sạch, giữ vị trí bài chính, focus của hướng dẫn/lịch sử. Chạy cùng toàn bộ suite hiện có và kiểm tra build.

Kết quả: 19 suite, 325 checks đạt, không có suite thất bại. Kiểm tra build và production build đạt. Các ca ghi tiến độ chạy trên fixture cục bộ, không sửa dữ liệu tài khoản thật.
