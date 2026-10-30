# Panda Du Hành — Kế hoạch thiết kế lại toàn bộ game

Cập nhật: 29/10/2026. Giao diện và cơ chế chơi đã có bản triển khai; [tình trạng thực tế, quảng cáo và phạm vi cạnh tranh](PANDA-DU-HANH-IMPLEMENTATION.md). Tài liệu này giữ kế hoạch tổng thể, gồm cả phần phát triển tiếp.

## Yêu cầu và hướng thiết kế

Chơi theo chủ đề Gia đình, Ăn uống… thay cho HSK. Bấm Chơi sẽ mở quảng cáo trước ván. Thiết kế lại nhịp chơi, cách tính điểm và mục tiêu để có chiến thuật và cạnh tranh.

Phạm vi mới: làm lại toàn bộ diện mạo với tên **Panda Du Hành** và câu giới thiệu **Gõ chữ, chinh phục thiên hà.** Gấu trúc GoPinyin ngồi lái phi thuyền khám phá các hành tinh từ vựng. Làm mới sảnh, chọn chủ đề, nền, phi thuyền, đạn, mục tiêu, HUD, hiệu ứng, âm thanh và mọi màn kết quả/trạng thái phụ.

Định hướng mỹ thuật và tài nguyên: [PANDA-DU-HANH-ART-DIRECTION.md](PANDA-DU-HANH-ART-DIRECTION.md). [Các bản concept gameplay](../design-review/panda-du-hanh/README.md) lưu hướng hình ảnh; v1 bị loại vì gấu nhìn ra người xem và tàu quá lớn. Bản đang chơi phải nhìn gấu từ phía sau/hơi trên cao, hướng vào mục tiêu và dùng tàu nhỏ. Thay đổi giới hạn trong khu vực game và điểm giới thiệu game; giữ thương hiệu chung GoPinyin.

Đề xuất: ván 90 giây, ba mạng, ba đợt tăng nhịp; giữ combo, săn thẻ thưởng, tích kỹ năng và hoàn thành nhiệm vụ cuối ván. Các thông số bên dưới là cấu hình ban đầu cần chơi thử, chưa phải kết quả cân bằng đã kiểm chứng.

## Căn cứ từ cơ chế cũ trước khi triển khai

- Nguồn từ lấy theo HSK trong src/features/game/words.js; game chưa chọn theo chủ đề.
- Chủ yếu bắn tiếp đến hết mạng; chặng đổi phong cảnh nhưng chưa tạo nhiều mục tiêu ngắn hạn.
- Điểm mỗi từ bằng combo hiện tại, tăng không giới hạn; chuỗi dài lấn át các yếu tố khác.
- Cho tùy chỉnh tốc độ, mật độ và cộng mạng nên chưa có điều kiện đồng nhất để so điểm.
- watchAd() trong controller.js chỉ đếm ngược ba giây, chưa có SDK quảng cáo thật.
- Giữ ưu điểm: gõ Pinyin không dấu, khóa mục tiêu, giữ phần gõ đúng khi nhập sai, Backspace đổi mục tiêu, đọc từ và bàn phím ảo.

## 1. Chủ đề là đơn vị nội dung

Bỏ bộ chọn HSK khỏi game. Màn chọn chủ đề có minh họa, tên, số từ đã duyệt và kỷ lục cá nhân.

| Chủ đề | Nội dung | Nhiệm vụ cuối ván minh họa |
| --- | --- | --- |
| Gia đình | Thành viên, quan hệ, sinh hoạt | Hoàn thiện ảnh gia đình |
| Ăn uống | Món ăn, nguyên liệu, gọi món | Hoàn thành đơn gọi món |
| Đồ uống | Nước, trà, cà phê, yêu cầu khi gọi | Pha đủ đơn đồ uống |
| Trường học | Đồ dùng, lớp học, hoạt động | Chuẩn bị đủ cặp sách |
| Du lịch | Phương tiện, địa điểm, chỗ ở | Hoàn tất hành trình |
| Mua sắm | Hàng hóa, giá cả, thanh toán | Hoàn thiện giỏ hàng |

