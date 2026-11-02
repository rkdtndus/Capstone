import { useCallback, useEffect, useRef, useState } from "react";
// 화면 스타일은 App.jsx가 불러오는 App.css에 모았습니다.
// 기존 SeasonalFood.css 파일은 그대로 두어도 되지만 이번 파일에서는 사용하지 않습니다.

const API = "http://localhost:3001/api/seasonal";
const DATE_CHECK_MS = 60000;
const REQUEST_TIMEOUT_MS = 120000;
const CATEGORIES = ["국", "밥", "반찬", "면", "간식", "기타"];
const koreaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul", calendar: "gregory", numberingSystem: "latn",
  year: "numeric", month: "2-digit", day: "2-digit",
});

function seasonForMonth(month) {
  if (month >= 3 && month <= 5) return { name: "봄", icon: "🌸" };
  if (month >= 6 && month <= 8) return { name: "여름", icon: "☀️" };
  if (month >= 9 && month <= 11) return { name: "가을", icon: "🍂" };
  return { name: "겨울", icon: "❄️" };
}

function getKoreaCalendar(date = new Date()) {
  const parts = Object.fromEntries(koreaDateFormatter.formatToParts(date)
    .filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const month = Number(parts.month);
  return {
    year: Number(parts.year), month, day: Number(parts.day),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    periodKey: `${parts.year}-${parts.month}`, season: seasonForMonth(month),
  };
}

// 농사로 최신 백엔드 응답에는 국/밥/반찬 필드가 없습니다.
// 다음 분류는 API 공식 분류가 아닌, 음식명 기반의 화면용 규칙입니다.
// 오분류를 확인하면 id 또는 음식명에 해당하는 항목을 아래에 추가할 수 있습니다.
const CATEGORY_OVERRIDES = {
  // "실제_콘텐츠_ID": "반찬",
  // "실제 음식명": "밥",
};

function classifyRecipe(recipe) {
  const override = CATEGORY_OVERRIDES[String(recipe.id)] || CATEGORY_OVERRIDES[recipe.name];
  if (CATEGORIES.includes(override)) return override;
  // 제목의 괄호 설명과 공백만 제거합니다. 재료명으로 분류하면 된장/쌀 등으로 오분류될 수 있습니다.
  const name = String(recipe.name ?? "").normalize("NFKC")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "").replace(/\s+/g, "");
  // 국밥은 '국'이 아니라 '밥', 국수는 '국'이 아니라 '면'으로 분류합니다.
  if (/(밥|죽|리[조소]또|필라프)$/.test(name)) return "밥";
  if (/(국수|우동|파스타|스파게티|라멘|라면|소바|냉면|쫄면|수제비)$/.test(name)) return "면";
  if (/(국|탕|찌개|전골|수프|스프)$/.test(name)) return "국";
  if (/(케이크|쿠키|머핀|과자|한과|약과|호떡|떡|경단|강정|푸딩|젤리|스무디|주스|아이스크림|샌드위치|토스트|빵|식혜|수정과)$/.test(name)) return "간식";
  if (/(무침|나물|볶음|조림|구이|찜|부침|부침개|전|전병|튀김|김치|장아찌|샐러드|겉절이|절임|잡채|두부선)$/.test(name)) return "반찬";
  return "기타";
}

function displayNumber(value, unit) {
  if (value === null || value === undefined || String(value).trim() === "") return "자료 없음";
  const number = Number(value);
  return Number.isFinite(number) ? `${number} ${unit}` : "자료 없음";
}

