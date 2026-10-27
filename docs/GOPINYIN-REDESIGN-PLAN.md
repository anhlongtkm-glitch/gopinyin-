# GoPinyin — kế hoạch tổng thể: Luyện tập chung, ngọc bích, be sáng và tối sâu

## Cập nhật yêu cầu ngày 27/10/2026 — ưu tiên áp dụng

Các quyết định dưới đây thay thế những mô tả cũ về HSK 1, AI, Thanh điệu và Shadowing trong phần lịch sử phía sau:

- **Học bằng AI** có trên menu chính desktop, mục Thêm trên mobile và Tổng quan. Chọn câu, từ vựng hoặc cả hai theo prompt; tiếp tục tự sinh khi còn dưới ba mục, có lưu/học tiếp và nút thử lại khi gặp lỗi.
- AI dùng Gemini qua `/api/ai` với key chung giữ trên server. Cần đặt `AI_KEY_GEMINI`; người học không phải lấy key. Miễn phí theo hạn mức provider; không tự chuyển sang model trả phí. Chi tiết vận hành xem [AI-SHARED-SETUP.md](AI-SHARED-SETUP.md).
- Bỏ toàn bộ màn Thanh điệu và Shadowing, gồm video, thu âm riêng, lối vào, nhiệm vụ và huy hiệu tương ứng. Link cũ về Bài khóa; XP lịch sử được giữ.
- Bài khóa có **18 hội thoại**: sáu bài HSK 1 viết lại, mỗi bài 12 lượt lời; sáu bài HSK 2, mỗi bài 14 lượt; sáu bài HSK 3, mỗi bài 16 lượt. Đủ người nói, Hán, Pinyin, dịch Việt, từ cần nhớ và ba câu hiểu bài.
- Danh mục luyện tập HSK 1 dùng đủ **301 câu gốc**, chia **Chặng 01–06** giống các cấp khác. Tổng số câu của sáu chặng phải bằng bộ HSK 1; không lấy sáu bài khóa để thay bộ câu gốc.
- Bài khóa có dataset luyện tập riêng theo cấp và phiên bản. Tiến độ câu cũ không được gán sang hội thoại đã viết lại; các bộ đã lưu vẫn học tiếp được.
- Chữ và placeholder trong ô nhập luyện gõ căn giữa, chừa khoảng trống hai bên bằng nhau để nút bàn phím không làm lệch tâm.
- Luyện nói tự đọc mẫu một lần khi vào câu mới. Mặc định tốc độ **1.0**, ưu tiên giọng **Google Mandarin**; khi thiết bị không có giọng Google, dùng giọng nữ tiếng Trung khả dụng. Lựa chọn rõ ràng của người dùng được ghi nhớ cho các chế độ học.
- Không đọc mẫu trễ sang câu khác, sau khi rời màn hoặc trong lúc thu âm. Không đọc lại chỉ vì mở thiết lập hoặc cập nhật giao diện.

## Lịch sử thiết kế trước cập nhật 27/10/2026

**Trạng thái:** đã được người dùng duyệt và bắt đầu triển khai vào ứng dụng. Chi tiết phạm vi đã làm và phần cần nghiệm thu trước phát hành xem [GOPINYIN-REDESIGN-IMPLEMENTATION.md](GOPINYIN-REDESIGN-IMPLEMENTATION.md). Tài liệu này giữ vai trò quy chuẩn mục tiêu.

## Chuẩn bố cục bắt buộc sau phản hồi của người dùng

Người dùng yêu cầu sửa lại toàn diện vì bản triển khai đầu vẫn giữ kết cấu cũ. **Ảnh trong `design-review/jade-typing/` là nguồn đối chiếu bố cục**, không được diễn giải kế hoạch thành việc chỉ đổi màu, thêm gấu hoặc thêm thẻ vào sidebar cũ.

