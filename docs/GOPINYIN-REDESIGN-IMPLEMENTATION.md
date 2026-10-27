# GoPinyin — bản triển khai ngọc bích

**Cập nhật 27/10/2026:** áp dụng yêu cầu mới trong [kế hoạch hiện hành](GOPINYIN-REDESIGN-PLAN.md). Ảnh đối chiếu cũ là lịch sử thiết kế; các màn Thanh điệu và Shadowing đã được gỡ.

**Bản sửa AI tiếp theo:** bỏ hoàn toàn bước AI soát lại nghĩa. Sửa tình huống yêu cầu tạo thêm bắt đầu khi còn hai mục, nhưng người học đã đi hết danh sách trước khi phản hồi về: trạng thái chờ được lấy ngay trước lúc nối dữ liệu để chuyển sang câu/từ mới và mở khóa ô nhập. Nếu API lỗi khi đã học hết, màn chờ chuyển sang tạm dừng và có Thử lại. Kiểm thử `ai_append_wait.cjs` tái hiện thao tác học thực tế cho cả bộ tạm và bộ đã lưu; `ai_generation_flow.cjs` xác nhận không có lượt soát nghĩa ngay cả khi máy còn lưu lựa chọn bật cũ.

Kiểm chứng bản sửa AI: 30 bộ kiểm thử đạt 390 kiểm tra trong một lượt chạy đầy đủ; kiểm thử đóng gói HTML/tài nguyên/file preview và bản build cuối đều đạt. Các kiểm thử AI dùng phản hồi giả, không tiêu thụ hạn mức Gemini thật. Kết quả tổng hợp: `.cache/learning-update-validation.json`.

## Bản sửa lại theo ảnh đã duyệt

Bản triển khai đầu bị người dùng từ chối vì chưa thay kết cấu cũ. Đợt sửa này lấy `design-review/jade-typing/` làm chuẩn: menu ngang, hero lớn, dải chọn nội dung, nhiệm vụ cạnh gấu, màn Gõ/Nói hai cột, các trang kỹ năng có khu làm việc và cột phụ riêng. Không dùng bản triển khai đầu làm chuẩn thiết kế.

- `src/features/practice/catalog-controller.js`: chọn cấp HSK, nhóm/chặng thật, học tiếp và liên kết từ Bài khóa sang luyện tập. Công cụ điều hướng thuộc `src/app/navigation-events.js`; bố cục Game nằm trực tiếp trong HTML của Game.
- `src/shared/study/presentation.js`: tổ chức lại các nút/ô nhập đã có thành khung đã duyệt; không tạo lại input, không thay bộ chấm hoặc mất handler. Kết quả Nói nằm bên phải desktop, dưới câu trên mobile.
- HSK 1–9 chia bộ câu hiện có thành sáu chặng mỗi cấp, bao phủ toàn bộ câu của cấp. Riêng HSK 1 có 301 câu (51/51/51/51/51/46); kho HSK đầy đủ vẫn tiếp cận được. Bộ chặng lưu như dataset có nội dung, không dùng cờ `builtin` dành riêng cho bộ tải lại từ catalog.
- Trang Gấu phân biệt bốn huy hiệu học tập với bốn mốc phụ kiện; huy hiệu phản ánh hoạt động thật của tài khoản. Game có hình minh họa theo palette ngọc bích/matcha.
- [Trang đối chiếu ảnh đã duyệt với web thật](../design-review/approved-implementation/index.html), server xem cục bộ `http://127.0.0.1:8102/`. Ảnh chụp thực tế có sáng/tối và desktop/mobile; số liệu là tài khoản kiểm thử.
- `tests/approved-layout.cjs` kiểm tra hình học các khối chính, chọn HSK/chặng, bộ câu thật, chuyển Gõ/Nói, liên kết Bài khóa → luyện Gõ/Nói, năm kích thước và chế độ giảm chuyển động.
- Khi vào màn Nói, đợi hoàn tất nạp thiết lập/bộ câu trước khi mở các điều khiển; kiểm tra phiên điều hướng sau `await` để phím tắt vừa bấm không bị thiết lập nạp trễ ghi đè.

