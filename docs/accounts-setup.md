# Tài khoản Supabase và đồng bộ

## Trạng thái cấu hình cập nhật ngày 26/10/2026

- Nhánh phát hành: `release/supabase-accounts`, repo `anhlongtkm-glitch/gopinyin-`. Production trước phát hành: `https://gopinyin-rigeocjr5-long-b4d0.vercel.app`, commit `9bb473f580223960cd2baca6084fa6f88c7f3178` (giữ làm mốc rollback).
- Cấu hình phát hành: Node 24.x, framework Other, `npm ci`, build `npm run build`, output `dist`; rewrite SPA dùng `/`, không trộn `routes` với `headers`.
- PR phát hành: https://github.com/anhlongtkm-glitch/gopinyin-/pull/1. Commit tích hợp `d8c7583`, sửa manifest Preview có bảo vệ ở `5e42f05`, sửa khôi phục mật khẩu sau đăng xuất ở `55dff1c`. Cài đặt sạch, 300 kiểm tra và test build đã đạt.
- PR #1 đã merge vào `main`: `580cce9b8df9239a554e30a8fb596d5fb21e9b09`. Deployment Production của bản code này: `https://gopinyin-ps3msp1mn-long-b4d0.vercel.app` (Dashboard: `https://vercel.com/long-b4d0/gopinyin-/2j4bwKJR9dcEbAkg1Fb9jKEtP5LA`), trạng thái Ready, đã gắn www.
- Preview: `https://gopinyin-git-release-supabase-accounts-long-b4d0.vercel.app/`. Hai biến Supabase đã có cho Preview; URL gốc và `/?account=recovery` của đúng host Preview đã thêm vào Auth allowlist. Tài nguyên JS/CSS/config/manifest trả HTTP 200; config đúng project; đường dẫn file riêng không trả nội dung riêng tư.
- Dự án Supabase: `sjhvmrvawgvqnzyxjkpt` (tên hiển thị cũ: `gopinyn.io.vn`), API URL: `https://sjhvmrvawgvqnzyxjkpt.supabase.co`.
- Đã áp dụng `001_accounts.sql` lên dự án thật: ba bảng bật RLS, trigger hồ sơ, RPC và bucket `avatars` đã được kiểm tra.
- Đã tạo `.env.local` (Git bỏ qua) với URL và publishable key cho web/backend; `npm run build` thành công. Không lưu key trong tài liệu này.
- Đã lưu và kiểm tra lại trên Dashboard: Email bật, yêu cầu xác minh email, không cho đăng nhập ẩn danh; mật khẩu tối thiểu 8 ký tự.
- Domain chính thức: `gopinyin.io.vn` (đã sửa tên thiếu chữ i trước đó). Site URL là `https://gopinyin.io.vn`. Redirect allowlist có sáu URL cho web công khai/localhost: trang gốc và `/?account=recovery` của cả `https://gopinyin.io.vn`, `https://www.gopinyin.io.vn`, và `http://localhost:8080`; cộng hai URL Preview chính xác nêu trên.
- Resend đã xác minh `auth.gopinyin.io.vn`. Ba bản ghi email đã lưu tại Mắt Bão và kiểm tra được bằng DNS công khai. Domain Resend gõ sai trước đó đã xóa.
- Supabase Custom SMTP đã bật và kiểm tra lại sau tải trang: host `smtp.resend.com`, port `465`, username `resend`, sender `GoPinyin <no-reply@auth.gopinyin.io.vn>`. Key `GoPinyin Supabase SMTP` chỉ có Sending access cho `auth.gopinyin.io.vn`; không lưu key trong repo.
- Kiểm thử thật: email xác minh và khôi phục tới hộp thư được chỉ định có trạng thái Delivered trong Resend. Hai tài khoản đã xác minh; hồ sơ tự tạo. Tài khoản chính dùng lại phiên Supabase hợp lệ đã đăng nhập tại localhost; tài khoản thử đã kiểm tra đăng nhập bằng mật khẩu trên Preview. Tải lại vẫn giữ phiên và “Đã đồng bộ”.
- Preview đã kiểm tra lưu hồ sơ/ảnh; chặn đọc dữ liệu, sửa hồ sơ, ghi trực tiếp và tải/xóa ảnh của tài khoản khác. Ảnh hiển thị vẫn công khai đúng thiết kế. Ảnh và dataset thử đã dọn; chỉ còn tombstone của dataset.
- Đồng bộ hai phiên trình duyệt độc lập, giữ outbox khi offline, hiện hộp thoại xung đột và giữ đúng bản trên máy chủ đều đã đạt trên Supabase thật. Các phiên trình duyệt mô phỏng hai thiết bị, chưa phải kiểm thử trên hai máy vật lý.
- Khôi phục mật khẩu thật sau đăng xuất đã đạt: dùng link email thử từ nhật ký Resend, mở form đặt mật khẩu, lưu mật khẩu mới và đăng nhập lại thành công. Link đã dùng lại không tạo phiên đăng nhập. Không thay mật khẩu tài khoản chính. Kiểm tra hết hạn theo thời gian thực 1 giờ chưa thực hiện.
- API thật bằng publishable key: Auth settings và RPC bảng xếp hạng trả HTTP 200; hồ sơ/dữ liệu học khi chưa đăng nhập trả danh sách rỗng. Ghi trực tiếp, gọi RPC ghi và đọc `ranking_totals` khi chưa đăng nhập đều bị từ chối HTTP 401.
- Security Advisor ghi nhận các RPC `SECURITY DEFINER` có quyền gọi cho client và `ranking_totals` bật RLS không có policy. Đây là chủ đích của migration: chỉ RPC được đọc bảng tổng hợp hoặc ghi bản ghi học; không thêm quyền truy cập bảng trực tiếp để bỏ các cảnh báo này.
- Vercel: dự án `long-b4d0/gopinyin-` đã có hai biến `GOPINYIN_SUPABASE_*` cho Production. Đã thêm domain gốc và bản ghi A `@ → 216.198.79.1` theo Dashboard Vercel; domain gốc trả HTTP 308 tới `www.gopinyin.io.vn`, trang www trả HTTP 200. Bản ghi www trước đó được giữ nguyên.
- Web Production đã chạy bản mới: `assets/config.js` chứa đúng project Supabase; JS/CSS/manifest trả HTTP 200 đúng content-type. Đăng nhập thật trên www bằng mật khẩu vừa khôi phục và giữ phiên/“Đã đồng bộ” sau tải lại đã đạt; không có lỗi runtime. Khách vẫn xem được bảng điều khiển. Các đường dẫn `.env.local`/`server/pro-paid.json` chỉ trả trang SPA, không lộ nội dung file riêng.
- Backend Node AI/phát âm riêng chưa được triển khai trong đợt phát hành web này. Không áp dụng lại migration đã chạy và không thay đổi dữ liệu học thật; dataset/ảnh kiểm thử được dọn đúng cơ chế ứng dụng.
- Email tài khoản đã được thiết kế lại bằng tiếng Việt và lưu trực tiếp trên Supabase ngày 26/10/2026: xác minh đăng ký, khôi phục mật khẩu, lời mời, magic link, thay đổi email và mã xác minh lại. Các template thông báo bảo mật đang tắt không bị bật thêm. Nguồn HTML/tiêu đề và hướng dẫn nằm tại `supabase/templates/`, dựng lại bằng `node scripts/build-email-templates.mjs`.
- Sáu mẫu email được kiểm tra ở viewport 390px/1440px; dùng logo công khai, bảng bố cục và CSS inline. Email khôi phục thật gửi tới tài khoản thử có trạng thái Delivered, tiêu đề/nội dung tiếng Việt, logo tải được và CTA vẫn dùng đúng link recovery của Supabase về www. Không thay đổi mật khẩu qua email kiểm thử thiết kế này.

