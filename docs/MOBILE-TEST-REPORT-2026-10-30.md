# Báo cáo kiểm thử mobile — 30/10/2026

> Đây là bằng chứng **trước sửa**. Sau audit đã triển khai [đợt 1 — MOB-01/MOB-02](MOBILE-FIX-PHASE-1-2026-10-30.md), [đợt 2 — MOB-03/MOB-04](MOBILE-FIX-PHASE-2-2026-10-30.md), [đợt 3 — MOB-05/MOB-06](MOBILE-FIX-PHASE-3-2026-10-30.md), [đợt 4 — MOB-07](MOBILE-FIX-PHASE-4-2026-10-30.md). Các số đo và ảnh audit bên dưới được giữ nguyên để đối chiếu.

## Kết luận

**Cập nhật nghiệm thu:** phần local sau đợt 1–4 đã qua [đợt 5](MOBILE-FIX-PHASE-5-2026-10-30.md): 481 checks/40 suite, build và audit mobile cuối. Phần máy thật chưa chạy; các số liệu bên dưới vẫn là baseline trước sửa.

Đã chạy một vòng kiểm thử trên bản mã hiện tại: **443 kiểm tra hồi quy đạt, 0 suite thất bại**. Audit mobile bổ sung xác minh **7 vấn đề** về vòng đời nhận dạng giọng nói, game và vị trí nút thao tác. Test cũ đạt chưa đủ để kết luận trải nghiệm mobile đạt.

Hai phản ánh ban đầu:

- **Không nhận giọng nói tiếng Trung:** xác minh được lỗi xử lý khi bộ nhận dạng không khởi động hoặc tự kết thúc. Chưa xác định đây có phải nguyên nhân trên điện thoại của người dùng; chưa kiểm thử micro và dịch vụ nhận dạng thật trên Android/iPhone.
- **Game không hiện bàn phím, nội dung bị che:** ở 390×844, bàn phím tự hiện sau đếm ngược và nhận thao tác chạm. Lỗi che khuất tái hiện rõ ở 320×568 và khi xoay ngang 844×390. Bản workspace đang có thay đổi chưa commit nên kết quả này không chứng minh bản đã triển khai có cùng hành vi.

Kế hoạch xử lý: [MOBILE-FIX-PLAN-2026-10-30.md](MOBILE-FIX-PLAN-2026-10-30.md).

## Môi trường và giới hạn

| Mục | Cấu hình |
|---|---|
| Mã nguồn | HEAD `8c9ffbe` + các thay đổi chưa commit có sẵn trong workspace |
| Runtime | Node `v24.22.1`, Chrome headless qua `playwright-core` |
| Thiết bị giả lập | `isMobile:true`, `hasTouch:true`, pointer coarse, 1 touch point |
| Kích thước CSS | 390×844, 360×640, 320×568, 844×390 |
| Máy chủ | Bản build riêng tại `.cache/mobile-audit-app`, localhost cổng 8092 |
| Tài khoản | Fixture local, tài khoản và bài học giả; không dùng tài khoản thật |
| Giọng nói | Thiết bị âm thanh giả của Chrome; tiêm các sự kiện ASR để kiểm tra xử lý lỗi |
| Phạm vi thay đổi | Chỉ thêm báo cáo và bằng chứng; chưa sửa mã ứng dụng |

**Không coi giả lập desktop là điện thoại thật.** Chưa kiểm chứng bàn phím hệ điều hành/IME tiếng Trung, Safari/WebKit trên iPhone, WebView trong ứng dụng, tai nghe Bluetooth, cấp quyền micro của hệ điều hành, hay chất lượng nhận giọng nói thực tế. TTS được tắt trong audit tự động; không có kết luận về âm thanh nghe mẫu trên thiết bị thật.

Skill `ui-ux-pro-max` được dùng làm khung rà soát tương tác/bố cục. Công cụ tìm kiếm của skill không chạy được do môi trường không có Python sử dụng được; không dùng kết quả tìm kiếm nào từ skill. Các lỗi dưới đây dựa trên số đo, ảnh và mã nguồn.

## Các luồng đã chạy

