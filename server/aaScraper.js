import { chromium } from 'playwright'

// artificialanalysis.ai — robots.txt가 전체 허용(Allow: /)이고 로그인도 필요 없지만,
// 자바스크립트로 렌더링되는 사이트라 헤드리스 브라우저로 열어야 한다.
// 모델별 고정 URL이 있어서 검색/클릭 같은 상호작용 없이 접속만 하면 된다.
// LLM을 전혀 쓰지 않고 정규식으로 화면 텍스트에서 숫자만 뽑아내는 방식이라
// 완전 무료지만, AA가 페이지 구조를 바꾸면 정규식도 같이 손봐야 한다.

function parseModelPage(text) {
  const intelligence = text.match(
    /Intelligence\s*Updated\s*#\d+\s*\/\s*\d+\s*([\d.]+)\s*Artificial Analysis Intelligence Index/,
  )
  const speed = text.match(/Speed\s*#\d+\s*\/\s*\d+\s*([\d.]+)\s*Output tokens per second/)
  const inputPrice = text.match(/In\s*\$([\d.]+)/)
  const outputPrice = text.match(/Out\s*\$([\d.]+)/)
  const context = text.match(/Context window\s*([\d.]+)\s*([MK])\b/)

  return {
    intelligenceIndex: intelligence ? Number(intelligence[1]) : null,
    codingIndex: null, // API 전용 필드 — 브라우저 스크래핑으로는 못 뽑음
    agenticIndex: null,
    outputTokensPerSec: speed ? Number(speed[1]) : null,
    ttftMs: null,
    ttfaMs: null,
    e2eResponseMs: null,
    inputPricePer1m: inputPrice ? Number(inputPrice[1]) : null,
    outputPricePer1m: outputPrice ? Number(outputPrice[1]) : null,
    cacheHitPricePer1m: null,
    cacheWritePricePer1m: null,
    contextWindow: context ? `${context[1]}${context[2]}` : null,
    releaseDate: null,
  }
}

// slugMap: { "우리 모델명": "aa-slug" } — aaApi.scrapeAllModelsViaApi와 동일한 시그니처
export async function scrapeAllModels(slugMap, { onProgress } = {}) {
  const browser = await chromium.launch()
  const results = {}
  try {
    const page = await browser.newPage()
    for (const [name, slug] of Object.entries(slugMap)) {
      onProgress?.(`Artificial Analysis 확인 중: ${name}`)
      try {
        await page.goto(`https://artificialanalysis.ai/models/${slug}`, {
          waitUntil: 'networkidle',
          timeout: 20000,
        })
        const text = await page.innerText('main')
        const parsed = parseModelPage(text)
        const gotAnything = Object.values(parsed).some((v) => v != null)
        results[name] = gotAnything
          ? { status: 'ok', ...parsed, url: `https://artificialanalysis.ai/models/${slug}` }
          : {
              status: 'no-data',
              url: `https://artificialanalysis.ai/models/${slug}`,
              reason: '페이지는 열렸지만 예상한 형식의 데이터를 못 찾음 (사이트 구조가 바뀌었을 수 있음)',
            }
      } catch (err) {
        results[name] = { status: 'error', error: String(err.message ?? err) }
      }
    }
  } finally {
    await browser.close()
  }
  return results
}