Nguồn đã kiểm tra: assets/vocab-pack.js có 206 bộ; Gia đình 187 dòng, Món ăn 426 dòng, Gọi đồ uống 47 dòng. src/features/library/catalog.js đã có bộ tải và bộ đọc dữ liệu chủ đề.

Đây là số dòng dữ liệu thô, chưa phải số từ sẵn sàng chơi. Bộ Gia đình có cả thành ngữ và từ ít gặp. Cần duyệt Hán tự, Pinyin, nghĩa Việt; loại mục lỗi và trùng. Bản đầu tập trung Gia đình và Ăn uống, mỗi chủ đề khoảng 30–50 từ thông dụng đã duyệt; hiển thị số thật sau khi duyệt.

Manifest game lưu topicId, wordId, Hán tự, Pinyin có dấu/chuẩn hóa, nghĩa, độ khó và contentVersion. Ăn uống có thể gộp nhiều nguồn nhưng chỉ lấy danh sách được duyệt. Độ khó dựa trên tính thông dụng, độ dài và nhịp chơi, không đổi tên HSK thành chủ đề.

## 2. Quảng cáo ngay sau khi bấm Chơi

Luồng: Chọn chủ đề + chế độ → Chơi → Quảng cáo → Đếm ngược 3–2–1 → Ván chơi → Kết quả.

- Kiểm tra đăng nhập cần thiết và tải bộ từ trước khi nút Chơi sẵn sàng. Bấm Chơi là yêu cầu quảng cáo ngay; không thêm nút Bắt đầu thứ hai sau quảng cáo.
- Dòng giải thích dưới nút: “Có quảng cáo trước mỗi ván mới”.
- Tích hợp SDK thật; thời lượng và nút bỏ qua theo định dạng/nhà cung cấp đã chọn. Không dùng đếm ngược ba giây giả quảng cáo.
- Trong quảng cáo, đồng hồ, thẻ và âm thanh game chưa chạy. Chỉ vào đếm ngược sau sự kiện kết thúc hợp lệ của SDK.
- Chặn bấm nhiều lần và callback trùng. Rời màn thì callback muộn không được tự mở lại game.
- Chơi lại tạo ván mới nên đi qua quảng cáo. Tiếp tục ván luyện đang dở không phát lại.
- Khi quảng cáo lỗi/không có lượt phân phối, mặc định đề xuất thông báo ngắn rồi cho chơi; không treo màn hình hay lặp yêu cầu quảng cáo.
- Quảng cáo đầu ván không cộng điểm, mạng hay lợi thế. Không chen quảng cáo giữa ván; bỏ hồi sinh bằng đếm ngược hiện tại.
- Chưa chọn mạng quảng cáo. Việc triển khai phải chọn nhà cung cấp và nối SDK phù hợp; bản phát triển ghi rõ trạng thái thử nghiệm.

## 3. Nhịp một ván 90 giây

| Thời gian | Cơ chế | Quyết định |
| --- | --- | --- |
| 0–30 giây | Từ ngắn, ít mục tiêu, tốc độ vừa | Giữ chính xác và tích combo |
| 30–60 giây | Thêm từ dài, tăng nhịp có giới hạn | Ưu tiên thẻ nguy hiểm hay thẻ thưởng |
| 60–90 giây | Cao trào và ba thẻ nhiệm vụ | Dùng kỹ năng, hoàn thành mục tiêu cuối |

Bắt đầu ba mạng. Thẻ qua vạch mất một mạng; hết mạng kết thúc sớm. Gõ sai đặt combo về 0, giữ phần đã gõ đúng và không trừ mạng. Ván thi đấu không hồi sinh.

Tốc độ tính theo thời gian thẻ đi hết sân, tránh màn cao có nhiều thời gian hơn. Giới hạn mật độ để chữ không chồng nhau. Không sinh từ dài đòi nhiều thời gian hơn phần ván còn lại.

