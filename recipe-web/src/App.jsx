import { useState, useEffect } from 'react';
import Favorites from './Favorites';
import useFavorites from './useFavorites';
import { FoodArtwork, Icon, RecipeCard, TitleOrnament } from './RecipeUI';
import { Home, Pagination, RecipeDetails, RecipeFilters, SearchForm } from './RecipePanels';
import './App.css';


function getSeasonalImages(recipe) {
  const codes = String(recipe.rtnImgSeCode || '').split('|');
  const paths = String(recipe.rtnFileCours || '').split('|');
  const files = String(recipe.rtnStreFileNm || '').split('|');

  const images = codes.map((code, index) => {
    const path = paths[index];
    const filename = files[index];

    if (!path || !filename) return null;

    return {
      code: code.trim(),
      filename,
      url: `https://www.nongsaro.go.kr/${path}/${filename}`
    };
  }).filter(Boolean);

  const main = images.find(
    (image) => image.code === '209006'
  );

  const steps = images
    .filter((image) => image.code === '209007')
    .sort((a, b) => {
      const aNum = Number(
        a.filename.match(/_CIMG_(\d+)/)?.[1] ?? 999
      );

      const bNum = Number(
        b.filename.match(/_CIMG_(\d+)/)?.[1] ?? 999
      );

      return aNum - bNum;
    });


return {
  main: main?.url || '',
  ingredient: steps[0]?.url || '',
  steps: steps.slice(1)
};
}





// Adapt only the presentation; recipe-web keeps its original API response fields.
function foodCard(recipe) {
  return {
    id: recipe.RCP_SEQ, name: recipe.RCP_NM, ingredients: recipe.RCP_PARTS_DTLS,
    category: recipe.RCP_PAT2, method: recipe.RCP_WAY2, calories: recipe.INFO_ENG,
    protein: recipe.INFO_PRO, carbs: recipe.INFO_CAR, image: recipe.ATT_FILE_NO_MAIN,
  };
}

function seasonalCard(recipe) {
  return {
    id: recipe.cntntsNo, name: recipe.fdNm, ingredients: recipe.ingredients,
    foodGroup: '제철음식', calories: recipe.calories, protein: recipe.protein,
    carbs: recipe.carbohydrate, image: getSeasonalImages(recipe).main,
  };
}

function showNumber(value, unit) {
  if (value === null || value === undefined || String(value).trim() === '') return '자료 없음';
  const number = Number(value);
  return Number.isFinite(number) ? number + ' ' + unit : '자료 없음';
}

function validCalorieRange(min, max) {
  return (min === '' || (Number.isFinite(Number(min)) && Number(min) >= 0)) &&
    (max === '' || (Number.isFinite(Number(max)) && Number(max) >= 0)) &&
    (min === '' || max === '' || Number(min) <= Number(max));
}

function App() {
  const [page, setPage] = useState('home');
  const { favorites, isFavorite, toggleFavorite, error: favoritesError, dismissError } = useFavorites();
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [seasonalFoodsLoading, setSeasonalFoodsLoading] = useState(true);
  const [seasonalRecipesLoading, setSeasonalRecipesLoading] = useState(true);

  useEffect(() => {
    const title = { home: '오늘의 레시피 찾기', custom: '맞춤 레시피 검색', seasonal: '제철음식 레시피 검색', favorites: '찜한 레시피', detail: '레시피 상세보기', 'seasonal-detail': '제철음식 상세보기' };
    document.title = title[page] + (page === 'home' ? '' : ' | 오늘의 레시피 찾기');
    window.scrollTo(0, 0);
  }, [page]);
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minCalorie, setMinCalorie] = useState('');
  const [maxCalorie, setMaxCalorie] = useState('');
  const [sortBy, setSortBy] = useState('default');
  const [foodType, setFoodType] = useState('전체');
  const [cookingMethod, setCookingMethod] = useState('전체');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [resultPage, setResultPage] = useState(1);


const resetCustomFilters = () => {
  setSearchInput('');
  setKeyword('');
  setMinCalorie('');
  setMaxCalorie('');
  setSortBy('default');
  setFoodType('전체');
  setCookingMethod('전체');
  setResultPage(1);
};


