import { useCallback, useEffect, useState } from "react";
import {
  FAVORITES_STORAGE_KEY,
  getFavoriteKey,
  readFavorites,
  toggleFavoriteList,
  writeFavorites,
} from "./favoritesStorage";

function readStoredFavorites() {
  try {
    return readFavorites(window.localStorage);
  } catch {
    return {
      favorites: [],
      error: "브라우저 저장 공간에 접근할 수 없습니다. 사이트 저장 허용 설정을 확인해 주세요.",
    };
  }
}

export default function useFavorites() {
  const [state, setState] = useState(readStoredFavorites);

  useEffect(() => {
    function syncStorage(event) {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null) {
        setState(readStoredFavorites());
      }
    }
    function restorePage() {
      setState(readStoredFavorites());
    }
    window.addEventListener("storage", syncStorage);
    window.addEventListener("pageshow", restorePage);
    return () => {
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("pageshow", restorePage);
    };
  }, []);

  const toggleFavorite = useCallback((source, recipe, metadata = {}) => {
    try {
      const storage = window.localStorage;
      // Read the latest saved list so another tab's changes are retained.
      const current = readFavorites(storage);
      if (current.error) throw new Error(current.error);
      const next = toggleFavoriteList(current.favorites, source, recipe, metadata);
      try {
        writeFavorites(storage, next);
      } catch {
        throw new Error("즐겨찾기 변경을 저장하지 못했습니다. 브라우저 저장 공간과 사이트 저장 허용 설정을 확인해 주세요.");
      }
      // Only change the visible heart after persistence succeeds.
      setState({ favorites: next, error: "" });
      return true;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error?.message || "즐겨찾기를 저장하지 못했습니다.",
      }));
      return false;
    }
  }, []);

  const isFavorite = useCallback((source, id) => {
    const key = getFavoriteKey(source, id);
    return key !== null && state.favorites.some((favorite) => favorite.key === key);
  }, [state.favorites]);

  const dismissError = useCallback(() => {
    setState((previous) => ({ ...previous, error: "" }));
  }, []);

  return {
    favorites: state.favorites,
    error: state.error,
    isFavorite,
    toggleFavorite,
    dismissError,
  };
}
