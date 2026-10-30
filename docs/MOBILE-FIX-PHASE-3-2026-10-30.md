# Kết quả sửa mobile đợt 3 — 30/10/2026

Phạm vi: **MOB-05 và MOB-06**, theo [kế hoạch fix mobile](MOBILE-FIX-PLAN-2026-10-30.md). Đã đưa Tập trung và Tùy chọn trở lại luồng chơi bằng cảm ứng khi bàn phím đang mở. Chưa nghiệm thu trên điện thoại thật.

## Thay đổi cho người dùng

- Hàng điều khiển mobile giữ đủ **Tập trung, Pinyin, Bàn phím, Tùy chọn**, kể cả 320×568. Phần Pinyin đang gõ được chuyển lên thanh trạng thái; vẫn dùng cùng phần tử và buffer hiện có.
- Tập trung hiển thị điều kiện chưa đủ năng lượng, trạng thái sẵn sàng và đang dùng. Nút có accessible name/trạng thái pressed, dùng lại `activateFocus(game)` và phản hồi ngay sau khi chạm.
- Mở Tùy chọn sẽ tạm dừng game và tạm ẩn bàn phím để có chỗ cho panel. Thao tác này **không ghi đè lựa chọn bàn phím đã lưu**.
- Đóng Tùy chọn khôi phục bàn phím nếu trước đó đang mở. Nếu người dùng đã chủ động ẩn bàn phím, nó vẫn ẩn. Nếu ván đã được tạm dừng trước khi vào Tùy chọn, đóng panel vẫn giữ tạm dừng.
- Khi đang mở Tùy chọn, nút pause/bàn phím và phím Space không được chạy tiếp game phía sau panel. Escape đóng được panel khi focus ở checkbox, ngoài fullscreen.
- Có thể đổi âm thanh, vào/thoát fullscreen và **Về sảnh** trực tiếp từ Tùy chọn. Nút fullscreen đổi nhãn/trạng thái theo sự kiện fullscreenchange.
- Nếu đã xoay ngang trong lúc mở Tùy chọn, khi khôi phục bàn phím sẽ kiểm tra không gian trước khi tiếp tục; thiếu chỗ thì giữ tạm dừng và hiện hướng dẫn của đợt 2.
- Thử thách vẫn theo luật có sẵn: mở Tùy chọn là tạm dừng, chuyển sang luyện và không ghi kỷ lục thử thách.

## Sửa thêm được phát hiện trong kiểm thử

**Fullscreen:** trình duyệt ép root fullscreen phủ viewport, nên chỉ đặt chiều cao card không đủ để giữ footer trên bàn phím. Khi fullscreen, ứng dụng dành phần padding bên trong root cho bàn phím và phần visual viewport bị che; kiểm tra lại stage và nút thao tác trong vùng còn lại.

**Renderer:** lúc đổi fullscreen/xoay máy, stage có thể tạm có kích thước 0. Viền Tập trung trước đây có thể truyền radius âm cho `CanvasRenderingContext2D.roundRect`, ném lỗi và làm ngắt vòng vẽ. Giờ kích thước và radius được chặn ở giá trị không âm; có test tái hiện riêng.

## File đã thay đổi

| File | Nội dung |
|---|---|
| `src/features/game/panda.css` | Bốn nút trên một hàng, buffer ở sub-HUD, nhãn Tập trung và bố cục nút trong panel Tùy chọn |
| `src/features/game/panda-runtime.js` | Điều khiển Tập trung, khôi phục keyboard/pause/focus, khóa thao tác nền và fullscreen |
| `src/shared/virtual-keyboard.js` | Fit ngay khi mở lại bàn phím; dành không gian bên trong fullscreen root |
| `src/features/game/panda-renderer.js` | Chặn kích thước/radius âm trong giai đoạn resize |
| `tests/panda-mobile-controls.cjs` | Test cảm ứng và toàn bộ vòng đời Tùy chọn |
| `tests/panda-renderer.cjs`, `tests/run.cjs`, `package.json` | Hồi quy renderer và đưa test mới vào bộ chạy |

## Các tình huống đã kiểm tra

Kết quả cuối: **473 kiểm tra đạt, 0 suite thất bại trong 39 suite** qua `node tests/run.cjs`. Suite mới `panda-mobile-controls.cjs` có **7 kiểm tra đạt**; renderer có **4 kiểm tra đạt**. Build local bằng `node scripts/build.mjs` thành công.

Bằng chứng sau sửa:

- [Kết quả hồi quy](mobile-audit-2026-10-30/phase-3/regression-results.json), [test mobile](mobile-audit-2026-10-30/phase-3/mobile-test-output.txt), [test renderer](mobile-audit-2026-10-30/phase-3/renderer-test-output.txt).
- [Số đo và hit target](mobile-audit-2026-10-30/phase-3/observations.json).
- [320×568 đủ nút điều khiển](mobile-audit-2026-10-30/phase-3/320x568-controls.png), [Tập trung đang dùng](mobile-audit-2026-10-30/phase-3/focus-active.png), [Tùy chọn mobile](mobile-audit-2026-10-30/phase-3/options-mobile.png).

Chạy riêng: `node tests/run.cjs panda-mobile-controls.cjs panda-mobile-keyboard.cjs panda-game.cjs panda-renderer.cjs`; hoặc chạy nhóm game bằng `npm run test:game`.

1. 320×568, 360×640, 390×844, 412×915: năm nút Tập trung/Pinyin/Bàn phím/Tùy chọn/Pause có hit target thật, kích thước tối thiểu 44×44 CSS px; stage còn ít nhất 112 px và không tràn ngang.
2. Gõ đúng **5 từ sạch bằng thao tác chạm các phím ảo**, nhận một lượt Tập trung rồi chạm nút để kích hoạt. Không tự gán charge/combo/điểm. Test chỉ tăng thời gian mô phỏng qua `_update()` để đưa mục tiêu tiếp theo vào sân nhanh hơn.
3. Mở Tùy chọn khi bàn phím mở: thời gian/điểm/buffer được giữ, bàn phím tạm ẩn nhưng preference vẫn bằng `1`; đóng lại tiếp tục và khôi phục bàn phím.
4. Tùy chọn giữ trạng thái pause trước đó, giữ thiết lập âm thanh và lựa chọn chủ động ẩn bàn phím (`gp:vk=0`).
5. Vào/thoát **fullscreen thật qua nút trong Tùy chọn**, kiểm tra stage không bị bàn phím phủ và mở Tùy chọn được sau khi quay lại game.
6. Xoay ngang trong lúc mở panel rồi đóng: giữ tạm dừng nếu thiếu không gian. Xoay lại, tiếp tục và rời game qua nút Về sảnh.
7. Mở Tùy chọn trong thử thách: chuyển sang luyện đúng luật và tiếp tục được.
8. Renderer với stage tạm bằng 0 và Tập trung đang hoạt động: không ném lỗi roundRect.

Đây là Chrome giả lập touch và kích thước mobile. Safe area, thanh URL, fullscreen trên Safari/Android và thao tác thật vẫn cần kiểm tra trên thiết bị.

## Phần còn lại

- **MOB-07** không thuộc đợt 3; đã được xử lý sau đó ở [đợt 4](MOBILE-FIX-PHASE-4-2026-10-30.md).
- Nghiệm thu các đợt trên điện thoại thật; đợt 3 không thay thế kiểm chứng giọng nói thật của đợt 1.
- Chưa triển khai lên môi trường bên ngoài.
