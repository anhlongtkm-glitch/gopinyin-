# GoPinyin — tìm và sửa mã nguồn

GoPinyin vẫn là website một trang bằng JavaScript thuần. Không đổi giao diện, cách gõ chữ Hán, endpoint API hay định dạng tiến độ. Thay đổi chính là mã nguồn theo tính năng và bước build.

## Bắt đầu

Yêu cầu Node.js 24.x theo `package.json` và npm. Chạy `npm ci` để cài đúng lockfile.

| Lệnh | Kết quả |
|---|---|
| `npm start` | Build, mở localhost:8080 và theo dõi HTML/JS/CSS, tài nguyên công khai |
| `npm run serve` | Build và phục vụ dist, không mở trình duyệt, không watch |
| `npm run build` | Tạo website tĩnh trong dist; không cần Node ở hosting tĩnh |
| `node server/serve.js --no-open` | Tự build rồi mở server; giữ cách gọi trực tiếp |
| `npm test` | Tự mở server cổng trống, chạy 27 bộ kiểm thử, đóng server |
| `npm run test:build` | Kiểm tra ghép HTML, tài nguyên công khai, classic JS, chạy file:// |

Windows dùng `start.bat`; Linux/macOS dùng `start.sh`. Hai launcher dùng quy trình build/watch. Khi thiếu dependency, chạy `npm install`; không cần cài framework hoặc trình duyệt mới. `npm start` tự build lại, sau đó bạn tải lại trang; chưa có hot reload giữ trạng thái DOM.

## Muốn sửa phần nào, mở ở đâu?

| Phần cần sửa | Thư mục / file |
|---|---|
| Khung HTML, metadata, vị trí ghép màn | `src/index.html` |
| Sidebar, thanh tiêu đề, khung workspace | `src/app/workspace.html`, các CSS workspace cạnh đó |
| Điều hướng màn hình, rời màn và lifecycle | `src/app/navigation.js`, `navigation-events.js` |
| Đăng nhập, đăng ký, mật khẩu | `src/features/auth/` — `view.html`, `controller.js`, `service.js` |
| Dashboard, tiếp tục học, mục tiêu | `src/features/dashboard/` |
| Thư viện HSK, chủ đề từ vựng | `src/features/library/` |
| Luyện gõ | `src/features/typing/` |
| AI và bộ câu đã lưu | `src/features/ai/` |
| Luyện phát âm, kho chọn bài | `src/features/pronunciation/` |
| Bảng xếp hạng | `src/features/ranking/` |
| Sảnh game | `src/features/games/` |
| Game bắn chữ | `src/features/game/` |
| Lịch ôn theo kết quả luyện gõ | `src/features/typing/review.js`, lưu trong `cts:progress:<dataset>` |
| Nhóm HSK/chủ đề và Học tiếp | `src/features/practice/catalog-controller.js` |
| Bài khóa, thanh điệu, nhiệm vụ và cấp gấu | `src/features/journey/` |
| Thư viện YouTube, phụ đề và thu âm Shadowing | `src/features/shadowing/`; loader API riêng ở `youtube-api.js` |
| URL màn/bài học, Back/Forward | `src/app/routes.js`, `bootstrap.js` |
| Modal, toast, dịch nhanh, hướng dẫn | `src/shared/` |
| IndexedDB, cache từ vựng, đọc file | `src/shared/storage/` |
| TTS, SFX, bàn phím ảo | `src/shared/audio/`, `src/shared/virtual-keyboard.js` và CSS cùng tên |
| Tách chữ Hán, Pinyin, chuẩn hóa | `src/shared/language/` |
| Khung học chung gõ/phát âm | `src/shared/study/` |
| Màu, reset/base, nút, responsive chung | `src/shared/styles/` |
| Thứ tự ghép tất cả CSS | `src/styles/index.css` |
| Cấu hình công khai | `src/app/public-config.js` → build thành `dist/assets/config.js` |
| Dữ liệu nhúng | `src/data/catalog.js` |
| Gói từ vựng tải lười, logo, favicon | `assets/` |
| Proxy AI/chấm phát âm backend | `server/pro-server.js`, xác thực ở `server/account-auth.js` |

Mỗi chức năng có HTML riêng và các module theo trách nhiệm. Không cần tạo một file cho mỗi hàm nhỏ.

