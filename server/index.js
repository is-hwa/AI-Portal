import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import {
  readModels,
  writeModels,
  readPending,
  writePending,
  dropDismissed,
  isCandidate,
  readAutoLog,
} from './store.js'
import { candidateKey } from './modelNames.js'
import { resolveDeployment, applyUpdate, addAaModel } from './applyItem.js'
import { runResearch, researchOneModel } from './research.js'
import { startScheduler } from './scheduler.js'
import { getTrendingOpenModels, getTrendingEmbeddingModels } from './huggingface.js'
import { enrichWithAaData, scanOpenSourceCatalog, scanApiCatalog } from './aaCatalog.js'
import { lookupParamsBFromHf, verifyOpenWeights } from './hfParamLookup.js'
import { inferSpecialization, cheapPriceThreshold } from './specialization.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001

app.get('/api/models', async (_req, res) => {
  res.json(await readModels())
})

// 사람 확인 없이 자동으로 반영된 내역(최신순).
app.get('/api/auto-applied', async (_req, res) => {
  res.json(await readAutoLog())
})

app.get('/api/pending', async (_req, res) => {
  res.json(await readPending())
})

// API 키 불필요 — 허깅페이스 공개 API로 오픈소스 신규/트렌딩 모델만 감지.
// AA_API_KEY가 있으면 AA 전체 카탈로그(656여개)와 이름을 대조해서 매칭되면
// 실제 성능 지수·가격까지 붙여준다(무료 티어, 캐시 사용).
app.get('/api/trending-open-models', async (_req, res) => {
  try {
    const items = await getTrendingOpenModels()
    res.json(await enrichWithAaData(items))
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

// API 키 불필요 — 검색·RAG용 임베딩 모델 트렌드
app.get('/api/trending-embedding-models', async (_req, res) => {
  try {
    res.json(await getTrendingEmbeddingModels())
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

app.post('/api/research/run-now', async (_req, res) => {
  try {
    const result = await runResearch()
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

function toPendingItem(type, c) {
  return {
    type,
    name: c.name,
    provider: c.provider,
    slug: c.slug,
    releaseDate: c.data.releaseDate,
    intelligenceIndex: c.data.intelligenceIndex,
    inputPricePer1m: c.data.inputPricePer1m,
    url: c.data.url,
    data: c.data,
    weightsVerified: c.weightsVerified,
    hfId: c.hfId,
    hfUrl: c.hfUrl,
    license: c.license,
    tags: c.tags,
    pipelineTag: c.pipelineTag,
    status: 'info',
    checkedAt: new Date().toISOString(),
  }
}

function addDismissed(dismissed, name) {
  return [...new Set([...dismissed, candidateKey(name)])]
}

// 비교표에서 지운 모델도 다음 점검 때 "신규"로 되살아나지 않게 기록해 둔다.
async function rememberDismissed(name) {
  const pending = await readPending()
  pending.dismissed = addDismissed(pending.dismissed, name)
  pending.items = pending.items.filter((i) => !(isCandidate(i) && i.name === name))
  await writePending(pending)
}

async function mergeIntoPending(newItems) {
  const pending = await readPending()
  const existingNames = new Set(pending.items.map((i) => i.name))
  const fresh = dropDismissed(newItems, pending.dismissed).filter((i) => !existingNames.has(i.name))
  const next = { ...pending, items: [...pending.items, ...fresh] }
  await writePending(next)
  return next
}

// 수동 실행 전용(매일 밤 자동 실행엔 안 들어감) — AA 카탈로그 전체를 오픈소스
// 규칙으로 직접 훑어서 한 번에 후보를 채워넣는 백필. 제공사당 최대 3개까지.
app.post('/api/opensource/scan-catalog', async (_req, res) => {
  try {
    const candidates = await scanOpenSourceCatalog()
    const newItems = candidates.map((c) => toPendingItem('aa-new-opensource', c))
    res.json({ ok: true, added: newItems.length, pending: await mergeIntoPending(newItems) })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

// 같은 백필을 API 모델 쪽으로. 제공사당 지능지수 상위 2개 + 최저가 2개를 뽑아서
// 플래그십만 모이지 않고 저가 티어도 같이 올라오게 한다.
app.post('/api/models/scan-api-catalog', async (_req, res) => {
  try {
    const candidates = await scanApiCatalog()
    const newItems = candidates.map((c) => toPendingItem('aa-new-api', c))
    res.json({ ok: true, added: newItems.length, pending: await mergeIntoPending(newItems) })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

// 수동 실행 전용 — 이름에 크기가 안 박혀있어 params_b가 비어있는 모델들을
// HuggingFace 공개 API로 하나씩 찾아 채운다. 제공사→HF 조직 매핑이 있고,
// 이름이 실제로 매칭되고, dtype이 하나뿐이라 신뢰 가능한 경우에만 채움.
app.post('/api/opensource/backfill-params', async (_req, res) => {
  try {
    const models = await readModels()
    const targets = models.filter((m) => m.deployment === 'open_source' && m.params_b == null)
    let filled = 0
    for (const m of targets) {
      const paramsB = await lookupParamsBFromHf(m.provider, m.name)
      if (paramsB != null) {
        m.params_b = paramsB
        filled++
      }
    }
    await writeModels(models)
    res.json({ ok: true, checked: targets.length, filled })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

app.post('/api/pending/apply', async (req, res) => {
  const { name } = req.body
  const pending = await readPending()
  const item = pending.items.find((i) => i.name === name && i.status !== 'applied')
  if (!item) return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' })

  const models = await readModels()

  try {
    if (item.type === 'update') {
      if (!applyUpdate(models, item)) return res.status(404).json({ error: '모델을 찾을 수 없습니다' })
    } else if (item.type === 'new') {
      const stub = { name: item.name, provider: item.provider, benchmarks: {}, pricing: {} }
      const outcome = await researchOneModel(stub)
      if (outcome.status !== 'ok') {
        return res.status(422).json({ error: outcome.reason ?? '리서치에 실패했습니다' })
      }
      const result = outcome.result
      models.push({
        name: item.name,
        provider: item.provider,
        deployment: (await resolveDeployment(item.provider, item.name)).deployment,
        release_date: result.release_date,
        benchmarks: result.benchmarks,
        speed: result.speed,
        pricing: result.pricing,
        context_window: result.context_window,
        specialization: result.specialization,
        description: result.description,
      })
    } else if (item.type.startsWith('aa-new')) {
      await addAaModel(models, item)
    }

    await writeModels(models)
    item.status = 'applied'
    await writePending(pending)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

// 이미 추적 중인 오픈소스 모델들의 가중치 공개 여부를 HuggingFace로 전수 확인한다.
// 값만 갱신하고 삭제는 하지 않는다 — 어떤 걸 뺄지는 사람이 목록 보고 판단.
app.post('/api/opensource/verify-weights', async (_req, res) => {
  try {
    const models = await readModels()
    const targets = models.filter((m) => m.deployment === 'open_source')
    const cheapPriceMax = cheapPriceThreshold(targets)
    for (const m of targets) {
      const weights = await verifyOpenWeights(m.provider, m.name)
      m.weights_verified = weights.verified
      m.hf_id = weights.hfId
      m.hf_url = weights.hfUrl
      m.license = weights.license
      m.hf_tags = weights.tags ?? []
      m.specialization = inferSpecialization(m, weights, { cheapPriceMax })
    }
    await writeModels(models)
    const unverified = targets.filter((m) => !m.weights_verified).map((m) => m.name)
    res.json({ ok: true, checked: targets.length, unverified })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

// 모델 이름에 공백·괄호가 섞여 있어서 URL 경로 파라미터 대신 본문으로 받는다.
app.post('/api/models/delete', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: '모델명이 필요합니다' })
  try {
    const models = await readModels()
    const next = models.filter((m) => m.name !== name)
    if (next.length === models.length) {
      return res.status(404).json({ error: '모델을 찾을 수 없습니다' })
    }
    await writeModels(next)
    await rememberDismissed(name)
    res.json({ ok: true, remaining: next.length })
  } catch (err) {
    res.status(500).json({ error: String(err.message ?? err) })
  }
})

app.post('/api/pending/dismiss', async (req, res) => {
  const { name } = req.body
  const pending = await readPending()
  const item = pending.items.find((i) => i.name === name)
  pending.items = pending.items.filter((i) => i.name !== name)
  if (item && isCandidate(item)) pending.dismissed = addDismissed(pending.dismissed, name)
  await writePending(pending)
  res.json({ ok: true })
})

// 빌드된 프론트를 같은 서버에서 서빙한다. 프론트가 /api/models를 런타임에 부르게
// 바뀐 뒤로 개발 중엔 Vite 프록시가 이걸 대신해줬지만, 배포본엔 프록시가 없어서
// 정적 파일만 올리면 API 호출이 갈 곳이 없다(=항상 번들 스냅샷으로 폴백).
// 이렇게 두면 `npm run build` 후 `node server/index.js` 하나로 프론트+API가 함께 뜬다.
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(DIST_DIR))

// API가 아닌 경로는 전부 SPA 진입점으로 — 새로고침해도 화면이 뜨게.
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} 에서 실행 중`)
  if (!process.env.PRIVATE_AI_BASE_URL) {
    console.warn(
      '[server] PRIVATE_AI_BASE_URL이 없습니다 — 리서치 기능은 .env에 사내 Private AI 주소를 넣기 전까지 동작하지 않습니다.',
    )
  }
  startScheduler()
})
