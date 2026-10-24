# Gopinyin 🐼 — Học gõ Pinyin, nhận mặt chữ Hán & Từ vựng tiếng Trung

**Gopinyin** là một ứng dụng web học tiếng Trung (Mandarin) dành cho người Việt: học gõ Pinyin có dấu, nhận diện chữ Hán (nhận mặt chữ), học từ vựng, luyện nghe, và tạo câu bằng AI. Giao diện tối giản, nhiều hiệu ứng, có chế độ Sáng/Tối, âm thanh tương tác và chế độ Pro nâng cao.

> Mã nguồn HTML/CSS/JS được chia theo tính năng trong `src/`. Chạy `npm install` lần đầu, sau đó `npm start` để phát triển hoặc `npm run build` để tạo website tĩnh trong `dist/`. Dữ liệu được nhúng từ `src/data/catalog.js`; tiến độ và cấu hình trình duyệt giữ nguyên.

## Phát triển và tìm mã nguồn

```bash
npm install       # lần đầu; dùng npm ci khi cài đúng lockfile
npm start         # build + localhost:8080 + theo dõi thay đổi
npm run serve     # build + server, không tự mở trình duyệt
npm run build     # tạo dist/ để triển khai hoặc mở dist/index.html
npm test          # tự mở server riêng, chạy 11 bộ hồi quy
npm run test:build
```

**Chỉ sửa mã trong `src/`, không sửa `dist/`.** HTML, JS và CSS của từng chức năng nằm cạnh nhau trong `src/features/`. Hướng dẫn tìm file, thứ tự khởi tạo và kiểm thử: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> ⚠️ **ĐỪNG mở `dist/index.html` trực tiếp bằng `file://` nếu bạn dùng tính năng Luyện phát âm.**
> Chrome **không ghi nhớ quyền micro cho địa chỉ `file://`**, nên **mỗi lần bấm nút nói đều hỏi lại quyền** —
> đây là giới hạn của trình duyệt, không sửa được bằng JavaScript. Hãy chạy qua `http://localhost`:
> nháy đúp **`start.bat`** (Windows, sau khi cài dependencies) hoặc `npm start` → mở `http://localhost:8080`.
> Khi chạy qua `localhost`, quyền micro chỉ hỏi **một lần**.
> Nếu bạn đã dùng bản `file://` và có tài khoản/tiến độ ở đó, app có nút **“Chuyển sang localhost (giữ tiến độ)”**
> — dữ liệu `localStorage` được chuyển sang, không phải học lại từ đầu.

---

## ✨ Tính năng chính