Trong 30 giây cuối, ba thẻ nhiệm vụ có đánh số xuất hiện lần lượt. Gõ như thẻ thường; hoàn thành cả ba nhận thưởng nhiệm vụ một lần. Từ nhiệm vụ vẫn thuộc bộ đã duyệt, không tự sinh cụm từ sai hoặc ngoài chủ đề.

## 4. Ba cơ chế tạo hứng thú

### Combo có giới hạn

Một từ hoàn thành không gõ sai được tính là một từ sạch.

- Chuỗi 0–4 từ sạch: ×1; 5–9: ×1,5; 10–14: ×2; từ 15: ×3.
- Gõ sai hoặc bỏ lỡ thẻ đặt lại chuỗi. Từ từng có lỗi vẫn có điểm cơ bản khi hoàn thành, nhưng không hưởng hệ số chuỗi sạch.
- Hệ số mới áp dụng từ từ tiếp theo sau khi đạt ngưỡng.
- HUD hiện hệ số và số từ còn thiếu để lên mức kế tiếp.

### Thẻ vàng

Xuất hiện theo lịch cố định, ví dụ giây 20 và 45. Bắn sạch được cộng thêm 200 điểm; bỏ lỡ vẫn mất một mạng như thẻ thường. Có nhãn “Thưởng”, không chỉ đổi màu. Người chơi cân nhắc giữ mạng hay giành thưởng.

### Kỹ năng Tập trung

Mỗi năm từ sạch nạp một lần, giữ tối đa một lần. Nút Tập trung hoặc Shift khi vùng game nhận phím làm chậm thẻ trong bốn giây. Không kéo dài ván, không tự bắn hoặc cộng điểm miễn phí; đồng hồ và lịch xuất hiện tiếp tục chạy. Giới hạn mật độ để không dồn đám thẻ.

Kỹ năng là hạng mục thử nghiệm sau khi luật cơ bản ổn. Chơi thử để quyết định nó có tạo lựa chọn hữu ích và dễ hiểu không.

## 5. Cách tính điểm

Điểm cơ bản mỗi từ = 100 + 10 × min(số ký tự Pinyin cần gõ, 8).
Điểm từ = điểm cơ bản × hệ số combo hợp lệ.

- Không cộng điểm theo từng phím, tránh gõ dở rồi đổi mục tiêu để tích điểm.
- Thẻ vàng sạch: +200, không nhân combo.
- Hoàn thành ba thẻ nhiệm vụ: +500 một lần.
- Bản đầu không cộng thêm theo mạng còn lại hoặc phản xạ; giữ công thức dễ giải thích.
- Kết quả tách điểm từ, thưởng vàng, thưởng nhiệm vụ. Mỗi cấu hình có rulesVersion để không trộn điểm sau thay đổi luật.

## 6. Chế độ và cạnh tranh

| Chế độ | Điều kiện | Thành tích |
| --- | --- | --- |
| Luyện chủ đề | Chỉnh tốc độ, hiện Pinyin, tạm dừng và ôn lỗi | Tiến bộ và kỷ lục luyện riêng |
| Thử thách 90 giây | Chủ đề đã chọn, luật cố định, ẩn Pinyin, ba mạng | Kỷ lục cá nhân và bảng theo đề |
| Thử thách hôm nay | Một đề chủ đề chung trong ngày | Bảng ngày với cùng điều kiện |

Bản đầu làm Luyện chủ đề và Thử thách 90 giây; bảng công khai và thử thách ngày triển khai sau khi có xác thực kết quả.

Quy tắc bảng thi đấu:

