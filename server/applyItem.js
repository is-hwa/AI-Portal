import { isOpenSourceModel } from './openSourceRules.js'
import { verifyOpenWeights } from './hfParamLookup.js'
import { inferSpecialization, cheapPriceThreshold } from './specialization.js'

// 검토 큐 항목을 비교표(models 배열)에 반영하는 로직. 사람이 "적용/추가"를 누를 때와
// 야간 점검이 자동으로 반영할 때 같은 코드를 타게 하려고 따로 뺐다.

// 새로 감지된 모델을 어느 탭에 넣을지 정한다. 예전엔 "Meta·DeepSeek이면 오픈소스"로
// 제공사만 봤는데, 그러면 Meta의 비공개 모델(Muse Spark)이 오픈소스로, 오픈소스인
// AI21 Jamba가 API로 들어갔다. 제공사+이름 규칙을 먼저 보고, 규칙상 오픈소스여도
// HuggingFace에 가중치가 실제로 없으면(Qwen3.8 Max 같은 상용 최상위 티어) API로 돌린다.
// ambiguous: 규칙은 오픈소스인데 가중치를 못 찾은 경우 — 자동 반영에서는 보류한다.
export async function resolveDeployment(provider, name) {
  if (!isOpenSourceModel(provider, name)) {
    return { deployment: 'api', weights: null, ambiguous: false }
  }
  const weights = await verifyOpenWeights(provider, name)
  return {
    deployment: weights.verified ? 'open_source' : 'api',
    weights,
    ambiguous: !weights.verified,
  }
}

export function applyUpdate(models, item) {
  const idx = models.findIndex((m) => m.name === item.name)
  if (idx === -1) return false
  const cur = models[idx]
  const incoming = item.incoming
  models[idx] = {
    ...cur,
    release_date: incoming.release_date ?? cur.release_date,
    benchmarks: { ...cur.benchmarks, ...incoming.benchmarks },
    speed: { ...cur.speed, ...incoming.speed },
    pricing: { ...cur.pricing, ...incoming.pricing },
    context_window: incoming.context_window ?? cur.context_window,
    params_b: incoming.params_b ?? cur.params_b,
    specialization: incoming.specialization ?? cur.specialization,
    description: incoming.description ?? cur.description,
  }
  return true
}

// Artificial Analysis가 준 데이터로 새 모델을 구성해 추가한다. 개별 벤치마크·소개
// 문구는 비워둔다(Private AI 없이도 추가는 가능). resolved를 넘기지 않으면 여기서 판정한다.
export async function addAaModel(models, item, resolved) {
  const d = item.data
  let deployment
  let weights
  if (resolved) {
    ;({ deployment, weights } = resolved)
  } else if (item.type === 'aa-new' || item.type === 'aa-new-minor') {
    ;({ deployment, weights } = await resolveDeployment(item.provider, item.name))
  } else {
    // 스캔 경로(aa-new-opensource/aa-new-api)는 이미 분류·검증을 마친 채로 온다.
    deployment = item.type === 'aa-new-opensource' ? 'open_source' : 'api'
    weights =
      item.weightsVerified == null
        ? null
        : {
            verified: item.weightsVerified,
            hfId: item.hfId,
            hfUrl: item.hfUrl,
            license: item.license,
            tags: item.tags,
            pipelineTag: item.pipelineTag,
          }
  }

  const draft = {
    name: item.name,
    params_b: d?.paramsB ?? null,
    pricing: { input_per_1m: d?.inputPricePer1m ?? null },
  }
  const model = {
    name: item.name,
    provider: item.provider,
    deployment,
    aa_slug: item.slug ?? null,
    release_date: item.releaseDate ?? d?.releaseDate ?? null,
    benchmarks: {
      mmlu_pro: null,
      gpqa: null,
      swebench: null,
      livecodebench: null,
      math: null,
      aime: null,
      mmmu: null,
      arena_elo: null,
      aa_intelligence_index: d?.intelligenceIndex ?? null,
      aa_coding_index: d?.codingIndex ?? null,
      aa_agentic_index: d?.agenticIndex ?? null,
    },
    speed: {
      ttft_ms: d?.ttftMs ?? null,
      ttfa_ms: d?.ttfaMs ?? null,
      e2e_response_ms: d?.e2eResponseMs ?? null,
      throughput_tps: d?.outputTokensPerSec ?? null,
    },
    pricing: {
      input_per_1m: d?.inputPricePer1m ?? null,
      output_per_1m: d?.outputPricePer1m ?? null,
      cache_hit_per_1m: d?.cacheHitPricePer1m ?? null,
      cache_write_per_1m: d?.cacheWritePricePer1m ?? null,
      cost_per_task_usd: d?.costPerTaskUsd ?? null,
    },
    context_window: d?.contextWindow ?? null,
    params_b: d?.paramsB ?? null,
    weights_verified: weights?.verified ?? null,
    hf_id: weights?.hfId ?? null,
    hf_url: weights?.hfUrl ?? null,
    license: weights?.license ?? null,
    hf_tags: weights?.tags ?? [],
    specialization: inferSpecialization(
      draft,
      { tags: weights?.tags, pipelineTag: weights?.pipelineTag },
      { cheapPriceMax: cheapPriceThreshold(models.filter((x) => x.deployment === deployment)) },
    ),
    description: '',
  }
  models.push(model)
  return model
}
