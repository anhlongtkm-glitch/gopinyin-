# Kịch bản fix mobile — 30/10/2026

Nguồn: [báo cáo kiểm thử mobile](MOBILE-TEST-REPORT-2026-10-30.md). **Đợt 1–4 đã triển khai trong mã ứng dụng; còn nghiệm thu trên điện thoại thật theo đợt 5.** Chi tiết: [đợt 1](MOBILE-FIX-PHASE-1-2026-10-30.md), [đợt 2](MOBILE-FIX-PHASE-2-2026-10-30.md), [đợt 3](MOBILE-FIX-PHASE-3-2026-10-30.md), [đợt 4](MOBILE-FIX-PHASE-4-2026-10-30.md).

**Đợt 5:** đã chạy lại 481 checks/40 suite, kiểm thử build và 32 trạng thái audit mobile; phần local đạt. Chưa nghiệm thu điện thoại thật và chưa đóng toàn bộ MOB-01 đến MOB-07. Xem [hồ sơ đợt 5 và checklist thiết bị](MOBILE-FIX-PHASE-5-2026-10-30.md).

**Báo lại sau phát hành:** người dùng Android Chrome vẫn không nhận được chữ. Đã mở lại xác minh MOB-01/MOB-02 và bổ sung [bản vá thu tiếng trực tiếp trên điện thoại](MOBILE-SPEECH-HOTFIX-2026-10-30.md); vẫn cần người dùng kiểm tra sau khi phát hành.

## Thứ tự thực hiện

| Đợt | Lỗi | Kết quả cần đạt |
|---|---|---|
| 1 | MOB-01, MOB-02 | UI giọng nói phản ánh đúng khởi động, đang nghe, kết thúc và lỗi |
| 2 | MOB-03, MOB-04 | Sân chơi và điều khiển không bị bàn phím che/cắt khi màn hình thấp hoặc xoay ngang |
| 3 | MOB-05, MOB-06 | Dùng được Tập trung và Tùy chọn bằng cảm ứng khi bàn phím mở |
| 4 | MOB-07 | Hành động tiếp theo xuất hiện trong vùng an toàn khi hoàn thành câu |
| 5 | Toàn bộ | Chạy hồi quy, audit mobile và nghiệm thu giọng nói/IME trên thiết bị thật |

Không sửa bằng cách ẩn thêm nút hoặc vô hiệu hóa nhận dạng trên toàn bộ mobile. Mỗi đợt có thay đổi và bằng chứng riêng để dễ đánh giá, tránh ghi đè các thay đổi chưa commit đang có.

## Đợt 1 — Luồng nhận giọng nói

### Phạm vi file

- `src/features/pronunciation/recognition.js`: kết quả khởi động, callback vòng đời, lỗi và dữ liệu phiên.
- `src/features/pronunciation/recording.js`: điều phối trạng thái, dừng/cleanup và thông báo.
- `src/features/pronunciation/microphone.js`: vòng đời recorder/meter/stream khi khởi động thất bại hoặc phiên kết thúc.
- `tests/pronunciation-races.cjs`, `tests/pronounce.js` và một bài test mobile tích hợp cho các sự kiện API lỗi.

### Kịch bản triển khai