- Cùng bảng phải có cùng challengeId, topicId, contentVersion, rulesVersion và seed/lịch mục tiêu. Không cộng điểm thô của các đề khác nhau để xếp hạng.
- Bàn phím thật/ảo có bảng hoặc bộ lọc riêng; đổi cách nhập giữa ván chuyển kết quả sang luyện và thông báo rõ.
- Cùng số làn và thời gian thẻ sống trên mọi màn hình; bố cục không được tạo thêm thời gian đọc trên desktop.
- Một tài khoản giữ điểm tốt nhất của đề, được chơi lại. Bằng điểm xét độ chính xác, rồi combo cao nhất; vẫn bằng thì đồng hạng.
- Hiện khoảng cách tới kỷ lục hoặc hạng kế tiếp nếu có dữ liệu thật. Không tạo người chơi, lượt chơi hoặc thứ hạng giả.
- Bảng chưa có người khác thì tập trung kỷ lục cá nhân và mốc huy chương đã cân bằng theo đề.
- Thi đấu không cho tạm dừng để tra từ. Rời tab, mở hộp thoại hoặc cần tạm dừng bảo toàn thao tác nhưng chuyển kết quả sang luyện, có thông báo. Luyện vẫn tạm dừng bình thường.
- Trước khi mở bảng công khai cần máy chủ cấp mã ván/đề, nhận sự kiện có giới hạn, đối chiếu mục tiêu/thời gian và tính lại điểm. Không tin tổng điểm do trình duyệt gửi.
- Mất mạng lúc gửi không xóa kết quả cá nhân; ghi “Chưa xác nhận”. Gửi lại cùng mã ván không tạo bản ghi trùng.

Bảng game cũ từng được gỡ bỏ. Đề xuất mới là bảng theo đề/chủ đề để đáp ứng yêu cầu cạnh tranh hiện tại, không cộng lại điểm game vào xếp hạng học tập.

## 7. Ví dụ một ván Gia đình

1. Chọn Gia đình, Thử thách 90 giây, bấm Chơi → quảng cáo → 3–2–1.
2. Bắn các từ đã duyệt, ví dụ 爸爸, 妈妈, 哥哥, 妹妹; giữ năm từ sạch để mở hệ số mới và tích kỹ năng.
3. Thẻ vàng xuất hiện; quyết định cứu thẻ gần vạch hay giành thưởng.
4. Giai đoạn cuối hoàn thành ba thẻ đánh dấu để hoàn thiện “Ảnh gia đình”.
5. Xem điểm, kỷ lục, độ chính xác và từ cần ôn. Chơi lại đi qua quảng cáo đầu ván mới.

Với Ăn uống, bộ từ và nhiệm vụ đổi thành “Đơn gọi món”; cách gõ giữ nhất quán.

## 8. Nhận xét cuối ván và giá trị học tập

Mẫu minh họa, không phải kết quả đo hiện tại:

> Gia đình · 4.280 điểm · Kỷ lục mới!
> Bạn hoàn thành 26 từ, độ chính xác khi gõ 94%, combo cao nhất 12.
> Bạn đã hoàn thành Ảnh gia đình. Hai từ nên ôn: 哥哥 và 妹妹.

- Nhận xét theo dữ liệu; không khen chung mọi kết quả.
- Độ chính xác = phím đúng / (phím đúng + phím sai) được bộ xử lý chấp nhận; không tính Shift, phím tắt, modifier hoặc sự kiện IME bỏ qua.
- Không nhập thì hiện “Chưa có dữ liệu”; không mặc định 100%.
- Phân biệt lượt hoàn thành với số từ khác nhau. Danh sách ôn gộp theo wordId, giữ lý do gõ sai, bỏ lỡ hoặc dùng gợi ý.
- Không đánh giá phát âm/thanh điệu từ việc gõ không dấu.
- Hành động: Chơi lại, Đổi chủ đề, Ôn từ sai. Ôn từ mở phần học/ôn; tạo ván game mới vẫn đi qua quảng cáo.

## 9. Giao diện phục vụ cơ chế mới