| Luồng | Kết quả |
|---|---|
| Tổng quan, Luyện tập, Sảnh game, Gấu, Bài khóa, AI, Xếp hạng | Smoke render ở 4 kích thước, tổng 28 tổ hợp; không phát hiện tràn ngang tài liệu |
| Đăng ký qua menu mobile | Thành công với fixture local |
| Mở bài, gõ `你好`, báo đúng | Thành công; phát hiện nút tiếp bị thanh điều hướng che ở vị trí ban đầu |
| Cuộn trang sau khi gõ đúng | Nút tiếp hiện và tâm nút nhận được tương tác |
| Chuyển Gõ → Nói | Thành công qua nút Nói đang hiển thị |
| ASR `start()` ném lỗi | FAIL — vẫn báo đang nghe, sau đó đổ lỗi không nghe rõ |
| ASR phát `network` rồi `end` | FAIL — vẫn ở trạng thái recording đến khi dừng thủ công |
| ASR có interim `你好`, rồi `end` không có final | FAIL về phản hồi trạng thái; không có final để chấm |
| ASR trả final `你好` | Chuỗi final được nhận đúng, cấu hình ngôn ngữ `zh-CN`; đây là sự kiện giả lập |
| Bắt đầu game bằng thao tác chạm | Bàn phím tự hiện sau countdown ở 390×844 |
| Chạm phím đầu của mục tiêu trong game | Buffer nhận đúng ký tự; xem `keyboardExpected`/`keyboardInput` trong JSON |
| Xoay/đổi kích thước khi đang chơi và mở bàn phím | FAIL ở màn hình thấp và ngang |
| Mở Tùy chọn khi có bàn phím | FAIL — nút bị CSS ẩn; ẩn bàn phím rồi mở được |
| Rời game | Bàn phím được ẩn |
| Fullscreen bằng user gesture, đóng/mở bàn phím | Bộ hồi quy `panda-mobile-keyboard.cjs` đạt |

Smoke render không đồng nghĩa đã thử mọi nội dung, chức năng AI, video hoặc thao tác tài khoản trên từng trang. Không có `pageerror` trong lượt audit bổ sung. Số đo chi tiết: [observations.json](mobile-audit-2026-10-30/observations.json).

## Danh sách lỗi

Quy ước: **P1** chặn chức năng chính trong điều kiện tái hiện; **P2** gây khó sử dụng hoặc có cách đi vòng. “API mô phỏng” xác minh logic ứng dụng, không chứng minh dịch vụ nhận dạng thật đang lỗi.

| ID | Ưu tiên | Lỗi | Bằng chứng |
|---|---|---|---|
| MOB-01 | P1 | ASR khởi động thất bại nhưng UI báo đang nghe | API mô phỏng + mã nguồn |
| MOB-02 | P1 | ASR lỗi/tự kết thúc nhưng phiên ghi âm không chuyển trạng thái | API mô phỏng + mã nguồn |
| MOB-03 | P1 | Bàn phím che sân chơi khi xoay ngang | Số đo + ảnh 844×390 |
| MOB-04 | P1 | Thanh điều khiển game bị cắt/che ở màn hình thấp | Số đo + ảnh 320×568 |
| MOB-05 | P1 | Nút Tập trung biến mất khi chơi bằng bàn phím mobile | DOM + CSS; chưa thử tích đủ năng lượng bằng lượt chơi thật |
| MOB-06 | P2 | Nút Tùy chọn bị ẩn khi bàn phím mở | Tap timeout + CSS; mở được sau khi ẩn bàn phím |
| MOB-07 | P2 | Nút Câu tiếp nằm dưới thanh điều hướng ở vị trí ban đầu | Hit test + ảnh; cuộn xuống khắc phục được |

### MOB-01 — Khởi động nhận dạng thất bại nhưng vẫn báo “Đang nghe”

**Tái hiện:** đăng nhập → mở bài → Nói → mô phỏng `SpeechRecognition.start()` ném `InvalidStateError` → chạm micro.

**Thực tế:** `phase='recording'`, `asrErr=''`, thông báo “Đang nghe… hãy nói câu ở trên.” Khi dừng, hiển thị “Chưa nghe rõ giọng nói…” dù bộ nhận dạng chưa khởi động thành công.

**Mong đợi:** thông báo đúng lỗi khởi động, kết thúc recorder/meter/timer của lượt lỗi và cho phép thử lại; không báo đang nghe.

**Nguyên nhân xác minh:** `recognition.js:81` bắt exception rồi trả `false`; `recording.js:124` bỏ qua giá trị trả về và dòng 126 luôn chuyển sang recording. Chưa có bước chờ `onstart` để xác nhận dịch vụ đã sẵn sàng.

**Bằng chứng:** [ảnh trạng thái sai](mobile-audit-2026-10-30/speech-throw-listening.png), bản ghi `speechCase='throw'` trong JSON.

### MOB-02 — ASR lỗi hoặc đã dừng nhưng giao diện vẫn tiếp tục nghe

**Tái hiện A:** đang Nói → mô phỏng sự kiện `error:network`, tiếp theo `end`.

**Thực tế:** trạng thái đã có `asrErr='network'` nhưng UI vẫn recording. Chỉ khi bấm dừng mới thấy lỗi mạng. Nếu không dừng thủ công, lượt ghi còn bị giới hạn bởi timeout 15 giây của ứng dụng.