| Khu vực | Mô tả |
|---|---|
| **Trang chủ (Landing)** | Hero, các module học, bảng giá Pro, FAQ, footer. Có hiệu ứng aurora, reveal khi cuộn, đếm số, glow theo chuột. |
| **Đăng nhập** | Modal đăng nhập / đăng ký (local demo, sẵn sàng gắn backend), hỗ trợ khách (guest) và Google (placeholder). |
| **Bảng điều khiển (Dashboard)** | Lộ trình hàng ngày, chuỗi ngày học (streak), tiến độ, thống kê, bài gần đây. |
| **Thư viện & Luyện gõ** | Bộ câu HSK 1–9 (**4.804 câu**), gõ Pinyin tự động thêm dấu thanh, dịch nhanh Google Translate popup. **HSK 1–3 miễn phí, HSK 4–9 cần Pro.** Màn luyện dùng **chung khung với Luyện phát âm** (xem mục *Khung học dùng chung*): thống kê + tiến độ → 3 nhóm công cụ → thẻ câu → chân thẻ, và **vừa đúng 1 khung hình, không phải cuộn**. Nhóm **📚 Nội dung** có sẵn danh sách bộ câu nên đổi bộ ngay tại chỗ. |
| **Từ vựng theo chủ đề** | **206 chủ đề · 41.621 từ** (chữ Hán + pinyin + nghĩa Việt) nhúng sẵn trong `assets/vocab-pack.js`, dùng **offline**. File được nạp lười khi mở chủ đề lần đầu nên không làm chậm trang. Thẻ chủ đề hiện số từ. |
| **Bàn phím ảo** | Nút ⌨️ cạnh ô gõ và trên thanh công cụ game → bật/tắt bàn phím QWERTY ngay trong trang, dùng được trên **máy tính bảng / điện thoại không có bàn phím**. Trong game, phím cần gõ tiếp theo được tô sáng; bật bàn phím ảo thì bàn phím hệ thống không bật lên nữa (`inputmode="none"`). |
| **Nhận mặt chữ Hán (mới)** | 4 chế độ: Hán→Việt, Việt→Hán, Nghe→Chọn, Từ vựng. 3 mạng sống, combo, điểm, HSK 4–9 yêu cầu Pro. |
| **Từ vựng** | Nhóm từ vựng, tra nhanh, phát âm. |
| **AI tạo câu** | Sinh câu tiếng Trung theo chủ đề (Gemini / OpenRouter). **Chỉ dành cho Pro.** |
| **Luyện phát âm (mới)** | Nói tiếng Trung bằng micro, chấm điểm từng chữ. **Vào mục là màn chọn bộ câu** (thẻ HSK 1–9 + bộ đã lưu, có thanh tiến độ riêng từng bộ) rồi mới vào luyện — giống luồng của màn Luyện gõ. Dùng **chung kho câu HSK** với Luyện gõ (không có bộ dữ liệu riêng), nên tiến độ và thứ tự câu khớp nhau. Màn luyện **vừa đúng 1 khung hình, không phải cuộn** (kết quả chấm nằm ở cột phải). Có nghe mẫu (zh-CN), đo âm lượng, tự dừng khi im lặng, chấm theo từng âm tiết, tô màu chữ đúng/cần sửa, nghe lại bản ghi, thống kê 6 chỉ số + lịch sử từng lượt. **Micro chỉ xin quyền 1 lần** cho cả phiên luyện. Xem mục **Chấm điểm phát âm** bên dưới để biết phần nào cần cấu hình thêm. |
| **Trò chơi "bắn chữ"** | Chữ Hán rơi xuống, gõ Pinyin để bắn nổ (cấp HSK 1–3 miễn phí, HSK 4–6 cần Pro). Tàu tự xoay nòng về thẻ đang gõ, mỗi ký tự đúng có tiếng bắn, gõ sai chỉ mất combo (không trừ điểm), có tạm dừng / chơi tiếp / toàn màn hình. |
| **Sảnh "Game từ vựng"** | Mục cha của các trò chơi: mỗi game là một **thẻ có ảnh đại diện (SVG)**, mô tả và nút chơi. Hiện có **🚀 Game bắn chữ** + 2 thẻ "Sắp ra mắt" (chỗ trống sẵn cho 2–3 game sau này). Bấm thẻ mới vào màn chơi; bấm ✕ trong game quay lại sảnh. Nút **"← Game từ vựng"** trên góc phải thanh tiêu đề cũng quay về đúng sảnh này. **Cách thêm game mới:** copy một `<button class="gameTile" data-view="…">` trong `src/features/games/view.html` (`#gamesCard`) rồi thêm `data-view` mới vào `VIEW_META` + `showView()` trong `src/app/navigation.js`. |
| **Bảng xếp hạng** | Số câu học **đúng** kèm điểm game bên cạnh, xem theo **Hôm nay** và **Tuần này** (câu sai không tính). Lưu cục bộ ở `gp:lb`, mỗi tài khoản một dòng. |
| **Dùng thử Pro 7 ngày** | Mỗi tài khoản mới được tặng **1 tuần dùng Pro miễn phí** (cấp ngay khi đăng ký/đăng nhập lần đầu, lưu ở `gp:trial:<email>`). Dashboard hiện băng đếm ngày + thanh tiến trình, modal Pro hiện "Còn N/7 ngày", sidebar đổi thành **TRIAL**. Hết hạn → tự khoá lại AI & HSK 4–9. |
| **Pro Upgrade** | Mở khóa nội dung sâu (HSK 4–9) + AI. Bảng giá ở landing có **công tắc Gói tháng / Gói năm**, mỗi khách nhận **mã QR động riêng** (đúng số tiền + nội dung `GOPINYIN {email}`), không dùng ảnh chụp tài khoản. |

