# Nghiệm thu mobile đợt 5 — 30/10/2026

**Phần local/tự động: ĐẠT. Phần điện thoại thật: CHƯA CHẠY. Chưa đủ điều kiện đóng nghiệm thu toàn bộ MOB-01 đến MOB-07.**

> Sau mốc nghiệm thu này, người dùng báo Android Chrome vẫn không nhận được chữ. Xem [bản vá và việc mở lại xác minh giọng nói](MOBILE-SPEECH-HOTFIX-2026-10-30.md). Bằng chứng 481 checks bên dưới là mốc trước bản vá đó.

Đợt 5 là bước kiểm thử tích hợp và đối chiếu bằng chứng sau các đợt sửa, theo [kế hoạch](MOBILE-FIX-PLAN-2026-10-30.md). Không phát hiện lỗi mới trong phạm vi đã chạy; không có thay đổi mã ứng dụng trong đợt này. Có thêm script audit và hồ sơ nghiệm thu để chạy lại.

## Kết quả cuối trên local

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| Toàn bộ hồi quy | **481 checks đạt, 0 suite thất bại; 40 suite** | [JSON](mobile-audit-2026-10-30/phase-5/regression-results.json), [log](mobile-audit-2026-10-30/phase-5/regression-output.txt) |
| Kiểm thử build riêng | Đạt: compose HTML, ID duy nhất, tài nguyên public, classic script, file:// smoke | [Log build test](mobile-audit-2026-10-30/phase-5/build-test-output.txt) |
| Build local cuối | Thành công | [Log build](mobile-audit-2026-10-30/phase-5/release-build-output.txt) |
| Audit mobile cuối | **32 trạng thái, 6 nhóm kiểm tra đạt**, 0 page runtime error | [Quan sát](mobile-audit-2026-10-30/phase-5/matrix/observations.json), [log](mobile-audit-2026-10-30/phase-5/audit-output.txt) |
| Kiểm tra whitespace | `git diff --check` exit 0 | [Log](mobile-audit-2026-10-30/phase-5/diff-check.txt); cảnh báo LF/CRLF không phải lỗi whitespace |
| Điện thoại thật, giọng nói/IME thật | **Chưa chạy** | Chưa có phiên thiết bị thật hoặc URL HTTPS chạy bản mới để nghiệm thu |
| Triển khai/production | **Chưa thực hiện trong đợt này** | Không dùng kết quả production cũ để kết luận cho bản workspace mới |

Audit cuối là phép thử bổ sung, được chạy riêng với bộ hồi quy 481 checks; không cộng số trạng thái chụp ảnh thành số kiểm tra hồi quy.

## Môi trường và phiên bản được kiểm tra

- Windows, Node `v24.22.1`; Chrome headless `156.0.8078.48`, giả lập touch/mobile bằng Playwright. [Metadata trình duyệt](mobile-audit-2026-10-30/phase-5/matrix/environment.json).
- Functional test dùng tài khoản/âm thanh/ASR fixture local. Không xác nhận được chất lượng dịch vụ nhận giọng nói thật qua các mock này.
- Không có phiên Android/iPhone điều khiển được trong lượt nghiệm thu này. WebKit/Safari không được chạy; giả lập kích thước iPhone trong Chrome cũng không được tính là Safari thật.
- HEAD `8c9ffbe13fa03fb4955a8fb91319035fd50a4001` cộng các thay đổi chưa commit trong workspace. Không có commit nghiệm thu mới.
- [Fingerprint build](mobile-audit-2026-10-30/phase-5/build-fingerprint.json) ghi SHA-256 cho HTML/JS/CSS release và snapshot 180 file nguồn/build/package. Fingerprint không thay thế việc đối chiếu một bản triển khai thực tế.
- Functional test và audit dùng cấu hình fixture; kiểm thử build dùng cấu hình build local. Chưa xác minh cấu hình provider/tài khoản thật trên một môi trường HTTPS triển khai mới.

## Audit mobile sau tích hợp

