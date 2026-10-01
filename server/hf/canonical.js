import { getBaseModels, mapLimit } from './client.js'
import { orgOf } from './orgs.js'

// 트렌딩 목록을 그대로 보여주면 상위권 대부분이 한 원본 모델(예: Qwen3.8-27B)의
// 개인 양자화·파인튜닝 리포로 채워진다(2026-10 실측: 상위 40개 중 30개 이상).
// 각 리포를 계보(baseModels)를 따라 원본까지 거슬러 올라가 묶는 것이 이 포털의
// 핵심 정제 단계다. 파생 리포가 많다는 건 그 원본을 로컬에서 많이 돌린다는 신호라
// 버리지 않고 원본의 인기 근거로 합산한다.

const MAX_DEPTH = 6

export function parentOf(raw) {
  const first = raw?.baseModels?.models?.[0]
  if (!first) return null
  return { id: first.id, relation: raw.baseModels.relation ?? 'finetune' }
}

// 목록에 없는 중간 조상(예: GGUF → 커뮤니티 파인튜닝 → 원본)은 계보만 따로 조회한다.
// 계보는 거의 안 바뀌므로 디스크 캐시(lineageCache)에 남겨 다음 실행에 재사용한다.
export async function fillLineage(rawModels, lineageCache, { maxLookups = 400 } = {}) {
  const lineage = new Map(Object.entries(lineageCache))
  for (const m of rawModels) lineage.set(m.id, parentOf(m))

  let lookups = 0
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const missing = new Set()
    for (const parent of lineage.values()) {
      if (parent && !lineage.has(parent.id)) missing.add(parent.id)
    }
    const batch = [...missing].slice(0, maxLookups - lookups)
    if (batch.length === 0) break
    lookups += batch.length
    const fetched = await mapLimit(batch, 6, (id) => getBaseModels(id).catch(() => null))
    batch.forEach((id, i) => lineage.set(id, parentOf(fetched[i])))
  }
  return lineage
}

export function resolveRoot(id, lineage) {
  const seen = new Set([id])
  let current = id
  for (let i = 0; i < MAX_DEPTH; i++) {
    const parent = lineage.get(current)
    if (!parent || seen.has(parent.id)) break
    seen.add(parent.id)
    current = parent.id
  }
  return current
}

// 원본별로 리포를 묶는다. 원본과 같은 조직이 올린 변형(Base → Instruct)은 "공식",
// 다른 조직이 올린 건 "파생"이다.
export function groupByRoot(rawModels, lineage) {
  const groups = new Map()
  for (const m of rawModels) {
    const root = resolveRoot(m.id, lineage)
    if (!groups.has(root)) groups.set(root, { root, official: [], derivatives: [] })
    const group = groups.get(root)
    const relation = lineage.get(m.id)?.relation ?? null
    if (orgOf(m.id) === orgOf(root)) group.official.push(m)
    else group.derivatives.push({ ...m, relation })
  }

  for (const group of groups.values()) {
    // 대표 리포: 사람들이 실제로 받는 건 대개 Base가 아니라 Instruct라서 공식 리포 중
    // 다운로드가 가장 많은 것을 쓴다. 단 제공사가 직접 올린 양자화본(…-FP8)은 원본보다
    // 다운로드가 많아도 뒤로 미룬다 — 대표로 뽑히면 "원본 정밀도"가 8bit로 잘못 잡혀
    // 권장 사양이 절반으로 계산된다. 공식 리포가 목록에 하나도 없으면 원본 자체.
    const isQuantized = (m) => lineage.get(m.id)?.relation === 'quantized'
    group.official.sort(
      (a, b) => isQuantized(a) - isQuantized(b) || (b.downloads ?? 0) - (a.downloads ?? 0),
    )
    // 목록에 공식 양자화본만 걸리고 원본은 안 걸린 경우(…-122B-A10B-FP8만 트렌딩)엔
    // 원본 리포를 대표로 삼는다.
    const first = group.official[0]
    group.repId = first && !isQuantized(first) ? first.id : group.root
    group.buzz = [...group.official, ...group.derivatives].reduce(
      (sum, m) => sum + (m.trendingScore ?? 0),
      0,
    )
    group.derivatives.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0))
  }
  return [...groups.values()]
}