1. Tách trạng thái “đang mở nhận dạng” khỏi “đang nghe”. `start()` trả kết quả có thông tin lỗi hoặc promise hoàn tất khi nhận `onstart`; có timeout chờ bắt đầu hữu hạn.
2. Chỉ chuyển sang recording khi bộ nhận dạng xác nhận bắt đầu. Exception khi tạo/start phải đến controller với mã lỗi; không nuốt lỗi rồi tiếp tục.
3. Đưa `onerror`/`onend` về một đường điều phối có mã phiên. Kết thúc do lỗi phải cập nhật UI ngay, không chờ người dùng bấm dừng hoặc hết 15 giây.
4. Phân biệt dừng thủ công, kết thúc tự nhiên và hủy do đổi câu/rời màn hình. Dùng một thao tác kết thúc idempotent: chỉ chấm/lưu một lần, không tạo vòng gọi stop → onend → stop.
5. Cho phép final đến sau yêu cầu dừng trong khoảng chờ hữu hạn hiện có; sau hủy/đổi phiên thì bỏ callback cũ. Nếu không có final, hiển thị lý do phù hợp; không tự nâng interim thành kết quả đã xác nhận.
6. Dừng recorder/meter/timer của lượt thất bại; quyết định giữ stream theo chính sách phiên học hiện có. Khi rời màn hình/logout phải đóng track và bỏ tài nguyên hoàn toàn.
7. Thêm chẩn đoán ngắn, không lưu âm thanh/transcript vào log mặc định: secure context, API khả dụng, thời điểm start/error/end và mã lỗi. Thông báo cho người dùng phân biệt thiếu API, từ chối quyền, không có micro, lỗi mạng và không có kết quả cuối.
8. Kiểm tra trên máy thật xem các bước `await requireAccount()`/xin stream trước `ASR.start()` có làm mất điều kiện thao tác người dùng trên browser đích hay không. Đây là giả thuyết cần đo, chưa phải nguyên nhân đã xác minh; không đổi thứ tự một cách mù quáng.

### Kiểm thử bắt buộc

| Tình huống | Tiêu chí đạt |
|---|---|
| Constructor/start ném lỗi | Không báo đang nghe; lỗi đúng nguyên nhân; bấm thử lại được; không còn timer/recorder của lượt lỗi |
| Không phát `onstart` | Hết thời gian chờ hữu hạn, báo không khởi động được |
| ASR `network`, `not-allowed`, `service-not-allowed` | UI phản hồi ngay khi nhận lỗi, không tiếp tục báo đang nghe |
| `end` có final `你好` | Kết thúc và xử lý kết quả đúng một lần |
| `end` chỉ có interim | Giải thích thiếu final, không ghi thành tích như đã nhận dạng chắc chắn |
| Stop thủ công, final đến muộn | Nhận final trong cửa sổ chờ; không bị chấm hai lần |
| Rời màn hình/đổi câu rồi callback cũ đến | Không sửa trạng thái hoặc lưu kết quả vào câu/phiên mới |
| Nói liên tiếp ít nhất 3 lượt | Trạng thái/timer/transcript không lẫn giữa lượt |
| Thiếu API hoặc HTTP không an toàn | Thông báo đúng giới hạn môi trường, không giả vờ ghi nhận nội dung |

Nếu trình duyệt thật không có ASR hoạt động, đánh giá đường nhận dạng thay thế từ bản ghi bằng dịch vụ phía server như một hạng mục riêng: cần xác định dịch vụ, quyền riêng tư, chi phí và cấu hình. Không đưa khóa dịch vụ vào frontend; chưa coi việc thêm fallback là phần đã hoàn thành.

## Đợt 2 — Kích thước sân chơi và bàn phím

### Phạm vi file

- `src/shared/virtual-keyboard.js`: `fitGameCard()`, resize/orientation/visualViewport.
- `src/shared/virtual-keyboard.css`: chiều cao bàn phím và bố cục khi thiếu diện tích.
- `src/features/game/panda.css`: minimum stage/card và kích thước HUD/footer theo chiều cao.
- `src/features/game/panda-runtime.js`: tạm dừng nếu không đủ diện tích; giữ trạng thái ván.
- `tests/panda-mobile-keyboard.cjs`: thêm màn hình thấp, ngang và hit test điều khiển.

### Kịch bản triển khai

