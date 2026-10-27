import { escapeHtml as safe } from "../../shared/utils.js";
import { readings } from "../journey/content.js";
import { state as catalog } from "../../data/catalog.js";
import { dbPut } from "../../shared/storage/lesson-repository.js";
import { openDataset } from "../typing/datasets.js";
import { lessonRepository } from "../../shared/lesson-bridge.js";
import { requireAccount, currentUser } from "../auth/service.js";
import { markNavigation, navigationVersion } from "../../app/routes.js";
import { onDataChange, learningStorage } from "../../shared/storage/account-data.js";
import { loadProgress } from "../typing/progress.js";
const $ = (id) => document.getElementById(id);
let level = 1, resumeRequest = 0, initialized = false;
const groupCache = /* @__PURE__ */ new Map();
const libraryVisible = () => !$("libraryCard").classList.contains("hidden");
function groups() {
  const source = level === 1 ? readings : catalog.HSK_DATA["hsk" + level];
  const cached = groupCache.get(level);
  if (cached?.source === source) return cached.groups;
  const result = buildGroups();
  groupCache.set(level, { source, groups: result });
  return result;
}
function visibleGroups() {
  const query = $("vocabSearch").value.trim().toLocaleLowerCase("vi");
  return groups().filter((g) => (g.title + " " + g.topic).toLocaleLowerCase("vi").includes(query));
}
function buildGroups() {
  if (level === 1) return readings.map((r) => ({ level, id: "hsk1-topic:" + r.id, title: r.title, topic: r.topic, rows: r.lines.map(([zh, py, vi], id) => ({ id, zh, py, vi })) }));
  const rows = (catalog.HSK_DATA["hsk" + level] || []).filter((r) => r && r[0] && r[2]);
  const size = Math.ceil(rows.length / 6);
  return Array.from({ length: 6 }, (_, i) => ({ level, id: `hsk${level}-part:${i + 1}`, title: `Chặng ${String(i + 1).padStart(2, "0")}`, topic: `Câu ${i * size + 1}–${Math.min(rows.length, (i + 1) * size)}`, rows: rows.slice(i * size, (i + 1) * size).map(([zh, py, vi], id) => ({ id, zh, py, vi })) })).filter((g) => g.rows.length);
}
function renderGroups() {
  if (!libraryVisible()) return;
  const active = document.querySelector("[data-vtab].active")?.dataset.vtab === "hsk";
  $("practiceGroups").hidden = !active;
  $("hskLevelPicker").hidden = !active;
  if (!active) return;
  $("practiceGroupsTitle").textContent = `HSK ${level} · ${level === 1 ? "Các nhóm chủ đề" : "Các chặng luyện tập"}`;
  $("practiceGroupsCaption").textContent = level === 1 ? "Bộ HSK 1 do GoPinyin biên soạn" : "Chia chặng từ bộ câu HSK hiện có";
  $("practiceGroupList").innerHTML = visibleGroups().map((g, i) => {
    const completed = Math.min(g.rows.length, Number(loadProgress("practice:" + g.id)?.mainIndex) || 0);
    return `<button type="button" class="practiceGroupCard" data-practice-group="${i}"><span class="groupIcon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zm10 3a3 3 0 0 1 3-3h4v15h-3a4 4 0 0 0-4 2"/></svg></span><span class="featureEyebrow">HSK ${level} · ${safe(g.topic)}</span><b>${safe(g.title)}</b><span>${completed} / ${g.rows.length} câu · Gõ / Nói</span><progress max="${g.rows.length}" value="${completed}" aria-label="Tiến độ Gõ"></progress><small>Bắt đầu luyện <span aria-hidden="true">→</span></small></button>`;
  }).join("");
  document.querySelectorAll("[data-hsk-level]").forEach((b) => {
    b.classList.toggle("selected", Number(b.dataset.hskLevel) === level);
    b.setAttribute("aria-pressed", String(Number(b.dataset.hskLevel) === level));
  });
}
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
  const request = ++resumeRequest, uid = currentUser()?.id;
  const next = await lessonRepository.continueDataset();
  if (request !== resumeRequest || uid !== currentUser()?.id || !libraryVisible()) return;
  const title = $("libraryResumeTitle"), sub = $("libraryResumeSub"), button = $("libraryResumeButton");
  if (next) {
    title.textContent = next.name;
    sub.textContent = `${next.completed}/${next.total} câu · tiến độ Gõ được giữ riêng`;
    button.textContent = "Học tiếp →";
    button.dataset.resumeId = next.id;
  } else {
    title.textContent = "Bắt đầu với bộ bạn yêu thích";
    sub.textContent = "Chọn HSK hoặc chủ đề. Gõ và Nói trong cùng một bộ.";
    button.textContent = "Luyện HSK 1 →";
    button.dataset.resumeId = "";
  }
}
function initializePracticeCatalog() {
  if (initialized) return;
  initialized = true;
  const root = $("libraryCard");
  document.addEventListener("gp:practice-reading", (e) => {
    const r = readings.find((x) => x.id === e.detail);
    if (r) void openGroup({ level: 1, id: "hsk1-topic:" + r.id, title: r.title, rows: r.lines.map(([zh, py, vi], id) => ({ id, zh, py, vi })) }, { forceTyping: true });
  });
  $("hskLevelPicker").innerHTML = Array.from({ length: 9 }, (_, i) => `<button type="button" data-hsk-level="${i + 1}" aria-pressed="${i === 0}">HSK ${i + 1}</button>`).join("");
  document.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-hsk-level]");
    if (pill) {
      level = Number(pill.dataset.hskLevel);
      renderGroups();
    }
    const card = e.target.closest("[data-practice-group]");
    if (card) {
      const group = visibleGroups()[Number(card.dataset.practiceGroup)];
      if (group) void openGroup(group);
    }
    if (e.target.closest("[data-vtab]")) queueMicrotask(renderGroups);
  });
  $("vocabSearch").addEventListener("input", renderGroups);
  $("libraryResumeButton").addEventListener("click", () => {
    const id = $("libraryResumeButton").dataset.resumeId;
    if (id) void openDataset(id);
    else void openGroup(groups()[0]);
  });
  document.addEventListener("gp:view-changed", () => {
    renderGroups();
    if (!root.classList.contains("hidden")) void refreshResume().catch(() => {
    });
  });
  onDataChange(() => {
    void refreshResume().catch(() => {
    });
  });
  renderGroups();
  void refreshResume().catch(() => {
  });
}
export {
  initializePracticeCatalog
};
