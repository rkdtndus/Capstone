import { XMLParser } from 'fast-xml-parser';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { consumeFoodApiCall } from './foodApiLimit.js';
import { createLikesRouter } from './likes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173'
}));

const MAX_EXTERNAL_CALLS = 2;
const MAX_WAITING_CALLS = 50;
const MAX_QUEUE_WAIT_MS = 30_000;
app.use('/api/likes', createLikesRouter().router);


let activeExternalCalls = 0;
const externalCallQueue = [];

function busyApiError() {
  const error = new Error('요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  error.status = 503;
  return error;
}

async function runExternalApi(task) {
  if (activeExternalCalls >= MAX_EXTERNAL_CALLS) {
    if (externalCallQueue.length >= MAX_WAITING_CALLS) {
      throw busyApiError();
    }

    await new Promise((resolve, reject) => {
      const waiting = { resolve, timer: null };

      waiting.timer = setTimeout(() => {
        const index = externalCallQueue.indexOf(waiting);
        if (index !== -1) externalCallQueue.splice(index, 1);
        reject(busyApiError());
      }, MAX_QUEUE_WAIT_MS);

      externalCallQueue.push(waiting);
    });
  } else {
    activeExternalCalls++;
  }

  try {
    console.log('[외부 API] 동시 실행:', activeExternalCalls);
    return await task();
  } finally {
    const next = externalCallQueue.shift();

    if (next) {
      clearTimeout(next.timer);
      // 실행 자리를 대기 중인 다음 요청에 넘깁니다.
      next.resolve();
    } else {
      activeExternalCalls--;
    }
  }
}

const NONGSARO_CACHE_MS = 24 * 60 * 60 * 1000;
const nongsaroCache = new Map();
const nongsaroPending = new Map();

async function getNongsaroData(url) {
  // 캐시 식별자에는 인증키를 넣지 않습니다.
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.delete('apiKey');
  parsedUrl.searchParams.sort();
  const cacheKey = parsedUrl.href;
  const cached = nongsaroCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    console.log('[농사로] 캐시 사용');
    return cached.data;
  }
  if (cached) nongsaroCache.delete(cacheKey);

  // 같은 조회가 진행 중이면 그 결과를 함께 기다립니다.
  if (nongsaroPending.has(cacheKey)) {
    return nongsaroPending.get(cacheKey);
  }

  const pending = runExternalApi(async () => {
    console.log('[농사로] 외부 API 호출');
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error('농사로 연결 실패');

    const xml = await response.text();
    const parser = new XMLParser({ parseTagValue: false });
    const data = parser.parse(xml);

    // 실패 응답은 캐시에 넣지 않습니다.
    if (data.response?.header?.resultCode !== '00') {
      throw new Error('농사로 API 응답 오류');
    }

    // 저장하는 조회 결과 수를 최대 500개로 제한합니다.
    if (nongsaroCache.size >= 500) {
      nongsaroCache.delete(nongsaroCache.keys().next().value);
    }

    nongsaroCache.set(cacheKey, {
      data,
      expiresAt: Date.now() + NONGSARO_CACHE_MS,
    });
    return data;
  });

  nongsaroPending.set(cacheKey, pending);

  try {
    return await pending;
  } finally {
    nongsaroPending.delete(cacheKey);
  }
}
let cachedRecipes = [];
let cacheTime = 0;
let pendingRecipes = null;

app.get('/api/recipes', async (req, res) => {
  try {
    const apiKey = process.env.FOOD_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message: 'API 인증키가 설정되지 않았습니다.'
      });
    }

    // 10분 동안 저장된 데이터 재사용
    if (
      cachedRecipes.length > 0 &&
      Date.now() - cacheTime < 24 * 60 * 60 * 1000
    ) {
      return res.json(cachedRecipes);
    }

    // Share the upstream request while React development mode mounts twice.
    if (!pendingRecipes) {
      pendingRecipes = (async () => {
        let allRecipes = [];
        let totalCount = 0;
        let start = 1;

        do {
          const end = totalCount
            ? Math.min(start + 999, totalCount)
            : 1000;

          const url =
            `https://openapi.foodsafetykorea.go.kr/api/` +
            `${apiKey}/COOKRCP01/json/${start}/${end}`;

          const data = await runExternalApi(async () => {
            consumeFoodApiCall();

            const response = await fetch(url, {
              signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) {
              throw new Error('API 요청 실패');
            }

            return response.json();
          });
          const result = data.COOKRCP01;

          if (!result || !Array.isArray(result.row)) {
            throw new Error(
              result?.RESULT?.MSG ||
              data.RESULT?.MSG ||
              'API 데이터 오류'
            );
          }

          totalCount = Number(result.total_count);
          allRecipes = [...allRecipes, ...result.row];

          start = end + 1;

        } while (start <= totalCount);

        cachedRecipes = allRecipes;
        cacheTime = Date.now();

        console.log(`전체 레시피: ${allRecipes.length}개`);
        return allRecipes;
      })().finally(() => {
        pendingRecipes = null;
      });
    }

    res.json(await pendingRecipes);

  } catch (error) {
    console.error(error.message);

    res.status(error.status || 500).json({
      message: error.message
    });
  }
});


app.get('/api/seasonal/status', (req, res) => {
  const hasKey = Boolean(process.env.NONGSARO_API_KEY);

  res.json({
    keyConfigured: hasKey
  });
});



