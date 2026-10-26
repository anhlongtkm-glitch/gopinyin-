# Kết quả triển khai cải tiến GoPinyin

Ngày: 26/10/2026. Triển khai trong workspace; chưa phát hành production hoặc sửa dữ liệu Supabase thật.

Đã tiếp tục tối ưu đồng bộ theo phiên bản và chỉ tải nội dung bộ câu khi cần học. Xem [kết quả đợt 2](WEB-PERFORMANCE-PHASE-2.md). Các số đo và số lượng kiểm thử bên dưới ghi nhận đợt triển khai đầu.

Đợt tiếp theo đã triển khai và xác minh API cùng Vercel: xem [biên bản production](PRODUCTION-ACCEPTANCE.md). Backend đã chạy; còn thiếu key provider để kiểm chứng AI/phát âm chuyên dụng thật.

Đã tiếp tục sửa các lỗi hoàn thành câu, tải lại trước Space, lượt ôn và nút làm lại: xem [chi tiết sửa luồng học](LEARNING-FLOW-FIXES.md), với 19 suite và 325 checks đạt.

Đợt tiếp theo bổ sung chống phản hồi cũ ghi đè thao tác mới trong điều hướng, AI, dịch nghĩa và phát âm: xem [chi tiết luồng bất đồng bộ](ASYNC-FLOW-FIXES.md).

## Các thay đổi đã thực hiện

| Nhóm | Kết quả |
| --- | --- |
| Dashboard | Chỉ đọc tiến độ tài khoản hiện tại; dùng combo cao nhất; hủy animation cũ khi đổi số liệu/tài khoản; loại dữ liệu legacy khỏi thống kê |
| AI | Nối `APP_CONFIG.AI_PROXY_URL` vào client; không cần key cá nhân khi dùng proxy; key nhập bị vô hiệu hóa trong chế độ proxy |
| Cấu hình dịch vụ | Hỗ trợ `GOPINYIN_PRON_API_URL`; URL backend được kiểm tra khi build; giữ các hook legacy; frontend/backend dùng cùng danh sách model mặc định |
| Phát âm | Timeout; backoff theo loại lỗi; thử lại trong cùng phiên; nút thử dịch vụ và nói lại; căn chỉnh kết quả theo chữ thay vì chỉ số từ; ghi rõ điểm chung khi một mục gồm nhiều chữ |
| Backend | Hạn mức theo user và IP, một lượt mỗi request; tối đa hai request đồng thời/user và giới hạn toàn tiến trình; timeout upstream; kiểm tra provider/prompt/ảnh/WAV |
| Đồng bộ | Gộp các lần đồng bộ/pull đồng thời, bỏ ghi lặp không đổi, không flush khi không có thay đổi; giữ cache bền vững, version, tombstone và xử lý xung đột |
| Tải trang | Minify production JS/CSS; HTML tham chiếu asset có hash dưới `assets/immutable`; cache dài chỉ cho asset bất biến; HTML/config được revalidate |
| Điều hướng | Link `#/study?dataset=...`, Back/Forward, khôi phục bài sau reload với phiên hợp lệ; hủy việc mở bài nếu người dùng đã chuyển màn trong khi tải |
| Hộp thoại/mobile | Giữ Tab trong app modal, trả focus về nút mở; điều chỉnh nút đóng và tiêu đề/thanh trạng thái trên màn nhỏ |
| Lịch ôn | Hai lối vào từ Dashboard: mục đến hạn và câu còn sai; mỗi phiên tối đa 20 câu; không ghi đè vị trí bài chính |
| Nội dung/tài liệu | Số câu Dashboard tính từ catalog; đợt 2 sửa cách lọc để chỉ tính 4.969 câu HSK, không cộng 43 mục luyện thanh; sửa domain ảnh chia sẻ; cập nhật tài liệu kiến trúc, tài khoản và biến môi trường |

## Quy tắc lịch ôn

