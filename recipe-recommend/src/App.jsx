import { useCallback, useEffect, useRef, useState } from "react";
import SeasonalFood from "./SeasonalFood";
import Favorites from "./Favorites";
import useFavorites from "./useFavorites";
import { FoodArtwork, Icon, RecipeCard, TitleOrnament } from "./RecipeUI";
import "./App.css";

// 인증키는 프론트엔드에 넣지 않습니다. 기존 Express API를 사용합니다.
const RECIPES_API = "http://localhost:3001/api/recipes";
const REQUEST_TIMEOUT_MS = 30000;

function readPage() {
  const hash = window.location.hash.replace(/\/$/, "");
  if (hash === "#/seasonal") return "seasonal";
  if (hash === "#/search") return "search";
  if (hash === "#/favorites") return "favorites";
  return "home";
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

function GeneralSearch({ isFavorite, onToggleFavorite }) {
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

  const calorieOptions = [
    { label: "전체", min: "", max: "" },
    { label: "300kcal 이하", min: "", max: "300" },
    { label: "300~500kcal", min: "300", max: "500" },
    { label: "500~700kcal", min: "500", max: "700" },
    { label: "700kcal 이상", min: "700", max: "" },
  ];

  function resetFilters() {
    setInput("");
    setSubmittedKeyword("");
    setCategory("전체");
    setMinCal("");
    setMaxCal("");
    setSortBy("original");
  }

  return (
    <div className="food-search-page">
      <section className="food-hero" aria-labelledby="home-title">
        <TitleOrnament />
        <h1 id="home-title">맞춤 <em>레시피 검색</em></h1>
        <p className="food-lead">원하는 재료, 칼로리, 요리 종류로 나에게 딱 맞는 레시피를 찾아보세요!</p>
        <form className="food-search-form" onSubmit={handleSubmit} role="search">
          <label className="sr-only" htmlFor="general-keyword">음식명 · 재료 · 키워드</label>
          <div className="food-search-row"><Icon name="search" size={26} />
            <input id="general-keyword" type="search" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} placeholder="재료나 원하는 요리를 검색하세요" maxLength={80} autoComplete="off" />
            <button className="food-primary" type="submit"><Icon name="search" size={20} />{loading ? "다시 검색" : "검색"}</button>
          </div>
        </form>
      </section>

      <section className="food-filters" aria-label="레시피 검색 조건">
        <div className="food-filter-row"><h2><Icon name="flame" />칼로리 필터</h2><div className="food-filter-options">{calorieOptions.map((option) => <button key={option.label} type="button" className={minCal === option.min && maxCal === option.max ? "food-pill is-active" : "food-pill"} aria-pressed={minCal === option.min && maxCal === option.max} onClick={() => { setMinCal(option.min); setMaxCal(option.max); }}>{option.label}</button>)}</div></div>
        <div className="food-filter-row"><h2><Icon name="sort" />정렬 기준</h2><div className="food-filter-options">{[["original", "기본순"], ["calories", "낮은 칼로리순"], ["protein", "높은 단백질순"], ["carbs", "높은 탄수화물순"]].map(([value, label]) => <button key={value} type="button" className={sortBy === value ? "food-pill food-pill--sort is-active" : "food-pill food-pill--sort"} aria-pressed={sortBy === value} onClick={() => setSortBy(value)}>{label}</button>)}</div></div>
        <div className="food-filter-row"><h2><Icon name="chef" />요리 종류</h2><div className="food-filter-options">{["전체", "국", "조림", "볶음"].map((item) => <button className={category === item ? "food-pill is-active" : "food-pill"} key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}<details className="food-custom-range"><summary>칼로리 직접 입력</summary><div><label>최소 kcal<input type="number" min="0" step="any" placeholder="제한 없음" value={minCal} onChange={(event) => setMinCal(event.target.value)} /></label><span>~</span><label>최대 kcal<input type="number" min="0" step="any" placeholder="제한 없음" value={maxCal} onChange={(event) => setMaxCal(event.target.value)} /></label></div></details></div></div>
      </section>

      <section className="food-results" aria-labelledby="general-results-title" aria-busy={loading}>
        <div className="food-section-heading"><div><h2 id="general-results-title">{submittedKeyword ? "‘" + submittedKeyword + "’ 검색 결과" : "검색 결과"} <strong>{hasSearched && !loading && !error ? sorted.length + "건" : ""}</strong></h2></div><div className="food-result-actions">{hasSearched && !loading && <button className="food-quiet" type="button" onClick={() => void loadRecipes(submittedKeyword, true)}><Icon name="refresh" size={16} />다시 불러오기</button>}<button className="food-quiet" type="button" onClick={resetFilters}><Icon name="refresh" size={16} />조건 초기화</button></div></div>
        {loading && <p className="food-status" role="status">맛있는 레시피를 불러오고 있어요.</p>}
        {error && <p className="food-error" role="alert">{error}</p>}
        {!validRange && <p className="food-error" role="alert">최소·최대 칼로리를 올바르게 입력해 주세요.</p>}
        {!hasSearched && <div className="food-search-welcome"><Icon name="pot" size={54} /><h3>오늘은 어떤 요리를 만들어볼까요?</h3><p>가지고 있는 재료나 먹고 싶은 음식을 검색해 보세요.</p><button className="food-primary" type="button" onClick={() => void loadRecipes("")}>전체 레시피 보기 <Icon name="arrow" size={16} /></button><p className="food-help">검색어를 비우고 Enter를 눌러도 전체 음식을 볼 수 있어요.</p></div>}
        {hasSearched && !loading && !error && <>
          {validRange && sorted.length === 0 && <p className="food-empty">조건에 맞는 음식이 없습니다. 다른 검색어로 검색하거나 빈칸에서 Enter를 눌러 보세요.</p>}
          <div className="food-grid">{sorted.map((recipe, index) => <RecipeCard key={(recipe.id ?? "food") + "-" + index} recipe={recipe} formatNumber={showNumber} isFavorite={isFavorite("food", recipe.id)} onToggleFavorite={() => onToggleFavorite("food", recipe)} />)}</div>
          <p className="food-source">식품의약품안전처 조리식품의 레시피 DB · 불러온 {recipes.length}개 음식 안에서 검색합니다. 영양 정보는 원자료 기준입니다.</p>
        </>}
      </section>
    </div>
  );
}

function Home() {
  return <section className="food-home" aria-labelledby="landing-title">
    <div className="food-home-intro"><TitleOrnament /><h1 id="landing-title">오늘의 <em>레시피</em> 찾기</h1><p>지금 먹고 싶은 요리부터,<br />제철 재료로 즐기는 건강한 레시피까지!<br />오늘, 어떤 요리를 만들어볼까요? <span className="food-smile" aria-hidden="true">☺</span></p></div>
    <div className="food-home-choices">
      <a className="food-home-choice food-home-choice--orange" href="#/search"><Icon name="pot" size={78} /><h2>맞춤 레시피 검색 <Icon name="arrow" size={30} /></h2><p>재료, 요리 종류, 칼로리에 맞게<br />나에게 딱 맞는 레시피를 찾아보세요!</p></a>
      <a className="food-home-choice food-home-choice--green" href="#/seasonal"><Icon name="vegetables" size={78} /><h2>제철음식 레시피 검색 <Icon name="arrow" size={30} /></h2><p>지금 가장 맛있는 이달의 음식으로<br />더 신선하고 건강한 요리를 만나보세요!</p></a>
    </div>
    <div className="food-benefits"><div><span className="food-benefit-icon"><Icon name="leaf" size={37} /></span><div><h3>신선한 제철 재료</h3><p>지금 가장 맛있는 재료로</p></div></div><div><span className="food-benefit-icon"><Icon name="chef" size={37} /></span><div><h3>다양한 레시피</h3><p>매일 새로운 한 끼의 즐거움</p></div></div><div><span className="food-benefit-icon"><Icon name="heart" size={37} /></span><div><h3>나에게 맞는 요리</h3><p>취향과 영양을 함께 생각해요</p></div></div></div>
  </section>;
}

export default function App() {
  const [page, setPage] = useState(readPage);
  const { favorites, isFavorite, toggleFavorite, error: favoritesError, dismissError } = useFavorites();
  useEffect(() => {
    function handleHashChange() { setPage(readPage()); }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);
  useEffect(() => {
    document.title = page === "favorites" ? "찜한 레시피 | 오늘의 레시피 찾기" : page === "seasonal" ? "제철음식 레시피 검색 | 오늘의 레시피 찾기" : page === "search" ? "맞춤 레시피 검색 | 오늘의 레시피 찾기" : "오늘의 레시피 찾기";
    window.scrollTo(0, 0);
  }, [page]);

  return <div className={"food-app food-page--" + page}>
    <header className="food-header"><div className="food-topbar"><a className="food-brand" href="#/" aria-label="오늘의 레시피 찾기 홈"><Icon name="chef" size={43} /><span>오늘의 레시피 찾기</span></a><nav aria-label="주 메뉴"><a href="#/" aria-current={page === "home" ? "page" : undefined}>홈</a><a href="#/search" aria-current={page === "search" ? "page" : undefined}>레시피 둘러보기</a><a href="#/seasonal" aria-current={page === "seasonal" ? "page" : undefined}>제철음식</a><a className="food-favorites-link" href="#/favorites" aria-current={page === "favorites" ? "page" : undefined} aria-label={"찜한 레시피 " + favorites.length + "개"}><Icon name="heart" size={20} /><span>찜한 레시피</span><span className="food-favorites-count" aria-hidden="true">{favorites.length}</span></a></nav><a className="food-header-search" href="#/search" aria-label="레시피 검색"><Icon name="search" size={24} /></a><span className="food-header-note"><Icon name="leaf" size={19} />맛있는 하루의 시작</span></div></header>
    <div className="food-page-body"><FoodArtwork seasonal={page === "seasonal"} /><main className="food-main">{favoritesError && <div className="food-error food-favorites-error" role="alert"><p>{favoritesError}</p><button className="food-quiet" type="button" onClick={dismissError}>확인</button></div>}{page === "home" && <Home />}<div hidden={page !== "search"}><GeneralSearch isFavorite={isFavorite} onToggleFavorite={toggleFavorite} /></div>{page === "seasonal" && <SeasonalFood isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />}{page === "favorites" && <Favorites favorites={favorites} onToggleFavorite={toggleFavorite} />}</main><div className="food-bottom-waves" aria-hidden="true"><span /><span /></div></div>
    <footer className="food-footer"><a href="#/"><Icon name="chef" size={20} />오늘의 레시피 찾기</a><span>공공데이터로 만나는 맛있는 한 끼</span></footer>
  </div>;
}