**Tái hiện B:** mô phỏng interim `你好` rồi `end` mà không có final. `asrInterim='你好'`, `asrText=''`, UI vẫn recording. Khi dừng, người dùng nhận thông báo không nghe rõ dù vừa thấy chữ tạm thời.

**Mong đợi:** trạng thái UI bám vòng đời nhận dạng; lỗi mạng hiển thị ngay; kết thúc không có final giải thích rằng kết quả chưa hoàn tất và cho phép nói lại. Không tự coi interim là kết quả chắc chắn để chấm/lưu tiến độ.

**Nguyên nhân xác minh:** `recognition.js:71–78` chỉ lưu mã lỗi và resolve promise; không thông báo controller kết thúc phiên. `recording.js:167–180` mới xử lý lỗi khi `stopRecording()` được gọi.

**Bằng chứng:** [ảnh lỗi mạng vẫn nghe](mobile-audit-2026-10-30/speech-network-listening.png), [ảnh interim](mobile-audit-2026-10-30/speech-end-interim-listening.png).

### MOB-03 — Màn hình ngang bị bàn phím chiếm sân chơi

**Tái hiện:** bắt đầu game trên mobile → đợi bàn phím tự mở → đổi viewport sang 844×390.

**Thực tế:** bàn phím bắt đầu tại `y=127`, cao 263 px; sân chơi nằm từ `y≈210.6` đến `370.6`; phi thuyền nằm dưới bàn phím. Nút Pinyin/bàn phím/Tùy chọn bắt đầu quanh `y=390.3`, ngoài vùng nhìn thấy. Không thể quan sát và điều khiển game bình thường.

**Nguyên nhân:** `fitGameCard()` trong `virtual-keyboard.js:259–261` ép card cao tối thiểu 200 px dù không còn đủ chiều cao; CSS vẫn giữ minimum của stage và kích thước HUD/footer. Chiều cao con vượt card có `overflow:hidden`.

**Mong đợi:** bố cục ngang dành chỗ đồng thời cho sân chơi và input. Nếu không đủ diện tích, tự tạm dừng và hướng dẫn xoay dọc, giữ đường tiếp tục/rời game thao tác được.

**Bằng chứng:** [ảnh 844×390](mobile-audit-2026-10-30/844x390-game-keyboard.png).

### MOB-04 — Màn hình 320×568 cắt thanh điều khiển game

**Tái hiện:** game đang chạy, bàn phím mở → viewport 320×568.

**Thực tế:** card cao 200 px, đáy `y≈297.6`; các nút bàn phím/Pinyin nằm ở `y≈305.1–349.1`; bàn phím bắt đầu `y=305`. Hit test tại tâm nút trúng phần đầu bàn phím. Trong khi đó, `scrollHeight=innerHeight=568`, không có đường cuộn tài liệu để lấy lại các nút bị cắt.

**Nguyên nhân:** cùng nhóm ràng buộc chiều cao với MOB-03; stage tối thiểu 112 px vẫn vượt ngân sách sau khi cộng HUD, sub-HUD và footer.

**Mong đợi:** nút thao tác quan trọng luôn hiện và chạm được; không chỉ kiểm tra đáy phi thuyền có nằm trên bàn phím.

**Bằng chứng:** [ảnh 320×568](mobile-audit-2026-10-30/320x568-game-keyboard.png). 360×640 vẫn giữ được nút bàn phím/Pinyin ở trên bàn phím; không gộp tất cả điện thoại nhỏ thành FAIL.

### MOB-05 — Không có nút Tập trung trong bố cục chơi mobile mặc định

**Tái hiện:** viewport 390×844 hoặc 360×640 → bắt đầu game → bàn phím mở.

**Thực tế:** `#gaFocusBtn` không có box hiển thị. `panda.css:252` áp dụng `.vk-open .pdFocusButton{display:none}` trong media query mobile; bàn phím ảo không có thao tác Shift/Tập trung thay thế. Nút bị ẩn không phụ thuộc việc đã tích đủ năng lượng.

**Ảnh hưởng:** người chỉ dùng cảm ứng phải tự ẩn bàn phím mới tìm được nút dùng kỹ năng. Chưa kiểm thử một ván tích đủ 5 từ sạch trong audit này; việc mất nút và thiếu phím thay thế đã được xác minh từ DOM/mã nguồn.

**Mong đợi:** giữ nút Tập trung hoặc có nút tương đương trên bàn phím ảo; hiển thị rõ điều kiện chưa đủ năng lượng.

**Bằng chứng:** [ảnh 390×844](mobile-audit-2026-10-30/390x844-game-keyboard.png), trường `controls.gaFocusBtn=null` trong JSON.

### MOB-06 — Tùy chọn bị ẩn cùng lúc bàn phím mở