Đã dùng thao tác chạm qua navigation/menu để mở **Tổng quan, Luyện tập, Sảnh game, Gấu, Bài khóa, AI, Xếp hạng**.

| Ma trận | Số trạng thái | Kết quả |
|---|---:|---|
| 320×568, 7 màn hình | 7 | Không tràn ngang; đủ 5 nút navigation, tâm nút nhận chạm |
| 360×640, 7 màn hình | 7 | Đạt cùng tiêu chí |
| 390×844, 7 màn hình | 7 | Đạt cùng tiêu chí |
| 844×390, 7 màn hình | 7 | Đạt cùng tiêu chí; đây là các trang ngoài sân chơi |
| Giao diện tối 390×844: Tổng quan, Luyện tập, Sảnh game | 3 | Không tràn ngang, navigation thao tác được |
| Rời game qua Tùy chọn → Luyện tập → menu Thêm | 1 | Header/navigation được khôi phục, bàn phím game ẩn, focus vào menu đúng |

Ảnh tiêu biểu: [320×568 Tổng quan](mobile-audit-2026-10-30/phase-5/matrix/320x568-dash.png), [844×390 Luyện tập](mobile-audit-2026-10-30/phase-5/matrix/844x390-practice.png), [Sảnh game tối](mobile-audit-2026-10-30/phase-5/matrix/dark-games.png), [từ game trở về học](mobile-audit-2026-10-30/phase-5/matrix/game-to-practice.png).

Không kiểm thử tạo nội dung AI thật, phát video hoặc mọi thao tác của từng trang trong smoke này. Phần sân chơi, ASR, IME và nút tiếp được kiểm tra sâu bằng các suite dưới đây.

## Đối chiếu từng lỗi

| ID | Bằng chứng tự động sau tích hợp | Trạng thái đóng lỗi |
|---|---|---|
| MOB-01 | Startup exception/timeout không báo nghe giả, cleanup và retry; [trạng thái ASR](mobile-audit-2026-10-30/phase-5/speech/observations.json) | Logic đạt; chờ ASR thật trên máy thật |
| MOB-02 | Error/end/final đến muộn, 3 lượt liên tiếp, callback cũ, không lưu trùng; cùng suite ASR | Logic đạt; chờ mạng/dịch vụ/permission thật |
| MOB-03 | Thiếu diện tích ngang → pause, giữ timer/lives/buffer, thao tác thoát được; [ảnh ngang](mobile-audit-2026-10-30/phase-5/game-layout/844x390-paused-notice.png) | Giả lập đạt; chờ xoay máy/safe area thật |
| MOB-04 | Stage và nút thao tác không bị keyboard che ở 320×568; [số đo](mobile-audit-2026-10-30/phase-5/game-layout/observations.json) | Giả lập đạt; chờ browser chrome/keyboard thật |
| MOB-05 | Gõ 5 từ sạch bằng touch, nhận và dùng Tập trung; [ảnh](mobile-audit-2026-10-30/phase-5/game-controls/focus-active.png) | Logic/touch giả lập đạt; chờ máy thật |
| MOB-06 | Tùy chọn, âm thanh, restore keyboard/pause, fullscreen, rời game; [hit target](mobile-audit-2026-10-30/phase-5/game-controls/observations.json) | Chrome giả lập đạt; chờ browser mobile thật |
| MOB-07 | Câu đúng/kết quả nói dài, IME/viewport mô phỏng, guard cuộn/route/dialog; [số đo](mobile-audit-2026-10-30/phase-5/study-next/observations.json), [ảnh](mobile-audit-2026-10-30/phase-5/study-next/390-correct-next.png) | Logic/giả lập đạt; chờ IME thật |

Các ảnh/JSON trong đợt 5 được chụp/chạy lại từ bản hiện tại; bằng chứng trước sửa và các đợt 1–4 được giữ riêng.

## Checklist bắt buộc trên thiết bị thật

Chạy một lượt trên **Chrome Android** và một lượt trên **Safari iPhone**. Chọn URL HTTPS đang phục vụ đúng bản build được nghiệm thu; không dùng `file://` hay HTTP qua IP LAN để kết luận về micro.