Kho bài dùng `dbList()` để lấy metadata và `dbGet(id)` để chuẩn bị nội dung một bộ; tránh gọi `dbGetAll()` khi chỉ cần vẽ tên/số câu hoặc mở một bài. `dbGetAll()` giữ cho xuất dữ liệu và tương thích cũ. Sau lần kéo tài khoản đầu tiên, đồng bộ nền đối chiếu version rồi mới lấy payload đã thay đổi; xem `docs/WEB-PERFORMANCE-PHASE-2.md`.

Luồng chọn bài/chuyển màn dùng ticket điều hướng từ `markNavigation()`. Khi gọi lồng nhau, truyền lại ticket qua `options.navigation`; sau mỗi await kiểm tra nó vẫn hiện hành rồi mới cập nhật state/DOM. AI và phát âm còn kiểm tra phiên/tác vụ riêng để bỏ phản hồi cũ. Chi tiết và ca kiểm thử ở `docs/ASYNC-FLOW-FIXES.md`.

### Những chức năng lớn

- **Typing:** `session` giữ phiên, `datasets` mở bộ câu, `input` xử lý chữ Hán/IME, `scoring` chấm câu, `render` hiển thị, `progress` lưu/khôi phục, `history` lịch sử, `controls/events` gắn thao tác.
- **AI:** `providers` cấu hình nhà cung cấp, `client` gửi yêu cầu/prompt, `validation` kiểm tra định dạng và Pinyin, `session` tạo bài/học liên tục, `saved-sets` tìm bài và học tiếp, `editor` sửa prompt/trình độ, `revision` bảo toàn mục đã học và ánh xạ hàng chờ; `controller` gắn giao diện. Luồng và kiểm thử: [AI-LEARNING-UX.md](AI-LEARNING-UX.md).
- **Pronunciation:** `session`, `repository`, `storage`, `tts`, `microphone`, `recognition`, `wav`, `assessment`, `recording`, `lesson`, `render`, `settings`, `library`, `events`, `controller`. Các lớp Repo/Store/Mic/Assess giữ hành vi cũ, được import qua state của module sở hữu.
- **Game:** `session`, `words`, `scenery`, `entities`, `engine`, `render`, `loop`, `input`, `ship`, `controller`, `events`.

## Quy tắc thêm hoặc sửa mã

1. HTML nguồn dùng marker `<!-- @include features/typing/view.html -->`. Build ghép sẵn nên không có fetch HTML khi vào màn. Marker `@inline` giữ script theme và nhập dữ liệu trong head, trước khi app đọc localStorage.
2. Import/export module trực tiếp. State được export từ module sở hữu, không tạo biến nghiệp vụ mới trên `window`. Việc ghi state trong cùng một tính năng phải đi cùng các thao tác lưu/render hiện có.
3. `src/app/bootstrap.js` là nơi duy nhất sắp thứ tự khởi tạo. Hàm `initializeApplication()` có guard để không gắn sự kiện hai lần. Kho bài khởi tạo state trong một hàm; phần lịch sử và điều khiển gõ tách rõ state/API với `initializeTypingHistoryEvents()` và `initializeTypingControlEvents()`, giữ thời điểm gắn sự kiện sau phần API nền.
4. `src/app/compatibility.js` là ranh giới công bố API cũ lên window. Giữ bridge/test/integration hiện có; mã tính năng dùng import. Proxy `legacy` đọc API công khai khi cần lifecycle/bridge động, không giữ một bản state nghiệp vụ khác.
5. `src/shared/lesson-bridge.js` cung cấp `lessonRepository` dùng chung cho dashboard và phát âm, trỏ về cùng kho câu/tiến độ luyện gõ; `window.__gpBridge` chỉ là bí danh tương thích.
6. CSS giữ nguyên thứ tự qua `src/styles/index.css`. `responsive`, `brand`, `polish`, `shell` là override cũ được đặt đúng thứ tự. Không gộp theo tên selector hoặc đảo import vì sẽ đổi cascade.
7. Giữ ID/class/data-attribute khi chỉ sửa cấu trúc. Không đổi tên database `ChineseTypingStudioDB`, version 2, store hoặc khóa `gp:*`/`cts:*` nếu chưa có kế hoạch migration riêng.

## Build và triển khai

