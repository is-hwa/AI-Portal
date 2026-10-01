// AA의 세 지수(종합지능·코딩·에이전틱)는 순위가 거의 일치해서 — 코딩 백분위에서
// 지능 백분위를 뺀 값의 스프레드가 전체 59개 모델에서 0.03에 그친다 — 여기서
// "특화 영역"을 뽑아내면 데이터에 없는 구분을 지어내는 셈이 된다. 대신 제공사가
// HuggingFace에 직접 달아둔 태그와 pipeline_tag를 근거로 삼는다.

const MULTIMODAL_PIPELINES = new Set([
  'image-text-to-text',
  'any-to-any',
  'video-text-to-text',
  'image-to-text',
  'visual-question-answering',
  'automatic-speech-recognition',
  'audio-text-to-text',
])

const RULES = [
  { label: '코딩', pattern: /^(code|coding|code-generation|codegen|program-synthesis)$/i },
  { label: '에이전틱 작업', pattern: /^(agent|agents|agentic|tool-use|tool-calling|function-calling)$/i },
  { label: '장문 컨텍스트', pattern: /^(long-context|long-contexts|longcontext)$/i },
  { label: '추론', pattern: /^(reasoning|thinking|chain-of-thought)$/i },
  { label: '금융', pattern: /^(finance|financial|financial-research)$/i },
  { label: '수학', pattern: /^(math|mathematics|math-reasoning)$/i },
  { label: '멀티모달', pattern: /^(multimodal|vision|audio|visual-question-answering|image-text-to-text|speech-translation)$/i },
]

// 이름에 대놓고 박혀 있는 경우는 제공사 자신의 선언이라 태그보다 확실하다.
const CODE_NAME = /(code|coder|devstral|codestral)/i

const KOREAN_TAGS = /^(ko|korean|kor)$/i

// HF 태그에 ISO 639-1 언어 코드가 그대로 들어간다. 2글자 태그를 전부 언어로 보면
// 오탐이 나서 흔한 코드만 추린다.
const LANG_CODES = new Set([
  'en', 'ko', 'ja', 'zh', 'fr', 'de', 'es', 'pt', 'it', 'ru', 'ar', 'hi', 'th',
  'vi', 'id', 'tr', 'pl', 'nl', 'sv', 'da', 'fi', 'no', 'cs', 'el', 'he', 'uk',
  'ro', 'hu', 'bn', 'fa', 'ms', 'ta', 'te', 'ur',
])

export function inferSpecialization(model, hf, options = {}) {
  const tags = (hf?.tags ?? []).map((t) => String(t))
  const found = new Set()

  for (const tag of tags) {
    for (const rule of RULES) {
      if (rule.pattern.test(tag)) found.add(rule.label)
    }
  }

  if (MULTIMODAL_PIPELINES.has(hf?.pipelineTag)) found.add('멀티모달')
  if (CODE_NAME.test(model.name)) found.add('코딩')

  // "한국어 특화"가 아니라 "지원 언어에 한국어가 명시됨"이라는 뜻이라 라벨을 구분한다.
  if (tags.some((t) => KOREAN_TAGS.test(t))) found.add('한국어 지원')
  const langs = tags.filter((t) => LANG_CODES.has(t.toLowerCase()))
  if (tags.some((t) => /^multilingual$/i.test(t)) || langs.length >= 3) found.add('다국어')

  // 파라미터·가격은 지능 지수와 독립이라 그대로 근거로 쓸 수 있는 몇 안 되는 수치다.
  const cheapEnough =
    options.cheapPriceMax != null &&
    model.pricing?.input_per_1m != null &&
    model.pricing.input_per_1m <= options.cheapPriceMax
  if ((model.params_b != null && model.params_b <= 13) || cheapEnough) {
    found.add('저비용·경량')
  }

  if (found.size === 0) found.add('범용')
  return [...found]
}

// 입력가격 하위 25% 경계. 값이 있는 모델끼리만 비교한다.
export function cheapPriceThreshold(models) {
  const prices = models
    .map((m) => m.pricing?.input_per_1m)
    .filter((p) => p != null)
    .sort((a, b) => a - b)
  if (prices.length === 0) return null
  return prices[Math.floor((prices.length - 1) * 0.25)]
}
