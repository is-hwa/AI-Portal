import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COLORS = ['#4f46e5', '#f97316', '#10b981', '#e11d48']

const CHARTS = [
  { key: 'ttft_ms', label: 'TTFT (첫 응답까지, ms)', path: 'speed', lowerBetter: true },
  { key: 'throughput_tps', label: '처리량 (초당 토큰)', path: 'speed', lowerBetter: false },
  { key: 'input_per_1m', label: '입력 가격 ($/1M 토큰)', path: 'pricing', lowerBetter: true },
  { key: 'output_per_1m', label: '출력 가격 ($/1M 토큰)', path: 'pricing', lowerBetter: true },
]

function MiniBarChart({ title, lowerBetter, data }) {
  const hasData = data.some((d) => d.value != null)
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">
        {title}
        <span className="ml-1.5 text-xs font-normal text-slate-400">
          {lowerBetter ? '(낮을수록 유리)' : '(높을수록 유리)'}
        </span>
      </h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 12, fill: '#475569' }}
            />
            <Tooltip formatter={(v) => (v == null ? '데이터 없음' : v)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={d.name} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[180px] items-center justify-center text-xs text-slate-400">
          선택된 모델에 데이터가 없습니다.
        </div>
      )}
    </div>
  )
}

export default function SpeedCostCharts({ models, selectedNames }) {
  const selectedModels = selectedNames
    .map((name) => models.find((m) => m.name === name))
    .filter(Boolean)

  if (selectedModels.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
        비교하려면 표에서 모델을 2~4개 선택하세요.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {CHARTS.map((chart) => {
        const data = selectedModels.map((model) => ({
          name: model.name,
          value: model[chart.path]?.[chart.key] ?? null,
        }))
        return (
          <MiniBarChart
            key={chart.key}
            title={chart.label}
            lowerBetter={chart.lowerBetter}
            data={data}
          />
        )
      })}
    </div>
  )
}
