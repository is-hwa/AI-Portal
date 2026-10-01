import { getTrendingOpenModels, getTrendingEmbeddingModels } from './huggingface.js'
import { readHfSnapshot, writeHfSnapshot } from './store.js'

// 허깅페이스는 완전 무료·무인 자동화가 가능한 유일한 소스라서(구조화된 JSON,
// LLM 해석 불필요) 자동화의 중심으로 삼는다. 어제 스냅샷과 비교해서
// "새로 트렌딩에 뜬 것"만 골라낸다.
export async function detectHfChanges() {
  const [llm, embedding] = await Promise.all([getTrendingOpenModels(), getTrendingEmbeddingModels()])
  const snapshot = await readHfSnapshot()
  const prevLlmIds = new Set(snapshot.llmIds ?? [])
  const prevEmbeddingIds = new Set(snapshot.embeddingIds ?? [])

  const newLlm = llm.filter((m) => !prevLlmIds.has(m.id))
  const newEmbedding = embedding.filter((m) => !prevEmbeddingIds.has(m.id))

  await writeHfSnapshot({
    llmIds: llm.map((m) => m.id),
    embeddingIds: embedding.map((m) => m.id),
    updatedAt: new Date().toISOString(),
  })

  return { newLlm, newEmbedding }
}