- Luyện đúng: ôn lại sau 1 ngày, 3 ngày, rồi nhân đôi khoảng cách đến tối đa 60 ngày.
- Luyện sai: hẹn ôn lại sau 10 phút, ghi nhận một lần khi câu bắt đầu có lỗi. Sửa đúng ngay trong cùng lượt chưa được xem là đã ghi nhớ dài hạn.
- Lịch nằm trong `reviewById` của payload tiến độ hiện có. Không đổi schema hay chạy lại migration. Các bộ cũ chưa có lịch vẫn mở bình thường.
- Mốc ôn là timestamp tuyệt đối; đổi múi giờ thiết bị không thay đổi khoảng cách ôn. Mục đến hạn trên Dashboard cập nhật khi tải dữ liệu, chuyển màn và mỗi phút khi Dashboard đang mở.
- Phiên ôn hiện áp dụng cho luyện gõ. Không trộn điểm nhận dạng/phát âm vào lịch ghi nhớ này.

## Số đo cục bộ

| Tài nguyên | Trước | Sau |
| --- | ---: | ---: |
| JS chưa nén truyền tải | 2.054.126 byte | 1.191.036 byte |
| JS gzip | 548.938 byte | 428.682 byte |
| CSS chưa nén truyền tải | 155.965 byte | 122.458 byte |
| CSS gzip | 28.329 byte | 25.639 byte |

JS giảm khoảng 42% dung lượng thô, 22% sau gzip. Đây là so sánh artifact build, không phải phép đo tốc độ trên điện thoại, dữ liệu field hoặc điểm Lighthouse.

Kiểm thử đồng bộ bằng fixture: 10 lần ghi cùng giá trị không tạo RPC; 10 yêu cầu đồng bộ đồng thời dùng chung một pull. Kéo 100 record dùng một trang, 1.000 record dùng ba trang (có trang cuối kiểm tra kết thúc), khoảng 1ms/5ms trên fixture trong lượt đo. Những thời gian này không đại diện độ trễ Supabase thật.

## Kiểm chứng

- Lượt chạy cuối `npm.cmd test`: 17 suite, 313 checks đạt, 0 suite thất bại. `npm.cmd run test:build` và `npm.cmd run test:tooling` đều đạt.
- Kiểm thử tự động gồm các nhóm cũ và hai suite mới `improvements.cjs`, `service-reliability.cjs`.
- Bao phủ riêng: thống kê theo tài khoản và dữ liệu legacy, combo cao nhất, AI qua cấu hình không key cá nhân, khôi phục bài sau reload, Back/Forward, focus, lịch ôn và giữ vị trí bài chính, đổi tài khoản, timeout/backoff, kết quả phát âm nhiều chữ/thiếu chữ và hạn mức backend.
- `test:build`: đạt classic IIFE, ghép HTML, ID duy nhất, allowlist tài nguyên, file:// smoke.
- `test:tooling`: đạt cài dependency/build từ bản sao sạch, phục vụ thư mục public, watch HTML/JS/CSS, import token dùng một lần.
- Đã xem ảnh Dashboard mobile 390px; kiểm tra layout 1440px/390px và lưu ảnh dưới `.cache/roadmap/`.

## Phần cần xác minh tiếp ở môi trường thực

1. Triển khai Node API ở môi trường thử nghiệm, cấp key backend và cấu hình chính xác origin/endpoint. Xác minh provider/model/hạn mức thực tế. Static hosting không tự chạy API.
2. Thử micro và chấm phát âm thật trên điện thoại, trình duyệt hỗ trợ khác nhau; kiểm tra tình huống provider chậm/hết hạn mức bằng dịch vụ thật.
3. Đo LCP/INP/CLS và độ trễ đồng bộ với tài khoản thật. Hiện vẫn kéo đầy đủ record theo trang và serialize cache để giữ bản dự phòng ngay; chưa thay bằng cursor tăng dần hoặc IndexedDB mới khi chưa có thiết kế nhất quán và benchmark thực tế.
4. Thử lịch ôn với người học để điều chỉnh khoảng cách và số câu. Chưa đánh giá hiệu quả ghi nhớ qua nhiều ngày, chưa tuyên bố đã hoàn tất nghiên cứu sản phẩm của đợt 4.
5. Rate limiter hiện nằm trong bộ nhớ từng tiến trình; cần bộ đếm chung nếu scale nhiều replica. Chưa thêm analytics bên ngoài hoặc gửi dữ liệu học cho dịch vụ theo dõi mới.

Không thay chính sách đăng nhập/xác minh email/mạng, không bật chế độ khách học thử/offline, không thêm thanh toán và không xóa các file JSON cũ.
