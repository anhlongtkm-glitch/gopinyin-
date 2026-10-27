# GoPinyin — Quy chuẩn giao diện và gấu thương hiệu

## Mục tiêu

Gấu xanh là người bạn học xuyên suốt giao diện. Mỗi lần xuất hiện phải giúp nhận biết màn đang dùng, hiểu trạng thái hoặc khích lệ người học. Người dùng luôn có thể thực hiện hành động tiếp theo ngay, kể cả khi ảnh chưa tải hoặc mascot đang chuyển động.

Tham khảo cách Duolingo xây dựng nhân vật có biểu cảm theo ngữ cảnh và thống nhất hệ thành phần; GoPinyin giữ tạo hình gấu 3D, màu xanh ngọc và cách tự chọn HSK/chủ đề hiện có.

## Màu, chữ và khoảng cách

| Thành phần | Quy chuẩn |
| --- | --- |
| Nền sáng | `#F4F9F5`, thẻ `#FFFFFF`, nền phụ `#F5FAF6` |
| Nền tối | `#0C1E19`, thẻ `#142D26`, nền phụ `#19382F` |
| Nút chính | `#087866`, chữ trắng, đế `#045347` |
| Chữ sáng | Chính `#203C31`, phụ `#425E50` |
| Chữ tối | Chính `#F0FBF5`, phụ `#C2DDD0` |
| Phông chữ | Inter: giao diện/Pinyin; Noto Sans SC: Hán tự; Baloo 2: lời chào/thành tích |
| Cỡ chữ | Nội dung 16px; nhãn điều khiển tối thiểu 14px |
| Khoảng cách | 8, 16, 24, 32px |
| Bo góc | Nút 14px; thẻ 20–24px |
| Vùng nội dung | Tối đa 1.180px, lề thích ứng theo màn hình |

Giá trị được khai báo bằng token ngữ nghĩa trong `src/shared/styles/tokens-base.css`. Thành phần dùng token; không chép màu tùy ý vào CSS tính năng. Kiểm tra độ tương phản độc lập ở cả hai giao diện.

## Nút và tương tác

- Bốn mức nhấn mạnh: chính, phụ, ít nhấn mạnh, nguy hiểm. Mỗi nhóm quyết định có một hành động nổi bật.
- Nút chính cao tối thiểu 48px; vùng bấm nút và biểu tượng tối thiểu 44×44px; khoảng cách tối thiểu 8px.
- Nút chính có đế nổi nhẹ, phản hồi nhấn ngắn và focus rõ. Bỏ ánh sáng quét, bóng nặng và animation lặp.
- Trạng thái đang xử lý phải ngăn gửi trùng; trạng thái vô hiệu hóa phải khác nút có thể bấm. Có nhãn giải thích nếu hành động chưa thể dùng.
- Biểu tượng chức năng dùng SVG đồng bộ và tên truy cập phù hợp. Biểu tượng đặt cạnh nhãn được ẩn khỏi cây truy cập.
- Bàn phím kích hoạt nút, summary, menu theo hành vi gốc. Phím tắt màn học/game chỉ nhận khi không đang thao tác một điều khiển khác hoặc hộp thoại.

## Bộ mascot

Tạo hình chuẩn: gấu trúc lông trắng và xanh ngọc, mắt lớn, khuôn mặt tròn, khăn xanh, chất liệu lông 3D mềm, ánh sáng dịu. Giữ nhận diện giống ảnh tham chiếu trong mọi tư thế; đạo cụ phù hợp tác vụ. Nội dung chữ luôn là HTML.

| Nhóm | Mã tư thế |
| --- | --- |
| Đón tiếp, khám phá | `welcome`, `guide`, `search`, `connection` |
| Đồng hành học | `reading`, `typing`, `listening`, `speaking` |
| Phản hồi | `thinking`, `ready`, `approve`, `encourage` |
| Thành tích | `clap`, `celebrate`, `star`, `trophy` |
| Cận mặt | `face-neutral`, `face-focus`, `face-happy`, `face-thinking`, `face-encourage`, `face-excited` |