Web vẫn cho khách xem bảng điều khiển, thư viện, danh sách phát âm, sảnh game và bảng xếp hạng. Học, tạo câu AI và chơi cần tài khoản đã xác minh email, mạng và đồng bộ thành công. Tất cả tính năng vẫn miễn phí.

### DNS gửi email Resend tại Mắt Bão

Các giá trị bên dưới lấy trực tiếp từ Resend và đã lưu tại Mắt Bão cho `auth.gopinyin.io.vn`, trong zone `gopinyin.io.vn`, TTL 3600. Không thêm lại nếu bản ghi đã tồn tại.

| Loại | Host | Giá trị |
| --- | --- | --- |
| TXT | `resend._domainkey.auth` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDY1rmL7mKFGaLZOAVn5zCzjFYf2qxPxO6RBIBeCLMKsfiCz88cNVqLFTZSjfSo50e1vwVG92GKJDymdMgSSA6SSrOUqmpkrGE4T14EftW0nwXM2Gg4nJrsfNDJO1hXxCXZu6iCpiO0Vj3yPVgXKhhWXHsktDeYts0nypLPAfnYXQIDAQAB` |
| CNAME | `rsend.auth` | `rsend-apne1.forge.rmta.net` |
| CNAME | `send.auth` | `send.forge.rmta.net` |

Resend đang cung cấp hai CNAME cho cấu hình gửi này; dùng đúng giá trị trên Dashboard, không thay bằng MX/SPF trong hướng dẫn cũ. Không cần bật nhận email để gửi email Auth. Chưa thêm/sửa DMARC của domain gốc.

Supabase SMTP đã cấu hình: host `smtp.resend.com`, port `465`, username `resend`, password là API key Resend; sender `no-reply@auth.gopinyin.io.vn`, tên `GoPinyin`. API key không được lưu trong frontend hoặc tài liệu này.

## 1. Tạo dự án

1. Tạo dự án Supabase mới. Giữ mật khẩu database và các secret key ở nơi riêng.
2. Chạy **một lần** nội dung `supabase/migrations/001_accounts.sql` trong SQL Editor. Migration tạo hồ sơ tự động khi đăng ký, bảng dữ liệu học, RPC ghi theo phiên bản, bảng tổng hợp xếp hạng, RLS và bucket ảnh.
3. Trong Authentication → Providers, bật Email/password và **Confirm email**. Đặt độ dài mật khẩu tối thiểu 8. Không bật anonymous sign-ins. Google chưa được tích hợp.
4. Trong URL Configuration, đặt Site URL là `https://gopinyin.io.vn`. Thêm redirect URL chính xác cho trang gốc và trang `/?account=recovery`: `https://gopinyin.io.vn/` và `https://gopinyin.io.vn/?account=recovery`. Thêm localhost tương ứng nếu dùng phát triển. Tránh wildcard cho domain sản xuất.
5. Cấu hình SMTP để gửi xác minh và khôi phục mật khẩu. Kiểm tra email tới được cả hộp thư đến và thư rác.
6. Trong Project Settings/API, lấy Project URL và **publishable key** (hoặc legacy `anon` key). Không dùng secret key hoặc `service_role` trong frontend.

