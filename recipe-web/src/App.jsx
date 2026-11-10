import { useState, useEffect } from 'react';


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

  setSeasonalFoods([]);
  setSeasonalRecipes([]);
  setSelectedSeasonalFood(null);
  setSeasonalError('');

  fetch(`http://localhost:3001/api/seasonal?month=${seasonalMonth}`)
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


fetch(`http://localhost:3001/api/seasonal/recipes?month=${seasonalMonth}`)
  .then((response) => {
    if (!response.ok) {
      throw new Error('제철 레시피 조회 실패');
    }

    return response.json();
  })
  .then(async (data) => {
    const foodRecipes = data.recipes.filter(
      (recipe) => recipe.fdSeCode === '290001'
    );


const detailedRecipes = await Promise.all(
  foodRecipes.map(async (recipe) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/seasonal/recipes/${recipe.cntntsNo}`
      );

      if (!response.ok) {
        throw new Error('상세정보 조회 실패');
      }

      const detail = await response.json();



return {
  ...recipe,
  ingredients: detail.ingredients || '',
  method: detail.method || '',
  calories: detail.calories,
  protein: detail.protein,
  carbohydrate: detail.carbohydrate,
  fat: detail.fat
};



    } catch (error) {
      console.error(`${recipe.fdNm} 조회 실패:`, error);

      return {
        ...recipe,
        ingredients: ''
      };
    }
  })
);

console.table(
  detailedRecipes.map((recipe) => ({
    음식: recipe.fdNm,
    재료: recipe.ingredients
  }))
);


    setSeasonalRecipes(detailedRecipes);
  })
  .catch((err) => {
    setSeasonalError(err.message);
  });

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



return (
  
  <div>
    {page === 'home' && (
      <div>
        <h1>레시피 검색 웹사이트</h1>

        <button onClick={() => setPage('custom')}>
          맞춤 레시피 검색
        </button>

        
<button
  onClick={() => {
    setSeasonalMonth(new Date().getMonth() + 1);
    setSelectedSeasonalFood(null);
    resetSeasonalFilters();
    setPage('seasonal');
  }}
>
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



<div style={{ marginTop: '25px' }}>
  <button type="button" onClick={resetCustomFilters}>
    검색 조건 초기화
  </button>
</div>




    <hr />

    
  <h3>레시피 검색 결과</h3>

  <p>불러온 레시피: {recipes.length}개</p>
  <p>검색 결과: {sortedRecipes.length}개</p>

  {error && <p>{error}</p>}

  


<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  }}
>
  {visibleRecipes.map((recipe) => (
    <button
      key={recipe.RCP_SEQ}
      type="button"
      onClick={() => {
        setSelectedRecipe(recipe);
        setPage('detail');
      }}
      style={{
        padding: 0,
        textAlign: 'left',
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
    >
      {recipe.ATT_FILE_NO_MAIN ? (
        <img
          src={recipe.ATT_FILE_NO_MAIN}
          alt={recipe.RCP_NM}
          style={{
            width: '100%',
            height: '160px',
            objectFit: 'cover'
          }}
        />
      ) : (
        <div style={{ height: '160px', backgroundColor: '#eee' }}>
          사진 없음
        </div>
      )}

      <div style={{ padding: '12px' }}>
        <span
          style={{
            backgroundColor: '#eef5ea',
            padding: '4px 8px',
            borderRadius: '5px',
            fontSize: '12px'
          }}
        >
          {recipe.RCP_PAT2 || '기타'}
        </span>

        <h3>{recipe.RCP_NM}</h3>

        <p>{recipe.INFO_ENG || '-'} kcal</p>

        <p style={{ fontSize: '13px', color: '#666' }}>
          단백질 {recipe.INFO_PRO || '-'}g
          {' / '}
          탄수화물 {recipe.INFO_CAR || '-'}g
        </p>
      </div>
    </button>
  ))}
</div>


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

<h3>음식 사진</h3>

{selectedRecipe.ATT_FILE_NO_MAIN ? (
  <img
    src={selectedRecipe.ATT_FILE_NO_MAIN}
    alt={selectedRecipe.RCP_NM}
    width="300"
  />
) : (
  <p>대표 사진이 없습니다.</p>
)}


    <h3>영양정보</h3>

    <p>칼로리: {selectedRecipe.INFO_ENG} kcal</p>
    <p>단백질: {selectedRecipe.INFO_PRO}g</p>
    <p>탄수화물: {selectedRecipe.INFO_CAR}g</p>

<p>지방: {selectedRecipe.INFO_FAT}g</p>

<hr />

<h3>재료</h3>






<p style={{ whiteSpace: 'pre-wrap' }}>
  {selectedRecipe.RCP_PARTS_DTLS}
</p>

<hr />

<h3>조리 방법</h3>


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
            
<p>
  {step.text.replace(/^\s*(\d{1,2}[.)]|[①-⑳])\s*/, '')}
</p>


            {step.image && (
              <img
                src={step.image}
                alt={`조리 과정 ${index + 1}`}
                width="200"
              />
            )}
            <hr />
          </li>
        ))}
    </ol>
  </div>
)}



{page === 'seasonal-detail' && selectedSeasonalRecipe && (
  <div>
    <h1>제철음식 레시피 상세보기</h1>

    <button onClick={() => setPage('seasonal')}>
      검색 결과로 돌아가기
    </button>

    <hr />

    <h2>{selectedSeasonalRecipe.fdNm}</h2>


<h3>음식 사진</h3>

{seasonalImages.main ? (
  <img
    src={seasonalImages.main}
    alt={selectedSeasonalRecipe.fdNm}
    width="300"
  />
) : (
  <p>대표 사진이 없습니다.</p>
)}


    <h3>영양정보</h3>

    <p>
      칼로리: {selectedSeasonalRecipe.calories ?? '-'} kcal
    </p>

    <p>
      단백질: {selectedSeasonalRecipe.protein ?? '-'}g
    </p>

    <p>
      탄수화물: {selectedSeasonalRecipe.carbohydrate ?? '-'}g
    </p>

    <p>
      지방: {selectedSeasonalRecipe.fat ?? '-'}g
    </p>

    <hr />

    <h3>재료</h3>

    {seasonalImages.ingredient && (
  <img
    src={seasonalImages.ingredient}
    alt="요리 재료 사진"
    width="300"
  />
)}

    <p style={{ whiteSpace: 'pre-wrap' }}>
      {selectedSeasonalRecipe.ingredients || '재료 정보가 없습니다.'}
    </p>

    <hr />

    <h3>조리 방법</h3>

    <p style={{ whiteSpace: 'pre-wrap' }}>
      {selectedSeasonalRecipe.method || '조리 방법 정보가 없습니다.'}
    </p>


<hr />


<h3>조리 방법</h3>

{cookingSteps.length > 0 ? (
  <ol>
    {cookingSteps.map((step, index) => (
      <li key={index}>
              
      <p>
        {step.replace(/^(\d{1,2}[.)]|[①-⑳])\s*/, '')}
      </p>


        {seasonalImages.steps[index] && (
          <img
            src={seasonalImages.steps[index].url}
            alt={`조리 방법 ${index + 1}`}
            width="300"
          />
        )}

        <hr />
      </li>
    ))}
  </ol>
) : (
  <p>조리 방법 정보가 없습니다.</p>
)}


  </div>
)}



{page === 'seasonal' && (
  <div>
    <h1>제철음식 레시피 검색</h1>

    <button onClick={() => setPage('home')}>
      홈으로
    </button>

    <hr />

    
<h3>{seasonalMonth}월 제철음식 (2019년 자료)</h3>

{!selectedSeasonalFood && (

<div style={{ marginBottom: '20px' }}>
  <button
    type="button"
    onClick={() =>
      setSeasonalMonth((month) => month === 1 ? 12 : month - 1)
    }
  >
    이전 달
  </button>

  <select
    value={seasonalMonth}
    onChange={(e) => setSeasonalMonth(Number(e.target.value))}
  >
    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
      <option key={month} value={month}>
        {month}월
      </option>
    ))}
  </select>

  <button
    type="button"
    onClick={() =>
      setSeasonalMonth((month) => month === 12 ? 1 : month + 1)
    }
  >
    다음 달
  </button>
</div>

)}

    {seasonalError && <p>{seasonalError}</p>}


{!selectedSeasonalFood && (
  <div>
    <p>원하는 제철 식재료를 선택하세요.</p>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px',
        maxWidth: '750px',
        marginTop: '20px'
      }}
    >
      {seasonalFoods.map((food) => (
        <button
          key={food.id}
          type="button"
          onClick={() => {
            setSelectedSeasonalFood(food);
            resetSeasonalFilters();
          }}
          style={{
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            backgroundColor: 'white',
            cursor: 'pointer'
          }}
        >
          {food.image ? (
            <img
              src={food.image}
              alt={food.name}
              style={{
                width: '100%',
                height: '180px',
                objectFit: 'cover',
                borderRadius: '8px'
              }}
            />
          ) : (
            <div style={{ padding: '60px 0' }}>
              사진 없음
            </div>
          )}

          <h3>{food.name}</h3>
        </button>
      ))}
    </div>
  </div>
)}


    {selectedSeasonalFood && (
      <div>

<button
  type="button"
  onClick={() => {
    setSelectedSeasonalFood(null);
    resetSeasonalFilters();
  }}
>
  식재료 선택으로 돌아가기
</button>

        <hr />

        <h3>{selectedSeasonalFood.name} 관련 레시피</h3>



<h3>음식 검색</h3>

<form onSubmit={(e) => {
  e.preventDefault();
  setSeasonalKeyword(seasonalSearchInput);
}}>
  <input
    type="text"
    placeholder="음식명 또는 재료 검색"
    value={seasonalSearchInput}
    onChange={(e) => setSeasonalSearchInput(e.target.value)}
  />
  <button type="submit">검색</button>
</form>

<h3>칼로리 조건</h3>

<input
  type="number"
  min="0"
  placeholder="최소 kcal"
  value={seasonalMinCalorie}
  onChange={(e) => setSeasonalMinCalorie(e.target.value)}
/>

<span> ~ </span>

<input
  type="number"
  min="0"
  placeholder="최대 kcal"
  value={seasonalMaxCalorie}
  onChange={(e) => setSeasonalMaxCalorie(e.target.value)}
/>

<h3>정렬 기준</h3>

<select
  value={seasonalSort}
  onChange={(e) => setSeasonalSort(e.target.value)}
>
  <option value="default">기본순</option>
  <option value="calorieLow">칼로리 낮은순</option>
  <option value="calorieHigh">칼로리 높은순</option>
  <option value="proteinLow">단백질 낮은순</option>
  <option value="proteinHigh">단백질 높은순</option>
  <option value="carbLow">탄수화물 낮은순</option>
  <option value="carbHigh">탄수화물 높은순</option>
</select>


<div style={{ marginTop: '25px' }}>
  <button type="button" onClick={resetSeasonalFilters}>
    검색 조건 초기화
  </button>
</div>



<hr />



        <p>
          검색 결과: {sortedSeasonalRecipes.length}개
        </p>




<div
  style={{
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    marginTop: '20px'
  }}
>
  {visibleSeasonalRecipes.map((recipe) => {
    const image = getSeasonalImages(recipe).main;

    return (
      <button
        key={recipe.cntntsNo}
        type="button"
        onClick={() => {
          setSelectedSeasonalRecipe(recipe);
          setPage('seasonal-detail');
        }}
        style={{
          padding: 0,
          textAlign: 'left',
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderRadius: '12px',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        {image ? (
          <img
            src={image}
            alt={recipe.fdNm}
            style={{
              width: '100%',
              height: '160px',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{ height: '160px', backgroundColor: '#eee' }}>
            사진 없음
          </div>
        )}

        <div style={{ padding: '12px' }}>
          <span
            style={{
              backgroundColor: '#eef5ea',
              padding: '4px 8px',
              borderRadius: '5px',
              fontSize: '12px'
            }}
          >
            제철 레시피
          </span>

          <h3>{recipe.fdNm}</h3>

          <p>{recipe.calories ?? '-'} kcal</p>

          <p style={{ fontSize: '13px', color: '#666' }}>
            단백질 {recipe.protein ?? '-'}g
            {' / '}
            탄수화물 {recipe.carbohydrate ?? '-'}g
          </p>
        </div>
      </button>
    );
  })}
</div>




{sortedSeasonalRecipes.length > 0 && (
  <div>
    <button
      type="button"
      disabled={seasonalResultPage === 1}
      onClick={() => setSeasonalResultPage(seasonalResultPage - 1)}
    >
      이전
    </button>

    <span>
      {' '}{seasonalResultPage} / {seasonalTotalPages}{' '}
    </span>

    <button
      type="button"
      disabled={seasonalResultPage === seasonalTotalPages}
      onClick={() => setSeasonalResultPage(seasonalResultPage + 1)}
    >
      다음
    </button>
  </div>
)}



        {sortedSeasonalRecipes.length === 0 && (
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
