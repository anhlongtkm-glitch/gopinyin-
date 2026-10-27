# Shadowing Video — duyệt trước commit

Cập nhật 27/10/2026. Bản đã được người dùng duyệt để commit/push cùng đợt dọn mã; tài liệu này mô tả phạm vi tính năng và các giới hạn nội dung.

## Luồng mới

**Shadowing → chọn HSK/chủ đề/video → Nghe và luyện.**

- 14 video YouTube về giới thiệu bản thân, sinh hoạt, thói quen, quán cà phê, nhà hàng, mua sắm và cách diễn đạt.
- Lọc HSK 1–4, chủ đề, tìm kiếm không phân biệt dấu tiếng Việt. Cấp HSK theo mô tả của kênh, không phải chứng nhận chính thức; video có thể phù hợp nhiều cấp.
- Thẻ có ảnh, tên bài tiếng Việt, kênh, cấp độ và thời lượng nếu đã xác minh.
- Quay lại giữ bộ lọc, từ khóa, vị trí cuộn trong phiên. Có lối Nghe tiếp từ mốc đã lưu.
- Giữ Shadowing bài khóa đã biên soạn qua nút Luyện theo bài khóa; liên kết từ Bài khóa vẫn đến đúng đoạn đã chọn.

## Màn nghe

- Nhúng bằng [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference); không tải video về máy chủ GoPinyin, không cần Data API key để phát.
- Bắt chước phát âm / Nghe · Viết chính tả; cột bản chép chạy theo thời gian video, bấm câu để tua, đánh dấu/lọc câu, theo video hoặc cuộn tự do.
- Bật/tắt chữ Hán, Pinyin, bản dịch riêng; Pinyin trên chữ Hán, tiếng Việt dưới câu. Không dựng lại player khi đổi lớp chữ/chế độ.
- Phát/dừng, tua, câu trước/tiếp, phát lại, lặp câu, tự ngắt cuối câu, tốc độ, âm lượng, toàn màn hình. Lặp câu và tự ngắt loại trừ nhau.
- Ẩn video sẽ dừng phát trước. Rời màn, mở Thêm hoặc ẩn tab dừng player và giải phóng micro.
- Thu/nghe lại giọng thật, tối đa 20 giây; bản thu chỉ ở phiên này, không tải lên máy chủ, chưa có chấm điểm phát âm tự động. Lượt thu ít nhất hai giây dùng hệ nhiệm vụ/XP hiện có.
- Phím 1/2/3: Hán/Pinyin/dịch; 4/5: nghe lại/câu tiếp; Space: phát/dừng; Enter: thu/dừng thu. Chú thích trên nút và trong bảng phím tắt. Không chiếm phím của ô nhập, IME, dialog hoặc YouTube.
- Sau đăng nhập, mốc nghe, chế độ, lớp chữ, đánh dấu và phụ đề nhập được lưu theo tài khoản. Bản thu âm không được đồng bộ.

## Trạng thái bản chép

**14 video đã có trong danh mục; chưa đóng gói bản chép đồng bộ đã duyệt cho 14 video này.**

CC trong YouTube không đồng nghĩa GoPinyin có quyền API lấy bản chép ra cột bên cạnh. API [captions.download](https://developers.google.com/youtube/data/reference/rest/v3/captions/download) yêu cầu quyền chỉnh sửa video. Bản này không tự gán lời thoại minh họa/Pinyin/bản dịch cho video thật.

- Xem video ngay; công cụ cần câu có timestamp bật sau khi có bản chép.
- Nhập JSON/SRT/VTT tối đa 500 KB, 1.000 câu. JSON bắt buộc `videoId` khớp; SRT/VTT cần người nhập đối chiếu đúng nguồn. Từ chối timestamp chồng, ID trùng, cấu trúc chữ không khớp.
- SRT/VTT chỉ cung cấp chữ và mốc thời gian; không tự sinh Pinyin/dịch. JSON hỗ trợ `id`, `start`, `end`, `hanzi`, `vi`, `words: [["chữ", "pinyin"]]`.
- Bước nội dung tiếp: nhận phụ đề được phép dùng từ chủ kênh hoặc biên soạn/kiểm tra thủ công, căn mốc và duyệt trước khi đóng gói bài chính thức.
- Khả năng nhúng phụ thuộc chủ video và mạng. Có thông báo lỗi, thử lại và liên kết video gốc.

## Tích hợp

- `src/features/shadowing/`: catalog, parser, controller, HTML, CSS sở hữu riêng, JavaScript thuần.
- `#/shadow`: thư viện; `#/shadowVideo?video=<id>`: video cụ thể; `#/shadowText`: bài khóa cũ. Hỗ trợ Back/Forward.
- Namespace mới `cts:progress:shadow-video:v1:*`, `cts:progress:shadow-captions:v1:*` qua kho tài khoản hiện có; không đổi API/schema/tiến độ Gõ, Nói, Game.
- Đổi tài khoản đóng player/micro, xóa nháp phiên trước khi nạp dữ liệu chủ mới; không ghi tiến độ chủ cũ vào chủ mới.

## Duyệt tại máy

- [Thư viện](http://127.0.0.1:8094/#/shadow).
- [Video bạn gửi](http://127.0.0.1:8094/#/shadowVideo?video=4xuzuLAAzt8).
- [Danh mục nguồn](SHADOWING-VIDEO-CATALOG.md).
- Ảnh web thật: `design-review/shadowing-integrated/`.
- [Bộ ảnh duyệt sáng/tối, desktop/mobile](../design-review/shadowing-integrated/index.html).

Kết quả nghiệm thu: **27 suite, 398 kiểm tra qua** trong `npm.cmd test`; `npm.cmd run test:build` qua. Các kiểm tra tập trung Shadowing/route được chạy lại sau bước rà soát thu âm và giữ fragment đăng nhập. Báo cáo kiểm thử được sinh tại `.cache/test-run/results.json`, không đưa artifact này vào mã nguồn.

Regression kiểm tra catalog/parser, bộ lọc/Back, đúng videoId, khoảng trống phụ đề, lặp/tự dừng, ẩn video, đánh dấu, chính tả/IME, Enter thu/dừng thật, lưu lại tài khoản, route và bố cục sáng/tối ở 360/390/768/1024/1440px, màn ngang thấp, vùng nhìn hẹp tương đương zoom 200%. YouTube trong regression dùng test double; nhúng thật được kiểm tra riêng với video người dùng gửi. Chạy `npm.cmd test` và `npm.cmd run test:build` trước bàn giao.
