export default function TrendingModelList({ title, badgeColor, description, items, error }) {
  return (
    <section className="my-6 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">
        {title}
        <span className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
          무료 · API 키 불필요
        </span>
      </h2>
      <p className="mb-3 text-xs text-slate-500">{description}</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {!error && !items && <p className="text-sm text-slate-400">불러오는 중…</p>}
      {items && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {items.map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-indigo-600 hover:underline"
              >
                {m.id}
              </a>
              <p className="text-xs text-slate-400">
                좋아요 {m.likes.toLocaleString()} · 다운로드 {m.downloads.toLocaleString()} ·{' '}
                {new Date(m.createdAt).toLocaleDateString('ko-KR')}
              </p>
              {m.aa && (
                <p className="mt-1 text-xs text-violet-700">
                  AA 매칭됨 · 지능지수 {m.aa.intelligenceIndex ?? '—'} · 코딩 {m.aa.codingIndex ?? '—'}
                  {m.aa.inputPricePer1m != null && ` · $${m.aa.inputPricePer1m}/$${m.aa.outputPricePer1m}`}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
