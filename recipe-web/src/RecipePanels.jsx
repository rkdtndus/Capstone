import { Icon, TitleOrnament } from "./RecipeUI";

export function Home({ onNavigate }) {
  return (
    <section className="food-home" aria-labelledby="landing-title">
      <div className="food-home-intro">
        <TitleOrnament />
        <h1 id="landing-title">오늘의 <em>레시피</em> 찾기</h1>
        <p>지금 먹고 싶은 요리부터,<br />제철 재료로 즐기는 건강한 레시피까지!<br />오늘, 어떤 요리를 만들어볼까요? <span className="food-smile" aria-hidden="true">☺</span></p>
      </div>
      <div className="food-home-choices">
        <button type="button" className="food-home-choice food-home-choice--orange" onClick={() => onNavigate('custom')}>
          <Icon name="pot" size={78} /><h2>맞춤 레시피 검색 <Icon name="arrow" size={30} /></h2>
          <p>재료, 요리 종류, 칼로리에 맞게<br />나에게 딱 맞는 레시피를 찾아보세요!</p>
        </button>
        <button type="button" className="food-home-choice food-home-choice--green" onClick={() => onNavigate('seasonal')}>
          <Icon name="vegetables" size={78} /><h2>제철음식 레시피 검색 <Icon name="arrow" size={30} /></h2>
          <p>지금 가장 맛있는 이달의 음식으로<br />더 신선하고 건강한 요리를 만나보세요!</p>
        </button>
      </div>
      <div className="food-benefits">
        <div><span className="food-benefit-icon"><Icon name="leaf" size={37} /></span><div><h3>신선한 제철 재료</h3><p>지금 가장 맛있는 재료로</p></div></div>
        <div><span className="food-benefit-icon"><Icon name="chef" size={37} /></span><div><h3>다양한 레시피</h3><p>매일 새로운 한 끼의 즐거움</p></div></div>
        <div><span className="food-benefit-icon"><Icon name="heart" size={37} /></span><div><h3>나에게 맞는 요리</h3><p>취향과 영양을 함께 생각해요</p></div></div>
      </div>
    </section>
  );
}

export function SearchForm({ id, value, onChange, onSearch, placeholder = '음식명 또는 재료를 입력하세요' }) {
  return (
    <form className="food-search-form" role="search" onSubmit={(event) => { event.preventDefault(); onSearch(); }}>
      <label className="sr-only" htmlFor={id}>음식명 또는 재료 검색</label>
      <div className="food-search-row">
        <Icon name="search" size={26} />
        <input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} onKeyDown={(event) => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault(); }} />
        <button className="food-primary" type="submit"><Icon name="search" size={20} />검색</button>
      </div>
    </form>
  );
}

export function RecipeFilters({ min, max, onMin, onMax, sort, onSort, foodType, onFoodType, cookingMethod, onCookingMethod }) {
  const calories = [
    ['전체', '', ''], ['300kcal 이하', '', '300'], ['300~500kcal', '300', '500'],
    ['500~700kcal', '500', '700'], ['700kcal 이상', '700', ''],
  ];
  const sorts = [
    ['default', '기본순'], ['calorieLow', '칼로리 낮은순'], ['calorieHigh', '칼로리 높은순'],
    ['proteinLow', '단백질 낮은순'], ['proteinHigh', '단백질 높은순'],
    ['carbLow', '탄수화물 낮은순'], ['carbHigh', '탄수화물 높은순'],
  ];
  return (
    <section className="food-filters" aria-label="레시피 검색 조건">
      <div className="food-filter-row">
        <h2><Icon name="flame" />칼로리 필터</h2>
        <div className="food-filter-options">
          {calories.map(([label, lower, upper]) => <button key={label} type="button" className={min === lower && max === upper ? 'food-pill is-active' : 'food-pill'} aria-pressed={min === lower && max === upper} onClick={() => { onMin(lower); onMax(upper); }}>{label}</button>)}
          <details className="food-custom-range"><summary>칼로리 직접 입력</summary><div>
            <label>최소 kcal<input type="number" min="0" step="any" placeholder="제한 없음" value={min} onChange={(event) => onMin(event.target.value)} /></label>
            <span>~</span><label>최대 kcal<input type="number" min="0" step="any" placeholder="제한 없음" value={max} onChange={(event) => onMax(event.target.value)} /></label>
          </div></details>
        </div>
      </div>
      <div className="food-filter-row"><h2><Icon name="sort" />정렬 기준</h2><div className="food-filter-options">
        {sorts.map(([value, label]) => <button key={value} type="button" className={sort === value ? 'food-pill food-pill--sort is-active' : 'food-pill food-pill--sort'} aria-pressed={sort === value} onClick={() => onSort(value)}>{label}</button>)}
      </div></div>
      {onFoodType && <div className="food-filter-row"><h2><Icon name="chef" />음식 종류</h2><div className="food-filter-options">
        {['전체', '국&찌개', '반찬', '밥', '일품', '후식', '기타'].map((type) => <button key={type} type="button" className={foodType === type ? 'food-pill is-active' : 'food-pill'} aria-pressed={foodType === type} onClick={() => onFoodType(type)}>{type}</button>)}
      </div></div>}
      {onCookingMethod && <div className="food-filter-row"><h2><Icon name="pot" />조리 방식</h2><div className="food-filter-options">
        {['전체', '끓이기', '굽기', '볶기', '찌기', '튀기기', '기타'].map((method) => <button key={method} type="button" className={cookingMethod === method ? 'food-pill is-active' : 'food-pill'} aria-pressed={cookingMethod === method} onClick={() => onCookingMethod(method)}>{method}</button>)}
      </div></div>}
    </section>
  );
}