- Khung desktop là **menu ngang**, logo trái, điều hướng giữa, tài khoản/công cụ bên phải; bỏ sidebar dọc và thanh tiêu đề lặp. Nội dung rộng tối đa 1.360px, lề 40px ở màn 1.440px để khớp ảnh duyệt.
- Tổng quan: hero gấu lớn bên phải / lời giới thiệu và CTA bên trái → dải chọn HSK/chủ đề → nhiệm vụ dạng hàng cạnh thẻ level gấu → kỹ năng cạnh thẻ Game. Thống kê phụ không đẩy nội dung chính xuống dưới.
- Luyện tập: tiêu đề độc lập → tab/tìm kiếm → chọn cấp HSK → dải học tiếp → lưới nhóm chủ đề/chặng. Giữ kho HSK 1–9 đầy đủ bên dưới; không thay bằng số liệu minh họa.
- Gõ/Nói: chọn bộ ở đầu → tên màn và công tắc chế độ → tiến độ ngang → thẻ học lớn bên trái, gấu/thông tin bộ/phím tắt ở cột phải. Khi có kết quả Nói, cột phải hiển thị phản hồi; mobile xếp phản hồi xuống dưới câu.
- Bài khóa: nội dung và hiểu bài bên trái, từ cần nhớ bên phải. Thanh điệu: bài tập bên trái, gấu/mẹo bên phải. Shadowing: câu/thu âm bên trái, các câu trong bài bên phải.
- Game: dải hạn mức XP → thẻ chơi lớn cạnh thẻ gấu → thẻ ý tưởng mở rộng gọn bên dưới. Gấu: khối nhân vật/level lớn → huy hiệu cạnh mốc phụ kiện → nhiệm vụ/thử thách phụ.
- Các quyết định cập nhật sau bản mẫu vẫn có hiệu lực: gộp Gõ/Nói, nền be rất nhạt, tối sâu, năm đích điều hướng mobile, dữ liệu thật và hai bộ chấm độc lập. Không đưa nhãn “bản mẫu”, điểm hoặc tiến độ giả vào ứng dụng.

Ảnh đối chiếu và ảnh web thật sau sửa: [approved-implementation](../design-review/approved-implementation/index.html). Kiểm tra cấu trúc bằng `tests/approved-layout.cjs`, cùng các kiểm tra nghiệp vụ hiện có.

## 1. Những quyết định đã chốt

**Đề xuất Shadowing mới đang chờ duyệt:** [Shadowing Video — YouTube + transcript đồng bộ](SHADOWING-YOUTUBE-PLAN.md). Theo yêu cầu mới, định hướng màn Shadowing sẽ chuyển sang video YouTube, bản chép cạnh video, ẩn/hiện Hán/Pinyin/dịch. Chưa thay mã ứng dụng ở bước lập kế hoạch này.

- Giữ bố cục sinh động của Plan A: gấu 3D, thẻ minh họa, nhiệm vụ nhỏ, thành tích và hành động tiếp theo rõ ràng.
- Xanh ngọc bích của logo là màu nhận diện; nền sáng đổi sang be rất nhạt. Có giao diện tối sâu hoàn chỉnh.
- Gộp danh mục Luyện gõ và Luyện nói vào **Luyện tập**. Chọn HSK/chủ đề một lần, chuyển **Gõ / Nói** bên trong cùng bộ.
- Luyện gõ vẫn là hoạt động ưu tiên: mặc định cho bộ mới, có lối tắt riêng ở Tổng quan, giữ tự chấm và toàn bộ công cụ hiện tại.
- Giữ đầy đủ HSK và Game riêng. Có Bài khóa, Thanh điệu, Shadowing, nhiệm vụ, thử thách, huy hiệu và gấu lên level.
- Nội dung mới thí điểm ở HSK 1, GoPinyin biên soạn; giọng tổng hợp được duyệt. Đánh giá âm tự động làm sau đợt luyện có hướng dẫn.
- Mỗi sự kiện chuyển màn, hoàn thành nhiệm vụ và đạt thành tích có phản hồi hình ảnh riêng. Hoạt họa phục vụ trình bày, không quyết định điểm hoặc thao tác học.

## 2. Thiết kế sáng / tối và hệ thành phần