## 🔊 Hiệu ứng & Âm thanh
- Hệ thống âm thanh **WebAudio tổng hợp** (không file audio): click, hover, tap, pop, correct, combo, whoosh, unlock, win, page.
- Hiệu ứng **confetti** (canvas) khi thắng/thăng hạng.
- Chủ đề **Sáng/Tối** tự động lưu.
- Hiệu ứng reveal, count-up, floating characters, mouse-glow.

---

## 📁 Cấu trúc thư mục

```
gopinyin/
├── src/
│   ├── index.html          # Khung HTML; @include ghép các màn khi build
│   ├── app/                # Entry, bootstrap, điều hướng, workspace, cấu hình
│   ├── features/           # HTML + JS + CSS theo chức năng
│   ├── shared/             # Modal, toast, storage, âm thanh, ngôn ngữ, khung học
│   ├── styles/index.css    # Thứ tự import CSS, giữ nguyên cascade
│   └── data/catalog.js     # Dữ liệu nhúng dùng chung
├── scripts/                # Build và môi trường phát triển
├── dist/                   # Sinh tự động; chỉ triển khai nội dung thư mục này
├── start.bat               # Windows: chạy http://localhost:8080 (cần cho micro)
├── package.json            # Build + watch + kiểm thử
├── package-lock.json       # Khóa dependency cho npm ci
├── assets/
│   ├── vocab-pack.js       # 206 chủ đề · 41.621 từ (nạp lười)
│   ├── logo.png            # Logo Gopinyin
│   └── qr-vietcombank.png  # (dự phòng) ảnh QR tĩnh — app dùng QR động img.vietqr.io
├── server/
│   ├── serve.js            # Server tĩnh cho dev (http://localhost:8080) — cần cho micro
│   └── pro-server.js       # Webhook thanh toán + chấm phát âm (Azure, tuỳ chọn)
├── tests/                  # Playwright; kết quả mới lưu trong .cache/
├── docs/ARCHITECTURE.md    # Muốn sửa tính năng nào, tìm ở đâu
└── README.md
```

## 🚀 Triển khai (đưa vào thương mại hoá)

### Chạy thử trên máy (khuyến nghị — cần cho micro)

```bash
# Windows: nháy đúp start.bat  (tự mở http://localhost:8080)
# hoặc:
npm install               # lần đầu
npm start                 # build + watch + server
node server/serve.js --no-open   # không tự mở trình duyệt
PORT=5500 node server/serve.js   # đổi cổng
```

`server/serve.js` tự build trước khi mở server và chỉ phục vụ `dist/`. Development dùng `npm start`
để tự build lại khi sửa HTML/JS/CSS; tải lại trình duyệt để xem. Hai endpoint phụ vẫn là `/__gopinyin` (để trang `file://` nhận diện server)
và `/__import` (chuyển `localStorage` từ bản `file://` sang `localhost`).

Ứng dụng sau build là **static site** — chạy `npm run build`, rồi chỉ upload nội dung `dist/`:

1. **GitHub Pages / Netlify**: phục vụ `dist/`. **Vercel**: import repository; cấu hình build/output đã có trong `vercel.json`.
2. **Hosting Việt Nam** (ví dụ Viettel Web, FPT, PA Vietnam): upload qua FTP vào thư mục gốc (`public_html`).
3. **Tên miền**: trỏ tên miền đã mua về hosting, đảm bảo `index.html` nằm ở root.

> Không cần database hay backend. Mọi dữ liệu và xác thực demo đều chạy trên trình duyệt (localStorage).

### Kết nối thanh toán thật (Pro)
Hiện tại nút "Kích hoạt Pro" là demo — người dùng chuyển khoản thủ công qua QR Vietcombank và nhấn kích hoạt. Để **tự động nâng cấp khi tiền về**, chạy `server/pro-server.js` (webhook SePay/Casso/payOS) rồi đặt `window.PRO_VERIFY_URL` trỏ tới endpoint `/pro/status`. Ngoài ra có thể:
- Hàm `setPro()` nằm trong `src/features/pro/entitlements.js`; cấu hình đối soát công khai đặt ở `src/app/public-config.js`.
- Nội dung chuyển khoản chuẩn: **`GOPINYIN {email}`** để đối soát.

