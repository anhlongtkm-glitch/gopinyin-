# Kiểm tra Pinyin toàn bộ dữ liệu cục bộ — 30/10/2026

## Kết luận

Có lỗi âm đọc ngay trong dữ liệu nguồn, ngoài vấn đề căn chữ. Kiểm tra hiện tại không đủ để phát hiện câu đủ số âm tiết nhưng âm đọc không thuộc chữ Hán tương ứng. Thay font hoặc đổi sang ruby chỉ giải quyết cách trình bày.

Đây là báo cáo rà soát và phương án xử lý; chưa thay dữ liệu bài học, cơ chế luyện/chấm hoặc bản website đang chạy.

## Ví dụ người dùng cung cấp

- Chữ: `请确认一下尺寸。`
- Phiên âm chép từ ảnh để tái hiện: `qǐng qùn rèn yī xià chǐ cùn`.
- Theo quy ước thanh gốc đã chọn: **`qǐng què rèn yī xià chǐ cùn`**. Lỗi cần sửa là âm của `确`: `què`, không phải `qùn`.
- Cả `aiItemOk()` và `alignPinyinToHanzi()` đều chấp nhận bản sai trong phép thử thực tế với các hàm nguồn.
- Không tìm thấy nguyên câu này trong toàn bộ nội dung tĩnh đã quét. Chưa xác định ảnh thuộc bản triển khai nào hoặc bộ AI/bộ đã lưu nào. Không truy cập dữ liệu tài khoản hay bộ cá nhân trong lần kiểm tra này.

## Phạm vi và kết quả

Quét **47.663 mục học và 26 ánh xạ hỗ trợ thay chữ Latin**, tổng **47.689 mục nguồn**, bằng mã chuẩn hóa, sửa nguồn và ánh xạ hiện có. Ngoài ra tái tạo **4.334 từ dẫn xuất** từ luồng game cũ để kiểm tra riêng. Các số này tính theo mục xuất hiện, có nội dung trùng nhau; không phải số từ duy nhất.

Đối chiếu với `pinyin-pro@3.29.5`, tắt biến điệu `toneSandhi`, giữ phân biệt `u/ü`. Thư viện chỉ cung cấp dữ liệu tham chiếu để sàng lọc, không cấp chứng nhận đúng ngữ cảnh.

| Nhóm | Số mục | Không ánh xạ đầy đủ | Có âm cơ sở không khớp các âm thư viện biết |
| --- | ---: | ---: | ---: |
| HSK 1–9 | 4.969 | 0 | 7 |
| Chủ đề, bao gồm TOCFL | 41.621 | 69 | 273 |
| Panda | 700 | 0 | 0 |
| Câu hội thoại bài đọc | 252 | 0 | 0 |
| Từ vựng bài đọc | 78 | 0 | 0 |
| Cặp thanh điệu trong catalog | 43 | 0 | 0 |
| Ánh xạ hỗ trợ thay chữ Latin | 26 | 0 | 0 |
| Game cũ, từ dẫn xuất, tính riêng | 4.334 | 1 | 3 |

Hai mục chủ đề chứa chữ không có âm đọc trong thư viện được ghi riêng là `reference-unknown`, không tính thành lỗi âm cơ sở. Có **318 chuỗi chữ giống nhau nhưng phiên âm khác nhau** giữa các mục, bao gồm ánh xạ hỗ trợ; khác biệt này có thể do nghĩa, âm nhẹ, biến điệu hoặc lỗi, phải xem xét ngữ cảnh.

Tổng cộng **4.937 mục nguồn có ít nhất một cờ cần xem xét**: lệch ánh xạ, âm không khớp, thiếu tham chiếu, thanh điệu hoặc khác kết quả chuyển âm theo ngữ cảnh. Đây **không phải 4.937 lỗi đã xác nhận**. Đặc biệt, âm nhẹ có thể không nằm trong tập âm đọc độc lập của từng chữ. Mục không có cờ cũng chưa được coi là đã duyệt.

### Lỗi nguồn có thể thấy rõ

Vị trí bên dưới dùng chỉ số từ 0 trong dữ liệu, không phải số thứ tự hiển thị trong lượt luyện.

