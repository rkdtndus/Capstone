import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import express from 'express';
import { createServer } from 'vite';
import { createLikesRouter } from '../likes.js';
import viteConfig from '../vite.config.js';
import { browserFetch } from './likesTestApi.mjs';

test('Vite proxies recipe requests and shared browser recommendations to the configured backend', async t => {
  const app = express();
  const likes = createLikesRouter({ databasePath: ':memory:' });
  app.use('/api/likes', likes.router);
  app.get('/api/recipes', (req, res) => res.json([{ RCP_SEQ: '123', RCP_NM: '두부국' }]));
  app.get('/api/seasonal', (req, res) => res.json({ month: req.query.month }));
  const backend = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  let frontend;
  t.after(async () => {
    await frontend?.close();
    backend.closeAllConnections();
    await new Promise(resolve => backend.close(resolve));
    likes.close();
  });

  const previousTarget = process.env.API_PROXY_TARGET;
  let config;
  try {
    process.env.API_PROXY_TARGET = 'http://127.0.0.1:' + backend.address().port;
    config = viteConfig({ mode: 'test', command: 'serve' });
  } finally {
    if (previousTarget === undefined) delete process.env.API_PROXY_TARGET;
    else process.env.API_PROXY_TARGET = previousTarget;
  }
  frontend = await createServer({
    ...config,
    configFile: false,
    root: fileURLToPath(new URL('..', import.meta.url)),
    logLevel: 'silent',
    server: { ...config.server, host: '127.0.0.1', port: 0, strictPort: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  await frontend.listen();
  const origin = 'http://127.0.0.1:' + frontend.httpServer.address().port;
  const first = browserFetch(origin + '/api/likes');
  const second = browserFetch(origin + '/api/likes');
  for (const browser of [first, second]) {
    const response = await browser.fetchImpl('/api/likes');
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).counts, {});
  }
  assert.notEqual(first.cookie(), second.cookie());
  for (const [index, browser] of [first, second].entries()) {
    const response = await browser.fetchImpl('/api/likes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revision: 0, favorites: [{ source: 'food', id: '123' }] }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).counts['food:123'], index + 1);
  }
  assert.equal((await (await first.fetchImpl('/api/likes')).json()).counts['food:123'], 2);
  assert.deepEqual(await (await fetch(origin + '/api/recipes')).json(), [{ RCP_SEQ: '123', RCP_NM: '두부국' }]);
  assert.deepEqual(await (await fetch(origin + '/api/seasonal?month=11')).json(), { month: '11' });
});
