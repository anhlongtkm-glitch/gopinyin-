# GoPinyin — ba phương án thay đổi toàn bộ trải nghiệm

> **Kế hoạch hiện hành:** [Plan A tổng thể — Luyện tập chung, ngọc bích, be sáng và tối sâu](../../docs/GOPINYIN-REDESIGN-PLAN.md). Đã chốt gộp Gõ/Nói, làm mới mọi màn và hệ hiệu ứng khích lệ. Nội dung bên dưới được giữ làm lịch sử ba phương án ban đầu.

Đây là **ba phương án để lựa chọn**, chưa áp dụng vào web đang chạy. Ảnh được dựng từ HTML/CSS riêng với gấu thương hiệu hiện có. Số liệu, nhiệm vụ, phần thưởng, sổ tay và hội thoại đều là dữ liệu minh họa. Các tương tác trong bản mẫu không truy cập micro, không gọi AI và không lưu dữ liệu tài khoản.

## Những gì cả ba phương án cùng giữ

- Gấu xanh 3D và tên GoPinyin, xuất hiện theo ngữ cảnh học thay vì chỉ trang trí đầu trang.
- Tự chọn HSK/chủ đề; đề xuất học không khóa lộ trình tự chọn.
- Hai cách luyện Gõ/Nói chung bố cục: **chữ Hán → Pinyin → nghĩa Việt**.
- Phím **1 Hán · 2 Pinyin · 3 nghĩa · 4 nghe · 5 câu tiếp**, **Enter nói/dừng** trong luyện nói, **0 đổi Gõ/Nói**. Trong web thật vẫn phải bảo toàn IME, kiểm tra hoàn tất và hành vi Tab/Enter gốc.
- Tùy chọn là bảng ba tab trong màn hình; chữ và thao tác học không phụ thuộc mascot tải thành công.
- Màn học trên điện thoại ưu tiên tập trung: quay lại ở đầu màn và chuyển Gõ/Nói tại chỗ; thanh điều hướng đầy đủ ở các màn khám phá.

## Phương án 01 — Gấu Phiêu Lưu

**Ý tưởng:** một thế giới nhỏ có gấu dẫn đường; mỗi bài là một chặng có thể hoàn thành. Phù hợp khi ưu tiên thu hút người mới và tăng nhận diện thương hiệu.

**Thiết kế:** nền xanh sáng, khối minh họa lớn, đường hành trình mềm, điểm nhấn vàng, nút có đế nhẹ, chữ Manrope/Be Vietnam Pro khỏe và thân thiện. Gấu vẫy chào ở tổng quan, hướng dẫn trong bài và chúc mừng khi hoàn thành. Có nhiều khoảng trống quanh câu học, không phủ nhân vật lên ô nhập.

**Luồng chính:** chọn chặng hoặc HSK → phiên 10 phút → Nghe/Gõ/Nói → tổng kết → mở huy hiệu. Người muốn học tự do vẫn đi từ Khám phá.

| Thao tác với chức năng | Đề xuất cụ thể | Thay đổi người dùng nhìn thấy |
| --- | --- | --- |
| Thêm | Phiên học kết hợp Nghe → Gõ → Nói | Một nút bắt đầu, không phải vào ba khu riêng |
| Thêm | Nhiệm vụ nhỏ và bộ sưu tập huy hiệu/đạo cụ cho gấu | Kết thúc bài có mục tiêu và phần thưởng rõ |
| Mở rộng | Lộ trình HSK thành các chặng theo tình huống | Biết đang ở đâu và bài tiếp theo là gì |
| Gom | Game thành thử thách ngắn sau phiên, có thể bỏ qua | Bỏ màn sảnh game khỏi điều hướng chính |
| Gom | AI tạo câu vào phần mở rộng bài/chặng | Không đặt trình cấu hình AI ngang hàng với Học tiếp |
| Giảm | Bảng xếp hạng công khai không nằm ở trang đầu; thi đua là tùy chọn | Giảm áp lực so sánh; ưu tiên tiến bộ cá nhân |

**Điều hướng mới:** Hành trình · Khám phá · Bộ sưu tập · Cá nhân.

**Ảnh:** [tổng quan desktop](adventure-dashboard.png), [màn học desktop](adventure-study.png), [tổng quan điện thoại](adventure-mobile-dashboard.png), [màn học điện thoại](adventure-mobile-study.png).

**Triển khai sau khi chọn:** thiết kế lại hệ thành phần và các màn chung → gắn lộ trình vào danh mục HSK hiện có → điều phối ba kiểu luyện trong một phiên → thêm dữ liệu nhiệm vụ/phần thưởng → kiểm thử khôi phục phiên, đăng nhập, IME và bàn phím.

**Đổi lại:** cần xây thêm bộ điều phối phiên và dữ liệu phần thưởng. Hình ảnh đa dạng cần kiểm soát dung lượng; không dùng animation lặp hoặc bắt đợi hiệu ứng. Mục tiêu ngày tự điều chỉnh được, không phạt người học vì nghỉ.

## Phương án 02 — Jade Studio

