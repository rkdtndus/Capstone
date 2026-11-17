import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { createRecommendationsClient } from '../src/recommendationsClient.js';
import { startApi, browserFetch } from './likesTestApi.mjs';

const favorite = (id, source = 'food') => ({ source, recipe: { id } });
async function until(check) {
  const deadline = Date.now() + 5000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for recommendation sync');
    await delay(5);
  }
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('existing local favorites are migrated once without adding duplicate recommendations on refresh or reload', async t => {
  const browser = browserFetch(await startApi(t));
  let favorites = [favorite('123'), favorite('456', 'seasonal')];
  const options = { fetchImpl: browser.fetchImpl, readFavorites: () => ({ favorites, error: '' }), intervalMs: 0 };
  const client = createRecommendationsClient(options);
  let stop = client.start();
  t.after(() => stop());
  await until(() => client.getSnapshot().counts?.['food:123'] === 1);
  await client.refresh(); await client.refresh();
  assert.deepEqual(client.getSnapshot().counts, { 'food:123': 1, 'seasonal:456': 1 });
  stop();
  const reload = createRecommendationsClient(options);
  stop = reload.start();
  await until(() => browser.requests.filter(request => request.method === 'PUT').length >= 2);
  await reload.refresh();
  assert.deepEqual(reload.getSnapshot().counts, { 'food:123': 1, 'seasonal:456': 1 });
});

test('failed synchronization preserves local favorites and retries their latest state after reconnection', async t => {
  const browser = browserFetch(await startApi(t));
  let favorites = [], offline = false;
  const client = createRecommendationsClient({
    readFavorites: () => ({ favorites, error: '' }), intervalMs: 0,
    fetchImpl: (...args) => offline ? Promise.reject(new Error('offline')) : browser.fetchImpl(...args),
  });
  const stop = client.start(); t.after(stop);
  await until(() => browser.requests.some(request => request.method === 'PUT'));
  await client.refresh();
  offline = true;
  favorites = [favorite('123')];
  await client.refresh();
  assert.ok(client.getSnapshot().error);
  assert.equal(favorites[0].recipe.id, '123');
  favorites = [favorite('456')];
  offline = false;
  await client.refresh();
  await until(() => client.getSnapshot().counts?.['food:456'] === 1);
  assert.equal(client.getSnapshot().counts['food:123'], undefined);
  assert.equal(client.getSnapshot().error, '');
});

test('rapid toggles during a pending write converge to the latest local favorite list', async t => {
  const browser = browserFetch(await startApi(t));
  let favorites = [favorite('123')], hold = false;
  const entered = deferred(), release = deferred();
  const client = createRecommendationsClient({
    readFavorites: () => ({ favorites, error: '' }), intervalMs: 0,
    fetchImpl: async (route, options) => {
      if (hold && options.method === 'PUT') {
        hold = false; entered.resolve(); await release.promise;
      }
      return browser.fetchImpl(route, options);
    },
  });
  const stop = client.start(); t.after(stop);
  await until(() => client.getSnapshot().counts?.['food:123'] === 1);
  hold = true; favorites = [favorite('123'), favorite('456')];
  client.refresh(); await entered.promise;
  favorites = []; client.refresh(); release.resolve();
  await until(() => browser.requests.filter(request => request.method === 'PUT').length >= 3 &&
    Object.keys(client.getSnapshot().counts || {}).length === 0);
  assert.equal(client.getSnapshot().error, '');
});

test('two tabs sharing a session recover from a stale write using the latest local storage', async t => {
  const browser = browserFetch(await startApi(t));
  let favorites = [];
  const readFavorites = () => ({ favorites, error: '' });
  let hold = false, conflicts = 0;
  const entered = deferred(), release = deferred();
  const first = createRecommendationsClient({
    readFavorites, intervalMs: 0,
    fetchImpl: async (route, options) => {
      if (hold && options.method === 'PUT') { hold = false; entered.resolve(); await release.promise; }
      const response = await browser.fetchImpl(route, options);
      if (response.status === 409) conflicts++;
      return response;
    },
  });
  const stopFirst = first.start(); t.after(stopFirst);
  await until(() => browser.requests.some(request => request.method === 'PUT'));
  await first.refresh();
  const second = createRecommendationsClient({ readFavorites, intervalMs: 0, fetchImpl: browser.fetchImpl });
  const stopSecond = second.start(); t.after(stopSecond);
  await second.refresh(); await delay(10);
  hold = true; favorites = [favorite('123')]; first.refresh(); await entered.promise;
  favorites = [favorite('456')]; await second.refresh();
  await until(() => second.getSnapshot().counts?.['food:456'] === 1);
  release.resolve();
  await until(() => conflicts === 1 && first.getSnapshot().counts?.['food:456'] === 1);
  assert.equal(first.getSnapshot().counts['food:123'], undefined);
});

test('React StrictMode setup-cleanup-setup does not duplicate votes or show a false error', async t => {
  const browser = browserFetch(await startApi(t));
  const client = createRecommendationsClient({
    intervalMs: 0, fetchImpl: browser.fetchImpl,
    readFavorites: () => ({ favorites: [favorite('123')], error: '' }),
  });
  client.start()();
  const stop = client.start(); t.after(stop);
  await until(() => client.getSnapshot().counts?.['food:123'] === 1);
  assert.equal(client.getSnapshot().error, '');
  assert.ok(browser.requests.filter(request => request.method === 'PUT').length === 1);
});

test('unreadable local storage never wipes existing server votes', async t => {
  const browser = browserFetch(await startApi(t));
  let failed = false;
  const client = createRecommendationsClient({
    intervalMs: 0, fetchImpl: browser.fetchImpl,
    readFavorites: () => failed ? { favorites: [], error: 'denied' } : { favorites: [favorite('123')], error: '' },
  });
  const stop = client.start(); t.after(stop);
  await until(() => client.getSnapshot().counts?.['food:123'] === 1);
  const writes = browser.requests.filter(request => request.method === 'PUT').length;
  failed = true; await client.refresh();
  assert.ok(client.getSnapshot().error);
  assert.equal(browser.requests.filter(request => request.method === 'PUT').length, writes);
  const response = await browser.fetchImpl('/api/likes');
  assert.equal((await response.json()).counts['food:123'], 1);
});

test('visible polling receives another browser vote without a page reload', async t => {
  const url = await startApi(t);
  const a = browserFetch(url), b = browserFetch(url);
  const first = createRecommendationsClient({ intervalMs: 15, fetchImpl: a.fetchImpl, readFavorites: () => ({ favorites: [], error: '' }) });
  const stopFirst = first.start(); t.after(stopFirst);
  await until(() => first.getSnapshot().counts !== null);
  const second = createRecommendationsClient({ intervalMs: 0, fetchImpl: b.fetchImpl, readFavorites: () => ({ favorites: [favorite('123')], error: '' }) });
  const stopSecond = second.start(); t.after(stopSecond);
  await until(() => first.getSnapshot().counts?.['food:123'] === 1);
});
