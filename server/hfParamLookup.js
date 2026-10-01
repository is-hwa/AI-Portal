import { normalize, stripVariantSuffix } from './modelNames.js'

// AA 무료 API엔 parameters 필드가 없어서, 모델 이름에 크기가 안 박혀있는 경우
// HuggingFace 공개 API로 실제 체크포인트의 safetensors 메타데이터를 조회해 채운다.
// 키 불필요. provider -> HF organization 매핑이 있는 경우에만 시도(오탐 방지 —
// 조직이 안 맞으면 그냥 못 찾은 걸로 처리하지, 아무 리포나 추측해서 매칭하지 않음).
const PROVIDER_TO_HF_ORG = {
  Meta: 'meta-llama',
  DeepSeek: 'deepseek-ai',
  Xiaomi: 'XiaomiMiMo',
  Alibaba: 'Qwen',
  'Z AI': 'zai-org',
  Kimi: 'moonshotai',
  MiniMax: 'MiniMaxAI',
  Upstage: 'upstage',
  InclusionAI: 'inclusionAI',
  NVIDIA: 'nvidia',
  'LG AI Research': 'LGAI-EXAONE',
  Google: 'google',
  IBM: 'ibm-granite',
  OpenBMB: 'openbmb',
  Mistral: 'mistralai',
  'Liquid AI': 'LiquidAI',
  'Nous Research': 'NousResearch',
  'Allen Institute for AI': 'allenai',
  Microsoft: 'microsoft',
  'AI21 Labs': 'ai21labs',
  OpenAI: 'openai',
}

// AA 표시 이름의 꼬리표(예: "(Reasoning, Max Effort)")는 실제 HF 리포 이름엔
// 안 붙어 있어서 매칭 전에 떼어낸다. 끝에 붙는 4자리 날짜(0803, 0731 같은 버전
// 표기)도 HF 검색을 망가뜨려서 같이 제거한다.
function cleanName(name) {
  return stripVariantSuffix(name).replace(/\s+\d{4}$/, '').trim()
}

// 이름을 토큰 집합으로 쪼갠다. 숫자 사이의 점은 먼저 없애서 버전이 쪼개지지 않게
// 한다("3.1" -> "31"). 안 그러면 Llama-3.1이 '3','1'로 흩어져서 Hermes-3과
// Hermes-4가 같은 토큰을 공유하게 된다. AA와 HF는 같은 모델을 어순과 접두사만
// 다르게 쓰는 경우가 많아서("Llama 3.3 Instruct 70B" vs "Llama-3.3-70B-Instruct")
// 접두어 비교 대신 토큰 집합으로 판단한다.
function tokenize(s) {
  return s
    .toLowerCase()
    .replace(/(\d)\.(\d)/g, '$1$2')
    .match(/[a-z0-9]+/g) ?? []
}

// 어느 쪽이 더 자세히 쓰는지가 모델마다 달라서 양방향으로 확인한다. AA가 더 자세한
// 경우("Hermes 4 - Llama-3.1 405B" vs 리포 "Hermes-4-405B")도, HF가 더 자세한
// 경우("Jamba 1.7 Large" vs 리포 "AI21-Jamba-Large-1.7")도 같은 모델이다.
// 부분 문자열이 아니라 토큰 단위로 비교하는 게 핵심 — "v2"가 "v2.6"에 들어간다고
// 같은 모델로 보면 MiMo-V2-Pro와 MiMo-V2.6-Pro가 섞여버린다.
function tokenOverlap(targetTokens, candidateName) {
  const candTokens = new Set(tokenize(candidateName))
  const hit = targetTokens.filter((t) => candTokens.has(t))
  const targetInCand = hit.length === targetTokens.length
  const candInTarget = [...candTokens].every((t) => targetTokens.includes(t))
  return { matched: targetInCand || candInTarget, score: hit.length }
}

