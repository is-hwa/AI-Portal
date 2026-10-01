import { formatParams, formatVram } from '../data/paramTiers'

const TAG_STYLES = {
  코딩: 'bg-indigo-50 text-indigo-600',
  '에이전틱 작업': 'bg-purple-50 text-purple-600',
  '장문 컨텍스트': 'bg-sky-50 text-sky-600',
  멀티모달: 'bg-emerald-50 text-emerald-600',
  범용: 'bg-slate-100 text-slate-600',
  '저비용·경량': 'bg-amber-50 text-amber-700',
  '실시간 정보 연동': 'bg-rose-50 text-rose-600',
  추론: 'bg-violet-50 text-violet-600',
  금융: 'bg-teal-50 text-teal-700',
  수학: 'bg-cyan-50 text-cyan-700',
  '한국어 지원': 'bg-blue-50 text-blue-700',
  다국어: 'bg-slate-100 text-slate-600',
}

export default function SpecializationGrid({ models }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {models.map((model) => (
        <div
          key={model.name}
          className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">{model.name}</h3>
            <span className="whitespace-nowrap text-xs text-slate-400">{model.provider}</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(model.specialization ?? []).map((tag) => (
              <span
                key={tag}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  TAG_STYLES[tag] ?? 'bg-slate-100 text-slate-600'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
          {model.description && (
            <p className="text-sm leading-relaxed text-slate-600">{model.description}</p>
          )}
          <div className="mt-auto pt-3 text-xs text-slate-400">
            {[
              model.params_b != null && formatParams(model.params_b),
              model.params_b != null && `VRAM ${formatVram(model.params_b)}`,
              model.license,
            ]
              .filter(Boolean)
              .join(' · ') || '상세 정보 없음'}
          </div>
        </div>
      ))}
      {models.length === 0 && (
        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center text-slate-400">
          조건에 맞는 모델이 없습니다.
        </div>
      )}
    </div>
  )
}
