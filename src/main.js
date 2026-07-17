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

const WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const IMAGE_CACHE_PREFIX = "hiking-guide-wiki-image-v2:";
const IMAGE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const MAX_WIKI_REQUESTS = 4;

const wikiSearchOverrides = {
  "hk-sharp-peak-tai-long-wan": "蚺蛇尖",
  "guangdong-chuandiding-compliant-route": "船底顶",
  "hk-lantau-trail-sections-2-3": "鳳凰山 香港",
  "guangxi-yangdi-xingping": "漓江 阳朔",
  "shenzhen-kunpeng-trail-section-19": "大鹏半岛",
  "hk-kai-kung-leng": "雞公嶺",
  "hk-maclehose-trail": "麥理浩徑",
  "guangdong-huidong-dananshan": "惠东 大南山",
  "hk-pat-sin-leng-hok-tau": "八仙嶺",
  "fujian-taimushan-loop": "太姥山",
  "guangdong-danxia-longlao-xianglong-yangyuan": "丹霞山",
  "fujian-wuyishan-tianyou-huxiao-yixiantian": "武夷山",
  "hk-plover-cove-country-trail": "船灣淡水湖",
  "hk-wilson-trail-sections-4-5": "衛奕信徑",
  "guangxi-longji-rice-terraces": "龙脊梯田",
  "hainan-wuzhishan-main-peak": "五指山 海南",
  "hainan-jianfengling-tianchi-main-peak": "尖峰岭",
  "guangxi-maoershan": "猫儿山 广西",
  "guangdong-grand-canyon-loop": "广东大峡谷",
  "hk-tai-mo-shan-ng-tung-chai": "大帽山",
  "hk-dragons-back-big-wave-bay": "龍脊 香港",
  "guangdong-luofushan-feiyunding": "罗浮山",
  "guangdong-yingxi-peak-forest": "英西峰林",
  "fujian-dongshan-sufengyan-yan-ya": "东山岛",
  "shenzhen-wutongshan-taishanjian": "梧桐山",
  "guangdong-conghua-tiantianding": "天堂顶 广东",
  "guangzhou-baiyun-nanhu-maofengshan": "白云山 广州",
  "guangdong-dinghushan-rainforest-loop": "鼎湖山",
  "guangdong-chebaling-forest-trail": "车八岭",
  "macau-coloane-trail": "路環",
  "guangzhou-liupianshan": "广州 白云山",
  "shenzhen-taojinshan-greenway": "深圳水库",
  "sichuan-gongga-grand-loop": "贡嘎山",
  "sichuan-yunnan-rock-line": "稻城亚丁",
  "xinjiang-wusun-ancient-trail": "乌孙古道",
  "xinjiang-langta-cv": "天山山脉",
  "tibet-everest-east-kama-valley": "珠穆朗玛峰",
  "yunnan-tibet-meili-outer-kora": "梅里雪山",
  "xinjiang-bogda-grand-loop": "博格达峰",
  "yunnan-yubeng-waterfall-ice-lake": "雨崩村",
  "qinghai-nianbaoyuze-traverse": "年保玉则",
  "anhui-huangshan-west-canyon-tiandu": "黄山",
  "sichuan-siguniang-changping-bipeng": "四姑娘山",
  "xinjiang-xiata-ancient-trail": "夏塔古道",
  "tibet-shishapangma-south": "希夏邦马峰",
  "tibet-mount-kailash-kora": "冈仁波齐峰",
  "tibet-kula-kangri": "库拉岗日峰",
  "qinghai-amnye-machen-kora": "阿尼玛卿山",
  "sichuan-genyen-south": "格聂山",
  "shaanxi-aotai-line": "太白山",
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
  filterPanel: document.querySelector("#filter-panel"),
  mobileFilterSummary: document.querySelector("#mobile-filter-summary"),
  stats: {
    headerTotal: document.querySelector("#header-total"),
    total: document.querySelector("#stat-total"),
    available: document.querySelector("#stat-available"),
    topRated: document.querySelector("#stat-top-rated"),
  },
  dialog: document.querySelector("#route-dialog"),
};

