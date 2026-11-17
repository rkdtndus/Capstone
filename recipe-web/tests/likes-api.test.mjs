import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createLikesStore } from '../likes.js';
import { startApi, browserFetch } from './likesTestApi.mjs';

async function get(browser) {
  const response = await browser.fetchImpl('/api/likes');
  assert.equal(response.status, 200);
  return response.json();
}

async function put(browser, revision, favorites) {
  return browser.fetchImpl('/api/likes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revision, favorites }),
  });
}

test('two browsers share counts; duplicate syncs do not inflate them and cancellation subtracts', async t => {
  const url = await startApi(t);
  const a = browserFetch(url), b = browserFetch(url);
  await get(a); await get(b);
  assert.notEqual(a.cookie(), b.cookie());
  const item = { source: 'food', id: '123' };
  const first = await (await put(a, 0, [item])).json();
  assert.equal(first.counts['food:123'], 1);
  const repeated = await (await put(a, first.revision, [item, item])).json();
  assert.equal(repeated.counts['food:123'], 1);
  assert.equal(repeated.revision, first.revision);
  const second = await (await put(b, 0, [item])).json();
  assert.equal(second.counts['food:123'], 2);
  assert.equal((await get(a)).counts['food:123'], 2);
  assert.equal((await (await put(a, first.revision, [])).json()).counts['food:123'], 1);
  assert.deepEqual((await (await put(b, second.revision, [])).json()).counts, {});
});

test('food and seasonal IDs have separate counts and syncing replaces only this browser votes', async t => {
  const url = await startApi(t);
  const a = browserFetch(url), b = browserFetch(url);
  await get(a); await get(b);
  await put(a, 0, [{ source: 'food', id: '123' }, { source: 'seasonal', id: 123 }]);
  await put(b, 0, [{ source: 'food', id: '123' }]);
  assert.deepEqual((await get(a)).counts, { 'food:123': 2, 'seasonal:123': 1 });
  await put(a, 1, []);
  assert.deepEqual((await get(b)).counts, { 'food:123': 1 });
});

test('a stale tab receives a revision conflict instead of overwriting a newer cancellation', async t => {
  const browser = browserFetch(await startApi(t));
  await get(browser);
  await put(browser, 0, [{ source: 'food', id: '123' }]);
  await put(browser, 1, []);
  const stale = await put(browser, 1, [{ source: 'food', id: '123' }]);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).revision, 2);
  assert.deepEqual((await get(browser)).counts, {});
});

test('invalid requests and oversized bodies leave the existing votes unchanged', async t => {
  const browser = browserFetch(await startApi(t));
  await get(browser);
  await put(browser, 0, [{ source: 'food', id: '123' }]);
  for (const [revision, favorites] of [
    [-1, []], ['1', []], [1, null], [1, [{ source: 'other', id: '123' }]],
    [1, [{ source: 'food', id: 'bad' }]], [1, Array(5001).fill({ source: 'food', id: '123' })],
  ]) assert.equal((await put(browser, revision, favorites)).status, 400);
  assert.equal((await browser.fetchImpl('/api/likes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{broken',
  })).status, 400);
  assert.equal((await browser.fetchImpl('/api/likes', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ extra: 'x'.repeat(513 * 1024) }),
  })).status, 413);
  assert.deepEqual((await get(browser)).counts, { 'food:123': 1 });
});

test('database votes and browser identity survive closing and reopening the server store', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'capstone-likes-test-'));
  const database = path.join(directory, 'likes.sqlite');
  let store;
  try {
    store = createLikesStore(database);
    const session = store.session();
    store.sync(session.id, 0, [{ source: 'seasonal', id: '456' }]);
    store.close();
    store = undefined;
    store = createLikesStore(database);
    assert.deepEqual(store.session(session.id), { id: session.id, created: false });
    assert.deepEqual(store.snapshot(session.id), { counts: { 'seasonal:456': 1 }, revision: 1 });
  } finally {
    store?.close();
    assert.equal(path.dirname(directory), os.tmpdir());
    assert.ok(path.basename(directory).startsWith('capstone-likes-test-'));
    rmSync(directory, { recursive: true, force: true });
  }
});

test('multiple simultaneous browser votes are all counted exactly once', async t => {
  const url = await startApi(t);
  const browsers = Array.from({ length: 12 }, () => browserFetch(url));
  await Promise.all(browsers.map(browser => get(browser)));
  await Promise.all(browsers.map(browser => put(browser, 0, [{ source: 'food', id: '789' }])));
  assert.equal((await get(browsers[0])).counts['food:789'], 12);
});

test('anonymous identity is issued by the server with an HttpOnly cookie', async t => {
  const url = await startApi(t);
  const response = await fetch(url, { headers: { Cookie: 'oneul-recipe-session=00000000-0000-0000-0000-000000000000' } });
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Path=\/api\/likes/i);
  assert.doesNotMatch(cookie, /00000000-0000-0000-0000-000000000000/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
