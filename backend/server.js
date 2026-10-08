
require("dotenv").config();

const express = require("express");
const app = express();

const cors = require("cors");
app.use(cors({ origin: "http://localhost:5173" }));

const PORT = 3001;
const API_KEY = process.env.FOOD_API_KEY;

app.get("/", (req, res) => {
  res.send("백엔드 서버 연결 성공!");
});

app.get("/api/recipes", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({
        error: "API 인증키가 설정되지 않았습니다."
      });
    }

    // 식약처 공공데이터 API 주소
    const url =
      `https://openapi.foodsafetykorea.go.kr/api/${API_KEY}/COOKRCP01/json/1/100`;

    // 실제 공공데이터 요청
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP 오류: ${response.status}`);
    }

    const data = await response.json();

    // 식약처 API 오류 확인
    const result = data.COOKRCP01;

    if (!result || !Array.isArray(result.row)) {
      return res.status(502).json({
        error: "레시피 데이터를 가져오지 못했습니다.",
        detail: result?.RESULT || data.RESULT || null
      });
    }

    // 필요한 데이터만 추출
    const recipes = result.row.map((recipe) => ({
      id: recipe.RCP_SEQ,
      name: recipe.RCP_NM,
      ingredients: recipe.RCP_PARTS_DTLS,
      category: recipe.RCP_PAT2,
      method: recipe.RCP_WAY2,
      calories: Number(recipe.INFO_ENG),
      protein: Number(recipe.INFO_PRO),
      carbs: Number(recipe.INFO_CAR),
      image: recipe.ATT_FILE_NO_MAIN
    }));

    res.json(recipes);

  } catch (error) {
    console.error("API 오류:", error.message);

    res.status(500).json({
      error: "공공데이터 API 연결 실패"
    });
  }
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