`scripts/build.mjs` ghép HTML, bundle ES modules thành classic IIFE, bundle CSS và chép tài nguyên công khai theo allowlist. Vocab pack vẫn tải lười ở đường dẫn cũ. Không dùng runtime module loader hoặc code splitting cần HTTP, nên `dist/index.html` vẫn mở bằng file:// cho các tính năng đã hỗ trợ.

Nguồn HTML chính đã chuyển từ index ở root sang `src/index.html`; bản để mở hoặc triển khai là `dist/index.html`. Không sửa output, không upload toàn bộ repository. Build không chứa server, tests, docs, `.env`, khóa riêng hoặc dữ liệu thanh toán. Source map chỉ được sinh khi development; production build bỏ các map đó.

Production minify JS/CSS và tham chiếu file có hash dưới `assets/immutable/`; giữ tên `assets/app.js` và `app.css` cho tương thích công cụ. Chỉ thư mục immutable được cache dài; HTML/config phải được revalidate. Development vẫn dùng tên ổn định và source map.

Dashboard chỉ đọc dữ liệu tài khoản hiện tại. Các số liệu hiện có giữ cùng cách tính với màn luyện: số câu đã đi qua trong thứ tự bài chính, độ chính xác = đúng/(đúng+sai), combo cao nhất dùng `bestCombo`. Phiên ôn không ghi đè vị trí bài chính. Lịch ôn dùng thời điểm UTC tuyệt đối để nhất quán giữa thiết bị; hiển thị theo giờ trên máy người học.

Khi câu vừa được chấm đúng và còn chờ Space, `index` runtime vẫn trỏ câu đang hiển thị nhưng `mainIndex` lưu trữ đã trỏ câu tiếp theo. Không dùng hai giá trị thay thế lẫn nhau trong trạng thái này. Xem `docs/LEARNING-FLOW-FIXES.md`.

`app/route-restoration.js` quản lý khôi phục route và chờ kích hoạt tài khoản ban đầu. Callback sau đăng nhập và khôi phục route đều kiểm tra phiên điều hướng trước khi chạy. `features/typing/progress-normalization.js` chuẩn hóa thứ tự, con trỏ và thống kê khi mở progress cũ; không sửa schema hoặc khóa lưu trữ. Xem `docs/WEB-FIX-COMPLETION.md`.

Server chỉ phục vụ `dist/`; các endpoint `__gopinyin`, `__import`, origin và cổng mặc định giữ nguyên. Luồng chuyển file:// sang localhost vẫn nhập dữ liệu trước khi khởi tạo app. Quyền micro vẫn phụ thuộc secure context/trình duyệt như trước. Chỉ cấu hình công khai được copy xuống browser; giữ khóa backend trong môi trường server.

## Kiểm thử và bằng chứng refactor

- `tests/run.cjs` chạy các suite hiện có bằng `TEST_URL`, không phụ thuộc việc cổng 8080 có trống hay không. Có thể đặt `CHROME_PATH`; mặc định dùng Chrome trên Windows. Các test AI dùng stub, không gọi nhà cung cấp thật hoặc chuyển tiền.
- `tests/refactor-parity.cjs --record` ghi baseline; chạy không có `--record` để so với bản mới bằng cùng browser/seed. Artifact trong `.cache/refactor-parity/`: 20 ảnh sáng/tối × desktop/mobile × trang chủ/dashboard/gõ/chọn bộ phát âm/phát âm, kèm thông số DOM và CSS. `TEST_URL` chọn server cần so sánh.
- `tests/build.cjs` kiểm tra bản tĩnh độc lập. `tests/file_proto_warn.js` kiểm tra chuyển từ file://, cần server ở một cổng được app dò, thông thường 8080.
- Log hồi quy nằm ở `.cache/test-run/`; không đưa artifact kiểm thử hoặc dist vào Git.

Hai lỗi test có sẵn được cập nhật: test game từng đòi shortcut đã bỏ khỏi dashboard; test tiến độ từng ghi ảnh vào đường dẫn Administrator trên máy khác. Giao diện không được thêm lại shortcut chỉ để đáp ứng test cũ.

Build cũng phát hiện `hanSyllableList` gán lại một biến `const`; đổi riêng biến đó thành `let` để nhánh fallback hoạt động đúng. Trong SFX có hai method `unlock` trùng tên; bỏ method đầu vốn luôn bị method sau ghi đè, giữ hành vi thực tế.
