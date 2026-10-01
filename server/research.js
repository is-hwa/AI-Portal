import {
  readModels,
  writeModels,
  readPending,
  writePending,
  dropDismissed,
  isCandidate,
  appendAutoLog,
} from './store.js'
import { resolveDeployment, applyUpdate, addAaModel } from './applyItem.js'
import { candidateKey } from './modelNames.js'
import { chatJson } from './privateAi.js'
import { fetchMany } from './webFetch.js'
import { PROVIDER_SOURCES } from './sources.js'
import { detectHfChanges } from './hfWatch.js'
import { googleSearch, isConfigured as googleSearchConfigured } from './googleSearch.js'
import { getAllAaModelData } from './aa.js'
import { getCostBreakdowns } from './aaCostBreakdown.js'
import { isAvailable as aaWatchAvailable, detectNewAaModels } from './aaWatch.js'
import { detectNewOpenSourceModels } from './aaCatalog.js'

const NEWS_QUERIES = {
  Anthropic: 'Anthropic Claude 새 모델 발표 benchmark',
  OpenAI: 'OpenAI GPT 새 모델 발표 benchmark',
  Google: 'Google Gemini 새 모델 발표 benchmark',
  Meta: 'Meta Llama 새 모델 발표 benchmark',
  xAI: 'xAI Grok 새 모델 발표 benchmark',
  DeepSeek: 'DeepSeek 새 모델 발표 benchmark',
}

const BENCHMARK_SCHEMA = `{
  "release_date": "YYYY-MM"|null,
  "benchmarks": { "mmlu_pro": number|null, "gpqa": number|null, "swebench": number|null, "livecodebench": number|null, "math": number|null, "aime": number|null, "mmmu": number|null, "arena_elo": number|null },
  "speed": { "ttft_ms": number|null, "throughput_tps": number|null },
  "pricing": { "input_per_1m": number|null, "output_per_1m": number|null },
  "context_window": string|null,
  "specialization": string[],
  "description": string|null,
  "newer_version_note": string|null
}`

async function gatherSourceText(provider) {
  const urls = PROVIDER_SOURCES[provider] ?? []
  if (urls.length === 0) return { text: '', sources: [] }

  const fetched = await fetchMany(urls)
  const usable = fetched.filter((f) => f.text && !f.looksEmpty)
  const text = usable.map((f) => `[출처: ${f.url}]\n${f.text}`).join('\n\n')
  return { text, sources: fetched.map((f) => ({ url: f.url, ok: !f.looksEmpty && !!f.text })) }
}

export async function researchOneModel(model) {
  const { text, sources } = await gatherSourceText(model.provider)

  if (!text) {
    return {
      status: 'no-source',
      sources,
      reason:
        '이 제공사의 소스 페이지에서 읽을 수 있는 텍스트를 가져오지 못했습니다 (자바스크립트로 렌더링되는 페이지일 수 있음 — server/sources.js에서 다른 소스로 교체 필요)',
    }
  }

  const prompt = `아래는 ${model.provider}의 공식 뉴스/블로그 페이지에서 가져온 텍스트야. 이 안에서 "${model.name}" 모델에 대한 정보를 찾아서 정리해줘.

텍스트에 없는 내용은 절대 추측하지 말고 null로 남겨. 확인 안 된 값을 지어내면 안 돼.

--- 수집된 텍스트 시작 ---
${text}
--- 수집된 텍스트 끝 ---

마지막 응답은 다른 설명 없이 아래 스키마의 JSON 코드블록 하나만 출력해:
\`\`\`json
${BENCHMARK_SCHEMA}
\`\`\``

  const result = await chatJson(prompt)
  return { status: 'ok', result, sources }
}

