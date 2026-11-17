import assert from 'node:assert/strict';
import express from 'express';
import { createLikesRouter } from '../likes.js';

export async function startApi(t) {
  const app = express();
  const likes = createLikesRouter({ databasePath: ':memory:' });
  app.use('/api/likes', likes.router);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    likes.close();
  });
  return 'http://127.0.0.1:' + server.address().port + '/api/likes';
}

export function browserFetch(url) {
  let cookie = '';
  const requests = [];
  const fetchImpl = async (route, options = {}) => {
    assert.equal(route, '/api/likes');
    let body;
    try { body = options.body && JSON.parse(options.body); } catch { body = null; }
    requests.push({ method: options.method || 'GET', body });
    const response = await fetch(url, {
      ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
  };
  return { fetchImpl, requests, cookie: () => cookie };
}