> ⚠️ **Server BẮT BUỘC có `WEBHOOK_SECRET`.** Thiếu khoá thì server từ chối khởi động, vì
> không có khoá thì bất kỳ ai cũng POST được giao dịch giả vào `/webhook` để tự mở Pro.
> ```bash
> WEBHOOK_SECRET=mot-chuoi-bi-mat-dai node server/pro-server.js
> # tuỳ chọn, khuyến nghị: xác thực chữ ký HMAC trên raw body
> HMAC_SECRET=... ALLOWED_ORIGIN=https://gopinyin.vn node server/pro-server.js
> ```
> Chỉ khi test ở máy local mới dùng `ALLOW_INSECURE_WEBHOOK=1`.

**Thông tin nhận tiền (của bạn):**
- Chủ tài khoản: **NGUYEN VAN LONG**
- Số tài khoản Vietcombank: **9342383345**
- Gói: Tháng **39.000đ** / Gói năm **399.000đ**

> 🔐 **Thông tin ngân hàng dùng ở `src/features/pro/checkout.js` (`PRO_BANK`) và `src/features/pro/view.html`.**
> Đây là thông tin công khai (khách phải thấy để chuyển tiền) nên không phải bí mật, nhưng khi
> thương mại hoá nên đưa vào một chỗ cấu hình duy nhất (hoặc endpoint server) để đổi tài khoản
> không phải sửa nhiều file.

### Khung học dùng chung (Luyện gõ ↔ Luyện phát âm)

Hai màn luyện **chỉ khác nhau ở thân thẻ và vài nút chức năng**, còn lại dùng đúng một bộ khung
`.studyShell` trong `src/shared/study/shell.css` — sửa một chỗ là cả hai đổi theo:

| Phần | Nội dung (giống nhau ở cả 2 màn) |
|---|---|
| Đầu thẻ `.studyHead` | 6 ô thống kê + thanh tiến độ |
| Công cụ `.studyControls` | 3 nhóm: **📚 Nội dung** (← Bộ khác + chọn bộ) · **🔊 Âm thanh** (tốc độ, giọng, tự đọc) · **👁 Hiển thị** (nghĩa / chữ Hán / pinyin) |
| Thẻ câu `.questionBox` | Tiếng Việt → Chữ Hán → (Pinyin) → **vùng học** → nghe mẫu → gợi ý phím, có cảnh trúc hai góc |
| Chân thẻ `.studyFoot` | Trái: ◀ Câu trước · ↺ Làm lại/Nói lại · Bỏ qua ▶ — Phải: tên bộ + Xoá tiến độ |

Khác nhau **chỉ ở**: vùng học (ô gõ chữ Hán ↔ nút micro + sóng âm), cột kết quả chấm (chỉ màn phát âm),
và vài nút riêng (💡 Hiện Pinyin / 📜 Đã làm / ⓘ Phím tắt ↔ ▶ Bản ghi của tôi / Câu tiếp).

Cả hai màn khoá trang đúng **1 khung hình** bằng `body.studyFit` (bật trong `openDataset()` và
`Pron.open()`, tắt khi rời màn) — hết danh sách vẫn thấy nút "Luyện lại từ đầu" mà không phải cuộn.
Kiểm thử: `node tests/study_shell.js` (cần server ở cổng 8080).

### Luồng sử dụng Luyện phát âm

1. Sidebar **Luyện phát âm** → màn **chọn bộ câu** (HSK 1–9 + bộ đã lưu). Mỗi thẻ hiện `x/N đã luyện · y đạt`
   và thanh tiến độ riêng, nên biết ngay bộ nào đang dở.
2. Chọn một cấp → màn luyện: **Nghe mẫu** (F1) → bấm micro (hoặc `Enter`) → nói → tự dừng khi im lặng → xem điểm.
3. Kết quả chấm nằm ở **cột phải** nên **không phải cuộn** mới thấy; `Space` sang câu, nút **← Bộ khác** quay lại màn chọn.
4. **Micro chỉ xin quyền 1 lần** cho cả phiên: stream được giữ mở và dùng lại cho mọi lượt nói. Rời màn
   (hoặc ẩn tab) là micro tắt ngay — không thu âm ngầm.

