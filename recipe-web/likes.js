import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';

const COOKIE_NAME = 'oneul-recipe-session';
const DEFAULT_DATABASE = fileURLToPath(new URL('./.data/likes.sqlite', import.meta.url));
const MAX_FAVORITES = 5000;

function invalid(message = '추천 정보를 올바르게 보내 주세요.') {
  return Object.assign(new Error(message), { status: 400 });
}

function references(value) {
  if (!Array.isArray(value) || value.length > MAX_FAVORITES) throw invalid();
  const unique = new Map();
  for (const item of value) {
    if (!item || !['food', 'seasonal'].includes(item.source) ||
        !['string', 'number'].includes(typeof item.id) || !/^\d{1,20}$/.test(String(item.id))) {
      throw invalid();
    }
    const reference = { source: item.source, id: String(item.id) };
    unique.set(reference.source + ':' + reference.id, reference);
  }
  return [...unique.values()];
}

export function createLikesStore(databasePath = DEFAULT_DATABASE) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS like_sessions (
      id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS recipe_likes (
      session_id TEXT NOT NULL REFERENCES like_sessions(id),
      source TEXT NOT NULL CHECK (source IN ('food', 'seasonal')),
      recipe_id TEXT NOT NULL,
      PRIMARY KEY (session_id, source, recipe_id)
    );
    CREATE INDEX IF NOT EXISTS recipe_likes_recipe ON recipe_likes(source, recipe_id);
  `);
  const sessionById = db.prepare('SELECT revision FROM like_sessions WHERE id = ?');
  const addSession = db.prepare('INSERT INTO like_sessions (id) VALUES (?)');
  const allCounts = db.prepare('SELECT source, recipe_id, COUNT(*) AS count FROM recipe_likes GROUP BY source, recipe_id');
  const ownLikes = db.prepare('SELECT source, recipe_id FROM recipe_likes WHERE session_id = ?');
  const clearLikes = db.prepare('DELETE FROM recipe_likes WHERE session_id = ?');
  const addLike = db.prepare('INSERT INTO recipe_likes (session_id, source, recipe_id) VALUES (?, ?, ?)');
  const incrementRevision = db.prepare('UPDATE like_sessions SET revision = revision + 1 WHERE id = ?');

  function session(cookie) {
    if (typeof cookie === 'string' && /^[\da-f-]{36}$/.test(cookie) && sessionById.get(cookie)) {
      return { id: cookie, created: false };
    }
    const id = randomUUID();
    addSession.run(id);
    return { id, created: true };
  }

  function snapshot(sessionId) {
    const record = sessionById.get(sessionId);
    if (!record) throw invalid();
    return {
      counts: Object.fromEntries(allCounts.all().map(row => [row.source + ':' + row.recipe_id, row.count])),
      revision: record.revision,
    };
  }

  function sync(sessionId, revision, favorites) {
    if (!Number.isSafeInteger(revision) || revision < 0) throw invalid();
    const desired = references(favorites);
    db.exec('BEGIN IMMEDIATE');
    try {
      const record = sessionById.get(sessionId);
      if (!record) throw invalid();
      if (record.revision !== revision) {
        throw Object.assign(new Error('최신 추천 정보로 다시 시도해 주세요.'), {
          status: 409, revision: record.revision,
        });
      }
      const previous = new Set(ownLikes.all(sessionId).map(row => row.source + ':' + row.recipe_id));
      if (previous.size !== desired.length || desired.some(item => !previous.has(item.source + ':' + item.id))) {
        clearLikes.run(sessionId);
        for (const item of desired) addLike.run(sessionId, item.source, item.id);
        incrementRevision.run(sessionId);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return snapshot(sessionId);
  }

  return { session, snapshot, sync, close: () => db.close() };
}

export function createLikesRouter({ databasePath = DEFAULT_DATABASE } = {}) {
  const store = createLikesStore(databasePath);
  const router = express.Router();
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const cookie = req.headers.cookie?.split(';').map(value => value.trim())
        .find(value => value.startsWith(COOKIE_NAME + '='))?.slice(COOKIE_NAME.length + 1);
      const session = store.session(cookie);
      if (session.created) {
        res.cookie(COOKIE_NAME, session.id, {
          httpOnly: true, sameSite: 'lax', secure: req.secure,
          path: '/api/likes', maxAge: 365 * 24 * 60 * 60 * 1000,
        });
      }
      req.likesSession = session.id;
      next();
    } catch (error) { next(error); }
  });
  router.get('/', (req, res, next) => {
    try { res.json(store.snapshot(req.likesSession)); } catch (error) { next(error); }
  });
  router.put('/', express.json({ limit: '512kb' }), (req, res, next) => {
    try {
      if (!req.is('application/json') || !req.body || Array.isArray(req.body)) throw invalid();
      res.json(store.sync(req.likesSession, req.body.revision, req.body.favorites));
    } catch (error) { next(error); }
  });
  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.status === 409) return res.status(409).json({ message: error.message, revision: error.revision });
    if (error.status === 400) return res.status(400).json({ message: '추천 정보를 올바르게 보내 주세요.' });
    if (error.status === 413) return res.status(413).json({ message: '한 번에 저장할 찜 목록이 너무 큽니다.' });
    res.status(503).json({ message: '추천수를 불러오거나 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  });
  return { router, close: store.close };
}