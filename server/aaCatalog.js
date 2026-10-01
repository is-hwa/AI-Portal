import { readFile, writeFile } from 'fs/promises'
import { fetchAllLanguageModels, isConfigured, toResultShape } from './aaApi.js'
import { readModels, AA_CACHE_PATH } from './store.js'
import { getTrendingOpenModels } from './huggingface.js'
import { isOpenSourceEntry, isApiEntry } from './openSourceRules.js'
import { verifyOpenWeights } from './hfParamLookup.js'
import { normalize, stripVariantSuffix } from './modelNames.js'

// AA 전체 카탈로그(656여개)는 페이지당 요청 1건이라 한 번 받는 데 7건쯤 쓴다.
// 무료 티어가 하루 100건이라 메모리 캐시만 두면 서버를 몇 번 재시작하는 것만으로
// 한도가 날아간다(실제로 개발 중에 429를 맞았다). 디스크에 남겨서 재시작해도
// 유지되게 한다.
const TTL_MS = 6 * 60 * 60 * 1000

let memo = null

async function readDiskCache() {
  try {
    const raw = await readFile(AA_CACHE_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.fetchedAt < TTL_MS) return parsed.data
  } catch {
    // 캐시 없음/손상 — 새로 받으면 된다
  }
  return null
}

export async function getCatalog() {
  if (!isConfigured()) return []
  if (memo && Date.now() - memo.at < TTL_MS) return memo.data

  const cached = await readDiskCache()
  if (cached) {
    memo = { data: cached, at: Date.now() }
    return cached
  }

  const data = await fetchAllLanguageModels()
  memo = { data, at: Date.now() }
  await writeFile(AA_CACHE_PATH, JSON.stringify({ fetchedAt: Date.now(), data }), 'utf-8').catch(
    () => {},
  )
  return data
}

// HuggingFace id("org/ModelName")를 AA 카탈로그와 대조해서 매칭되는 항목을 찾는다.
// 정확 일치 우선, 안 되면 앞부분 일치로 완화. 못 찾으면 null.
function matchInCatalog(hfId, catalog) {
  const modelPart = hfId.includes('/') ? hfId.split('/').slice(1).join('/') : hfId
  const target = normalize(modelPart)
  if (!target) return null

  let best = null
  for (const entry of catalog) {
    const baseName = stripVariantSuffix(entry.name)
    const n = normalize(baseName)
    if (n === target) return entry // 정확 일치는 바로 확정
    if (!best && (n.startsWith(target) || target.startsWith(n)) && target.length >= 4) {
      best = entry
    }
  }
  return best
}

// HuggingFace에서 지금 뜨는 오픈소스 모델 중, AA 순위권(카탈로그 매칭)에 있으면서
// 아직 우리 비교표(models.json)엔 없는 것들을 찾는다 — "새 오픈소스 모델이 나와서
// 순위권에 있으면 자동으로 추가 후보로 올리기"에 해당하는 부분.
export async function detectNewOpenSourceModels() {
  if (!isConfigured()) return []

  const [catalog, trending, tracked] = await Promise.all([
    getCatalog(),
    getTrendingOpenModels({ limit: 15, minLikes: 50 }),
    readModels(),
  ])
  if (catalog.length === 0) return []

  const trackedSlugs = new Set(tracked.map((m) => m.aa_slug).filter(Boolean))
  const trackedNames = new Set(tracked.map((m) => normalize(m.name)))

  const seen = new Set()
  const candidates = []
  for (const item of trending) {
    const match = matchInCatalog(item.id, catalog)
    if (!match) continue
    if (trackedSlugs.has(match.slug)) continue
    const baseName = stripVariantSuffix(match.name)
    if (trackedNames.has(normalize(baseName))) continue
    if (seen.has(match.slug)) continue
    seen.add(match.slug)

    const shaped = toResultShape(match)
    candidates.push({
      name: match.name,
      provider: match.model_creator?.name ?? '알 수 없음',
      slug: match.slug,
      hfId: item.id,
      hfUrl: item.url,
      likes: item.likes,
      downloads: item.downloads,
      data: shaped,
    })
  }

  candidates.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))
  return candidates
}

const intelligenceOf = (e) => e.evaluations?.artificial_analysis_intelligence_index ?? 0
const inputPriceOf = (e) => e.pricing?.price_1m_input_tokens
const byIntelligenceDesc = (a, b) => intelligenceOf(b) - intelligenceOf(a)

// 카탈로그를 "제공사별 대표 모델 목록"으로 압축한다. 같은 모델의 변형(추론 강도
// 표기만 다른 것들)은 한 묶음으로 보고 지능지수가 가장 높은 하나만 남기며,
// 이미 추적 중인 모델은 제외한다. 오픈소스 스캔과 API 스캔이 공유하는 부분.
function groupCandidatesByProvider(catalog, tracked, accept) {
  const trackedSlugs = new Set(tracked.map((m) => m.aa_slug).filter(Boolean))
  const trackedNames = new Set(tracked.map((m) => normalize(m.name)))

  const groups = {} // "provider::baseName" -> AA entries (variant들)
  for (const entry of catalog) {
    if (!accept(entry)) continue
    if (trackedSlugs.has(entry.slug)) continue
    const baseName = stripVariantSuffix(entry.name)
    if (trackedNames.has(normalize(baseName))) continue

    const key = `${entry.model_creator?.name}::${normalize(baseName)}`
    ;(groups[key] ??= []).push(entry)
  }

  const byProvider = {}
  for (const variants of Object.values(groups)) {
    const best = [...variants].sort(byIntelligenceDesc)[0]
    const provider = best.model_creator?.name ?? '알 수 없음'
    ;(byProvider[provider] ??= []).push(best)
  }
  return byProvider
}

