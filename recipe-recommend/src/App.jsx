
import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("전체");
  const [minCal, setMinCal] = useState("0");
  const [maxCal, setMaxCal] = useState("500");
  const [sortBy, setSortBy] = useState("recommended");

  useEffect(() => {
    async function fetchRecipes() {
      try {
        const response = await fetch(
          "http://localhost:3001/api/recipes"
        );

        if (!response.ok) {
          throw new Error("레시피 요청 실패");
        }

        const data = await response.json();
        setRecipes(data);
      } catch (err) {
        setError("레시피를 불러오지 못했습니다.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchRecipes();
  }, []);

  const validCalorieRange =
  minCal.trim() !== "" &&
  maxCal.trim() !== "" &&
  Number(minCal) >= 0 &&
  Number(maxCal) >= Number(minCal);

const filteredRecipes = !validCalorieRange
  ? []
  : recipes.filter((recipe) => {
  const matchesIngredient = (recipe.ingredients || "")
    .toLowerCase()
    .includes(search.trim().toLowerCase());

  let matchesCategory = false;

  if (category === "전체") {
    matchesCategory = true;
  } else if (category === "국") {
    matchesCategory =
      (recipe.category || "").includes("국") ||
      (recipe.name || "").includes("국") ||
      (recipe.name || "").includes("탕");
  } else if (category === "조림") {
    matchesCategory =
      (recipe.name || "").includes("조림");
  } else if (category === "볶음") {
    matchesCategory =
      (recipe.name || "").includes("볶음") ||
      (recipe.method || "").includes("볶기");
  }

  const calories = Number(recipe.calories);

  const matchesCalories =
    recipe.calories !== null &&
    recipe.calories !== undefined &&
    recipe.calories !== "" &&
    Number.isFinite(calories) &&
    calories >= Number(minCal) &&
    calories <= Number(maxCal);

  return (
    matchesIngredient &&
    matchesCategory &&
    matchesCalories
  );
});


const sortedRecipes = [...filteredRecipes].sort((a, b) => {
  if (sortBy === "calories") {
    return a.calories - b.calories;
  }

  if (sortBy === "protein") {
    return b.protein - a.protein;
  }

  if (sortBy === "carbs") {
    return b.carbs - a.carbs;
  }

  // 추천순: 현재는 API에서 받은 기존 순서 유지
  return 0;
});


  return (
    <div className="container">
      <h1>🍳 오늘 뭐 먹지?</h1>
      <p>원하는 재료를 입력해 레시피를 찾아보세요.</p>

      <input
        className="search-input"
        type="text"
        placeholder="예: 소고기, 감자, 두부"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      
<div className="category-filter">
  <p>음식 종류 선택</p>

  <div className="category-buttons">
    {["전체", "국", "조림", "볶음"].map((item) => (
      <button
        key={item}
        type="button"
        className={category === item ? "active" : ""}
        onClick={() => setCategory(item)}
      >
        {item}
      </button>
    ))}
  </div>
</div>

<div className="calorie-filter">
  <p>칼로리 범위 설정 (kcal)</p>

  <div className="calorie-inputs">
    <div>
      <label htmlFor="min-cal">최소 칼로리</label>
      <input
        id="min-cal"
        type="number"
        min="0"
        value={minCal}
        onChange={(e) => setMinCal(e.target.value)}
      />
    </div>

    <span>~</span>

    <div>
      <label htmlFor="max-cal">최대 칼로리</label>
      <input
        id="max-cal"
        type="number"
        min="0"
        value={maxCal}
        onChange={(e) => setMaxCal(e.target.value)}
      />
    </div>
  </div>
</div>


<div className="sort-filter">
  <label htmlFor="sort-select">정렬 기준</label>

  <select
    id="sort-select"
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value)}
  >
    <option value="recommended">추천순</option>
    <option value="calories">낮은 칼로리순</option>
    <option value="protein">높은 단백질순</option>
    <option value="carbs">높은 탄수화물순</option>
  </select>
</div>


{!validCalorieRange && (
  <p className="error">
    최소·최대 칼로리를 올바르게 입력해 주세요.
  </p>
)}

      {loading && <p>레시피를 불러오는 중...</p>}

      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <>
          <p>검색 결과: {filteredRecipes.length}개</p>

          {filteredRecipes.length === 0 && (
            <p>검색 결과가 없습니다.</p>
          )}

          <div className="recipe-grid">
            {sortedRecipes.map((recipe) => (
              <div className="recipe-card" key={recipe.id}>
                {recipe.image && (
                  <img
                    src={recipe.image}
                    alt={recipe.name}
                  />
                )}

                <h2>{recipe.name}</h2>
                <p>🔥 {recipe.calories} kcal</p>
                <p>🥩 단백질: {recipe.protein} g</p>
                <p>🌾 탄수화물: {recipe.carbs} g</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
