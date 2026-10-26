# Đánh giá và kế hoạch cải tiến GoPinyin

Đã triển khai các sửa lỗi và nền tảng tối ưu trong workspace. Xem [kết quả, kiểm thử và các bước xác minh thực tế còn lại](WEB-IMPROVEMENT-RESULTS.md). Phần đánh giá bên dưới ghi nhận hiện trạng trước khi sửa.

Ngày rà soát: 26/10/2026. Phạm vi: mã nguồn trong workspace hiện tại, build và kiểm thử cục bộ. Chưa sửa mã ứng dụng, triển khai hay thay đổi dữ liệu thật.

## Kết luận

GoPinyin có nền tảng tốt: chia module theo tính năng, thư viện dùng chung cho luyện gõ/phát âm, cache và outbox theo UUID, kiểm soát phiên ở backend, và bộ kiểm thử khá rộng. Ưu tiên tiếp theo nên là độ đúng của thống kê, sự hoạt động xuyên suốt của AI/phát âm, rồi mới tối ưu tốc độ và cá nhân hóa bài học. Chưa có căn cứ để viết lại toàn bộ bằng framework khác.

## Bằng chứng và giới hạn

- `npm.cmd test`: 15 suite, 300 checks đạt, 0 suite thất bại. Gồm database, đồng bộ, API, tài khoản, luyện gõ, phát âm, game, AI.
- `npm.cmd run test:build`: đạt ghép HTML, ID duy nhất, allowlist 17 tài nguyên, classic IIFE và smoke test `file://`.
- Kiểm tra browser bổ sung: dashboard, thư viện, kho phát âm, AI, sảnh game và bảng xếp hạng không tràn ngang toàn trang ở chiều rộng 1440px và 390px. Đây là đo layout, chưa phải đánh giá đầy đủ về hình ảnh hay thao tác trên điện thoại thật.
- Hai lượt thăm dò đăng ký bổ sung bị timeout ở bước chờ đồng bộ; chưa đủ dữ liệu xác định nguyên nhân. Các nhận xét logic bên dưới dựa trên mã nguồn; không coi thăm dò này là bằng chứng hệ thống đăng ký bị hỏng. Suite tài khoản chính vẫn đạt.
- Kiểm thử tự động dùng Supabase fixture/PostgreSQL nhúng và stub AI; không chứng minh chất lượng nhận giọng nói, phản hồi AI thật hoặc tình trạng production hôm nay.
- Tài liệu `docs/accounts-setup.md` ghi nhận backend Node AI/phát âm chưa triển khai trong đợt phát hành được mô tả. Cần kiểm tra lại deployment khi bắt đầu thực hiện; không suy ra tình trạng hiện tại chỉ từ tài liệu.
- Dung lượng bản build rà soát, chưa nén truyền tải: JS 2.054.126 byte, CSS 155.965 byte; vocab pack 2.030.955 byte. Không dùng các số này thay cho thời gian tải hoặc điểm Lighthouse.
- Áp dụng checklist UI/UX từ skill. Máy chưa có Python chạy được nên không chạy truy vấn cơ sở dữ liệu hướng dẫn; dùng tài liệu quick-reference có sẵn.

## Các phát hiện ưu tiên

### P1 — Thống kê Dashboard đọc sai kho dữ liệu

`src/features/dashboard/controller.js:105` duyệt trực tiếp `localStorage` để đọc `cts:progress:*`, trong khi `src/features/typing/progress.js:33` đã ghi vào `learningStorage` theo tài khoản. Hệ quả dự kiến: tài khoản mới có thể thấy thống kê bằng 0 dù có tiến độ; máy còn dữ liệu cũ có thể hiển thị thống kê cũ khi đổi tài khoản. Đây là sai lệch hiển thị, chưa phải bằng chứng server cho phép truy cập dữ liệu tài khoản khác.

Ngoài ra, Dashboard lấy `stats.combo` để hiển thị “combo cao nhất”, trong khi luồng chấm đã có `stats.bestCombo`.

Hướng sửa: thống nhất truy vấn thống kê qua repository theo UUID; lấy `bestCombo`, có fallback dữ liệu cũ. Chốt rõ định nghĩa “câu đã học”, “lượt đúng” và “độ chính xác” trước khi cộng số.

