import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  FAVORITES_STORAGE_KEY,
  getFavoriteKey,
  readFavorites,
  toggleFavoriteList,
  writeFavorites,
} from "./favoritesStorage";
import { createRecommendationsClient } from "./recommendationsClient";

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
  const [recommendations] = useState(() => createRecommendationsClient({
    readFavorites: readStoredFavorites,
    isVisible: () => document.visibilityState !== "hidden",
  }));
  const recommendationState = useSyncExternalStore(
    recommendations.subscribe, recommendations.getSnapshot, recommendations.getSnapshot,
  );

  useEffect(() => {
    const stop = recommendations.start();
    function syncStorage(event) {
      if (event.key === FAVORITES_STORAGE_KEY || event.key === null) {
        setState(readStoredFavorites());
        recommendations.refresh();
      }
    }
    function restorePage() {
      setState(readStoredFavorites());
      recommendations.refresh();
    }
    function resume() {
      if (document.visibilityState !== "hidden") restorePage();
    }
    window.addEventListener("storage", syncStorage);
    window.addEventListener("pageshow", restorePage);
    window.addEventListener("focus", restorePage);
    window.addEventListener("online", restorePage);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stop();
      window.removeEventListener("storage", syncStorage);
      window.removeEventListener("pageshow", restorePage);
      window.removeEventListener("focus", restorePage);
      window.removeEventListener("online", restorePage);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [recommendations]);

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
      // Keep the personal list usable even when the recommendation server is offline.
      setState({ favorites: next, error: "" });
      recommendations.refresh();
      return true;
    } catch (error) {
      setState((previous) => ({
        ...previous,
        error: error?.message || "즐겨찾기를 저장하지 못했습니다.",
      }));
      return false;
    }
  }, [recommendations]);

  const isFavorite = useCallback((source, id) => {
    const key = getFavoriteKey(source, id);
    return key !== null && state.favorites.some((favorite) => favorite.key === key);
  }, [state.favorites]);

  const getRecommendationCount = useCallback((source, id) => {
    const key = getFavoriteKey(source, id);
    return recommendationState.counts === null || key === null ? null : recommendationState.counts[key] ?? 0;
  }, [recommendationState.counts]);

  const dismissError = useCallback(() => {
    setState((previous) => ({ ...previous, error: "" }));
  }, []);

  return {
    favorites: state.favorites,
    error: state.error,
    isFavorite,
    toggleFavorite,
    dismissError,
    getRecommendationCount,
    recommendationsError: recommendationState.error,
    retryRecommendations: recommendations.refresh,
  };
}
