# Kết quả sửa mobile đợt 2 — 30/10/2026

Phạm vi: **MOB-03 và MOB-04**, theo [kế hoạch fix mobile](MOBILE-FIX-PLAN-2026-10-30.md). Đã sửa bố cục sân chơi/bàn phím và cơ chế tạm dừng khi thiếu diện tích. Cần kiểm tra tiếp safe area, thanh địa chỉ và xoay máy trên điện thoại thật.

## Hành vi sau sửa

- Khi bàn phím game mở, sân chơi dùng vùng nhìn thấy của màn hình, thay vì tiếp tục nằm dưới header của ứng dụng. Header được ẩn trong trạng thái này để không che HUD; khi đóng bàn phím hoặc rời game, bố cục thường được khôi phục.
- Chiều cao card được tính từ `visualViewport.height/offsetTop`, chiều cao thực của bàn phím và khoảng cách 12 px. Có fallback khi trình duyệt không cung cấp visual viewport.
- Bỏ ép card tối thiểu 200 px. HUD, thanh trạng thái và footer được đo để dành phần còn lại cho stage; stage không còn đẩy footer ra khỏi card có `overflow:hidden`.
- Bàn phím bám vùng nhìn thấy theo cả chiều rộng và đáy; khi rộng hơn 760 px, được căn giữa.
- Thay đổi kích thước, xoay máy, visual viewport resize/scroll, fullscreen và kích thước HUD/keyboard đều yêu cầu tính lại bố cục. Các yêu cầu được gom theo animation frame; không đo lại từ mọi lần cập nhật đồng hồ game.
- HUD dành padding cho safe area. ResizeObserver theo dõi kích thước thực, nên phần không gian bổ sung được tính vào ngân sách chiều cao.

## Khi không đủ không gian

Nếu diện tích còn lại cho stage nhỏ hơn **112 px**, ứng dụng mở hộp thoại “Cần thêm không gian” và hướng dẫn xoay dọc. Hộp thoại nằm ở top layer của trình duyệt, dùng được cả trong fullscreen.

- Ván đang chạy sẽ tạm dừng; đồng hồ, lá chắn, điểm và buffer được giữ.
- Không cho tiếp tục game phía sau hộp thoại bằng phím tắt hoặc nút pause.
- Có hai thao tác rõ ràng: **Ẩn bàn phím** và **Về sảnh**. Ẩn bàn phím từ hộp thoại không thay đổi lựa chọn tự mở đã lưu của người dùng.
- Khi xoay về màn hình đủ diện tích, hộp thoại đóng nhưng game vẫn tạm dừng. Người dùng chủ động bấm **Tiếp tục**.
- Nếu đang chuẩn bị/đếm ngược khi mất diện tích, hủy lượt đếm ngược và trở lại chuẩn bị; không bắt đầu một ván bị che.
- Rời game từ fullscreen sẽ thoát fullscreen và đóng hộp thoại/bàn phím.
- Việc tạm dừng áp dụng luật hiện có: ván thử thách chuyển sang luyện và không ghi kỷ lục thử thách. Không thay đổi luật tính điểm trong đợt này.

## Các file đã sửa

| File | Nội dung |
|---|---|
| `src/shared/virtual-keyboard.js` | Đo vùng nhìn thấy, fit card/keyboard, thông báo thiếu diện tích, gom resize và theo dõi thay đổi kích thước |
| `src/features/game/panda.css` | Cho stage co theo ngân sách chiều cao, bảo vệ HUD/footer, ẩn header bị chồng lớp, safe area và hộp thoại thiếu không gian |
| `src/features/game/panda-runtime.js` | Tạm dừng, chặn tiếp tục khi thiếu chỗ, hủy countdown không phù hợp và xử lý thoát fullscreen |
| `tests/panda-mobile-keyboard.cjs` | Ma trận mobile, hit test nút, giữ trạng thái khi xoay, visual viewport và fullscreen |

## Kiểm thử và bằng chứng

Kết quả cuối: **465 kiểm tra đạt, 0 suite thất bại trong 38 suite** qua `node tests/run.cjs`. Riêng `panda-mobile-keyboard.cjs` có **10 kiểm tra đạt**. Build local bằng `node scripts/build.mjs` thành công.

Bằng chứng sau sửa:

- [Kết quả hồi quy](mobile-audit-2026-10-30/phase-2/regression-results.json), [log kiểm thử mobile](mobile-audit-2026-10-30/phase-2/mobile-test-output.txt).
- [Số đo stage, bàn phím và hit target](mobile-audit-2026-10-30/phase-2/observations.json).
- [320×568 đang chơi](mobile-audit-2026-10-30/phase-2/320x568-playing.png), [390×844](mobile-audit-2026-10-30/phase-2/390x844-playing.png), [844×390 thiếu diện tích](mobile-audit-2026-10-30/phase-2/844x390-paused-notice.png).
- [Panel tạm dừng](mobile-audit-2026-10-30/phase-2/320x568-paused-panel.png), [kết quả](mobile-audit-2026-10-30/phase-2/320x568-results-panel.png), [chuẩn bị](mobile-audit-2026-10-30/phase-2/320x568-ready-panel.png).

Chạy riêng: `node tests/run.cjs panda-mobile-keyboard.cjs panda-game.cjs games_hub.js`.

Đã kiểm tra Chrome giả lập mobile, có touch:

| Kích thước/tình huống | Điều kiện kiểm tra |
|---|---|
| 320×568 | Stage còn ít nhất 112 px; Pinyin, bàn phím, pause hiện và nhận chạm; đóng/mở lại bàn phím được |
| 360×640 | Card/stage nằm phía trên bàn phím, nút không bị che |
| 390×844 | Bàn phím tự mở sau countdown; gõ buffer đúng; vào/thoát fullscreen bằng user gesture |
| 412×915 | Stage và các nút điều khiển vừa vùng nhìn thấy, không tràn ngang |
| 844×390 | Thiếu diện tích → tạm dừng; trạng thái không đổi sau khoảng chờ; nút rời game không bị che |
| 390×844, visual viewport giả lập cao 600 px/offset 12 px | Layout viewport giữ nguyên; card và bàn phím dịch theo vùng nhìn thấy |
| Xoay dọc trở lại | Không tự chạy tiếp; cuộn đến nút Tiếp tục trong panel và chạm được |
| Fullscreen rồi xoay ngang | Hộp thoại trong fullscreen top layer, thao tác Về sảnh thoát fullscreen được |
| Panel ở 320×568 | Pause/resume, Tùy chọn sau khi ẩn bàn phím, kết quả, đổi chủ đề và bắt đầu/countdown đều thao tác được |

Test dùng số đo và `elementFromPoint()` tại tâm nút, không chỉ kiểm tra đáy phi thuyền. Việc giả lập visual viewport bằng getter/event là kiểm thử logic; chưa thay thế được bàn phím hệ điều hành hoặc thanh URL trên thiết bị thật.

## Phần chưa thuộc đợt 2

- **MOB-05/MOB-06:** không được sửa trong đợt 2; đã được xử lý sau đó ở [đợt 3](MOBILE-FIX-PHASE-3-2026-10-30.md), gồm cả điều khiển khi mở bàn phím và khôi phục sau Tùy chọn/fullscreen.
- **MOB-07:** đưa hành động Câu tiếp vào vùng an toàn của bài học thuộc đợt 4.
- Cần nghiệm thu Chrome Android/Safari iPhone qua HTTPS với safe area, thanh địa chỉ co/giãn, xoay máy và fullscreen thực tế.
- Chưa triển khai lên môi trường bên ngoài.