// 새 모델 "감지"는 LLM 없이 무료로 — 원문 일부를 그대로 보여주고 판단은
// 사람이 한다("이런 게 나왔다더라" 수준으로 충분하다는 방침).
// Google Search API가 설정돼 있으면 그걸 우선 쓴다(공식 API, 하루 100건 무료라
// 안정적이고, 자바스크립트 렌더링 페이지도 검색엔진이 이미 색인해둬서 문제없음).
// 없으면 기존 고정 URL 직접 스크래핑으로 자동 폴백.
async function gatherProviderSnippet(provider) {
  if (googleSearchConfigured()) {
    try {
      const query = NEWS_QUERIES[provider] ?? `${provider} AI new model announcement`
      const hits = await googleSearch(query, { num: 3 })
      if (hits.length === 0) return { preview: null, sources: [] }
      const preview = hits.map((h, i) => `[${i + 1}] ${h.title} — ${h.snippet}`).join('\n')
      return { preview, sources: hits.map((h) => ({ url: h.url, ok: true })) }
    } catch {
      // 검색 실패 시 아래 고정 URL 스크래핑으로 폴백
    }
  }
  const { text, sources } = await gatherSourceText(provider)
  return { preview: text ? text.slice(0, 500) : null, sources }
}

async function gatherNewsSnippets() {
  const snippets = []
  for (const provider of Object.keys(PROVIDER_SOURCES)) {
    const { preview, sources } = await gatherProviderSnippet(provider)
    snippets.push({ provider, preview, sources })
  }
  return snippets
}

// 공식 API가 막혀 헤드리스 브라우저로 폴백하면 화면에 반올림돼 표시된 값을 읽어온다
// (53.4 -> 53). 이걸 변경으로 잡으면 검토 큐가 허위 변경으로 넘치고, 적용하면 오히려
// 정밀도가 깎인다. 새 값을 기존 값의 반올림으로 설명할 수 있으면 변경이 아니라고 본다.
function isRoundingArtifact(oldVal, newVal) {
  if (typeof oldVal !== 'number' || typeof newVal !== 'number') return false
  const decimals = (String(newVal).split('.')[1] ?? '').length
  return Number(oldVal.toFixed(decimals)) === newVal
}

function record(changed, key, oldVal, newVal) {
  if (newVal == null || newVal === oldVal) return
  if (isRoundingArtifact(oldVal, newVal)) return
  changed[key] = { from: oldVal ?? null, to: newVal }
}

function diffFields(current, incoming) {
  const changed = {}
  for (const key of ['benchmarks', 'speed', 'pricing']) {
    for (const field of Object.keys(incoming[key] ?? {})) {
      record(changed, `${key}.${field}`, current?.[key]?.[field] ?? null, incoming[key][field])
    }
  }
  record(changed, 'context_window', current?.context_window ?? null, incoming.context_window)
  record(changed, 'params_b', current?.params_b ?? null, incoming.params_b)
  return changed
}

// 최신화가 목적인 사이트라 확실한 건 사람 확인 없이 바로 반영한다. 반영한 항목은
// 검토 큐에서 빼고 자동 반영 기록에 남긴다(업데이트 관리 화면에서 확인·삭제 가능).
// 자동 반영 대상:
//   - 기존 모델의 지표 변경(update/changed) — AA 숫자 그대로라 판단할 게 없다
//   - 제공사별 새 주력 모델(aa-new) — 규칙·가중치 검증으로 탭까지 확정되는 경우만
//   - 야간에 발견한 오픈소스 신규 모델(aa-new-opensource) — HF 가중치가 확인된 경우만
// 검토 큐에 남는 것: 같은 제공사의 하위 변형(aa-new-minor), 규칙상 오픈소스인데
// 가중치를 못 찾은 모델(Qwen3.8 Max 같은 경우), 버튼으로 돌린 카탈로그 스캔 결과.
async function autoApply(items) {
  const models = await readModels()
  const now = new Date().toISOString()
  const log = []
  const remaining = []

  for (const item of items) {
    if (item.type === 'update' && item.status === 'changed') {
      if (applyUpdate(models, item)) {
        log.push({ at: now, kind: 'updated', name: item.name, changed: item.changed })
        continue
      }
    } else if (item.type === 'aa-new' || item.type === 'aa-new-opensource') {
      // 추론 강도만 다른 변형("(medium)"/"(high)")이 이미 있으면 같은 모델로 보고 건너뛴다.
      const key = candidateKey(item.name)
      if (models.some((m) => candidateKey(m.name) === key || (item.slug && m.aa_slug === item.slug))) continue
      const resolved = await resolveDeployment(item.provider, item.name)
      const openSourceOk = item.type !== 'aa-new-opensource' || resolved.deployment === 'open_source'
      if (!resolved.ambiguous && openSourceOk) {
        const model = await addAaModel(models, item, resolved)
        log.push({
          at: now,
          kind: 'added',
          name: model.name,
          provider: model.provider,
          deployment: model.deployment,
          intelligenceIndex: model.benchmarks.aa_intelligence_index,
        })
        continue
      }
      item.holdReason = resolved.ambiguous
        ? '규칙상 오픈소스인데 HuggingFace에서 가중치를 찾지 못해 자동 추가를 보류했습니다'
        : '오픈소스로 확인되지 않아 자동 추가를 보류했습니다'
    }
    remaining.push(item)
  }

  if (log.length > 0) {
    await writeModels(models)
    await appendAutoLog(log)
  }
  return remaining
}

