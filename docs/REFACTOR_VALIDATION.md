# Kiểm chứng tái cấu trúc GoPinyin

Ngày kiểm tra: 24/10/2026. Môi trường: Windows, Node 22, Chrome headless cài sẵn. Không triển khai hosting hoặc thực hiện thanh toán thật.

| Phạm vi | Kết quả |
|---|---|
| Hồi quy ứng dụng | **290 kiểm tra đạt**, 11 suite, không có lỗi |
| Chuyển file:// → localhost | **14 kiểm tra đạt**; giữ tài khoản, marker và tiến độ phát âm |
| So sánh trước/sau | **20/20 snapshot DOM/CSS khớp**, **20/20 PNG giống hoàn toàn** |
| Bản build | HTML đã ghép, ID không trùng, tài nguyên tồn tại, classic IIFE, chạy được file:// |
| Tài nguyên công khai | 18 file đầu ra; không có source, server, docs, .env hay dữ liệu thanh toán |
| Build nguồn sạch | Sao chép chỉ nguồn công khai cần thiết sang thư mục mới, `npm ci` và build thành công |
| Watch | Lưu HTML, JS và CSS đều làm hoàn tất một lượt build lại |
| Server | Phục vụ dist; đường dẫn source/private không truy cập được |
| Endpoint import | Payload giữ nguyên, token dùng một lần |
| Script launcher | Kiểm tra cú pháp shell; entry build/watch được kiểm tra bằng tooling test |

Snapshot gồm sáng/tối × desktop 1440×900/mobile 390×844 × landing/dashboard/luyện gõ/chọn bộ phát âm/luyện phát âm. Phép so sánh cố định seed ngẫu nhiên, giọng đọc và font mạng, chờ hiệu ứng đếm số hoàn tất để tránh sai khác do thời gian chụp. Giao diện không được thiết kế lại.

Các suite hồi quy: điều hướng, khung học, micro/ghi âm/đánh giá phát âm, picker, tiến độ, game và rời game, đọc khi gõ, phím Space/Enter, lưu bộ AI, soát nghĩa và chế độ từ vựng AI. AI dùng stub; micro dùng thiết bị giả trong kiểm thử như bộ test cũ.

Artifact tại máy này:

- `.cache/test-run/results.json` và log từng suite.
- `.cache/refactor-parity/before/` và `after/`: ảnh, thông số bố cục và `result.json`.
- `tests/build.cjs`, `tests/tooling.cjs`, `tests/file_proto_warn.js`: các kiểm tra build, watch và chuyển origin.

Baseline trước sửa đạt 96 kiểm tra ở ba suite chính, thêm 88 kiểm tra AI. Hai vấn đề test có sẵn đã được xác nhận trên bản cũ: kỳ vọng shortcut game đã bỏ và đường dẫn screenshot tuyệt đối của máy khác. Test được cập nhật theo hành vi hiện tại; không thay UI để làm test qua.

Hai điều chỉnh mã nhỏ ngoài di chuyển cấu trúc: biến `out` trong nhánh fallback của `hanSyllableList` đổi const thành let để build được; method SFX `unlock` đầu tiên bị ghi đè được bỏ, giữ method thực tế đang hoạt động.

Chưa chạy trên Safari/Firefox, thiết bị mobile thật hoặc hosting Vercel thực tế. Không đổi schema IndexedDB, khóa localStorage, API backend hoặc nghiệp vụ Pro. File build được sinh tại dist; tài liệu tìm source nằm trong [ARCHITECTURE.md](ARCHITECTURE.md).
