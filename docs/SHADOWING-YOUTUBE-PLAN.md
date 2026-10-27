# Shadowing Video — kế hoạch thay thế màn Shadowing hiện tại

Trạng thái: kế hoạch tham chiếu đã được triển khai; xem [bản bàn giao hiện hành](SHADOWING-VIDEO-REVIEW.md). Thay định hướng bài Shadowing chỉ đọc/thu câu ngắn bằng một khu học qua video YouTube có transcript đồng bộ.

## Cập nhật theo ảnh người dùng cung cấp

Đã nhận ảnh giao diện tham chiếu và video thử `https://youtu.be/4xuzuLAAzt8`. Video thuộc Chloe Chinese Class, bài về cách dùng 考虑, nhãn HSK 4. Đã kiểm tra player nhúng thực tế trả đúng video ID, trạng thái phát và đồng hồ tiến lên; không tải video/audio về GoPinyin.

Bản mẫu tương tác cũ đã được thay bằng [web thật và bộ ảnh duyệt hiện hành](../design-review/shadowing-integrated/index.html). Mã thí điểm trùng lặp đã được dọn.

| Chức năng nhìn thấy trong ảnh | Cách áp dụng cho GoPinyin |
| --- | --- |
| Bắt chước phát âm / Nghe–Viết chính tả | Hai tab trên cùng. Chính tả che đáp án, kiểm tra chữ Hán và cho hiện đáp án của câu đang chọn; giữ nháp theo câu |
| Player YouTube | Nhúng bằng IFrame Player API, dùng video ID; giữ điều khiển/nhận diện YouTube, không lưu tệp video trên server |
| Bản chép từng thẻ | Số câu, mốc thời gian, nhóm từ. Pinyin nhỏ trên chữ Hán theo dạng ruby; bản dịch dưới câu |
| Pinyin / Bản dịch | Công tắc độc lập, cùng tác dụng ở thanh bản chép; thêm công tắc Hán. Đổi lớp chữ không dựng lại iframe |
| Cờ ở mỗi câu | Diễn giải thành đánh dấu câu cần luyện lại, có bộ lọc câu đã đánh dấu. Chưa khẳng định cờ trên web tham chiếu có nghĩa giống vậy |
| Câu trước / lặp / phát / câu tiếp | Điều khiển theo timestamp của câu; lặp câu và tự ngắt câu loại trừ nhau |
| Thanh thời gian / âm lượng / tốc độ | Liên kết player; chỉ bật tốc độ video hỗ trợ; toàn màn hình bằng trình duyệt/player |
| Ẩn video | Tạm dừng trước khi ẩn. Không dùng iframe vô hình để phát nền; có thể bổ sung thu gọn player còn nhìn thấy được nếu cần vừa nghe vừa đọc |
| Phím tắt / tùy chọn | 1 Hán, 2 Pinyin, 3 dịch, 4 phát lại, 5 tiếp; Space phát/dừng, Enter thu/dừng ở vùng học. Hộp thoại native, cỡ chữ, âm lượng |

Phân biệt rõ hai nguồn trong bản xem trước:

- **Video bạn gửi:** player YouTube thật, bản chép ban đầu để trống đến khi có phụ đề đúng. Có nhập JSON/SRT/VTT; SRT/VTT chỉ có chữ và timestamp thì chưa tự có Pinyin hoặc bản dịch.
- **Bài mẫu tương tác:** sáu câu gốc GoPinyin để thử đồng bộ mô phỏng, bật/tắt lớp chữ, lặp/ngắt, chính tả và thu âm. Không gắn các câu này làm transcript của video người dùng gửi; đồng hồ mô phỏng không phải kiểm chứng độ khớp lời thoại video.