**Ý tưởng:** không gian học như một cuốn sổ được biên tập kỹ: ấm, có chiều sâu và dành cho người học nghiêm túc. Phù hợp khi muốn nhìn chuyên nghiệp, trưởng thành hơn nhưng vẫn giữ gấu.

**Thiết kế:** nền giấy ngà, khối xanh rừng đậm, điểm nhấn đồng nhạt, chữ tiêu đề serif và nội dung sans-serif. Dùng bố cục bất đối xứng, đường kẻ, mục lục và thẻ sổ tay; giảm những hộp trắng giống nhau. Mascot đọc sách xuất hiện như người bạn học, không chiếm vai trò của nội dung.

**Luồng chính:** chọn mục tiêu/thời gian → Hôm nay của bạn → Ôn đến hạn → học câu mới bằng Nghe/Gõ/Nói → lưu điều đáng nhớ vào Sổ tay.

| Thao tác với chức năng | Đề xuất cụ thể | Thay đổi người dùng nhìn thấy |
| --- | --- | --- |
| Thêm | Kế hoạch phiên theo mục tiêu HSK và thời gian rảnh | Ba việc cần làm đã được sắp thứ tự |
| Thêm | Sổ tay gom từ lưu, câu yêu thích và lỗi cần xem lại | Không phải tìm ở nhiều bảng khác nhau |
| Mở rộng | Ôn đến hạn/câu sai hiện có thành hàng đợi ôn có giải thích | Biết vì sao câu này xuất hiện hôm nay |
| Thêm | Tóm tắt tuần theo thời gian và kỹ năng | Dễ xem mình tiến bộ ở đâu, không chỉ thấy combo |
| Gom | Thư viện HSK/chủ đề/bộ đã lưu thành một nơi có tìm kiếm và bộ lọc | Chọn nội dung ít bước hơn |
| Giảm | Game và xếp hạng rời khỏi điều hướng chính; có thể giữ trong mục tùy chọn | Bớt phân tán với người chỉ muốn học |
| Gom | AI thành công cụ “Tạo bài theo nhu cầu” trong Thư viện | Không cần đọc cấu hình kỹ thuật trước khi học |

**Điều hướng mới:** Hôm nay · Thư viện · Sổ tay · Cá nhân.

**Ảnh:** [tổng quan desktop](jade-dashboard.png), [màn học desktop](jade-study.png), [tổng quan điện thoại](jade-mobile-dashboard.png), [màn học điện thoại](jade-mobile-study.png).

**Triển khai sau khi chọn:** hệ chữ/màu và trang Hôm nay → hợp nhất tìm kiếm/thư viện → tạo Sổ tay dùng khóa định danh nội dung ổn định → nâng cấp xếp hàng ôn → báo cáo tuần. Ưu tiên tận dụng tiến độ và lịch ôn hiện có.

**Đổi lại:** ít yếu tố chơi hơn phương án 01. Cần thiết kế trạng thái trống tốt cho người chưa có lịch sử; chưa đủ dữ liệu thì dùng kế hoạch khởi đầu, không giả vờ cá nhân hóa.

## Phương án 03 — Neon Lab

**Ý tưởng:** phòng luyện giao tiếp hiện đại. Cảm giác công cụ sáng tạo và luyện kỹ năng, với tình huống, nhịp nói và phản hồi làm trung tâm. Phù hợp khi muốn sản phẩm khác biệt và ưu tiên phát âm/giao tiếp.

**Thiết kế:** nền xanh đêm, thẻ sắc nét, tím nhạt và xanh lime làm điểm nhấn. Typography lớn, khối chữ Hán như poster, khu luyện nói riêng với dạng sóng và các cụm câu. Gấu đeo tai nghe/cầm micro, giúp liên kết bản sắc 3D với không gian công nghệ.

**Luồng chính:** chọn tình huống → nghe lượt mẫu → nói theo cụm → nói cả câu/nhập vai → xem điều nên luyện lại → lưu câu để gõ ôn.

| Thao tác với chức năng | Đề xuất cụ thể | Thay đổi người dùng nhìn thấy |
| --- | --- | --- |
| Thêm | Tình huống có vai và lượt hội thoại | Học cách dùng câu trong quán trà, chuyến đi, gặp bạn |
| Thêm | Shadowing: nghe cụm → bắt nhịp → ghi lại | Dễ bắt đầu hơn nói nguyên câu dài ngay lập tức |
| Thêm | Phòng thanh điệu với cặp âm dễ nhầm | Tập trung vào một điểm yếu thay vì chỉ nhận tổng điểm |
| Mở rộng | So sánh bản mẫu và bản ghi của người học | Hai nguồn âm thanh rõ ràng, không nằm lẫn trong menu |
| Gom | Luyện gõ thành “Gõ để nhớ” trong cùng tình huống | Không phải chọn lại bộ câu khi đổi kỹ năng |
| Giảm | Game bắn chữ và bảng xếp hạng không còn ở luồng chính | Thử thách giao tiếp thay vai trò trò chơi độc lập |
| Gom | AI thành tạo/đóng vai trong tình huống | Hiện trạng thái và lỗi tại cuộc hội thoại, không đưa thông số nhà cung cấp ra màn học |

