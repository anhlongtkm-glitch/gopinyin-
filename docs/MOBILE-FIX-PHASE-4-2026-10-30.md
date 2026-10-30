# Kết quả sửa mobile đợt 4 — 30/10/2026

Phạm vi: **MOB-07**, theo [kế hoạch fix mobile](MOBILE-FIX-PLAN-2026-10-30.md). Đã sửa việc nút Câu tiếp bị thanh điều hướng/bàn phím che sau khi hoàn thành câu. Cần nghiệm thu IME và bàn phím hệ điều hành trên điện thoại thật.

## Hành vi sau sửa

- Gõ đúng cả câu → sau khi bố cục phản hồi ổn định, nút **Câu tiếp** được đưa vào vùng nhìn thấy phía trên thanh điều hướng hoặc bàn phím.
- Hoàn tất một lượt nói → đưa **Câu tiếp** vào vùng an toàn. Trên mobile, thao tác cuộn kết quả cũ không còn chạy đồng thời và đẩy nút tiếp ra khỏi màn hình. Kết quả vẫn được hiển thị và cuộn đọc bình thường; giao diện desktop giữ hành vi trước đó.
- Không đổi focus bằng thao tác reveal. IME đang composition không bị chấm hoặc chuyển câu; chỉ xử lý sau khi đã chốt chữ.
- Chỉ cuộn khi nút đang bị che. Vùng an toàn là phần giao nhau của visual viewport, header, navigation và bàn phím ảo; không cộng dồn các phần che đang chồng lên nhau.
- Khi bàn phím hệ điều hành làm visual viewport co lại, bổ sung đúng phần khoảng trống cuộn còn thiếu, trừ phần padding workspace/card đã có. Đóng bàn phím hoặc rời màn học sẽ tính lại và bỏ phần bổ sung không còn cần.
- Khi câu dài, nghĩa được bật/tắt hoặc nội dung đổi chiều cao sau render, ResizeObserver kiểm tra lại hành động đã hoàn thành.
- Mỗi yêu cầu cuộn có mã riêng và kiểm tra đúng câu/nguồn/route/trạng thái hiện tại. Đổi câu hoặc chuyển màn hình sẽ hủy yêu cầu cũ.
- Nếu người dùng đổi focus, mở hộp thoại, thao tác cuộn hoặc bắt đầu composition trong lúc đang chờ layout, yêu cầu cuộn không ghi đè thao tác đó. Cuộn trang có chủ đích gần thời điểm hoàn thành cũng được ưu tiên.

Không thêm nút tiếp thứ hai và không đổi footer sang sticky. Dùng lại nút, trạng thái chấm và hành vi chuyển câu hiện có.

## File đã thay đổi

| File | Nội dung |
|---|---|
| `src/shared/study/interactions.js` | Reveal sau layout, guard người dùng/route, vùng che của bàn phím, khoảng trống cuộn bổ sung và theo dõi resize |
| `src/features/typing/scoring.js` | Yêu cầu reveal sau khi chấm đúng, kiểm tra câu và trạng thái composition |
| `src/features/pronunciation/render.js` | Ưu tiên hành động tiếp theo trên mobile, tránh hai tác vụ cuộn cạnh tranh |
| `src/app/mobile-navigation.js` | Không đưa focus input đã readOnly trở lại vùng nhìn thấy để cạnh tranh với nút tiếp |
| `src/shared/study/shell.css` | Spacer chỉ áp dụng cho màn học và phần inset còn thiếu |
| `tests/study-mobile-next.cjs`, `tests/run.cjs` | Hồi quy mobile cho nút tiếp và các guard |

## Kiểm thử

Kết quả cuối: **481 kiểm tra đạt, 0 suite thất bại trong 40 suite** qua `node tests/run.cjs`. Suite mới `study-mobile-next.cjs` có **8 kiểm tra đạt**. Build local bằng `node scripts/build.mjs` thành công.

Bằng chứng sau sửa:

- [Kết quả hồi quy](mobile-audit-2026-10-30/phase-4/regression-results.json), [log test đợt 4](mobile-audit-2026-10-30/phase-4/mobile-test-output.txt).
- [Số đo nút tiếp và focus/inset](mobile-audit-2026-10-30/phase-4/observations.json).
- [390×844 sau khi đúng](mobile-audit-2026-10-30/phase-4/390-correct-next.png), [360×640](mobile-audit-2026-10-30/phase-4/360-correct-next.png).
- [Viewport co khi keyboard mở](mobile-audit-2026-10-30/phase-4/native-viewport-shrunk.png), [câu dài](mobile-audit-2026-10-30/phase-4/long-sentence-next.png), [kết quả nói trên bài dài](mobile-audit-2026-10-30/phase-4/speaking-result-next.png).

Chạy riêng: `node tests/run.cjs study-mobile-next.cjs ui-experience.cjs study-shortcuts.cjs pronunciation-mobile.cjs`.

Suite `study-mobile-next.cjs` dùng Chrome giả lập touch, kiểm tra tọa độ và `elementFromPoint()` trước khi chạm nút tiếp. Không dùng `force:true` để vượt qua phần tử che khuất.

Các tình huống:

1. Bài một câu `你好`: 390×844 và 360×640, nút tiếp trên navigation và nhận chạm; focus vẫn ở input trước khi người dùng chọn nút tiếp.
2. Composition đang chứa `你好`: chưa chấm, chưa bật nút tiếp, không cuộn; compositionend mới hoàn tất câu và reveal.
3. Bàn phím của ứng dụng mở/đóng: nút tiếp ở trên phần che thực tế, không cộng trùng khoảng navigation.
4. Visual viewport giả lập co từ 844 xuống 500 px khi layout viewport giữ nguyên: có đủ khoảng cuộn; khôi phục viewport thì inset bổ sung trở về 0.
5. Câu nhiều dòng, nghĩa dài và bật/tắt nghĩa: hành động hoàn thành vẫn truy cập được.
6. Người dùng cuộn có chủ đích hoặc mở Tùy chọn trong cùng lượt render: không bị tác vụ reveal kéo trang/giành focus hộp thoại.
7. Chuyển sang Sảnh game ngay sau khi chấm đúng: tác vụ cũ không cuộn màn hình mới.
8. Hoàn tất lượt nói trên bài dài bằng final ASR mô phỏng: nút tiếp hiện trong vùng an toàn và chuyển sang bước tiếp được.

Sự kiện composition, ASR và visual viewport trong test là mô phỏng logic. Chưa chứng minh hành vi bàn phím tiếng Trung thật, thay đổi thanh URL hoặc chính sách trình duyệt trên Android/iPhone.

## Nghiệm thu còn lại

- Chrome Android và Safari iPhone: gõ qua IME tiếng Trung, chọn chữ bằng thanh gợi ý, chốt câu, mở/đóng keyboard, bật/tắt nghĩa và chuyển câu.
- Kiểm tra kết quả nói dài và thao tác tự cuộn đọc kết quả; ứng dụng không được kéo người dùng trở lại nút tiếp khi họ chủ động đọc phần khác.
- Chạy checklist thiết bị thật của đợt 5 cho toàn bộ MOB-01 đến MOB-07.
- Chưa triển khai lên môi trường bên ngoài.
