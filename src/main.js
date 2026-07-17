const difficultyLabels = {
  easy: "轻松",
  moderate: "适中",
  hard: "困难",
  expert: "专家",
};

const elements = {
  search: document.querySelector("#search-input"),
  difficulty: document.querySelector("#difficulty-filter"),
  count: document.querySelector("#route-count"),
  list: document.querySelector("#route-list"),
  empty: document.querySelector("#empty-state"),
  template: document.querySelector("#route-card-template"),
};

let trails = [];

function formatMetric(value, unit) {
  return Number.isFinite(value) ? `${value} ${unit}` : "待补充";
}

function matchesSearch(trail, query) {
  if (!query) return true;

  const searchable = [
    trail.name,
    trail.region,
    trail.location,
    trail.summary,
    ...(trail.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");

  return searchable.includes(query);
}

function createRouteCard(trail) {
  const fragment = elements.template.content.cloneNode(true);
  const card = fragment.querySelector(".route-card");
  const difficulty = trail.difficulty ?? "moderate";

  card.dataset.difficulty = difficulty;
  fragment.querySelector(".route-card__region").textContent =
    [trail.region, trail.location].filter(Boolean).join(" · ") || "地区待补充";
  fragment.querySelector(".route-card__name").textContent = trail.name;
  fragment.querySelector(".route-card__summary").textContent =
    trail.summary || "路线简介待补充。";

  const badge = fragment.querySelector(".difficulty-badge");
  badge.textContent = difficultyLabels[difficulty] ?? difficulty;
  badge.dataset.difficulty = difficulty;

  fragment.querySelector('[data-field="distance"]').textContent = formatMetric(
    trail.distanceKm,
    "km",
  );
  fragment.querySelector('[data-field="elevation"]').textContent = formatMetric(
    trail.elevationGainM,
    "m",
  );
  fragment.querySelector('[data-field="duration"]').textContent = formatMetric(
    trail.durationHours,
    "h",
  );

  const tagList = fragment.querySelector(".route-card__tags");
  for (const tag of trail.tags ?? []) {
    const item = document.createElement("li");
    item.textContent = tag;
    tagList.append(item);
  }

  return fragment;
}

function render() {
  const query = elements.search.value.trim().toLocaleLowerCase("zh-CN");
  const selectedDifficulty = elements.difficulty.value;
  const visibleTrails = trails.filter((trail) => {
    const difficultyMatches =
      selectedDifficulty === "all" || trail.difficulty === selectedDifficulty;
    return difficultyMatches && matchesSearch(trail, query);
  });

  elements.list.replaceChildren(...visibleTrails.map(createRouteCard));
  elements.count.textContent = `${visibleTrails.length} 条路线`;
  elements.empty.hidden = visibleTrails.length > 0;
}

async function loadTrails() {
  try {
    const response = await fetch("./data/trails.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    trails = Array.isArray(data) ? data : [];
    render();
  } catch (error) {
    elements.count.textContent = "路线加载失败";
    elements.empty.hidden = false;
    elements.empty.querySelector("h2").textContent = "无法加载路线数据";
    elements.empty.querySelector("p:last-child").textContent = error.message;
  }
}

elements.search.addEventListener("input", render);
elements.difficulty.addEventListener("change", render);

loadTrails();