**Tái hiện:** game mobile 390×844, đang mở bàn phím → tìm/chạm Tùy chọn.

**Thực tế:** `#gaOptionsBtn` bị `.vk-open #gaOptionsBtn{display:none}` tại `panda.css:252` ẩn; tap timeout 8 giây. Ẩn bàn phím rồi mở Tùy chọn thành công. Trong Tùy chọn có điều khiển âm thanh và Toàn màn hình.

**Mong đợi:** người dùng mở được Tùy chọn khi đang dùng bàn phím; mở panel cần tạm dừng và bố trí lại input phù hợp.

**Bằng chứng:** `settingsUnreachable` trong JSON; [Tùy chọn sau khi ẩn bàn phím](mobile-audit-2026-10-30/390-game-settings-after-hide.png).

### MOB-07 — Nút tiếp bị thanh điều hướng dưới che ở vị trí ban đầu

**Tái hiện:** mở bài audit một câu tại 390×844 → gõ đúng `你好` → giữ vị trí cuộn ban đầu.

**Thực tế:** nút Câu tiếp nằm tại `y≈790.3–838.3`; tâm nút bị `.mobile-nav` phủ. Sau khi cuộn xuống 159 px, nút nằm tại `y≈631.3–679.3` và hit test trúng nút. Không phải mất vĩnh viễn nút tiếp.

**Phân tích:** logic hiện tại ưu tiên đưa ô gõ/micro vào vùng nhìn thấy. Sau khi câu đúng và khối phản hồi tăng chiều cao, chưa đưa hành động tiếp theo vào vùng an toàn. Cần xử lý theo trạng thái bài học, không chỉ thêm khoảng trống cuối trang.

**Mong đợi:** sau khi hoàn thành câu, nút tiếp hiện phía trên navigation/keyboard mà không đổi focus đột ngột trong lúc đang nhập.

**Bằng chứng:** [trước khi cuộn](mobile-audit-2026-10-30/390-typing-correct.png), [sau khi cuộn](mobile-audit-2026-10-30/390-typing-scrolled.png).

## Phần còn phải xác minh trên máy thật

- Chrome Android và Safari iPhone qua HTTPS: cấp quyền lần đầu, từ chối, cấp lại; nói `你好`, `谢谢`, một câu dài; thử ít nhất 3 lượt liên tiếp.
- Ghi rõ URL, model thiết bị, OS, browser/version và `isSecureContext`; truy cập HTTP qua IP LAN không tương đương localhost của máy chạy test.
- Kiểm tra sự tồn tại API và lỗi runtime riêng biệt. Hiện nhánh thiếu ASR trong `recording.js:86` hướng người dùng sang Chrome/Edge trên máy tính; chưa có đường nhận dạng thay thế cho môi trường không hỗ trợ.
- Kiểm tra mất mạng, dịch vụ ASR bị chặn, chuyển tab/khóa màn hình, chuyển câu trong lúc đang xin quyền.
- Bàn phím tiếng Trung thật: mở/đóng, đổi IME, xoay máy, thanh URL thu/phóng, safe area và fullscreen.
- Game với `gp:vk` chưa có, bằng `1`, bằng `0`; reload và tiếp tục ván. Giá trị `0` hiện chủ động tắt tự mở theo lựa chọn đã lưu; không tự kết luận đây là lỗi.

## Tài liệu kỹ thuật đối chiếu

Nhận dạng phải được kiểm tra theo sự kiện và môi trường hỗ trợ, thay vì chỉ kiểm tra có constructor: [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition), [start()](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition/start).

Visual viewport có thể co khi bàn phím hệ điều hành mở trong khi layout viewport giữ nguyên; vì vậy cần kiểm thử trên máy thật: [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport).

## Bằng chứng và chạy lại

- [Quan sát và số đo](mobile-audit-2026-10-30/observations.json).
- [Kết quả bộ hồi quy](mobile-audit-2026-10-30/regression-results.json).
- [Script audit](mobile-audit-2026-10-30/audit.cjs), [máy chủ fixture cô lập](mobile-audit-2026-10-30/server.cjs).
- Chạy từ thư mục gốc: `node tests/run.cjs`.
- Chạy audit: terminal 1 `node docs/mobile-audit-2026-10-30/server.cjs`; terminal 2 `node docs/mobile-audit-2026-10-30/audit.cjs`. Dừng server bằng Ctrl+C sau khi xong. Script dùng Chrome tại đường dẫn mặc định Windows và ghi đè bộ ảnh/JSON của ngày audit.
- Hit test trong JSON áp dụng cho điều khiển; phi thuyền trang trí có thể không nhận pointer và nằm dưới canvas theo thiết kế, nên `ship.hit=false` không tự nó là lỗi.
