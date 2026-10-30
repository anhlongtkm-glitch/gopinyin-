# Panda Du Hành — Định hướng mỹ thuật tối giản

Cập nhật: 30/10/2026. Hướng hiện hành thay thế phong cách nền vũ trụ và khoang đá 3D trước đây. Xem [tình trạng triển khai](PANDA-DU-HANH-IMPLEMENTATION.md) và [ảnh đối chiếu](../design-review/panda-du-hanh/README.md).

## Nhận diện và bố cục

**Panda Du Hành — Gõ chữ, chinh phục thiên hà.** Giữ 14 chủ đề, 700 từ vựng, ván 90 giây và kỷ lục theo luật hiện có.

Nền tối sạch; thẻ từ phẳng, viền mảnh; phi thuyền gấu là điểm nhấn duy nhất có khối. Trang trí chỉ gồm sao nhỏ và đường quỹ đạo rất nhẹ ở rìa. Phần lớn sân là khoảng trống, tối đa hai mục tiêu hoạt động. Không dùng ảnh nền thiên thạch, tinh vân hoặc khung giáp trong game.

| Thành phần | Quy chuẩn |
| --- | --- |
| Nền | `#080F1B` |
| Thẻ và bảng | `#111C2A` |
| Chữ chính | `#F0FBF5` |
| Chữ phụ | `#BECBD9`, Pinyin `#9CB0C6` |
| Năng lượng và mục tiêu khóa | `#69E5C2` |
| Thưởng | `#F4C96B`, có nhãn Thưởng |
| Cảnh báo | Hồng san hô, phản hồi cục bộ |
| Phông | Inter cho UI/Pinyin; Noto Sans SC cho Hán tự |

Thanh trên gồm tên/chủ đề, thời gian, điểm, ba biểu tượng lá chắn và tạm dừng. Một vạch mảnh thể hiện thời gian còn lại. Thanh phụ chỉ chứa chế độ, combo và nhiệm vụ. Thanh dưới gồm Pinyin đang gõ, kỹ năng, gợi ý và bàn phím. Hán tự lớn nhất trong thẻ, rồi nghĩa Việt và cách đọc chuẩn.

Màn chọn chủ đề, chuẩn bị, kết quả, ôn tập, tùy chọn và bàn phím cùng dùng bề mặt phẳng. Chủ đề được phân biệt bằng nhãn và huy hiệu hình học nhẹ. Dùng token màu trong phạm vi game, không thay chủ đề màu của các màn học khác.

## Tàu và ngắm bắn

- Giữ sprite gấu trắng ngà, tai ngọc, ngồi trong buồng lái; nhìn từ phía sau/hơi trên cao. Gấu nhìn về mục tiêu, không nhìn người chơi.
- Tàu nằm giữa đáy, kích thước nhìn thấy khoảng 7–10% chiều cao sân thông thường. Màn mở bàn phím có kích thước tối thiểu để vẫn nhận ra nhân vật.
- Xoay toàn bộ sprite quanh tâm tới mục tiêu đang khóa, thời gian đổi hướng tối đa khoảng 150ms; không giới hạn ở nghiêng vài độ như bản cũ. Không khóa thì trở về hướng thẳng.
- Tọa độ tâm và nòng dùng chung cho DOM và Canvas. Nòng ở 50% chiều rộng, 12% chiều cao sprite; biến đổi bằng góc xoay thực tế. Bỏ animation nhấp nhô cũ gây lệch nòng.
- Phản hồi chấm điểm vẫn tức thì. Viên đạn hình ảnh chờ tàu quay tới hướng bắn rồi xuất phát ở nòng, bay tới mép thẻ trong khoảng 280ms. Vệt ngắn, lõi sáng nhỏ và vòng chạm không che chữ.

## Hiệu ứng

| Sự kiện | Hiển thị |
| --- | --- |
| Gõ đúng | Đạn năng lượng, tiến độ thẻ và vùng nhập cập nhật |
| Gõ sai | Viền cảnh báo và rung nhẹ vùng nhập 350ms, thông báo ngắn |
| Hoàn thành từ | Thẻ tan 250ms, tám hạt nhỏ và điểm thưởng |
| Mất lá chắn | Một biểu tượng tắt, thông báo gần đáy sân |
| Tập trung | Viền năng lượng dịu và đếm thời gian trên nút |
| Giảm chuyển động | Không hạt/nhấp nhô, tàu đổi hướng tức thì; vẫn thấy hướng ngắm và phản hồi |

Chữ được vẽ từ dữ liệu chuẩn bằng mã; không lấy chữ từ ảnh concept. Thời gian thẻ tan chỉ thuộc renderer, không đổi thời gian ôn, lịch từ, RNG hoặc quy tắc tính điểm.

## Mobile và bàn phím

- Nút điều khiển có vùng bấm tối thiểu 44px; điều khiển không cần hover.
- Khi mở bàn phím, thu gọn HUD và thanh dưới, giữ mục tiêu và tàu phía trên bàn phím. Màn thấp bỏ hàng tên trước khi thu nhỏ chữ.
- Thiết bị cảm ứng tự mở bàn phím khi ván bắt đầu nếu người dùng chưa chọn tắt. Nút bàn phím luôn cho phép mở lại thủ công.
- Bàn phím đi vào phần tử fullscreen khi cần, trở về body khi thoát. Rời game thì ẩn mà không ghi đè lựa chọn của người dùng.
- Luyện cho bật/tắt Pinyin; thử thách tiếp tục khóa toàn bộ đường gợi ý, bao gồm bàn phím ảo.

## Nghiệm thu

Đối chiếu ảnh desktop và mobile chạy thật với concept tối giản, kiểm tra hướng tàu trái/phải và đạn xuất phát đúng nòng trên nhiều kích thước/DPR. Kiểm tra phím chạm thật trong trình duyệt mô phỏng mobile, mở/ẩn/mở lại, fullscreen, màn thấp, Pinyin và giảm chuyển động. Giữ các bài kiểm tra luật, kết quả, quảng cáo, điều hướng và tài khoản.

Các concept 3D trước đây chỉ giữ làm lịch sử, không phải tiêu chuẩn sản xuất hiện tại.

Điều chỉnh sau đánh giá: khung desktop tối đa 210×118px; mobile bắt đầu từ khoảng 124×80px theo kích thước sân. Giảm khung khoảng 12–15% so với bản tối giản đầu tiên, giữ cỡ Hán tự và khoảng cách giữa mục tiêu.