## Phạm vi đã triển khai

- Token sáng be `#FDFBF6`, tối sâu `#070D0B`, ngọc bích và matcha; nút có màu chữ riêng trong mỗi theme. Manrope / Be Vietnam Pro / Noto Sans SC, giữ Baloo 2 cho lời chào gấu.
- Một thư viện **Luyện tập**, hai tab HSK / chủ đề. Thẻ có lối vào Gõ và Nói; nguồn phụ vẫn tiếp cận được. Nhớ chế độ theo bộ, mặc định Gõ cho bộ mới. Game là mục riêng.
- Hai màn học giữ bộ chấm độc lập, cùng câu khi đổi chế độ và nháp/con trỏ theo câu. Nháp chỉ giữ trong phiên, không tải lên máy chủ. Theo con trỏ Nói không được tự đánh dấu các câu Gõ trước đó đã hoàn thành. Mở lại chế độ Nói từ thư viện dùng con trỏ Nói đã lưu.
- Link `#/study?dataset=…&mode=speaking` phục hồi chế độ Nói; link Gõ và các route cũ tiếp tục dùng được. Chọn bộ trước đăng nhập giữ ý định Gõ/Nói trong continuation hiện có.
- Tổng quan ưu tiên Bắt đầu / Tiếp tục luyện gõ, lối vào kỹ năng, nhiệm vụ, tiến độ và ôn tập. Điện thoại có Tổng quan / Luyện tập / Game / Gấu / Thêm. Bài khóa và Học bằng AI ở trong Thêm. AI cũng có trên menu desktop và Tổng quan.
- 18 bài khóa hội thoại có người nói, Hán/Pinyin/dịch Việt, từ cần nhớ và ba câu hỏi hiểu bài: 6 bài HSK 1 × 12 lượt lời, 6 bài HSK 2 × 14, 6 bài HSK 3 × 16. Có lọc theo cấp, nghe từng câu/toàn bài và chuyển sang luyện tập với ID theo phiên bản. Đúng từ hai câu nhận hoàn thành.
- Gỡ Thanh điệu và toàn bộ Shadowing (cả YouTube và bài khóa), bộ xử lý, CSS và kiểm thử cũ. Link đã lưu chuyển về Bài khóa. XP lịch sử vẫn giữ, nhiệm vụ khám phá hiện chỉ dựa trên hoàn thành bài khóa.
- Phím cũ 1–5 / 0 / Enter / ? giữ trong Luyện tập. Điều khiển đang focus giữ Enter gốc và không xử lý phím khi có IME/modal.
- Ô nhập luyện gõ căn giữa, padding hai bên bằng nhau. Mặc định giọng Google Mandarin (giọng nữ tiếng Trung khả dụng nếu không có Google), tốc độ 1.0; lựa chọn người dùng được giữ và chia sẻ giữa Gõ/Nói. Luyện nói tự nghe mẫu một lần mỗi câu mới, hủy lịch phát khi rời câu hoặc bắt đầu thu âm.
- Học bằng AI tái sử dụng prompt/chế độ câu/từ/cả hai, lưu/học tiếp và tự bổ sung khi còn dưới ba mục. API cùng origin giữ key chung trên máy chủ; lỗi quota/mạng dừng tự gọi và có Thử lại. Hướng dẫn [cấu hình key chung](AI-SHARED-SETUP.md).
- Ba nhiệm vụ ngày, thử thách học bốn ngày/tuần, XP và level 1–20. Huy hiệu theo mốc 5/10/15/20, huy hiệu tuần được suy ra từ lịch sử nên không mất khi sang tuần mới. Bộ sưu tập hiện hiển thị huy hiệu; chưa có thay trang phục trực tiếp trên ảnh gấu.
- XP tính từ sự kiện học thật, ID nội dung/ngày chống lặp; Game tối đa 20 XP/ngày. Không dùng hoạt họa làm nguồn cộng điểm. Dữ liệu thưởng vẫn đi qua cơ chế đồng bộ/xử lý xung đột tài khoản hiện có.
- Hiệu ứng chuyển màn 220ms, gấu đúng/sai, hoàn thành, nhiệm vụ, huy hiệu và lên level; ưu tiên thành tích lớn hơn khi trùng thời điểm. Confetti tối đa 60/24 hạt, dừng sau 1.500ms và khi ẩn trang. Có Đầy đủ / Nhẹ nhàng / Tắt; tôn trọng giảm chuyển động, không thêm âm thanh khích lệ mặc định.

