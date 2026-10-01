# 로컬 AI 모델 포털

HuggingFace에서 받아 내 PC·사내 서버에 올릴 수 있는 모델을 **"요즘 뭐가 인기이고, 무엇을 잘하고,
내 PC에서 돌아가는가"** 기준으로 정리해 보여주는 웹 포털입니다.

> 2026-10 방향 전환: 이전 버전은 Artificial Analysis(AA) 벤치마크 지표로 API 모델과 오픈소스 모델을
> 표로 비교했습니다. 지표는 모르는 용어가 많아 모델을 고르는 데 도움이 덜 됐고, API 모델은 비교보다
> 소식만 보면 충분해서 HuggingFace 하나로 단순화했습니다. 이전 코드는 git 첫 커밋에 남아 있습니다.

---

## 1. 화면 구성

| 탭 | 용도 |
| --- | --- |
| **트렌드** | 카테고리(LLM·임베딩·음성·이미지) × 정렬(지금 뜨는 / 많이 쓰는 / 좋아요 많은 / 새로 나온) |
| **모델 찾기** | 내 GPU 메모리 · 용도 · 라이선스 · 국내 기업으로 좁히고 최대 3개 나란히 비교 |
| **뉴스** | 제공사 공식 블로그 새 글 (API로 쓰는 상용 모델 소식은 여기서) |
| **용어 정리** | VRAM·양자화·GGUF·MoE 등 로컬 실행 용어 포함 |
| **관리** | 수집 수동 실행·진행 상황, 스팸 리포 숨기기 |

모델 카드는 숫자 지표 대신 네 가지 질문에 답합니다.

1. **잘하는 것** — 제공사가 HF에 단 태그·pipeline_tag 기반 (코딩·멀티모달·한국어 지원 등)
2. **최소·권장 사양** — 파라미터 수 → 필요 VRAM → "24GB 그래픽카드" 같은 등급. 최소는 4bit 양자화(로컬에서 처음 시도하는 기준), 권장은 원본 정밀도 그대로(대부분 16bit, DeepSeek 등은 8bit — safetensors의 주 dtype으로 판단)
3. **회사 사용** — 라이선스를 상업 사용 자유 / 조건부 / 불가로 분류
4. **인기** — 좋아요, 30일 다운로드, 이번 주 증가폭, 양자화 버전 수

---

## 2. 수집 로직 (`server/hf/`)

전부 HuggingFace 공개 API이고 키가 필요 없습니다(`HF_TOKEN`을 넣으면 한도만 넉넉해짐).

1. **후보 수집** `pipeline.js` — 카테고리별 pipeline_tag × 정렬 3종(trendingScore·downloads·likes)
   상위 100개씩, 합쳐서 약 1,500개 리포
2. **원본으로 묶기** `canonical.js` — 각 리포의 `baseModels` 계보를 따라 원본까지 올라감.
   목록에 없는 중간 조상은 계보만 따로 조회하고 디스크에 캐시
3. **보강** `enrich.js` — 원본(대표 리포)만 상세 조회: 파라미터(safetensors), 라이선스, 태그 → 특화,
   MoE 활성 파라미터, 양자화·파인튜닝 파생 수
4. **추이** `popularity.js` — 매일 스냅샷을 `server/data/hf-history/`에 남겨 주간 증가폭·추이 그래프 계산
5. **계열 묶기** — 크기만 다른 모델(Qwen3.8-0.8B/27B…)은 카드 한 장 + 크기 선택 칩

매일 새벽 3시 자동 실행, 서버가 꺼져 있었으면 켜질 때 따라잡습니다.

---

## 3. 설계상 중요한 판단들

### 3-1. 트렌딩 목록을 그대로 보여주지 않는다

2026-10 실측에서 HF 텍스트 생성 트렌딩 상위 40개 중 30개 이상이 **Qwen3.8-27B 하나의 개인 양자화·
파인튜닝 리포**(`...-GGUF`, `...-Uncensored`, `...-mlx-2bit`)였습니다. 그대로 보여주면 같은 모델이
수십 번 나옵니다. → 계보로 원본에 묶고, 파생 리포의 트렌딩 점수는 원본의 "지금 뜨는" 점수에 합산합니다.

