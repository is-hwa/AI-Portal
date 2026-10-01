// AA 무료 API엔 "오픈소스냐 상용이냐"를 구분하는 필드가 없어서, 실제 카탈로그를
// 조사해 확인한 제공사 표기를 기준으로 직접 규칙을 만들었다(2026-09 기준).
// namePattern이 없으면 그 제공사 것 전부 오픈소스로 간주. 있으면 그 패턴에
// 맞는 것만 — Google(Gemini/Gemma 혼재), Meta(Llama/Muse Spark 혼재),
// Mistral(무료 소형 라인 vs 유료 Large/Medium 혼재), Microsoft(Phi만 오픈)가 여기 해당.
// 애매한 제공사(Baidu, Cohere, Amazon 등)는 잘못 분류할 위험이 있어 아예 뺐다 —
// 나중에 필요하면 여기 추가하면 됨.
const OPEN_SOURCE_RULES = [
  // QwQ는 Qwen 라인과 이름만 다를 뿐 같은 오픈 웨이트 계열이고, gpt-oss는 OpenAI가
  // 유일하게 가중치를 공개한 라인이다. 둘 다 HuggingFace에 리포가 실제로 있는 걸
  // 확인했다 — 규칙에서 빠지면 API 모델로 잘못 분류된다.
  { provider: 'Alibaba', namePattern: /^(Qwen|QwQ)/i },
  { provider: 'OpenAI', namePattern: /^gpt-oss/i },
  { provider: 'Google', namePattern: /^Gemma/i },
  { provider: 'Meta', namePattern: /^Llama/i },
  { provider: 'Microsoft', namePattern: /^Phi/i },
  {
    provider: 'Mistral',
    namePattern: /^(Mistral (Small|Nemo)|Devstral|Magistral Small|Ministral|Codestral)/i,
  },
  { provider: 'DeepSeek', namePattern: null },
  { provider: 'Kimi', namePattern: null },
  { provider: 'Xiaomi', namePattern: null },
  { provider: 'OpenBMB', namePattern: null },
  { provider: 'Z AI', namePattern: /^GLM/i },
  { provider: 'NVIDIA', namePattern: null },
  { provider: 'IBM', namePattern: null },
  { provider: 'InclusionAI', namePattern: null },
  { provider: 'Allen Institute for AI', namePattern: null },
  { provider: 'LG AI Research', namePattern: null },
  { provider: 'Upstage', namePattern: null },
  { provider: 'AI21 Labs', namePattern: null },
  { provider: 'Nous Research', namePattern: null },
  { provider: 'Liquid AI', namePattern: null },
  { provider: 'MiniMax', namePattern: null },
]

export function isOpenSourceEntry(entry) {
  const rule = OPEN_SOURCE_RULES.find((r) => r.provider === entry.model_creator?.name)
  if (!rule) return false
  if (!rule.namePattern) return true
  return rule.namePattern.test(entry.name)
}

export function isOpenSourceModel(provider, name) {
  return isOpenSourceEntry({ name, model_creator: { name: provider } })
}

// API로 부르는 상용 모델 쪽 제공사. 카탈로그엔 329개가 있지만 사내에서 실제로
// 검토할 만한 곳만 추린다 — 여기 없는 제공사는 후보에 안 올라온다.
// 같은 제공사가 오픈 라인을 같이 내는 경우(Google의 Gemma, Meta의 Llama 등)는
// isOpenSourceEntry가 먼저 걸러내므로 중복으로 잡히지 않는다.
const API_PROVIDERS = new Set([
  'OpenAI',
  'Anthropic',
  'Google',
  'SpaceXAI',
  'xAI',
  'Mistral',
  'Amazon',
  'Meta',
  'Cohere',
  'Perplexity',
  'DeepSeek',
  'Alibaba',
])

export function isApiEntry(entry) {
  return !isOpenSourceEntry(entry) && API_PROVIDERS.has(entry.model_creator?.name)
}
