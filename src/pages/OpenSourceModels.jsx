import { useEffect, useState } from 'react'
import ModelComparison from './ModelComparison'
import TrendingModelList from '../components/TrendingModelList'

async function api(path) {
  const res = await fetch(path)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`)
  return data
}

export default function OpenSourceModels() {
  const [trending, setTrending] = useState(null)
  const [trendingError, setTrendingError] = useState('')
  const [embeddings, setEmbeddings] = useState(null)
  const [embeddingsError, setEmbeddingsError] = useState('')

  useEffect(() => {
    api('/api/trending-open-models')
      .then(setTrending)
      .catch((err) => setTrendingError(err.message))
    api('/api/trending-embedding-models')
      .then(setEmbeddings)
      .catch((err) => setEmbeddingsError(err.message))
  }, [])

  return (
    <div>
      <ModelComparison
        deployment="open_source"
        title="로컬 오픈소스 AI"
        description="자체 서버·PC에 직접 올려서 쓰는 오픈소스 모델을 비교합니다. API 요금 없이 데이터를 외부로 보내지 않고 쓸 수 있다는 게 API 모델과의 핵심 차이입니다."
      />
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-800">지금 뜨는 오픈소스 모델</h2>
        <p className="mb-3 text-sm text-slate-500">
          아직 위 비교표엔 없지만 최근 주목받는 모델들입니다 — 로컬에 새로 올릴 만한 게
          있는지 둘러보는 용도입니다.
        </p>
        <TrendingModelList
          title="로컬 LLM (오픈소스)"
          badgeColor="bg-emerald-100 text-emerald-700"
          description="HuggingFace 공개 API로 실시간 조회 — 벤치마크 점수는 없고, 새로 뜬 오픈소스 모델을 발견하는 용도입니다."
          items={trending}
          error={trendingError}
        />
        <TrendingModelList
          title="임베딩 모델 (검색·RAG용)"
          badgeColor="bg-sky-100 text-sky-700"
          description="문서 검색·RAG 구축 시 쓸 만한 임베딩 모델 트렌드입니다."
          items={embeddings}
          error={embeddingsError}
        />
      </div>
    </div>
  )
}
