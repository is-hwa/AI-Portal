import { useMemo, useState } from 'react'
import { useModels } from '../hooks/useModels'
import MetricsTable from '../components/MetricsTable'
import RadarComparison from '../components/RadarComparison'
import SpeedCostCharts from '../components/SpeedCostCharts'
import SpecializationGrid from '../components/SpecializationGrid'
import { CAPABILITY_COLUMNS, SPEED_COST_COLUMNS, visibleColumns } from '../data/metricColumns'
import { sortModels } from '../utils/sortModels'
import { PARAM_TIERS, getParamTier } from '../data/paramTiers'

const MAX_SELECTED = 4

const CATEGORIES = [
  { id: 'capability', label: '능력 (벤치마크)' },
  { id: 'speed_cost', label: '속도·비용' },
  { id: 'specialization', label: '특화 영역' },
]

export default function ModelComparison({
  deployment,
  title = 'AI 성능 지표 비교',
  description = '능력(벤치마크), 속도·비용, 특화 영역 세 가지 축으로 주요 AI 모델을 비교하세요. 최대 4개까지 선택해 차트로 살펴볼 수 있습니다.',
}) {
  const { models: allModels } = useModels()

  const baseModels = useMemo(
    () => (deployment ? allModels.filter((m) => m.deployment === deployment) : allModels),
    [allModels, deployment],
  )

  const [provider, setProvider] = useState('전체')
  const [paramTier, setParamTier] = useState('전체')
  const [selected, setSelected] = useState([])
  const [category, setCategory] = useState('capability')
  const [capabilitySort, setCapabilitySort] = useState({ key: 'aa_intelligence_index', dir: 'desc' })
  const [speedCostSort, setSpeedCostSort] = useState({ key: 'input_per_1m', dir: 'asc' })

  const providers = useMemo(
    () => ['전체', ...Array.from(new Set(baseModels.map((m) => m.provider)))],
    [baseModels],
  )

  const byProvider = useMemo(
    () => (provider === '전체' ? baseModels : baseModels.filter((m) => m.provider === provider)),
    [baseModels, provider],
  )

  const showParamFilter = deployment === 'open_source'

  const filtered = useMemo(() => {
    if (!showParamFilter || paramTier === '전체') return byProvider
    if (paramTier === '미확인') return byProvider.filter((m) => m.params_b == null)
    return byProvider.filter((m) => getParamTier(m.params_b) === paramTier)
  }, [byProvider, paramTier, showParamFilter])

  // 컬럼 표시 여부는 탭 전체 기준으로 정한다. 필터를 바꿀 때마다 컬럼이 나타났다
  // 사라지면 오히려 혼란스럽기 때문.
  const capabilityColumns = useMemo(
    () =>
      visibleColumns(
        CAPABILITY_COLUMNS.filter((c) => !c.openSourceOnly || showParamFilter),
        baseModels,
      ),
    [showParamFilter, baseModels],
  )
  const speedCostColumns = useMemo(
    () => visibleColumns(SPEED_COST_COLUMNS, baseModels),
    [baseModels],
  )

  const hiddenColumnLabels = useMemo(() => {
    const shown = new Set([...capabilityColumns, ...speedCostColumns].map((c) => c.key))
    return [...CAPABILITY_COLUMNS, ...SPEED_COST_COLUMNS]
      .filter((c) => !c.openSourceOnly || showParamFilter)
      .filter((c) => !shown.has(c.key))
      .map((c) => c.label)
  }, [capabilityColumns, speedCostColumns, showParamFilter])

  const capabilityRows = useMemo(
    () => sortModels(filtered, capabilitySort, capabilityColumns),
    [filtered, capabilitySort, capabilityColumns],
  )
  const speedCostRows = useMemo(
    () => sortModels(filtered, speedCostSort, speedCostColumns),
    [filtered, speedCostSort, speedCostColumns],
  )

  function handleToggleSelect(name) {
    setSelected((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name)
      if (prev.length >= MAX_SELECTED) return prev
      return [...prev, name]
    })
  }

  function toggleSort(setSort, key) {
    setSort((prev) => {
      if (prev.key === key) return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { key, dir: 'desc' }
    })
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {providers.map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              provider === p
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {p}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          선택됨 {selected.length} / {MAX_SELECTED}
        </span>
      </div>

      {showParamFilter && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400">파라미터 규모</span>
          {['전체', ...PARAM_TIERS.map((t) => t.id), '미확인'].map((id) => {
            const tier = PARAM_TIERS.find((t) => t.id === id)
            const label = id === '전체' ? '전체' : id === '미확인' ? '미확인' : tier.label
            return (
              <button
                key={id}
                onClick={() => setParamTier(id)}
                title={tier?.hint}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  paramTier === id
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      )}

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
              category === c.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {c.label}
            {category === c.id && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />
            )}
          </button>
        ))}
      </div>

      {category === 'capability' && (
        <>
          <MetricsTable
            columns={capabilityColumns}
            models={capabilityRows}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            sortConfig={capabilitySort}
            onSort={(key) => toggleSort(setCapabilitySort, key)}
            maxReached={selected.length >= MAX_SELECTED}
          />
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">레이더 차트 비교</h2>
            <RadarComparison models={baseModels} selectedNames={selected} />
          </div>
        </>
      )}

      {category === 'speed_cost' && (
        <>
          <MetricsTable
            columns={speedCostColumns}
            models={speedCostRows}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            sortConfig={speedCostSort}
            onSort={(key) => toggleSort(setSpeedCostSort, key)}
            maxReached={selected.length >= MAX_SELECTED}
          />
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">속도·비용 비교</h2>
            <SpeedCostCharts models={baseModels} selectedNames={selected} />
          </div>
        </>
      )}

      {category === 'specialization' && <SpecializationGrid models={filtered} />}

      {category !== 'specialization' && hiddenColumnLabels.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          데이터가 거의 없어 숨긴 항목: {hiddenColumnLabels.join(', ')} — 수집처(Artificial
          Analysis 무료 티어)가 제공하지 않는 지표입니다.
        </p>
      )}
    </div>
  )
}