> Nếu Chrome vẫn hỏi lại quyền sau khi **tải lại trang**, có 2 nguyên nhân:
> 1. **Bạn đang mở bằng `file://`** → Chrome không lưu quyền cho `file://` (xem cảnh báo ở đầu README).
>    Chạy `start.bat` rồi mở `http://localhost:8080`; app sẽ tự chuyển dữ liệu sang.
> 2. Bạn đã chọn **“Cho phép lần này”** → hãy chọn **“Cho phép mỗi khi truy cập trang web”**.
>    App có hiện mẹo này đúng 1 lần.

### Chấm điểm phát âm (Luyện phát âm) — phần nào chạy sẵn, phần nào cần cấu hình

Tính năng **Luyện phát âm** chạy được **ngay, không cần khoá API nào**, nhưng cần phân biệt rõ hai mức:

| Mức | Cần gì | Cho ra gì |
|---|---|---|
| **Đang bật mặc định** | Không cần gì (chỉ cần micro + trình duyệt) | **Độ khớp nội dung** — so khớp chuỗi âm tiết nhận dạng được (Web Speech API) với pinyin chuẩn, canh bằng LCS nên biết âm nào thiếu / thừa / bị nghe nhầm. **Không phải điểm phát âm chuyên nghiệp.** |
| **Chấm điểm thật (tuỳ chọn)** | `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` trên server | **Điểm phát âm 0–100** theo từng âm vị (accuracy / fluency / completeness / prosody), biết lỗi ở thanh mẫu, vận mẫu hay thanh điệu. |

> ❗ **Hiện tại khoá Azure CHƯA được cấu hình** trong repo này. Vì vậy app cố tình hiển thị nhãn
> **"Độ khớp nội dung"** kèm dòng ghi chú, **không** gọi đó là điểm phát âm và **không** bịa điểm.
> Khi bạn cấu hình khoá, cùng một giao diện đó tự đổi nhãn thành **"Điểm phát âm"** và bật phần
> phân tích âm tiết chi tiết — không phải sửa code.

**Bật chấm điểm thật:**

```bash
AZURE_SPEECH_KEY=xxxxxxxxxxxxxxxxxxxxxxxx \
AZURE_SPEECH_REGION=southeastasia \
WEBHOOK_SECRET=mot-chuoi-bi-mat-dai \
node server/pro-server.js
```

Sau đó trỏ app về server. Mặc định app gọi `/api/pron` (cùng origin). Nếu API nằm ở origin khác
(hosting tĩnh + API riêng), khai báo biến toàn cục **trước lượt chấm đầu tiên** và mở CORS ở server:

```html
<script>window.PRON_API='https://api.example.com/api/pron';</script>
```
```bash
ALLOWED_ORIGIN=https://gopinyin.vn node server/pro-server.js
```

- Khoá **chỉ nằm ở server** (`process.env`), không bao giờ gửi xuống trình duyệt.
- Server trả **501** khi chưa cấu hình → app tự rơi về chế độ "Độ khớp nội dung" (không lỗi trắng trang).
- Giới hạn body **4 MB**, rate limit theo IP; mỗi lượt nói tối đa **15 giây**.
- Audio được gửi **chỉ khi người dùng bấm "Bắt đầu nói"** (không tự động thu), và **không lưu** trên
  server — chỉ chuyển tiếp tới Azure rồi trả kết quả về. Bản ghi để "nghe lại" nằm trong bộ nhớ
  trình duyệt và mất khi tải lại trang.

**Chi phí & hạn mức cần biết trước khi bật** (giá tham khảo, hãy kiểm tra lại trang giá chính thức của Azure):

- Azure Speech **gói miễn phí F0**: ~**5 giờ audio/tháng**, 1 request đồng thời — đủ để thử, không đủ chạy thật.
- Gói **S0 (trả theo dùng)**: ~**1 USD/giờ audio**; Pronunciation Assessment tính theo cùng đơn giá nhận dạng giọng nói.
- Mỗi lượt nói bị cắt ở 15 giây → **tối đa ~240 lượt/giờ audio**. Nghĩa là 5 giờ miễn phí ≈ **1.200 lượt chấm**.
- Nếu mở cho người dùng thật, hãy đặt **hạn mức theo tài khoản** (ví dụ N lượt/ngày) ở server trước khi
  bật, vì mỗi lượt là tiền thật.