const [seasonalMonth, setSeasonalMonth] = useState(
  new Date().getMonth() + 1
);


  const [seasonalFoods, setSeasonalFoods] = useState([]);
  const [selectedSeasonalFood, setSelectedSeasonalFood] = useState(null);
  const [selectedSeasonalRecipe, setSelectedSeasonalRecipe] = useState(null);
  const [seasonalRecipes, setSeasonalRecipes] = useState([]);
  const [seasonalError, setSeasonalError] = useState('');
  const [seasonalSearchInput, setSeasonalSearchInput] = useState('');
  const [seasonalKeyword, setSeasonalKeyword] = useState('');
  const [seasonalMinCalorie, setSeasonalMinCalorie] = useState('');
  const [seasonalMaxCalorie, setSeasonalMaxCalorie] = useState('');
  const [seasonalSort, setSeasonalSort] = useState('default');
  const [seasonalResultPage, setSeasonalResultPage] = useState(1);


  useEffect(() => {
  setSeasonalResultPage(1);
}, [
  selectedSeasonalFood,
  seasonalKeyword,
  seasonalMinCalorie,
  seasonalMaxCalorie,
  seasonalSort
]);
    

useEffect(() => {
  const controller = new AbortController();
  fetch('http://localhost:3001/api/recipes', { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error('레시피 조회 실패');
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error('레시피 응답 형식을 확인해 주세요.');
      setRecipes(data);
    })
    .catch((err) => {
      if (!controller.signal.aborted) setError(err.message);
    })
    .finally(() => {
      if (!controller.signal.aborted) setRecipesLoading(false);
    });
  return () => controller.abort();
}, []);

useEffect(() => {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  setSeasonalFoods([]);
  setSeasonalRecipes([]);
  setSelectedSeasonalFood(null);
  setSeasonalError('');
  setSeasonalFoodsLoading(true);
  setSeasonalRecipesLoading(true);

  fetch(`http://localhost:3001/api/seasonal?month=${seasonalMonth}`, options)
    .then((response) => {
      if (!response.ok) throw new Error('제철 식재료 조회 실패');
      return response.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error('제철 식재료 응답 형식을 확인해 주세요.');
      if (!controller.signal.aborted) setSeasonalFoods(data);
    })
    .catch((err) => {
      if (!controller.signal.aborted) setSeasonalError(err.message);
    })
    .finally(() => {
      if (!controller.signal.aborted) setSeasonalFoodsLoading(false);
    });

  fetch(`http://localhost:3001/api/seasonal/recipes?month=${seasonalMonth}`, options)
    .then((response) => {
      if (!response.ok) throw new Error('제철 레시피 조회 실패');
      return response.json();
    })
    .then(async (data) => {
      const foodRecipes = data.recipes.filter((recipe) => recipe.fdSeCode === '290001');
      const detailedRecipes = await Promise.all(foodRecipes.map(async (recipe) => {
        try {
          const response = await fetch(`http://localhost:3001/api/seasonal/recipes/${recipe.cntntsNo}`, options);
          if (!response.ok) throw new Error('상세정보 조회 실패');
          const detail = await response.json();
          return {
            ...recipe, ingredients: detail.ingredients || '', method: detail.method || '',
            calories: detail.calories, protein: detail.protein,
            carbohydrate: detail.carbohydrate, fat: detail.fat,
          };
        } catch (error) {
          if (controller.signal.aborted) throw error;
          return { ...recipe, ingredients: '' };
        }
      }));
      if (!controller.signal.aborted) setSeasonalRecipes(detailedRecipes);
    })
    .catch((err) => {
      if (!controller.signal.aborted) setSeasonalError(err.message);
    })
    .finally(() => {
      if (!controller.signal.aborted) setSeasonalRecipesLoading(false);
    });

  return () => controller.abort();
}, [seasonalMonth]);

const filteredRecipes = recipes.filter((recipe) => {
  const search = keyword.trim().toLowerCase();

  const name = (recipe.RCP_NM || '').toLowerCase();
  const ingredients = (recipe.RCP_PARTS_DTLS || '').toLowerCase();

  const kcal = Number(recipe.INFO_ENG);

  const matchesSearch =
    name.includes(search) || ingredients.includes(search);

  const matchesMin =
    minCalorie === '' || kcal >= Number(minCalorie);

  const matchesMax =
    maxCalorie === '' || kcal <= Number(maxCalorie);

  const matchesFoodType =
    foodType === '전체' || recipe.RCP_PAT2 === foodType;

  const matchesCookingMethod =
    cookingMethod === '전체' ||
    recipe.RCP_WAY2 === cookingMethod;

  return (
    matchesSearch &&
    matchesMin &&
    matchesMax &&
    matchesFoodType &&
    matchesCookingMethod
  );
});



