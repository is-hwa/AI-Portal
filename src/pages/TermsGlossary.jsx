import { useMemo, useState } from 'react'
import termsData from '../data/terms.json'
import TermCard from '../components/TermCard'

export default function TermsGlossary() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('전체')

  const categories = useMemo(
    () => ['전체', ...Array.from(new Set(termsData.map((t) => t.category)))],
    [],
  )

  const filtered = useMemo(() => {
    return termsData.filter((t) => {
      const matchesQuery = t.term.toLowerCase().includes(query.trim().toLowerCase())
      const matchesCategory = category === '전체' || t.category === category
      return matchesQuery && matchesCategory
    })
  }, [query, category])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">AI 용어 정리</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI 트렌드 기사를 읽을 때 자주 마주치는 용어를 쉽게 풀어드립니다.
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="용어 검색 (예: 토큰, RAG...)"
          className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                category === c
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((term) => (
            <TermCard key={term.term} term={term} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  )
}
