import { useState, useEffect } from 'react';



function App() {
  const [page, setPage] = useState('home');
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



  const [seasonalFoods, setSeasonalFoods] = useState([]);
  const [selectedSeasonalFood, setSelectedSeasonalFood] = useState(null);
  const [seasonalRecipes, setSeasonalRecipes] = useState([]);
  const [seasonalError, setSeasonalError] = useState('');

    

useEffect(() => {
  fetch('http://localhost:3001/api/recipes')
    .then((response) => {
      if (!response.ok) {
        throw new Error('레시피 조회 실패');
      }
      return response.json();
    })
    .then((data) => {
      setRecipes(data);
    })
    .catch((err) => {
      setError(err.message);
    });
}, []);



useEffect(() => {
  fetch('http://localhost:3001/api/seasonal')
    .then((response) => {
      if (!response.ok) {
        throw new Error('제철 식재료 조회 실패');
      }
      return response.json();
    })
    .then((data) => {
      setSeasonalFoods(data);
    })
    .catch((err) => {
      setSeasonalError(err.message);
    });

  fetch('http://localhost:3001/api/seasonal/recipes')
    .then((response) => {
      if (!response.ok) {
        throw new Error('제철 레시피 조회 실패');
      }
      return response.json();
    })
    .then((data) => {
      const foodRecipes = data.recipes.filter(
        (recipe) => recipe.fdSeCode === '290001'
      );

      setSeasonalRecipes(foodRecipes);
    })
    .catch((err) => {
      setSeasonalError(err.message);
    });
}, []);



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
      const foodName = selectedSeasonalFood.name.replace(/\s/g, '');
      const recipeName = (recipe.fdNm || '').replace(/\s/g, '');

      return recipeName.includes(foodName);
    })
  : [];