const sortedRecipes = [...filteredRecipes].sort((a, b) => {
  switch (sortBy) {
    case 'calorieLow':
      return Number(a.INFO_ENG) - Number(b.INFO_ENG);

    case 'calorieHigh':
      return Number(b.INFO_ENG) - Number(a.INFO_ENG);

    case 'proteinLow':
      return Number(a.INFO_PRO) - Number(b.INFO_PRO);

    case 'proteinHigh':
      return Number(b.INFO_PRO) - Number(a.INFO_PRO);

    case 'carbLow':
      return Number(a.INFO_CAR) - Number(b.INFO_CAR);

    case 'carbHigh':
      return Number(b.INFO_CAR) - Number(a.INFO_CAR);

    default:
      return 0;
  }
});



const pageSize = 20;

const totalPages = Math.max(
  1,
  Math.ceil(sortedRecipes.length / pageSize)
);

const visibleRecipes = sortedRecipes.slice(
  (resultPage - 1) * pageSize,
  resultPage * pageSize
);



useEffect(() => {
  setResultPage(1);
}, [
  keyword,
  minCalorie,
  maxCalorie,
  sortBy,
  foodType,
  cookingMethod
]);







const matchingSeasonalRecipes = selectedSeasonalFood
  ? seasonalRecipes.filter((recipe) => {
      const normalize = (text) =>
        String(text || '').replace(/\s/g, '').toLowerCase();

      const foodName = normalize(selectedSeasonalFood.name);
      const recipeName = normalize(recipe.fdNm);
      const ingredients = normalize(recipe.ingredients);

      const searchText = recipeName + ingredients;

      if (foodName === '쌀') {
        const riceKeywords = [
          '쌀',
          '찹쌀',
          '멥쌀',
          '오색미',
          '현미',
          '흑미',
          '백미'
        ];

        return riceKeywords.some((keyword) =>
          searchText.includes(keyword)
        );
      }

      return searchText.includes(foodName);
    })
  : [];



const toNumber = (value) => {
  if (value == null || String(value).trim() === '') {
    return null;
  }

  const number = Number(String(value).replace(/,/g, ''));

  return Number.isFinite(number) ? number : null;
};

const sortedSeasonalRecipes = matchingSeasonalRecipes
  .filter((recipe) => {
    const search = seasonalKeyword.trim().toLowerCase();

    const name = (recipe.fdNm || '').toLowerCase();
    const ingredients = (recipe.ingredients || '').toLowerCase();
    const kcal = toNumber(recipe.calories);

    const matchesSearch =
      name.includes(search) || ingredients.includes(search);

    const matchesMin =
      seasonalMinCalorie === '' ||
      (kcal !== null && kcal >= Number(seasonalMinCalorie));

    const matchesMax =
      seasonalMaxCalorie === '' ||
      (kcal !== null && kcal <= Number(seasonalMaxCalorie));

    return matchesSearch && matchesMin && matchesMax;
  })
  .sort((a, b) => {
    const sortOptions = {
      calorieLow: ['calories', 1],
      calorieHigh: ['calories', -1],
      proteinLow: ['protein', 1],
      proteinHigh: ['protein', -1],
      carbLow: ['carbohydrate', 1],
      carbHigh: ['carbohydrate', -1]
    };

    const option = sortOptions[seasonalSort];

    if (!option) return 0;

    const [field, direction] = option;

    const valueA = toNumber(a[field]);
    const valueB = toNumber(b[field]);

    if (valueA === null) return valueB === null ? 0 : 1;
    if (valueB === null) return -1;

    return (valueA - valueB) * direction;
  });



const seasonalPageSize = 5;

const seasonalTotalPages = Math.max(
  1,
  Math.ceil(sortedSeasonalRecipes.length / seasonalPageSize)
);

const visibleSeasonalRecipes = sortedSeasonalRecipes.slice(
  (seasonalResultPage - 1) * seasonalPageSize,
  seasonalResultPage * seasonalPageSize
);



const seasonalImages = selectedSeasonalRecipe
  ? getSeasonalImages(selectedSeasonalRecipe)
  : { main: '', ingredient: '', steps: [] };  

