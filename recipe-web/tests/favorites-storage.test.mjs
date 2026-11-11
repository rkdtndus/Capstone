import assert from "node:assert/strict";
import test from "node:test";
import {
  FAVORITES_STORAGE_KEY,
  getFavoriteKey,
  parseFavorites,
  readFavorites,
  toggleFavoriteList,
  writeFavorites,
} from "../src/favoritesStorage.js";

const recipe = {
  id: "123",
  name: "두부국",
  ingredients: "두부, 배추",
  calories: 120,
  protein: null,
  carbs: 8,
  image: "https://example.com/recipe.jpg",
  sourceYears: ["2019", "2018"],
};

test("source and stable ID distinguish recipes; another click removes only the matching one", () => {
  let favorites = toggleFavoriteList([], "food", recipe);
  favorites = toggleFavoriteList(favorites, "seasonal", recipe, { month: 11 });
  assert.deepEqual(favorites.map((item) => item.key), ["seasonal:123", "food:123"]);
  favorites = toggleFavoriteList(favorites, "food", { ...recipe, id: 123, name: "바뀐 이름" });
  assert.deepEqual(favorites.map((item) => item.key), ["seasonal:123"]);
  assert.equal(getFavoriteKey("food", " 123 "), "food:123");
  assert.equal(getFavoriteKey("food", ""), null);
  assert.equal(getFavoriteKey("unknown", 123), null);
  assert.equal(getFavoriteKey("food", {}), null);
});

test("the saved snapshot survives a reload and retains seasonal month and missing nutrition", () => {
  const favorites = toggleFavoriteList([], "seasonal", recipe, { month: 11 }, "2026-11-11T00:00:00Z");
  recipe.name = "API에서 변경된 이름";
  assert.equal(favorites[0].recipe.name, "두부국");
  recipe.name = "두부국";
  const storage = new Map();
  writeFavorites({ setItem: (key, value) => storage.set(key, value) }, favorites);
  const loaded = readFavorites({ getItem: (key) => storage.get(key) });
  assert.equal(loaded.error, "");
  assert.equal(loaded.favorites[0].sourceMonth, 11);
  assert.equal(loaded.favorites[0].recipe.protein, null);
  assert.deepEqual(loaded.favorites[0].recipe.sourceYears, ["2019", "2018"]);
  assert.ok(storage.has(FAVORITES_STORAGE_KEY));
});

test("restoring storage removes duplicates and malformed items and sorts by saved time", () => {
  const first = toggleFavoriteList([], "food", recipe, {}, "2026-11-10T00:00:00Z")[0];
  const later = { ...first, savedAt: "2026-11-11T00:00:00Z" };
  const seasonal = toggleFavoriteList([], "seasonal", recipe, { month: 11 }, "2026-11-12T00:00:00Z")[0];
  const restored = parseFavorites(JSON.stringify({
    version: 1,
    items: [first, null, { source: "food" }, later, seasonal, { ...seasonal, sourceMonth: 19 }],
  }));
  assert.equal(restored.error, "");
  assert.deepEqual(restored.favorites.map((item) => item.key), ["seasonal:123", "food:123"]);
  assert.equal(restored.favorites[1].savedAt, "2026-11-11T00:00:00.000Z");
});

test("missing, damaged and unsupported storage cannot crash the app", () => {
  assert.deepEqual(parseFavorites(null), { favorites: [], error: "" });
  for (const raw of ["{broken", "null", '{"version":2,"items":[]}', '{"version":1}']) {
    assert.deepEqual(parseFavorites(raw).favorites, []);
    assert.ok(parseFavorites(raw).error);
  }
  const denied = readFavorites({ getItem: () => { throw new Error("SecurityError"); } });
  assert.deepEqual(denied.favorites, []);
  assert.ok(denied.error);
});

test("storage write failures propagate and invalid recipes cannot be saved", () => {
  assert.throws(() => writeFavorites({ setItem: () => { throw new Error("QuotaExceededError"); } }, []));
  assert.throws(() => toggleFavoriteList([], "food", { id: "" }));
  assert.throws(() => toggleFavoriteList([], "seasonal", recipe, { month: 13 }));
});