return (
  
  <div>
    {page === 'home' && (
      <div>
        <h1>레시피 검색 웹사이트</h1>

        <button onClick={() => setPage('custom')}>
          맞춤 레시피 검색
        </button>

        <button onClick={() => setPage('seasonal')}>
          제철음식 레시피 검색
        </button>
      </div>
    )}

    
{page === 'custom' && (
  <div>
    <h1>맞춤 레시피 검색</h1>

    <button onClick={() => setPage('home')}>
      홈으로
    </button>

    <hr />

    
    <h3>음식 검색</h3>

    <form onSubmit={(e) => {
      e.preventDefault();
      setKeyword(searchInput);
    }}>
      <input
        type="text"
        placeholder="음식명 또는 재료를 입력하세요"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
      />
      <button type="submit">검색</button>
    </form>

    <h3>칼로리 조건</h3>
    
    <input
      type="number"
      min="0"
      placeholder="최소 kcal"
      value={minCalorie}
      onChange={(e) => setMinCalorie(e.target.value)}
    />

    <span> ~ </span>

    <input
      type="number"
      min="0"
      placeholder="최대 kcal"
      value={maxCalorie}
      onChange={(e) => setMaxCalorie(e.target.value)}
    />


    <h3>정렬 기준</h3>

    <select
      value={sortBy}
      onChange={(e) => setSortBy(e.target.value)}
    >
      <option value="default">기본순</option>
      <option value="calorieLow">칼로리 낮은순</option>
      <option value="calorieHigh">칼로리 높은순</option>
      <option value="proteinLow">단백질 낮은순</option>
      <option value="proteinHigh">단백질 높은순</option>
      <option value="carbLow">탄수화물 낮은순</option>
      <option value="carbHigh">탄수화물 높은순</option>
    </select>



    <h3>음식 종류</h3>

    {['전체', '국&찌개', '반찬', '밥', '일품', '후식', '기타'].map(
      (type) => (
        <button
          key={type}
          onClick={() => setFoodType(type)}
          style={{
            backgroundColor: foodType === type ? '#dddddd' : '',
            fontWeight: foodType === type ? 'bold' : 'normal'
          }}
        >
          {type}
        </button>
      )
    )}


    <h3>조리 방식</h3>

    {['전체', '끓이기', '굽기', '볶기', '찌기', '튀기기', '기타'].map(
      (method) => (
        <button
          key={method}
          onClick={() => setCookingMethod(method)}
          style={{
            backgroundColor: cookingMethod === method ? '#dddddd' : '',
            fontWeight: cookingMethod === method ? 'bold' : 'normal'
          }}
        >
          {method}
        </button>
      )
    )}


    <hr />

    
  <h3>레시피 검색 결과</h3>

  <p>불러온 레시피: {recipes.length}개</p>
  <p>검색 결과: {sortedRecipes.length}개</p>

  {error && <p>{error}</p>}

  

  <ul>
    {visibleRecipes.map((recipe) => (
      <li key={recipe.RCP_SEQ}>
        <button
          type="button"
          onClick={() => {
            setSelectedRecipe(recipe);
            setPage('detail');
          }}
        >
          {recipe.RCP_NM}
        </button>

        {' - '}
        {recipe.INFO_ENG} kcal
        {' / 단백질 '}
        {recipe.INFO_PRO}g
        {' / 탄수화물 '}
        {recipe.INFO_CAR}g
      </li>
    ))}
  </ul>

  {sortedRecipes.length === 0 && (
    <p>검색 결과가 없습니다.</p>
  )}

  <div>
    <button
      disabled={resultPage === 1}
      onClick={() => setResultPage(resultPage - 1)}
    >
      이전
    </button>

    <span>
      {' '}{resultPage} / {totalPages}{' '}
    </span>

    <button
      disabled={resultPage === totalPages}
      onClick={() => setResultPage(resultPage + 1)}
    >
      다음
    </button>
  </div>


  </div>
)}



{page === 'detail' && selectedRecipe && (
  <div>
    <h1>레시피 상세보기</h1>

    <button onClick={() => setPage('custom')}>
      검색 결과로 돌아가기
    </button>

    <hr />

    <h2>{selectedRecipe.RCP_NM}</h2>

    {selectedRecipe.ATT_FILE_NO_MAIN && (
      <img
        src={selectedRecipe.ATT_FILE_NO_MAIN}
        alt={selectedRecipe.RCP_NM}
        width="250"
      />
    )}

    <h3>영양정보</h3>

    <p>칼로리: {selectedRecipe.INFO_ENG} kcal</p>
    <p>단백질: {selectedRecipe.INFO_PRO}g</p>
    <p>탄수화물: {selectedRecipe.INFO_CAR}g</p>
    <p>지방: {selectedRecipe.INFO_FAT}g</p>

    <h3>재료</h3>

    <p style={{ whiteSpace: 'pre-wrap' }}>
      {selectedRecipe.RCP_PARTS_DTLS}
    </p>

    <h3>조리 순서</h3>

    <ol>
      {Array.from({ length: 20 }, (_, i) => {
        const number = String(i + 1).padStart(2, '0');

        return {
          text: selectedRecipe[`MANUAL${number}`],
          image: selectedRecipe[`MANUAL_IMG${number}`]
        };
      })
        .filter((step) => step.text?.trim())
        .map((step, index) => (
          <li key={index}>
            <p>{step.text}</p>

            {step.image && (
              <img
                src={step.image}
                alt={`조리 과정 ${index + 1}`}
                width="200"
              />
            )}
          </li>
        ))}
    </ol>
  </div>
)}



{page === 'seasonal' && (
  <div>
    <h1>제철음식 레시피 검색</h1>

    <button onClick={() => setPage('home')}>
      홈으로
    </button>

    <hr />

    <h3>11월 제철음식 (2016년 자료)</h3>

    {seasonalError && <p>{seasonalError}</p>}

    {seasonalFoods.map((food) => (
      <button
        key={food.id}
        onClick={() => setSelectedSeasonalFood(food)}
      >
        {food.name}
      </button>
    ))}

    {selectedSeasonalFood && (
      <div>
        <hr />

        <h3>{selectedSeasonalFood.name} 관련 레시피</h3>

        <p>
          검색 결과: {matchingSeasonalRecipes.length}개
        </p>

        <ul>
          {matchingSeasonalRecipes.map((recipe) => (
            <li key={recipe.cntntsNo}>
              {recipe.fdNm}
            </li>
          ))}
        </ul>

        {matchingSeasonalRecipes.length === 0 && (
          <p>일치하는 레시피가 없습니다.</p>
        )}
      </div>
    )}
  </div>
)}


  </div>
)
}

export default App;
