# Game học từ vựng rơi — 01/11/2026

Bản hiện tại theo yêu cầu làm lại game đơn giản: **chọn level → gõ từ rơi → thỉnh thoảng gõ một câu ngắn áp dụng → sang level tiếp**.

## Giao diện

- Màn đầu chỉ có tên level, tiến độ, một hướng dẫn ngắn, nút **Bắt đầu/Tiếp tục level** và **Chọn level**.
- Danh sách level mở riêng khi cần, không đặt 42 chủ đề và nhiều khung cuộn ngay trên màn đầu.
- Đã bỏ hai chế độ “Luyện chủ đề/Thử thách 90 giây”, checkbox Pinyin trước khi chơi và khối luật dài được đánh dấu trong ảnh.
- Màn chơi chỉ giữ tiến độ từ, điểm, tạm dừng, Pinyin, bàn phím và cài đặt âm thanh/toàn màn hình. Bỏ boss ghép câu riêng, nhiệm vụ, Tập trung, combo trên giao diện và lá chắn.
- Pinyin mặc định hiện để học; có thể ẩn ngay khi đang chơi. Không có giới hạn 90 giây cắt ngang level.

## Từ không lặp trong level

- Mỗi level có một danh sách duy nhất, khử trùng theo chữ Hán trước khi lên lịch.
- Mỗi từ thường được phát đúng một lần trong lượt level; hết danh sách không quay vòng lại.
- Câu thưởng có lịch riêng, không lấy mất vị trí của từ thường trong danh sách.
- Từ đã gõ xong hoặc đã đi hết màn được lưu là đã đi qua; khi bắt đầu tiếp, không phát lại các từ này. Từ đang gõ được giữ nguyên khi tạm dừng/rời game rồi tiếp tục trong cùng phiên.
- Bỏ lỡ không trừ mạng hoặc kết thúc level sớm. Cuối level có phần gập mở để xem chữ Hán, Pinyin và nghĩa của các từ chưa gõ xong.
- Sau khi toàn bộ từ đã đi qua, mở level tiếp. Tiến độ đi qua và số từ gõ đúng được lưu riêng, không gọi từ bỏ lỡ là đã gõ đúng.
- Giữ dữ liệu học cũ: đọc cả các bản ghi chủ đề cũ trong cùng level, hợp nhất từ đã học, không phụ thuộc cờ boss cũ.

## Lộ trình

| Level | Nhóm từ | Số từ khác nhau |
|---|---|---|
| 1 | Gia đình | 57 |
| 2 | Đồ uống | 55 |
| 3 | Ăn uống | 56 |
| 4 | Trường học | 55 |
| 5 | Thời gian | 58 |
| 6 | Động vật | 59 |
| 7 | Thiên nhiên | 59 |
| 8 | Thời tiết | 56 |
| 9 | Thể thao | 58 |
| 10 | Cơ thể | 57 |
| 11 | Sức khỏe | 60 |
| 12 | Mua sắm | 58 |
| 13 | Du lịch | 60 |
| 14 | Công việc | 58 |

Các từ trong câu áp dụng được phép dùng lại những từ đã học; quy tắc không lặp áp dụng cho các mục tiêu từ đơn trong level. Nội dung các level có thể dùng chung từ quen, nhưng trong một level không có hai mục từ giống nhau.

## Câu ngắn và hiệu ứng bắn

- Sau khoảng 10 vị trí từ có một cơ hội rơi câu ngắn. Chỉ chọn câu giao tiếp có toàn bộ từ đã được gõ hoàn tất; thiếu từ thì bỏ qua. Không lặp lại cùng một câu trong một lượt level.
- Nhịp xuất hiện chữ được tăng lên: khoảng cách từ thường giảm từ 6–6,5 giây xuống 4,5–3,5 giây theo chặng; sau câu thưởng chờ 3 giây. Tốc độ rơi và giới hạn tối đa hai mục tiêu đang hoạt động được giữ nguyên.
- Câu thưởng có viền vàng, thêm 400 điểm ngoài điểm gõ. Không tạo một màn chơi hoặc cơ chế chấm riêng.
- Tàu giật lùi ngược hướng đang bắn mỗi khi gõ đúng, rồi hồi vị trí theo thời gian. Gõ nhanh liên tục vẫn giới hạn độ giật, không làm tàu trôi khỏi sân.
- Khi bắt đầu gõ một mục tiêu, tia laser bám theo mục tiêu đó và kết thúc ở mép thẻ. Gõ xong, cả thẻ chữ bay lên và mờ dần trong khoảng 2 giây, giữ đủ chữ Hán, nghĩa tiếng Việt và Pinyin. Có tiếng bắn theo từng ký tự và tiếng nổ nhẹ khi hạ mục tiêu.
- Điểm xuất phát của đạn dùng cùng vị trí nòng súng sau khi xoay và giật. Giữ laser nhiều lớp, chớp nòng, vòng va chạm, mảnh sáng và âm bắn/ăn thưởng.
- Chế độ giảm chuyển động tắt giật tàu và hạn chế hiệu ứng bay. Không rung toàn màn hình.

## Mã nguồn và kiểm chứng

- `panda-campaign.js`: gộp bộ từ duy nhất theo level, tiến độ và tương thích bản ghi học cũ.
- `panda-model.js`: lịch phát hữu hạn, câu áp dụng riêng, hoàn thành level và không lặp từ khi chơi tiếp.
- `panda-runtime.js`, `view.html`, `panda.css`: luồng màn hình đơn giản, mobile, pause/resume, cài đặt.
- `panda-renderer.js`: giật tàu, hồi vị trí và đồng bộ nòng súng/đạn.
- Kiểm thử mô phỏng chơi hết cả 14 level, kiểm tra từng từ chỉ xuất hiện một lần, câu dùng từ đã học, tiến độ cũ, lượt bỏ lỡ và mở khóa.
- Chrome kiểm tra nút bắt đầu trên màn hình nhỏ, bàn phím cảm ứng, fullscreen, giật tàu thật qua vị trí ảnh, âm thanh/tắt tiếng, điều hướng và khôi phục sau tải lại.
- Ảnh kiểm tra: `.cache/panda-simple/`; log: `.cache/test-run/`.
- Chạy `npm.cmd run test:game` và build bằng `node scripts/build.mjs`. Bản sửa nằm trong workspace local; chưa triển khai lên môi trường ngoài.
