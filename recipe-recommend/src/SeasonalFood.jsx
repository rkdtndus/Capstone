import { useCallback, useEffect, useRef, useState } from "react";
import "./SeasonalFood.css";

// 기존 backend/seasonal.js의 자동 월 조회 API를 그대로 사용합니다.
const API = "http://localhost:3001/api/seasonal";
const DATE_CHECK_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 120 * 1000;

const koreaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// 서비스에서 사용하는 달력 기준입니다. 기온이나 실제 수확기를 판정하지 않습니다.
function seasonForMonth(month) {
  if (month >= 3 && month <= 5) return { name: "봄", icon: "🌸" };
  if (month >= 6 && month <= 8) return { name: "여름", icon: "☀️" };
  if (month >= 9 && month <= 11) return { name: "가을", icon: "🍂" };
  return { name: "겨울", icon: "❄️" };
}

function getKoreaCalendar(date = new Date()) {
  const values = Object.fromEntries(
    koreaDateFormatter.formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);
  return {
    year,
    month,
    day,
    dateKey: `${values.year}-${values.month}-${values.day}`,
    periodKey: `${values.year}-${values.month}`,
    season: seasonForMonth(month),
  };
}

const displayNumber = (value, unit) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value} ${unit}`
    : "자료 없음";

export default function SeasonalFood() {
  const [calendar, setCalendar] = useState(() => getKoreaCalendar());
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  // 달이 바뀌면 마지막으로 검색한 키워드로 다시 조회합니다.
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
    const request = {
      controller: new AbortController(),
      timer: null,
      timedOut: false,
    };
    requestRef.current = request;
    request.timer = setTimeout(() => {
      request.timedOut = true;
      request.controller.abort();
    }, REQUEST_TIMEOUT_MS);

    setLoading(true);
    setError("");
    setResult(null);

    try {
      // 연도·월은 클라이언트에서 보내지 않습니다.
      // 기존 백엔드가 서버의 현재 한국 시간으로 조회할 월을 정합니다.
      const params = new URLSearchParams({ keyword: searchKeyword.trim() });
      const response = await fetch(`${API}?${params}`, {
        signal: request.controller.signal,
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (requestRef.current !== request) return;

      if (!response.ok) {
        throw new Error(data?.error || `조회 실패: HTTP ${response.status}`);
      }
      if (data?.mode !== "keyword-auto-month-v2" || !Array.isArray(data.recipes)) {
        throw new Error(
          "자동 월 조회 백엔드와 응답 형식이 다릅니다. 마지막으로 받은 backend/seasonal.js가 적용됐는지 확인해 주세요."
        );
      }

      const now = getKoreaCalendar();
      // 조회 중 월이 바뀌었다면 이전 달 결과는 표시하지 않습니다.
      // 아래의 periodKey 효과가 새 달의 데이터를 다시 불러옵니다.
      if (requestedCalendar.periodKey !== now.periodKey) {
        setCalendar(now);
        return;
      }
      if (Number(data.month) !== now.month) {
        throw new Error(
          "현재 월과 서버의 응답 월이 다릅니다. 컴퓨터·서버의 날짜 설정과 실행 중인 백엔드 버전을 확인해 주세요."
        );
      }

      setCalendar((previous) => previous.dateKey === now.dateKey ? previous : now);
      setResult({ ...data, periodKey: now.periodKey });
    } catch (err) {
      if (requestRef.current !== request) return;
      if (request.timedOut) {
        setError("자료 조회 시간이 초과되었습니다. 검색 버튼을 눌러 다시 시도해 주세요.");
      } else if (err?.name !== "AbortError") {
        setError(
          err?.message === "Failed to fetch"
            ? "백엔드에 연결하지 못했습니다. backend 서버 실행 상태와 CORS 설정을 확인해 주세요."
            : err?.message || "제철음식을 불러오지 못했습니다."
        );
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
    // 매분 날짜만 확인합니다. 매분 농사로 API를 호출하는 것은 아닙니다.
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
    // 첫 접속 시 자동 조회하고, 달이 바뀐 경우에만 자동 재조회합니다.
    void loadRecipes(submittedKeywordRef.current);
    return stopRequest;
  }, [calendar.periodKey, loadRecipes, stopRequest]);

  function handleSearch(event) {
    event.preventDefault();
    const submitted = keyword.trim();
    submittedKeywordRef.current = submitted;
    void loadRecipes(submitted);
  }

  // 날짜 갱신 직후에도 이전 달 결과가 잠깐 노출되지 않도록 확인합니다.
  const currentResult = result?.periodKey === calendar.periodKey ? result : null;

  return (
    <section className="seasonal-section" aria-labelledby="seasonal-title">
      <h2 id="seasonal-title">제철음식 추천</h2>

      <div className="seasonal-card" style={{ margin: "16px 0", background: "#f4f8f2" }}>
        <p style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px" }}>
          {calendar.season.icon} 지금은 {calendar.month}월 · {calendar.season.name}입니다
        </p>
        <p className="seasonal-note" style={{ margin: 0 }}>
          {calendar.year}년 {calendar.month}월 {calendar.day}일 · 한국 시간 기준
        </p>
      </div>

      <p className="seasonal-note">
        현재 월의 음식 자료를 자동으로 불러옵니다. 음식명이나 재료를 입력하면
        이달의 음식 후보 중에서 관련 음식을 찾아드립니다.
      </p>

      <form onSubmit={handleSearch}>
        <div className="seasonal-controls">
          <label className="seasonal-keyword">
            음식명 또는 재료
            <input
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setResult(null);
                setError("");
              }}
              placeholder="예: 두부, 버섯, 배추"
              maxLength={80}
              disabled={loading}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "불러오는 중…" : "제철음식 검색"}
          </button>
        </div>
      </form>

      <p className="seasonal-note">
        검색어를 비우면 이달의 전체 음식 목록을 볼 수 있습니다.
        여러 단어를 입력하면 모든 단어가 포함된 음식을 찾습니다.
      </p>
      <p className="seasonal-note">
        화면이 켜져 있는 동안 1분마다 날짜를 확인하고, 다른 탭에서 돌아올 때도 다시 확인합니다.
        월이 바뀌면 마지막 검색어로 목록을 자동 갱신합니다.
      </p>
      {error && <p className="seasonal-error" role="alert">{error}</p>}
      {loading && (
        <p role="status">
          {calendar.month}월 음식 자료를 확인하고 있습니다.
          처음 조회할 때는 여러 자료를 모으는 과정이 필요합니다.
        </p>
      )}

      {!loading && currentResult && (
        <div aria-live="polite">
          <h3>
            {currentResult.keyword
              ? `‘${currentResult.keyword}’ 검색 결과`
              : `${calendar.month}월 · ${calendar.season.name} 음식 후보`}
            {" · "}{currentResult.recipes.length}개
          </h3>
          <p className="seasonal-note">
            한국 시간 {calendar.month}월 기준 · 여러 연도에 등록된 같은 달 자료를 활용합니다.
            자료 연도는 현재 연도와 다를 수 있습니다.
          </p>
          {currentResult.warning && (
            <p className="seasonal-warning">{currentResult.warning}</p>
          )}
          {currentResult.availableCount === 0 ? (
            <p>
              {currentResult.partial
                ? "일부 자료를 불러오지 못해 음식 목록을 확인할 수 없습니다. 다시 검색해 주세요."
                : "조회된 이달의 음식이 없습니다. 다른 달의 음식을 현재 제철인 것처럼 대신 표시하지 않습니다."}
            </p>
          ) : currentResult.recipes.length === 0 ? (
            <p>
              {currentResult.partial ? "불러온 자료 중에서는" : "이달의 음식 자료에는"}
              {" ‘"}{currentResult.keyword}{"’와 일치하는 음식이 없습니다. "}
              검색어를 비우고 전체 목록을 확인하거나 다른 음식명·재료로 검색해 보세요.
            </p>
          ) : (
            <div className="seasonal-grid">
              {currentResult.recipes.map((recipe) => (
                <article className="seasonal-card" key={recipe.id}>
                  {recipe.image && (
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      loading="lazy"
                      onError={(event) => { event.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <h3>{recipe.name}</h3>
                  <p><strong>재료:</strong> {recipe.ingredients || "자료 없음"}</p>
                  <p><strong>제공 인분 표기:</strong> {recipe.serving || "자료 없음"}</p>
                  <p>열량: {displayNumber(recipe.calories, "kcal")}</p>
                  <p>단백질: {displayNumber(recipe.protein, "g")}</p>
                  <p>탄수화물: {displayNumber(recipe.carbs, "g")}</p>
                </article>
              ))}
            </div>
          )}
          <p className="seasonal-note">
            출처: {currentResult.source || "농촌진흥청 농사로 이달의 음식"}.
            월별 선정 음식 자료를 활용한 추천이며, 모든 재료의 실제 수확 시기를 판정하지는 않습니다.
            영양 값은 원자료 기준이고 별도의 1인분 환산은 하지 않았습니다.
          </p>
        </div>
      )}
      <p className="seasonal-note">
        계절은 이 서비스에서 봄 3~5월, 여름 6~8월, 가을 9~11월, 겨울 12~2월로 구분합니다.
        날씨가 아니라 달력을 기준으로 하며, 컴퓨터와 서버의 날짜·시간이 정확하게 설정되어 있어야 합니다.
      </p>
    </section>
  );
}
