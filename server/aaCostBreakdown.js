import { chromium } from 'playwright'

// 1건당 비용을 입력·추론·답변으로 나눈 값은 무료 API에 없고, AA 모델 페이지에만 있다.
// 페이지는 Next.js가 self.__next_f에 JSON 조각으로 데이터를 심어두는데, 한 페이지에
// 비교 차트용으로 모델 160여 개분이 들어 있어서 한 번만 열면 된다(AA API 한도 안 씀).
//
// 두 가지를 겪고 나서 지금 방식이 됐다.
// 1) 화면 텍스트엔 차트 범례만 있고 숫자가 없다 → 페이지 데이터(JSON)를 직접 읽는다.
// 2) "숫자 바로 앞에 나온 slug"로 주인을 추정하면 엉뚱한 모델에 붙는다 → JSON을 객체
//    단위로 파싱해서 토큰·비용과 "같은 객체 안의" slug로만 연결한다.
// 또 같은 페이지도 로딩할 때마다 데이터가 빠지는 경우가 있어(4번 중 2번) 재시도한다.

const MAX_ATTEMPTS = 4

const round = (v, digits) => (typeof v === 'number' ? Number(v.toFixed(digits)) : null)

async function loadFlightData(browser, slug) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const page = await browser.newPage()
    try {
      await page.goto(`https://artificialanalysis.ai/models/${slug}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      })
      const flight = (
        await page.evaluate(() =>
          (self.__next_f || []).map((c) => (typeof c[1] === 'string' ? c[1] : '')),
        )
      ).join('')
      if (flight.includes('intelligenceIndexCostPerTask')) return flight
    } catch {
      // 타임아웃 등 — 다음 시도
    } finally {
      await page.close()
    }
  }
  return null
}

function parseBreakdowns(flight) {
  const bySlug = new Map()
  for (const line of flight.split('\n')) {
    const m = line.match(/^[0-9a-z]+:(.*)$/s)
    if (!m) continue
    let root
    try {
      root = JSON.parse(m[1])
    } catch {
      continue
    }
    const stack = [root]
    while (stack.length) {
      const o = stack.pop()
      if (!o || typeof o !== 'object') continue
      const cost = !Array.isArray(o) && o.slug ? o.intelligenceIndexCostPerTask?.cost : null
      if (cost && !bySlug.has(o.slug)) {
        // 원본은 소수점 열몇 자리라, 그대로 두면 매일 미세한 흔들림이 전부 "변경"으로 잡힌다.
        bySlug.set(o.slug, {
          inputCostPerTask: round(cost.input, 4),
          reasoningCostPerTask: round(cost.reasoning, 4),
          answerCostPerTask: round(cost.answer, 4),
          reasoningTokensPerTask: round(o.intelligenceIndexOutputTokensPerTask?.reasoning, 0),
        })
      }
      for (const x of Array.isArray(o) ? o : Object.values(o)) {
        if (x && typeof x === 'object') stack.push(x)
      }
    }
  }
  return bySlug
}

// 후보 slug의 페이지를 차례로 열어 처음 성공한 페이지의 데이터를 쓴다. 특정 모델이
// AA에서 빠져 페이지가 사라져도 다른 모델 페이지로 넘어가게 여러 개를 받는다.
export async function getCostBreakdowns(candidateSlugs) {
  const browser = await chromium.launch()
  try {
    for (const slug of candidateSlugs) {
      const flight = await loadFlightData(browser, slug)
      if (flight) {
        const parsed = parseBreakdowns(flight)
        if (parsed.size > 0) return parsed
      }
    }
    return new Map()
  } finally {
    await browser.close()
  }
}
