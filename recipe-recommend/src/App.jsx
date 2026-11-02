import { useCallback, useEffect, useRef, useState } from "react";
import SeasonalFood from "./SeasonalFood";
import "./App.css";

// 인증키는 프론트엔드에 넣지 않습니다. 기존 Express API를 사용합니다.
const RECIPES_API = "http://localhost:3001/api/recipes";
const REQUEST_TIMEOUT_MS = 30000;

function readPage() {
  return window.location.hash.replace(/\/$/, "") === "#/seasonal"
    ? "seasonal"
    : "home";
}

function compact(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function asNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function showNumber(value, unit) {
  const number = asNumber(value);
  return number === null ? "자료 없음" : `${number} ${unit}`;
}

function generalMatchesCategory(recipe, category) {
  const name = String(recipe.name ?? "");
  if (category === "전체") return true;
  if (category === "국") {
    return String(recipe.category ?? "").includes("국") || /국|탕|찌개|전골|수프|스프/.test(name);
  }
  if (category === "조림") return /조림/.test(name);
  return /볶음/.test(name) || String(recipe.method ?? "").includes("볶기");
}

function GeneralSearch() {
  const [input, setInput] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");
  const [recipes, setRecipes] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("전체");
  // 빈칸 = 제한 없음. 기존 500 kcal 기본 상한으로 전체 결과가 숨겨지지 않도록 합니다.
  const [minCal, setMinCal] = useState("");
  const [maxCal, setMaxCal] = useState("");
  const [sortBy, setSortBy] = useState("original");
  const requestRef = useRef(null);
  const dataCacheRef = useRef(null);

  const stopRequest = useCallback(() => {
    const request = requestRef.current;
    requestRef.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
  }, []);

  useEffect(() => stopRequest, [stopRequest]);

  async function loadRecipes(keyword, refresh = false) {
    stopRequest();
    setHasSearched(true);
    setSubmittedKeyword(keyword);
    setError("");

    if (!refresh && dataCacheRef.current !== null) {
      setRecipes(dataCacheRef.current);
      setLoading(false);
      return;
    }

    const request = { controller: new AbortController(), timer: null, timedOut: false };
    requestRef.current = request;
    request.timer = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setLoading(true);

    try {
      const response = await fetch(RECIPES_API, {
        signal: request.controller.signal,
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (requestRef.current !== request) return;
      if (!response.ok) throw new Error(data?.error || `조회 실패: HTTP ${response.status}`);
      if (!Array.isArray(data)) throw new Error("일반 레시피 API가 목록 형태의 데이터를 반환하지 않았습니다.");
      const rows = data.filter((recipe) => recipe && typeof recipe === "object");
      dataCacheRef.current = rows;
      setRecipes(rows);
    } catch (err) {
      if (requestRef.current !== request) return;
      if (request.timedOut) {
        setError("일반 음식 조회 시간이 초과되었습니다. 다시 불러오기를 눌러 주세요.");
      } else if (err?.name !== "AbortError") {
        setError(err?.message === "Failed to fetch"
          ? "일반 음식 API에 연결하지 못했습니다. 백엔드 서버와 CORS 설정을 확인해 주세요."
          : err?.message || "음식을 불러오지 못했습니다.");
      }
    } finally {
      clearTimeout(request.timer);
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    // 새 검색 시 이전 필터를 초기화합니다. 빈칸 Enter는 조회된 목록 전체입니다.
    setCategory("전체");
    setMinCal("");
    setMaxCal("");
    setSortBy("original");
    void loadRecipes(input.trim());
  }

  const min = minCal.trim() === "" ? null : Number(minCal);
  const max = maxCal.trim() === "" ? null : Number(maxCal);
  const validRange = (min === null || (Number.isFinite(min) && min >= 0)) &&
    (max === null || (Number.isFinite(max) && max >= 0)) &&
    (min === null || max === null || min <= max);
  const tokens = submittedKeyword.split(/[\s,]+/).filter(Boolean).map(compact);
  const filtered = !validRange ? [] : recipes.filter((recipe) => {
    const fields = [recipe.name, recipe.ingredients, recipe.category, recipe.method].map(compact);
    if (!tokens.every((token) => fields.some((field) => field.includes(token)))) return false;
    if (!generalMatchesCategory(recipe, category)) return false;
    if (min === null && max === null) return true;
    const calories = asNumber(recipe.calories);
    return calories !== null && (min === null || calories >= min) && (max === null || calories <= max);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "original") return 0;
    const field = sortBy === "calories" ? "calories" : sortBy;
    const left = asNumber(a[field]);
    const right = asNumber(b[field]);
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return sortBy === "calories" ? left - right : right - left;
  });

  return (
    <>
      <section className="food-hero" aria-labelledby="home-title">
        <p className="food-eyebrow">오늘의 메뉴 찾기</p>
        <h1 id="home-title">오늘 뭐 먹지?</h1>
        <p className="food-lead">먹고 싶은 음식이나 가지고 있는 재료를 검색해 보세요.</p>
        <form className="food-search-form" onSubmit={handleSubmit} role="search">
          <label className="food-search-label" htmlFor="general-keyword">음식명 · 재료 · 키워드</label>
          <div className="food-search-row">
            <input
              id="general-keyword"
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
              }}
              placeholder="예: 두부, 감자, 볶음밥"
              maxLength={80}
              autoComplete="off"
            />
            <button className="food-primary" type="submit">{loading ? "다시 검색" : "음식 검색"}</button>
          </div>
          <p className="food-help">아무것도 입력하지 않고 Enter를 누르면 불러온 음식 전체를 볼 수 있어요.</p>
        </form>
        <a className="food-seasonal-link" href="#/seasonal">
          <span><strong>제철음식</strong><small>지금 이달에 맞는 음식만 찾아보기</small></span>
          <span aria-hidden="true">→</span>
        </a>
      </section>

      {hasSearched && (
        <section className="food-results" aria-labelledby="general-results-title" aria-busy={loading}>
          <div className="food-section-heading">
            <div>
              <p className="food-eyebrow">일반 음식 검색</p>
              <h2 id="general-results-title">{submittedKeyword ? `‘${submittedKeyword}’ 검색 결과` : "전체 음식"}</h2>
            </div>
            {!loading && <button className="food-quiet" type="button" onClick={() => void loadRecipes(submittedKeyword, true)}>다시 불러오기</button>}
          </div>
          {loading && <p className="food-status" role="status">음식을 불러오고 있어요.</p>}
          {error && <p className="food-error" role="alert">{error}</p>}
          {!loading && !error && (
            <>
              <p className="food-help">연결된 API에서 받은 {recipes.length}개 음식 안에서 검색합니다. 일반 음식에는 제철 조건을 적용하지 않습니다.</p>
              <details className="food-advanced">
                <summary>상세 조건 · 칼로리와 정렬</summary>
                <div className="food-filter-fields">
                  <label>음식 종류
                    <select value={category} onChange={(event) => setCategory(event.target.value)}>
                      {["전체", "국", "조림", "볶음"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label>최소 칼로리
                    <input type="number" min="0" step="any" placeholder="제한 없음" value={minCal} onChange={(event) => setMinCal(event.target.value)} />
                  </label>
                  <label>최대 칼로리
                    <input type="number" min="0" step="any" placeholder="제한 없음" value={maxCal} onChange={(event) => setMaxCal(event.target.value)} />
                  </label>
                  <label>정렬
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="original">기본순</option>
                      <option value="calories">낮은 칼로리순</option>
                      <option value="protein">높은 단백질순</option>
                      <option value="carbs">높은 탄수화물순</option>
                    </select>
                  </label>
                </div>
              </details>
              {!validRange && <p className="food-error" role="alert">최소·최대 칼로리를 올바르게 입력해 주세요.</p>}
              <p className="food-count" role="status">검색 결과 <strong>{sorted.length}개</strong></p>
              {validRange && sorted.length === 0 && <p className="food-empty">조건에 맞는 음식이 없습니다. 다른 검색어로 검색하거나 빈칸에서 Enter를 눌러 보세요.</p>}
              <div className="food-grid">
                {sorted.map((recipe, index) => (
                  <article className="food-card" key={`${recipe.id ?? "food"}-${index}`}>
                    {recipe.image && /^https?:\/\//i.test(recipe.image) && (
                      <img src={recipe.image} alt={recipe.name || "음식"} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    )}
                    <div className="food-card-body">
                      {recipe.category && <span className="food-tag">{recipe.category}</span>}
                      <h3>{recipe.name || "이름 정보 없음"}</h3>
                      <p className="food-ingredients">{recipe.ingredients || "재료 정보가 없습니다."}</p>
                      <dl className="food-nutrition">
                        <div><dt>열량</dt><dd>{showNumber(recipe.calories, "kcal")}</dd></div>
                        <div><dt>단백질</dt><dd>{showNumber(recipe.protein, "g")}</dd></div>
                        <div><dt>탄수화물</dt><dd>{showNumber(recipe.carbs, "g")}</dd></div>
                      </dl>
                    </div>
                  </article>
                ))}
              </div>
              <p className="food-source">출처: 식품의약품안전처 조리식품의 레시피 DB · 영양 정보는 원자료 기준입니다.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}

export default function App() {
  const [page, setPage] = useState(readPage);
  useEffect(() => {
    function handleHashChange() { setPage(readPage()); }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  useEffect(() => {
    document.title = page === "seasonal" ? "제철음식 | 오늘 뭐 먹지?" : "오늘 뭐 먹지?";
    window.scrollTo(0, 0);
  }, [page]);

  return (
    <div className="food-app">
      <header className="food-topbar">
        <a className="food-brand" href="#/" aria-label="오늘 뭐 먹지? 홈">오늘 뭐 먹지?</a>
        <nav aria-label="주 메뉴">
          <a href="#/" aria-current={page === "home" ? "page" : undefined}>일반 검색</a>
          <a href="#/seasonal" aria-current={page === "seasonal" ? "page" : undefined}>제철음식</a>
        </nav>
      </header>
      <main className="food-main">
        {/* 홈 검색 상태는 유지하지만, 제철 페이지는 선택한 때에만 실행합니다. */}
        <div hidden={page !== "home"}><GeneralSearch /></div>
        {page === "seasonal" && <SeasonalFood />}
      </main>
      <footer className="food-footer">공공데이터 기반 음식·레시피 검색</footer>
    </div>
  );
}