| Vai trò | Sáng — be rất nhạt | Tối — nền sâu |
| --- | --- | --- |
| Nền trang | `#FDFBF6` | `#070D0B` |
| Nền thẻ | `#FFFFFF` | `#101B17` |
| Nền nổi / bảng phụ | `#F6F1E6` | `#17261F` |
| Ngọc bích nhận diện | `#0BA488` | Giữ màu logo; dùng điểm nhấn sáng hơn khi cần tương phản |
| Nút chính | `#087D69`, chữ trắng | `#42CBA7`, chữ `#062D23` |
| Nền ngọc bích phụ | `#E0F3EB` | `#14372C` |
| Matcha phụ | `#EBF0DE` | `#293522` |
| Chữ chính | `#223D31` | `#EDF6ED` |
| Chữ phụ | `#596F60` | `#B7CBBC` |
| Viền | `#DDE7DC` | `#294135` |

- Be sáng là nền chính; be đậm và matcha chỉ dùng ở khối phụ. Màu ngọc bích nhấn CTA, tiến độ, trạng thái và nhận diện gấu.
- Bản tối có bộ token riêng cho thẻ, input, popover, biểu đồ, bóng, disabled và focus; không đảo màu máy móc từ bản sáng.
- Giữ logo gốc. Khi nền tối làm phần chữ logo khó đọc, đặt trên một vùng sáng nhỏ có khoảng thở, không tự đổi màu logo.
- Manrope cho tiêu đề; Be Vietnam Pro cho giao diện/Pinyin; Noto Sans SC cho chữ Hán. Nội dung chính 16px, nhãn điều khiển 14px. Hán/Pinyin/nghĩa: desktop 40/17/18px, mobile 30/14/16px.
- Vùng nội dung tối đa 1.180px; nhịp khoảng cách 8/16/24/32px; thẻ bo 20–24px; nút chính cao 48px, vùng bấm còn lại tối thiểu 44px.
- Giữ lựa chọn sáng/tối hiện có theo tài khoản trình duyệt; chưa có lựa chọn thì theo hệ điều hành. Đổi theme không đổi câu, focus hoặc nội dung nhập.

## 3. Điều hướng và hợp nhất Gõ / Nói

### Điều hướng

**Desktop:** menu ngang Tổng quan · Luyện tập · Bài khóa · Thanh điệu · Shadowing · Game · Gấu của bạn. AI và Xếp hạng ở Công cụ; tài khoản ở phía phải header.

**Điện thoại:** Tổng quan · Luyện tập · Game · Gấu · Thêm. Trong Thêm có lối vào trực tiếp Bài khóa, Thanh điệu, Shadowing, AI và Xếp hạng. Giữ focus trap, Escape, trả focus và hành vi tạm dừng Game khi mở bảng.

### Danh mục Luyện tập

**Luyện tập → Theo HSK / Theo chủ đề → Chọn bộ → Gõ / Nói.**

- Một thư viện dùng chung nội dung, tìm kiếm và bộ lọc. Mỗi thẻ hiển thị tên, cấp/chủ đề, số mục, hai tiến độ Gõ/Nói và hành động Học tiếp.
- Lần đầu mở bộ dùng chế độ Gõ; những lần sau nhớ chế độ gần nhất của chính bộ đó. Không thêm màn bắt buộc hỏi Gõ hay Nói trước mỗi lượt học.
- Trong thẻ có hai lối tắt Gõ/Nói để người dùng chọn vào thẳng nếu muốn.
- Giữ các cấp HSK hiện có. Chủ đề cũ chưa có cấp HSK vẫn dùng được; chỉ lọc theo cấp với nội dung đã được phân loại.
- Quay về danh mục giữ tab, từ khóa, bộ lọc và vị trí cuộn.

### Màn học chung