### 3-2. 파생 리포 수 = 로컬에서 실제로 많이 돌린다는 신호

좋아요는 "관심", 다운로드는 서버 배포까지 섞인 숫자입니다. 다른 사람들이 GGUF 등 양자화 버전을
많이 만들었다는 건 그 모델을 **일반 PC에서 돌리려는 수요**가 있다는 가장 직접적인 증거라 카드에 표시합니다.

### 3-3. 성능 점수는 보여주지 않는다

HF Open LLM Leaderboard는 2025-03 이후 갱신이 멈췄고, 모델카드의 점수는 제공사가 스스로 고른
벤치마크라 서로 비교할 수 없습니다. 비교할 수 없는 숫자를 나란히 놓는 대신 인기·용도·하드웨어로 답합니다.

### 3-4. HF 익명 한도(5분 500건)

첫 수집은 약 1,400건을 불러 한도에 걸립니다. 429 응답의 `ratelimit` 헤더에서 리셋까지 남은 초를
읽어 기다렸다 이어갑니다. 상세는 `lastModified`가 같으면 캐시(`hf-details.json`)를, 파생 수는 3일
캐시를 써서 두 번째 실행부터 호출이 크게 줄어듭니다.

### 3-5. 파라미터 수는 믿을 수 있을 때만

`safetensors.total`은 리포 안 모든 텐서 합이라, BF16 원본과 FP8 사본이 한 리포에 있으면 두 배로
부풉니다. 주된 dtype이 90% 이상일 때만 쓰고, 아니면 이름(`27B`)에서 읽고, 그래도 없으면 비웁니다.

### 3-6. 권장 사양은 "원본 정밀도"로 계산한다

권장 사양 = 원본 그대로 돌릴 때 필요한 VRAM이라, 원본이 몇 bit인지가 중요합니다.
safetensors의 주 dtype으로 판단하는데, 처음엔 Qwen3.5-122B의 대표 리포로 제공사가 직접 올린
`…-FP8` 양자화본이 뽑혀(원본보다 다운로드가 많음) 권장 사양이 절반으로 계산됐습니다.
→ 공식 양자화본은 대표에서 뒤로 미루고, 이름이 `-FP8` 등으로 끝나면 계보 정보가 없어도 16bit 원본이
있는 것으로 봅니다. 처음부터 FP8로 공개한 DeepSeek·MiniMax·Kimi·GLM은 8bit로 계산됩니다.

### 3-7. 뉴스에 Google 뉴스 RSS는 쓰지 않는다

키 없이 되지만 약관상 개인·비상업 용도 전용이라 사내 포털에는 쓰지 않습니다. 공식 블로그 RSS가 기본이고,
`.env`에 Google Custom Search 키가 있으면 국내 기사를 섞습니다.

---

## 4. 실행 방법

```bash
npm install
npm run dev      # 프론트 (5173)
npm run server   # 백엔드 (3001)
```

배포(단일 프로세스): `npm run build` 후 `node server/index.js` → `http://localhost:3001`

처음 켜면 수집 결과가 없어서 자동으로 첫 수집을 시작합니다(10분 남짓). 진행 상황은 **관리** 탭에서 봅니다.
수집 결과·캐시·추이 기록(`server/data/hf-*`)은 git에 올리지 않습니다.
**추이 기록은 서버 한 곳에 쌓여야 의미가 있으니** 집·회사에서 각각 돌리기보다 상시 켜 둘 서버 한 곳을 정하는 걸 권장합니다.

### Cloud Foundry(TPCF) 배포

```bash
cf login -a <API 주소>
npm run deploy          # = npm run build && cf push  (manifest.yml 사용)
```

CF Node 빌드팩은 운영 의존성만 설치하고 Vite 빌드는 하지 않아서, **로컬에서 빌드한 `dist/`를 함께 올립니다**
(`.cfignore`가 `src/`·`node_modules/`·`.env`는 빼고 `dist/`는 남김). 그래서 `cf push`만 단독으로 하면
마지막으로 빌드한 화면이 올라갑니다 — 항상 `npm run deploy`를 쓰세요.

**Postgres 연결 (권장).** 컨테이너 디스크는 재시작·재배포 때마다 지워져서, DB 없이 올리면 매번 첫 수집부터 다시 하고
추이 기록이 쌓이지 않습니다. 마켓플레이스에 Postgres가 있으면:

