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
  if ! node -e "require.resolve('esbuild')" >/dev/null 2>&1; then
    echo "Chưa cài dependencies. Chạy npm install trong thư mục dự án."
    exit 1
  fi
  PORT="$PORT" node scripts/dev.mjs
else
  echo "  Không tìm thấy Node.js. Cài Node.js: https://nodejs.org"
  exit 1
fi
