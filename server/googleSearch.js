const ENDPOINT = 'https://www.googleapis.com/customsearch/v1'

// Google Programmable Search Engine (Custom Search JSON API) — 공식 API,
// 하루 100건 무료. console.cloud.google.com에서 API 키 발급 +
// programmablesearchengine.google.com에서 검색엔진(cx) 생성 필요.
export async function googleSearch(query, { num = 3 } = {}) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY
  const cx = process.env.GOOGLE_SEARCH_CX
  if (!apiKey || !cx) {
    throw new Error(
      'GOOGLE_SEARCH_API_KEY / GOOGLE_SEARCH_CX가 설정되지 않았습니다 (.env.example 참고)',
    )
  }

  const url = `${ENDPOINT}?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${num}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Google Search API 오류 (${res.status}): ${body.slice(0, 200)}`)
  }
  const data = await res.json()
  return (data.items ?? []).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet,
  }))
}

export function isConfigured() {
  return Boolean(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX)
}