## 2. Cấu hình web và Vercel

Đặt hai biến môi trường sau trong Vercel, rồi build/deploy lại:

```dotenv
GOPINYIN_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
GOPINYIN_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Với máy phát triển, đặt chúng trong `.env.local` rồi chạy `npm start`. Node 20.12 trở lên cần thiết cho `process.loadEnvFile`; nên dùng Node 22 hoặc 24. Build chỉ xuất danh sách cấu hình công khai cho phép, không sao chép toàn bộ biến môi trường. `.env.local` không được commit.

Khi chưa có cấu hình, phần xem công khai hoạt động; đăng nhập thông báo chưa khả dụng. Không có tài khoản local dự phòng và không giả lập phiên đã xác thực. File `file://` chỉ phù hợp xem giao diện; dùng localhost hoặc HTTPS để xác minh email, khôi phục mật khẩu và luyện phát âm.

## 3. Backend AI/phát âm tùy chọn

`server/pro-server.js` vẫn giữ tên cũ để tương thích, nhưng không có Pro hay thanh toán. Đặt:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ALLOWED_ORIGIN=https://gopinyin.io.vn
```

Giữ `AI_KEY_GEMINI`, `AI_KEY_OPENROUTER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` trên backend nếu dùng các dịch vụ này. Nạp biến môi trường qua nền tảng hosting hoặc `node --env-file=.env.local server/pro-server.js`.

`POST /api/ai` và `POST /api/pron` yêu cầu `Authorization: Bearer <Supabase access token>`. Server gọi Auth để xác minh user và email; token thiếu, giả mạo, bị thu hồi hoặc chưa xác minh bị từ chối. Thiếu cấu hình xác minh trả 503. Cấu hình frontend `GOPINYIN_AI_PROXY_URL` đến `/api/ai`; nếu API phát âm khác origin, đặt `window.PRON_API` trước app. Vercel hiện chỉ phục vụ web tĩnh: API Node cần hosting riêng hoặc proxy tương ứng.

## 4. Dữ liệu và quyền truy cập

### Bổ sung tối ưu ngày 26/10/2026

- Đặt `GOPINYIN_AI_PROXY_URL=https://API_HOST/api/ai` và `GOPINYIN_PRON_API_URL=https://API_HOST/api/pron` khi build web dùng backend riêng. Proxy AI đã cấu hình thì người học không cần nhập API key. Vẫn hỗ trợ hook cũ `window.__gpAiProxy`/`window.PRON_API`; cấu hình triển khai có ưu tiên cao hơn.
- Backend giữ `AI_KEY_GEMINI`, `AI_KEY_OPENROUTER`, `AZURE_SPEECH_KEY`. Có thể đặt `AI_MODEL_GEMINI`/`AI_MODEL_OPENROUTER` riêng ở server; mặc định frontend/backend cùng đọc `src/data/ai-models.json`. Khả năng dùng và chi phí phụ thuộc tài khoản nhà cung cấp. Đối chiếu [danh sách model Gemini](https://ai.google.dev/gemini-api/docs/models) trước khi bật thực tế.
- Timeout upstream mặc định 30 giây (`UPSTREAM_TIMEOUT_MS`); hạn mức mặc định 120 request/phút/tài khoản (`USER_RATE_PER_MINUTE`), tối đa hai tác vụ đồng thời mỗi tài khoản, 20 tác vụ toàn tiến trình (`MAX_CONCURRENT_REQUESTS`). Bộ đếm nằm trong bộ nhớ một tiến trình; triển khai nhiều replica cần rate limiter chung. Không tin `X-Forwarded-For` do client tự gửi.
- Khi đặt `ALLOWED_ORIGIN`, dùng chính xác origin web đang phục vụ người dùng (ví dụ `https://www.gopinyin.io.vn`, không phải domain gốc đang redirect). Chạy Node API riêng bằng `node --env-file=.env.local server/pro-server.js`; static deploy không tự khởi chạy file này.
- Lịch ôn nằm trong trường `reviewById` của payload tiến độ hiện có; không cần chạy lại migration. Bài cũ chưa có lịch ôn vẫn mở bình thường; lịch bắt đầu từ các lượt luyện mới. Giữ outbox, kiểm tra version và giải quyết xung đột như trước.
- Đã kiểm thử cục bộ bằng fixture; chưa triển khai API hoặc xác minh lại nhà cung cấp thật trong đợt sửa mã này.

- `profiles`: chủ tài khoản đọc/sửa tên và đường dẫn ảnh của mình. Email/mật khẩu do Auth quản lý.
- `learning_records`: dữ liệu riêng theo UUID, loại `kv` hoặc `dataset`. Chỉ chủ tài khoản đọc; ghi qua `put_learning_record`, không ghi trực tiếp bảng. RPC so phiên bản trong transaction và trả xung đột thay vì ghi đè. Xóa tạo tombstone.
- Dữ liệu HSK có sẵn chỉ đồng bộ tham chiếu, không nhân bản toàn bộ thư viện. Bộ câu riêng/AI có nội dung đầy đủ. Bản ghi tối đa 2 MB; lỗi quá giới hạn hiện trong trạng thái đồng bộ và giữ dữ liệu chưa gửi trên máy.
- Cache và outbox nằm dưới `gp:account-cache:<uuid>`, chỉ nạp tài khoản hiện tại. Không đồng bộ mật khẩu cũ, API key, token hoặc bản ghi âm tạm thời. Key AI do người dùng nhập lưu riêng theo tài khoản trên thiết bị.
- Ảnh được cắt giữa, nén 256×256 rồi tải lên thư mục UUID của chủ tài khoản. Bucket **avatars công khai cho ảnh hiển thị** vì ảnh và tên xuất hiện trên bảng xếp hạng; danh sách file và quyền tải lên/sửa/xóa chỉ dành cho chủ. Không dùng bucket này cho ảnh riêng tư hoặc tài liệu nhạy cảm.
- Bảng xếp hạng công khai chỉ trả UUID, tên, ảnh và điểm tổng hợp. Không trả email hay hồ sơ học riêng. Điểm vẫn do client báo; đây không phải hệ thống chống gian lận cho giải thưởng.
- Khi mất mạng/lỗi đồng bộ, hoạt động tạm dừng. Thay đổi chưa gửi vẫn ở outbox của tài khoản cũ. Kết nối lại và đồng bộ rồi dùng nút tiếp tục của bài/game. Không tự tiếp tục ghi âm.

## 5. Chuyển dữ liệu cũ

Tài khoản local phải đăng ký trực tuyến và xác minh email. Không tải mật khẩu hoặc hash cũ lên server. Sau lần đăng nhập đầu trên trình duyệt có dữ liệu cũ, người dùng chọn nhập hoặc bỏ qua. Dữ liệu gốc trong localStorage/IndexedDB vẫn giữ nguyên. Nhập chỉ thêm mục chưa tồn tại, không đè dữ liệu tài khoản trên máy chủ; quyết định được ghi theo UUID trên trình duyệt.

Người dùng dùng chung máy cần chọn đúng tài khoản trước khi nhập dữ liệu cũ. Các bản dữ liệu cũ vốn dùng chung trên trình duyệt nên ứng dụng không thể tự xác định ai sở hữu chúng.

## 6. Kiểm tra trước khi bật thật

```bash
npm ci
npm run test:database
npm run test:sync
npm run test:api
npm test
npm run test:build
```

Kiểm thử tự động dùng PostgreSQL nhúng cho migration/RLS và server giả lập giao thức Supabase cho SDK/Auth/Storage. Bản build kiểm thử tách khỏi `dist/`, không ghi đè cấu hình dev server đang chạy. Đây không phải kiểm thử qua dự án Supabase thật.

Trên dự án thử nghiệm thật, dùng hai email kiểm tra: đăng ký/xác minh, sai mật khẩu, email khôi phục và link PKCE hết hạn, đổi mật khẩu, hồ sơ/ảnh, đồng bộ trên hai thiết bị, xung đột cùng bài, mất mạng và đăng xuất khi có thay đổi chưa lưu. Dùng token tài khoản A thử đọc/ghi dữ liệu và thay ảnh tài khoản B; phải bị từ chối. Kiểm tra bảng xếp hạng khi đăng xuất không lộ email hoặc dữ liệu học. Chỉ triển khai sản xuất sau khi các bước này đạt.

Tài liệu: [Supabase Auth](https://supabase.com/docs/guides/auth), [quản lý hồ sơ](https://supabase.com/docs/guides/auth/managing-user-data), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