Nghiệm thu: học trên tài khoản A → Dashboard khớp tiến độ; tải lại vẫn đúng; đổi sang B không mang thống kê A/dữ liệu legacy sang; combo hiện tại giảm không làm mất kỷ lục.

### P1 — Cấu hình proxy AI chưa nối tới luồng sử dụng

Build ghi `GOPINYIN_AI_PROXY_URL` thành `APP_CONFIG.AI_PROXY_URL`; `src/features/ai/client.js:56` lại chỉ kiểm tra `window.__gpAiProxy`. Không thấy bước nối hai giá trị trong mã nguồn. Test AI hiện gán trực tiếp biến legacy nên chưa bao phủ cách cấu hình được tài liệu hướng dẫn.

`src/features/ai/session.js:250` còn bắt nhập API key trước khi tạo bài, kể cả khi dự định dùng proxy giữ key ở server.

Hướng sửa: một hàm đọc cấu hình endpoint dùng chung; khi có proxy hợp lệ, không yêu cầu key cá nhân. Kiểm thử bằng cấu hình build thực tế, không chỉ gán biến legacy. Đồng bộ cấu hình model giữa frontend/backend: backend đang ghi cứng `gemini-1.5-flash`, frontend dùng danh sách khác. Xác minh model khả dụng theo tài liệu nhà cung cấp trước khi chọn; không mặc định các tên model trong code còn hoạt động.

Nghiệm thu: chỉ đặt biến môi trường được hướng dẫn, người dùng đã đăng nhập tạo được bài không cần key cá nhân; chưa cấu hình dịch vụ thì giao diện giải thích rõ và cho chọn nội dung có sẵn.

### P1 — Lỗi phát âm tạm thời bị ghi nhớ như dịch vụ đã ngừng

`src/features/pronunciation/assessment.js:229` bỏ qua mọi lần gọi server tiếp theo khi `serverAssess.ok === false`. Các lỗi HTTP và lỗi mạng cũng đặt cờ này; không thấy nhánh tự phục hồi tương ứng trong mã nguồn đã rà soát. Một lỗi tạm thời có thể làm phiên chỉ còn chấm sơ bộ.

Hướng sửa: phân biệt chưa cấu hình, hết hạn phiên, quá hạn mức, lỗi mạng và lỗi server. Dùng timeout, nút thử lại và thời gian chờ trước khi kiểm tra lại; không tự gửi lại audio liên tục.

Giữ rõ hai loại kết quả: mức khớp nội dung nhận dạng và điểm phát âm chuyên dụng. Khi đối chiếu kết quả server, rà soát `fromServer()` đang ghép `words[i]` với từng chữ Hán: nếu một mục trả về chứa nhiều chữ hoặc có từ thiếu/thừa thì cần căn chỉnh theo nội dung thay vì cùng chỉ số. Đây là rủi ro cần test hợp đồng phản hồi thật, chưa kết luận đã tái hiện với Azure.

Nghiệm thu: lỗi 502 một lần → người dùng thử lại thành công trong cùng phiên; kết quả không gán điểm sai sang chữ bên cạnh; không hiển thị kết quả sơ bộ như điểm thanh điệu chính xác.

### P1 — Củng cố backend trước khi mở dịch vụ dùng key chung

`server/pro-server.js:131` đã trừ hạn mức cho request phát âm; nhánh `/api/pron` tại dòng 177 lại trừ lần nữa. `RATE_MAX=120` vì vậy không phản ánh 120 lượt phát âm như có thể kỳ vọng. AI/phát âm dùng chung bộ đếm IP, chưa có quota theo UUID hay giới hạn số tác vụ đồng thời.

Hướng sửa: tính một lần mỗi request, bổ sung quota theo user và kiểm soát tải; xác định IP đúng theo hosting và chỉ tin proxy đã cấu hình. Kiểm tra body hợp lệ, model/provider cho phép, timeout và phản hồi lỗi dễ hiểu. Thêm theo dõi độ trễ và lỗi, tránh ghi token/key/audio vào log.

Nghiệm thu: một request trừ đúng một lượt; dùng chung mạng không khiến người dùng khác bị chặn quá sớm; provider chậm không giữ tác vụ vô thời hạn.