HUD: Chủ đề · Thời gian · Điểm · Lá chắn. Ba mạng thể hiện bằng ba mức lá chắn cho hợp bối cảnh; đây là đổi hình ảnh, không đổi luật. Dòng phụ: combo và tiến độ ngưỡng tiếp theo; nhiệm vụ hiện ngắn khi vào đợt cuối. Mobile chia hai hàng; sân chơi chiếm phần lớn khung. Kỹ năng có nút rõ, trạng thái đã nạp và thời gian hiệu lực.

Bỏ dãy HSK và thanh trượt khỏi màn đang chơi. Dùng Hán tự nổi bật, nghĩa Việt hỗ trợ; Pinyin chỉ hiện trong luyện khi bật gợi ý. Mỗi chủ đề có chi tiết nền riêng, cùng hệ thống thẻ/điều khiển.

Theo design-system/gopinyin/MASTER.md: xanh ngọc, mascot, Inter/Noto Sans SC, vùng bấm tối thiểu 44×44px, focus rõ. Giảm hạt/rung/chớp khi yêu cầu giảm chuyển động; hiệu ứng không được che chữ hoặc thay đổi nhịp nhập.

Gấu thực sự ngồi trong buồng lái kính, quay về mục tiêu phía trên sân. Gameplay nhìn từ phía sau/hơi trên cao, thấy sau đầu trắng ngà, tai emerald và khăn xanh; không dùng chân dung nhìn camera. Tàu nhỏ ở giữa đáy, khoảng 7–10% chiều cao màn hình. Thân/gấu nghiêng nhẹ theo hướng mục tiêu; nòng bắn ngắm riêng để tránh xoay nhân vật cực đoan. Hero sảnh/kết quả có thể nhìn từ trước. Phi thuyền trắng–ngọc, đạn năng lượng, nền vũ trụ xanh chàm; thẻ là khoang dữ liệu có mặt đọc phẳng. Chữ và điều khiển luôn dựng bằng mã, không nhúng vào ảnh.

Làm mới cả thẻ game, sảnh, chọn hành tinh, chuẩn bị, quảng cáo/tải/lỗi, đếm ngược, chơi, bàn phím, nhiệm vụ, tạm dừng, hết giờ/mạng, kết quả, bảng theo đề và ôn từ. Giao diện game có tài liệu riêng, không ghi đè MASTER của toàn ứng dụng.

Sửa nội dung cũ về Esc, thẻ tim, âm thanh và quảng cáo. Thi đấu không có thẻ cộng mạng; không để luật cũ lẫn luật mới.

## 10. Triển khai theo giai đoạn

| Giai đoạn | Công việc | Đầu ra kiểm tra |
| --- | --- | --- |
| 0. Nhận diện và mỹ thuật | Panda Du Hành; concept, gấu lái phi thuyền, mẫu màn desktop/mobile và bộ asset | Hình ảnh thống nhất và dùng được ở kích thước chơi thật |
| 1. Nội dung và luật | Duyệt Gia đình/Ăn uống, topicId, ván 90 giây, ba mạng, combo giới hạn | Prototype chơi được; từ đúng chủ đề, điểm đúng |
| 2. Quảng cáo và luồng | Chọn nhà cung cấp, nối SDK, đếm ngược, lỗi/callback/rời màn | Mỗi lần Chơi tạo đúng một quảng cáo và một ván |
| 3. Nhịp chơi | Ba đợt, thẻ vàng, nhiệm vụ cuối, thử kỹ năng, ôn lỗi | Chơi thử và cân bằng trên desktop/mobile |
| 4. Cạnh tranh | Kỷ lục theo đề, mã ván, tính điểm phía máy chủ, bảng theo đề, thử thách ngày | Chỉ kết quả hợp lệ vào bảng công khai |
| 5. Hoàn thiện | Chủ đề thêm đã duyệt, responsive, âm thanh, hiệu năng | Dễ đọc, dễ thao tác, không che sân |

Phạm vi mã nguồn:

