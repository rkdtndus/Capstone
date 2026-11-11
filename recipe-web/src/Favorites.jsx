import { Icon, RecipeCard, TitleOrnament } from "./RecipeUI";

function showNumber(value, unit) {
  if (value === null || value === undefined || String(value).trim() === "") return "자료 없음";
  const number = Number(value);
  return Number.isFinite(number) ? number + " " + unit : "자료 없음";
}

export default function Favorites({ favorites, onToggleFavorite, onBrowse }) {
  return (
    <section className="food-favorites-page" aria-labelledby="favorites-title">
      <div className="food-hero">
        <TitleOrnament />
        <h1 id="favorites-title">찜한 <em>레시피</em></h1>
        <p className="food-lead">다시 만들고 싶은 요리, 한곳에 모아두세요.</p>
      </div>

      <div className="food-section-heading food-favorites-heading">
        <h2><Icon name="heart" size={25} />나의 레시피북 <strong>{favorites.length}개</strong></h2>
        {favorites.length > 0 && <span className="food-help">최근에 찜한 순서로 보여드려요.</span>}
      </div>

      {favorites.length === 0 ? (
        <div className="food-search-welcome food-favorites-empty">
          <Icon name="heart" size={57} />
          <h3>아직 찜한 레시피가 없어요</h3>
          <p>음식 카드의 하트를 눌러 마음에 드는 요리를 저장해 보세요.</p>
          <button className="food-primary" type="button" onClick={onBrowse}>레시피 찾아보기 <Icon name="arrow" size={17} /></button>
        </div>
      ) : (
        <div className="food-grid">
          {favorites.map((favorite) => (
            <RecipeCard
              key={favorite.key}
              recipe={favorite.recipe}
              formatNumber={showNumber}
              seasonal={favorite.source === "seasonal"}
              savedMonth={favorite.sourceMonth}
              sourceLabel={favorite.source === "seasonal" ? "제철음식" : "일반 음식"}
              isFavorite
              onToggleFavorite={() => onToggleFavorite(favorite.source, favorite.recipe)}
            />
          ))}
        </div>
      )}

      <p className="food-source food-favorites-note">
        찜한 레시피는 이 브라우저에 저장됩니다. 브라우저의 사이트 데이터를 삭제하면 목록도 지워집니다.
        저장 당시의 재료·영양정보를 표시하며, 제철음식은 표시된 월의 자료입니다.
      </p>
    </section>
  );
}
