const HF_API = 'https://huggingface.co/api/models'

// 허깅페이스 공개 API — 키 불필요, 무료. 오픈소스 모델 트렌드만 감지 가능하고
// 실제 벤치마크 점수는 주지 않는다 (Open LLM Leaderboard는 2025-03 이후 갱신 중단됨).
async function getTrending(pipelineTag, { limit, minLikes }) {
  const url = `${HF_API}?sort=trendingScore&direction=-1&limit=${limit * 3}&pipeline_tag=${pipelineTag}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HuggingFace API 오류 (${res.status})`)
  const data = await res.json()

  return data
    .filter((m) => (m.likes ?? 0) >= minLikes)
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      likes: m.likes ?? 0,
      downloads: m.downloads ?? 0,
      createdAt: m.createdAt,
      url: `https://huggingface.co/${m.id}`,
    }))
}

// 직접 내려받아 사내(로컬/프라이빗)에 올릴 수 있는 오픈소스 LLM
export function getTrendingOpenModels({ limit = 8, minLikes = 100 } = {}) {
  return getTrending('text-generation', { limit, minLikes })
}

// 검색·RAG용 임베딩 모델
export function getTrendingEmbeddingModels({ limit = 6, minLikes = 100 } = {}) {
  return getTrending('sentence-similarity', { limit, minLikes })
}