1. Tính vùng nhìn thấy từ `visualViewport.height/offsetTop` khi khả dụng và có fallback. Đo vị trí thật của card, chiều cao bàn phím, HUD, footer và safe area theo cùng hệ tọa độ.
2. Bỏ giả định `Math.max(200, available)` luôn đủ. Không để tổng minimum của các phần tử con vượt chiều cao card rồi cắt bằng `overflow:hidden`.
3. Dùng layout theo ngân sách chiều cao: HUD gọn, stage co được, footer giữ chỗ rõ ràng, bàn phím gọn theo chiều cao. Không chỉ áp breakpoint theo bề rộng.
4. Với 320×568, bảo đảm cả stage và nút tương tác nằm trên bàn phím. Không sửa bằng cách chỉ đẩy phi thuyền lên.
5. Với 844×390, ưu tiên bố cục ngang dành chỗ cho input và sân chơi. Nếu không đủ diện tích tối thiểu để đọc/chạm, tự tạm dừng, hiển thị hướng dẫn xoay dọc cùng nút rời/tiếp tục thao tác được. Không để ván mất thời gian hoặc lá chắn trong khi người dùng không thấy sân chơi.
6. Đồng bộ tính lại khi `resize`, `orientationchange`, `visualViewport.resize/scroll`, keyboard show/hide và fullscreen thay đổi. Gom cập nhật bằng animation frame nếu cần; tránh vòng lặp resize.
7. Giữ đúng vị trí root bàn phím trong fullscreen top layer. Kiểm tra safe area và thanh URL trên máy thật.

### Tiêu chí nghiệm thu

- Ma trận tối thiểu: 320×568, 360×640, 390×844, 412×915, 844×390; trạng thái ready/countdown/playing/pause/settings/results.
- Bàn phím đóng/mở, đổi kích thước khi đang gõ và vào/thoát fullscreen không làm mất buffer/điểm.
- Khi đang chơi: stage không bị bàn phím phủ; mỗi nút cần thiết nằm trong vùng nhìn thấy và tâm nút hit test trúng chính nút hoặc phần tử con của nó.
- Khi thiếu diện tích: trạng thái tạm dừng có thông báo và thao tác dùng được; không phải một sân chơi tiếp tục chạy dưới bàn phím.
- Không có cuộn ngang; không có nút nằm ngoài card và bị cắt mà người dùng không lấy lại được.

## Đợt 3 — Giữ đủ điều khiển bằng cảm ứng

### Kịch bản triển khai

1. Thay rule ẩn `.pdFocusButton` bằng nút gọn hoặc thêm chức năng Tập trung trên bàn phím ảo. Dùng chung hành vi `activateFocus(game)`; tránh phát keyboard event giả để vượt các guard.
2. Giữ trạng thái chưa đủ/sẵn sàng/đang dùng; có accessible name và phản hồi sau chạm. Lượt chưa đủ năng lượng không tiêu tài nguyên.
3. Đưa Tùy chọn vào HUD hoặc menu gọn luôn truy cập được. Nếu giữ ở footer thì footer phải có đủ diện tích theo đợt 2.
4. Mở Tùy chọn tạm dừng game, cho panel vùng cuộn đủ; có thể tạm ẩn bàn phím nhưng không ghi đè lựa chọn đã lưu của người dùng. Đóng panel khôi phục đúng trạng thái bàn phím và ván.
5. Giữ khả năng tắt âm thanh, vào fullscreen và rời game bằng cảm ứng; kiểm tra hành vi thử thách chuyển sang luyện khi tạm dừng theo luật hiện tại.

### Tiêu chí nghiệm thu

- Dùng một lượt chơi hợp lệ tích đủ 5 từ sạch; chạm Tập trung khi bàn phím đang mở kích hoạt đúng một lần.
- Không cần bàn phím vật lý hoặc ẩn bàn phím mới dùng kỹ năng.
- Mở/đóng Tùy chọn, đổi âm thanh và fullscreen được ở các kích thước hỗ trợ.
- Nút hiện trong DOM chưa đủ: phải có box trong viewport, không bị phủ và nhận được thao tác chạm thực.

## Đợt 4 — Hành động tiếp theo trong bài học

### Kịch bản triển khai