**Muốn đổi nhà cung cấp khác?** Sửa `PronAssess.server()` trong `src/features/pronunciation/assessment.js` và route
`POST /api/pron` trong `server/pro-server.js` — phần còn lại (canh âm tiết, giao diện, thống kê) không phụ thuộc dịch vụ nào.

### Hạn dùng của gói Pro
- **Gói tháng**: 31 ngày kể từ lúc kích hoạt (`at + 31 ngày`). Hết hạn → tự khoá lại AI & HSK 4–9.
  Server cũng trả `paid:false` khi hết hạn, và **cộng dồn** khi gia hạn sớm.
- **Gói năm**: 365 ngày kể từ lúc kích hoạt.
- Quyền Pro gắn với **email tài khoản** (`gp:pro:<email>`), không dùng khoá toàn cục — nhờ vậy
  mua một lần không mở khoá cho mọi tài khoản khác trên cùng máy, và khách (guest) không thể là Pro.
- Tài khoản mua Pro bằng bản cũ (khoá `gp:pro` toàn cục) được **tự chuyển tiếp** sang email khi
  đăng nhập lần đầu sau khi cập nhật.

### Dùng thử 7 ngày hoạt động thế nào?
- Khi tạo tài khoản (hoặc đăng nhập tài khoản cũ chưa nhận), app gọi `ensureTrial()` → ghi `gp:trial:<email> = {start, end}` với `end = start + 7 ngày`.
- `isPro()` trả `true` nếu **đã mua** (`isPaidPro()`) **hoặc** còn trong hạn dùng thử (`trialActive()`), nên mọi chỗ khoá Pro (AI, HSK 4–9) tự mở.
- UI dùng thử: `#trialBanner` (dashboard), `#proTrial` (modal Pro), badge `TRIAL` ở sidebar, dòng `Dùng thử · còn N ngày`.
- Muốn đổi số ngày: sửa `TRIAL_DAYS` trong `src/features/pro/entitlements.js`. Muốn tắt hẳn: cho `ensureTrial()` trả `null`.

## 🔧 Tuỳ chỉnh nhanh
- **Màu thương hiệu**: sửa `--primary` / `--primary-2` / `--brand-grad` trong `src/shared/styles/tokens-base.css`; xem override ở `polish.css` cùng thư mục.
  Bộ màu lấy trực tiếp từ logo: teal `#0BA488`, than `#3D464D`.
- **Logo & icon**: bộ asset nằm trong `assets/` — `logo-full.png` (lockup nền sáng),
  `logo-full-dark.png` (lockup cho giao diện tối), `logo-mark.png` (panda tách nền trong suốt),
  `logo-icon.png` / `icon-512.png` / `icon-192.png` (app icon), `favicon-16/32/48.png`,
  `apple-touch-icon.png`. Manifest: `assets/site.webmanifest`.
- **Cảnh nền Trung Hoa** (núi non, rừng trúc, sương, chim): khối `<svg class="lp-scenery">` trong
  `src/features/landing/view.html` + nhóm luật `.sc*` trong `src/shared/styles/brand.css`. Màu và độ đậm điều khiển bằng biến
  `--sc-far`, `--sc-mid`, `--sc-near`, `--sc-bamboo`, `--sc-mist`, `--sc-sun` (đặt riêng cho
  theme sáng và tối).
- **Cảnh nền trong không gian học** (không chỉ landing): khối `<div class="ws-scenery">` (đặt ngay
  sau `<div class="ws-main">`) vẽ lại đúng bộ núi – trúc đó nhưng phủ toàn màn hình (`position:fixed`,
  `z-index:-1`). Ba lớp cần biết khi chỉnh:
  1. `.ws-scenery` — "bầu trời" gradient + bộ biến `--sc-*` **riêng cho app** (sáng hơn landing để
     còn nhìn thấy sau lớp kính). Đổi độ đậm ở đây, không đụng tới landing.
  2. `.ws-sceneryGlow` — quầng sáng "trăng mọc" giữa màn hình, tạo chiều sâu cho lớp kính.
  3. `.qbScenery` — tán trúc vẽ **trong thẻ câu hỏi** của màn luyện gõ (hai góc trên, mặt nạ ngang
     nên lòng thẻ vẫn trống cho chữ). Hình vẽ là `<path>` thật (không dùng `<use>`), vì CSS không
     style được nội dung được clone qua `<use>`.