```bash
cf marketplace                                       # 쓸 수 있는 Postgres 서비스·플랜 확인
cf create-service <postgres 서비스> <플랜> ai-portal-db
```

그다음 `manifest.yml`의 `services:` 주석을 풀고 다시 배포하면 됩니다. 바인딩 정보(`VCAP_SERVICES`)에서
접속 주소를 자동으로 찾고 `app_docs` 테이블을 스스로 만듭니다. 관리 탭에 "저장소: Postgres"로 표시되면 연결된 것입니다.
CF 밖의 DB를 쓰려면 `cf set-env ai-portal DATABASE_URL postgres://...`.

**사내 프록시.** 앱에서 huggingface.co로 직접 못 나가면 `manifest.yml`의 `HTTPS_PROXY`/`NO_PROXY` 주석을 풀어 넣습니다.
나가는지 확인: `cf ssh ai-portal -c "curl -sI https://huggingface.co | head -1"`

**운영 메모**
- 인스턴스는 1개로 둡니다. 수집 크론이 서버 안에서 돌아서 늘리면 수집이 중복됩니다
- `TZ=Asia/Seoul`이라 새벽 3시 수집과 일별 기록 날짜가 한국 시간 기준입니다
- 헬스체크는 `/api/health` (DB가 잠깐 끊겨도 앱을 재시작시키지 않음)
- 로그: `cf logs ai-portal --recent`

### 환경 변수 (`.env`, 전부 선택)

| 변수 | 용도 |
| --- | --- |
| `HF_TOKEN` | HF 읽기 토큰 — 한도가 넉넉해져 수집이 빨라짐 |
| `DATABASE_URL` | Postgres 주소. 없으면 CF 바인딩 → 그것도 없으면 `server/data/` 파일 |
| `HTTPS_PROXY`, `NO_PROXY` | 사내 프록시 |
| `TZ` | 수집 시각·기록 날짜 시간대 (기본 Asia/Seoul) |
| `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_CX` | 뉴스 탭에 국내 기사 추가 |
| `PORT` | 기본 3001 |

---

## 5. 주요 파일

```
server/
  index.js          Express 서버 + API + 정적 파일 서빙
  scheduler.js      매일 새벽 3시 수집 + 놓친 수집 따라잡기
  collector.js      수집 실행 상태(동시 실행 방지, 진행 로그)
  storage.js        저장소: 파일 또는 Postgres(바인딩 자동 감지)
  proxy.js          HTTPS_PROXY가 있으면 외부 요청을 프록시로
  hf/client.js      HF API 호출, 429 대기, 동시성 제한
manifest.yml        cf push 설정 / .cfignore  올리지 않을 파일
  hf/pipeline.js    수집 → 묶기 → 보강 → 추이 → 계열 → hf-models.json
  hf/canonical.js   계보 따라 원본 찾기
  hf/enrich.js      상세 조회·파라미터·라이선스·특화·파생 수
  hf/popularity.js  일별 스냅샷, 주간 증가폭
  hf/orgs.js        알려진 제공사·국내 기업 목록
  specialization.js 특화 태그 규칙
  news.js           공식 블로그 RSS + (선택) Google 검색

src/
  pages/            Trends, Finder, News, TermsGlossary, Admin
  components/       FamilyCard, CompareTable, Chips, TabNav, TermCard
  data/             paramTiers(VRAM 등급), license(라이선스 분류), terms.json
```

## 6. 알려진 한계

- **사양은 추정치** — 가중치 용량 + 20%(최소 4bit, 권장 원본 정밀도). 긴 문서를 넣으면 더 필요합니다
- **크기 미확인 모델** — safetensors가 없거나(pytorch_model.bin만 있는 오래된 리포) dtype이 섞인
  경우(DeepSeek의 FP8+INT8 혼합 등) 이름에도 크기가 없으면 비워둡니다
- **특화 태그는 제공사가 단 태그 기준** — 태그를 안 단 모델은 "범용"으로 나옵니다
- **한국어 성능은 판단하지 않음** — "한국어 지원"은 HF 언어 태그나 국내 기업 여부일 뿐 실제 품질이 아닙니다
