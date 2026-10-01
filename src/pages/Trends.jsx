import { useMemo, useState } from 'react'
import FamilyCard from '../components/FamilyCard'
import Chips from '../components/Chips'
import { SORTS, rankFamilies } from '../utils/ranking'
import { relativeTime, formatCount } from '../utils/format'

const PAGE = 24

const CATEGORY_HINT = {
  llm: '대화·요약·코딩·에이전트에 쓰는 언어 모델. 이미지를 함께 읽는 멀티모달 모델도 포함합니다.',
  embedding: '사내 문서 검색·RAG를 만들 때 문장을 벡터로 바꾸는 모델과 검색 결과 재정렬(리랭커) 모델.',
  speech: '회의록 받아쓰기(음성 인식)와 텍스트 읽어주기(TTS) 모델.',
  image: '텍스트로 이미지를 만드는 모델.',
}

export default function Trends({ data }) {
  const [category, setCategory] = useState('llm')
  const [sort, setSort] = useState('hot')
  const [limit, setLimit] = useState(PAGE)

  const ranked = useMemo(
    () => rankFamilies(data.families.filter((f) => f.category === category), sort),
    [data, category, sort],
  )
  const sortInfo = SORTS.find((s) => s.id === sort)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">요즘 뜨는 로컬 AI 모델</h1>
        <p className="mt-1 text-sm text-slate-500">
          HuggingFace에서 직접 받아 내 PC·사내 서버에 올릴 수 있는 모델입니다. 개인이 다시 올린
          양자화·파인튜닝 리포는 원본 모델로 묶어 인기 근거로 합쳤습니다.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {relativeTime(data.updatedAt)} 갱신 · HF 리포 {formatCount(data.scannedRepos)}개를 정리
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Chips
          options={data.categories}
          value={category}
          onChange={(c) => {
            setCategory(c)
            setLimit(PAGE)
          }}
        />
        <p className="text-xs text-slate-500">{CATEGORY_HINT[category]}</p>
        <div className="flex flex-wrap items-center gap-3">
          <Chips size="sm" options={SORTS} value={sort} onChange={setSort} />
          <span className="text-xs text-slate-400">{sortInfo.hint}</span>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-sm text-slate-400">
          조건에 맞는 모델이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ranked.slice(0, limit).map((f, i) => (
            <FamilyCard key={f.key} family={f} rank={i + 1} />
          ))}
        </div>
      )}

      {ranked.length > limit && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
          >
            더 보기 ({ranked.length - limit}개 남음)
          </button>
        </div>
      )}
    </div>
  )
}