### P2 — Đồng bộ tốn công việc khi dữ liệu tăng

`account-data.js` serialize toàn bộ cache tài khoản mỗi lần ghi, flush sau 200ms, gửi tuần tự từng record và kéo toàn bộ `learning_records` khi đồng bộ. `requireAccount()` gọi đồng bộ; còn được gọi định kỳ và khi quay lại cửa sổ. Đây là điểm cần đo tải với tài khoản lớn, chưa có benchmark chứng minh mức chậm cụ thể.

Hướng sửa: đo số request/thời gian trước; chỉ lưu phần thay đổi, giảm cập nhật giao diện không liên quan, cân nhắc IndexedDB cho cache lớn. Thiết kế đồng bộ tăng dần với cursor ổn định và tombstone nếu cần; giữ kiểm tra version và xử lý xung đột. Gộp request chỉ khi có API giữ nguyên bảo đảm dữ liệu.

Nghiệm thu: đối chiếu bộ dữ liệu 100/1.000 record, hai thiết bị cùng sửa, mất mạng và đổi tài khoản; không mất bản chưa gửi, không ghi đè âm thầm.

### P2 — Hiệu năng tải trang còn dư địa

Build đang `minify: false`, bundle IIFE lớn, khởi tạo nhiều tính năng ngay khi vào trang. Vocab pack đã tải lười là điểm tốt. `vercel.json` đặt cache revalidate cho mọi đường dẫn và tài nguyên chưa có hash nội dung.

Hướng sửa theo thứ tự: đo baseline mạng/máy chậm → minify production → asset có hash và cache dài riêng cho asset bất biến → giữ HTML/config cập nhật đúng → cân nhắc trì hoãn khởi tạo game/phát âm. Chỉ tách bundle/dữ liệu sau khi xác định chi phí và nhu cầu tương thích `file://`; không phá luồng hiện có chỉ để giảm kích thước.

Nghiệm thu: đo cùng thiết bị/network profile; báo kích thước truyền tải, LCP/INP/CLS và thời gian mở bài. Mục tiêu đề xuất khi đủ dữ liệu thực: LCP ≤2,5 giây, INP ≤200ms, CLS ≤0,1 ở phân vị 75; đây chưa phải kết quả hiện tại.

### P2 — Điều hướng và hộp thoại chưa thống nhất

`showView()` chủ yếu ẩn/hiện DOM, chưa thấy kết nối History API để quay lại bằng nút Back hay mở link tới màn cụ thể. Có hai hệ thống modal. `shared/dialogs.js` đã xử lý Tab, nhưng `#appModal` thuộc hệ riêng chưa có cơ chế tương đương trong phần mã rà soát; `closeModal()` blur phần tử thay vì đưa focus về nút mở.

Hướng sửa: route cho màn/bộ câu, lịch sử Back/Forward, khôi phục bộ lọc; thống nhất quản lý focus, Escape, Tab và nút đóng. Bổ sung hướng dẫn gõ Pinyin/chữ Hán cho người mới, chỉ hiện tùy chọn nâng cao khi cần.

Nghiệm thu: hoàn thành luồng chính chỉ bằng bàn phím, đóng modal đưa focus về đúng nút, Back quay đúng màn, reload link bài không mở nhầm. Kiểm tra thêm 360/390/768px, zoom và bàn phím ảo trên máy thật.

### P3 — Chuyển dữ liệu điểm yếu thành lịch học cụ thể

Đã có lịch sử sai/khó, `topWeakWords()` và nút học tiếp. Chưa thấy mô hình lên lịch ôn theo thời điểm trong các module typing/dashboard đã rà soát. `weakInc()` còn loại dấu thanh nên số liệu hiện chưa phân biệt tốt lỗi thanh điệu.

Đề xuất: mỗi ngày có “Tiếp tục bài”, “Ôn mục đến hạn”, “Luyện điểm yếu”; phiên ngắn 5–10 phút; lưu kết quả, lần ôn gần nhất và lần ôn tiếp theo. Tách lỗi nội dung, gõ và phát âm; không gộp các thang điểm khác nghĩa. Chốt phạm vi dữ liệu rồi mới thêm migration.