let trails = [];
let datasetMeta = {};
let trailsById = new Map();
let activeWikiRequests = 0;
const wikiRequestQueue = [];
const wikiImagePromises = new Map();

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

function cleanMetadata(value) {
  if (!value) return "";
  const documentFragment = new DOMParser().parseFromString(value, "text/html");
  return documentFragment.body.textContent.replace(/\s+/g, " ").trim().slice(0, 90);
}

function routeSearchCandidates(trail) {
  const cleanName = trail.name
    .replace(/[（(][^（）()]*[）)]/g, "")
    .replace(/第\d+[—–-]?\d*段/g, "")
    .replace(/(全程|全景|环线|穿越线|组合|合规版本|核心段|登山栈道)/g, "")
    .trim();

  return [...new Set([
    wikiSearchOverrides[trail.id],
    cleanName,
    `${trail.location} ${trail.region}`,
    trail.location,
    trail.region,
  ].filter(Boolean))];
}

function readCachedWikiImage(trailId) {
  try {
    const cached = JSON.parse(localStorage.getItem(`${IMAGE_CACHE_PREFIX}${trailId}`));
    if (
      cached?.src?.startsWith("https://upload.wikimedia.org/") &&
      Date.now() - cached.cachedAt < IMAGE_CACHE_TTL
    ) {
      return cached;
    }
  } catch {
    return null;
  }
  return null;
}

function cacheWikiImage(trailId, imageData) {
  try {
    localStorage.setItem(
      `${IMAGE_CACHE_PREFIX}${trailId}`,
      JSON.stringify({ ...imageData, cachedAt: Date.now() }),
    );
  } catch {
    // 图片仍可正常显示；缓存不可用时不影响页面。
  }
}

function queueWikiRequest(task) {
  return new Promise((resolve, reject) => {
    wikiRequestQueue.push({ task, resolve, reject });
    drainWikiRequestQueue();
  });
}

function drainWikiRequestQueue() {
  while (activeWikiRequests < MAX_WIKI_REQUESTS && wikiRequestQueue.length) {
    const { task, resolve, reject } = wikiRequestQueue.shift();
    activeWikiRequests += 1;
    Promise.resolve()
      .then(task)
      .then(resolve, reject)
      .finally(() => {
        activeWikiRequests -= 1;
        drainWikiRequestQueue();
      });
  }
}

function isLikelyPhoto(page) {
  const fileName = page.pageimage ?? "";
  return (
    page.thumbnail?.source &&
    /\.(?:jpe?g|webp)$/i.test(fileName) &&
    !/(map|karte|location|route|logo|flag|emblem|diagram)/i.test(fileName)
  );
}

function titleMatchesQuery(title, query) {
  const normalizedTitle = normalizedText(title).replace(/[（）()\s]/g, "");
  const terms = normalizedText(query)
    .split(/[\s—–-]+/)
    .map((term) => term.replace(/[（）()]/g, ""))
    .filter((term) => term.length >= 2);
  return terms.some((term) =>
    normalizedTitle.includes(term) || normalizedTitle.includes(term.slice(0, 2)),
  );
}

async function searchWikipediaImage(query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "0",
    gsrlimit: "6",
    prop: "pageimages|info",
    piprop: "thumbnail|name",
    pilicense: "free",
    pithumbsize: "720",
    inprop: "url",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`);
  if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
  const data = await response.json();
  return (data.query?.pages ?? [])
    .filter((page) => isLikelyPhoto(page) && titleMatchesQuery(page.title, query))
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99))[0];
}

async function fetchCommonsMetadata(fileName) {
  const params = new URLSearchParams({
    action: "query",
    titles: `File:${fileName}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "720",
    iiextmetadatalanguage: "zh",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName",
    format: "json",
    formatversion: "2",
    origin: "*",
  });
  const response = await fetch(`${COMMONS_API}?${params}`);
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const data = await response.json();
  return data.query?.pages?.[0]?.imageinfo?.[0];
}