- Chọn Gõ/Nói ở đầu thẻ, luôn nhìn thấy. Câu, Pinyin và nghĩa có cùng vị trí/cỡ chữ; phần nhập hoặc micro thay đổi theo chế độ.
- Chuyển chế độ giữ **cùng câu**, cài đặt hiển thị và nháp gõ theo từng câu. Khi quay lại Gõ, khôi phục nháp cùng vị trí con trỏ; không chèn nháp của câu cũ vào câu mới.
- Tiến độ, điểm và kết quả Gõ/Nói vẫn độc lập. Hoàn thành Gõ không tự đánh dấu Nói đã hoàn thành.
- Đang ghi âm mà chuyển chế độ: kết thúc lượt bằng luồng dừng hiện có, giữ kết quả theo câu, giải phóng micro; chuyển giao diện không chờ hiệu ứng ăn mừng. Tác vụ cũ không được ghi kết quả vào câu/bộ mới.
- Đổi bộ, Back/Forward, đăng nhập tiếp tục bài và link cũ phải đi qua bộ điều phối điều hướng hiện có, tránh mở lại lựa chọn đã hủy.
- Giữ phím 1 Hán, 2 Pinyin, 3 nghĩa, 4 nghe, 5 tiếp, 0 Gõ/Nói và ? hướng dẫn. Enter trong Gõ sang câu khi đúng; trong Nói bắt đầu/dừng. Enter/Space trên điều khiển được chọn bằng Tab giữ hành vi gốc.
- Tùy chọn vẫn là bảng ba tab ngay trong màn hình. Mở/đóng bảng giữ nháp, câu, thiết lập và vị trí đọc; không có focus hoặc cuộn trễ giành lại thao tác.

### Tổng quan

Thứ tự: lời chào và **Tiếp tục luyện gõ** → chọn nhanh HSK/chủ đề → nhiệm vụ hôm nay → level/phần thưởng gấu → ôn tập và kỹ năng khác. Giữ lối học tiếp hoạt động gần nhất ở khối phụ để người đang luyện Nói/Shadowing vẫn tiếp tục nhanh.

## 4. Cập nhật các khu vực còn lại

| Khu vực | Thay đổi |
| --- | --- |
| Bài khóa | Sáu bài gốc HSK 1: chào hỏi, giới thiệu, gia đình, số/giờ, gọi món, sinh hoạt. Mỗi bài 6–10 câu, từ mới, cấu trúc, ba câu hiểu bài, hai đoạn Shadowing và audio có mốc câu/cụm. Câu được chuyển thẳng sang Luyện tập bằng cùng định danh nội dung |
| Thanh điệu | Bốn thanh, thanh nhẹ, cặp dễ nhầm và biến điệu cơ bản; nghe phân biệt, hướng dẫn và ghi âm nghe lại. Đường thanh mẫu được ghi rõ là mẫu. Bài chọn đáp án dùng mũi tên/Enter; phím tắt nền không chiếm thao tác |
| Shadowing | Nghe cụm → luyện nhại → nói đuổi theo mẫu; tốc độ 0.75×/1×, lặp đoạn, mẫu/bản ghi tách rõ. Sóng âm của web thật lấy từ âm thanh thực; không giả sóng thành điểm thanh điệu |
| Game | Sảnh và tiến độ riêng, giữ Game bắn chữ; có nhiệm vụ/Game XP. Trò chưa triển khai được ghi đúng trạng thái dự kiến. Rời màn hoặc mở bảng thực hiện tạm dừng theo luồng hiện có |
| Gấu | Level, thanh XP, huy hiệu, phụ kiện và các mốc sắp mở. Giữ tạo hình gấu gốc; phụ kiện được sản xuất đồng nhất, có phiên bản ảnh nhỏ cho mobile |
| AI | Giữ chức năng hiện có; đơn giản hóa luồng nhập yêu cầu → tạo bài → học/lưu, trạng thái và lỗi gần thao tác. Không tự mở rộng sang AI hội thoại trong đợt thí điểm |
| Xếp hạng | Giữ truy cập từ công cụ phụ, cùng hệ màu/thẻ; không dùng level gấu như chứng chỉ trình độ HSK |
| Tài khoản / hộp thoại | Đồng bộ theme, chữ, nút, trạng thái đồng bộ và thông báo lỗi. Giữ API, đăng nhập và cơ chế bảo vệ tài khoản hiện có |

