# Panda Du Hành — Đối chiếu thiết kế tối giản

Cập nhật: 30/10/2026. Hướng hiện hành là nền xanh đêm sạch, thẻ phẳng và phi thuyền gấu nhỏ làm điểm nhấn. Các concept nền/khoang 3D trước đây đã được thay thế.

## Bản hiện hành

- [Concept tối giản đã duyệt](minimal/concept.png): ảnh minh họa tạo bằng image_gen tích hợp trong bước lên kế hoạch; không phải giao diện chạy thật. Chữ trong ảnh AI không phải nguồn dữ liệu của game.
- [Desktop đang chơi](minimal/desktop-playing.png): ảnh game chạy thật sau khi thu khung từ nhỏ hơn khoảng 12–15%.
- [Mobile cảm ứng và bàn phím](minimal/mobile-touch.png): ảnh chạy thật ở viewport 390×740, DPR 2.
- [Màn chọn chủ đề](minimal/desktop-ready.png).
- [Định hướng mỹ thuật](../../docs/PANDA-DU-HANH-ART-DIRECTION.md) và [tình trạng triển khai](../../docs/PANDA-DU-HANH-IMPLEMENTATION.md).

Nền/thẻ/đạn vẽ bằng Canvas, bảng và bàn phím bằng CSS. Chỉ sprite tàu gấu là bitmap trong suốt. Các ảnh đánh giá không được đóng gói vào website. Phi thuyền quay theo mục tiêu, đạn xuất phát từ nòng đã xoay; bàn phím mobile hoạt động cả khi fullscreen.

## Lịch sử tham khảo

- [Gameplay v2 phong cách 3D cũ](gameplay-v2.png), [prompt](gameplay-v2-prompt.md).
- [Concept v1 đã loại](gameplay-concept-v1.png): sai hướng gấu và tàu quá lớn.
- [Khung/nền 3D cũ và prompt](refinement/asset-prompts.md), [báo cáo đóng gói cũ](refinement/asset-report.json). Không còn dùng trong game.
- [Sprite gấu sản xuất](../../assets/game/panda-du-hanh/panda-ship.webp), [bản nhỏ](../../assets/game/panda-du-hanh/panda-ship-small.webp), [prompt sprite](ship-sprite-prompt.md).

Chạy `npm run test:game` để tái tạo ảnh kiểm tra trong `.cache/panda-game/`. Bộ kiểm tra riêng bao gồm hình học hướng ngắm/nòng/điểm chạm, resize/DPR, giảm chuyển động, phím chạm, mở/ẩn/mở lại, fullscreen thực, màn thấp và việc giữ lựa chọn bàn phím khi rời game.