## Vị trí mã và dữ liệu

- `src/features/practice/bridge.js`: cầu nối trình bày/ngữ cảnh; không thay hai bộ chấm.
- `src/features/journey/content.js`: nội dung gốc; `model.js`: quy tắc XP/level/tuần thuần; `controller.js`: giao diện bài khóa và hành trình Gấu.
- `src/shared/celebrations.js`, `confetti.js`: phản hồi không chặn thao tác.
- `cts:progress:practice-mode:<dataset>` và `cts:progress:journey-day:YYYY-MM-DD`: dùng allowlist `cts:progress:` sẵn có. Không cần migration hay đổi chính sách Supabase. Không thay khóa tiến độ Gõ/Nói cũ.
- Tiến độ Gõ chính được giữ khi người học chuyển qua xem một câu Nói ở vị trí khác. Lượt luyện từ vị trí đó vẫn có thống kê câu đúng; không tự bỏ qua các câu chưa gõ trước con trỏ chính.

## Cần hoàn thiện trước phát hành rộng

- Âm mẫu mới đang dùng TTS khả dụng trên thiết bị, đã ghi rõ trong giao diện. **Chưa có bộ âm thanh tổng hợp cố định được người phụ trách duyệt**. Cần duyệt nội dung và phát âm (đặc biệt thanh nhẹ, biến điệu), rồi thay bằng âm mẫu ổn định.
- Chưa triển khai đồ họa gấu mặc phụ kiện, âm khích lệ tùy chọn, video bàn giao và đo lường hành vi thí điểm. Không hiển thị điểm chấm giả.
- Cần nghiệm thu micro/IME/bàn phím ảo trên thiết bị thật, zoom trình duyệt 200% và chất lượng giọng đọc từng nền tảng. Kiểm thử tự động dùng Chrome với thiết bị âm thanh giả để xác minh vòng đời thu âm; không thay thế đánh giá phát âm thực tế.
- Chưa triển khai hay thay đổi dịch vụ production. Đây là mã nguồn và bản xem trước tại workspace.

## Kiểm chứng

`tests/journey.cjs` kiểm tra tính thưởng, chống lặp, giới hạn Game, mốc level, huy hiệu tuần, đọc hiểu, thanh điệu, thu âm, nháp/con trỏ và đổi nguồn Gõ/Nói. Việc chụp ảnh giao cho `tests/approved-layout.cjs` để không xuất ảnh trùng lặp vào bộ ảnh cũ.

- `npm.cmd test`: **26 bộ / 390 kiểm tra qua, 0 lỗi** sau khi sửa lại kết cấu theo ảnh duyệt và thứ tự khởi tạo màn Nói.
- `npm.cmd run test:build`: qua; HTML không trùng ID, chỉ đóng gói tài nguyên công khai, chạy smoke `file://`.
- Giao diện mới kiểm tra 360 / 390 / 768 / 1024 / 1440px, màn ngang 844×390, sáng / tối; không tràn ngang, không có lỗi JavaScript trong các luồng đã kiểm tra.
- Bộ ảnh hiện hành tại `design-review/approved-implementation/`, có [trang đối chiếu hai cột](../design-review/approved-implementation/index.html). Ảnh dùng tài khoản dữ liệu kiểm thử, không phải tiến độ thật của người dùng. Bản triển khai nháp trước đã được dọn; ảnh đối chiếu được duyệt ở `jade-typing` vẫn được giữ.
- Preview ứng dụng hiện chạy tại `http://127.0.0.1:8094/`; tải lại trang để nhận mã mới.
