import { readings } from "../journey/content.js";
import { state as catalog } from "../../data/catalog.js";
import { dbPut } from "../../shared/storage/lesson-repository.js";
import { openDataset } from "../typing/datasets.js";
import { lessonRepository } from "../../shared/lesson-bridge.js";
import { requireAccount, currentUser } from "../auth/service.js";
import { markNavigation, navigationVersion } from "../../app/routes.js";
import { onDataChange, learningStorage } from "../../shared/storage/account-data.js";
import { openVocabSource, state as libraryState } from "../library/catalog.js";
const $ = (id) => document.getElementById(id);
let resumeRequest = 0, initialized = false;
const libraryVisible = () => !$("libraryCard").classList.contains("hidden");
const matchesGroup = (id, group) => group === 'hsk' ? /^(practice:hsk|vocab:hsk[1-9]$)/.test(id) : (catalog.VOCAB_GROUPS.topic || []).some(source => id === 'vocab:' + source[0]);
async function openGroup(group, options = {}) {
  const navigation = markNavigation();
  if (!await requireAccount(() => openGroup(group, options)) || navigation !== navigationVersion()) return;
  const uid = currentUser()?.id;
  await dbPut({ id: "practice:" + group.id, name: `HSK ${group.level} · ${group.title}`, rows: group.rows, sourceName: "GoPinyin · Luyện tập", createdAt: Date.now(), updatedAt: Date.now() });
  if (uid !== currentUser()?.id || navigation !== navigationVersion()) return;
  const id = "practice:" + group.id;
  await openDataset(id, { navigation, practiceMode: options.forceTyping ? "typing" : learningStorage.getItem("cts:progress:practice-mode:" + id) || "typing" });
}
async function refreshResume() {
  if (!libraryVisible()) return;
  const request = ++resumeRequest, uid = currentUser()?.id, group = libraryState.libraryGroup || 'hsk';
  const next = await lessonRepository.continueDataset(id => matchesGroup(id,group));
  if (request !== resumeRequest || uid !== currentUser()?.id || group !== (libraryState.libraryGroup || 'hsk') || !libraryVisible()) return;
  const title = $("libraryResumeTitle"), sub = $("libraryResumeSub"), button = $("libraryResumeButton");
  const belongs = next && matchesGroup(next.id,group);
  if (belongs) {
    title.textContent = next.name;
    sub.textContent = `${next.completed}/${next.total} câu · tiến độ Gõ được giữ riêng`;
    button.textContent = "Học tiếp →";
    button.dataset.resumeId = next.id;
  } else {
    title.textContent = group === 'hsk' ? 'Sẵn sàng luyện HSK?' : 'Bắt đầu từ điều gần gũi nhất';
    sub.textContent = group === 'hsk' ? 'Chọn một cấp HSK. Luyện Gõ và Nói theo nhịp của bạn.' : 'Chọn một chủ đề bên dưới. Gõ để nhớ, nói để dùng.';
    button.textContent = group === 'hsk' ? 'Luyện HSK 1 →' : 'Khám phá chủ đề ↓';
    button.dataset.resumeId = "";
  }
}
function initializePracticeCatalog() {
  if (initialized) return;
  initialized = true;
  const root = $("libraryCard");
  document.addEventListener("gp:practice-reading", (e) => {
    const r = readings.find((x) => x.id === e.detail);
    if (r) void openGroup({ level: r.level, id: `reading:hsk${r.level}:${r.id}:v${r.revision}`, title: r.title, rows: r.lines.map(([zh, py, vi], id) => ({ id, zh, py, vi })) }, { forceTyping: true });
  });
  $("libraryResumeButton").addEventListener("click", () => {
    const id = $("libraryResumeButton").dataset.resumeId;
    if (id) void openDataset(id);
    else if (libraryState.libraryGroup === 'topic') $("vocabSearch").focus();
    else void openVocabSource("hsk1");
  });
  document.addEventListener("gp:view-changed", () => {
    if (!root.classList.contains("hidden")) void refreshResume().catch(() => {
    });
  });
  onDataChange(() => {
    void refreshResume().catch(() => {
    });
  });
  void refreshResume().catch(() => {
  });
}
export {
  initializePracticeCatalog
};