- **Thẻ nội dung dạng kính**: `#appCard, #libraryCard, #aiCard, #rankCard` dùng gradient
  `color-mix()` bán trong suốt + `backdrop-filter` để cảnh nền xuyên qua. Muốn đặc lại thì tăng
  phần trăm trong `color-mix(in srgb, var(--card) 94%, transparent)`. Trình duyệt không hỗ trợ
  `color-mix` tự rơi về nền đặc nhờ khối `@supports not`.
- **Giá Pro / thông tin ngân hàng**: xem `src/features/pro/checkout.js`, `view.html` và `src/app/public-config.js`.
- **Ngưỡng chấm phát âm**: `src/features/pronunciation/session.js` có `GOOD` (mốc "phát âm tốt", mặc định 75),
  `MIN_CONF` (dưới mức này thì không kết luận lỗi, mặc định 0.55), `MAX_MS` (cắt lượt nói, 15 s) và
  `SILENCE_MS` / `SILENCE_RMS` (tự dừng khi im lặng). Đổi số ở đây, không cần sửa logic.
- **Thêm dữ liệu câu/từ**: sửa mảng trong `src/data/catalog.js`.

## 📝 Ghi chú
- Xác thực & Pro hiện là **demo phía client**. Khi thương mại hoá, hãy bổ sung backend/xác thực thực tế để bảo vệ nội dung Pro.
- Tính năng AI cần khoá API (Gemini/OpenRouter) — giao diện nằm trong `src/features/ai/`; cấu hình công khai trong `src/app/public-config.js`.

### 🔐 Bảo mật — những gì đã sửa

| Vấn đề | Trước | Sau |
|---|---|---|
| Băm mật khẩu | `(h<<5)-h+charCode` — 32 bit, không salt, đảo ngược được | **PBKDF2-SHA256, 120.000 vòng, salt 16 byte/tài khoản**; tài khoản cũ tự nâng cấp khi đăng nhập |
| Độ dài mật khẩu | ≥ 6 ký tự | ≥ 8 ký tự (không dùng `minlength` để không chặn tài khoản cũ) |
| Hạn gói tháng | Không có → mua 1 tháng dùng vĩnh viễn | **31 ngày**, hết hạn tự khoá; server cũng trả `paid:false` |
| Phạm vi Pro | Khoá toàn cục `gp:pro` → mọi tài khoản (kể cả khách) đều Pro | Gắn **email tài khoản**; khách không thể là Pro; có chuyển tiếp cho người đã mua bản cũ |
| Webhook | Không khoá mặc định → ai cũng POST giả được | **Từ chối khởi động nếu thiếu `WEBHOOK_SECRET`**; hỗ trợ HMAC; kiểm tra số tiền; ghi file an toàn (tmp + rename) |
| CORS | `*` cho mọi route | `*` chỉ cho `GET /pro/status`; `/webhook` không mở CORS; cấu hình được bằng `ALLOWED_ORIGIN` |
| `/health` | Lộ `paidCount` (số người đã trả tiền) | Chỉ trả `{ok:true}` |
| Dò trạng thái | Không giới hạn | Rate limit 120 req/phút/IP cho `/pro/status` |

> ❗ **Vẫn còn giới hạn của bản tĩnh:** toàn bộ kiểm tra Pro chạy trên trình duyệt, nên người
> rành kỹ thuật vẫn mở được DevTools và gọi `setPro('lifetime')`. Muốn chặn thật, nội dung Pro
> phải được **server trả về sau khi xác thực** (không nhúng sẵn trong JS tĩnh).
> API key AI cũng lưu dạng plaintext trong `localStorage` — nếu triển khai cho nhiều người,
> hãy proxy qua server để không phải phát key xuống client.