- game/words.js và module nội dung dùng chung: lấy bộ theo chủ đề, chuẩn hóa và chọn từ theo đề.
- game/session.js, engine.js, entities.js, loop.js: đồng hồ, đợt, điểm, mạng, kỹ năng và nhiệm vụ.
- game/controller.js, events.js, input.js: chọn chủ đề → quảng cáo → đếm ngược → chơi → kết quả; nhập và khóa thao tác.
- game/view.html, styles.css, render.js, ship.js, scenery.js: giao diện và phản hồi.
- features/games/view.html, styles.css và metadata điều hướng: tên, thẻ giới thiệu, ảnh và nhãn truy cập mới. Không cần đổi route nội bộ chỉ để đổi tên hiển thị.
- assets/game/panda-du-hanh/: tài nguyên mới khi sản xuất, tách khỏi bộ mascot đang dùng ở màn học. Hero và sprite chơi là hai loại đầu ra riêng.
- Module quảng cáo riêng để tách SDK khỏi luật game.
- Kết quả lưu topicId, challengeId, contentVersion, rulesVersion, inputMode. Đọc dữ liệu cũ tương thích, không quy đổi điểm HSK vào bảng mới.
- API xác thực ván và bảng theo đề cần thiết kế ở giai đoạn cạnh tranh công khai; chưa giả định backend hiện tại đã đáp ứng.
- Giữ ID/data-attribute cần cho bộ điều khiển hoặc cập nhật đồng bộ kiểm thử khi thay. Không sửa trực tiếp dist/.

## 11. Tiêu chí nghiệm thu

- Game không còn chọn HSK; chỉ sinh từ thuộc manifest đã duyệt của chủ đề.
- Tên Panda Du Hành nhất quán; toàn bộ màn game có thiết kế mới. Gameplay có gấu ngồi quay về mục tiêu, nhìn từ sau/hơi trên cao; tàu nhỏ 7–10% chiều cao màn ở giữa đáy. Nòng ngắm riêng, không xoay nhân vật cực đoan; đạn xuất phát đúng vị trí ở mọi viewport/DPR.
- Nền, hiệu ứng và sprite không đổi đề, điểm hoặc thời gian nhập. Chữ luôn đọc được; giảm chuyển động không đổi luật chơi.
- Quảng cáo thật trước ván; double-click, callback trùng/muộn, lỗi, không có quảng cáo hoặc thoát màn không tạo ván trùng và không treo UI.
- Đồng hồ chưa chạy trong quảng cáo/đếm ngược. Không cộng lợi thế từ quảng cáo.
- Chuỗi nhập biết trước xác nhận điểm, ngưỡng combo, lỗi, bỏ lỡ, vàng, nhiệm vụ, kỹ năng; thưởng ghi đúng một lần.
- Cùng seed/luật/nội dung cho cùng đề; cùng sự kiện cho cùng điểm. Màn cao không kéo dài tuổi thẻ.
- Phiên luyện, bật gợi ý, đổi điều kiện hoặc đã tạm dừng không vào bảng chính thức.
- Kiểm tra 360/390/768/1024/1440px, màn ngang thấp, zoom 200%, bàn phím thật/ảo, khung app sáng/tối; mục tiêu và nút không bị che.
- Kiểm tra âm thanh, hai từ cùng chữ đầu, đổi mục tiêu, hết giờ/mạng, rời tab/màn; phím không cướp thao tác nút/select/hộp thoại.
- Khi triển khai chạy các bộ kiểm thử repo phù hợp và thêm kiểm thử có ý nghĩa cho bộ điểm, lịch ván, quảng cáo, xác thực kết quả.

## Căn cứ và giới hạn khảo sát

Đã đọc mã game, bộ tải thư viện và dữ liệu VOCAB_PACK. Quy chuẩn hình ảnh dựa trên design-system hiện có và tài liệu UI/UX đã đọc. Bản xem bố cục trước dùng build có sẵn ở 390×844 và 1440×900; chưa kiểm thử ván qua đăng nhập thật. Lần này chỉ cập nhật kế hoạch, chưa triển khai hoặc chạy kiểm thử gameplay.
