const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_FILE = path.join(ROOT, "config", "players.json");
const DATA_FILE = path.join(ROOT, "docs", "data", "players.json");
const API_BASE = "https://cocproxy.royaleapi.dev/v1";
const VALID_TAG = /^#?[0289PYLQGRJCUV]+$/i;

function normalizeTag(input) {
  let tag = String(input || "").trim().toUpperCase().replace(/\s+/g, "");
  if (tag && !tag.startsWith("#")) tag = `#${tag}`;
  return tag;
}
function validateTags(input) {
  if (!Array.isArray(input) || input.length !== 10) {
    throw new Error("config/players.json phải có đúng 10 phần tử trong mảng tags.");
  }
  const tags = input.map(normalizeTag);
  const nonEmpty = tags.filter(Boolean);
  for (const tag of nonEmpty) {
    if (!VALID_TAG.test(tag)) throw new Error(`Player Tag không hợp lệ: ${tag}`);
  }
  if (new Set(nonEmpty).size !== nonEmpty.length) {
    throw new Error("Có Player Tag bị trùng trong config/players.json.");
  }
  return tags;
}
function apiError(status, body) {
  try {
    const parsed = JSON.parse(body);
    return parsed.message || parsed.reason || `API trả về HTTP ${status}`;
  } catch {
    return `API trả về HTTP ${status}`;
  }
}
async function fetchPlayer(tag, token) {
  const url = `${API_BASE}/players/${encodeURIComponent(tag)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json"
    },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) {
    throw new Error(`${tag}: ${apiError(response.status, await response.text())}`);
  }
  const p = await response.json();
  return {
    tag: p.tag,
    name: p.name,
    // Supercell's top-level `trophies` is Home Village trophies.
    // Builder Base trophies are in `builderBaseTrophies` and are intentionally ignored.
    trophies: p.trophies ?? null,
    bestTrophies: p.bestTrophies ?? null,
    townHallLevel: p.townHallLevel ?? null,
    expLevel: p.expLevel ?? null,
    league: p.league?.name || "Unranked",
    clan: p.clan?.name || null,
    fetchedAt: new Date().toISOString(),
    status: "ok"
  };
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const token = process.env.COC_API_TOKEN;
  if (!token) throw new Error("Thiếu GitHub Secret COC_API_TOKEN.");
  const config = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  const tags = validateTags(config.tags);
  let previous = { players: [], lastUpdated: null };
  try { previous = JSON.parse(await fs.readFile(DATA_FILE, "utf8")); } catch {}

  const lastAttempt = new Date().toISOString();
  const players = [];
  for (const tag of tags.filter(Boolean)) {
    try {
      players.push(await fetchPlayer(tag, token));
    } catch (error) {
      const old = (previous.players || []).find(p => p.tag === tag);
      players.push(old
        ? { ...old, status: "stale", error: error.message }
        : { tag, name: "Không lấy được dữ liệu", trophies: null, league: "—", status: "error", error: error.message });
    }
    await sleep(400);
  }

  players.sort((a, b) => (b.trophies ?? -1) - (a.trophies ?? -1));
  const anySuccess = players.some(p => p.status === "ok");
  const output = {
    players,
    configuredCount: tags.filter(Boolean).length,
    lastUpdated: anySuccess ? new Date().toISOString() : previous.lastUpdated,
    lastAttempt,
    schedule: "11:55 và 23:55 mỗi ngày (giờ Việt Nam)",
    error: players.some(p => p.status !== "ok")
      ? "Một hoặc nhiều người chơi chưa cập nhật được. Trạng thái từng dòng cho biết dữ liệu mới, cũ hoặc lỗi."
      : null
  };
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Snapshot saved: ${output.configuredCount} configured; ${players.filter(p => p.status === "ok").length} successful.`);
  console.log(`Last successful update: ${output.lastUpdated || "none"}`);
}
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