Nghiệm thu: sau phiên có thống kê lỗi và bài tiếp theo cụ thể; câu đã vững xuất hiện thưa hơn; câu sai quay lại đúng lịch; đổi ngày/múi giờ có quy tắc nhất quán.

### P3 — Tài liệu và thông tin công khai cần đồng bộ

README ghi 4.804 câu, giao diện ghi 4.969; nên tính số từ catalog thay vì ghi lặp. `ARCHITECTURE.md` còn mục Pro/thanh toán và thư mục không còn trong cây nguồn. Metadata ảnh chia sẻ ở `src/index.html` vẫn trỏ `gopinyin.app`, trong khi domain cấu hình là `gopinyin.io.vn`.

Hướng sửa: một nguồn metadata/thống kê, cập nhật tài liệu theo sản phẩm miễn phí hiện tại; không xóa file JSON cũ chỉ vì tên có Pro trước khi xác định phụ thuộc và nhu cầu lưu trữ.

## Lộ trình đề xuất

Ước lượng sơ bộ cho một lập trình viên quen dự án; chưa bao gồm chờ tài khoản dịch vụ, phản hồi người dùng hay kiểm thử thiết bị diện rộng.

| Đợt | Công việc | Khoảng công sức | Điều kiện hoàn tất |
| --- | --- | --- | --- |
| 1 | Sửa thống kê Dashboard; nối cấu hình proxy và bỏ yêu cầu key khi dùng proxy; thêm test cho hai lỗi | 2–3 ngày | Thống kê đúng từng tài khoản; proxy hoạt động qua cấu hình build |
| 2 | Timeout, retry phát âm, căn chỉnh phản hồi, rate limit, trạng thái dịch vụ và phương án triển khai API | 3–5 ngày | Kiểm thử lỗi phục hồi và tích hợp dịch vụ thật trong môi trường thử nghiệm |
| 3 | Đo/tối ưu tải trang, cache, đồng bộ; route và modal | 4–6 ngày | Có số đo trước/sau; không mất tiến độ; Back/bàn phím/mobile đạt |
| 4 | Lịch ôn và gợi ý bài học cá nhân hóa | 5–8 ngày | Thử nghiệm trên nhóm người học, đo mức hoàn thành và kết quả ôn |

Có thể phát hành riêng từng đợt sau khi đạt nghiệm thu. Không cần đợi đợt cá nhân hóa mới đưa các lỗi thống kê và AI vào sử dụng.

## Quyết định sản phẩm cần tách khỏi sửa lỗi

- Việc bắt đăng nhập, xác minh email, có mạng và đồng bộ thành công là chính sách hiện tại (`isStudyAllowed()`), không tự coi là lỗi bảo mật hoặc tự bỏ điều kiện này.
- Nếu muốn giảm rào cản người mới, cân nhắc bài mẫu chỉ dùng dữ liệu công khai và nút đăng ký để lưu tiến độ. Đây là thay đổi chính sách cần thống nhất trước khi triển khai.
- Nếu muốn học offline, cần thiết kế riêng vòng đời phiên, cache từng tài khoản và xử lý xung đột. Không chỉ bỏ `navigator.onLine` khỏi guard.
- Chưa đề xuất thêm thanh toán, game mới hoặc đổi framework trong đợt tối ưu đầu.

## Kiểm chứng khi triển khai

Thêm test cho các lỗi vừa phát hiện, giữ 15 suite hiện có và test build. Mở rộng thực nghiệm đúng phạm vi thay đổi: hai tài khoản trên một máy; hai phiên cùng sửa; AI không cần key khi có proxy; provider timeout/429/502; phát âm với kết quả nhiều chữ mỗi mục; điều hướng và focus; cache sau phát hành. Kiểm thử Supabase/AI thật trên môi trường thử nghiệm trước khi đưa backend mới ra production.

Giữ phân quyền theo UUID, RLS và quyền RPC đã thiết kế; không mở quyền bảng để chữa lỗi đồng bộ. Tài liệu đối chiếu: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Đã đọc changelog Supabase trong phiên rà soát; không thay SDK, migration hoặc cấu hình production trong công việc này.
