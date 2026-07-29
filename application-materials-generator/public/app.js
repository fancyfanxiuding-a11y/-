const schoolTabs = document.querySelector("#schoolTabs");
const schoolTitle = document.querySelector("#schoolTitle");
const sourceBadge = document.querySelector("#sourceBadge");
const loadingBox = document.querySelector("#loadingBox");
const typingText = document.querySelector("#typingText");
const materialsList = document.querySelector("#materialsList");
const progressBlock = document.querySelector("#progressBlock");
const progressRing = document.querySelector("#progressRing");
const progressPercent = document.querySelector("#progressPercent");
const progressText = document.querySelector("#progressText");
const celebration = document.querySelector("#celebration");

let currentSchool = "NYU";
let currentItems = [];
let checkedItems = new Set();
let loading = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setActiveSchool(school) {
  for (const button of schoolTabs.querySelectorAll(".school-tab")) {
    button.classList.toggle("active", button.dataset.school === school);
  }
}

function setLoading(isLoading) {
  loading = isLoading;
  loadingBox.hidden = !isLoading;
  materialsList.hidden = isLoading;
  progressBlock.hidden = isLoading || currentItems.length === 0;
  celebration.hidden = true;
}

async function playTyping() {
  const text = "AI 正在查申请要求…";
  typingText.textContent = "";

  // 打字动画：让学生知道后台正在查资料，不是页面卡住了。
  for (const char of text) {
    if (!loading) return;
    typingText.textContent += char;
    await new Promise((resolve) => setTimeout(resolve, 55));
  }
}

function getDaysUntil(deadline) {
  if (!deadline) return null;
  const due = new Date(`${deadline}T23:59:59`);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function getDeadlineBadge(deadline) {
  const days = getDaysUntil(deadline);

  if (days === null) {
    return {
      label: "截止日待确认",
      detail: "",
      level: "unknown"
    };
  }

  if (days < 0) {
    return {
      label: `已过 ${Math.abs(days)} 天`,
      detail: deadline,
      level: "danger"
    };
  }

  if (days <= 7) {
    return {
      label: `还剩 ${days} 天`,
      detail: deadline,
      level: "danger"
    };
  }

  if (days <= 21) {
    return {
      label: `还剩 ${days} 天`,
      detail: deadline,
      level: "warning"
    };
  }

  return {
    label: `还剩 ${days} 天`,
    detail: deadline,
    level: "normal"
  };
}

function updateProgress() {
  const total = currentItems.length;
  const done = checkedItems.size;
  const percent = total ? Math.round((done / total) * 100) : 0;

  progressBlock.hidden = total === 0 || loading;
  progressRing.style.setProperty("--progress", `${percent * 3.6}deg`);
  progressPercent.textContent = `${percent}%`;
  progressText.textContent = `已完成 ${done}/${total} 项`;
  celebration.hidden = !(total > 0 && done === total);
}

function renderMaterials(items) {
  currentItems = items;
  checkedItems = new Set();

  if (!items.length) {
    materialsList.innerHTML = `
      <div class="empty">
        没拿到清单，换一所学校或稍后再试。
      </div>
    `;
    updateProgress();
    return;
  }

  materialsList.innerHTML = items
    .map((item, index) => {
      const badge = getDeadlineBadge(item.deadline);

      return `
        <button class="material-row" type="button" data-index="${index}" aria-pressed="false">
          <span class="check-box" aria-hidden="true"></span>
          <span class="material-main">
            <strong>${escapeHtml(item.name)}</strong>
            <small>${escapeHtml(item.description || "按学校官网最新说明准备。")}</small>
          </span>
          <span class="deadline-badge ${badge.level}">
            <strong>${escapeHtml(badge.label)}</strong>
            ${badge.detail ? `<small>${escapeHtml(badge.detail)}</small>` : ""}
          </span>
        </button>
      `;
    })
    .join("");
  updateProgress();
}

function toggleMaterial(index) {
  if (checkedItems.has(index)) checkedItems.delete(index);
  else checkedItems.add(index);

  const row = materialsList.querySelector(`[data-index="${index}"]`);
  if (row) {
    const checked = checkedItems.has(index);
    row.classList.toggle("done", checked);
    row.setAttribute("aria-pressed", String(checked));
  }

  updateProgress();
}

async function loadMaterials(school) {
  currentSchool = school;
  currentItems = [];
  checkedItems = new Set();
  setActiveSchool(school);
  schoolTitle.textContent = `${school} 本科申请材料`;
  sourceBadge.textContent = "查询中";
  materialsList.innerHTML = "";
  updateProgress();
  setLoading(true);
  playTyping();

  try {
    const response = await fetch(`/api/materials?school=${encodeURIComponent(school)}`);
    if (!response.ok) throw new Error(`后台返回异常：${response.status}`);

    const data = await response.json();
    sourceBadge.textContent = data.source === "kimi" ? "Kimi 联网结果" : "本地备用清单";
    renderMaterials(Array.isArray(data.items) ? data.items : []);
  } catch (error) {
    sourceBadge.textContent = "查询失败";
    renderMaterials([]);
    console.error(error);
  } finally {
    setLoading(false);
    updateProgress();
  }
}

schoolTabs.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-school]");
  if (!button || button.dataset.school === currentSchool) return;
  loadMaterials(button.dataset.school);
});

materialsList.addEventListener("click", (event) => {
  const row = event.target.closest(".material-row[data-index]");
  if (!row) return;
  toggleMaterial(Number(row.dataset.index));
});

loadMaterials(currentSchool);
