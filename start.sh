#!/usr/bin/env bash
# GoPinyin — chạy qua http://localhost (bắt buộc để Chrome nhớ quyền micro)
set -e
cd "$(dirname "$0")"
PORT="${PORT:-8080}"

echo ""
echo "  ============================================================"
echo "   GoPinyin  -  http://localhost:$PORT"
echo "   ------------------------------------------------------------"
echo "   Mở qua localhost thì Chrome chỉ hỏi quyền micro MỘT lần."
echo "   (Mở thẳng file:///... sẽ hỏi lại quyền MỖI LẦN bấm nói.)"
echo "  ============================================================"
echo ""

if command -v node >/dev/null 2>&1; then
  PORT="$PORT" node server/serve.js
elif command -v python3 >/dev/null 2>&1; then
  ( sleep 1; command -v open >/dev/null 2>&1 && open "http://localhost:$PORT/" || xdg-open "http://localhost:$PORT/" >/dev/null 2>&1 || true ) &
  python3 -m http.server "$PORT" --bind 127.0.0.1
else
  echo "  Không tìm thấy Node.js hoặc Python. Cài Node.js: https://nodejs.org"
  exit 1
fi
