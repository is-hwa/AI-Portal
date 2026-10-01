import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { classifyLicense, LICENSE_TONE_CLASS } from '../data/license'
import { formatParams, formatVram, vramTier, nativeBits, MIN_BITS } from '../data/paramTiers'
import { formatCount, formatDate, specLabel } from '../utils/format'

const COLORS = ['#4f46e5', '#059669', '#d97706']

const ROWS = [
  { label: '만든 곳', render: (m) => m.provider },
  { label: '잘하는 것', render: (m) => m.specialization.map(specLabel).join(', ') },
  {
    label: '크기',
    render: (m) =>
      `${formatParams(m.paramsB)}${m.activeParamsB != null ? ` (MoE·활성 ${m.activeParamsB}B)` : ''}`,
  },
  {
    label: '최소 사양 (4bit)',
    render: (m) =>
      m.paramsB != null ? `약 ${formatVram(m.paramsB, MIN_BITS)} · ${vramTier(m.paramsB, MIN_BITS).label}` : '—',
  },
  {
    label: '권장 사양 (원본)',
    render: (m) =>
      m.paramsB != null
        ? `약 ${formatVram(m.paramsB, nativeBits(m))} · ${vramTier(m.paramsB, nativeBits(m)).label} (${nativeBits(m)}bit)`
        : '—',
  },
  {
    label: '회사 사용',
    render: (m) => {
      const l = classifyLicense(m.license)
      return (
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LICENSE_TONE_CLASS[l.tone]}`}>
          {l.label}
          <span className="ml-1 font-normal opacity-70">{m.license ?? ''}</span>
        </span>
      )
    },
  },
  { label: '좋아요', render: (m) => formatCount(m.likes) },
  { label: '30일 다운로드', render: (m) => formatCount(m.downloads) },
  {
    label: '양자화 버전 수',
    render: (m) =>
      m.derivatives?.quantized == null ? '—' : m.derivatives.quantized >= 1000 ? '1000+' : m.derivatives.quantized,
  },
  { label: '공개일', render: (m) => formatDate(m.createdAt) },
]

// 날짜별 좋아요를 모델별 열로 펼쳐 한 차트에 겹친다.
function historyRows(models) {
  const byDate = new Map()
  models.forEach((m, i) => {
    for (const h of m.history ?? []) {
      if (!byDate.has(h.date)) byDate.set(h.date, { date: h.date.slice(5) })
      byDate.get(h.date)[`m${i}`] = h.likes
    }
  })
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row)
}

export default function CompareTable({ models, onRemove }) {
  const rows = historyRows(models)
  const hasHistory = rows.length >= 2

  return (
    <section className="mb-8 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">나란히 비교</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className="w-32" />
              {models.map((m, i) => (
                <th key={m.id} className="px-2 pb-2 text-left align-top">
                  <div className="flex items-start gap-1">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
                    <a href={m.url} target="_blank" rel="noreferrer" className="break-all font-semibold text-slate-900 hover:text-indigo-600">
                      {m.name}
                    </a>
                    <button onClick={() => onRemove(m)} className="ml-auto text-slate-300 hover:text-rose-500" aria-label="비교에서 빼기">
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-2 pr-2 text-xs font-medium text-slate-400">{row.label}</td>
                {models.map((m) => (
                  <td key={m.id} className="px-2 py-2 text-slate-700">
                    {row.render(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <h3 className="mb-1 text-xs font-medium text-slate-500">좋아요 추이</h3>
        {hasHistory ? (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={formatCount} />
                <Tooltip formatter={(v) => formatCount(v)} />
                <Legend formatter={(_, entry) => models[Number(entry.dataKey.slice(1))]?.name} />
                {models.map((m, i) => (
                  <Line key={m.id} dataKey={`m${i}`} stroke={COLORS[i]} dot={false} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            추이는 매일 수집한 기록이 이틀 이상 쌓이면 표시됩니다 (HF는 과거 기록을 주지 않아 이 포털이 직접 모읍니다).
          </p>
        )}
      </div>
    </section>
  )
}