const cookingSteps = String(selectedSeasonalRecipe?.method || '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/([①-⑳])/g, '\n$1')
  .replace(/(^|\s)(\d{1,2}[.)])(?=\s|[가-힣])/g, '\n$2')
  .split('\n')
  .map((step) => step.trim())
  .filter(Boolean);



const resetSeasonalFilters = () => {
  setSeasonalResultPage(1);
  setSeasonalSearchInput('');
  setSeasonalKeyword('');
  setSeasonalMinCalorie('');
  setSeasonalMaxCalorie('');
  setSeasonalSort('default');
};




  const activePage = page === 'detail' ? 'custom' : page === 'seasonal-detail' ? 'seasonal' : page;
  const pageStyle = activePage === 'custom' ? 'search' : activePage;
  const customRangeValid = validCalorieRange(minCalorie, maxCalorie);
  const seasonalRangeValid = validCalorieRange(seasonalMinCalorie, seasonalMaxCalorie);

  function navigate(target) {
    if (target === 'seasonal' && activePage !== 'seasonal') {
      setSeasonalMonth(new Date().getMonth() + 1);
      setSelectedSeasonalFood(null);
      resetSeasonalFilters();
    }
    setPage(target);
  }

  function chooseFood(food) {
    setSelectedSeasonalFood(food);
    resetSeasonalFilters();
  }

  return (
    <div className={'food-app food-page--' + pageStyle}>
      <header className="food-header">
        <div className="food-topbar">
          <button className="food-brand" type="button" onClick={() => navigate('home')} aria-label="오늘의 레시피 찾기 홈"><Icon name="chef" size={43} /><span>오늘의 레시피 찾기</span></button>
          <nav aria-label="주 메뉴">
            <button type="button" aria-current={activePage === 'home' ? 'page' : undefined} onClick={() => navigate('home')}>홈</button>
            <button type="button" aria-current={activePage === 'custom' ? 'page' : undefined} onClick={() => navigate('custom')}>레시피 둘러보기</button>
            <button type="button" aria-current={activePage === 'seasonal' ? 'page' : undefined} onClick={() => navigate('seasonal')}>제철음식</button>
            <button className="food-favorites-link" type="button" aria-current={activePage === 'favorites' ? 'page' : undefined} onClick={() => navigate('favorites')} aria-label={'찜한 레시피 ' + favorites.length + '개'}><Icon name="heart" size={20} /><span>찜한 레시피</span><span className="food-favorites-count" aria-hidden="true">{favorites.length}</span></button>
          </nav>
          <button className="food-header-search" type="button" onClick={() => navigate('custom')} aria-label="레시피 검색"><Icon name="search" size={24} /></button>
        </div>
      </header>
      <div className="food-page-body">
        <FoodArtwork seasonal={activePage === 'seasonal'} />
        <main className="food-main">
          {favoritesError && <div className="food-error food-favorites-error" role="alert"><p>{favoritesError}</p><button className="food-quiet" type="button" onClick={dismissError}>확인</button></div>}
          {page === 'home' && <Home onNavigate={navigate} />}

          {page === 'custom' && <div className="food-search-page">
            <section className="food-hero" aria-labelledby="search-title">
              <TitleOrnament /><h1 id="search-title">맞춤 <em>레시피 검색</em></h1>
              <p className="food-lead">원하는 재료, 칼로리, 요리 종류로 나에게 딱 맞는 레시피를 찾아보세요!</p>
              <SearchForm id="general-keyword" value={searchInput} onChange={setSearchInput} onSearch={() => setKeyword(searchInput)} />
            </section>
            <RecipeFilters min={minCalorie} max={maxCalorie} onMin={setMinCalorie} onMax={setMaxCalorie} sort={sortBy} onSort={setSortBy} foodType={foodType} onFoodType={setFoodType} cookingMethod={cookingMethod} onCookingMethod={setCookingMethod} />
            <section className="food-results" aria-labelledby="general-results-title" aria-busy={recipesLoading}>
              <div className="food-section-heading"><h2 id="general-results-title">{keyword ? '‘' + keyword + '’ 검색 결과' : '레시피 검색 결과'} <strong>{!recipesLoading && !error ? sortedRecipes.length + '건' : ''}</strong></h2><button className="food-quiet" type="button" onClick={resetCustomFilters}><Icon name="refresh" size={16} />조건 초기화</button></div>
              {recipesLoading && <p className="food-status" role="status">맛있는 레시피를 불러오고 있어요.</p>}
              {error && <p className="food-error" role="alert">{error}</p>}
              {!customRangeValid && <p className="food-error" role="alert">최소·최대 칼로리를 올바르게 입력해 주세요.</p>}
              {!recipesLoading && !error && customRangeValid && <>
                <div className="food-grid">{visibleRecipes.map((recipe) => <RecipeCard key={recipe.RCP_SEQ} recipe={foodCard(recipe)} formatNumber={showNumber} isFavorite={isFavorite('food', recipe.RCP_SEQ)} onToggleFavorite={() => toggleFavorite('food', foodCard(recipe))} onOpen={() => { setSelectedRecipe(recipe); setPage('detail'); }} />)}</div>
                {sortedRecipes.length === 0 && <p className="food-empty">조건에 맞는 레시피가 없어요. 검색어나 필터를 바꿔보세요.</p>}
                {sortedRecipes.length > 0 && <Pagination page={resultPage} total={totalPages} onChange={setResultPage} />}
                <p className="food-source">식품의약품안전처 조리식품의 레시피 DB · 불러온 레시피 {recipes.length}개 · 영양정보는 원자료 기준입니다.</p>
              </>}
            </section>
          </div>}

          {page === 'seasonal' && <div className="food-seasonal-page">
            <section className="food-hero food-seasonal-hero" aria-labelledby="seasonal-title">
              <TitleOrnament /><h1 id="seasonal-title">제철음식 <em>레시피 검색</em></h1>
              <p className="food-lead">지금 가장 맛있는 제철 재료로 건강하고 맛있는 요리를 만나보세요!</p>
            </section>
            <section className="food-month-banner" aria-label={seasonalMonth + '월 제철 식재료'} aria-busy={seasonalFoodsLoading}>
              <div className="food-month-intro">
                <h2><Icon name="calendar" size={34} />{seasonalMonth}월 제철음식</h2><p>이달의 신선한 재료로<br />오늘의 식탁을 채워보세요.</p>
                {!selectedSeasonalFood && <div className="food-month-controls">
                  <button type="button" className="food-quiet" aria-label="이전 달" onClick={() => setSeasonalMonth((month) => month === 1 ? 12 : month - 1)}><span className="food-back-arrow"><Icon name="arrow" size={15} /></span></button>
                  <label className="sr-only" htmlFor="seasonal-month">제철음식 조회 월</label><select id="seasonal-month" value={seasonalMonth} onChange={(event) => setSeasonalMonth(Number(event.target.value))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{month}월</option>)}</select>
                  <button type="button" className="food-quiet" aria-label="다음 달" onClick={() => setSeasonalMonth((month) => month === 12 ? 1 : month + 1)}><Icon name="arrow" size={15} /></button>
                </div>}
                <span className="food-calendar-chip">농사로 · 2019년 월별 자료</span>
              </div>
              {seasonalFoodsLoading ? <p className="food-month-previews-empty" role="status">제철 식재료를 불러오고 있어요.</p> : seasonalFoods.length > 0 ? <div className="food-month-previews">
                {seasonalFoods.map((food) => <button key={food.id} type="button" className={selectedSeasonalFood?.id === food.id ? 'food-month-preview is-active' : 'food-month-preview'} aria-pressed={selectedSeasonalFood?.id === food.id} onClick={() => chooseFood(food)}><div><Icon name="vegetables" size={38} />{food.image && <img src={food.image} alt="" onError={(event) => { event.currentTarget.style.display = 'none'; }} />}</div><span>{food.name}<small>제철 식재료</small></span></button>)}
              </div> : <p className="food-month-previews-empty">이달의 식재료 정보가 없습니다.</p>}
            </section>
            {seasonalError && <p className="food-error" role="alert">{seasonalError}</p>}
            {!selectedSeasonalFood && !seasonalFoodsLoading && seasonalFoods.length > 0 && <div className="food-seasonal-choices-note"><p className="food-lead">원하는 제철 식재료를 선택하세요.</p><p className="food-help">식재료를 누르면 해당 재료로 만들 수 있는 레시피가 나타나요.</p></div>}
            {selectedSeasonalFood && <>
              <div className="food-section-heading food-seasonal-results-heading"><h2><Icon name="leaf" size={26} />{selectedSeasonalFood.name} 관련 레시피</h2><button className="food-quiet" type="button" onClick={() => { setSelectedSeasonalFood(null); resetSeasonalFilters(); }}>식재료 선택으로 돌아가기</button></div>
              <SearchForm id="seasonal-keyword" value={seasonalSearchInput} onChange={setSeasonalSearchInput} onSearch={() => setSeasonalKeyword(seasonalSearchInput)} placeholder="음식명 또는 재료 검색" />
              <RecipeFilters min={seasonalMinCalorie} max={seasonalMaxCalorie} onMin={setSeasonalMinCalorie} onMax={setSeasonalMaxCalorie} sort={seasonalSort} onSort={setSeasonalSort} />
              <section className="food-results" aria-labelledby="seasonal-results-title" aria-busy={seasonalRecipesLoading}>
                <div className="food-section-heading"><h2 id="seasonal-results-title">검색 결과 <strong>{!seasonalRecipesLoading ? sortedSeasonalRecipes.length + '건' : ''}</strong></h2><button className="food-quiet" type="button" onClick={resetSeasonalFilters}><Icon name="refresh" size={16} />조건 초기화</button></div>
                {seasonalRecipesLoading && <p className="food-status" role="status">제철 레시피를 불러오고 있어요.</p>}
                {!seasonalRangeValid && <p className="food-error" role="alert">최소·최대 칼로리를 올바르게 입력해 주세요.</p>}
                {!seasonalRecipesLoading && seasonalRangeValid && <>
                  <div className="food-grid">{visibleSeasonalRecipes.map((recipe) => <RecipeCard key={recipe.cntntsNo} recipe={seasonalCard(recipe)} formatNumber={showNumber} seasonal savedMonth={seasonalMonth} isFavorite={isFavorite('seasonal', recipe.cntntsNo)} onToggleFavorite={() => toggleFavorite('seasonal', seasonalCard(recipe), { month: seasonalMonth })} onOpen={() => { setSelectedSeasonalRecipe(recipe); setPage('seasonal-detail'); }} />)}</div>
                  {sortedSeasonalRecipes.length > 0 ? <Pagination page={seasonalResultPage} total={seasonalTotalPages} onChange={setSeasonalResultPage} /> : <p className="food-empty">일치하는 레시피가 없습니다.</p>}
                </>}
              </section>
            </>}
            <p className="food-source">농촌진흥청 농사로 · 2019년 {seasonalMonth}월 제철음식 자료 · 영양정보는 원자료 기준입니다.</p>
          </div>}

          {page === 'detail' && selectedRecipe && <RecipeDetails
            recipe={foodCard(selectedRecipe)} fat={selectedRecipe.INFO_FAT}
            steps={Array.from({ length: 20 }, (_, index) => { const number = String(index + 1).padStart(2, '0'); return { text: selectedRecipe['MANUAL' + number], image: selectedRecipe['MANUAL_IMG' + number] }; }).filter((step) => step.text?.trim())}
            onBack={() => setPage('custom')} isFavorite={isFavorite('food', selectedRecipe.RCP_SEQ)} onToggleFavorite={() => toggleFavorite('food', foodCard(selectedRecipe))}
          />}
          {page === 'seasonal-detail' && selectedSeasonalRecipe && <RecipeDetails
            recipe={seasonalCard(selectedSeasonalRecipe)} fat={selectedSeasonalRecipe.fat} seasonal ingredientImage={seasonalImages.ingredient}
            steps={cookingSteps.map((text, index) => ({ text, image: seasonalImages.steps[index]?.url }))}
            onBack={() => setPage('seasonal')} isFavorite={isFavorite('seasonal', selectedSeasonalRecipe.cntntsNo)} onToggleFavorite={() => toggleFavorite('seasonal', seasonalCard(selectedSeasonalRecipe), { month: seasonalMonth })}
          />}
          {page === 'favorites' && <Favorites favorites={favorites} onToggleFavorite={toggleFavorite} onBrowse={() => navigate('custom')} />}
        </main>
        <div className="food-bottom-waves" aria-hidden="true"><span /><span /></div>
      </div>
      <footer className="food-footer"><button className="food-footer-brand" type="button" onClick={() => navigate('home')}><Icon name="chef" size={20} />오늘의 레시피 찾기</button><span>공공데이터로 만나는 맛있는 한 끼</span></footer>
    </div>
  );
}

export default App;
