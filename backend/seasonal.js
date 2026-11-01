// 농사로 monthFd 연동. 기존 server.js에서 /api/seasonal에 연결합니다.
// 인증키는 backend/.env의 NONGSARO_API_KEY를 사용합니다.
const express = require("express");
const { XMLParser } = require("fast-xml-parser");
const { createHash } = require("node:crypto");
const router = express.Router();

// 이 문구는 새 파일이 실제 Node.js 프로세스에 로드되었을 때 한 번 출력됩니다.
console.log("[제철음식] 자동 검색 버전 적용됨");
console.log("[제철음식] 읽은 파일:", __filename);

// 인증키/농사로 호출 없이 현재 실행 중인 코드 버전을 확인할 수 있습니다.
router.get("/status", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({
    revision: "auto-month-restart-check-1",
    mode: "keyword-auto-month-v2",
    requiresYearMonth: false
  });
});
const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false, // '00' 정상 코드와 '01' 월 값을 문자열로 유지
  trimValues: true,
  processEntities: false,
});

const cache = new Map();
const pending = new Map();
const CACHE_MS = 15 * 60 * 1000;
const MAX_CACHE = 2000;
const operations = new Set(["monthFdYearLst", "monthNewFdLst", "monthNewFdDtl"]);

class ApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function asArray(value) {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function plainText(value) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  let text = String(value);
  // XML/HTML의 기본 문자만 해석합니다. 외부 HTML은 실행하지 않습니다.
  for (let i = 0; i < 2; i++) {
    text = text.replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
      const n = /^x/i.test(code) ? parseInt(code.slice(1), 16) : Number(code);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n) : "";
    });
    text = text.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, key) =>
      ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[key]
    );
  }
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function numberOrNull(value) {
  const text = plainText(value).replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function imageUrl(item) {
  const codes = String(item.rtnImgSeCode || "").split("|");
  const paths = String(item.rtnFileCours || "").split("|");
  const names = String(item.rtnStreFileNm || "").split("|");
  for (const preferred of ["209006", "209008", "209002", "209007"]) {
    const i = codes.findIndex((code) => code.trim() === preferred);
    if (i < 0 || !paths[i] || !names[i]) continue;
    const pathname = `${paths[i].trim()}/${names[i].trim()}`;
    if (pathname.includes("..") || pathname.includes("\\")) continue;
    const url = new URL("/" + pathname.replace(/^\/+/, ""), "https://www.nongsaro.go.kr");
    if (url.hostname === "www.nongsaro.go.kr") return url.href;
  }
  return "";
}

async function readLimitedText(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError("농사로 응답 본문이 없습니다.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new ApiError("농사로 응답이 너무 큽니다. 요청 범위를 확인해 주세요.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function callNongsaro(operation, params = {}) {
  const apiKey = (process.env.NONGSARO_API_KEY || "").trim();
  if (!apiKey) throw new ApiError("backend/.env에 NONGSARO_API_KEY를 설정해 주세요.", 500);
  if (!operations.has(operation)) throw new ApiError("지원하지 않는 조회입니다.", 400);

  // 첨부 매뉴얼에는 HTTP가 기재되어 있습니다. 키 보호를 위해 HTTPS를 먼저 사용합니다.
  // HTTPS 지원 여부는 실제 환경에서 확인해야 합니다. HTTP로 자동 전환하지 않습니다.
  const protocol = process.env.NONGSARO_ALLOW_HTTP === "true" ? "http:" : "https:";
  const url = new URL(`${protocol}//api.nongsaro.go.kr/service/monthFd/${operation}`);
  url.search = new URLSearchParams({ apiKey, ...params }).toString();
  const keyId = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  const cacheKey = `${keyId}:${protocol}:${operation}:${JSON.stringify(params)}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.body;
  if (cached) cache.delete(cacheKey);
  if (pending.has(cacheKey)) return pending.get(cacheKey);

  const work = (async () => {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        headers: { Accept: "application/xml, text/xml" },
      });
      if (!response.ok) throw new ApiError(`농사로 요청 실패: HTTP ${response.status}`);
      const xml = await readLimitedText(response);
      if (/<!DOCTYPE/i.test(xml)) throw new ApiError("예상하지 않은 XML 형식입니다.");
      let root;
      try { root = parser.parse(xml)?.response; }
      catch { throw new ApiError("농사로 XML을 해석하지 못했습니다."); }
      if (!root?.header) throw new ApiError("농사로 응답 형식이 매뉴얼과 다릅니다.");
      const code = String(root.header.resultCode ?? "").trim();
      if (code !== "00") {
        const messages = {
          "11": "농사로 인증키가 유효하지 않습니다. 식약처 키와 구분해 확인해 주세요.",
          "12": "농사로 인증키가 일시 중지된 상태입니다.",
          "13": "농사로 서비스 또는 조회 경로를 확인해야 합니다.",
          "15": "농사로의 도메인 인증 오류입니다.",
          "91": "농사로 서비스 내부 오류입니다. 잠시 후 다시 시도해 주세요.",
        };
        // 원본 응답에는 인증키를 포함한 requestParameter가 있을 수 있어 전달하지 않습니다.
        throw new ApiError(messages[code] || "농사로에서 정상 처리되지 않았습니다.");
      }
      const body = root.body || {};
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(cacheKey, { body, until: Date.now() + CACHE_MS });
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error.name === "TimeoutError" || error.name === "AbortError") {
        throw new ApiError("농사로 응답 시간이 초과되었습니다. 다시 시도해 주세요.", 504);
      }
      // fetch 오류의 URL/원문은 기록하지 않습니다. URL에 키가 들어 있기 때문입니다.
      throw new ApiError("농사로 서버에 연결하지 못했습니다. 네트워크와 HTTPS 지원 여부를 확인해야 합니다.");
    }
  })();
  pending.set(cacheKey, work);
  try { return await work; }
  finally { pending.delete(cacheKey); }
}

async function getYears() {
  const body = await callNongsaro("monthFdYearLst");
  return [...new Set(asArray(body.items?.item)
    .map((row) => String(row.year ?? "").trim())
    .filter((year) => /^\d{4}$/.test(year)))].sort((a, b) => Number(b) - Number(a));
}

function sendError(res, error) {
  res.status(error instanceof ApiError ? error.status : 500).json({
    error: error instanceof ApiError ? error.message : "제철음식 처리 중 오류가 발생했습니다.",
  });
}

router.get("/years", async (req, res) => {
  try { res.json({ years: await getYears() }); }
  catch (error) { sendError(res, error); }
});

// 화면에서는 연도와 월을 받지 않습니다.
// 한국 시간의 현재 월을 기준으로, 등록된 여러 연도의 같은 달 자료를 검색합니다.
const monthCache = new Map();
const monthPending = new Map();
const MONTH_CACHE_MS = 60 * 60 * 1000;
const INDEX_DEADLINE_MS = 90 * 1000;

function koreaPeriod() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return {
    year: parts.find((part) => part.type === "year").value,
    month: parts.find((part) => part.type === "month").value,
  };
}

function compact(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

// 외부 API를 한꺼번에 과도하게 호출하지 않도록 동시 조회 수를 제한합니다.
async function mapLimited(items, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, items.length) }, worker));
  return output;
}

async function buildMonthIndex(period) {
  const deadline = Date.now() + INDEX_DEADLINE_MS;
  const years = (await getYears()).filter((year) => Number(year) <= Number(period.year));
  if (!years.length) throw new ApiError("농사로에 조회 가능한 자료 연도가 없습니다.");
  if (years.length > 50) {
    throw new ApiError("조회할 자료 연도가 많습니다. 서버의 수집 범위를 확인해야 합니다.");
  }
  function checkDeadline() {
    if (Date.now() >= deadline) {
      throw new ApiError("농사로 조회 시간이 초과되었습니다. 다시 검색해 주세요.", 504);
    }
  }

  const lists = await mapLimited(years, async (year) => {
    try {
      checkDeadline();
      const body = await callNongsaro("monthNewFdLst", {
        thisYear: year, thisMonth: period.month,
      });
      const rows = asArray(body.items?.item).filter((item) =>
        item && String(item.fdSeCode).trim() === "290001"
      );
      return { year, rows };
    } catch (error) {
      return { year, error };
    }
  });
  const goodLists = lists.filter((entry) => !entry.error);
  const failedLists = lists.filter((entry) => entry.error);
  if (!goodLists.length) throw failedLists[0].error;

  // 같은 콘텐츠가 여러 연도에 포함되어도 상세 조회는 한 번만 합니다.
  const byId = new Map();
  let invalidCount = 0;
  for (const { year, rows } of goodLists) {
    for (const row of rows) {
      const id = String(row.cntntsNo ?? "").trim();
      if (!/^\d+$/.test(id)) { invalidCount++; continue; }
      if (byId.has(id)) {
        byId.get(id).sourceYears.push(year);
      } else {
        byId.set(id, { id, summary: row, sourceYears: [year] });
      }
    }
  }
  // 조용히 일부만 검색하는 대신 너무 큰 응답은 명확한 오류로 알립니다.
  if (byId.size > 1000) {
    throw new ApiError("월별 음식 자료가 많아 일괄 수집이 필요합니다. 서버의 수집 방식을 점검해 주세요.");
  }

  const details = await mapLimited([...byId.values()], async ({ id, summary, sourceYears }) => {
    try {
      checkDeadline();
      const body = await callNongsaro("monthNewFdDtl", { cntntsNo: id });
      const detail = asArray(body.item)[0];
      if (!detail || typeof detail !== "object" || !plainText(detail.fdNm)) {
        throw new ApiError("음식 상세 응답에 음식명이 없습니다.");
      }
      return { recipe: {
        id,
        name: plainText(detail.fdNm),
        ingredients: plainText(detail.matrlInfo),
        serving: plainText(detail.phphmntNm),
        calories: numberOrNull(detail.energyQy),
        protein: numberOrNull(detail.protQy),
        carbs: numberOrNull(detail.crbQy),
        image: imageUrl(detail) || imageUrl(summary),
        sourceYears,
      } };
    } catch (error) {
      return { error };
    }
  });
  const failedDetails = details.filter((entry) => entry.error);
  const available = details.filter((entry) => entry.recipe).map((entry) => entry.recipe);
  if (byId.size > 0 && available.length === 0) throw failedDetails[0].error;

  const warnings = [];
  if (failedLists.length) warnings.push(`${failedLists.length}개 연도의 같은 달 자료를 확인하지 못했습니다.`);
  if (failedDetails.length) warnings.push(`${failedDetails.length}개 음식의 상세 조회에 실패했습니다.`);
  if (invalidCount) warnings.push(`${invalidCount}개 항목의 식별번호가 없어 제외했습니다.`);
  if (warnings.length) warnings.push("확인된 자료만 표시합니다. 누락된 결과가 있을 수 있으니 다시 검색해 주세요.");

  return {
    month: period.month,
    recipes: available,
    checkedYearCount: goodLists.length,
    sourceYears: goodLists.filter((entry) => entry.rows.length).map((entry) => entry.year),
    partial: warnings.length > 0,
    warning: warnings.join(" "),
    source: "농촌진흥청 농사로 이달의 음식",
  };
}

async function getMonthIndex(period) {
  const apiKey = (process.env.NONGSARO_API_KEY || "").trim();
  if (!apiKey) throw new ApiError("backend/.env에 NONGSARO_API_KEY를 설정해 주세요.", 500);
  const keyId = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  const key = `${keyId}:${process.env.NONGSARO_ALLOW_HTTP === "true"}:${period.year}-${period.month}`;
  const cached = monthCache.get(key);
  if (cached && cached.until > Date.now()) return cached.data;
  if (monthPending.has(key)) return monthPending.get(key);

  const work = (async () => {
    const data = await buildMonthIndex(period);
    // 오류가 일부 발생한 결과는 저장하지 않아 다음 검색 때 재시도할 수 있습니다.
    if (!data.partial) {
      if (monthCache.size >= 3) monthCache.delete(monthCache.keys().next().value);
      monthCache.set(key, { data, until: Date.now() + MONTH_CACHE_MS });
    }
    return data;
  })();
  monthPending.set(key, work);
  try { return await work; }
  finally { monthPending.delete(key); }
}

router.get("/", async (req, res) => {
  console.log("[제철음식] 검색 요청 수신 - 연도와 월 자동 처리");
  try {
    const raw = req.query.keyword ?? "";
    if (typeof raw !== "string" || raw.length > 80) {
      throw new ApiError("검색어는 80자 이내의 음식명이나 재료명으로 입력해 주세요.", 400);
    }
    const keyword = raw.trim();
    const tokens = keyword.normalize("NFKC").toLowerCase()
      .split(/[\s,]+/).filter(Boolean)
      .filter((word) => !["제철", "제철음식", "제철요리"].includes(word))
      .map(compact);
    const index = await getMonthIndex(koreaPeriod());
    const scored = index.recipes.flatMap((recipe) => {
      const name = compact(recipe.name);
      const ingredients = compact(recipe.ingredients);
      if (!tokens.every((word) => name.includes(word) || ingredients.includes(word))) return [];
      const score = tokens.reduce((sum, word) =>
        sum + (name === word ? 100 : name.includes(word) ? 10 : 1), 0);
      return [{ recipe, score }];
    });
    // 음식명 일치 결과를 먼저 보여주고, 다음으로 재료 일치 결과를 보여줍니다.
    scored.sort((a, b) => b.score - a.score ||
      a.recipe.name.localeCompare(b.recipe.name, "ko"));
    res.set("Cache-Control", "no-store");
    res.json({
      mode: "keyword-auto-month-v2",
      revision: "auto-month-restart-check-1",
      keyword,
      month: index.month,
      recipes: scored.map((entry) => entry.recipe),
      total: scored.length,
      availableCount: index.recipes.length,
      checkedYearCount: index.checkedYearCount,
      sourceYears: index.sourceYears,
      partial: index.partial,
      warning: index.warning,
      source: index.source,
    });
  } catch (error) { sendError(res, error); }
});

module.exports = router;