1. Dùng lại `ensureStudyControlVisible()` trong `src/shared/study/interactions.js` để đưa nút Câu tiếp vào vùng an toàn sau khi câu đúng hoặc kết quả phát âm hiện ra.
2. Xác định safe bottom từ navigation, bàn phím ảo và visual viewport hiện tại; tránh cộng trùng các khoảng che.
3. Thực hiện sau khi layout phản hồi đã ổn định. Không cuộn liên tục mỗi ký tự, không lấy focus khỏi IME đang composition, không can thiệp khi dialog đang mở hoặc người dùng vừa tự cuộn.
4. Nếu footer dùng sticky, chỉ áp trong vùng học và đặt trên phần che thực tế; kiểm tra phần câu hỏi và kết quả không bị footer che ngược lại.

### Tiêu chí nghiệm thu

- Với bài một câu `你好`, sau khi báo đúng, nút tiếp hiện phía trên navigation ở 390×844 và 360×640.
- Câu dài/nhiều dòng, bật/tắt nghĩa và kết quả phát âm dài không đẩy nút vào vùng không thể thao tác.
- Khi bàn phím tiếng Trung hệ điều hành đang mở, input và hành động cần thiết vẫn truy cập được; đóng bàn phím không để lại khoảng trống sai.
- Thử touch trên máy thật; không dùng `force:true` hay gọi `.click()` bằng JavaScript để che giấu lỗi hit target trong test.

## Đợt 5 — Chạy lại và điều kiện đóng lỗi

1. Chạy các suite liên quan từng đợt; sau khi tích hợp, chạy `node tests/run.cjs`. Mốc trước sửa: **443 checks passed; 0 suites failed**.
2. Chạy lại audit mobile, lưu ảnh/JSON sau sửa ở thư mục khác, giữ bằng chứng trước sửa để đối chiếu từng ID.
3. Chạy trên Chrome Android và Safari iPhone qua HTTPS: nói thật, cấp/từ chối quyền, mạng lỗi, nhập tiếng Trung, xoay máy và safe area. Ghi thiết bị/OS/browser/URL cho mỗi kết quả.
4. Giọng nói đạt khi người dùng nói được ít nhất 3 lượt liên tiếp và ứng dụng nhận đúng nội dung hợp lý; mock ASR đạt chỉ đóng phần logic, chưa đóng kiểm chứng dịch vụ trên máy thật.
5. Game đạt khi dùng được toàn bộ điều khiển bằng cảm ứng, không bị mất sân chơi và không chạy ngầm dưới trạng thái thiếu diện tích.
6. Cập nhật bảng dưới bằng commit, ảnh và test thực tế. Không đánh dấu fixed chỉ vì đã thêm CSS hoặc bộ test cũ vẫn xanh.

| ID | Trạng thái hiện tại | Bằng chứng cần bổ sung để đóng |
|---|---|---|
| MOB-01 | Đã sửa logic, có test tự động; chờ máy thật | Thử nhận dạng trên Android/iPhone qua HTTPS |
| MOB-02 | Đã sửa logic, có test tự động; chờ máy thật | Kiểm tra dịch vụ ASR thực tế khi nói, lỗi mạng và kết thúc phiên |
| MOB-03 | Đã sửa và có test; chờ máy thật | Xoay dọc-ngang, safe area, thanh URL và fullscreen trên điện thoại |
| MOB-04 | Đã sửa và có test; chờ máy thật | Xác nhận bố cục màn hình thấp với browser chrome/safe area thực |
| MOB-05 | Đã sửa và có test chạm sau 5 từ sạch; chờ máy thật | Xác nhận kỹ năng và hit target trên Android/iPhone |
| MOB-06 | Đã sửa và có test Tùy chọn/fullscreen/khôi phục; chờ máy thật | Kiểm tra panel, fullscreen và phục hồi keyboard trên thiết bị |
| MOB-07 | Đã sửa và có test vị trí/chạm/IME mô phỏng; chờ máy thật | Kiểm tra nút tiếp với IME và keyboard thực trên Android/iPhone |