// 수동 실행용 "백필" — AA 카탈로그 전체(656여개)를 오픈소스 규칙으로 직접 걸러서
// 후보를 뽑는다. HuggingFace 트렌딩을 거치지 않으므로 Qwen·Mistral·GLM처럼 이미
// 유명해서 더 이상 "트렌딩"엔 안 뜨는 모델도 잡힌다. 매일 밤 자동 실행에는 안
// 넣는다 — 한 번에 수십 건이 나올 수 있어 리뷰 큐가 넘칠 수 있어서 버튼으로만 실행.
const MAX_PER_PROVIDER = 3

export async function scanOpenSourceCatalog() {
  if (!isConfigured()) return []

  const [catalog, tracked] = await Promise.all([getCatalog(), readModels()])
  if (catalog.length === 0) return []

  const byProvider = groupCandidatesByProvider(catalog, tracked, isOpenSourceEntry)

  const candidates = []
  for (const [provider, entries] of Object.entries(byProvider)) {
    for (const entry of [...entries].sort(byIntelligenceDesc).slice(0, MAX_PER_PROVIDER)) {
      const shaped = toResultShape(entry)
      // 제공사 규칙만으로는 "Qwen3.8 Max"처럼 가중치 비공개인 상용 티어도 통과한다.
      // 후보에서 아예 빼지는 않고 표시만 해서, 검토 큐에서 사람이 판단하게 둔다
      // (제공사→HF 조직 매핑이 없는 신규 제공사도 무조건 탈락시키지 않기 위함).
      const weights = await verifyOpenWeights(provider, entry.name)
      candidates.push({
        name: entry.name,
        provider,
        slug: entry.slug,
        data: shaped,
        weightsVerified: weights.verified,
        hfId: weights.hfId,
        hfUrl: weights.hfUrl,
        license: weights.license,
        tags: weights.tags,
        pipelineTag: weights.pipelineTag,
      })
    }
  }

  candidates.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))
  return candidates
}

// API 모델 쪽 백필. 오픈소스와 달리 "제공사별 최상위"만 뽑으면 플래그십만 모여서
// 정작 실무에서 제일 많이 쓰는 저가 티어(Haiku/mini/Flash 급)가 통째로 빠진다.
// 그래서 제공사마다 지능지수 상위 2개 + 입력가격 최저 2개를 같이 뽑는다.
const TOP_PER_PROVIDER = 2
const CHEAP_PER_PROVIDER = 2

export async function scanApiCatalog() {
  if (!isConfigured()) return []

  const [catalog, tracked] = await Promise.all([getCatalog(), readModels()])
  if (catalog.length === 0) return []

  const byProvider = groupCandidatesByProvider(catalog, tracked, isApiEntry)

  const candidates = []
  for (const [provider, entries] of Object.entries(byProvider)) {
    const top = [...entries].sort(byIntelligenceDesc).slice(0, TOP_PER_PROVIDER)
    // 가격 0은 실제로 공짜라는 뜻이 아니라 AA가 가격을 안 잡은 경우라서
    // (Cohere Command A+ 등) 최저가로 뽑으면 엉뚱한 모델이 올라온다.
    const cheap = entries
      .filter((e) => inputPriceOf(e) > 0)
      .sort((a, b) => inputPriceOf(a) - inputPriceOf(b))
      .slice(0, CHEAP_PER_PROVIDER)

    const picked = new Map()
    for (const entry of [...top, ...cheap]) picked.set(entry.slug, entry)

    for (const entry of picked.values()) {
      candidates.push({
        name: entry.name,
        provider,
        slug: entry.slug,
        data: toResultShape(entry),
      })
    }
  }

  candidates.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))
  return candidates
}

export async function enrichWithAaData(items) {
  const catalog = await getCatalog()
  if (catalog.length === 0) return items.map((item) => ({ ...item, aa: null }))

  return items.map((item) => {
    const match = matchInCatalog(item.id, catalog)
    if (!match) return { ...item, aa: null }
    const shaped = toResultShape(match)
    return {
      ...item,
      aa: {
        intelligenceIndex: shaped.intelligenceIndex,
        codingIndex: shaped.codingIndex,
        agenticIndex: shaped.agenticIndex,
        outputTokensPerSec: shaped.outputTokensPerSec,
        inputPricePer1m: shaped.inputPricePer1m,
        outputPricePer1m: shaped.outputPricePer1m,
        url: shaped.url,
      },
    }
  })
}
