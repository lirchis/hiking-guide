const statusMeta = {
  available: { label: "可计划", description: "仍需行前复核" },
  verify: { label: "先核实", description: "开放或许可待确认" },
  reference: { label: "资料收录", description: "暂不进入实际行程" },
  closed: { label: "明确关闭", description: "禁止作为行程执行" },
};

const scopeLabels = {
  "greater-bay-area": "广东及周边",
  china: "全国精选",
};

const difficultyLabels = {
  easy: "轻松",
  moderate: "进阶",
  hard: "困难",
  expert: "专家",
};

const elements = {
  search: document.querySelector("#search-input"),
  scope: document.querySelector("#scope-filter"),
  difficulty: document.querySelector("#difficulty-filter"),
  status: document.querySelector("#status-filter"),
  sort: document.querySelector("#sort-select"),
  reset: document.querySelector("#reset-filters"),
  count: document.querySelector("#route-count"),
  list: document.querySelector("#route-list"),
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#route-card-template"),
  edition: document.querySelector("#data-edition"),
  stats: {
    total: document.querySelector("#stat-total"),
    available: document.querySelector("#stat-available"),
    topRated: document.querySelector("#stat-top-rated"),
  },
  dialog: document.querySelector("#route-dialog"),
};

let trails = [];
let datasetMeta = {};

function difficultyBand(score) {
  if (score <= 2) return "easy";
  if (score <= 3.5) return "moderate";
  if (score <= 4.5) return "hard";
  return "expert";
}

function formatDate(dateString) {
  const [year, month, day] = dateString.split("-");
  return `${year}.${month}.${day}`;
}

function normalizedText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-CN");
}

function matchesSearch(trail, query) {
  if (!query) return true;

  return normalizedText(
    [
      trail.name,
      trail.region,
      trail.location,
      trail.bestSeason,
      trail.experience,
      trail.notice,
      statusMeta[trail.status]?.label,
    ].join(" "),
  ).includes(query);
}

function sortTrails(items, mode) {
  const sorted = [...items];
  const compareName = (a, b) => a.name.localeCompare(b.name, "zh-CN");

  const comparators = {
    quality: (a, b) =>
      b.routeScore - a.routeScore ||
      b.sceneryScore - a.sceneryScore ||
      compareName(a, b),
    scenery: (a, b) =>
      b.sceneryScore - a.sceneryScore ||
      b.routeScore - a.routeScore ||
      compareName(a, b),
    "difficulty-asc": (a, b) =>
      a.difficultyScore - b.difficultyScore || compareName(a, b),
    "distance-asc": (a, b) =>
      a.distanceKmMin - b.distanceKmMin || compareName(a, b),
  };

  return sorted.sort(comparators[mode] ?? comparators.quality);
}

function setStatusPill(element, status) {
  const meta = statusMeta[status] ?? statusMeta.verify;
  element.textContent = meta.label;
  element.dataset.status = status;
  element.title = meta.description;
}

function createRouteCard(trail) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".route-card");
  const band = difficultyBand(trail.difficultyScore);

  card.dataset.status = trail.status;
  fragment.querySelector(".scope-pill").textContent = scopeLabels[trail.scope];
  setStatusPill(fragment.querySelector(".status-pill"), trail.status);
  fragment.querySelector(".route-card__location").textContent =
    `${trail.region} · ${trail.location}`;
  fragment.querySelector(".route-card__name").textContent = trail.name;
  fragment.querySelector(".route-card__experience").textContent = trail.experience;
  fragment.querySelector('[data-field="distance"]').textContent = trail.distanceText;

  const difficulty = fragment.querySelector('[data-field="difficulty"]');
  difficulty.textContent = `${trail.difficultyScore}/5 · ${difficultyLabels[band]}`;
  difficulty.dataset.difficulty = band;

  fragment.querySelector('[data-field="season"]').textContent = trail.bestSeason;
  fragment.querySelector('[data-field="scenery"]').textContent =
    trail.sceneryScore.toFixed(1);
  fragment.querySelector('[data-field="quality"]').textContent =
    trail.routeScore.toFixed(1);
  fragment.querySelector(".route-card__notice").textContent = trail.notice;
  fragment
    .querySelector(".route-card__action")
    .addEventListener("click", () => openRouteDialog(trail));

  return fragment;
}

function currentFilters() {
  return {
    query: normalizedText(elements.search.value),
    scope: elements.scope.value,
    difficulty: elements.difficulty.value,
    status: elements.status.value,
    sort: elements.sort.value,
  };
}