app.get('/api/seasonal', async (req, res) => {
  try {
    const apiKey = process.env.NONGSARO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message: '농사로 API 키가 없습니다.'
      });
    }



    const today = new Date();
    const year = '2019';

    const selectedMonth = Number(
      req.query.month ?? today.getMonth() + 1
    );

    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      return res.status(400).json({ message: '잘못된 월입니다.' });
    }

    const month = String(selectedMonth).padStart(2, '0');




    const params = new URLSearchParams({
      apiKey: apiKey,
      thisYear: year,
      thisMonth: month
    });

    const url =
      'http://api.nongsaro.go.kr/service/monthFd/monthFdmtLst?' +
      params.toString();

    const data = await getNongsaroData(url);



    console.log('조회 연도:', year);
    console.log('조회 월:', month);
    console.log('결과 코드:', data.response?.header?.resultCode);
    console.log('결과 메시지:', data.response?.header?.resultMsg);

    console.log(
      'body 구조:',
      Object.keys(data.response?.body || {})
    );

    console.log(
      'items 구조:',
      Object.keys(data.response?.body?.items || {})
    );



    if (data.response?.header?.resultCode !== '00') {
      throw new Error(
        data.response?.header?.resultMsg ||
        '농사로 API 응답 오류'
      );
    }


    const raw =
      data.response?.body?.items?.item ??
      data.response?.body?.item;


    const items = Array.isArray(raw)
      ? raw
      : raw ? [raw] : [];


    res.json(
      items.slice(0, 3).map((item) => {
        const codes = String(item.rtnImgSeCode || '').split('|');
        const paths = String(item.rtnFileCours || '').split('|');
        const files = String(item.rtnStreFileNm || '').split('|');

        let imageIndex = codes.findIndex(
          (code, index) =>
            code.trim() === '209005' &&
            paths[index]?.trim() &&
            files[index]?.trim()
        );

        if (imageIndex === -1) {
          imageIndex = paths.findIndex(
            (path, index) => path.trim() && files[index]?.trim()
          );
        }

        const path = paths[imageIndex]?.trim();
        const filename = files[imageIndex]?.trim();

        const image = path && filename
          ? `https://www.nongsaro.go.kr/${path.replace(/^\/+|\/+$/g, '')}/${filename.replace(/^\/+/, '')}`
          : '';

        return {
          id: item.cntntsNo,
          name: item.fdmtNm,
          image
        };
      })
    );

  } catch (error) {
    console.error('농사로 조회 오류:', error.message);

    res.status(error.status || 500).json({
      message: error.message
    });
  }
});



app.get('/api/seasonal/years', async (req, res) => {
  try {
    const apiKey = process.env.NONGSARO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message: 'API 키가 없습니다.'
      });
    }

    const url =
      'http://api.nongsaro.go.kr/service/monthFd/monthFdYearLst?' +
      new URLSearchParams({ apiKey });

    const data = await getNongsaroData(url);

    res.json({
      resultCode: data.response?.header?.resultCode,
      message: data.response?.header?.resultMsg,
      body: data.response?.body
    });

  } catch (error) {
    res.status(error.status || 500).json({
      message: error.message
    });
  }
});



app.get('/api/seasonal/recipes', async (req, res) => {
  try {
    const apiKey = process.env.NONGSARO_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        message: '농사로 API 키가 없습니다.'
      });
    }

    const year = '2019';

    const selectedMonth = Number(
      req.query.month ?? new Date().getMonth() + 1
    );

    if (!Number.isInteger(selectedMonth) || selectedMonth < 1 || selectedMonth > 12) {
      return res.status(400).json({ message: '잘못된 월입니다.' });
    }

    const month = String(selectedMonth).padStart(2, '0');


    const params = new URLSearchParams({
      apiKey,
      thisYear: year,
      thisMonth: month
    });

    const url =
      'http://api.nongsaro.go.kr/service/monthFd/monthNewFdLst?' +
      params.toString();

    const data = await getNongsaroData(url);

    if (data.response?.header?.resultCode !== '00') {
      throw new Error(
        data.response?.header?.resultMsg ||
        '농사로 API 오류'
      );
    }

    const raw = data.response?.body?.items?.item;

    const items = Array.isArray(raw)
      ? raw
      : raw ? [raw] : [];

    res.json({
      year,
      month,
      count: items.length,
      recipes: items
    });

  } catch (error) {
    console.error('제철 레시피 오류:', error.message);

    res.status(error.status || 500).json({
      message: error.message
    });
  }
});



app.get('/api/seasonal/recipes/:id', async (req, res) => {
  try {
    const apiKey = process.env.NONGSARO_API_KEY;
    const id = req.params.id;

    if (!apiKey) {
      return res.status(500).json({
        message: 'API 키가 없습니다.'
      });
    }

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: '잘못된 레시피 번호입니다.'
      });
    }

    const params = new URLSearchParams({
      apiKey,
      cntntsNo: id
    });

    const url =
      'http://api.nongsaro.go.kr/service/monthFd/monthNewFdDtl?' +
      params.toString();

    const data = await getNongsaroData(url);

    if (data.response?.header?.resultCode !== '00') {
      throw new Error(
        data.response?.header?.resultMsg || 'API 응답 오류'
      );
    }

    const item =
      data.response?.body?.item ??
      data.response?.body?.items?.item;

    if (!item || Array.isArray(item)) {
      return res.status(404).json({
        message: '레시피 상세정보가 없습니다.'
      });
    }

    res.json({
      id,
      name: item.fdNm ?? '',
      ingredients: item.matrlInfo ?? '',
      method: item.ckngMthInfo ?? '',
      calories: item.energyQy ?? null,
      carbohydrate: item.crbQy ?? null,
      protein: item.protQy ?? null,
      fat: item.ntrfsQy ?? null
    });

  } catch (error) {
    console.error('레시피 상세 오류:', error.message);

    res.status(error.status || 500).json({
      message: error.message
    });
  }
});



app.listen(3001, () => {
  console.log('백엔드 서버 실행: http://localhost:3001');
});
