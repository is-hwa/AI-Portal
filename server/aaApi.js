import { parseParamCount } from './paramParser.js'

const BASE = 'https://artificialanalysis.ai/api/v2'

// 공식 Artificial Analysis Data API. 무료 티어: 하루 100건, /language/models/free
// 엔드포인트로 헤드라인 지수·중간 성능·입출력 가격을 준다(컨텍스트 윈도우는 무료
// 티어에서 제외됨 — 문서에 명시돼 있음). x-api-key 헤더 하나로 인증.
export function isConfigured() {
  return Boolean(process.env.AA_API_KEY)
}

export async function fetchAllLanguageModels() {
  const apiKey = process.env.AA_API_KEY
  if (!apiKey) throw new Error('AA_API_KEY가 설정되지 않았습니다 (.env.example 참고)')

  let page = 1
  const all = []
  while (true) {
    const res = await fetch(`${BASE}/language/models/free?page=${page}`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Artificial Analysis API 오류 (${res.status}): ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    all.push(...(json.data ?? []))
    if (!json.pagination?.has_more) break
    page += 1
  }
  return all
}

const secToMs = (s) => (s != null ? Math.round(s * 1000) : null)

// AA는 호스팅 API 가격이 없는 모델(주로 직접 받아 쓰는 오픈 웨이트 계열)에 0을 넣는다.
// 카탈로그 673개 중 23개가 입력·출력 모두 정확히 0인데, 이걸 그대로 두면 화면에
// "$0"으로 찍혀서 공짜라고 주장하는 꼴이 된다. 모른다고 표시하는 쪽이 맞다.
const priceOrNull = (p) => (p == null || p === 0 ? null : p)

export function toResultShape(m) {
  return {
    status: 'ok',
    intelligenceIndex: m.evaluations?.artificial_analysis_intelligence_index ?? null,
    codingIndex: m.evaluations?.artificial_analysis_coding_index ?? null,
    agenticIndex: m.evaluations?.artificial_analysis_agentic_index ?? null,
    outputTokensPerSec: m.performance?.median_output_tokens_per_second ?? null,
    ttftMs: secToMs(m.performance?.median_time_to_first_token_seconds),
    // 추론 모델은 "생각" 토큰과 "답변" 토큰이 갈리기 때문에 TTFT(첫 토큰)와
    // TTFA(첫 "답변" 토큰)가 크게 다를 수 있음 — 둘 다 잡아서 구분해서 보여준다.
    ttfaMs: secToMs(m.performance?.median_time_to_first_answer_token_seconds),
    e2eResponseMs: secToMs(m.performance?.median_end_to_end_response_time_seconds),
    inputPricePer1m: priceOrNull(m.pricing?.price_1m_input_tokens),
    outputPricePer1m: priceOrNull(m.pricing?.price_1m_output_tokens),
    cacheHitPricePer1m: priceOrNull(m.pricing?.price_1m_cache_hit_tokens),
    cacheWritePricePer1m: priceOrNull(m.pricing?.price_1m_cache_write_tokens),
    // AA가 평가 문제 1건을 실제로 풀게 하는 데 쓴 평균 금액. 단가는 같아도 추론을 길게 하는
    // 모델은 토큰을 훨씬 많이 써서 실제 비용이 몇 배 차이 난다(같은 $10 단가인 Claude
    // Fable 5.1과 GPT-6 Astra가 3.3배). 총액(total_cost)도 있지만 모델마다 푼 문제 수가
    // 1,246~2,524개로 달라서 총액끼리 비교하면 효율이 아니라 문제 수 차이가 섞인다.
    costPerTaskUsd: priceOrNull(m.artificial_analysis_intelligence_index_cost?.cost_per_task?.total_cost),
    contextWindow: null, // 무료 티어에서 제외되는 필드
    paramsB: parseParamCount(m.name), // 이름에서 파싱 — 없으면 null
    releaseDate: m.release_date ? m.release_date.slice(0, 7) : null,
    url: `https://artificialanalysis.ai/models/${m.slug}`,
  }
}

// slugMap: { "우리 모델명": "aa-slug" }
export async function scrapeAllModelsViaApi(slugMap) {
  const all = await fetchAllLanguageModels()
  const bySlug = new Map(all.map((m) => [m.slug, m]))
  const results = {}

  for (const [name, slug] of Object.entries(slugMap)) {
    const m = bySlug.get(slug)
    if (!m) {
      results[name] = {
        status: 'no-data',
        reason: `API 응답에서 slug '${slug}'를 찾지 못했습니다`,
      }
      continue
    }
    results[name] = toResultShape(m)
  }
  return results
}