async function fetchTrailWikiImage(trail) {
  let page;
  for (const query of routeSearchCandidates(trail)) {
    page = await searchWikipediaImage(query);
    if (page) break;
  }
  if (!page) return null;

  let commons;
  try {
    commons = await fetchCommonsMetadata(page.pageimage);
  } catch {
    commons = null;
  }

  const metadata = commons?.extmetadata ?? {};
  return {
    src: commons?.thumburl ?? page.thumbnail.source,
    sourceUrl: commons?.descriptionurl ?? page.fullurl,
    credit: cleanMetadata(metadata.Artist?.value) || `维基百科“${page.title}”词条`,
    license: cleanMetadata(metadata.LicenseShortName?.value) || "授权见原图页面",
    articleTitle: page.title,
  };
}

function getWikiImage(trail) {
  const cached = readCachedWikiImage(trail.id);
  if (cached) return Promise.resolve(cached);
  if (wikiImagePromises.has(trail.id)) return wikiImagePromises.get(trail.id);

  const request = queueWikiRequest(() => fetchTrailWikiImage(trail))
    .then((imageData) => {
      if (imageData) cacheWikiImage(trail.id, imageData);
      return imageData;
    })
    .catch(() => null);
  wikiImagePromises.set(trail.id, request);
  return request;
}

function applyWikiImage(media, trail, imageData) {
  if (!media?.isConnected || media.dataset.trailId !== trail.id) return;
  const image = media.querySelector("img");
  const placeholder = media.querySelector(".image-placeholder");
  const sourceLink = media.querySelector(".image-source");

  if (!imageData) {
    media.dataset.imageState = "error";
    image.removeAttribute("src");
    image.alt = "";
    placeholder.textContent = "维基暂未找到匹配实景";
    sourceLink.hidden = true;
    return;
  }

  image.onload = () => {
    media.dataset.imageState = "ready";
  };
  image.onerror = () => {
    media.dataset.imageState = "error";
    placeholder.textContent = "维基图片暂时无法加载";
    sourceLink.hidden = true;
  };
  image.alt = `${trail.name}相关地点实景，来自维基百科“${imageData.articleTitle}”词条`;
  image.src = imageData.src;
  sourceLink.href = imageData.sourceUrl;
  sourceLink.title = `${imageData.credit} · ${imageData.license}`;
  sourceLink.setAttribute("aria-label", `查看${trail.name}图片的维基来源`);
  sourceLink.textContent = media.id === "dialog-media"
    ? `图片：${imageData.credit} · ${imageData.license} ↗`
    : "维基图像 ↗";
  sourceLink.hidden = false;
}

function loadWikiImageInto(media, trail) {
  media.dataset.imageState = "loading";
  getWikiImage(trail).then((imageData) => applyWikiImage(media, trail, imageData));
}

const routeImageObserver = "IntersectionObserver" in window
  ? new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          routeImageObserver.unobserve(entry.target);
          const trail = trailsById.get(entry.target.dataset.trailId);
          if (trail) loadWikiImageInto(entry.target, trail);
        }
      },
      { rootMargin: "500px 0px" },
    )
  : null;

