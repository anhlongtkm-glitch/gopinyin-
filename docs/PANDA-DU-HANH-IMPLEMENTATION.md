# Panda Du Hành — Bản triển khai

Cập nhật: 30/10/2026.

## Đã có trong mã nguồn

- Tên Panda Du Hành ở sảnh và điều hướng; giao diện vũ trụ, tàu gấu nhỏ nhìn từ phía sau, đạn năng lượng và khoang từ vựng.
- 14 chủ đề: Gia đình, Ăn uống, Đồ uống, Trường học, Du lịch, Mua sắm, Động vật, Thiên nhiên, Thời tiết, Cơ thể, Sức khỏe, Thể thao, Công việc, Thời gian. Mỗi chủ đề 50 từ, tổng 700 mục. Có tìm kiếm tên chủ đề, chấp nhận từ khóa không dấu.
- Đồ họa tối giản: nền #080F1B, thẻ phẳng #111C2A, viền ngọc #69E5C2. Nền và thẻ vẽ bằng Canvas/CSS; chỉ tàu dùng sprite. Tàu ngắm đúng mục tiêu, nòng và đạn đồng bộ theo góc xoay; không nhấp nhô gây lệch tọa độ. Thẻ tan 250ms, đạn có vệt ngắn/vòng chạm; giảm chuyển động vẫn giữ hướng ngắm.
- Ván 90 giây, ba lá chắn, ba đợt tăng nhịp, combo tối đa ×3, thẻ vàng, nhiệm vụ cuối và kỹ năng Tập trung bằng Shift hoặc nút.
- Nhịp đã giảm: luyện cho mỗi từ khoảng 26–35 giây để đi hết sân, thử thách khoảng 22–31 giây tùy đợt và độ dài; tối đa hai mục tiêu đang chơi. Hai lần sinh cách nhau tối thiểu năm giây khi luyện, 4,5 giây khi thử thách. Từ thường bị tồn quá lâu được bỏ khỏi hàng đợi, tránh dồn nhiều từ sau khi bỏ lỡ.
- Luyện chủ đề: nút Hiện/Ẩn Pinyin và Enter; bàn phím ảo dùng chung quy tắc. Khi ẩn, không gợi ý phím tiếp theo. Từ hoàn thành hiện cách đọc ngắn để ôn lại.
- Có thể chọn hiện Pinyin ngay ở màn chuẩn bị. Lựa chọn được nhớ theo tài khoản; chế độ thử thách khóa ô này.
- Thử thách: cùng đề trong ngày theo giờ Việt Nam, Pinyin bị khóa ở mọi đường nhập; tạm dừng hoặc rời tab chuyển ván sang luyện. Kỷ lục tách theo chủ đề, chế độ, phiên bản luật/nội dung và đề ngày.
- Kết quả thực tế gồm điểm từ/thưởng, số lượt hoàn thành, độ chính xác khi gõ, combo, nhiệm vụ và danh sách từ cần ôn. Có nghe mẫu; tắt âm thanh cũng tắt đọc từ.
- Kết quả phân biệt lượt hoàn thành và số từ khác nhau. Từ danh sách ôn có thể bắt đầu phiên chỉ dùng đúng nhóm từ đó; phiên ôn có kết quả riêng, không ghi đè kỷ lục chủ đề hay kết quả ván chính.
- Ván luyện được giữ trong bộ nhớ khi chuyển mục; tài khoản khác không dùng lại trạng thái của tài khoản trước. Tùy chọn và kỷ lục dùng kho học tập theo tài khoản hiện có.
- Giao diện đáp ứng màn nhỏ, bàn phím ảo, toàn màn hình, điều hướng bằng bàn phím và giảm chuyển động.

## Quảng cáo đầu ván

Đã có vòng đời: Chơi → quảng cáo khi khả dụng → đếm ngược 3–2–1 → bắt đầu. Không có quảng cáo giả, cộng mạng bằng đồng hồ hay quảng cáo giữa ván.

**Người dùng đã xác nhận chưa có nhà cung cấp quảng cáo.** Luồng hiện tại là Chơi → đếm ngược → vào ván; màn chuẩn bị không nhắc quảng cáo khi chưa cấu hình dịch vụ. Nếu có nhà cung cấp nhưng không có quảng cáo để phân phối, game vẫn vào đếm ngược và cho chơi. Nút Chơi chặn gửi trùng, bỏ callback muộn khi người chơi hủy/rời màn, có giới hạn chờ và tín hiệu hủy.

