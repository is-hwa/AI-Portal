// 검토 큐의 "신규 모델 후보" 섹션들(API / 오픈소스 / 제공사 신규)은 색과 설명,
// 메타 한 줄만 다르고 구조가 같아서 여기로 모았다.
const TONES = {
  indigo: { border: 'border-indigo-200 bg-indigo-50/40', button: 'bg-indigo-600 hover:bg-indigo-700' },
  teal: { border: 'border-teal-200 bg-teal-50/40', button: 'bg-teal-600 hover:bg-teal-700' },
  violet: { border: 'border-violet-200 bg-violet-50/40', button: 'bg-violet-600 hover:bg-violet-700' },
}

export default function CandidateSection({
  title,
  description,
  items,
  tone = 'indigo',
  renderMeta,
  renderBadge,
  onApply,
  onDismiss,
}) {
  if (items.length === 0) return null
  const style = TONES[tone] ?? TONES.indigo

  return (
    <section className="mb-6">
      <h2 className="mb-1 text-sm font-semibold text-slate-500">
        {title} ({items.length})
      </h2>
      <p className="mb-3 text-xs text-slate-400">{description}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.name}
            className={`flex items-center justify-between rounded-lg border px-4 py-2 ${style.border}`}
          >
            <div>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-indigo-600 hover:underline"
              >
                {item.name}
              </a>
              <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                {item.provider}
              </span>
              {renderBadge?.(item)}
              <p className="text-xs text-slate-400">{renderMeta(item)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApply(item.name)}
                className={`rounded-md px-3 py-1 text-xs font-medium text-white ${style.button}`}
              >
                추가
              </button>
              <button
                onClick={() => onDismiss(item.name)}
                className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
              >
                무시
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