## 5. Hệ hiệu ứng khích lệ dùng chung

| Sự kiện | Hiệu ứng được thiết kế | Thời lượng mục tiêu |
| --- | --- | --- |
| Chuyển màn thành công | Nội dung hiện nhẹ, dịch tối đa 6px; điều hướng cập nhật ngay. Gấu đổi tư thế phù hợp màn | 180–240ms |
| Đổi Gõ/Nói | Thanh chọn dịch ngắn; vùng thao tác đổi nhẹ, câu và bố cục đứng yên | 120–160ms |
| Gõ đúng / kết quả đạt | Dấu đúng, phản hồi và gấu giơ ngón cái; tiến độ cập nhật ngay | 350–450ms |
| Lỗi đầu tiên trong câu | Gấu động viên, chỉ ra phần cần sửa; không lặp phản ứng mỗi lần gõ | 250–350ms |
| Hoàn thành nhiệm vụ | Thẻ tích dấu, thanh tiến độ hoàn tất, gấu vỗ tay và nhãn +XP; hạt nhỏ trong vùng thẻ | 600–900ms |
| Hoàn thành bài/phiên | Thẻ tổng kết, gấu nhảy mừng, xuất hiện kết quả và việc nên làm tiếp | 800–1.200ms |
| Nhận huy hiệu | Huy hiệu mở ra với viền sáng một lượt, gấu ôm sao/nâng cúp; ghi rõ điều kiện vừa đạt | 800–1.200ms |
| Gấu lên level | Hiện level cũ → mới, thanh XP và phụ kiện vừa mở; gấu ăn mừng nổi bật nhất | 1.200–1.500ms |
| Kỷ lục Game / thử thách | Nhấn mạnh con số kỷ lục, huy hiệu cúp và phản ứng gấu trong màn kết quả | 700–1.000ms |

### Quy tắc vận hành