export default function SeasonalFood() {
  const [calendar, setCalendar] = useState(() => getKoreaCalendar());
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("전체");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  const submittedKeywordRef = useRef("");

  const stopRequest = useCallback(() => {
    const request = requestRef.current;
    requestRef.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
  }, []);

  const loadRecipes = useCallback(async (searchKeyword) => {
    stopRequest();
    const requestedCalendar = getKoreaCalendar();
    const request = { controller: new AbortController(), timer: null, timedOut: false };
    requestRef.current = request;
    request.timer = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, REQUEST_TIMEOUT_MS);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      // 사용자는 연도·월을 고르지 않습니다. 서버가 현재 한국 시간의 월만 조회합니다.
      const params = new URLSearchParams({ keyword: searchKeyword.trim() });
      const response = await fetch(`${API}?${params}`, {
        signal: request.controller.signal, cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (requestRef.current !== request) return;
      if (!response.ok) throw new Error(data?.error || `조회 실패: HTTP ${response.status}`);
      if (data?.mode !== "keyword-auto-month-v2" || !Array.isArray(data.recipes)) {
        throw new Error("자동 월 조회 백엔드와 응답 형식이 다릅니다. 마지막 backend/seasonal.js 적용 여부를 확인해 주세요.");
      }
      const now = getKoreaCalendar();
      // 조회 도중 달이 바뀌면 이전 달 결과를 표시하지 않고 새 달을 다시 조회합니다.
      if (requestedCalendar.periodKey !== now.periodKey) {
        setCalendar(now);
        return;
      }
      if (Number(data.month) !== now.month) {
        throw new Error("현재 월과 서버 응답 월이 다릅니다. 컴퓨터·서버의 날짜와 백엔드 버전을 확인해 주세요.");
      }
      setCalendar((previous) => previous.dateKey === now.dateKey ? previous : now);
      const recipes = data.recipes.filter((recipe) => recipe && typeof recipe === "object")
        .map((recipe) => ({ ...recipe, foodGroup: classifyRecipe(recipe) }));
      setResult({ ...data, keyword: searchKeyword.trim(), recipes, periodKey: now.periodKey });
    } catch (err) {
      if (requestRef.current !== request) return;
      if (request.timedOut) {
        setError("자료 조회 시간이 초과되었습니다. 다시 불러오기를 눌러 주세요.");
      } else if (err?.name !== "AbortError") {
        setError(err?.message === "Failed to fetch"
          ? "제철음식 API에 연결하지 못했습니다. 백엔드 서버와 CORS 설정을 확인해 주세요."
          : err?.message || "제철음식을 불러오지 못했습니다.");
      }
    } finally {
      clearTimeout(request.timer);
      if (requestRef.current === request) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [stopRequest]);

  useEffect(() => {
    function checkCalendar() {
      if (document.visibilityState === "hidden") return;
      const now = getKoreaCalendar();
      setCalendar((previous) => previous.dateKey === now.dateKey ? previous : now);
    }
    checkCalendar();
    const timer = setInterval(checkCalendar, DATE_CHECK_MS);
    document.addEventListener("visibilitychange", checkCalendar);
    window.addEventListener("focus", checkCalendar);
    window.addEventListener("pageshow", checkCalendar);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", checkCalendar);
      window.removeEventListener("focus", checkCalendar);
      window.removeEventListener("pageshow", checkCalendar);
    };
  }, []);

  useEffect(() => {
    // 이 페이지에 들어왔을 때와 월이 바뀌었을 때만 자동 조회합니다.
    void loadRecipes(submittedKeywordRef.current);
    return stopRequest;
  }, [calendar.periodKey, loadRecipes, stopRequest]);

  function handleSearch(event) {
    event.preventDefault();
    submittedKeywordRef.current = keyword.trim();
    if (!keyword.trim()) setCategory("전체");
    void loadRecipes(keyword.trim());
  }

  function showWholeMonth() {
    // 맨 왼쪽 'N월 전체'는 검색어와 음식 종류를 모두 지웁니다.
    setKeyword("");
    setCategory("전체");
    submittedKeywordRef.current = "";
    void loadRecipes("");
  }

  const currentResult = result?.periodKey === calendar.periodKey ? result : null;
  const candidates = currentResult?.recipes ?? [];
  const visible = category === "전체" ? candidates : candidates.filter((recipe) => recipe.foodGroup === category);
  const counts = Object.fromEntries(CATEGORIES.map((item) => [item, candidates.filter((recipe) => recipe.foodGroup === item).length]));

  return (
    <section className="food-seasonal-page" aria-labelledby="seasonal-title">
      <a className="food-back" href="#/">← 일반 검색으로 돌아가기</a>
      <div className="food-section-heading">
        <div>
          <p className="food-eyebrow">이달의 음식 찾기</p>
          <h1 id="seasonal-title">제철음식</h1>
        </div>
        <span className="food-calendar-chip">{calendar.season.icon} {calendar.month}월 · {calendar.season.name}</span>
      </div>
      <p className="food-lead">{calendar.month}월 자료에서만 찾아요. 다른 달의 음식은 섞지 않습니다.</p>
      <p className="food-help">한국 시간 {calendar.year}년 {calendar.month}월 {calendar.day}일 기준 · 여러 연도의 같은 달 자료를 사용합니다.</p>

      <form className="food-search-form" onSubmit={handleSearch} role="search">
        <label className="food-search-label" htmlFor="seasonal-keyword">음식명 또는 재료</label>
        <div className="food-search-row">
          <input
            id="seasonal-keyword"
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
            }}
            placeholder="예: 배추, 두부, 버섯"
            maxLength={80}
            autoComplete="off"
          />
          <button className="food-primary" type="submit">{loading ? "다시 검색" : "제철음식 검색"}</button>
        </div>
      </form>

      <div className="food-category-bar" role="group" aria-label="제철음식 종류 선택">
        <button
          type="button"
          className={category === "전체" && !currentResult?.keyword ? "is-active" : ""}
          aria-pressed={category === "전체" && !currentResult?.keyword}
          onClick={showWholeMonth}
        >{calendar.month}월 전체</button>
        {CATEGORIES.map((item) => (
          <button
            key={item} type="button"
            className={category === item ? "is-active" : ""}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >{item}{currentResult && <span className="food-category-count">{counts[item]}</span>}</button>
        ))}
      </div>
      <p className="food-help">국·밥·반찬 버튼은 현재 검색 결과에서 종류만 좁힙니다. ‘{calendar.month}월 전체’를 누르면 검색어와 종류 선택을 모두 초기화합니다.</p>

      {loading && <p className="food-status" role="status">{calendar.month}월 음식 자료를 불러오고 있어요. 첫 조회에는 시간이 걸릴 수 있습니다.</p>}
      {error && (
        <div className="food-error" role="alert">
          <p>{error}</p>
          <button className="food-quiet" type="button" onClick={() => void loadRecipes(submittedKeywordRef.current)}>다시 불러오기</button>
        </div>
      )}
      {!loading && currentResult && (
        <div aria-live="polite">
          <div className="food-section-heading food-seasonal-results-heading">
            <div>
              <h2>{currentResult.keyword ? `‘${currentResult.keyword}’ 검색 결과` : `${calendar.month}월 전체 음식`}</h2>
              <p className="food-count">{category === "전체" ? "모든 종류" : category} <strong>{visible.length}개</strong></p>
            </div>
            {category !== "전체" && currentResult.keyword && (
              <button className="food-quiet" type="button" onClick={() => setCategory("전체")}>종류 필터만 해제</button>
            )}
          </div>
          {currentResult.warning && <p className="food-warning">{currentResult.warning}</p>}
          {visible.length === 0 ? (
            <p className="food-empty">
              {currentResult.availableCount === 0
                ? `${calendar.month}월에 조회된 음식 자료가 없습니다.`
                : `현재 검색어와 '${category === "전체" ? "모든 종류" : category}' 조건에 맞는 ${calendar.month}월 음식이 없습니다.`}
              {" "}다른 달 자료로 대체하지 않습니다. 검색 조건을 바꾸거나 ‘{calendar.month}월 전체’를 눌러 보세요.
            </p>
          ) : (
            <div className="food-grid">
              {visible.map((recipe, index) => (
                <article className="food-card" key={`${recipe.id ?? "seasonal"}-${index}`}>
                  {recipe.image && /^https?:\/\//i.test(recipe.image) && (
                    <img src={recipe.image} alt={recipe.name || "음식"} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  )}
                  <div className="food-card-body">
                    <span className="food-tag">{recipe.foodGroup}</span>
                    <h3>{recipe.name || "이름 정보 없음"}</h3>
                    <p className="food-ingredients">{recipe.ingredients || "재료 정보가 없습니다."}</p>
                    <dl className="food-nutrition">
                      <div><dt>열량</dt><dd>{displayNumber(recipe.calories, "kcal")}</dd></div>
                      <div><dt>단백질</dt><dd>{displayNumber(recipe.protein, "g")}</dd></div>
                      <div><dt>탄수화물</dt><dd>{displayNumber(recipe.carbs, "g")}</dd></div>
                    </dl>
                    <p className="food-card-note">원자료 인분: {recipe.serving || "표기 없음"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="food-source">출처: {currentResult.source || "농촌진흥청 농사로 이달의 음식"}. 영양 값은 원자료 기준이며 1인분으로 환산하지 않았습니다.</p>
        </div>
      )}
      <details className="food-explanation">
        <summary>제철 기준과 음식 종류 분류 안내</summary>
        <p>현재 한국 시간의 월과 같은 달에 등록된 음식만 조회합니다. 자료 연도는 다를 수 있으며, 모든 재료의 실제 수확 시기를 따로 판정하는 기능은 아닙니다.</p>
        <p>국·밥·반찬 등의 종류는 음식명으로 분류한 화면용 규칙입니다. 공식 API 분류가 아니므로 틀릴 수 있고, 판단하기 어려운 음식은 ‘기타’에 표시합니다. 국에는 탕·찌개·전골, 반찬에는 무침·조림·볶음 등이 포함됩니다.</p>
        <p>봄 3~5월, 여름 6~8월, 가을 9~11월, 겨울 12~2월로 표시합니다. 1분마다 날짜를 확인하지만 API를 매분 호출하지는 않으며, 월이 바뀌면 목록을 다시 조회합니다.</p>
      </details>
    </section>
  );
}
