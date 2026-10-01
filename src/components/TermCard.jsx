const CATEGORY_STYLES = {
  모델: 'bg-indigo-50 text-indigo-600',
  인프라: 'bg-emerald-50 text-emerald-600',
  학습방식: 'bg-orange-50 text-orange-600',
  '로컬 실행': 'bg-sky-50 text-sky-600',
}

export default function TermCard({ term }) {
  const badgeStyle = CATEGORY_STYLES[term.category] ?? 'bg-slate-100 text-slate-600'
  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{term.term}</h3>
        <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeStyle}`}>
          {term.category}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{term.definition}</p>
      {term.example && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          예시: {term.example}
        </p>
      )}
    </div>
  )
}
