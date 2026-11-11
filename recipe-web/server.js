import { XMLParser } from 'fast-xml-parser';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();

app.use(cors({
  origin: 'http://localhost:5173'
}));


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
      Date.now() - cacheTime < 10 * 60 * 1000
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

          const response = await fetch(url);

          if (!response.ok) {
            throw new Error('API 요청 실패');
          }

          const data = await response.json();
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

    res.status(500).json({
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

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('농사로 API 요청 실패');
    }

    const xml = await response.text();

    const parser = new XMLParser({
      parseTagValue: false
    });

    const data = parser.parse(xml);


    
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

    res.status(500).json({
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

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('연도 목록 요청 실패');
    }

    const xml = await response.text();

    const parser = new XMLParser({
      parseTagValue: false
    });

    const data = parser.parse(xml);

    res.json({
      resultCode: data.response?.header?.resultCode,
      message: data.response?.header?.resultMsg,
      body: data.response?.body
    });

  } catch (error) {
    res.status(500).json({
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

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('레시피 API 요청 실패');
    }

    const xml = await response.text();

    const parser = new XMLParser({
      parseTagValue: false
    });

    const data = parser.parse(xml);

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

    res.status(500).json({
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

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('상세정보 요청 실패');
    }

    const xml = await response.text();

    const parser = new XMLParser({
      parseTagValue: false
    });

    const data = parser.parse(xml);

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

    res.status(500).json({
      message: error.message
    });
  }
});



app.listen(3001, () => {
  console.log('백엔드 서버 실행: http://localhost:3001');
});
