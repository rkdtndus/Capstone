# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## 공통 추천수

개인 찜 목록은 기존처럼 브라우저 localStorage에 저장합니다. 하트를 누르거나 해제하면
이 브라우저의 찜 목록에서 출처와 레시피 번호만 서버에 보내 공통 추천수에 반영합니다.
기존에 저장한 찜도 처음 연결할 때 자동 반영합니다.

- GET /api/likes: 레시피별 공통 추천수와 현재 브라우저의 동기화 버전을 조회합니다.
- PUT /api/likes: { revision, favorites: [{ source: "food" | "seasonal", id: "123" }] }로
  현재 브라우저의 추천 목록을 동기화합니다. 같은 목록을 반복 전송해도 수가 늘지 않습니다.
- 서버가 발급한 익명 쿠키와 SQLite의 브라우저·출처·레시피 조합으로 중복을 구분합니다.
  여러 탭이 동시에 수정하면 버전을 확인하고 최신 브라우저 목록으로 다시 시도합니다.
- 데이터는 recipe-web/.data/likes.sqlite에 저장되어 서버 재시작 후에도 유지됩니다.
  .data는 Git에 포함하지 않으며 Vite를 통한 직접 파일 접근도 제외합니다.
- 화면을 보고 있는 동안 2.5초 간격으로 공통 추천수를 갱신합니다.
  서버 연결에 실패해도 개인 찜은 유지하고, 다시 연결되면 최신 목록을 반영합니다.
- 카드·상세보기·찜 목록에는 공통 추천수를 표시합니다.
  상단 찜 목록의 숫자는 계속 현재 브라우저의 개인 찜 개수입니다.
- 로그인 없이 브라우저를 구분하므로 쿠키 삭제나 다른 브라우저 사용까지
  동일한 사람으로 판단하지는 못합니다. 공통 집계를 공유하려면 같은 백엔드에 접속해야 합니다.
- SQLite는 Node 내장 모듈을 사용하며 현재 Node 24.18.0에서 검증했습니다.

### 실행 및 여러 컴퓨터의 추천수 공유

Node 24 이상을 사용합니다. recipe-web 폴더에서 터미널 두 개를 열어 실행합니다.

```powershell
npm run server
```

```powershell
npm run dev
```

백엔드 실행 시 ../backend/.env의 API 키를 읽습니다. 프론트엔드는 /api 요청을
기본적으로 같은 컴퓨터의 http://127.0.0.1:3001 백엔드로 전달합니다.

- 같은 네트워크의 다른 컴퓨터에서는 http://서버컴퓨터IP:5173으로 접속합니다.
  모든 접속자가 같은 백엔드와 SQLite 파일을 사용하므로 추천수가 함께 누적됩니다.
  Windows 방화벽에서 Node.js의 해당 네트워크 접근이 허용되어 있어야 합니다.
- 프론트엔드를 별도 컴퓨터에서 실행할 때는 recipe-web/.env.local에
  API_PROXY_TARGET=http://공통백엔드IP:3001을 설정하고 Vite를 재시작합니다.
  각 컴퓨터에서 자기 백엔드를 실행하면 추천수는 서로 공유되지 않습니다.
- npm run build 후 npm run preview도 같은 API 프록시 설정을 사용합니다.
  외부 배포 시에는 /api를 같은 공통 백엔드로 전달하도록 호스팅의 프록시를 설정하고,
  백엔드의 .data 폴더를 재배포 후에도 유지되는 저장 공간에 보관합니다.
- 서버 재시작이나 코드 복구 시 기존 .data/likes.sqlite 파일을 삭제하지 마세요.
  현재 남아 있는 데이터베이스를 그대로 열어 기존 추천수를 이어서 사용합니다.

npm test로 찜 저장, 여러 브라우저의 공통 추천수, 서버 재시작 후 유지,
실제 Vite API 프록시 연결을 검증합니다.