| Vị trí | Chữ/cụm trong câu | Đang có | Cần sửa |
| --- | --- | --- | --- |
| `hsk4:48` | 塑料袋 | sù le dài | sù liào dài |
| `hsk5:48` | 饮料 | yǐn le | yǐn liào |
| `hsk6:140`, `hsk6:634`, `hsk7:76` | 资料 | zī le | zī liào |
| `hsk6:208` | 聊了 | le le | liáo le |
| `hsk6:222` | 不料 | bù le | bù liào |
| `tu_vung_van_phong_pham:24` | 编辑 | biànjiān | biān jí |
| `tu_vung_cong_viec_nghe_nghiep:62` | 时尚零售员 | shíshàng língxiāoyuán | shí shàng líng shòu yuán |

Một số mục có dấu hiệu sai cả chữ Hán so với nghĩa Việt: `打片 / dāopiàn / Lưỡi lam`, `塑纸机 / suìzhǐjī / Máy hủy giấy`. Cần duyệt cả ba trường chữ–âm–nghĩa; không tự đổi Pinyin để khớp chữ đang sai.

## Vì sao lỗi lọt qua

1. `answerWords()` tin trường `py` sau chuẩn hóa và bảng sửa cụ thể. Chuẩn hóa không kiểm chứng âm đọc thuộc chữ nào.
2. `alignPinyinToHanzi()` kiểm tra khả năng ghép số lượng/vị trí. Bảy âm sai vẫn ghép đủ bảy chữ; đó là lý do ví dụ ảnh vượt qua kiểm tra.
3. `aiItemOk()` dùng số nhóm nguyên âm, và miễn kiểm tra lệch số lượng cho mọi câu có `儿`. Phép thử `儿子学习汉语 / ér` vẫn được chấp nhận.
4. Luồng game cũ dùng `sentenceToWords()` riêng và điều kiện `/r$/` dễ nhầm `ér` độc lập với đuôi 儿 hóa. Phép thử `女儿儿子 / nǚ ér ér zi` không tạo được từ nào. Pool dẫn xuất còn có mục `儿` với phiên âm rỗng; bộ lọc game có thể loại mục này sau đó, nên đây chưa phải bằng chứng nó xuất hiện trên màn hình.
5. Panda dùng dữ liệu và hàm bỏ dấu riêng. Bài đọc hiển thị `py` trực tiếp. Chưa có quy tắc kiểm chứng chung bao phủ mọi nơi.
6. Báo cáo/test cũ xác nhận cấu trúc, không xác nhận đầy đủ ngôn ngữ. Hai bộ kiểm thử hiện có vẫn đạt **11/11 kiểm tra** trong khi dữ liệu chứa các ví dụ lỗi trên.

## Phương án xử lý

### 1. Kiểm chứng nội dung trước khi mở luyện

- Dùng ba trạng thái `pending`, `verified`, `invalid`. Chỉ `verified` được đưa vào Gõ, Nói, bài đọc tương tác và game. `pending` vẫn được lưu, xem và sửa; không dùng để chấm hoặc tăng tiến độ.
- Chỉ xác nhận tự động khi toàn bộ từ/cụm khớp một mục từ có âm đọc duy nhất trong nguồn từ điển được cố định phiên bản và ghi xuất xứ. Ghép nhiều mục từ thành câu không tự chứng minh đúng ngữ cảnh; đưa sang duyệt.
- Câu đa nghĩa, tên riêng, bất đồng giữa nguồn hoặc sai chữ–nghĩa cần duyệt ngôn ngữ. Không đánh dấu đúng vì hai bộ chuyển âm tự động cùng cho một kết quả.
- Dùng CC-CEDICT làm nguồn đối chiếu mục từ ban đầu, ghi nguồn và tuân thủ giấy phép; người duyệt xử lý ca khó. Tệp biên tập lưu chữ, âm tiết, nguồn, người duyệt và phiên bản.
- Trạng thái duyệt phải gắn với nội dung chữ–âm–nghĩa và phiên bản. Sửa nội dung thì mất hiệu lực xác nhận; dữ liệu nhập từ người dùng không được tự khai `verified` để bỏ qua kiểm chứng.

### 2. Một kết quả chuẩn cho mọi màn