Điểm nối cho SDK của nhà cung cấp:

```js
window.__pandaAds = {
  async showPreroll({ signal, topicId }) {
    // Nối SDK thật tại đây. Promise chỉ kết thúc khi quảng cáo thực sự đóng.
    // Tôn trọng signal; reject khi cần hủy hoặc SDK gặp lỗi.
  }
};
```

Không cài một hàm rỗng vào sản phẩm để giả đã phát quảng cáo. Chỉ cấu hình adapter khi có dịch vụ thật. SDK phải tự quản lý UI quảng cáo; game không đặt điều khiển đè lên nội dung đó.

## Phạm vi cạnh tranh hiện tại

Đã có thử thách đề ngày và **kỷ lục cá nhân** theo tài khoản. Chưa mở bảng xếp hạng công khai giữa nhiều người; cần API cấp mã ván và xác thực chuỗi sự kiện phía máy chủ trước khi công bố thứ hạng. Tổng điểm do trình duyệt gửi chưa được coi là kết quả thi đấu được xác thực.

## Tổ chức mã

| File | Trách nhiệm |
| --- | --- |
| src/features/game/panda-content.js | Bộ từ và chuẩn hóa Pinyin |
| panda-vocabulary.js | Phần mở rộng các chủ đề, Hán tự/Pinyin/nghĩa Việt |
| panda-model.js | Luật thuần, lịch mục tiêu có seed, điểm, combo, mạng, gợi ý và sự kiện |
| panda-renderer.js | Vẽ nền, khoang từ, đạn và hiệu ứng; không thay dữ liệu luật |
| panda-runtime.js | Tích hợp tài khoản, thao tác, quảng cáo, overlay và kỷ lục |
| view.html, panda.css | DOM và bố cục mới |
| assets/game/panda-du-hanh/ | Sprite gấu/tàu WebP bản thường/nhỏ; nền cũ chỉ giữ lịch sử |

Bootstrap khởi tạo runtime mới. Giữ giao diện window.__game và vùng state dùng bởi điều hướng, tài khoản, menu mobile và bàn phím chung để các luồng khác tiếp tục hoạt động.

## Chạy và kiểm tra

```text
npm start
npm run test:game
npm run test:build
```

Các bài kiểm tra mới: tests/panda-model.cjs và tests/panda-game.cjs. Chúng kiểm tra đề có seed, thời gian, combo, thưởng, mục tiêu, Pinyin, bàn phím, dữ liệu kết quả, quảng cáo bị hủy/callback trùng, tải tài nguyên và bố cục mobile.

Ảnh chụp game chạy thật được bài kiểm tra lưu dưới .cache/panda-game/. Bản concept và prompt mỹ thuật được giữ riêng tại design-review/panda-du-hanh/; không đưa ảnh concept vào bundle website.

Build chỉ đóng gói các tài nguyên WebP được cho phép, không chép master PNG, prompt, báo cáo hoặc ảnh kiểm thử vào dist.

Bản tối giản chỉ đóng gói panda-ship.webp và panda-ship-small.webp. Các nền/khung 3D, master, prompt và báo cáo trước đây giữ làm lịch sử tại assets và design-review; không còn được tải hoặc đóng gói vào website.

Phiên bản nội dung panda-topics-v2 và luật panda-90s-v2-calm tách kỷ lục khỏi bộ nhỏ/nhanh trước đây.


## Bản sửa bàn phím mobile

Bàn phím tự mở theo sự kiện gp:game-started trên thiết bị cảm ứng khi người dùng chưa tắt; không còn chỉ phụ thuộc selector của nút và độ trễ click. Khi fullscreen, bàn phím chuyển vào phần tử fullscreen để không bị lớp hiển thị của trình duyệt che. Rời game tự ẩn mà giữ lựa chọn mở cho lần sau. Có kiểm tra chạm, nhập, ẩn/mở lại, fullscreen thực, DPR 2 và màn thấp trong tests/panda-mobile-keyboard.cjs. tests/panda-renderer.cjs kiểm tra hướng ngắm/nòng/điểm chạm, resize và giảm chuyển động.
