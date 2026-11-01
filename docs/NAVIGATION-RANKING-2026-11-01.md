# HSK, Chủ đề, dark mode và bảng xếp hạng — 01/11/2026

## Thay đổi trải nghiệm

- Bỏ Tổng quan và Bài khóa khỏi giao diện; không đưa hai section này vào bản HTML. HSK là màn mở đầu. Các URL cũ chuyển về HSK bằng thay thế lịch sử, không tạo thêm một bước Back.
- Học theo HSK và Học theo chủ đề là hai mục điều hướng, tương ứng `#/hsk` và `#/topics`. Mỗi mục giữ tìm kiếm, vị trí cuộn và bài học tiếp của chính nó.
- Mở trực tiếp URL bài học hoặc tải lại bài Chủ đề vẫn nhận đúng mục cha. Tiến độ Gõ, Nói và dữ liệu tài khoản hiện có được giữ nguyên.
- Nhiệm vụ Khám phá trong Gấu của bạn chuyển từ bài khóa đã bỏ sang hoàn thành lượt game. Giữ dữ liệu XP và huy hiệu cũ, vẫn chặn nhận thưởng lặp và giữ giới hạn XP game.
- Dark mode dùng nền `#020403`, thẻ `#090F0C`, nền phụ `#0E1712`; giữ chữ sáng và xanh ngọc cho hành động. Light mode không đổi bảng màu.

## Hướng thiết kế bảng xếp hạng

Tham khảo [cách Duolingo tổ chức bảng xếp hạng theo tuần](https://blog.duolingo.com/duolingo-leagues-leaderboards/) và [cách họ kết hợp mục tiêu cá nhân với tính năng tạo động lực](https://blog.duolingo.com/sticking-with-it-tips-for-staying-motivated/). Lựa chọn cho GoPinyin là thi đua theo tuần đi cùng mốc luyện tập cá nhân; không thêm hệ thống thăng/hạ giải khi chưa có cơ chế lưu giải tương ứng.

- Mặc định Tuần này, chuyển được Hôm nay. Có khoảng ngày, thời gian còn lại và thời điểm cập nhật.
- Top 3 dùng bục vinh danh; danh sách đầy đủ vẫn có các vị trí này để tra cứu thuận tiện.
- Cùng số câu đúng có cùng hạng theo kiểu `1, 1, 3`. Mỗi câu gõ đúng cộng 1; game và lượt nói không cộng vào bảng luyện gõ.
- Thẻ cá nhân hiển thị vị trí, mốc 20 câu/ngày hoặc 100 câu/tuần và số câu cần thêm để vượt người có thành tích cao hơn gần nhất. Mốc là phản hồi giao diện, không ghi thêm điểm hoặc tự phát phần thưởng.
- Nút Gần vị trí của tôi hiển thị nhóm người quanh bạn trong top 100 đã tải.
- Trạng thái khách, chưa có thành tích, ngoài top 100, đang tải, rỗng và lỗi mạng có nội dung riêng. Không gán hạng hoặc điểm 0 cho người không có trong top 100.
- Nếu cập nhật thất bại, dữ liệu cũ có nhãn rõ ràng. Cache chia theo bảng, ngày/tuần và kỳ cụ thể; phản hồi chậm không ghi đè kỳ mới chọn.
- Không tự lấy toàn bộ lịch sử học để cộng vào kỳ hiện tại. Không xóa điểm cũ đã lưu trước bản sửa.

## Phạm vi kỹ thuật

Dùng API `public_rankings` hiện có và dữ liệu thật từ dịch vụ cấu hình cho ứng dụng. Không đổi schema, không tạo dữ liệu người học giả trong sản phẩm và không triển khai lên môi trường bên ngoài. Dữ liệu dùng chụp ảnh và kiểm thử xếp hạng chỉ được mock trong test local.

Ngày và tuần tiếp tục dùng giờ của thiết bị theo định dạng khóa dữ liệu hiện có; giao diện nêu rõ quy tắc này. Bản sửa không bổ sung cơ chế chống gian lận ở server.

## Kiểm chứng

Suite mới `tests/navigation-ranking.cjs` kiểm tra đồng hạng, khoảng cách cá nhân, ranh giới tuần, điều hướng HSK/Chủ đề, Back, URL cũ, mở bài trực tiếp, học tiếp riêng, phản hồi chậm, tên chứa HTML, lỗi mạng và top 100. Kiểm tra bố cục tại 360/390/768/1024/1440px, cả sáng và tối.

Ảnh: `.cache/navigation-ranking/`. Log và kết quả hồi quy: `.cache/test-run/`. Các test từng kỳ vọng Tổng quan/Bài khóa được cập nhật sang điều hướng hiện hành; vẫn giữ kiểm tra tiến độ, ôn câu yếu, phiên học, game, Gõ/Nói và điều hướng bất đồng bộ.

Kết quả cuối sau lượt chạy đầy đủ và chạy lại các suite đã cập nhật: **463 kiểm tra đạt, 42/43 suite đạt**. Tổng hợp tại `.cache/test-run/navigation-final-results.json`; lượt đầy đủ tại `navigation-full-results.json`. Còn lỗi cũ trong `verify_pron_studied.js`: kiểm tra gõ đúng một câu rồi chuyển câu tiếp. Lỗi này đã được tái hiện trên mã trước bản sửa xác thực ở lượt trước. Một lượt phát mẫu trong `curriculum.cjs` từng timeout khi chạy đầy đủ; chạy lại cả suite đạt 4 kiểm tra.

`node tests/build.cjs` đạt kiểm tra HTML, ID duy nhất, bundle và mở từ `file://`. Suite mới đạt 5 nhóm kiểm tra; riêng lượt chạy lại `app_regress.js`, `data-performance.cjs`, `study_shell.js`, `games_hub.js`, `curriculum.cjs` đạt **82 kiểm tra, 0 suite lỗi**.
