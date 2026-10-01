import { readModels } from './store.js'
import { fetchAllLanguageModels, isConfigured, toResultShape } from './aaApi.js'
import { stripVariantSuffix, candidateKey } from './modelNames.js'

// AA_API_KEY가 있을 때만 가능 — 스크래퍼(헤드리스 브라우저)는 이미 아는 slug만
// 방문할 수 있어서 "모르는 새 모델"을 애초에 발견할 수 없다. 공식 API는 전체
// 목록(600여개)을 주기 때문에, 우리가 추적 중인 제공사에서 우리가 가진 것보다
// 최신 release_date를 가진 모델을 찾아 "새로 나왔을 가능성"으로 표시한다.
export function isAvailable() {
  return isConfigured()
}

// 제공사당 지능지수가 가장 높은 신규 항목 하나만 "주력 후보"로 올리고, 나머지
// (같은 제공사에서 나온 하위 등급/변형 라인업)는 "마이너"로 따로 묶는다.
// 예: DeepSeek에서 V4.1 Flash, V4 Pro 0813, V4 Flash Vision 등이 한꺼번에 잡히면
// 그중 지수 1등만 주력 후보, 나머지는 마이너 쪽에 모아서 서로 비교해볼 수 있게 한다.
export async function detectNewAaModels() {
  const models = await readModels()

  // 우리 데이터의 출시일은 "YYYY-MM"까지만 있어서, 예전처럼 "최신 월보다 늦게 나왔나"로
  // 판단하면 같은 달에 나온 신모델을 전부 놓친다(Claude Fable 5.1과 같은 2026-09에 나온
  // Claude Opus 5.5가 실제로 누락됐다). 그래서 같은 달까지 포함하고, 대신 "이미 추적 중인가"를
  // 이름·slug로 직접 확인해서 걸러낸다.
  const latestByProvider = {}
  for (const m of models) {
    if (!m.release_date) continue
    const cur = latestByProvider[m.provider]
    if (!cur || m.release_date > cur) latestByProvider[m.provider] = m.release_date
  }
  const trackedSlugs = new Set(models.map((m) => m.aa_slug).filter(Boolean))
  const trackedKeys = new Set(models.map((m) => candidateKey(m.name)))

  const all = await fetchAllLanguageModels()

  // 같은 모델의 추론 강도 변형(Max/High/Low Effort 등)이 여러 줄로 잡히므로 기본 이름으로
  // 묶고, 그중 지능지수가 가장 높은 변형을 대표로 쓴다.
  const bestByBase = new Map()
  for (const entry of all) {
    const provider = entry.model_creator?.name
    const baseline = latestByProvider[provider]
    if (!baseline) continue // 우리가 추적하지 않는 제공사는 스킵
    if (!entry.release_date || entry.release_date.slice(0, 7) < baseline) continue
    if (trackedSlugs.has(entry.slug) || trackedKeys.has(candidateKey(entry.name))) continue

    const key = `${provider}:${candidateKey(entry.name)}`
    const cur = bestByBase.get(key)
    const score = (e) => e.evaluations?.artificial_analysis_intelligence_index ?? 0
    if (!cur || score(entry) > score(cur)) bestByBase.set(key, entry)
  }

  const byProvider = {}
  for (const entry of bestByBase.values()) {
    const provider = entry.model_creator.name
    ;(byProvider[provider] ??= []).push({
      name: entry.name,
      baseName: stripVariantSuffix(entry.name),
      provider,
      slug: entry.slug,
      releaseDate: entry.release_date.slice(0, 7),
      data: toResultShape(entry),
    })
  }

  const primary = []
  const minor = []
  for (const list of Object.values(byProvider)) {
    list.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))
    primary.push(list[0])
    minor.push(...list.slice(1))
  }

  primary.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))
  minor.sort((a, b) => (b.data.intelligenceIndex ?? 0) - (a.data.intelligenceIndex ?? 0))

  return { primary, minor: minor.slice(0, 15) }
}
