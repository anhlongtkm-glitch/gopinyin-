# Bản vá nhận dạng tiếng Trung trên điện thoại — 30/10/2026

## Phản ánh thực tế

Sau commit `4c233c7`, người dùng báo **Android, Chrome** vẫn thường nhận thông báo “Chưa nghe rõ giọng nói” dù đã nói nhiều lần. Đây là lỗi thực tế được báo lại; các test trước đó không chứng minh luồng thu tiếng thật trên thiết bị đã đạt.

Đã đối chiếu trang public `https://www.gopinyin.io.vn/`: lúc kiểm tra, trang phục vụ JS `app.229a4f1a1a4c.js` và CSS `app.ed307f08d741.css`, trùng bản build đã push trước bản vá này. Chưa kiểm tra được cache riêng trên điện thoại người dùng.

## Điều xác minh được và điều còn là giả thuyết

- Thông báo cũ xuất hiện khi `asrText` rỗng, không có ASR error và không có interim được giữ lại. Điều đó chỉ chứng minh ứng dụng không có kết quả chữ cuối; không đủ để kết luận người dùng nói không rõ.
- Luồng cũ mở `getUserMedia` để ghi âm/đo âm lượng, đồng thời để `SpeechRecognition` tự mở micro. Meter còn có thể tự dừng sau 1,6 giây im lặng đo được dù dịch vụ nhận dạng chưa trả final.
- Trước khi gọi recognition, luồng còn chờ xác minh tài khoản và mở stream qua các bước bất đồng bộ. Điều này làm việc khởi động capture không còn nằm trực tiếp trong lượt chạm ban đầu.
- Chưa đo được trên điện thoại Android của người dùng để khẳng định cơ chế nào gây lỗi. Bản vá loại bỏ các điểm rủi ro này khỏi luồng điện thoại thay vì chỉ đổi lời báo lỗi.

`SpeechRecognition.start()` có thể tự thu từ micro khi không truyền audio track: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start). WebKit có báo cáo về việc Web Speech và getUserMedia tranh capture trên iOS: [bug 321436](https://bugs.webkit.org/show_bug.cgi?id=321436). Báo cáo iOS là tài liệu đối chiếu, **không phải bằng chứng nguyên nhân trên máy Android này**.

## Thay đổi

1. Với profile Android/iPhone/iPad, để **SpeechRecognition quản lý micro trực tiếp**; không mở thêm getUserMedia, MediaRecorder hoặc meter trong cùng lượt.
2. Dùng chế độ nhận một lượt câu (`continuous=false`) trên điện thoại. Chờ final hoặc sự kiện kết thúc của dịch vụ; vẫn giữ giới hạn thời gian tổng để không treo phiên.
3. Bỏ việc tự kết thúc lượt điện thoại theo RMS/silence của meter. Mốc 1,6 giây của luồng ghi âm không còn cắt ngang lượt nhận dạng điện thoại.
4. Nếu tài khoản đã ở trạng thái verified/ready/online qua `isStudyAllowed()`, khởi động capture trong lượt chạm mà không thêm round-trip tài khoản. Khách, tài khoản chưa sẵn sàng hoặc offline vẫn phải qua gate có sẵn; không thay đổi kiểm tra quyền của backend.
5. Mỗi lượt dùng recognizer mới và hủy callback/tài nguyên cũ. Luồng ghi âm desktop được giữ.
6. Nếu browser không trả chữ, báo đúng là **không nhận được chữ từ trình duyệt**, không tự quy kết giọng người dùng không rõ. Không tự chấm/ghi tiến độ khi thiếu final; không đổi interim thành kết quả chắc chắn.
7. Diagnostic bổ sung capture mode, audio/speech start và số result/final event. Không thêm âm thanh hoặc transcript vào diagnostic.

### Giới hạn tính năng

Chế độ điện thoại mới **không tạo bản ghi nghe lại** và không gửi audio cho bộ chấm chuyên dụng. Giao diện có ghi chú về việc không lưu bản ghi nghe lại; khi nhận được chữ, vẫn dùng đánh giá sơ bộ độ khớp nội dung đã có.

Tại thời điểm kiểm tra, `/api/status` của trang public báo `services.pronunciation=false`. Dịch vụ chấm phát âm backend và dịch vụ nhận dạng của browser là hai phần khác nhau; cờ này không chứng minh nguyên nhân ASR trả rỗng. Bản vá không thêm provider, API key hoặc dịch vụ trả phí.

## Kiểm thử

Kết quả: **489 checks đạt, 0 suite thất bại trong 41 suite**. Build và `tests/build.cjs` đều đạt. Riêng suite profile điện thoại mới có 8 checks đạt; các kiểm tra desktop/gate tài khoản vẫn đạt.

Bằng chứng: [hồi quy](mobile-audit-2026-10-30/speech-hotfix/regression-results.json), [log test mới](mobile-audit-2026-10-30/speech-hotfix/test-output.txt), [capture counters/diagnostic](mobile-audit-2026-10-30/speech-hotfix/observations.json), [ảnh Android nhận được kết quả](mobile-audit-2026-10-30/speech-hotfix/android-chrome-result.png), [ảnh trường hợp browser trả rỗng](mobile-audit-2026-10-30/speech-hotfix/android-chrome-empty-result.png), [asset build](mobile-audit-2026-10-30/speech-hotfix/build-assets.json).

Chạy lại: `node tests/run.cjs pronunciation-native-mobile.cjs pronunciation-mobile.cjs pronounce.js pronunciation-races.cjs auth-navigation.cjs`.

`tests/pronunciation-native-mobile.cjs` mô phỏng profile Android Chrome và iPhone trong Chromium. Mock từ chối việc mở capture/recorder song song để phát hiện lại luồng cũ.

- Ba lượt final tiếng Trung liên tiếp, dùng recognizer riêng, `zh-CN`, single utterance.
- Không gọi getUserMedia/MediaRecorder; không dừng sớm theo meter sau 1,6 giây.
- Dừng thủ công vẫn nhận final đến muộn và chỉ ghi một lượt.
- Kết thúc không có final, kể cả kết thúc rất nhanh: thông báo về browser response; không cộng lượt chấm.
- Từ chối quyền native recognition và rời màn hình được xử lý đúng.
- Hồi quy luồng ghi âm desktop, race/cancel và gate tài khoản được chạy cùng các test hiện có.

Các test dùng mock ASR, không thay thế việc người dùng thử lại trên Android Chrome thật. Profile iPhone trong Chromium không phải Safari/WebKit thật.

## Nghiệm thu cần làm sau khi phát hành

- Mở lại trang bằng Chrome Android, cấp quyền micro và đọc một câu ngắn đang hiển thị; thử ba lượt liên tiếp.
- Xác nhận có chữ được nhận và kết quả chuyển trạng thái đúng. Không yêu cầu người dùng phải nói to hơn chỉ để vượt thông báo cũ.
- Nếu vẫn lỗi, đối chiếu `asrDiagnostics` theo capture mode, audio/speech/result event và mã lỗi. Chưa được đánh dấu đã giải quyết trên máy thật chỉ dựa trên test mock.