- Thêm bộ xử lý chung trả về âm tiết có dấu, ánh xạ tới khoảng chữ, trạng thái và bằng chứng. Mỗi consumer dùng kết quả này, kể cả tooltip, bài đọc, game và bản dữ liệu đã lưu.
- Dùng thanh gốc cho đáp án. Hướng dẫn biến điệu khi nói trình bày riêng; không tự đổi đáp án luyện gõ theo giọng TTS.
- Giữ riêng âm tiết và ánh xạ: `女儿 = nǚ ér`, `玩儿 = wánr`. Không lặp âm để bù thiếu hoặc đoán theo số chữ.
- Thay kiểm tra số nhóm nguyên âm trong AI bằng kiểm tra cấu trúc thực, âm hợp lệ theo chữ, rồi kiểm chứng từ/câu. Bỏ ngoại lệ miễn kiểm tra chỉ vì có `儿`.
- Không tự thay chữ Latin bất kỳ trong câu AI bằng chữ Hán theo bảng A→甲, B→乙… để hợp thức hóa câu: phép thay đó có thể làm đổi nghĩa. Trả câu về chờ duyệt hoặc tạo lại, trừ khi ký hiệu được định nghĩa rõ trong nội dung đã kiểm chứng.
- Sửa nguồn đã xác nhận, đồng thời hỗ trợ bản lưu cũ qua bản chuẩn có phiên bản. Giữ ID/tiến độ, không đánh lại chỉ số khi loại câu khỏi lượt luyện.

### 3. Hiển thị và ngăn tái phát

- Dùng `ruby/rt` hoặc các ô ghép chữ–âm từ cùng ánh xạ; chữ và chú âm luôn xuống dòng cùng nhau. 儿 hóa là cụm chú âm chung; dấu câu không lấy âm tiết.
- Font chỉ cần hỗ trợ đủ dấu Unicode. Không dùng font gắn cứng một âm cho mỗi chữ làm nguồn đáp án.
- CI phải chặn mục khai đã duyệt nhưng thiếu bằng chứng, âm tiết không hợp lệ, ánh xạ thiếu/thừa hoặc nội dung thay đổi sau duyệt. Mục chờ duyệt được báo số lượng và bị loại khỏi lượt luyện, không làm mất bản gốc.
- Thêm hồi quy cho câu trong ảnh, bảy câu HSK kể trên, 儿 độc lập/儿 hóa, âm nhẹ, `u/ü`, chữ đa âm theo nghĩa, Unicode, dấu câu và dữ liệu cũ. Kiểm tra cả hiển thị lẫn đáp án dùng cùng kết quả.
- Kiểm tra mobile/desktop/phóng to 200% để phát hiện lệch vị trí. Kiểm tra chuyển Gõ/Nói, chọn game, khôi phục tiến độ và trường hợp bộ không còn câu đã duyệt.
- Triển khai sau khi có tập nội dung duyệt ban đầu và báo cáo số câu dùng được; chấp nhận giảm số bài theo lựa chọn của người dùng.

Không thể bảo đảm mọi bản biên tập hoặc thư viện sẽ không bao giờ sai. Có thể bảo đảm về kỹ thuật rằng **nội dung chưa đạt điều kiện kiểm chứng không được âm thầm đưa vào luyện/chấm**. Độ đúng ngôn ngữ vẫn cần nguồn và duyệt phù hợp.

## Tái chạy và bằng chứng

Script: `scripts/audit-pinyin.cjs`. Script chỉ đọc nguồn và xuất báo cáo, không sửa dữ liệu hoặc tự xác nhận câu.

```powershell
npm.cmd pack pinyin-pro@3.29.5 --pack-destination .cache --ignore-scripts
New-Item -ItemType Directory -Force .cache/pinyin-reference
tar -xzf .cache/pinyin-pro-3.29.5.tgz -C .cache/pinyin-reference
node scripts/audit-pinyin.cjs
node tests/run.cjs pinyin-tokenizer.cjs pinyin-alignment.cjs
```

- Chi tiết từng mục và mã băm nguồn: `.cache/pinyin-full-audit.json`.
- Kết quả kiểm thử hiện có: `.cache/test-run/results.json` — 2 bộ, 11 kiểm tra đạt.
- Kiểm tra cú pháp script và tính nhất quán số mục, tái hiện ảnh: đạt.
- Chưa kiểm chứng thủ công toàn bộ 47.663 mục; chưa đọc dữ liệu cá nhân/đám mây; chưa kiểm tra trực tiếp website đang hoạt động.

Nguồn tham khảo:

- [pinyin-pro: chuyển âm](https://pinyin-pro.cn/use/pinyin.html).
- [pinyin-pro: tập âm đọc từng chữ không phải quyết định âm đúng trong câu](https://pinyin-pro.cn/use/polyphonic.html).
- [CC-CEDICT và giấy phép](https://cc-cedict.org/wiki/).
- [W3C: chú âm ruby](https://www.w3.org/International/questions/qa-ruby.en.html).
