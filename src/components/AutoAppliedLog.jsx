// 야간 점검이 사람 확인 없이 반영한 내역. 새로 추가된 모델은 여기서 바로 지울 수 있고
// (지운 모델은 다시 자동 추가되지 않음), 지표 갱신은 점검 회차별로 접어서 보여준다.
const TAB_LABEL = { api: 'API', open_source: '오픈소스' }

function formatWhen(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AutoAppliedLog({ entries, trackedNames, fieldLabels, onDelete }) {
  const added = entries.filter((e) => e.kind === 'added')
  const updateRuns = new Map()
  for (const e of entries.filter((x) => x.kind === 'updated')) {
    ;(updateRuns.get(e.at) ?? updateRuns.set(e.at, []).get(e.at)).push(e)
  }

  return (
    <section className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <h2 className="text-sm font-semibold text-slate-700">최근 자동 반영 내역</h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        새 주력 모델과 기존 모델의 지표 변경은 확인 없이 바로 비교표에 반영됩니다. 잘못 들어간
        모델은 여기서 삭제하면 다음 점검 때 다시 들어오지 않습니다.
      </p>

      {entries.length === 0 && <p className="text-sm text-slate-400">아직 자동 반영된 내역이 없습니다.</p>}

      {added.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-1.5 text-xs font-semibold text-slate-500">
            새로 추가된 모델 ({added.length})
          </h3>
          <div className="divide-y divide-emerald-100 rounded-lg border border-emerald-100 bg-white">
            {added.map((e) => {
              const stillTracked = trackedNames.has(e.name)
              return (
                <div key={`${e.at}-${e.name}`} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <span className={stillTracked ? 'font-medium text-slate-800' : 'text-slate-400 line-through'}>
                      {e.name}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{e.provider}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {TAB_LABEL[e.deployment] ?? e.deployment}
                    </span>
                    {e.intelligenceIndex != null && (
                      <span className="ml-2 text-xs text-slate-400">종합지능 {e.intelligenceIndex}</span>
                    )}
                    <span className="ml-2 text-xs text-slate-400">{formatWhen(e.at)}</span>
                  </div>
                  {stillTracked ? (
                    <button
                      onClick={() => onDelete(e.name)}
                      className="shrink-0 rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      삭제
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">삭제됨</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {[...updateRuns.entries()].map(([at, runEntries]) => (
        <details key={at} className="mb-1.5 rounded-lg border border-emerald-100 bg-white px-3 py-2">
          <summary className="cursor-pointer text-sm text-slate-700">
            {formatWhen(at)} 점검 — 모델 {runEntries.length}개 지표 갱신
          </summary>
          <ul className="mt-2 space-y-1.5">
            {runEntries.map((e) => (
              <li key={e.name} className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{e.name}</span>{' '}
                {Object.entries(e.changed ?? {})
                  .map(([k, v]) => `${fieldLabels[k] ?? k} ${v.from ?? '—'} → ${v.to}`)
                  .join(' · ')}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  )
}
