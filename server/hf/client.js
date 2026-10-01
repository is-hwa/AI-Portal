const HF_API = 'https://huggingface.co/api/models'

// 허깅페이스 공개 API는 키 없이도 쓸 수 있다. HF_TOKEN을 넣으면 익명보다 한도가
// 넉넉해질 뿐이라 선택 사항으로 둔다.
function headers() {
  const token = process.env.HF_TOKEN
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// 익명 한도는 5분에 500건이다(응답 헤더 ratelimit-policy: q=500;w=300). 야간 수집은
// 첫 실행 때 1,000건 넘게 부르므로 429를 맞으면 헤더의 t(창이 리셋될 때까지 남은 초)만큼
// 기다렸다가 이어서 한다. 404는 리포가 지워지거나 비공개로 바뀐 것이라 null.
function resetWaitMs(res, attempt) {
  const t = res.headers.get('ratelimit')?.match(/t=(\d+)/)?.[1]
  const sec = t ? Number(t) + 1 : 15 * (attempt + 1)
  return Math.min(sec, 310) * 1000
}

async function getJson(url, { retries = 6 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: headers() })
    if (res.ok) return res.json()
    if (res.status === 404 || res.status === 401 || res.status === 403) return null
    if (attempt >= retries || (res.status !== 429 && res.status < 500)) {
      throw new Error(`HuggingFace API 오류 (${res.status}) ${url}`)
    }
    const wait = res.status === 429 ? resetWaitMs(res, attempt) : 2000 * (attempt + 1)
    await new Promise((r) => setTimeout(r, wait))
  }
}

function expandQuery(fields) {
  return fields.map((f) => `expand[]=${encodeURIComponent(f)}`).join('&')
}

const LIST_FIELDS = [
  'likes',
  'downloads',
  'trendingScore',
  'tags',
  'pipeline_tag',
  'createdAt',
  'lastModified',
  'baseModels',
  'gated',
]

export function listModels({ pipelineTag, sort, limit = 100 }) {
  const url = `${HF_API}?pipeline_tag=${pipelineTag}&sort=${sort}&direction=-1&limit=${limit}&${expandQuery(LIST_FIELDS)}`
  return getJson(url)
}

// 목록 응답엔 safetensors·cardData가 안 들어와서 원본 모델만 상세를 따로 부른다.
export function getModel(id) {
  return getJson(`${HF_API}/${id}`)
}

// 계보 확인용. 상세 전체를 받으면 무거워서 baseModels만 펼친다.
export function getBaseModels(id) {
  return getJson(`${HF_API}/${id}?${expandQuery(['baseModels'])}`)
}

// "이 모델을 양자화/파인튜닝한 리포가 몇 개인가" — HF 모델 트리 화면과 같은 필터다.
// 응답이 1000건에서 잘리므로 1000이면 "1000개 이상"으로 본다.
export const DERIVATIVE_CAP = 1000

export async function countDerivatives(id, relation) {
  const data = await getJson(
    `${HF_API}?filter=base_model:${relation}:${id}&limit=${DERIVATIVE_CAP}`,
  )
  return Array.isArray(data) ? data.length : 0
}

// 동시에 너무 많이 부르면 429를 맞으므로 정해진 개수만큼만 병렬로 돌린다.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
