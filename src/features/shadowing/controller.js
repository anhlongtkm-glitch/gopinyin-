import { escapeHtml as esc } from '../../shared/utils.js';
import { loadYouTubeAPI } from './youtube-api.js';
import { normalizeAnswer, cueAt, parseSubtitles } from "./model.js";
import { VIDEOS, TOPICS, filterVideos } from "./catalog.js";
import { showView } from "../../app/navigation.js";
import { writeVideoRoute, navigationVersion } from "../../app/routes.js";
import { dataOwner, learningStorage, onDataChange } from "../../shared/storage/account-data.js";
import { requireAccount } from "../auth/service.js";
import { recordActivity } from "../journey/controller.js";
import { studyOverlayOpen } from "../../shared/study/interactions.js";
const $ = id => document.getElementById("sv-" + id);
let mode = "shadow", cues = [], selected = 0, active = -1, playing = false, time = 0, duration = 0, rate = 1, muted = false, hiddenVideo = false, following = true, bookmarksOnly = false;
let player = null, playerReady = false, epoch = 0, timer = 0, loopCue = -1, handlingBoundary = false, pendingSeek = null, pendingPlay = false, cuedAt = null;
let recorder = null, stream = null, recordUrl = "", recordEpoch = 0, recordTimer, requesting = false, recordCue = "", recordSource = "", startedAt = 0;
let composing = false, imeUntil = 0, revealed = false;
const layers = { hanzi: true, pinyin: true, translation: true }, bookmarks = /* @__PURE__ */ new Set();
const drafts = /* @__PURE__ */ new Map(), draftKey = () => JSON.stringify([video?.id, current()?.id, current()?.hanzi]);
const fmt = (n) => `${Math.floor(Math.max(0, n) / 60)}:${String(Math.floor(Math.max(0, n) % 60)).padStart(2, "0")}`;
const current = () => cues[selected];
const root = () => document.getElementById("shadowVideoCard");
const visible = () => root() && !root().classList.contains("hidden");
const isModal = () => studyOverlayOpen() || !!root().querySelector("dialog[open]");
const status = (text) => {
  $("playerStatus").textContent = text;
};
function bookmarkKey() {
  return "cts:progress:shadow-video:v1:" + video.id;
}
function loadBookmarks() {
  bookmarks.clear();
  for (const id of Array.isArray(saved.bookmarks) ? saved.bookmarks : []) bookmarks.add(String(id));
}
function saveBookmarks() {
  persist();
}
function readTime() {
  if (cuedAt !== null) return cuedAt;
  return playerReady ? Number(player.getCurrentTime()) || 0 : time;
}
function showPlaybackState(on) {
  playing = on;
  $("play").textContent = on ? "Ⅱ" : "▶";
  $("play").setAttribute("aria-label", on ? "Tạm dừng" : "Phát video");
  clearInterval(timer);
  timer = 0;
  if (on && !document.hidden) timer = setInterval(tick, 100);
}
function pause() {
  pendingPlay = false;
  if (playerReady) player.pauseVideo();
  showPlaybackState(false);
  updateTime();
}
async function play() {
  if (hiddenVideo) toggleVideo(false);
  if (document.hidden) return;
  if (recorder || requesting) {
    status("Dừng bản thu trước khi phát lại video.");
    return;
  }
  $("recordPlayback").pause();
  if (!playerReady) {
    pendingPlay = true;
    await loadYoutube();
    return;
  }
  player.playVideo();
  loopCue = selected;
}
function seek(value, autoplay = false) {
  const max = duration || value;
  time = Math.max(0, Math.min(Number(value) || 0, max));
  if (playerReady) { cuedAt = null; player.seekTo(time, true); }
  else pendingSeek = time;
  updateTime();
  setActive(cueAt(cues, time));
  if (autoplay) void play();
}
function stopRecording(discard = false) {
  recordEpoch++;
  requesting = false;
  clearTimeout(recordTimer);
  if (recorder && recorder.state !== "inactive") {
    if (discard) recorder.onstop = null;
    recorder.stop();
  }
  stream?.getTracks().forEach((t) => t.stop());
  recorder = null;
  stream = null;
  $("record").disabled = false;
  $("record").innerHTML = "Bắt đầu nói <kbd>Enter</kbd>";
}
function clearRecord() {
  stopRecording(true);
  $("recordPlayback").pause();
  $("recordPlayback").removeAttribute("src");
  $("recordPlayback").hidden = true;
  if (recordUrl) URL.revokeObjectURL(recordUrl);
  recordUrl = "";
  $("recordStatus").textContent = "Bản thu chỉ ở phiên này; chưa có chấm điểm phát âm tự động.";
}
function resetDictation() {
  revealed = false;
  root().classList.remove("answer-revealed");
  root().querySelectorAll(".answer-cue").forEach((c) => c.classList.remove("answer-cue"));
  $("answer").value = drafts.get(draftKey()) || "";
  $("dictationResult").textContent = "";
  $("revealAnswer").setAttribute("aria-pressed", "false");
  $("revealAnswer").textContent = "Hiện đáp án";
  $("dictationPrompt").textContent = current() ? `Đang luyện câu ${selected + 1}/${cues.length}. Bấm 4 để nghe lại; lời thoại được che khi viết chính tả.` : "Chọn một câu có bản chép để luyện.";
}
function selectCue(index, autoplay = true) {
  if (index < 0 || index >= cues.length) return;
  if (index !== selected || recorder || requesting) clearRecord();
  else $("recordPlayback").pause();
  selected = index;
  loopCue = index;
  resetDictation();
  seek(current().start, autoplay);
  updateControls();
}
function setActive(index) {
  if (active === index) return;
  active = index;
  root().querySelectorAll(".cue").forEach((el, i) => {
    el.classList.toggle("active", i === index);
    el.querySelector(".cueSeek").setAttribute("aria-current", i === index ? "true" : "false");
  });
  if (index >= 0) {
    if (index !== selected) {
      if (recorder || requesting) clearRecord();
      selected = index;
      resetDictation();
      updateControls();
    }
    if (following) {
      const el = $("transcript").children[index];
      if (el && !el.hidden) $("transcript").scrollTo({ top: Math.max(0, el.offsetTop - $("transcript").offsetTop - 16), behavior: "auto" });
    }
  }
}
function updateTime() {
  time = readTime();
  $("seek").max = String(duration || 1);
  $("seek").value = String(time);
  $("time").textContent = fmt(time) + " / " + fmt(duration);
}
function tick() {
  if (document.hidden) {
    pause();
    return;
  }
  if (mode === "dictation" && composing) {
    pause();
    status("Đã dừng để giữ câu đang viết.");
    return;
  }
  updateTime();
  const boundary = cues[loopCue];
  if (playing && boundary && !handlingBoundary && time >= boundary.end && ($("loop").getAttribute("aria-pressed") === "true" || $("autoPause").getAttribute("aria-pressed") === "true")) {
    handlingBoundary = true;
    if ($("loop").getAttribute("aria-pressed") === "true") seek(boundary.start, false);
    else {
      pause();
      seek(boundary.end, false);
      status("Đã dừng cuối câu. Nói theo hoặc bấm 5 để sang câu.");
    }
    setTimeout(() => {
      handlingBoundary = false;
    }, 200);
    return;
  }
  setActive(cueAt(cues, time));
  if (playing && time - lastSavedTime >= 5) {
    persist();
    lastSavedTime = time;
  }
}
function renderTranscript() {
  active = -1;
  $("cueCount").textContent = cues.length ? `${cues.length} câu · bấm câu để phát đoạn` : "Chưa có phụ đề";
  $("transcript").innerHTML = cues.length ? cues.map((c, i) => `<article class="cue" role="listitem" data-cue="${i}"><div class="cueHead"><span><b>#${i + 1}</b>${fmt(c.start)} – ${fmt(c.end)}</span><button type="button" class="bookmark" data-bookmark="${i}" aria-label="Đánh dấu câu ${i + 1}" aria-pressed="${bookmarks.has(c.id)}">⚑</button></div><button type="button" class="cueSeek" data-seek-cue="${i}" aria-label="Phát câu ${i + 1}"><span class="words">${c.words.map(([han, py]) => `<span class="word"><ruby><span class="han">${esc(han)}</span><rt>${esc(py)}</rt></ruby></span>`).join("")}</span>${c.vi ? `<span class="translation">${esc(c.vi)}</span>` : ""}</button></article>`).join("") : '<div class="emptyTranscript"><h3>Video đã có. Bản chép cần nhập riêng.</h3><p>Nhập SRT/VTT có mốc thời gian hoặc JSON gồm chữ Hán, Pinyin và bản dịch của đúng video này.</p><button type="button" data-import>Nhập phụ đề</button><p class="small">Có thể xem phụ đề của tác giả bằng nút CC trong YouTube. Các lớp Pinyin / bản dịch bên đây chỉ hiển thị khi tệp nhập có dữ liệu tương ứng.</p></div>';
  filterBookmarks();
  updateControls();
  setActive(cueAt(cues, time));
}
function filterBookmarks() {
  root().querySelectorAll("[data-cue]").forEach((el) => {
    el.hidden = bookmarksOnly && !bookmarks.has(cues[Number(el.dataset.cue)].id);
  });
}
function updateControls() {
  const has = !!current();
  for (const id of ["previous", "next", "replay", "autoPause", "loop"]) $(id).disabled = !has;
  $("previous").disabled = !has || selected === 0;
  $("next").disabled = !has || selected === cues.length - 1;
  $("record").disabled = !has || requesting;
  $("answer").disabled = !has;
  $("dictationForm").querySelector("[type=submit]").disabled = !has;
  $("revealAnswer").disabled = !has;
}
async function loadYoutube() {
  if (!visible() || playerReady || loading) return;
  loading = true;
  const intent = ++epoch;
  status("Đang kết nối YouTube…");
  $("loadYoutube").disabled = true;
  try {
    await loadYouTubeAPI();
    if (intent !== epoch || !visible()) return;
    if (player) player.destroy();
    if (!$("youtubeHost")) {
      const host = document.createElement("div");
      host.id = "sv-youtubeHost";
      $("videoStage").prepend(host);
    }
    player = new window.YT.Player("sv-youtubeHost", { videoId: video.id, host: "https://www.youtube-nocookie.com", width: "100%", height: "100%", playerVars: { origin: location.origin, playsinline: 1, controls: 1, autoplay: 0, fs: 1 }, events: { onReady: () => {
      if (intent !== epoch) {
        return;
      }
      playerReady = true;
      duration = player.getDuration() || 0;
      // cueVideoById restores position without seekTo's implicit start.
      const playRequested = pendingPlay;
      pendingPlay = false;
      if (pendingSeek !== null) {
        cuedAt = pendingSeek;
        pendingSeek = null;
        player.cueVideoById({videoId: video.id, startSeconds: cuedAt});
      }
      if (playRequested && !hiddenVideo && !document.hidden) player.playVideo();
      player.setVolume(Number($("volume").value));
      $("videoPlaceholder").hidden = true;
      updatePlaybackRates();
      updateTime();
      status("Đã kết nối YouTube. Bấm phát trong player hoặc nút Phát bên dưới.");
    }, onStateChange: (e) => {
      if (intent !== epoch) return;
      if (e.data === 1) cuedAt = null;
      if (e.data === 1 && (hiddenVideo || document.hidden || recorder || requesting)) {
        player.pauseVideo();
        return;
      }
      if (e.data === 1) $("recordPlayback").pause();
      duration = player.getDuration() || 0;
      updatePlaybackRates();
      showPlaybackState(e.data === 1);
      updateTime();
      setActive(cueAt(cues, time));
    }, onPlaybackRateChange: (e) => {
      if (intent !== epoch) return;
      rate = e.data;
      $("speed").value = String(rate);
    }, onAutoplayBlocked: () => {
      if (intent === epoch) status("Trình duyệt chưa cho tự phát. Bấm nút phát trực tiếp trong YouTube.");
    }, onError: (e) => {
      if (intent !== epoch) return;
      playerReady = false;
      loading = false;
      $("videoPlaceholder").hidden = false;
      $("loadYoutube").disabled = false;
      $("loadYoutube").textContent = "Thử kết nối lại";
      showPlaybackState(false);
      status({ 100: "Video không còn công khai.", 101: "Video không cho phép nhúng.", 150: "Video không cho phép nhúng.", 153: "YouTube không nhận được thông tin nguồn nhúng. Hãy mở bản xem trước qua localhost." }[e.data] || "Không phát được video YouTube. Thử lại hoặc mở video gốc.");
    } } });
  } catch (e) {
    if (intent === epoch) status(e.message);
  } finally {
    if (intent === epoch) {
      loading = false;
      $("loadYoutube").disabled = false;
    }
  }
}
function updatePlaybackRates() {
  // YouTube may not expose rates until metadata for a newly cued video arrives.
  const available = player?.getAvailablePlaybackRates?.();
  const rates = Array.isArray(available) && available.length ? available : [1];
  [...$("speed").options].forEach(option => { option.disabled = !rates.includes(Number(option.value)); });
}
function toggleVideo(hide = !hiddenVideo) {
  if (hide) {
    pause();
    if (recorder || requesting) clearRecord();
  }
  hiddenVideo = hide;
  $("videoStage").hidden = hide;
  $("collapsedVideo").hidden = !hide;
  $("hideVideo").setAttribute("aria-pressed", String(hide));
  $("hideVideo").textContent = hide ? "Hiện video" : "Ẩn video";
}
function changeMode(next) {
  if (next === mode) return;
  pause();
  clearRecord();
  mode = next;
  if (mode === "dictation") {
    $("autoPause").setAttribute("aria-pressed", "true");
    $("loop").setAttribute("aria-pressed", "false");
  }
  root().querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
  $("shadowPractice").hidden = mode !== "shadow";
  $("dictationPractice").hidden = mode !== "dictation";
  root().classList.toggle("dictation-mask", mode === "dictation");
  resetDictation();
}
async function toggleRecord() {
  if (!visible()) return;
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  if (requesting || !current()) return;
  const nav = navigationVersion();
  if (!await requireAccount(() => toggleRecord()) || nav !== navigationVersion() || !visible()) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $("recordStatus").textContent = "Trình duyệt chưa hỗ trợ thu âm. Hãy thử Chrome hoặc Edge qua localhost.";
    return;
  }
  pause();
  clearRecord();
  const intent = recordEpoch, recordOwner = dataOwner();
  recordCue = current().id;
  recordSource = video.id;
  requesting = true;
  $("record").disabled = true;
  $("recordStatus").textContent = "Đang xin quyền micro…";
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (intent !== recordEpoch || recordOwner !== dataOwner() || video.id !== recordSource || current()?.id !== recordCue || document.hidden || !visible()) {
      acquired.getTracks().forEach((t) => t.stop());
      return;
    }
    stream = acquired;
    const chunks = [];
    const take = new MediaRecorder(acquired);
    recorder = take;
    take.ondataavailable = (e) => {
      if (intent === recordEpoch && e.data.size) chunks.push(e.data);
    };
    take.onstop = () => {
      acquired.getTracks().forEach((t) => t.stop());
      if (intent !== recordEpoch || recordOwner !== dataOwner() || !visible()) return;
      clearTimeout(recordTimer);
      recorder = null;
      stream = null;
      $("record").innerHTML = "Nói lại <kbd>Enter</kbd>";
      if (!chunks.length || performance.now() - startedAt < 2e3) {
        $("recordStatus").textContent = "Bản thu quá ngắn. Hãy nói lại cả câu.";
        return;
      }
      recordActivity("shadow", video.id + ":" + recordCue + ":" + current().hanzi);
      recordUrl = URL.createObjectURL(new Blob(chunks, { type: take.mimeType || chunks[0].type }));
      $("recordPlayback").src = recordUrl;
      $("recordPlayback").hidden = false;
      $("recordStatus").textContent = "Đã thu xong. Nghe lại giọng của bạn và phát lại câu mẫu để đối chiếu. Chưa có điểm chấm tự động.";
    };
    take.onerror = () => {
      if (intent !== recordEpoch || recorder !== take) return;
      clearRecord();
      $("recordStatus").textContent = "Thu âm bị gián đoạn. Hãy thử lại.";
    };
    startedAt = performance.now();
    take.start();
    $("record").innerHTML = "Dừng ghi âm <kbd>Enter</kbd>";
    $("recordStatus").textContent = "Đang thu… tối đa 20 giây.";
    recordTimer = setTimeout(() => {
      if (take.state === "recording") take.stop();
    }, 2e4);
  } catch {
    if (intent === recordEpoch) {
      clearRecord();
      $("recordStatus").textContent = "Không mở được micro. Kiểm tra quyền micro rồi thử lại.";
    }
  } finally {
    if (intent === recordEpoch) {
      requesting = false;
      $("record").disabled = false;
    }
  }
}
function toggleLayer(name) {
  layers[name] = !layers[name];
  root().classList.toggle("hide-" + name, !layers[name]);
  root().querySelector(`[data-layer="${name}"]`).setAttribute("aria-pressed", String(layers[name]));
  $("allLayersHidden").hidden = Object.values(layers).some(Boolean);
}
function openDialog(id) {
  pause();
  if (recorder || requesting) clearRecord();
  const dialog = $(id);
  dialog.showModal();
  dialog.querySelector("button")?.focus();
}
let video = VIDEOS[0], saved = {}, owner = dataOwner(), loading = false, lastSavedTime = 0, initialized = false;
const memory = /* @__PURE__ */ new Map(), captionMemory = /* @__PURE__ */ new Map();
let filters = { level: "all", topic: "all", query: "" }, libraryScroll = 0;
function readSaved(id) {
  try {
    return JSON.parse(learningStorage.getItem("cts:progress:shadow-video:v1:" + id) || "null") || memory.get(id) || {};
  } catch {
    return {};
  }
}
function persist() {
  if (!video || owner !== dataOwner()) return;
  const value = { time: readTime(), mode, bookmarks: [...bookmarks], layers: { ...layers }, updatedAt: Date.now() };
  memory.set(video.id, value);
  saved = value;
  try {
    if (dataOwner()) learningStorage.setItem(bookmarkKey(), JSON.stringify(value));
  } catch {
    status("Chưa lưu được tiến độ trên máy.");
  }
}
function persistTranscript() {
  captionMemory.set(video.id, cues);
  try {
    if (dataOwner()) learningStorage.setItem("cts:progress:shadow-captions:v1:" + video.id, JSON.stringify({ videoId: video.id, cues }));
  } catch {
    status("Phụ đề đang dùng trong phiên này; chưa lưu được.");
  }
}
function cleanup({ save = true } = {}) {
  if (save && visible()) persist();
  pause();
  clearRecord();
  epoch++;
  loading = false;
  pendingSeek = null;
  pendingPlay = false;
  cuedAt = null;
  playerReady = false;
  try {
    player?.destroy();
  } catch {
  }
  player = null;
  root().querySelectorAll("dialog[open]").forEach((d) => d.close());
}
async function openShadowVideo(id, options = {}) {
  const next = VIDEOS.find((v) => v.id === id);
  if (!next) {
    await showView("shadow", { route: options.route !== false, navigation: options.navigation });
    return false;
  }
  if (!document.getElementById("shadowCard").classList.contains("hidden")) libraryScroll = scrollY;
  const opened = await showView("shadowVideo", { ...options, route: false });
  if (!opened) return false;
  video = next;
  saved = readSaved(id);
  selected = 0;
  active = -1;
  cues = [];
  time = Math.max(0, Math.min(Number(saved.time) || 0, 86400));
  duration = 0;
  lastSavedTime = time;
  try {
    const text = learningStorage.getItem("cts:progress:shadow-captions:v1:" + id);
    if (text) cues = parseSubtitles(text, "saved.json", id);
    else cues = captionMemory.get(id) || [];
  } catch {
  }
  selected = Math.max(0, cueAt(cues, time));
  mode = saved.mode === "dictation" ? "shadow" : "dictation";
  changeMode(saved.mode === "dictation" ? "dictation" : "shadow");
  for (const key of Object.keys(layers)) {
    layers[key] = saved.layers?.[key] !== false;
    root().classList.toggle("hide-" + key, !layers[key]);
    root().querySelector('[data-layer="' + key + '"]').setAttribute("aria-pressed", String(layers[key]));
  }
  $("allLayersHidden").hidden = Object.values(layers).some(Boolean);
  hiddenVideo = false;
  $("videoStage").hidden = false;
  $("collapsedVideo").hidden = true;
  $("hideVideo").textContent = "Ẩn video";
  $("hideVideo").setAttribute("aria-pressed", "false");
  $("videoPlaceholder").hidden = false;
  $("loadYoutube").disabled = false;
  $("loadYoutube").textContent = "Mở video YouTube ▶";
  composing = false;
  imeUntil = 0;
  handlingBoundary = false;
  loopCue = selected;
  rate = 1;
  muted = false;
  $("speed").value = "1";
  [...$("speed").options].forEach((o) => o.disabled = false);
  $("mute").setAttribute("aria-pressed", "false");
  $("mute").setAttribute("aria-label", "Tắt tiếng");
  if (!$("youtubeHost")) {
    const host = document.createElement("div");
    host.id = "sv-youtubeHost";
    $("videoStage").prepend(host);
  }
  $("lessonTitle").textContent = video.title;
  $("level").textContent = video.publisherRange || "HSK " + video.levels.join("–");
  $("lessonSub").textContent = video.channel + " · YouTube trực tiếp";
  $("originalVideo").href = video.url;
  $("sourceNotice").textContent = "Video phát từ YouTube. " + (cues.length ? "Bản chép do bạn nhập; hãy đối chiếu mốc thời gian và nội dung trước khi luyện." : "Chưa có bản chép đồng bộ được kiểm tra. Bạn vẫn có thể xem video hoặc nhập phụ đề của đúng video để luyện từng câu.");
  $("importStatus").textContent = "";
  following = true;
  bookmarksOnly = false;
  $("follow").setAttribute("aria-pressed", "true");
  $("bookmarksOnly").setAttribute("aria-pressed", "false");
  $("returnToCue").hidden = true;
  $("loop").setAttribute("aria-pressed", "false");
  $("autoPause").setAttribute("aria-pressed", String(mode === "dictation"));
  loadBookmarks();
  renderTranscript();
  resetDictation();
  updateTime();
  pendingSeek = time;
  status("Bấm Mở video YouTube để kết nối.");
  if (options.route !== false) writeVideoRoute(id);
  return true;
}
function renderLibrary() {
  const items = filterVideos(filters);
  $("resultCount").textContent = items.length + " video";
  $("grid").innerHTML = items.length ? items.map((v) => '<button class="sv-videoCard" data-sv-video="' + v.id + '"><span class="sv-thumb"><img loading="lazy" decoding="async" width="480" height="270" src="https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg" alt=""><span class="sv-playMark" aria-hidden="true">▶</span>' + (v.duration ? '<span class="sv-duration">' + v.duration + "</span>" : "") + '</span><span class="sv-videoInfo"><span class="sv-cardLevel">' + esc(v.publisherRange || "HSK " + v.levels.join("–")) + "</span><strong>" + esc(v.title) + '</strong><span class="sv-channel">' + esc(v.channel) + '</span><span class="sv-cardTopics">' + v.topics.map((t) => esc(TOPICS[t])).join(" · ") + '</span><span class="sv-captionBadge">YouTube · Bản chép nhập riêng</span></span></button>').join("") : '<div class="emptyTranscript"><h3>Chưa có video khớp bộ lọc</h3><p>Thử chủ đề khác hoặc xóa từ khóa.</p><button id="sv-resetFilters">Xóa bộ lọc</button></div>';
  $("grid").querySelectorAll("img").forEach((img) => img.onerror = () => {
    img.hidden = true;
  });
  $("levels").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.svLevel === filters.level)));
  const latest = VIDEOS.map((v) => ({ video: v, progress: readSaved(v.id) })).filter((x) => x.progress.time > 0).sort((a, b) => (b.progress.updatedAt || 0) - (a.progress.updatedAt || 0))[0];
  $("resume").hidden = !latest;
  if (latest) $("resume").innerHTML = '<div><span class="eyebrow">TIẾP TỤC NGHE</span><b>' + esc(latest.video.title) + "</b><p>Đang ở " + fmt(latest.progress.time) + " · " + esc(latest.video.channel) + '</p></div><button class="primary" data-sv-video="' + latest.video.id + '">Nghe tiếp →</button>';
}
function initializeShadowing() {
  if (initialized || !root()) return;
  initialized = true;
  $("topic").innerHTML = Object.entries(TOPICS).map(([id, label]) => '<option value="' + id + '">' + label + "</option>").join("");
  document.getElementById("shadowCard").addEventListener("click", (e) => {
    const chosen = e.target.closest("[data-sv-video]");
    if (chosen) {
      void openShadowVideo(chosen.dataset.svVideo);
      return;
    }
    const level = e.target.closest("[data-sv-level]");
    if (level) {
      filters.level = level.dataset.svLevel;
      renderLibrary();
    }
    if (e.target.closest("#sv-resetFilters")) {
      filters = { level: "all", topic: "all", query: "" };
      $("search").value = "";
      $("topic").value = "all";
      renderLibrary();
    }
  });
  $("search").oninput = (e) => {
    filters.query = e.target.value;
    renderLibrary();
  };
  $("topic").onchange = (e) => {
    filters.topic = e.target.value;
    renderLibrary();
  };
  $("openText").onclick = () => showView("shadowText");
  $("backVideos").onclick = () => showView("shadow");
  document.addEventListener("gp:view-leaving", () => {
    cleanup();
  });
  document.addEventListener("gp:view-changed", (e) => {
    if (e.detail === "shadow") {
      renderLibrary();
      window.scrollTo({ top: libraryScroll, behavior: "instant" });
    }
  });
  document.addEventListener("gp:more-opened", () => {
    if (visible()) {
      pause();
      clearRecord();
      persist();
    }
  });
  onDataChange(() => {
    if (owner === dataOwner()) return;
    cleanup({ save: false });
    owner = dataOwner();
    memory.clear();
    captionMemory.clear();
    drafts.clear();
    bookmarks.clear();
    cues = [];
    saved = {};
    time = 0;
    selected = 0;
    renderLibrary();
    if (visible()) void openShadowVideo(video.id, { route: false, navigation: navigationVersion() });
  });
  renderLibrary();
  root().addEventListener("click", (e) => {
    const modeButton = e.target.closest("[data-mode]");
    if (modeButton) changeMode(modeButton.dataset.mode);
    const toggle = e.target.closest("[data-layer]");
    if (toggle) toggleLayer(toggle.dataset.layer);
    const bookmark = e.target.closest("[data-bookmark]");
    if (bookmark) {
      const cue2 = cues[Number(bookmark.dataset.bookmark)];
      if (bookmarks.has(cue2.id)) bookmarks.delete(cue2.id);
      else bookmarks.add(cue2.id);
      bookmark.setAttribute("aria-pressed", String(bookmarks.has(cue2.id)));
      saveBookmarks();
      filterBookmarks();
    }
    const cue = e.target.closest("[data-seek-cue]");
    if (cue) selectCue(Number(cue.dataset.seekCue));
    if (e.target.closest("[data-import]")) $("subtitleFile").click();
    const close = e.target.closest("[data-close]");
    if (close) close.closest("dialog").close();
  });
  $("loadYoutube").onclick = loadYoutube;
  $("play").onclick = () => playing ? pause() : void play();
  $("previous").onclick = () => selectCue(selected - 1);
  $("next").onclick = () => selectCue(selected + 1);
  $("replay").onclick = () => selectCue(selected);
  $("record").onclick = toggleRecord;
  $("hideVideo").onclick = () => toggleVideo();
  $("showVideo").onclick = () => toggleVideo(false);
  $("seek").oninput = (e) => seek(Number(e.target.value));
  for (const [id, other] of [["autoPause", "loop"], ["loop", "autoPause"]]) $(id).onclick = () => {
    const on = $(id).getAttribute("aria-pressed") !== "true";
    $(id).setAttribute("aria-pressed", String(on));
    if (on) $(other).setAttribute("aria-pressed", "false");
    loopCue = selected;
  };
  $("speed").onchange = (e) => {
    if (playerReady) player.setPlaybackRate(Number(e.target.value));
  };
  $("mute").onclick = () => {
    muted = !muted;
    $("mute").setAttribute("aria-pressed", String(muted));
    $("mute").setAttribute("aria-label", muted ? "Bật tiếng" : "Tắt tiếng");
    if (playerReady) {
      if (muted) player.mute();
      else player.unMute();
    }
  };
  $("volume").oninput = (e) => {
    if (playerReady) player.setVolume(Number(e.target.value));
  };
  $("fullscreen").onclick = () => {
    if (hiddenVideo) toggleVideo(false);
    if (document.fullscreenElement) void document.exitFullscreen();
    else void $("videoStage").requestFullscreen?.().catch(() => status("Trình duyệt chưa cho phép toàn màn hình."));
  };
  $("follow").onclick = () => {
    following = !following;
    $("follow").setAttribute("aria-pressed", String(following));
    $("returnToCue").hidden = following;
  };
  $("returnToCue").onclick = () => {
    following = true;
    $("follow").setAttribute("aria-pressed", "true");
    $("returnToCue").hidden = true;
    const now = cueAt(cues, readTime());
    active = -1;
    setActive(now);
  };
  const manualScroll = () => {
    following = false;
    $("follow").setAttribute("aria-pressed", "false");
    $("returnToCue").hidden = false;
  };
  $("transcript").addEventListener("wheel", manualScroll, { passive: true });
  $("transcript").addEventListener("touchstart", manualScroll, { passive: true });
  $("bookmarksOnly").onclick = () => {
    bookmarksOnly = !bookmarksOnly;
    $("bookmarksOnly").setAttribute("aria-pressed", String(bookmarksOnly));
    filterBookmarks();
  };
  $("importButton").onclick = () => $("subtitleFile").click();
  $("subtitleFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (!visible()) return;
      if (file.size > 5e5) throw Error("Tệp phụ đề quá lớn.");
      const version = epoch, owner2 = dataOwner(), id = video.id;
      const parsed = parseSubtitles(await file.text(), file.name, id);
      if (version !== epoch || owner2 !== dataOwner() || !visible() || id !== video.id) return;
      pause();
      clearRecord();
      cues = parsed;
      selected = 0;
      loadBookmarks();
      renderTranscript();
      resetDictation();
      persistTranscript();
      persist();
      $("sourceNotice").textContent = "Đang dùng bản chép do bạn nhập. Hãy đối chiếu nội dung và mốc thời gian với video trước khi luyện.";
      $("importStatus").textContent = `Đã nhập ${cues.length} câu. ${cues.some((c) => !c.words.some((w) => w[1])) ? "Chưa có Pinyin ở một số câu. " : ""}${cues.some((c) => !c.vi) ? "Chưa có bản dịch ở một số câu." : ""}`;
    } catch (error) {
      $("importStatus").textContent = error.message;
    } finally {
      e.target.value = "";
    }
  };
  $("answer").addEventListener("compositionstart", () => {
    composing = true;
  });
  $("answer").addEventListener("compositionend", () => {
    composing = false;
    imeUntil = performance.now() + 120;
  });
  $("answer").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.isComposing || e.keyCode === 229 || composing || performance.now() < imeUntil)) e.preventDefault();
  });
  $("dictationForm").onsubmit = (e) => {
    e.preventDefault();
    if (composing || performance.now() < imeUntil || !current()) return;
    const correct = normalizeAnswer($("answer").value) === normalizeAnswer(current().hanzi);
    $("dictationResult").className = correct ? "correct" : "incorrect";
    $("dictationResult").textContent = correct ? "Chính xác! Bấm 5 để luyện câu tiếp." : "Chưa khớp. Nghe lại hoặc hiện đáp án để đối chiếu.";
  };
  $("answer").oninput = () => drafts.set(draftKey(), $("answer").value);
  $("revealAnswer").onclick = () => {
    revealed = !revealed;
    root().querySelectorAll(".cue").forEach((el, i) => el.classList.toggle("answer-cue", revealed && i === selected));
    root().classList.toggle("answer-revealed", revealed);
    $("revealAnswer").setAttribute("aria-pressed", String(revealed));
    $("revealAnswer").textContent = revealed ? "Ẩn đáp án" : "Hiện đáp án";
  };
  $("recordPlayback").onplay = () => pause();
  $("helpButton").onclick = () => openDialog("helpDialog");
  $("settingsButton").onclick = () => openDialog("settingsDialog");
  $("textSize").onchange = (e) => root().classList.toggle("large-text", e.target.value === "large");
  document.addEventListener("keydown", (e) => {
    if (!visible() || e.defaultPrevented || e.repeat || e.isComposing || e.keyCode === 229 || composing || performance.now() < imeUntil || e.ctrlKey || e.metaKey || e.altKey || isModal() || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if ((e.key === "Enter" || e.key === " ") && e.target.closest("button,a,summary")) return;
    const action = { "1": () => toggleLayer("hanzi"), "2": () => toggleLayer("pinyin"), "3": () => toggleLayer("translation"), "4": () => selectCue(selected), "5": () => selectCue(selected + 1), " ": () => playing ? pause() : void play(), "Enter": () => mode === "shadow" ? void toggleRecord() : void 0, "?": () => openDialog("helpDialog") }[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pause();
      clearRecord();
    }
  });
  window.addEventListener("pagehide", () => cleanup());
}
export {
  initializeShadowing,
  openShadowVideo
};