- Mỗi màn có một vùng mascot chính; màn học thêm một vị trí phản hồi nhỏ. Không đặt nhân vật nổi che nội dung hoặc điều khiển.
- Phản ứng theo sự kiện đã chốt: đúng một lần cho một câu, động viên tối đa một lần khi câu đó có lỗi đầu tiên, một lần cho mỗi kết quả phát âm hoặc hoàn thành.
- Giữ tĩnh trong khi nhập/IME. Phản ứng mới thay phản ứng cũ; không xếp hàng chờ. Hoạt họa không làm thay đổi điểm, câu đang học hoặc phát âm thanh.
- `prefers-reduced-motion` dùng hình tĩnh; ảnh lỗi vẫn giữ kích thước và nội dung học.
- Body pose: WebP trong suốt 512px và bản nhỏ 256px; mặt: 256px và bản nhỏ 128px. Kích thước hiển thị do CSS quyết định.
- Tải sớm ảnh đang hiển thị, không tải cả bộ khi mở Dashboard. Tổng ảnh mascot tải ban đầu trên mobile tối đa 300KB.

Đóng gói lại từ master imagegen bằng `node scripts/prepare-mascots.cjs`. Nguồn tạm được liệt kê trong `.cache/mascot-generated.json`; đầu ra nằm tại `assets/mascot/`. Script chỉ resize và encode, kiểm tra alpha thật, tạo báo cáo và bảng đối chiếu 22 ảnh trong `.cache`.

Nguồn, prompt tái tạo và danh sách đầy đủ được ghi tại [MASCOT-ASSETS.md](../../docs/MASCOT-ASSETS.md); bảng đối chiếu được giữ tại `design-review/gopinyin/mascot-library.png`.

## Bố cục và điều hướng

- Desktop dùng sidebar có nhãn. Từ 860px trở xuống dùng Tổng quan, Luyện gõ, Phát âm, Thêm.
- Thêm mở hộp chọn AI, Game, Xếp hạng và tài khoản; giữ focus trong hộp, Escape/nền ngoài đóng và trả focus. Đóng khi đổi route hoặc trở lại desktop.
- Mở Thêm giữ nguyên bài đang học. Tạm dừng game nếu cần; đóng bảng chỉ tiếp tục khi chính bảng đã gây ra lần tạm dừng đó.
- Chừa safe area và khoảng trống cho thanh dưới; thu thanh khi bàn phím ảo mở. Input và hành động học luôn được tiếp cận.
- Màn học cuộn tự nhiên khi cần, không thu chữ/công cụ để ép vừa `100dvh`.
- Câu học, input/micro, phản hồi và hành động tiếp theo là trọng tâm. Giọng, tốc độ, tự đọc và thiết lập hiển thị nằm trong Tùy chọn thu gọn.
- Mobile đặt ba thống kê chính ở đầu thẻ. Ba thống kê chi tiết nằm trong Tùy chọn sau phần nội dung và nhóm hành động, dành vùng nhìn đầu tiên cho câu học và input/micro.
- Khi render hoặc mở bàn phím ảo, giữ input/micro hoàn toàn trong vùng nhìn giữa tiêu đề ghim và thanh điều hướng. Các tác vụ focus/cuộn có trễ phải kiểm tra màn, câu và hộp thoại hiện tại trước khi thực hiện.
- Quay lại thư viện giữ nhóm bài, từ khóa và vị trí cuộn. Mở/đóng bảng phụ giữ nội dung nhập và thiết lập hiện tại.

## Kiểm chứng

Chạy `npm.cmd test` và `npm.cmd run test:build`. Suite `ui-experience.cjs` kiểm tra số thao tác, Next, focus/keyboard, menu, game pause, ảnh alpha/budget và bố cục 360/390/768/1024/1440px trong sáng/tối. Ảnh và kết quả được lưu dưới `.cache/ui-experience/`; không commit artifact kiểm thử.

Nghiệm thu thủ công thêm zoom 200%, màn ngang thấp, bàn phím ảo và âm thanh/micro trên thiết bị thật. Giữ API, dữ liệu tài khoản, khóa tiến độ, điều hướng và ID/data-attribute mà bộ điều khiển hiện dùng.
