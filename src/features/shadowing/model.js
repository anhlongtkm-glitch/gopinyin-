function normalizeAnswer(value) {
  return String(value).normalize("NFKC").replace(/[\s\p{P}]/gu, "");
}
function cueAt(cues, time) {
  let low = 0, high = cues.length - 1;
  while (low <= high) {
    const mid = low + high >> 1, c = cues[mid];
    if (time < c.start) high = mid - 1;
    else if (time >= c.end) low = mid + 1;
    else return mid;
  }
  return -1;
}
function parseTime(value) {
  const parts = String(value).replace(",", ".").split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some((x) => !Number.isFinite(x) || x < 0)) throw Error("Timestamp không hợp lệ.");
  return parts.reduce((sum, x) => sum * 60 + x, 0);
}
function parseSubtitles(text, filename, expectedVideo) {
  if (!/\.(json|srt|vtt)$/i.test(filename)) throw Error("Chọn tệp JSON, SRT hoặc VTT.");
  if (text.length > 5e5) throw Error("Tệp phụ đề quá lớn.");
  let rows;
  if (filename.toLowerCase().endsWith(".json")) {
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || Array.isArray(input) || input.videoId !== expectedVideo) throw Error("videoId của phụ đề không khớp video đang học.");
    rows = input.cues;
  } else {
    rows = [];
    for (const block of text.replace(/^\uFEFF/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
      const lines = block.split("\n"), at = lines.findIndex((line) => line.includes("-->"));
      if (at < 0) continue;
      const [start, end] = lines[at].split("-->").map((s) => parseTime(s.trim().split(/\s/)[0]));
      const hanzi = lines.slice(at + 1).join(" ").replace(/<[^>]*>/g, "").trim();
      if (hanzi) rows.push({ start, end, hanzi });
    }
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > 1e3) throw Error("Cần từ 1 đến 1.000 câu có timestamp.");
  const ids = /* @__PURE__ */ new Set();
  const cues = rows.map((row, i) => {
    const start = Number(row.start), end = Number(row.end), id = String(row.id ?? i + 1), hanzi = String(row.hanzi || "").trim(), vi = String(row.vi || "");
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > 86400 || !hanzi || hanzi.length > 2e3 || vi.length > 4e3 || ids.has(id)) throw Error("Câu hoặc timestamp không hợp lệ tại dòng " + (i + 1));
    ids.add(id);
    const words = Array.isArray(row.words) ? row.words.map((w) => {
      if (!Array.isArray(w) || w.length < 2) throw Error("Cấu trúc words không hợp lệ.");
      return [String(w[0]), String(w[1])];
    }) : [[hanzi, String(row.pinyin || "")]];
    if (words.length > 500 || words.map((w) => w[0]).join("") !== hanzi) throw Error("words phải ghép đúng câu Hán tại dòng " + (i + 1));
    return { id, start, end, hanzi, vi, words };
  }).sort((a, b) => a.start - b.start);
  if (cues.some((c, i) => i > 0 && c.start < cues[i - 1].end)) throw Error("Các câu đang chồng thời gian; hãy căn lại trước khi nhập.");
  return cues;
}
export {
  cueAt,
  normalizeAnswer,
  parseSubtitles,
  parseTime
};
