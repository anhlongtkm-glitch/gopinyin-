# Kết quả sửa mobile đợt 1 — 30/10/2026

Phạm vi: **MOB-01 và MOB-02**, theo [kế hoạch fix](MOBILE-FIX-PLAN-2026-10-30.md). Đã sửa xử lý vòng đời nhận dạng; chưa nghiệm thu micro và dịch vụ ASR trên điện thoại thật. Các lỗi bàn phím/bố cục game thuộc đợt 2–3 chưa được sửa trong đợt này.

## Hành vi sau sửa

- Sau khi xin quyền micro, hiển thị **Đang mở nhận dạng**; chỉ chuyển sang **Đang nghe** khi nhận `onstart` từ trình duyệt.
- Constructor hoặc `start()` thất bại sẽ hiện lỗi khởi động; không giả vờ đang nghe. Nếu không có `onstart` trong **5 giây**, dừng chờ và cho phép thử lại.
- Lỗi mạng, quyền nhận dạng, thu âm, không có giọng nói và phiên bị gián đoạn được báo ngay. Mã lỗi khởi động không còn bị biến thành lỗi “nghe chưa rõ”.
- Nhận dạng tự kết thúc sẽ dừng lượt và xử lý final đúng một lần. Nếu chỉ có chữ tạm thời, giải thích thiếu kết quả cuối và yêu cầu nói lại; không dùng interim để chấm/lưu tiến độ.
- Dừng thủ công vẫn chờ final tối đa **2,5 giây**. Chờ recorder xuất chunk cuối tối đa **1 giây**, chạy song song với chờ ASR, trước khi gửi bản ghi đi đánh giá.
- Hủy phiên, đổi câu, đổi bộ, mở Tùy chọn/menu mobile khi đang khởi động hoặc rời màn hình sẽ dọn timer/meter/recorder và vô hiệu hóa callback cũ. Trạng thái cũng trở về idle khi đi qua câu cuối.
- Callback recorder cũ không được thêm dữ liệu hoặc cập nhật bản ghi của lượt mới. Stream được giữ giữa các lượt theo chính sách phiên học hiện tại; rời màn luyện sẽ đóng track, kể cả stream trả về sau khi người dùng đã rời đi.
- Có chẩn đoán tạm trong `window.__pron._state.asrDiagnostics`: secure context, khả năng API, thời điểm yêu cầu/bắt đầu/lỗi/kết thúc và mã lỗi. Không ghi âm thanh, transcript hoặc thông tin tài khoản vào trường này; không tự xuất log ra dịch vụ ngoài.

## Các phần mã đã thay đổi

| Phần | Thay đổi |
|---|---|
| `recognition.js` | Callback start/end, timeout khởi động, phân loại exception, hủy theo mã phiên và kết thúc idempotent |
| `recording.js` | Trạng thái starting, điều phối kết thúc/lỗi, thông báo riêng, cleanup và chờ final/chunk cuối |
| `microphone.js` | Cô lập callback từng recorder, promise hoàn tất bản ghi và dọn tài nguyên khi hủy |
| `controller.js`, `events.js` | Hủy thực sự khi rời/đổi bộ/pagehide; hủy startup khi ẩn tab |
| `render.js`, `tts.js`, `session.js` | Đồng bộ trạng thái mới, không phát mẫu chen lúc ASR khởi động |
| `mobile-navigation.js`, `shared/study/settings.js` | Menu/Tùy chọn xử lý đúng phiên còn đang khởi động |

## Kiểm thử

Kết quả cuối: **459 kiểm tra đạt, 0 suite thất bại trong 38 suite** khi chạy `node tests/run.cjs`. Riêng suite mobile mới có **16 kiểm tra đạt**. Build ứng dụng local bằng `node scripts/build.mjs` thành công.

Bằng chứng sau sửa được lưu riêng, không ghi đè audit ban đầu:

- [Kết quả hồi quy](mobile-audit-2026-10-30/phase-1/regression-results.json).
- [Kết quả test mobile](mobile-audit-2026-10-30/phase-1/mobile-test-output.txt), [trạng thái/tài nguyên từng tình huống](mobile-audit-2026-10-30/phase-1/observations.json).
- [Ảnh final được xử lý](mobile-audit-2026-10-30/phase-1/final-result-mobile.png), [ảnh thông báo thiếu final](mobile-audit-2026-10-30/phase-1/interim-ended-mobile.png).

Chạy riêng: `node tests/run.cjs pronunciation-mobile.cjs pronunciation-races.cjs pronounce.js study-shortcuts.cjs pron-auto.cjs`.

Bổ sung `tests/pronunciation-mobile.cjs`, chạy bằng Chrome giả lập **390×844, cảm ứng**, với audio giả và mock sự kiện ASR. Bộ test này xác minh logic ứng dụng, không chứng minh chất lượng nhận giọng nói ngoài đời.

Các tình huống đã kiểm tra:

1. Constructor ném lỗi; start ném lỗi; không có onstart dẫn đến timeout.
2. `network`, `not-allowed`, `service-not-allowed`, `audio-capture`, `no-speech`, `aborted`: dừng ngay, không cộng lượt chấm.
3. Chỉ có interim rồi end: không chấm; hiện lý do thiếu final.
4. Mở Tùy chọn khi startup: hủy và bỏ qua onstart/result/error/end của phiên cũ.
5. Ba lượt final tiếng Trung liên tiếp: mỗi lượt kết thúc/lưu đúng một lần; onend lặp không tạo kết quả trùng.
6. Dừng thủ công rồi final đến muộn; dữ liệu recorder cũ; đổi câu khi đang nghe.
7. Rời màn hình đóng track; từ chối micro và thiếu API có thông báo riêng.
8. Rời màn hình khi getUserMedia chưa trả về: track đến muộn được đóng, không mở lại màn học.

Test cũ `pronounce.js` được cập nhật mock để phát `onstart`, dùng dừng thủ công rõ ràng cho luồng manual; luồng tự kết thúc nằm trong suite mobile mới. Kiểm tra kết quả dài được đo sau thao tác cuộn thật, phù hợp bố cục học cho phép cuộn; không sửa CSS hay ép nhỏ nội dung để làm test đạt.

## Nghiệm thu còn lại

- Chrome Android và Safari iPhone, URL HTTPS: cấp quyền lần đầu, nói thật ít nhất ba lượt, thử từ ngắn và câu dài.
- Xác nhận sự kiện onstart/result/error/end thực tế, mạng chậm/mất mạng và dịch vụ ASR bị chặn.
- Xác định browser đích có yêu cầu khác về user activation sau các bước await/xin micro hay không. Chưa có máy thật để khẳng định hoặc chỉnh thứ tự API dựa trên giả thuyết này.
- Không thêm dịch vụ ASR server/fallback mới trong đợt 1. Trình duyệt không hỗ trợ API vẫn cần môi trường hỗ trợ hoặc một hạng mục tích hợp riêng.
- Chưa triển khai lên môi trường bên ngoài.
