# Tối ưu tải dữ liệu — đợt 2

Ngày: 26/10/2026. Tiếp nối `WEB-IMPROVEMENT-RESULTS.md`. Không thay schema, RPC, RLS hoặc dữ liệu Supabase thật.

## Đồng bộ theo phiên bản

- Lần kéo đầu tiên của phiên vẫn tải đầy đủ, chia trang 500 record như trước.
- Các lần tiếp theo chỉ lấy `kind,record_id,version,deleted`. Nội dung chỉ được tải cho record mới hoặc có version lớn hơn bản đang giữ.
- Gộp record cần tải theo kind, tối đa 100 ID/request và giới hạn kích thước ID đã mã hóa khoảng 5 KB để hỗ trợ cả ID Unicode dài.
- Không dùng timestamp làm cursor nên không có vấn đề bỏ qua transaction commit muộn hơn watermark. Đây vẫn là đồng bộ nhất quán sau các lần kiểm tra; không phải snapshot nguyên tử của toàn bộ tài khoản.
- Giữ nguyên RPC CAS, outbox và tombstone. Một bản ghi có thể thay đổi sau khi đọc danh sách version; lần lấy nội dung nhận bản mới nhất, hoặc lần kiểm tra sau sẽ phát hiện thay đổi.
- Nếu không có thay đổi, không serialize lại cache và không phát thông báo khiến Dashboard/thư viện render lại.
- Kiểm tra nền không chuyển trạng thái đã đồng bộ sang `loading`, giúp tránh bỏ lỡ thao tác đang học. Khi lỗi, offline hoặc xung đột, guard vẫn hoạt động như trước. Tải đầu phiên vẫn cần hoàn tất trước khi học.
- Kiểm tra generation trước khi áp dụng từng bản ghi, kể cả khi người dùng đổi tài khoản trong lúc hộp thoại xung đột đang mở.

### Số đo dữ liệu phản hồi trong fixture

| Số record | Kéo đầy đủ | Kiểm tra không thay đổi | Giảm |
| --- | ---: | ---: | ---: |
| 100 | 17.391 byte | 7.791 byte | khoảng 55% |
| 1.000 | 174.894 byte | 78.894 byte | khoảng 55% |

Số liệu là tổng JSON chưa nén của fixture với payload tiến độ nhỏ, không gồm HTTP headers và không đại diện Supabase production. Tài khoản không thay đổi vẫn cần đọc danh sách version; không tuyên bố đã giảm số request về 0. Với một record thay đổi, chỉ nội dung record đó được lấy thêm.

## Chỉ chuẩn bị nội dung bài khi cần học

- `dbList()` trả metadata, gồm `rowCount`, không tải hoặc chuẩn hóa toàn bộ câu. Phép chiếu metadata diễn ra trước khi clone, tránh copy mảng câu lớn của bộ cá nhân/AI chỉ để vẽ danh sách.
- `dbGet(id)` đọc và chuẩn bị đúng một bộ câu. Đổi tài khoản hoặc xóa bộ khi đang tải khiến kết quả cũ bị bỏ qua.
- Dashboard/học tiếp, danh sách nguồn luyện gõ, danh mục phát âm và danh sách AI dùng metadata. Khi mở bài, chỉ bộ được chọn được chuẩn bị.
- `dbGetAll()` vẫn giữ tương thích cho các luồng thực sự cần đầy đủ nội dung, chẳng hạn xuất dữ liệu. Bridge cũ còn hoạt động.
- Ghi `rowCount` cho bộ mới. Bộ cũ không có trường này vẫn được hỗ trợ: tính từ mảng rows sẵn có hoặc catalog nhúng.
- Sửa thống kê tổng HSK để chỉ đếm `hsk1`–`hsk9`: 4.969 câu. Loại 43 mục `tone_pairs` đã bị cộng nhầm ở đợt trước; bổ sung assertion riêng cho nhãn tổng.

Kiểm thử browser với một chủ đề đã lưu xác nhận: mở Dashboard, danh mục phát âm, AI, thư viện và bài HSK không tải `vocab-pack.js`. Chọn học chủ đề mới phát sinh đúng một request tải gói. Tránh tải sớm 2.030.955 byte tài nguyên thô; không coi đây là dung lượng gzip thực tế tiết kiệm trên mọi phiên.

## Đo hiệu năng có thể chạy lại

Kiểm chứng: `npm.cmd test` chạy 18 suite, 320 checks đạt; `npm.cmd run test:build` đạt. Các bài kiểm tra giữ nguyên tiến độ, bài cũ, AI, phát âm, game và phân quyền tài khoản vẫn nằm trong bộ hồi quy.

`tests/data-performance.cjs` thuộc bộ `npm test`. Kết quả lab được ghi vào `.cache/roadmap/data-performance.json`, gồm LCP/CLS được browser quan sát, thời điểm DOMContentLoaded/load, số request vocab và dung lượng tài nguyên được trì hoãn.

Điều kiện: Chromium trên máy phát triển, viewport 390×844, localhost, không throttle CPU/mạng. Một lượt mẫu quan sát LCP 144ms, CLS khoảng 0,00048. Không dùng số này làm kết luận đạt Core Web Vitals trên thiết bị thật, không suy ra INP từ vài thao tác tự động, không so sánh với production.

Kiểm thử chức năng dùng assertion về request và dữ liệu; không đặt ngưỡng thời gian mong manh phụ thuộc tốc độ máy.

## Giới hạn và bước tiếp theo

- Cache vẫn được lưu nguyên khối khi có thay đổi nhằm giữ bản dự phòng hiện tại. Chưa chuyển sang IndexedDB hoặc journal mới.
- Việc phân trang hiện tại giữ cơ chế cũ. Nếu record được thêm/sửa trong lúc kéo, thay đổi sẽ được đối chiếu lại ở lần kiểm tra sau; chưa cung cấp transaction snapshot xuyên nhiều request.
- Cần đo thêm tài khoản/thiết bị/mạng thật trước khi đổi cơ chế lưu bền vững hay thêm backend đồng bộ riêng.
- Trong máy phát triển chưa có `GOPINYIN_AI_PROXY_URL`, `GOPINYIN_PRON_API_URL`, `AI_KEY_GEMINI`, `AI_KEY_OPENROUTER`, `AZURE_SPEECH_KEY`. Không gọi provider thật, không triển khai dịch vụ hoặc đưa key vào repo trong đợt này.

Tài liệu SDK đối chiếu: [select](https://supabase.com/docs/reference/javascript/select), [in](https://supabase.com/docs/reference/javascript/in).
