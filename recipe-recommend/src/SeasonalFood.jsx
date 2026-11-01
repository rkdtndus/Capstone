import { useEffect, useRef, useState } from "react";
import "./SeasonalFood.css";

const API = "http://localhost:3001/api/seasonal";

const displayNumber = (value, unit) =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value} ${unit}` : "자료 없음";

export default function SeasonalFood() {
  const [keyword, setKeyword] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  async function handleSearch(event) {
    event.preventDefault();
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 120000);

    setLoading(true);
    setError("");
    setResult(null);
    try {
      // 연도·월은 보내지 않습니다. 현재 월 판단과 자료 수집은 서버가 처리합니다.
      const params = new URLSearchParams({ keyword: keyword.trim() });
      const response = await fetch(`${API}?${params}`, { signal: controller.signal });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `조회 실패: HTTP ${response.status}`);
      if (data?.mode !== "keyword-auto-month-v2" || !Array.isArray(data.recipes)) {
        throw new Error("수정된 백엔드 코드가 실행되지 않았습니다. backend 서버를 다시 실행해 주세요.");
      }
      if (requestRef.current === controller) setResult(data);
    } catch (err) {
      if (requestRef.current === controller) {
        setError(timedOut ? "자료 조회 시간이 초과되었습니다. 다시 검색해 주세요."
          : err.message === "Failed to fetch" ? "백엔드에 연결되지 않았습니다. 서버 실행 상태를 확인해 주세요."
          : err.message);
      }
    } finally {
      clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="seasonal-section" aria-labelledby="seasonal-title">
      <h2 id="seasonal-title">제철음식 찾기</h2>
      <p className="seasonal-note">
        음식명이나 재료를 입력하세요. 현재 월에 해당하는 농사로 음식 자료에서 찾아드립니다.
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
            {loading ? "검색 중…" : "제철음식 검색"}
          </button>
        </div>
      </form>
      <p className="seasonal-note">
        검색어를 비우면 이달의 전체 음식 목록을 볼 수 있습니다.
        여러 단어를 입력하면 모든 단어가 포함된 음식을 찾습니다.
      </p>
      {error && <p className="seasonal-error" role="alert">{error}</p>}
      {loading && (
        <p role="status">이달의 음식 자료를 확인하고 있습니다. 처음 검색할 때는 자료를 모으는 과정이 필요합니다.</p>
      )}
      {!loading && result && (
        <div aria-live="polite">
          <h3>
            {result.keyword ? `‘${result.keyword}’ 검색 결과` : "이달의 음식"} · {result.recipes.length}개
          </h3>
          <p className="seasonal-note">
            현재 {Number(result.month)}월 기준 · 등록된 여러 연도의 같은 달 자료를 검색했습니다.
          </p>
          {result.warning && <p className="seasonal-warning">{result.warning}</p>}
          {result.availableCount === 0 ? (
            <p>
              {result.partial
                ? "일부 자료를 불러오지 못해 음식 목록을 확인할 수 없습니다. 다시 검색해 주세요."
                : "농사로의 이달 자료에서 조회된 음식이 없습니다. 다른 달의 음식을 이달의 제철음식으로 대신 표시하지 않습니다."}
            </p>
          ) : result.recipes.length === 0 ? (
            <p>
              {result.partial ? "불러온 자료 중에서는" : "이달의 음식 자료에는"} ‘{result.keyword}’와 일치하는 음식이 없습니다.
              다른 재료를 입력하거나 검색어를 비우고 다시 검색해 보세요.
            </p>
          ) : (
            <div className="seasonal-grid">
              {result.recipes.map((recipe) => (
                <article className="seasonal-card" key={recipe.id}>
                  {recipe.image && (
                    <img src={recipe.image} alt={recipe.name} loading="lazy"
                      onError={(event) => { event.currentTarget.style.display = "none"; }} />
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
            출처: {result.source}. 월별 선정 음식 자료를 활용한 검색이며,
            모든 재료의 실제 수확 시기를 판정하는 기능은 아닙니다.
            영양 값은 원자료 기준이며 별도의 1인분 환산은 하지 않았습니다.
          </p>
        </div>
      )}
    </section>
  );
}
