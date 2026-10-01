import { useEffect, useState } from 'react'
import { formatDate, relativeTime } from '../utils/format'

const SOURCE_STYLE = {
  'Hugging Face': 'bg-amber-100 text-amber-700',
  OpenAI: 'bg-slate-800 text-white',
  Google: 'bg-sky-100 text-sky-700',
}

// API 모델(Claude·GPT·Gemini 등)은 표로 비교하지 않고 소식만 모아 본다.
export default function News() {
  const [news, setNews] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = (refresh = false) =>
    fetch(`/api/news${refresh ? '?refresh=1' : ''}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? `뉴스를 불러오지 못했습니다 (${res.status})`)
        setNews(body)
        setError('')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">AI 소식</h1>
          <p className="mt-1 text-sm text-slate-500">
            제공사 공식 블로그의 새 글입니다. API로 쓰는 상용 모델 소식도 여기서 확인하세요.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true)
            load(true)
          }}
          disabled={loading}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-300 disabled:opacity-50"
        >
          {loading ? '불러오는 중…' : '새로고침'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}
      {!news && !error && <p className="text-sm text-slate-400">불러오는 중…</p>}

      {news && (
        <>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {news.items.map((n) => (
              <li key={n.url} className="px-4 py-3">
                <div className="mb-1 flex items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${SOURCE_STYLE[n.source] ?? 'bg-slate-100 text-slate-600'}`}>
                    {n.source}
                  </span>
                  {n.publishedAt && <span className="text-slate-400">{formatDate(n.publishedAt)}</span>}
                </div>
                <a href={n.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-800 hover:text-indigo-600">
                  {n.title}
                </a>
                {n.snippet && <p className="mt-0.5 text-xs text-slate-500">{n.snippet}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">
            {relativeTime(new Date(news.fetchedAt).toISOString())} 수집
            {!news.searchEnabled && ' · 국내 기사 검색은 .env에 Google 검색 키를 넣으면 함께 표시됩니다'}
            {news.errors.length > 0 && ` · 일부 소스 실패: ${news.errors.join(', ')}`}
          </p>
        </>
      )}
    </div>
  )
}