// 자동화의 중심은 허깅페이스(완전 무료·무인 가능)다. API 전용 모델(Claude/GPT/
// Gemini/Grok 등) 벤치마크 갱신은 LLM 해석이 필요해서 사내 Private AI가 연결된
// 경우에만 돌리고, 안 붙어있으면 조용히 건너뛴다(에러 스팸 방지).
export async function runResearch({ onProgress } = {}) {
  const items = []

  onProgress?.('HuggingFace 신규 트렌딩 감지 중 (무료, 핵심 자동화)')
  try {
    const { newLlm, newEmbedding } = await detectHfChanges()
    for (const m of newLlm) {
      items.push({ type: 'hf-new', category: 'llm', name: m.id, ...m, status: 'info', checkedAt: new Date().toISOString() })
    }
    for (const m of newEmbedding) {
      items.push({ type: 'hf-new', category: 'embedding', name: m.id, ...m, status: 'info', checkedAt: new Date().toISOString() })
    }
  } catch (err) {
    items.push({ type: 'hf-scan-error', status: 'error', error: String(err.message ?? err) })
  }

  // 우리가 추적 중인 제공사(Anthropic/OpenAI/Google/Meta/xAI/DeepSeek)에서
  // 우리가 가진 것보다 최신 모델이 AA에 올라왔는지 확인 — GPT-6 Astra 같은 신규
  // 발표를 놓치지 않기 위한 장치. AA_API_KEY 있을 때만 가능(전체 목록 조회가 필요해서
  // 헤드리스 브라우저로는 못함 — slug를 몰라서 애초에 방문을 못 함).
  if (aaWatchAvailable()) {
    onProgress?.('Artificial Analysis에서 우리가 추적 중인 제공사의 신규 모델 확인 중')
    try {
      const { primary, minor } = await detectNewAaModels()
      for (const m of primary) {
        items.push({
          type: 'aa-new',
          name: m.name,
          provider: m.provider,
          slug: m.slug,
          releaseDate: m.releaseDate,
          intelligenceIndex: m.data.intelligenceIndex,
          url: m.url ?? m.data.url,
          data: m.data,
          status: 'info',
          checkedAt: new Date().toISOString(),
        })
      }
      for (const m of minor) {
        items.push({
          type: 'aa-new-minor',
          name: m.name,
          provider: m.provider,
          slug: m.slug,
          releaseDate: m.releaseDate,
          intelligenceIndex: m.data.intelligenceIndex,
          url: m.url ?? m.data.url,
          data: m.data,
          status: 'info',
          checkedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      items.push({ type: 'aa-watch-error', status: 'error', error: String(err.message ?? err) })
    }

    // HuggingFace 트렌딩 중 AA 순위권에 있는데 아직 비교표에 없는 오픈소스 모델 —
    // "새 오픈소스 모델이 순위권에 있으면 자동으로 추가 후보로 올리기"에 해당.
    onProgress?.('오픈소스 신규 모델(AA 순위권) 확인 중')
    try {
      const candidates = await detectNewOpenSourceModels()
      for (const c of candidates) {
        items.push({
          type: 'aa-new-opensource',
          name: c.name,
          provider: c.provider,
          slug: c.slug,
          releaseDate: c.data.releaseDate,
          intelligenceIndex: c.data.intelligenceIndex,
          url: c.data.url,
          hfUrl: c.hfUrl,
          likes: c.likes,
          downloads: c.downloads,
          data: c.data,
          status: 'info',
          checkedAt: new Date().toISOString(),
        })
      }
    } catch (err) {
      items.push({ type: 'aa-opensource-error', status: 'error', error: String(err.message ?? err) })
    }
  }

  onProgress?.('최신 소식 스냅샷 수집 중 (무료, LLM 미사용)')
  try {
    const snippets = await gatherNewsSnippets()
    for (const s of snippets) {
      items.push({
        type: 'news-snippet',
        name: s.provider,
        status: s.preview ? 'info' : 'no-source',
        preview: s.preview,
        sources: s.sources,
        checkedAt: new Date().toISOString(),
      })
    }
  } catch (err) {
    items.push({ type: 'news-scan-error', status: 'error', error: String(err.message ?? err) })
  }

  // Artificial Analysis — 속도·가격·종합 지능지수를 자동으로 가져온다(AA_API_KEY 있으면
  // 공식 API, 없으면 헤드리스 브라우저로 자동 폴백). LLM도 별도 키도 필요 없다.
  // 여기서 확보 못하는 개별 벤치마크(MMLU-Pro, GPQA 등)는 Private AI가 연결됐을 때만
  // 보완한다. 한 모델당 항목을 하나로 합쳐서(출처가 여럿이어도) 중복 키가 안 생기게 한다.
  const models = await readModels()
  let aaResults = {}
  try {
    aaResults = await getAllAaModelData({ onProgress })
  } catch (err) {
    items.push({ type: 'aa-scan-error', status: 'error', error: String(err.message ?? err) })
  }

  // 1건당 비용의 입력·추론·답변 내역. 무료 API에 없어 AA 모델 페이지에서 읽는다.
  // 실패해도 나머지 갱신은 그대로 진행한다(기존 값 유지).
  let breakdowns = new Map()
  onProgress?.('1건당 비용 내역(입력·추론·답변) 확인 중 — AA 모델 페이지')
  try {
    const slugs = models
      .filter((m) => m.aa_slug && m.pricing?.cost_per_task_usd != null)
      .sort((a, b) => (b.benchmarks?.aa_intelligence_index ?? 0) - (a.benchmarks?.aa_intelligence_index ?? 0))
      .slice(0, 3)
      .map((m) => m.aa_slug)
    breakdowns = await getCostBreakdowns(slugs)
    if (breakdowns.size === 0) throw new Error('모델 페이지에서 비용 내역을 읽지 못했습니다')
  } catch (err) {
    items.push({ type: 'cost-breakdown-error', status: 'error', error: String(err.message ?? err) })
  }

  const paConfigured = Boolean(process.env.PRIVATE_AI_BASE_URL)
  if (!paConfigured) {
    onProgress?.('Private AI 미연결 — 개별 벤치마크(MMLU-Pro/GPQA 등) 갱신은 건너뜀')
  }

  for (const model of models) {
    const aa = aaResults[model.name]
    const bd = breakdowns.get(model.aa_slug)
    let pa = null
    let paSources = []
    let paError = null

    if (paConfigured) {
      onProgress?.(`리서치 중: ${model.name}`)
      try {
        const outcome = await researchOneModel(model)
        if (outcome.status === 'ok') {
          pa = outcome.result
          paSources = outcome.sources ?? []
        } else {
          paSources = outcome.sources ?? []
        }
      } catch (err) {
        paError = String(err.message ?? err)
      }
    }

    const incoming = {
      release_date: pa?.release_date ?? model.release_date,
      benchmarks: {
        ...model.benchmarks,
        ...(pa?.benchmarks ?? {}),
        aa_intelligence_index: aa?.intelligenceIndex ?? model.benchmarks?.aa_intelligence_index ?? null,
        aa_coding_index: aa?.codingIndex ?? model.benchmarks?.aa_coding_index ?? null,
        aa_agentic_index: aa?.agenticIndex ?? model.benchmarks?.aa_agentic_index ?? null,
      },
      speed: {
        ttft_ms: aa?.ttftMs ?? pa?.speed?.ttft_ms ?? model.speed?.ttft_ms ?? null,
        ttfa_ms: aa?.ttfaMs ?? model.speed?.ttfa_ms ?? null,
        e2e_response_ms: aa?.e2eResponseMs ?? model.speed?.e2e_response_ms ?? null,
        throughput_tps: aa?.outputTokensPerSec ?? pa?.speed?.throughput_tps ?? model.speed?.throughput_tps ?? null,
      },
      pricing: {
        input_per_1m: aa?.inputPricePer1m ?? pa?.pricing?.input_per_1m ?? model.pricing?.input_per_1m ?? null,
        output_per_1m: aa?.outputPricePer1m ?? pa?.pricing?.output_per_1m ?? model.pricing?.output_per_1m ?? null,
        cache_hit_per_1m: aa?.cacheHitPricePer1m ?? model.pricing?.cache_hit_per_1m ?? null,
        cache_write_per_1m: aa?.cacheWritePricePer1m ?? model.pricing?.cache_write_per_1m ?? null,
        cost_per_task_usd: aa?.costPerTaskUsd ?? model.pricing?.cost_per_task_usd ?? null,
        input_cost_per_task_usd: bd?.inputCostPerTask ?? model.pricing?.input_cost_per_task_usd ?? null,
        reasoning_cost_per_task_usd:
          bd?.reasoningCostPerTask ?? model.pricing?.reasoning_cost_per_task_usd ?? null,
        answer_cost_per_task_usd: bd?.answerCostPerTask ?? model.pricing?.answer_cost_per_task_usd ?? null,
        reasoning_tokens_per_task:
          bd?.reasoningTokensPerTask ?? model.pricing?.reasoning_tokens_per_task ?? null,
      },
      context_window: aa?.contextWindow ?? pa?.context_window ?? model.context_window,
      params_b: aa?.paramsB ?? model.params_b ?? null,
      specialization: pa?.specialization ?? model.specialization,
      description: pa?.description ?? model.description,
    }

    const sources = [
      ...(aa?.url ? [{ url: aa.url, ok: aa.status === 'ok', label: 'Artificial Analysis' }] : []),
      ...paSources.map((s) => ({ ...s, label: '제공사 공식 페이지' })),
    ]

    const gotNothing = !aa && !pa && sources.length === 0
    if (gotNothing) {
      items.push({
        type: 'update',
        name: model.name,
        status: 'error',
        error: paError ?? 'Artificial Analysis와 Private AI 모두 확인하지 못했습니다',
        checkedAt: new Date().toISOString(),
      })
      continue
    }

    const changed = diffFields(model, incoming)
    items.push({
      type: 'update',
      name: model.name,
      status: Object.keys(changed).length > 0 ? 'changed' : 'unchanged',
      changed,
      incoming,
      sources,
      checkedAt: new Date().toISOString(),
    })
  }

  const pending = await readPending()
  onProgress?.('확실한 신규 모델·지표 변경 자동 반영 중')
  const fresh = await autoApply(dropDismissed(items, pending.dismissed))
  const freshKeys = new Set(fresh.map((i) => candidateKey(i.name)))
  const trackedKeys = new Set((await readModels()).map((m) => candidateKey(m.name)))
  // 사람이 아직 결정하지 않은 신규 후보는 다음 점검에서도 남겨둔다. 예전엔 점검할 때마다
  // 목록을 통째로 새로 채워서, 수동 스캔으로 올라온 후보(오전 스캔의 Claude Opus 5.5 등)가
  // 검토도 받기 전에 지워졌다. 지표 갱신(update)은 매번 최신 값으로 새로 받는 게 맞으니 제외.
  const carried = dropDismissed(
    // 같은 모델의 다른 변형이 이번 점검에 새로 올라왔거나 이미 비교표에 있으면 옛 후보는 버린다.
    // (안 그러면 Gemini 3.8 Flash (medium)과 (high)가 둘 다 남아 둘 다 추가되는 일이 생긴다)
    pending.items.filter(
      (p) =>
        isCandidate(p) &&
        p.status !== 'applied' &&
        !freshKeys.has(candidateKey(p.name)) &&
        !trackedKeys.has(candidateKey(p.name)),
    ),
    pending.dismissed,
  )
  const merged = [...pending.items.filter((p) => p.status === 'applied'), ...carried, ...fresh]
  const next = { checkedAt: new Date().toISOString(), items: merged, dismissed: pending.dismissed }
  await writePending(next)
  return next
}
