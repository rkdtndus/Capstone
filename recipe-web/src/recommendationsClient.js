const ERROR_MESSAGE = '추천수를 동기화하지 못했습니다. 잠시 후 다시 시도해 주세요.';

export function favoriteReferences(favorites) {
  return [...new Map(favorites.map(item => {
    const reference = { source: item.source, id: String(item.recipe.id) };
    return [reference.source + ':' + reference.id, reference];
  })).values()].sort((a, b) => (a.source + ':' + a.id).localeCompare(b.source + ':' + b.id));
}

export function createRecommendationsClient({
  readFavorites,
  fetchImpl = (...args) => fetch(...args),
  intervalMs = 2500,
  isVisible = () => true,
}) {
  let snapshot = { counts: null, error: '' };
  let revision = null;
  let lastSynced = null;
  let subscribers = 0;
  let timer;
  let controller;
  let running;
  let requested = false;
  const listeners = new Set();

  function publish(next) {
    snapshot = next;
    for (const listener of listeners) listener();
  }

  async function request(method, body, signal) {
    signal.throwIfAborted();
    const response = await fetchImpl('/api/likes', {
      method, credentials: 'same-origin', cache: 'no-store', signal,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    signal.throwIfAborted();
    if (method === 'PUT' && response.status === 409 && Number.isSafeInteger(data.revision) && data.revision >= 0) {
      revision = data.revision;
      return null;
    }
    if (!response.ok || !data || !Number.isSafeInteger(data.revision) || data.revision < 0 ||
        !data.counts || Array.isArray(data.counts) || typeof data.counts !== 'object' ||
        Object.values(data.counts).some(count => !Number.isSafeInteger(count) || count < 0)) {
      throw new Error(ERROR_MESSAGE);
    }
    revision = data.revision;
    if (subscribers && !signal.aborted) publish({ counts: data.counts, error: '' });
    return data;
  }

  async function run(signal) {
    if (revision === null) await request('GET', undefined, signal);
    for (let attempt = 0; attempt < 3; attempt++) {
      const stored = readFavorites();
      if (stored.error) throw new Error(ERROR_MESSAGE);
      const favorites = favoriteReferences(stored.favorites);
      const signature = JSON.stringify(favorites);
      if (signature === lastSynced) {
        await request('GET', undefined, signal);
        return;
      }
      const data = await request('PUT', { revision, favorites }, signal);
      if (!data) continue; // Another tab updated this same browser session.
      lastSynced = signature;
      const latest = readFavorites();
      if (!latest.error && JSON.stringify(favoriteReferences(latest.favorites)) !== signature) requested = true;
      return;
    }
    throw new Error(ERROR_MESSAGE);
  }

  function pump() {
    if (!subscribers || running) return running;
    requested = false;
    controller = new AbortController();
    const currentController = controller;
    const signal = currentController.signal;
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; currentController.abort(); }, 10000);
    running = run(signal).catch(() => {
      if (subscribers && (!signal.aborted || timedOut)) publish({ ...snapshot, error: ERROR_MESSAGE });
    }).finally(() => {
      clearTimeout(timeout);
      running = null;
      if (subscribers && requested) pump();
    });
    return running;
  }

  function refresh() {
    requested = true;
    return pump();
  }

  function start() {
    subscribers++;
    if (subscribers === 1) {
      if (intervalMs > 0) timer = setInterval(() => { if (isVisible()) refresh(); }, intervalMs);
      refresh();
    }
    return () => {
      subscribers--;
      if (!subscribers) {
        clearInterval(timer);
        controller?.abort();
      }
    };
  }

  return {
    start, refresh,
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}