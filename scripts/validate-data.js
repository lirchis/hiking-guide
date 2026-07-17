import { readFile } from "node:fs/promises";

const data = JSON.parse(await readFile("data/trails.json", "utf8"));
const allowedScopes = new Set(["greater-bay-area", "china"]);
const allowedStatuses = new Set(["available", "verify", "reference", "closed"]);
const requiredStrings = [
  "id",
  "name",
  "scope",
  "region",
  "location",
  "distanceText",
  "durationText",
  "bestSeason",
  "experience",
  "status",
  "notice",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(data.meta && typeof data.meta === "object", "meta is required");
assert(Array.isArray(data.trails), "trails must be an array");
assert(
  data.meta.includedCount === data.trails.length,
  "meta.includedCount must match trails.length",
);
assert(
  data.meta.includedCount <= data.meta.totalCount,
  "includedCount cannot exceed totalCount",
);

const ids = new Set();

for (const [index, trail] of data.trails.entries()) {
  const label = `trail[${index}] ${trail.name ?? "(unnamed)"}`;

  for (const key of requiredStrings) {
    assert(
      typeof trail[key] === "string" && trail[key].trim().length > 0,
      `${label}: ${key} must be a non-empty string`,
    );
  }

  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trail.id), `${label}: invalid id`);
  assert(!ids.has(trail.id), `${label}: duplicate id ${trail.id}`);
  ids.add(trail.id);

  assert(allowedScopes.has(trail.scope), `${label}: unsupported scope`);
  assert(allowedStatuses.has(trail.status), `${label}: unsupported status`);
  assert(
    Number.isFinite(trail.distanceKmMin) && Number.isFinite(trail.distanceKmMax),
    `${label}: distance values must be numbers`,
  );
  assert(
    trail.distanceKmMin >= 0 && trail.distanceKmMin <= trail.distanceKmMax,
    `${label}: invalid distance range`,
  );

  for (const scoreKey of ["difficultyScore", "sceneryScore", "routeScore"]) {
    assert(
      Number.isFinite(trail[scoreKey]) && trail[scoreKey] >= 1 && trail[scoreKey] <= 5,
      `${label}: ${scoreKey} must be between 1 and 5`,
    );
  }
}

console.log(
  `Validated ${data.trails.length} routes (${data.meta.includedCount}/${data.meta.totalCount} included).`,
);
