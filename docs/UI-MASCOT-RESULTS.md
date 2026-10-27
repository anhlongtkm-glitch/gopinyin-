# Đồng bộ giao diện và mascot GoPinyin

## Thay đổi trong đợt này

Đợt triển khai đưa gấu xanh 3D vào các màn khám phá, học tập, phản hồi và thành tích, đồng thời thống nhất hệ màu, thẻ, nút và cách điều hướng mobile. Quy chuẩn chính nằm tại [MASTER.md](../design-system/gopinyin/MASTER.md); nguồn, prompt tái tạo và danh sách ảnh nằm tại [MASCOT-ASSETS.md](MASCOT-ASSETS.md).

Các hạng mục nghiệm thu:

- Bộ 16 tư thế và sáu biểu cảm cận mặt, có WebP trong suốt theo hai kích thước: 44 tệp, tổng 1.147.734 byte; đóng gói qua `scripts/prepare-mascots.cjs`. Xem [bảng đối chiếu 22 ảnh](../design-review/gopinyin/mascot-library.png).
- Điều hướng Tổng quan/Luyện gõ/Phát âm/Thêm trên mobile; bảng Thêm hỗ trợ focus, Escape và giữ nguyên bài học.
- Màn học thoáng, ba thống kê chính trên mobile; các thống kê phụ và Tùy chọn nằm sau nội dung/hành động. Nút Câu tiếp hiển thị rõ và giữ logic tự chấm/Space hiện có.
- Input và micro được đưa vào vùng nhìn an toàn giữa tiêu đề và thanh điều hướng dưới; thao tác cuộn/focus có trễ được chặn khi đổi màn hoặc mở hộp thoại.
- Phản ứng mascot theo kết quả, giữ tĩnh trong IME, hỗ trợ giảm chuyển động và không chặn thao tác tiếp theo.
- Bố cục, nút, font và hai giao diện sáng/tối dùng quy tắc chung.

## Kiểm chứng

Đã chạy kiểm thử trên bản tích hợp bằng fixture tài khoản cục bộ. Bộ kiểm thử đầy đủ đạt 24 suite, 369 checks, không có suite thất bại.

| Kiểm tra | Trạng thái |
| --- | --- |
| `node --check scripts/prepare-mascots.cjs` | Đạt kiểm tra cú pháp |
| `node --check tests/ui-experience.cjs` | Đạt kiểm tra cú pháp |
| `npm.cmd test` | Đạt: 24 suite, 369 checks, 0 suite thất bại |
| `npm.cmd run test:build` | Đạt: ghép HTML, ID duy nhất, allowlist tài nguyên, classic IIFE và mở `file://` |
| 22 ảnh: alpha, kích thước, nhận diện | Đạt: giải mã được cả 22 ảnh, alpha được giữ; 44 WebP đúng kích thước; đã xem bảng đối chiếu |
| Mobile tải mascot ban đầu ≤300KB | Đạt: 71.874 byte trong lần đo fixture |
| Năm chiều rộng, sáng/tối, menu, Next, focus | Đạt: 15 nhóm kiểm tra trải nghiệm, gồm 60 tổ hợp màn/chiều rộng/giao diện |
| Màn ngang 844×390 và bố cục mô phỏng zoom 200% | Đạt: không tràn ngang, input/micro trong vùng nhìn, menu giữ/trả focus |
| Zoom trình duyệt, bàn phím ảo và micro/âm thanh trên thiết bị thật | Cần nghiệm thu thiết bị thật |

Suite mới `tests/ui-experience.cjs` dùng fixture tài khoản cục bộ như các suite hiện có. Kiểm thử không gọi AI, ghi tài khoản production hoặc xin quyền micro thật. Các trường hợp đã đạt gồm: học tiếp đúng câu bằng một thao tác, chuyển câu không bị lặp khi bấm nhanh, câu cuối, ba lượt đúng/làm lại liên tiếp cập nhật mascot, giữ nguyên input khi mở bảng, kích hoạt bàn phím gốc của summary, trả focus sau hồ sơ, và chỉ tiếp tục game khi chính bảng Thêm đã tạm dừng nó.

Đo ở viewport 390×844px cho thấy vùng nhìn an toàn nằm từ y=69 đến y=771. Input nằm trong khoảng y=598,78–654,78; nút micro nằm trong khoảng y=601,39–758,58, hoàn toàn phía trên thanh điều hướng. Các phép đo diễn ra sau render/focus thật, trước thao tác cuộn phục vụ chụp ảnh.

Chi tiết máy đọc được ở `.cache/ui-experience/acceptance.json`; báo cáo đóng gói ở `.cache/mascot-assets-report.json`. Những kết quả này không thay thế kiểm tra bàn phím ảo, micro hoặc âm thanh trên điện thoại thật.

Kiểm tra độc lập bổ sung ở `.cache/ui-experience/extra-viewports.json` đã đạt trên màn ngang 844×390 và mô phỏng bố cục 200% bằng viewport CSS 720×450 với device scale factor 2. Cả hai trường hợp không tràn ngang; input, toàn bộ nút micro và menu Thêm đều sử dụng được, không phát sinh lỗi trang. Đây là mô phỏng reflow, không thay thế zoom bằng giao diện trình duyệt hoặc thao tác trên thiết bị thật.

## Ảnh trước và sau

- Trước: [Dashboard desktop](../.cache/ui-redesign/plan-current-dashboard-desktop.png), [Dashboard mobile](../.cache/ui-redesign/plan-current-dashboard-mobile.png).
- Sau: [Dashboard mobile sáng](../design-review/gopinyin/dashboard-mobile.png), [Dashboard desktop sáng](../design-review/gopinyin/dashboard-desktop.png), [Dashboard mobile tối](../.cache/ui-experience/dark-390-dashboard.png).
- Màn học: [luyện gõ mobile](../design-review/gopinyin/typing-mobile.png), [luyện gõ desktop](../design-review/gopinyin/typing-desktop.png), [phát âm mobile](../design-review/gopinyin/pronunciation-mobile.png), [phát âm desktop](../design-review/gopinyin/pronunciation-desktop.png).

Artifact kiểm thử được giữ cục bộ trong `.cache/ui-experience/`. Sáu ảnh preview đã chọn và bảng thư viện mascot được giữ lâu dài trong `design-review/gopinyin/`. Ảnh màn học mobile chụp đúng viewport đang dùng; ảnh desktop chụp toàn trang. Các toast thành công tạm thời được ẩn riêng trong lúc chụp để nhìn rõ bố cục.

## Cách xem và đóng gói

Chạy `npm.cmd start` để xem bản phát triển. Chạy `npm.cmd run build` để tạo bản tĩnh trong `dist/`. Tài nguyên mascot phải đi qua allowlist build; nguồn master và dữ liệu nội bộ không được chép vào bản công khai.

Khi thay ảnh, cập nhật bản đồ nguồn trong `.cache/mascot-generated.json`, chạy `node scripts/prepare-mascots.cjs`, xem bảng đối chiếu rồi chạy lại các kiểm tra liên quan. Các lần thay đổi tiếp theo cần theo quy chuẩn chung để tránh sinh thêm các lớp CSS ghi đè.
