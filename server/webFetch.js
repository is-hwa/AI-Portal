import * as cheerio from 'cheerio'

// 페이지를 가져와 읽을 수 있는 본문 텍스트만 뽑아낸다.
// 주의: React/Next.js 등으로 클라이언트에서 렌더링하는 사이트(SPA)는
// 원본 HTML에 실제 콘텐츠가 없어 빈 텍스트가 나올 수 있다 — 이런 사이트는
// 헤드리스 브라우저 없이는 못 긁는다는 걸 호출부에서 감안해야 한다.
async function fetchReadableText(url, { maxChars = 6000 } = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!res.ok) throw new Error(`페이지를 가져오지 못했습니다 (${res.status}): ${url}`)

  const html = await res.text()
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript, svg').remove()

  const text = $('article, main, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()

  return {
    url,
    text: text.slice(0, maxChars),
    looksEmpty: text.length < 200, // SPA라 콘텐츠가 안 잡혔을 가능성 신호
  }
}

export async function fetchMany(urls, opts) {
  const results = []
  for (const url of urls) {
    try {
      results.push(await fetchReadableText(url, opts))
    } catch (err) {
      results.push({ url, text: '', error: String(err.message ?? err) })
    }
  }
  return results
}
