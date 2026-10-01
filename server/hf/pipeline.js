import { getDoc, putDoc } from '../storage.js'
import { listModels, mapLimit } from './client.js'
import { fillLineage, groupByRoot } from './canonical.js'
import { enrichGroup, addDerivativeCounts } from './enrich.js'
import { writeSnapshot, attachTrends } from './popularity.js'
import { KNOWN_ORGS, orgOf } from './orgs.js'

// 저장소 키 (storage.js — 로컬은 server/data/<키>.json, 배포 시 Postgres)
const MODELS_KEY = 'hf-models'
const LINEAGE_KEY = 'hf-lineage'
const HIDDEN_KEY = 'hf-hidden'
const DETAIL_CACHE_KEY = 'hf-details'

// 화면의 카테고리 하나가 HF pipeline_tag 여러 개에 대응한다. 비전 LLM(Qwen3.8 등)은
// HF에서 image-text-to-text로 분류되지만 쓰임새는 LLM이라 같은 칸에 넣는다.
export const CATEGORIES = [
  { id: 'llm', label: 'LLM (대화·코딩)', pipelines: ['text-generation', 'image-text-to-text'] },
  { id: 'embedding', label: '임베딩·RAG', pipelines: ['sentence-similarity', 'text-ranking'] },
  { id: 'speech', label: '음성', pipelines: ['automatic-speech-recognition', 'text-to-speech'] },
  { id: 'image', label: '이미지 생성', pipelines: ['text-to-image'] },
]

// trendingScore = 지금 뜨는 것, downloads = 최근 30일 실사용, likes = 누적 신뢰.
// 셋 중 하나에만 걸리는 모델도 있어서 합집합으로 후보를 모은다.
const SORTS = ['trendingScore', 'downloads', 'likes']

// 계열 하나에 크기만 다른 모델이 여럿이다(Qwen3.8-0.8B/4B/27B). 카드를 계열 단위로
// 묶으려고 이름에서 크기·튜닝 표기를 뗀다.
export function familyName(name) {
  return (
    name
      .replace(/[-_ ](A\d+(?:\.\d+)?B)(?![a-zA-Z])/gi, '')
      .replace(/[-_ ]?\d+(?:\.\d+)?[BMT](?![a-zA-Z])/gi, '')
      .replace(/[-_ ](instruct|it|chat|base|hf|thinking|fp8|bf16)(?=[-_ ]|$)/gi, '')
      .replace(/[-_ ]+$/g, '') || name
  )
}

const EMPTY_RESULT = {
  updatedAt: null,
  categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
  families: [],
}

export function readHfModels() {
  return getDoc(MODELS_KEY, EMPTY_RESULT)
}

export function readHidden() {
  return getDoc(HIDDEN_KEY, [])
}

export function writeHidden(ids) {
  return putDoc(HIDDEN_KEY, ids)
}

function categoryOf(pipelineTag) {
  return CATEGORIES.find((c) => c.pipelines.includes(pipelineTag))?.id ?? null
}

// 파생 리포만 잔뜩 있고 원본 자체는 별 반응이 없는 경우, 혹은 개인이 올린 단발성
// 리포는 노출하지 않는다. 알려진 조직의 모델은 막 나와서 좋아요가 적어도 보여준다.
function worthEnriching(group) {
  const officialLikes = Math.max(0, ...group.official.map((m) => m.likes ?? 0))
  return (
    orgOf(group.root) in KNOWN_ORGS ||
    officialLikes >= 50 ||
    group.buzz >= 30 ||
    group.derivatives.length >= 3
  )
}

function worthShowing(model) {
  return model.knownOrg ? model.likes >= 5 : model.likes >= 30
}

function buildFamilies(models) {
  const families = new Map()
  for (const m of models) {
    const key = `${m.org}/${familyName(m.name).toLowerCase()}`
    if (!families.has(key)) {
      families.set(key, { key, name: familyName(m.name), org: m.org, provider: m.provider, members: [] })
    }
    families.get(key).members.push(m)
  }

  return [...families.values()].map((f) => {
    f.members.sort((a, b) => (a.paramsB ?? Infinity) - (b.paramsB ?? Infinity))
    const sum = (pick) => f.members.reduce((s, m) => s + (pick(m) ?? 0), 0)
    const withTrend = f.members.filter((m) => m.trend)
    return {
      ...f,
      category: f.members[0].category,
      korean: f.members.some((m) => m.korean),
      knownOrg: f.members.some((m) => m.knownOrg),
      buzz: sum((m) => m.buzz),
      likes: Math.max(...f.members.map((m) => m.likes)),
      downloads: sum((m) => m.downloads),
      createdAt: f.members.map((m) => m.createdAt).filter(Boolean).sort().at(-1) ?? null,
      trend: withTrend.length
        ? { days: withTrend[0].trend.days, likes: sum((m) => m.trend?.likes) }
        : null,
    }
  })
}

export async function runHfCollect({ onProgress = () => {} } = {}) {
  const startedAt = Date.now()
  const hidden = new Set(await readHidden())

  onProgress('HF 목록 수집 중')
  const jobs = CATEGORIES.flatMap((c) =>
    c.pipelines.flatMap((pipelineTag) => SORTS.map((sort) => ({ pipelineTag, sort }))),
  )
  const lists = await mapLimit(jobs, 4, (job) => listModels({ ...job, limit: 100 }))
  const byId = new Map()
  for (const list of lists) for (const m of list ?? []) byId.set(m.id, m)
  const raw = [...byId.values()]
  onProgress(`리포 ${raw.length}개 수집`)

  onProgress('계보 확인 중 (파생 리포 → 원본)')
  const lineage = await fillLineage(raw, await getDoc(LINEAGE_KEY, {}))
  await putDoc(LINEAGE_KEY, Object.fromEntries(lineage))

  const groups = groupByRoot(raw, lineage).filter(
    (g) => worthEnriching(g) && !hidden.has(g.root) && !hidden.has(g.repId),
  )
  onProgress(`원본 모델 ${groups.length}개로 정리, 상세 조회 중`)

  const detailCache = await getDoc(DETAIL_CACHE_KEY, {})
  const enriched = await mapLimit(groups, 6, (g) => enrichGroup(g, detailCache).catch(() => null))
  const models = enriched
    .filter(Boolean)
    .map((m) => ({ ...m, category: categoryOf(m.pipelineTag) }))
    .filter((m) => m.category && worthShowing(m) && !hidden.has(m.id))

  // 파생 수는 카테고리별 화제성 상위 모델만 센다(모델당 호출 2번).
  const ranked = CATEGORIES.flatMap((c) =>
    models
      .filter((m) => m.category === c.id)
      .sort((a, b) => b.buzz - a.buzz || b.downloads - a.downloads)
      .slice(0, c.id === 'llm' ? 80 : 30),
  )
  onProgress(`파생 리포 수 집계 중 (${ranked.length}개)`)
  await mapLimit(ranked, 4, (m) => addDerivativeCounts(m, detailCache))
  await putDoc(DETAIL_CACHE_KEY, detailCache)

  await attachTrends(models)
  await writeSnapshot(models)

  const result = {
    updatedAt: new Date().toISOString(),
    durationSec: Math.round((Date.now() - startedAt) / 1000),
    scannedRepos: raw.length,
    categories: CATEGORIES.map(({ id, label }) => ({ id, label })),
    families: buildFamilies(models),
  }
  await putDoc(MODELS_KEY, result)
  onProgress(`완료 — 모델 ${models.length}개 / 계열 ${result.families.length}개`)
  return result
}