**Điều hướng mới:** Không gian luyện · Tình huống · Tiến bộ · Cá nhân.

**Ảnh:** [tổng quan desktop](neon-dashboard.png), [màn học desktop](neon-study.png), [tổng quan điện thoại](neon-mobile-dashboard.png), [màn học điện thoại](neon-mobile-study.png).

**Triển khai sau khi chọn:** thiết kế phòng luyện và tình huống biên soạn sẵn → nghe theo cụm/so sánh hai bản âm thanh → lưu câu để ôn gõ → thử nghiệm AI hội thoại → đánh giá dịch vụ chấm âm tiết/thanh điệu trước khi hiển thị điểm chi tiết.

**Đổi lại:** mức thay đổi chức năng cao nhất. Phản hồi thanh điệu chính xác cần kiểm chứng bằng dịch vụ phân tích âm thanh phù hợp; nhận dạng ra chữ không đồng nghĩa chấm đúng từng âm. Dạng sóng trong ảnh là minh họa, không phải kết quả phân tích thật. AI hội thoại có độ trễ và chi phí sử dụng, nên giai đoạn đầu dùng tình huống biên soạn sẵn.

## So sánh để quyết định

| Tiêu chí | 01 Gấu Phiêu Lưu | 02 Jade Studio | 03 Neon Lab |
| --- | --- | --- | --- |
| Cảm giác | Vui, sinh động, dễ tiếp cận | Trưởng thành, ấm, có chiều sâu | Nổi bật, hiện đại, giàu tương tác |
| Trọng tâm | Hình thành thói quen bằng chặng ngắn | Học có kế hoạch và ghi nhớ lâu | Dùng tiếng Trung để giao tiếp |
| Vai trò của gấu | Nhân vật chính của thế giới học | Bạn học và người dẫn lời | Bạn luyện và nhân vật nhập vai |
| Thay đổi chức năng | Vừa: phiên kết hợp + phần thưởng | Vừa: hợp nhất + Sổ tay + lịch học | Cao: tình huống + shadowing + phân tích âm |
| Khả năng tận dụng hệ hiện tại | Cao ở thư viện/bài gõ/nói | Cao nhất ở tiến độ/lịch ôn | Vừa; cần xây thêm luồng giao tiếp |
| Rủi ro cần xử lý | Trang trí quá nhiều, áp lực thưởng | Có thể thiếu vui nếu quá tiết chế | Chi phí/dịch vụ âm thanh và AI |

**Khuyến nghị thiết kế:** chọn **01** nếu ưu tiên giải quyết cảm giác đơn điệu và làm gấu thành thương hiệu rõ nhất. Chọn **02** nếu nhóm người học trưởng thành quan trọng hơn trò chơi. Chọn **03** nếu sẵn sàng đổi định vị thành sản phẩm luyện giao tiếp. Có thể chọn hình ảnh của một phương án và mượn tối đa một mô-đun chức năng từ phương án khác; không trộn ba hệ màu, chữ và cấu trúc cùng lúc.

## Trình tự làm sau khi duyệt

1. Chọn một phương án chủ đạo và chốt những chức năng thêm/gom/bỏ.
2. Dựng lại hệ thành phần, điều hướng và trạng thái sáng/tối theo hướng đã chọn.
3. Làm trọn một luồng: vào web → chọn mục tiêu → học → phản hồi → hoàn thành → học tiếp.
4. Mở rộng sang thư viện, tài khoản và các phần phụ; chuyển dữ liệu có phiên bản nếu thật sự cần đổi schema.
5. Kiểm tra API, đăng nhập, dữ liệu cũ, bàn phím/IME, micro, responsive, giảm chuyển động và hiệu năng.

“Bỏ” trong tài liệu này nghĩa là **đề xuất rút khỏi sản phẩm hoặc điều hướng**, chưa xóa mã hay dữ liệu hiện có. Những chức năng mới trong ảnh chưa được nối vào backend. Giữ nguyên tài khoản/tiến độ cũ là yêu cầu triển khai, không tự ý khởi tạo lại dữ liệu khi đổi giao diện.

## Tham khảo và cách dựng ảnh

- Duolingo, [Building character](https://blog.duolingo.com/building-character/): nhân vật có vai trò trong bài học và phản hồi theo ngữ cảnh.
- Duolingo, [Core tabs redesign](https://blog.duolingo.com/core-tabs-redesign/): thử nhiều hướng bằng prototype, đồng bộ chữ/khoảng cách và cân bằng đơn giản với rõ nghĩa.
- Ba hướng GoPinyin trong tài liệu là đề xuất thiết kế riêng, không sao chép giao diện của Duolingo. Được dựng thủ công theo các quy tắc UX trong skill `ui-ux-pro-max`; công cụ tra cứu Python không chạy được tại môi trường này nên không có kết quả bảng phong cách tự động để viện dẫn.

Mỗi phương án có bốn ảnh màn hình thực của prototype riêng. Bảng ảnh và bản tương tác mở tại `http://localhost:8096/`. Có thể mở `review.html` trực tiếp; `index.html` dùng script và asset tương đối, không phụ thuộc web chính.