async function searchHfCandidates(org, query) {
  const url = `https://huggingface.co/api/models?author=${encodeURIComponent(org)}&search=${encodeURIComponent(query)}&limit=10`
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

// 여러 dtype이 섞여 있는 리포(예: BF16 원본 + FP8/INT8 양자화본을 한 리포에 같이
// 올린 경우)는 safetensors.total이 중복 합산돼 부풀려질 수 있어 제외한다.
// dtype이 하나뿐일 때만 신뢰할 수 있는 값으로 취급.
async function fetchHfParamsB(hfId) {
  const res = await fetch(`https://huggingface.co/api/models/${hfId}`)
  if (!res.ok) return null
  const data = await res.json()
  const params = data.safetensors?.parameters
  const total = data.safetensors?.total
  if (!params || !total) return null
  if (Object.keys(params).length !== 1) return null
  return Math.round((total / 1e9) * 100) / 100
}

// 양자화 변형(FP8/INT4/AWQ/GPTQ 등)은 원본과 파라미터 "개수"는 같아야 정상이지만,
// 실제로는 리포마다 스케일·룩업 텐서가 dtype별로 따로 섞여 들어가 있어 총합이
// 부풀려지는 경우가 많다. 이런 접미사가 없는 "원본" 리포를 우선적으로 시도한다.
const QUANT_SUFFIX = /-(fp8|int4|int8|awq|gptq|gguf|nvfp4|w4a16|w8a8)(-|$)/i

// AA 표시 이름 + 제공사에 대응하는 HuggingFace 리포 후보들을 매칭 정확도 순으로
// 반환한다. 리포가 하나라도 있으면 "가중치가 실제로 공개돼 있다"는 증거가 된다 —
// AA 무료 티어엔 라이선스·공개 여부 필드가 없어서 이게 유일한 확인 수단이다.
async function findHfCandidates(provider, name) {
  const org = PROVIDER_TO_HF_ORG[provider]
  if (!org) return []

  const base = cleanName(name)
  const target = normalize(base)
  const targetTokens = tokenize(base)
  if (!target || targetTokens.length === 0) return []

  // AA 이름이 리포 이름보다 구체적이면("Hermes 4 - Llama-3.1 405B" vs 리포
  // "Hermes-4-405B") 검색이 비거나 엉뚱한 세대만 돌려준다. 뒤 단어부터 하나씩
  // 떼면서 매칭되는 후보가 나올 때까지 재시도한다.
  const words = base.split(/\s+/).filter(Boolean)
  for (let end = words.length; end > 0; end--) {
    const candidates = await searchHfCandidates(org, words.slice(0, end).join(' '))
    const matched = candidates
      .map((c) => {
        const idName = c.id.includes('/') ? c.id.split('/').slice(1).join('/') : c.id
        const exact = normalize(idName) === target
        const { matched: hit, score } = tokenOverlap(targetTokens, idName)
        return { c, exact, matched: exact || hit, score, quantized: QUANT_SUFFIX.test(c.id) }
      })
      .filter((m) => m.matched)
      .sort((a, b) => {
        if (a.exact !== b.exact) return a.exact ? -1 : 1
        if (a.quantized !== b.quantized) return a.quantized ? 1 : -1
        if (a.score !== b.score) return b.score - a.score
        return a.c.id.length - b.c.id.length
      })
    if (matched.length > 0) return matched
  }
  return []
}

// 라이선스는 검색 응답의 tags에 "license:apache-2.0" 형태로 이미 들어있어서
// 모델 상세를 따로 부르지 않아도 된다.
function licenseFromTags(tags) {
  const tag = (tags ?? []).find((t) => typeof t === 'string' && t.startsWith('license:'))
  return tag ? tag.slice('license:'.length) : null
}

// 태그 대부분은 포맷·인프라 관련이라 특화 판정에 쓸모가 없다. 제공사가 직접 단
// 도메인·언어 태그만 남긴다.
const TAG_NOISE =
  /^(arxiv:|base_model|region:|license|endpoints_compatible|text-generation-inference|safetensors|transformers|autotrain|custom_code|eval-results|compressed-tensors|gguf|pytorch|doi:|model-index|has_space|mlx|onnx)/i

function meaningfulTags(tags) {
  return (tags ?? []).filter((t) => typeof t === 'string' && !TAG_NOISE.test(t)).slice(0, 30)
}

// 제공사 자체 라이선스는 태그가 전부 "other"로만 나와서 구분이 안 된다. 이 경우에만
// 모델 상세를 한 번 더 불러서 실제 이름(llama4, glm-5.3, qwen-community-1.0 등)을
// 가져온다.
async function fetchLicenseName(hfId) {
  const res = await fetch(`https://huggingface.co/api/models/${hfId}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.cardData?.license_name ?? null
}

// 가중치가 실제로 공개돼 있는지 확인한다. AA 카탈로그는 "Qwen3.8 Max"처럼 가중치
// 비공개 상용 티어도 같은 제공사라는 이유로 오픈소스로 통과시키는데, 그런 모델은
// HuggingFace에 체크포인트가 없다. 로컬 도입 판단이 목적인 화면에서 못 돌리는
// 모델을 추천하지 않으려면 이 확인이 필요하다.
export async function verifyOpenWeights(provider, name) {
  const matched = await findHfCandidates(provider, name)
  if (matched.length === 0) {
    return { verified: false, hfId: null, hfUrl: null, license: null }
  }
  const top = matched[0].c
  let license = licenseFromTags(top.tags)
  if (license === 'other') {
    license = (await fetchLicenseName(top.id)) ?? 'other'
  }
  return {
    verified: true,
    hfId: top.id,
    hfUrl: `https://huggingface.co/${top.id}`,
    license,
    tags: meaningfulTags(top.tags),
    pipelineTag: top.pipeline_tag ?? null,
  }
}

// AA 표시 이름 + 제공사로 HuggingFace 상의 실제 모델을 찾아 파라미터 수(B 단위)를
// 반환한다. 매칭 실패/조직 매핑 없음/신뢰 불가 시 null.
export async function lookupParamsBFromHf(provider, name) {
  const matched = await findHfCandidates(provider, name)
  for (const m of matched) {
    const paramsB = await fetchHfParamsB(m.c.id)
    if (paramsB != null) return paramsB
  }
  return null
}
