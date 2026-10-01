// 원본 모델을 직접 만드는 곳으로 알려진 HF 조직. 이 목록에 없어도 좋아요가 충분하면
// 원본으로 보여주지만(새로 등장한 연구소를 놓치지 않으려고), 목록에 있으면 좋아요가
// 적은 신규 모델도 바로 노출한다. 값은 화면에 보일 제공사 이름.
export const KNOWN_ORGS = {
  Qwen: 'Alibaba Qwen',
  'meta-llama': 'Meta',
  'deepseek-ai': 'DeepSeek',
  google: 'Google',
  mistralai: 'Mistral',
  microsoft: 'Microsoft',
  openai: 'OpenAI',
  nvidia: 'NVIDIA',
  'zai-org': 'Z.ai (GLM)',
  moonshotai: 'Moonshot (Kimi)',
  MiniMaxAI: 'MiniMax',
  XiaomiMiMo: 'Xiaomi',
  tencent: 'Tencent',
  baidu: 'Baidu',
  'stepfun-ai': 'StepFun',
  'ByteDance-Seed': 'ByteDance',
  'ibm-granite': 'IBM',
  openbmb: 'OpenBMB',
  LiquidAI: 'Liquid AI',
  NousResearch: 'Nous Research',
  allenai: 'Ai2',
  ai21labs: 'AI21 Labs',
  inclusionAI: 'InclusionAI',
  CohereLabs: 'Cohere',
  HuggingFaceTB: 'Hugging Face',
  yandex: 'Yandex',
  'black-forest-labs': 'Black Forest Labs',
  stabilityai: 'Stability AI',
  'Tongyi-MAI': 'Alibaba Tongyi',
  BAAI: 'BAAI',
  intfloat: 'Microsoft (E5)',
  'sentence-transformers': 'Sentence Transformers',
  'nomic-ai': 'Nomic',
  'Alibaba-NLP': 'Alibaba NLP',
  jinaai: 'Jina AI',
  Snowflake: 'Snowflake',
  'mixedbread-ai': 'Mixedbread',
  hexgrad: 'Kokoro',
  ResembleAI: 'Resemble AI',
  'LGAI-EXAONE': 'LG AI연구원',
  upstage: '업스테이지',
  'naver-hyperclovax': '네이버',
  kakaocorp: '카카오',
  skt: 'SK텔레콤',
  'K-intelligence': 'KT',
  trillionlabs: '트릴리온랩스',
  NCSOFT: 'NC AI',
}

// 국내 기업 모델은 한국어 성능을 기대하고 찾는 경우가 많아 따로 표시한다.
export const KOREAN_ORGS = new Set([
  'LGAI-EXAONE',
  'upstage',
  'naver-hyperclovax',
  'kakaocorp',
  'skt',
  'K-intelligence',
  'trillionlabs',
  'NCSOFT',
])

export function orgOf(id) {
  return id.split('/')[0]
}