Nguồn kỹ thuật: [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) hỗ trợ nhúng và điều khiển phát. [captions.download](https://developers.google.com/youtube/v3/docs/captions/download) yêu cầu quyền chỉnh sửa video để tải captions qua API chính thức. [Developer Policies, III.I](https://developers.google.com/youtube/terms/developer-policies) quy định về player nền; vì vậy nút ẩn sẽ tạm dừng, không phát audio từ player vô hình.

Các ca kiểm tra bản mẫu đã chuyển thành `tests/shadow-video.cjs`, chạy cùng `npm test`: parser, đồng bộ, lớp chữ, lặp/ngắt, chính tả/IME, thu âm, điều hướng, lưu theo tài khoản và responsive. Nhúng YouTube thật được kiểm tra riêng.

## 1. Yêu cầu và phạm vi tham khảo

- Video YouTube nói tiếng Trung là nội dung chính.
- Cạnh video là bản chép lời đi theo thời gian phát; người dùng chọn ẩn/hiện chữ Hán, Pinyin và bản dịch Việt độc lập.
- Trong kế hoạch này, **bản chép / transcript** là lời thoại chữ Hán. **Bản thu của tôi** là giọng người học; dùng tên riêng để không nhầm hai thứ.
- Giữ khung Plan A đã duyệt: menu ngang, nền be rất nhạt / tối sâu, ngọc bích và matcha. Gấu nhỏ ở hướng dẫn hoặc kết quả; dành diện tích chính cho video và lời thoại.
- [Nhai HSK](https://nhaihsk.com/) giới thiệu tính năng Shadowing video. Phiên kiểm tra trang trực tiếp bị lớp chặn công cụ kiểm tra, nên chưa xác minh được đầy đủ giao diện và hành vi bên trong. Các chi tiết dưới đây là thiết kế đề xuất cho GoPinyin, không phải mô tả khẳng định về Nhai HSK.

## 2. Hai màn chính

### Thư viện video

- Bộ lọc: độ khó gợi ý, chủ đề, thời lượng; tìm theo tên video hoặc bài học.
- Thẻ có ảnh đại diện, tên, kênh nguồn, thời lượng, độ khó do GoPinyin biên tập, số đoạn luyện và vị trí học tiếp.
- Dải **Tiếp tục xem và luyện** mở đúng video, câu và mốc thời gian đã lưu.
- Khởi đầu với 6–10 video ngắn, khoảng 2–5 phút, giọng rõ và transcript đã kiểm tra. Chưa gọi độ khó biên tập là chứng nhận HSK của video.
- Video được tuyển chọn trước; việc người học tự dán link bất kỳ dành cho giai đoạn sau khi đã có luồng nhập phụ đề rõ ràng.

### Màn xem và luyện

| Khu vực | Bố cục / nội dung |
| --- | --- |
| Đầu màn | Quay lại thư viện, tên video, kênh nguồn, độ khó, tiến độ các đoạn đã luyện |
| Cột trái desktop, khoảng 60% | Player YouTube, điều khiển học theo đoạn, khu thu và nghe lại giọng |
| Cột phải desktop, khoảng 40% | Thanh bật/tắt lớp chữ và transcript có thể cuộn riêng |
| Dưới player | Câu trước · Phát lại câu · Phát/dừng · Câu tiếp; tốc độ; Lặp câu; Dừng cuối câu |
| Hướng dẫn phụ | Gấu nhỏ, mẹo ngắn và trạng thái học; không thêm một hero lớn đẩy video xuống dưới |

- Mỗi dòng transcript có timestamp, chữ Hán → Pinyin → bản dịch Việt. Câu hiện tại có nền ngọc bích nhạt, có dấu nhận biết ngoài màu sắc.
- Ba công tắc luôn nhìn thấy: **Bản chép / Hán [1] · Pinyin [2] · Dịch Việt [3]**. Thêm chế độ thu gọn toàn bộ bảng transcript để xem video rộng hơn.
- Đổi cách hiển thị không đổi mốc video, câu đang chọn, vòng lặp hay bản thu. Nhớ thiết lập người học.
- Ẩn cả ba lớp vẫn giữ video và công cụ luyện; có nút Hiện phụ đề dễ tìm.
- Các nút này điều khiển bảng của GoPinyin. Không hứa xóa được chữ đã được tác giả đốt trực tiếp vào hình video; phụ đề bên trong player là một lớp riêng.

### Trên điện thoại

- Video nằm trên, transcript ở dưới; không ép hai cột hẹp.
- Khi đọc lời thoại, có thể ghim player gọn ở đầu trong giới hạn màn hình. Với màn ngang thấp hoặc zoom lớn, trở về luồng cuộn bình thường để còn chỗ đọc.
- Hàng Hán / Pinyin / Dịch và câu đang luyện dễ tiếp cận; giới hạn chiều cao transcript để không tạo hai vùng cuộn tranh nhau.
- Giữ safe area, không để thanh điều hướng che câu và nút. Khi fullscreen YouTube, các lớp chữ tùy chỉnh vẫn thuộc trang GoPinyin, không hứa chèn chúng vào fullscreen của iframe.

## 3. Phụ đề chạy theo video

- Đồng bộ theo **đồng hồ của player**, không chạy một bộ đếm riêng. Tạm dừng, tua, buffering hoặc đổi tốc độ phải cập nhật lại câu tương ứng.
- Khởi đầu đồng bộ **theo câu / đoạn**, chưa tô từng từ khi không có timestamp từng từ.
- Bấm một câu → tua đến đầu đoạn và phát đoạn đó, nếu trình duyệt cho phép. Tab + Enter trên dòng cũng thực hiện được.
- Bật Theo video: cuộn nhẹ tới câu đang phát. Người dùng cuộn thủ công thì tạm ngừng bám; hiện **Về câu đang phát** thay vì giành lại vị trí đọc.
- **Lặp câu** và **Dừng cuối câu** là hai lựa chọn rõ ràng. Với lặp câu, chọn 2 lần / 3 lần / liên tục. Không đồng thời bật hai hành vi trái nhau.
- Mốc trống giữa hai câu không tự hiển thị câu kế tiếp sớm. Xử lý cue trùng, khoảng trống, câu dài và nhiều người nói khi biên tập.
- Có thể bổ sung hiệu chỉnh lệch phụ đề ±0,25 giây, áp dụng cùng một độ lệch cho highlight, tua câu và ranh giới lặp.
- Mục tiêu nghiệm thu: sai lệch highlight theo câu không quá khoảng 300ms trong điều kiện phát ổn định; lặp đoạn là gần đúng theo player, không cam kết chính xác tới mẫu âm thanh.

## 4. Ba cách học trong cùng video

| Chế độ | Hành vi |
| --- | --- |
| Xem hiểu | Video phát liên tục, transcript bám theo, tự chọn các lớp chữ |
| Nghe từng câu | Phát một đoạn rồi dừng; nghe lại, đổi tốc độ hoặc sang câu tiếp |
| Shadowing | Nghe đoạn mẫu → dừng video → ghi giọng → nghe bản thu và phát lại đoạn mẫu để tự đối chiếu |

- Có thể nói đuổi theo video mà không ghi âm ở chế độ xem. Khi thực sự ghi, mặc định dừng video/TTS để bản thu không lẫn âm mẫu.
- Enter bắt đầu / dừng ghi; thu xong không tự nhảy câu, người học có thể nghe lại trước.
- Bản thu gắn với video và cue đã chọn. Chuyển câu/video phải dừng recorder, giải phóng micro và không để kết quả muộn gắn vào câu mới.
- Chưa chấm đúng/sai hoặc điểm phát âm nếu chưa tích hợp bộ đánh giá phù hợp.
- Không cộng XP chỉ vì bật video hoặc tua hết bài. Giữ thưởng thực hành hợp lệ theo cơ chế hiện có; chống cộng lặp theo tài khoản + ngày + video/cue/phiên bản nội dung. Xem video và hoàn thành luyện là hai loại tiến độ khác nhau.

## 5. Bàn phím và sự thuận tiện

| Phím | Hành động trong vùng học GoPinyin |
| --- | --- |
| 1 / 2 / 3 | Ẩn/hiện Hán / Pinyin / dịch Việt |
| 4 | Phát lại câu đang chọn |
| 5 | Sang câu tiếp |
| Space | Phát / tạm dừng video |
| Enter | Bắt đầu / dừng bản thu của tôi |
| ? | Hướng dẫn phím tắt |

- Gắn nhãn phím ngay trên nút; Enter/Space ở nút được chọn bằng Tab giữ hành vi gốc.
- Không chiếm phím trong ô tìm kiếm, IME, hộp thoại hoặc trường nhập. Khi focus ở iframe YouTube, phím do player xử lý; cung cấp nút để quay lại vùng học, không hứa bắt được phím xuyên iframe.
- Tốc độ gợi ý 0,75× / 1× / 1,25×, chỉ bật các mức player thực sự hỗ trợ.

## 6. Nguồn phụ đề — điều kiện để làm được ổn định

Không thiết kế lời hứa “dán bất kỳ link YouTube nào cũng có ngay sub, Pinyin và tiếng Việt”. API tải captions chính thức của YouTube yêu cầu quyền chỉnh sửa video; không phải nguồn tải transcript công khai tùy ý. [Tài liệu captions.download](https://developers.google.com/youtube/v3/docs/captions/download).

Luồng đề xuất cho bản đầu:

1. Biên tập viên chọn video cho phép nhúng và nguồn transcript có quyền sử dụng.
2. Nhập SRT/VTT hoặc transcript có timestamp; trường hợp tự biên soạn thì căn thời gian theo video.
3. Chuẩn hóa câu Hán; tạo bản nháp Pinyin và dịch Việt, sau đó kiểm tra tên riêng, từ đa âm, biến điệu và ngữ cảnh.
4. Nghe rà các mốc đầu/cuối, sửa lỗi chia câu, rồi mới xuất bản bài.
5. Nếu chưa có transcript, hiện trạng thái rõ; không tạo lời thoại giả. Video bị gỡ/chặn nhúng có nút đổi bài hoặc mở nguồn, không gán là bài đã hoàn thành.

Dữ liệu mỗi bài gồm video ID, tên, kênh/link nguồn, chủ đề, độ khó gợi ý, phiên bản transcript và các cue `{id,start,end,hanzi,pinyin,vi}`. Các nguồn/giấy phép và trạng thái duyệt được lưu cùng hồ sơ nội dung.

## 7. Hướng kỹ thuật

- Giữ JavaScript thuần và khung hiện tại. Tách player YouTube, đồng bộ transcript, điều khiển đoạn và recorder thành các thành phần riêng.
- Dùng [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) cho thời gian phát, tua, trạng thái và tốc độ. Không lấy âm mẫu bằng cách tách/tải audio của YouTube.
- Chỉ đọc thời gian khi cần, khoảng 100–200ms lúc đang phát; hiệu chỉnh ngay khi có thay đổi trạng thái. Dừng bộ lập lịch khi rời màn/ẩn tab, kiểm tra lại đồng hồ khi trở về.
- Không thay iframe khi người dùng chỉ bật/tắt chữ. Chỉ cập nhật cue đang hoạt động; transcript dài phải tránh dựng lại toàn bộ bảng mỗi lần tick.
- Dữ liệu lưu tiếp tục gồm video/cue, mốc thời gian, tùy chọn hiển thị và trạng thái đoạn đã luyện. Đặt namespace/version riêng, giữ tiến độ Shadowing cũ; tái dùng cơ chế lưu theo tài khoản hiện có.
- Xử lý video không tồn tại, không cho nhúng, autoplay bị chặn, mạng lỗi và player chưa sẵn sàng. Cấu hình origin/referrer phù hợp khi tích hợp, không che hoặc giả lập giao diện/quảng cáo của player.

## 8. Thứ tự triển khai và bàn giao

1. **Duyệt thiết kế:** mockup thư viện và màn học; desktop/mobile, sáng/tối. Dùng bố cục video + transcript làm chuẩn trước khi sửa web thật.
2. **Bản cốt lõi:** tuyển chọn 6–10 bài; video nhúng, transcript đồng bộ, bật/tắt ba lớp, tua bằng câu, tốc độ, lặp và dừng cuối câu.
3. **Luồng luyện:** nối recorder/nghe lại, tiến độ, học tiếp, phím tắt, nhiệm vụ và XP; bảo toàn cơ chế tài khoản hiện có.
4. **Nghiệm thu:** tua nhanh/liên tục, đổi tốc độ, khoảng trống phụ đề, autoplay, buffering, video lỗi, đổi bài khi đang thu, đổi tài khoản, Back/Forward, IME, bàn phím, giảm chuyển động và thiết bị thật.

Chỉ nghiệm thu khi đổi lớp chữ không làm video khởi động lại, transcript theo đúng mốc sau khi tua, cuộn tay không bị giành lại, không thu âm ngoài ý muốn và không cộng XP từ việc xem đơn thuần.

Đề nghị ưu tiên giai đoạn 1–2 để làm thật tốt trải nghiệm **xem video + đọc lời thoại + nghe từng câu**. Chưa thêm chấm điểm tự động hoặc tính năng dán link tùy ý trong bản đầu.