function syncUrl(filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (filters.scope !== "all") params.set("scope", filters.scope);
  if (filters.difficulty !== "all") params.set("difficulty", filters.difficulty);
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.sort !== "quality") params.set("sort", filters.sort);

  const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function render() {
  const filters = currentFilters();
  const visibleTrails = sortTrails(
    trails.filter((trail) => {
      const scopeMatches = filters.scope === "all" || trail.scope === filters.scope;
      const difficultyMatches =
        filters.difficulty === "all" ||
        difficultyBand(trail.difficultyScore) === filters.difficulty;
      const statusMatches =
        filters.status === "all" || trail.status === filters.status;

      return (
        scopeMatches &&
        difficultyMatches &&
        statusMatches &&
        matchesSearch(trail, filters.query)
      );
    }),
    filters.sort,
  );

  const cards = visibleTrails.map(createRouteCard);
  elements.list.replaceChildren(...cards);
  elements.count.textContent = `显示 ${visibleTrails.length} / ${trails.length} 条路线`;
  elements.empty.hidden = visibleTrails.length > 0;
  syncUrl(filters);
}

function resetFilters() {
  elements.search.value = "";
  elements.scope.value = "all";
  elements.difficulty.value = "all";
  elements.status.value = "all";
  elements.sort.value = "quality";
  render();
  elements.search.focus();
}

function restoreFiltersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  elements.search.value = params.get("q") ?? "";

  for (const [element, key] of [
    [elements.scope, "scope"],
    [elements.difficulty, "difficulty"],
    [elements.status, "status"],
    [elements.sort, "sort"],
  ]) {
    const value = params.get(key);
    if ([...element.options].some((option) => option.value === value)) {
      element.value = value;
    }
  }
}

function openRouteDialog(trail) {
  const band = difficultyBand(trail.difficultyScore);
  document.querySelector("#dialog-scope").textContent = scopeLabels[trail.scope];
  setStatusPill(document.querySelector("#dialog-status"), trail.status);
  document.querySelector("#dialog-location").textContent =
    `${trail.region} · ${trail.location}`;
  document.querySelector("#dialog-title").textContent = trail.name;
  document.querySelector("#dialog-experience").textContent = trail.experience;
  document.querySelector("#dialog-distance").textContent = trail.distanceText;
  document.querySelector("#dialog-duration").textContent = trail.durationText;
  document.querySelector("#dialog-difficulty").textContent =
    `${trail.difficultyScore}/5 · ${difficultyLabels[band]}`;
  document.querySelector("#dialog-season").textContent = trail.bestSeason;
  document.querySelector("#dialog-scenery").textContent =
    `${trail.sceneryScore.toFixed(1)} / 5`;
  document.querySelector("#dialog-quality").textContent =
    `${trail.routeScore.toFixed(1)} / 5`;
  document.querySelector("#dialog-notice").textContent = trail.notice;
  document.querySelector("#dialog-source").href = datasetMeta.sourceUrl;
  elements.dialog.showModal();
}

function renderDatasetMeta() {
  elements.stats.total.textContent = datasetMeta.includedCount;
  elements.stats.available.textContent = trails.filter(
    (trail) => trail.status === "available",
  ).length;
  elements.stats.topRated.textContent = trails.filter(
    (trail) => trail.routeScore >= 4.8,
  ).length;
  elements.edition.textContent = `资料更新于 ${formatDate(datasetMeta.updatedAt)} · 已整理 ${datasetMeta.includedCount}/${datasetMeta.totalCount}`;
}

async function loadTrails() {
  try {
    const response = await fetch("./data/trails.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data.trails) || !data.meta) {
      throw new Error("数据格式不正确");
    }

    trails = data.trails;
    datasetMeta = data.meta;
    restoreFiltersFromUrl();
    renderDatasetMeta();
    render();
  } catch (error) {
    elements.count.textContent = "路线数据加载失败";
    elements.empty.hidden = false;
    elements.empty.querySelector("h3").textContent = "无法加载路线数据";
    elements.empty.querySelector("p").textContent = error.message;
  }
}

for (const element of [
  elements.search,
  elements.scope,
  elements.difficulty,
  elements.status,
  elements.sort,
]) {
  element.addEventListener(element === elements.search ? "input" : "change", render);
}

elements.reset.addEventListener("click", resetFilters);
document
  .querySelector("[data-reset-filters]")
  .addEventListener("click", resetFilters);
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

loadTrails();
