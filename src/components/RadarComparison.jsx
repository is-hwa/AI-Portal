import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { RADAR_AXES } from '../data/metricColumns'

const COLORS = ['#4f46e5', '#f97316', '#10b981', '#e11d48']

export default function RadarComparison({ models, selectedNames }) {
  const selectedModels = selectedNames
    .map((name) => models.find((m) => m.name === name))
    .filter(Boolean)

  if (selectedModels.length < 2) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
        비교하려면 표에서 모델을 2~4개 선택하세요.
      </div>
    )
  }

  const data = RADAR_AXES.map((axis) => {
    const point = { subject: axis.label }
    selectedModels.forEach((model) => {
      point[model.name] = axis.get(model) ?? 0
    })
    return point
  })

  // 소형 오픈소스 모델은 지수가 한 자릿수~20대에 머무는 경우가 많아, 축을 항상
  // 0~100으로 고정하면 그래프가 중앙에 점처럼 뭉쳐 비교가 안 된다. 선택된 모델들의
  // 실제 최댓값에 맞춰 축을 동적으로 잡아서 매번 그래프가 꽉 차게 그려지도록 한다.
  const maxValue = Math.max(0, ...data.flatMap((point) => selectedModels.map((m) => point[m.name] ?? 0)))
  const domainMax = maxValue <= 0 ? 100 : Math.min(100, Math.ceil((maxValue * 1.15) / 10) * 10)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height={360}>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 13 }} />
          <PolarRadiusAxis
            angle={30}
            domain={[0, domainMax]}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          {selectedModels.map((model, i) => (
            <Radar
              key={model.name}
              name={model.name}
              dataKey={model.name}
              stroke={COLORS[i % COLORS.length]}
              fill={COLORS[i % COLORS.length]}
              fillOpacity={0.2}
            />
          ))}
          <Tooltip />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-xs text-slate-400">
        Artificial Analysis 지수 기준 (매 리서치마다 자동 갱신). 데이터가 없는 항목은 0으로
        표시됩니다.
      </p>
    </div>
  )
}