export function Pagination({ page, total, onChange }) {
  return <nav className="food-pagination" aria-label="검색 결과 페이지">
    <button type="button" className="food-quiet" disabled={page === 1} onClick={() => onChange(page - 1)}><span className="food-back-arrow"><Icon name="arrow" size={16} /></span>이전</button>
    <span aria-live="polite"><strong>{page}</strong> / {total}</span>
    <button type="button" className="food-quiet" disabled={page === total} onClick={() => onChange(page + 1)}>다음<Icon name="arrow" size={16} /></button>
  </nav>;
}

function nutrition(value, unit) {
  return value === null || value === undefined || String(value).trim() === '' ? '자료 없음' : value + ' ' + unit;
}

export function RecipeDetails({ recipe, fat, steps, ingredientImage, seasonal = false, onBack, isFavorite, onToggleFavorite }) {
  return (
    <section className="food-detail" aria-labelledby="recipe-detail-title">
      <button className="food-quiet food-detail-back" type="button" onClick={onBack}><span className="food-back-arrow"><Icon name="arrow" size={17} /></span>검색 결과로 돌아가기</button>
      <div className="food-detail-summary">
        <div className="food-detail-photo"><Icon name="pot" size={76} />{recipe.image && <img src={recipe.image} alt={recipe.name} onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div>
        <div className="food-detail-intro">
          <span className="food-tag">{seasonal ? '제철 레시피' : recipe.category || '레시피'}</span>
          <h1 id="recipe-detail-title">{recipe.name}</h1>
          <p className="food-lead">{seasonal ? '제철 재료로 만드는 맛있는 한 끼' : '오늘의 식탁을 위한 맛있는 한 끼'}</p>
          <button type="button" className={isFavorite ? 'food-quiet food-detail-save is-saved' : 'food-quiet food-detail-save'} aria-pressed={isFavorite} onClick={onToggleFavorite}><Icon name="heart" size={19} />{isFavorite ? '찜한 레시피 해제' : '레시피 찜하기'}</button>
          <h2>영양정보</h2>
          <dl className="food-detail-nutrition">
            {[['칼로리', recipe.calories, 'kcal'], ['단백질', recipe.protein, 'g'], ['탄수화물', recipe.carbs, 'g'], ['지방', fat, 'g']].map(([label, value, unit]) => <div key={label}><dt>{label}</dt><dd>{nutrition(value, unit)}</dd></div>)}
          </dl>
        </div>
      </div>
      <section className="food-detail-section"><h2><Icon name="vegetables" />재료</h2>
        {ingredientImage && <img className="food-ingredient-image" src={ingredientImage} alt="요리 재료 사진" loading="lazy" />}
        <p className="food-detail-ingredients">{recipe.ingredients || '재료 정보가 없습니다.'}</p>
      </section>
      <section className="food-detail-section"><h2><Icon name="chef" />조리 방법</h2>
        {steps.length > 0 ? <ol className="food-cooking-steps">{steps.map((step, index) => <li key={index}><span className="food-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p>{step.text.replace(/^\s*(\d{1,2}[.)]|[①-⑳])\s*/, '')}</p>{step.image && <img src={step.image} alt={'조리 과정 ' + (index + 1)} loading="lazy" />}</div></li>)}</ol> : <p className="food-help">조리 방법 정보가 없습니다.</p>}
      </section>
      <p className="food-source">{seasonal ? '농촌진흥청 농사로 · 2019년 월별 제철음식 자료' : '식품의약품안전처 조리식품의 레시피 DB'} · 영양정보는 원자료 기준입니다.</p>
    </section>
  );
}