function observeRouteImages() {
  const mediaElements = elements.list.querySelectorAll(".route-row__media");
  if (!routeImageObserver) {
    for (const media of mediaElements) {
      const trail = trailsById.get(media.dataset.trailId);
      if (trail) loadWikiImageInto(media, trail);
    }
    return;
  }

  routeImageObserver.disconnect();
  for (const media of mediaElements) routeImageObserver.observe(media);
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

function createRouteRow(trail) {
  const fragment = elements.template.content.cloneNode(true);
  const row = fragment.querySelector(".route-row");
  const band = difficultyBand(trail.difficultyScore);

  row.dataset.status = trail.status;
  fragment.querySelector(".route-row__media").dataset.trailId = trail.id;

  fragment.querySelector(".scope-pill").textContent = scopeLabels[trail.scope];
  setStatusPill(fragment.querySelector(".status-pill"), trail.status);
  fragment.querySelector(".route-row__location").textContent =
    `${trail.region} · ${trail.location}`;
  fragment.querySelector(".route-row__name").textContent = trail.name;
  fragment.querySelector(".route-row__experience").textContent = trail.experience;
  fragment.querySelector(".route-row__notice").textContent = trail.notice;
  fragment.querySelector('[data-field="distance"]').textContent = trail.distanceText;
  fragment.querySelector('[data-field="duration"]').textContent = trail.durationText;

  const difficulty = fragment.querySelector('[data-field="difficulty"]');
  difficulty.textContent = `${trail.difficultyScore}/5 · ${difficultyLabels[band]}`;
  difficulty.dataset.difficulty = band;

  fragment.querySelector('[data-field="season"]').textContent = trail.bestSeason;
  fragment.querySelector('[data-field="scenery"]').textContent =
    trail.sceneryScore.toFixed(1);
  fragment.querySelector('[data-field="quality"]').textContent =
    trail.routeScore.toFixed(1);

  const action = fragment.querySelector(".route-row__action");
  action.setAttribute("aria-label", `查看${trail.name}详情`);
  action.addEventListener("click", () => openRouteDialog(trail));

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

  elements.list.replaceChildren(...visibleTrails.map(createRouteRow));
  observeRouteImages();
  elements.count.textContent = `显示 ${visibleTrails.length} / ${trails.length} 条路线`;
  const activeFilterCount = [
    Boolean(filters.query),
    filters.scope !== "all",
    filters.difficulty !== "all",
    filters.status !== "all",
    filters.sort !== "quality",
  ].filter(Boolean).length;
  elements.mobileFilterSummary.textContent = activeFilterCount
    ? `${visibleTrails.length} 条 · ${activeFilterCount} 项已选`
    : `${visibleTrails.length} 条 · 全部路线`;
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
  const dialogMedia = document.querySelector("#dialog-media");
  dialogMedia.dataset.trailId = trail.id;
  dialogMedia.querySelector("img").removeAttribute("src");
  dialogMedia.querySelector("img").alt = "";
  dialogMedia.querySelector(".image-source").hidden = true;
  dialogMedia.querySelector(".image-placeholder").textContent =
    "正在从维基加载真实图片…";
  loadWikiImageInto(dialogMedia, trail);
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
  const total = datasetMeta.includedCount;
  elements.stats.headerTotal.textContent = total;
  elements.stats.total.textContent = total;
  elements.stats.available.textContent = trails.filter(
    (trail) => trail.status === "available",
  ).length;
  elements.stats.topRated.textContent = trails.filter(
    (trail) => trail.routeScore >= 4.8,
  ).length;
  elements.edition.textContent = `更新于 ${formatDate(datasetMeta.updatedAt)} · 已整理 ${total}/${datasetMeta.totalCount}`;
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
    trailsById = new Map(trails.map((trail) => [trail.id, trail]));
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
document.querySelector("[data-reset-filters]").addEventListener("click", resetFilters);
document
  .querySelector(".dialog-close")
  .addEventListener("click", () => elements.dialog.close());
elements.dialog.addEventListener("click", (event) => {
  if (event.target === elements.dialog) elements.dialog.close();
});

const mobileQuery = window.matchMedia("(max-width: 720px)");
function setFilterPanelMode(event = mobileQuery) {
  if (event.matches) elements.filterPanel.removeAttribute("open");
  else elements.filterPanel.setAttribute("open", "");
}
setFilterPanelMode();
mobileQuery.addEventListener("change", setFilterPanelMode);

loadTrails();
