export const FAVORITES_STORAGE_KEY = "oneul-recipe:favorites:v1";

const SOURCES = new Set(["food", "seasonal"]);

export function getFavoriteKey(source, id) {
  if (!SOURCES.has(source)) return null;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof id === "number" && !Number.isFinite(id)) return null;
  const value = String(id).trim();
  return value ? source + ":" + value : null;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validMonth(value) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function recipeSnapshot(recipe) {
  return {
    id: String(recipe.id).trim(),
    name: text(recipe.name) || "이름 정보 없음",
    ingredients: text(recipe.ingredients),
    category: text(recipe.category),
    method: text(recipe.method),
    foodGroup: text(recipe.foodGroup),
    calories: numberOrNull(recipe.calories),
    protein: numberOrNull(recipe.protein),
    carbs: numberOrNull(recipe.carbs),
    image: text(recipe.image),
    serving: text(recipe.serving),
    sourceYears: Array.isArray(recipe.sourceYears)
      ? recipe.sourceYears.filter((year) => /^\d{4}$/.test(String(year))).map(String)
      : [],
  };
}

// Store a copy of the visible card, rather than depending on a future API result.
export function toggleFavoriteList(favorites, source, recipe, metadata = {}, savedAt = new Date().toISOString()) {
  const key = getFavoriteKey(source, recipe?.id);
  if (!key) throw new Error("레시피 번호가 없어 즐겨찾기에 저장할 수 없습니다.");
  if (favorites.some((favorite) => favorite.key === key)) {
    return favorites.filter((favorite) => favorite.key !== key);
  }

  const sourceMonth = source === "seasonal" ? validMonth(metadata.month) : null;
  if (source === "seasonal" && sourceMonth === null) {
    throw new Error("제철 자료의 월 정보를 확인하지 못해 저장할 수 없습니다.");
  }
  const time = new Date(savedAt);
  if (!Number.isFinite(time.getTime())) throw new Error("저장 시각을 확인하지 못했습니다.");

  return [{
    key,
    source,
    sourceMonth,
    savedAt: time.toISOString(),
    recipe: recipeSnapshot(recipe),
  }, ...favorites];
}

export function parseFavorites(serialized) {
  if (serialized === null) return { favorites: [], error: "" };
  try {
    const data = JSON.parse(serialized);
    if (data?.version !== 1 || !Array.isArray(data.items)) throw new Error("Invalid storage format");

    const byKey = new Map();
    for (const item of data.items) {
      if (!item || typeof item !== "object" || !item.recipe || typeof item.recipe !== "object") continue;
      const key = getFavoriteKey(item.source, item.recipe.id);
      const time = typeof item.savedAt === "string" ? new Date(item.savedAt) : null;
      const sourceMonth = item.source === "seasonal" ? validMonth(item.sourceMonth) : null;
      if (!key || !time || !Number.isFinite(time.getTime())) continue;
      if (item.source === "seasonal" && sourceMonth === null) continue;

      const favorite = {
        key,
        source: item.source,
        sourceMonth,
        savedAt: time.toISOString(),
        recipe: recipeSnapshot(item.recipe),
      };
      const previous = byKey.get(key);
      if (!previous || favorite.savedAt > previous.savedAt) byKey.set(key, favorite);
    }

    return {
      favorites: [...byKey.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
      error: "",
    };
  } catch {
    return {
      favorites: [],
      error: "저장된 즐겨찾기를 읽지 못했습니다. 브라우저의 사이트 저장 데이터를 확인해 주세요. 기존 데이터는 덮어쓰지 않았습니다.",
    };
  }
}

export function readFavorites(storage) {
  try {
    return parseFavorites(storage.getItem(FAVORITES_STORAGE_KEY));
  } catch {
    return {
      favorites: [],
      error: "브라우저 저장 공간에 접근할 수 없습니다. 사이트 저장 허용 설정을 확인해 주세요.",
    };
  }
}

export function writeFavorites(storage, favorites) {
  storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify({ version: 1, items: favorites }));
}