### Thông tin mỗi lượt

| Trường | Android | iPhone |
|---|---|---|
| Model máy, OS | Chưa ghi nhận | Chưa ghi nhận |
| Browser và phiên bản | Chưa ghi nhận | Chưa ghi nhận |
| URL HTTPS, phiên bản/build hash | Chưa ghi nhận | Chưa ghi nhận |
| Ngày/giờ kiểm tra, người kiểm tra | Chưa ghi nhận | Chưa ghi nhận |

### Các bước và tiêu chí đạt

- [ ] **Quyền micro:** từ trạng thái chưa cấp quyền, vào Nói; thử từ chối rồi cấp lại. Ứng dụng báo đúng trạng thái và thử lại được; không kẹt ở Đang nghe khi chưa khởi động.
- [ ] **Ba lượt nói thật:** đọc ba câu đang hiển thị trong một bộ HSK đơn giản. Mỗi lượt nhận transcript hợp lý, dừng/chuyển trạng thái đúng; không nhân đôi lượt hoặc lấy kết quả câu trước.
- [ ] **Gián đoạn:** mất mạng giữa lượt, chuyển tab/khóa màn hình và trở lại. Ứng dụng kết thúc hoặc báo gián đoạn rõ, không tự ghi kết quả vào câu khác.
- [ ] **Game dọc:** mở bàn phím, gõ thử; Pinyin, Tập trung, bàn phím và Tùy chọn chạm được; HUD/sân chơi không bị che.
- [ ] **Xoay ngang và trở lại:** khi thiếu diện tích thì ván dừng, điểm/buffer/lá chắn giữ nguyên; quay dọc không tự chạy cho đến khi bấm Tiếp tục. Xác nhận quy tắc thử thách chuyển sang luyện khi pause.
- [ ] **Tập trung:** hoàn thành 5 từ sạch và dùng kỹ năng bằng cảm ứng khi keyboard đang mở. Chỉ tiêu một lượt năng lượng; trạng thái nút rõ ràng.
- [ ] **Tùy chọn:** mở/đóng khi đang chạy và khi đã pause; đổi âm thanh; keyboard/pause khôi phục đúng. Kiểm tra fullscreen nếu browser hỗ trợ và rời game về navigation thường.
- [ ] **IME tiếng Trung:** nhập Pinyin qua bàn phím hệ điều hành, chọn chữ Hán, chốt câu; không bị chấm giữa composition. Sau khi đúng, Câu tiếp ở phía trên keyboard/navigation và chạm được.
- [ ] **Câu/kết quả dài:** bật/tắt nghĩa, đọc kết quả nói, tự cuộn trang; không bị kéo ngược khi đang chủ động đọc/đổi focus.
- [ ] **Chrome của trình duyệt/safe area:** mở/đóng keyboard, co/giãn thanh URL, xoay máy; không có nút mắc dưới notch hoặc vùng gesture.

Nếu một bước không đạt, ghi model/browser/URL, bước tái hiện, kết quả thực tế và ID MOB tương ứng. Chỉ đóng nghiệm thu sau khi có kết quả thật cho hai nền tảng; không đổi các ô trên thành đã đạt dựa trên screenshot giả lập.

## Chạy lại phần local

Từ thư mục gốc:

```powershell
node tests/run.cjs
node tests/build.cjs
node scripts/build.mjs
```

Audit ma trận riêng dùng server fixture, không dùng tài khoản thật:

```powershell
# Terminal 1: để chạy trong lúc audit, Ctrl+C khi hoàn tất
node docs/mobile-audit-2026-10-30/server.cjs

# Terminal 2
node docs/mobile-audit-2026-10-30/phase-5/audit.cjs
```

Kết quả chạy lại nằm trong `.cache/test-run` và `.cache/mobile-phase-5-audit`. Script audit giới hạn origin local và dùng `CHROME_PATH` nếu cần chỉ định Chrome; mặc định dùng đường dẫn Chrome trên Windows. Không tự triển khai hoặc mở kết nối public.
