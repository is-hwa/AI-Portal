import { readModels } from './store.js'
import { isConfigured as apiConfigured, scrapeAllModelsViaApi } from './aaApi.js'
import { scrapeAllModels as scrapeViaBrowser } from './aaScraper.js'

// slugMap을 models.json에 저장된 aa_slug에서 동적으로 만든다 — 하드코딩된 목록이면
// 새로 추가된 모델(예: GPT-6 Astra)의 slug를 깜빡하고 안 넣었을 때 조용히 누락되는
// 버그가 생긴다(실제로 겪었음). aa_slug가 없는 모델은 건너뛴다.
async function buildSlugMap() {
  const models = await readModels()
  const map = {}
  for (const m of models) {
    if (m.aa_slug) map[m.name] = m.aa_slug
  }
  return map
}

// AA_API_KEY가 있으면 공식 API(빠르고 안정적)를 쓰고, 없으면 헤드리스 브라우저로
// 자동 폴백한다 — Google Search 때와 같은 패턴. 반환 형태는 두 경로 다 동일하게 맞춰뒀다.
export async function getAllAaModelData({ onProgress } = {}) {
  const slugMap = await buildSlugMap()

  if (apiConfigured()) {
    onProgress?.('Artificial Analysis 공식 API 확인 중 (무료 티어, 하루 100건)')
    try {
      return await scrapeAllModelsViaApi(slugMap)
    } catch (err) {
      onProgress?.(`공식 API 실패 — 헤드리스 브라우저로 폴백: ${String(err.message ?? err)}`)
    }
  }
  return scrapeViaBrowser(slugMap, { onProgress })
}
