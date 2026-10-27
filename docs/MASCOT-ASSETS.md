# Nguồn và prompt bộ gấu GoPinyin

## Nguồn hình và tài nguyên bàn giao

Bộ ảnh được tạo bằng **công cụ `image_gen` tích hợp**, dựa trên ảnh gấu xanh 3D người dùng đính kèm trong yêu cầu ngày 26/10/2026. Bản `welcome` được dùng làm mẫu nhận diện chung khi tạo các tư thế và biểu cảm còn lại.

- Mẫu nhận diện đã chọn: `.cache/mascot-source/welcome.png`.
- Bản đồ đường dẫn ảnh tạo ra: `.cache/mascot-generated.json`. Một số master còn nằm tại thư mục ảnh được tạo của Codex; bản đồ giữ đường dẫn chính xác trên máy thực hiện.
- Ảnh web bàn giao: `assets/mascot/<pose>.webp` và `assets/mascot/<pose>-small.webp`, **44 tệp, tổng 1.147.734 byte**.
- Bảng đối chiếu nhận diện: [mascot-library.png](../design-review/gopinyin/mascot-library.png). Bản làm việc tương ứng ở `.cache/mascot-review.png`.
- Báo cáo kích thước/alpha: `.cache/mascot-assets-report.json`.

Master PNG và bản đồ nguồn là tài nguyên làm việc, không chép vào bản web công khai. Ứng dụng chỉ đọc WebP tĩnh đã đóng gói; hiển thị và phản ứng của gấu không gọi AI khi người dùng học.

## Khóa nhận diện trong prompt

Các prompt giữ cùng một nhân vật: gấu trúc 3D cao cấp có lông mềm màu trắng ngà và xanh emerald/teal, đầu tròn lớn, thân ngắn mũm mĩm, mắt xanh lớn, mũi teal đậm và chiếc khăn xanh đặc trưng. Ánh sáng studio dịu, góc nhìn và mức độ chi tiết thống nhất. Nền trong suốt thật, khung vuông, chủ thể được giữ trọn trong ảnh; không có chữ, watermark hoặc chi thừa.

Prompt chuẩn hóa để tái tạo mẫu nhận diện:

```text
Create the GoPinyin brand mascot using the supplied reference image as the
identity reference: a premium fluffy 3D panda with ivory-white and emerald-teal
fur, a large rounded head, short chubby body, huge emerald eyes, a dark teal nose,
and the distinctive teal scarf. Preserve the reference face, eye shape, fur
colors, proportions and scarf identity. Friendly, warm and approachable.

Welcome pose: happily wave one paw toward the learner while holding an open
mint-green book with the other. Show the full character, centered in a square
composition, with gentle studio lighting and genuinely transparent alpha.
No lettering, labels, watermark, background scene, duplicate limbs or extra paws.
```

Template cho từng tư thế, dùng ảnh `welcome` làm tham chiếu nhận diện:

```text
Create one new GoPinyin mascot asset using the supplied canonical welcome panda
as the identity reference. Preserve the exact same face, huge emerald eyes,
ivory-white and emerald-teal fluffy fur, dark teal nose, rounded head, short
chubby body, distinctive teal scarf, premium 3D material and gentle studio light.

Pose/expression: [description from the asset table below].

For a body pose, keep the complete character and relevant prop comfortably
inside the square frame. For a face expression, use a centered head-and-scarf
close-up with the ears fully visible. Keep the expression readable when small.
Output one isolated character on genuinely transparent alpha. No baked-in text,
lettering, logo, watermark, background scene, duplicate limbs or extra paws.
```

## Bộ prompt theo tư thế và biểu cảm

Mỗi hàng là một tài nguyên riêng; bản `-small` là phiên bản resize của cùng ảnh, không phải một nhân vật hoặc biểu cảm mới.

| Mã / tên tệp | Nội dung tư thế hoặc biểu cảm |
| --- | --- |
| `welcome` | Vẫy tay chào, cầm sách mở; vui vẻ mời người học bắt đầu. |
| `guide` | Dùng một tay chỉ dẫn hành động hoặc hướng tiếp theo; nét mặt thân thiện. |
| `search` | Cầm kính lúp, tò mò tìm kiếm bài học hoặc chủ đề. |
| `connection` | Hỗ trợ kết nối với thiết bị/đạo cụ phù hợp; thái độ bình tĩnh, sẵn lòng giúp. |
| `reading` | Chăm chú đọc một quyển sách mở, phù hợp phần câu học. |
| `typing` | Gõ bàn phím, tập trung và vui vẻ luyện chữ. |
| `listening` | Đeo tai nghe, thể hiện đang lắng nghe mẫu phát âm. |
| `speaking` | Cầm micro, thể hiện đang luyện nói. |
| `thinking` | Đặt tay suy nghĩ, nét mặt tò mò khi chuẩn bị hoặc xử lý nội dung. |
| `ready` | Tư thế sẵn sàng học, tự tin và chào đón hành động tiếp theo. |
| `approve` | Giơ ngón cái, tán thưởng câu trả lời đúng. |
| `encourage` | Động viên làm lại bằng cử chỉ tích cực và nét mặt cảm thông. |
| `clap` | Vỗ tay chúc mừng nhẹ cho một kết quả tốt. |
| `celebrate` | Nhảy mừng hoàn thành bài, biểu cảm phấn khích. |
| `star` | Ôm ngôi sao, thể hiện đạt mục tiêu học tập. |
| `trophy` | Nâng cúp, dùng cho khu vực game hoặc thành tích/xếp hạng. |
| `face-neutral` | Cận mặt bình thường, dịu dàng và thân thiện. |
| `face-focus` | Cận mặt tập trung, sẵn sàng đọc hoặc nghe. |
| `face-happy` | Cận mặt vui vẻ, nụ cười rõ để phản hồi đúng. |
| `face-thinking` | Cận mặt đang suy nghĩ, biểu cảm tò mò. |
| `face-encourage` | Cận mặt động viên, kiên nhẫn và tích cực. |
| `face-excited` | Cận mặt phấn khích, vui mừng trước thành tích. |

Tên mã được dùng chung trong `src/shared/mascot.js`, script đóng gói và các điểm hiển thị. Giữ các mã này khi thay artwork để không làm hỏng tham chiếu của màn học.

## Đóng gói và kiểm tra

Chạy `node scripts/prepare-mascots.cjs` khi bản đồ nguồn đã đủ 22 mục. Script dùng Chrome Canvas để resize và encode WebP, không vẽ lại hoặc chỉnh nội dung nhân vật.

| Loại | Bản thường | Bản nhỏ |
| --- | --- | --- |
| 16 tư thế toàn thân | 512×512px | 256×256px |
| 6 biểu cảm cận mặt | 256×256px | 128×128px |

Script kiểm tra có vùng alpha trong suốt và vùng nhân vật nhìn thấy, ghi kích thước/dung lượng, rồi tạo bảng đối chiếu. Suite `ui-experience.cjs` xác nhận tất cả ảnh giải mã được, alpha được giữ và ảnh tải ban đầu trên mobile nằm trong ngân sách 300KB.

Khi thay một ảnh, đối chiếu khuôn mặt, màu mắt/lông, khăn, tỷ lệ và chất liệu với mẫu `welcome`; kiểm tra cả kích thước hiển thị nhỏ và giao diện tối. Quy tắc đặt gấu và phản ứng nằm tại [MASTER.md](../design-system/gopinyin/MASTER.md).
