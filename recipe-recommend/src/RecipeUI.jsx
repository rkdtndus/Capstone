export function Icon({ name = "chef", size = 24, className = "" }) {
  const paths = {
    chef: ["M7 14a5 5 0 0 1-2-9.6 5 5 0 0 1 8-1.8 5 5 0 0 1 7.8 5.8A5 5 0 0 1 17 14", "M7 11v10h10V11M7 17h10"],
    search: ["M21 21l-5-5", "M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0"],
    pot: ["M3 12h16a8 8 0 0 1-16 0ZM19 12l3-3M7 8c-3-3 3-3 0-6M12 8c-3-3 3-3 0-6"],
    leaf: ["M20 3C9 1 2 8 6 15c7 6 15-1 14-12ZM4 21 16 8M11 13l-1-5M11 13l6 1"],
    vegetables: ["m14 10-7 11c-1 1-3 0-3-1l3-13c1-4 10-1 7 3ZM7 11l3 2M6 16l2 1M14 6c0-5 5-5 4-2 5-2 5 3 0 3M17 3l-1 4"],
    heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"],
    flame: ["M12 2c1 6-5 6-3 11 2 1 4-1 4-4 6 5 6 12-1 13C3 23 0 14 7 7c0 4 2 4 2 4 1-3 1-6 3-9Z"],
    sort: ["M7 3v18m-4-4 4 4 4-4M17 21V3m-4 4 4-4 4 4"],
    arrow: ["m9 5 7 7-7 7"],
    refresh: ["M20 7a9 9 0 1 0 1 9M20 2v6h-6"],
    calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v5M17 2v5M3 10h18M7 14h1M12 14h1M17 14h1"],
  };
  return <svg className={["food-icon", className].join(" ")} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{(paths[name] || paths.chef).map((d, i) => <path d={d} key={i} />)}</svg>;
}

export function FoodArtwork({ seasonal = false }) {
  return <div className={seasonal ? "food-artwork food-artwork--seasonal" : "food-artwork"} aria-hidden="true"><div className="food-art food-art--left" /><div className="food-art food-art--right" /></div>;
}

export function TitleOrnament() {
  return <div className="food-title-ornament" aria-hidden="true"><span /><Icon name="chef" size={54} /><span /></div>;
}

export function RecipeCard({
  recipe,
  formatNumber,
  seasonal = false,
  isFavorite = false,
  onToggleFavorite,
  savedMonth = null,
  sourceLabel = "",
}) {
  const hasId = (typeof recipe.id === "string" && recipe.id.trim() !== "") ||
    (typeof recipe.id === "number" && Number.isFinite(recipe.id));
  return (
    <article className="food-card">
      {onToggleFavorite && (
        <button
          className={isFavorite ? "food-favorite-button is-saved" : "food-favorite-button"}
          type="button"
          aria-label={(recipe.name || "음식") + (isFavorite ? " 즐겨찾기 해제" : " 즐겨찾기 추가")}
          aria-pressed={isFavorite}
          title={hasId ? (isFavorite ? "즐겨찾기 해제" : "즐겨찾기 추가") : "레시피 번호가 없어 저장할 수 없습니다."}
          disabled={!hasId}
          onClick={onToggleFavorite}
        >
          <Icon name="heart" size={21} />
        </button>
      )}
      <div className="food-card-photo"><Icon name="pot" size={48} />
        {recipe.image && /^https?:\/\//i.test(recipe.image) && <img src={recipe.image} alt={recipe.name || "음식"} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
      </div>
      <div className="food-card-body">
        <h3>{recipe.name || "이름 정보 없음"}</h3>
        <p className="food-ingredients" title={recipe.ingredients}>{recipe.ingredients || "재료 정보가 없습니다."}</p>
        <div className="food-tags">
          {sourceLabel && <span className="food-tag food-tag--soft">{sourceLabel}</span>}
          {(recipe.foodGroup || recipe.category) && <span className="food-tag">{recipe.foodGroup || recipe.category}</span>}
          {recipe.method && <span className="food-tag food-tag--soft">{recipe.method}</span>}
          {seasonal && <span className="food-tag food-tag--orange">{savedMonth ? savedMonth + "월 제철 자료" : "이달의 음식"}</span>}
        </div>
        <p className="food-card-calories"><Icon name="flame" size={19} /><strong>{formatNumber(recipe.calories, "kcal")}</strong></p>
        <dl className="food-nutrition"><div><dt>단백질</dt><dd>{formatNumber(recipe.protein, "g")}</dd></div><div><dt>탄수화물</dt><dd>{formatNumber(recipe.carbs, "g")}</dd></div></dl>
      </div>
      <details className="food-card-details"><summary>재료 자세히 보기</summary><p>{recipe.ingredients || "재료 정보가 없습니다."}</p>{seasonal && <p className="food-card-note">원자료 인분: {recipe.serving || "표기 없음"}</p>}</details>
    </article>
  );
}