- Mỗi điều hướng đã chốt và mỗi sự kiện thành tích chỉ phản ứng một lần. Render lại, mở Tùy chọn, đồng bộ hoặc khôi phục trang không tự phát lại ăn mừng.
- Phản hồi Câu tiếp, XP và kết quả dùng được ngay; không đợi hoạt họa kết thúc. Lớp trang trí không bắt chuột và không giành focus.
- Khi nhiều phần thưởng đến cùng lúc, hiển thị một thẻ tổng hợp có đủ nhiệm vụ/huy hiệu/level; chỉ chạy hoạt họa lớn nhất theo thứ tự level → huy hiệu → nhiệm vụ → câu đúng.
- Đang gõ, dùng IME hoặc chọn đáp án thì giữ gấu tĩnh. Phần thưởng được báo ở vùng phụ hoặc lúc chốt câu, không chen lên ô nhập. Không xếp hàng nhiều hoạt họa để phát dồn.
- Chuyển sang màn khác thay hiệu ứng chuyển màn cũ; hiệu ứng kết quả thuộc màn cũ được hủy, phần thưởng đã xác nhận vẫn nằm trong lịch sử.
- Âm thanh khích lệ mới mặc định tắt, có công tắc riêng; luôn im khi nghe mẫu, ghi âm hoặc Shadowing. Giữ thiết lập giọng đọc/âm gõ hiện có.
- Có ba mức chuyển động: Theo hệ thống / Giảm / Tắt. Giảm/Tắt vẫn có chữ, dấu đúng, XP và trạng thái tĩnh. Đây cũng là hướng hỗ trợ lựa chọn chuyển động trong [hướng dẫn W3C](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
- Giới hạn hiệu ứng hạt: tối đa 60 hạt desktop, 24 hạt mobile, tự kết thúc trong 1.500ms; dừng khi tab bị ẩn. Không dùng hiệu ứng chớp hoặc trang trí lặp liên tục.
- Tái sử dụng mascot/confetti hiện có qua một bộ điều phối, cùng màu token ở cả hai theme; hiệu ứng không thay đổi nội dung học hoặc tạo XP.

## 6. Nhiệm vụ, XP và gấu

- Ba nhiệm vụ mỗi ngày: Luyện gõ HSK, luyện âm và một hoạt động tự chọn. Một thử thách tuần kết hợp học nhiều ngày và hoàn thành nội dung.
- Hoạt động thông thường cũng được tính; người dùng không phải bấm nhận nhiệm vụ trước. Game là tùy chọn, không bắt buộc để học tiếp.
- XP khởi đầu: câu Gõ đúng 3; bộ năm câu nghe thanh điệu 10; đoạn Shadowing hợp lệ 5; bài khóa đạt ít nhất 2/3 câu hiểu bài 20; nhiệm vụ ngày 5; ván Game hoàn thành 10.
- XP Game tối đa 20/ngày, bao gồm phần thưởng nhiệm vụ bắt nguồn từ Game; hết hạn mức vẫn chơi được. Một nội dung nhận XP hoạt động một lần/ngày.
- Level 1–20; XP từ level L lên level kế tiếp là `100 + 25 × (L − 1)`. Mốc 5/10/15/20 mở mũ học viên, túi đeo, ghim sao và bộ phụ kiện khám phá.
- Sáu huy hiệu đầu: phiên đầu, 20 câu Gõ khác nhau, buổi thanh điệu đầu, năm đoạn Shadowing khác nhau, bài khóa đầu và học năm ngày khác nhau.
- Level mở ngoại hình/thử thách phụ; các cấp HSK và kỹ năng luôn tự chọn. Nghỉ học không trừ level hoặc tước phụ kiện.
- Lịch sử cũ tiếp tục phục hồi tiến độ học; XP mới tính từ các sự kiện sau khi hệ phần thưởng được bật để tránh tự cộng lại toàn bộ lịch sử.

## 7. Tích hợp và tương thích

- Giữ JavaScript thuần, ID/data-attribute của bộ điều khiển, API và khóa tiến độ cũ. Hợp nhất thư viện và khung trình bày trước; hai bộ chấm Gõ/Nói tiếp tục độc lập.
- Bổ sung `PracticeContext` dùng chung: nguồn/bộ, câu hiện tại, chế độ và nháp gõ theo câu. Bộ chuyển đổi ánh xạ các nguồn HSK/chủ đề hiện có; không đổi ID câu chỉ để phân nhóm giao diện.
- Thêm route Luyện tập có chế độ; route/link cũ vào Gõ/Nói được chuyển về cùng luồng với chế độ tương ứng. Auth pending action và Back/Forward giữ cơ chế điều hướng có kiểm tra phiên hiện hành.
- Các chế độ phát `ActivityCompleted`; bộ nhiệm vụ/phần thưởng xác nhận sự kiện rồi mới phát `CelebrationEvent`. Dữ liệu hoàn thành, XP và huy hiệu chống xử lý trùng khi gửi lại hoặc đồng bộ nhiều tab/thiết bị.
- Lưu tiến độ các kỹ năng và lựa chọn chế độ theo bộ vào kho tài khoản hiện có. Hiệu ứng lưu trạng thái đã hiển thị riêng, không làm thay đổi điểm.
- Audio mẫu biên soạn thành file có thời điểm câu/cụm; đánh giá âm chuyên sâu là đợt sau qua adapter `/api/pron` hiện có. Chỉ hiện chỉ số thực sự hỗ trợ; độ khớp chữ không được đặt tên thành điểm thanh điệu.
- Mặc định bản ghi luyện không lưu cloud; đổi màn giải phóng micro. Khôi phục phiên không tự xin quyền hoặc tự ghi âm.

## 8. Thứ tự triển khai và bàn giao

1. **Duyệt giao diện mới:** ảnh Tổng quan, danh mục chung HSK/Chủ đề, màn Gõ/Nói, Game, Gấu; cả sáng be nhạt và tối sâu. Bản động minh họa chuyển màn, nhiệm vụ, huy hiệu và lên level.
2. **Hệ thành phần:** token hai theme, chữ, nút, thẻ, form, dialog, menu và vùng mascot; gỡ các override cũ tương ứng, tránh chồng thêm lớp CSS.
3. **Gộp Luyện tập:** thư viện chung, chế độ nhớ theo bộ, giữ cùng câu/nháp, hai tiến độ và tương thích route cũ. Kiểm tra gõ/nói hiện có trước khi thêm chức năng mới.
4. **Đồng bộ mọi màn:** Tổng quan, Game, AI, Xếp hạng, tài khoản và công cụ phụ dùng cùng hệ trình bày và điều hướng.
5. **Bộ thí điểm:** sáu bài khóa HSK 1, âm thanh đã duyệt, Thanh điệu và Shadowing có hướng dẫn.
6. **Gấu và phần thưởng:** dữ liệu nhiệm vụ/XP/huy hiệu, phụ kiện, bộ điều phối hiệu ứng và thiết lập âm thanh/chuyển động.
7. **Nghiệm thu:** kiểm thử nghiệp vụ, dữ liệu cũ và hiệu năng; bàn giao ảnh trước/sau, video hiệu ứng ngắn và quy chuẩn. Mở tính năng mới theo từng nhóm để có thể tắt phần mới mà không ảnh hưởng Luyện tập cũ.

## 9. Tiêu chí nghiệm thu

- Điện thoại vào Luyện tập hoặc Game bằng một chạm. Sau chọn bộ, Gõ/Nói hiện ngay; các kỹ năng trong Thêm tối đa hai chạm.
- Lối Tiếp tục luyện gõ ở Tổng quan đến đúng câu kế tiếp; chuyển chế độ không mất nháp, không nhập nháp sai câu và không trộn tiến độ hai kỹ năng.
- Kiểm tra HSK/chủ đề, bộ đã lưu/AI, từ khóa, cuộn danh mục, đăng nhập tiếp tục một lần, Back/Forward, câu cuối và bấm nhanh.
- Kiểm tra IME, phím 1–5/0/Enter, Tab/Shift+Tab/Escape, focus trap và tác vụ autofocus/cuộn trễ.
- Kiểm tra 360/390/768/1024/1440px, màn ngang thấp, zoom 200%, bàn phím ảo và cả sáng/tối. Nội dung dài cuộn tự nhiên; Tùy chọn gọn trong màn hình thường dùng, còn tiếp cận được khi zoom.
- Hiệu ứng không chặn thao tác, không cộng XP, không chạy lặp khi render/đồng bộ, không phát âm chồng ghi âm. Kiểm tra nhiều thành tích cùng lúc, chuyển màn giữa hiệu ứng, giảm chuyển động, tắt chuyển động và ảnh tải lỗi.
- Kiểm tra mất mạng, xung đột đồng bộ, đổi tài khoản, gửi lại sự kiện thưởng và giới hạn XP Game theo ngày.
- Chạy `npm.cmd test` và `npm.cmd run test:build`; bổ sung kiểm tra hợp nhất chế độ, sự kiện phần thưởng và hiệu ứng. Kiểm chứng micro/IME/âm thanh trên thiết bị thật trước phát hành.
- Theo dõi bắt đầu/hoàn thành phiên, quay lại học, lỗi micro và lỗi thưởng trùng; dùng số liệu thí điểm làm căn cứ mở rộng nội dung và đánh giá âm tự động.


## 10. Shadowing Video — cập nhật để duyệt

Thay lối vào Shadowing bằng thư viện video YouTube HSK 1–4 và chủ đề giao tiếp; giữ luyện theo bài khóa ở lối riêng. Đã tích hợp player, công cụ bản chép/thu âm/chính tả, route và tiến độ tài khoản. Danh mục có 14 video, bản chép đồng bộ chưa được đóng gói và phải nhập riêng; không gán hội thoại mẫu vào video thật. Xem [phạm vi, giới hạn và cách duyệt](SHADOWING-VIDEO-REVIEW.md), [nguồn video](SHADOWING-VIDEO-CATALOG.md). Người dùng đã duyệt commit/push; xem thêm [đợt dọn mã và cấu trúc](CODE-CLEANUP.md).
