const TOPICS = { all: "Tất cả chủ đề", introductions: "Làm quen", daily: "Sinh hoạt", food: "Ăn uống", shopping: "Mua sắm", habits: "Thói quen", grammar: "Diễn đạt" };
const VIDEOS = [
  { id: "8MTp5dZoFGM", title: "Giới thiệu bản thân bằng tiếng Trung", original: "HSK 1-2｜用中文介绍自己！Self-introduction in Chinese for Beginners", channel: "Chinese Daily Podcast", levels: [1, 2], topics: ["introductions"], duration: "16:13" },
  { id: "qna81vhSdfY", title: "15 tình huống giao tiếp với người lạ", original: "15 Everyday Chinese Conversations | With Strangers | HSK 1 2", channel: "Say Mandarin (Shuō Zhōngwén)", levels: [1, 2], topics: ["introductions", "daily"], duration: "" },
  { id: "_P9SIqzVZ0A", title: "Giao tiếp mỗi buổi sáng", original: "Chinese Conversation Practice Every Morning | HSK 1-2", channel: "Say Mandarin (Shuō Zhōngwén)", levels: [1, 2], topics: ["daily", "habits"], duration: "" },
  { id: "gnCXffOg7T8", title: "Hội thoại thường ngày cho người mới", original: "25 Minutes of Daily Chinese Conversations (HSK 1-2) | Simple Mandarin", channel: "Say Mandarin (Shuō Zhōngwén)", levels: [1, 2], topics: ["daily", "shopping"], duration: "" },
  { id: "Sk6UCH9yxpI", title: "Gọi món và sử dụng dịch vụ", original: "Chinese Conversation for Beginners | Ordering & Services Across China | HSK 1–2", channel: "Learn Chinese with Pipo", levels: [1, 2], topics: ["food", "daily"], duration: "32:30" },
  { id: "a7KaFnBGpz8", title: "Hội thoại tại quán cà phê", original: "咖啡店中文会话 | HSK1-2 | 学中文", channel: "Say Mandarin (Shuō Zhōngwén)", levels: [1, 2], topics: ["food"], duration: "22:44" },
  { id: "puEUQeKHP9I", title: "15 cuộc hội thoại ở nhà hàng", original: "15 Chinese Restaurant Conversations Every Beginner Must Know | HSK 1-2", channel: "Say Mandarin (Shuō Zhōngwén)", levels: [1, 2], topics: ["food"], duration: "20:04" },
  { id: "4AUtaYFjnpw", title: "Học giao tiếp khi đi ăn nhà hàng", original: "HSK 2-3 | 在餐厅学中文 | Learn Chinese at the Restaurant | Learn Chinese Podcast", channel: "Chinese Podcast For Learning", levels: [2, 3], topics: ["food"], duration: "24:37" },
  { id: "p9QQ9Nk5Rdk", title: "Tiếng Trung đơn giản ở quán cà phê", original: "HSK 2-3 | 咖啡店简单中文 | Chinese Listening Practice", channel: "Learn Chinese Through Podcast", levels: [2, 3], topics: ["food", "daily"], duration: "21:23" },
  { id: "ohitmlafP_8", title: "Bạn thường thức dậy lúc mấy giờ?", original: "你一般几点起床？How to say “Usually” in Chinese | HSK3 word:一般", channel: "Chloe Chinese Class", levels: [3], topics: ["habits", "daily"], duration: "" },
  { id: "0U-nmIcrHXU", title: "Mua sắm trực tuyến: đặt hàng, giao hàng, đổi trả", original: "Real Chinese Conversation: Online Shopping (Listening Practice HSK 3-4)", channel: "Learn Chinese with Pipo", levels: [3, 4], topics: ["shopping"], duration: "" },
  { id: "4xuzuLAAzt8", title: "Cách dùng 考虑 — Cân nhắc một quyết định", original: "How to Use 考虑 (to consider) in Chinese | HSK 4 (CC: Pinyin)", channel: "Chloe Chinese Class", levels: [4], topics: ["grammar", "daily"], duration: "19:08" },
  { id: "UlnYlfxugCA", title: "Diễn đạt “không bao giờ… nữa” với 再也不", original: 'How to Say "will never again" in Chinese? | HSK 4 Grammar 再也不……', channel: "Chloe Chinese Class", levels: [4], topics: ["grammar", "habits"], duration: "21:22" },
  { id: "V1xjCi-1EKU", title: "Trò chuyện về thói quen", original: "HSK 4 - 5 | Conversations on Habits | Chinese Listening Practice", channel: "Learn Chinese Through Podcast", levels: [4], publisherRange: "HSK 4–5", topics: ["habits"], duration: "27:03" }
].map((video) => Object.freeze({ ...video, url: "https://www.youtube.com/watch?v=" + video.id, transcriptStatus: "pending" }));
function filterVideos({ level = "all", topic = "all", query = "" } = {}) {
  const normalized = (value) => String(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/đ/g, "d");
  const search = normalized(query.trim());
  return VIDEOS.filter((v) => (level === "all" || v.levels.includes(Number(level))) && (topic === "all" || v.topics.includes(topic)) && normalized([v.title, v.original, v.channel, ...v.topics.map((t) => TOPICS[t])].join(" ")).includes(search));
}
export {
  TOPICS,
  VIDEOS,
  filterVideos
};
