import { formatParams, formatVram } from './paramTiers'

const fmtScore = (v) => (v == null ? '—' : v)
const fmtPrice = (v) => (v == null ? '—' : `$${v}`)
const fmtUsd = (v) => (v == null ? '—' : `$${v < 0.01 ? v.toFixed(3) : v.toFixed(2)}`)

const NAME_COL = {
  key: 'name',
  label: '모델명',
  getValue: (m) => m.name,
  sortable: true,
  required: true,
}
const PROVIDER_COL = {
  key: 'provider',
  label: '제공사',
  getValue: (m) => m.provider,
  sortable: true,
  required: true,
}

// AA 무료 티어가 안 주는 지표(컨텍스트 윈도우 등)는 앞으로도 거의 안 채워지는데,
// 컬럼만 남아 있으면 표가 빈칸투성이로 보인다. 지표가 바뀔 때마다 손으로 컬럼을
// 빼는 대신 실제 채움률로 판단한다.
const MIN_COVERAGE = 0.2

export function visibleColumns(columns, models) {
  if (models.length === 0) return columns
  return columns.filter((col) => {
    if (col.required) return true
    const filled = models.filter((m) => col.getValue(m) != null).length
    return filled / models.length >= MIN_COVERAGE
  })
}

// 개별 벤치마크(MMLU-Pro, GPQA 등)는 자동 갱신 파이프라인이 없어서(Private AI 연결
// 전까지는 사람이 손으로 채운 값 그대로 굳어있음) 비교표에서 뺐다. 대신 Artificial
// Analysis 지수 3종은 매번 리서치를 돌릴 때마다 100% 자동으로 전 모델이 채워지므로
// 이것만 기본 비교 기준으로 쓴다.
// 파라미터·VRAM·라이선스는 "우리 서버에 올릴 수 있나"를 판단하는 정보라서 로컬
// 오픈소스 탭에서만 의미가 있다. API 모델 탭에선 전부 빈칸이라 숨긴다.
const PARAMS_COL = {
  key: 'params_b',
  label: '파라미터',
  getValue: (m) => m.params_b,
  format: formatParams,
  sortable: true,
  openSourceOnly: true,
}

const VRAM_COL = {
  key: 'vram_gb',
  label: '필요 VRAM',
  getValue: (m) => m.params_b,
  format: formatVram,
  sortable: true,
  lowerBetter: true,
  openSourceOnly: true,
}

const LICENSE_COL = {
  key: 'license',
  label: '라이선스',
  getValue: (m) => m.license,
  sortable: true,
  openSourceOnly: true,
}

export const CAPABILITY_COLUMNS = [
  NAME_COL,
  PROVIDER_COL,
  PARAMS_COL,
  VRAM_COL,
  LICENSE_COL,
  {
    key: 'aa_intelligence_index',
    label: '종합지능지수',
    group: 'AI 성능 지수 (자동 갱신)',
    getValue: (m) => m.benchmarks?.aa_intelligence_index,
    format: fmtScore,
    sortable: true,
  },
  {
    key: 'aa_coding_index',
    label: '코딩지수',
    group: 'AI 성능 지수 (자동 갱신)',
    getValue: (m) => m.benchmarks?.aa_coding_index,
    format: fmtScore,
    sortable: true,
  },
  {
    key: 'aa_agentic_index',
    label: '에이전틱지수',
    group: 'AI 성능 지수 (자동 갱신)',
    getValue: (m) => m.benchmarks?.aa_agentic_index,
    format: fmtScore,
    sortable: true,
  },
]

export const SPEED_COST_COLUMNS = [
  NAME_COL,
  PROVIDER_COL,
  {
    key: 'ttft_ms',
    label: 'TTFT (ms)',
    group: '속도',
    getValue: (m) => m.speed?.ttft_ms,
    format: fmtScore,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'ttfa_ms',
    label: 'TTFA (ms)',
    group: '속도',
    getValue: (m) => m.speed?.ttfa_ms,
    format: fmtScore,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'e2e_response_ms',
    label: '전체 응답 (ms)',
    group: '속도',
    getValue: (m) => m.speed?.e2e_response_ms,
    format: fmtScore,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'throughput_tps',
    label: '처리량 (tok/s)',
    group: '속도',
    getValue: (m) => m.speed?.throughput_tps,
    format: fmtScore,
    sortable: true,
  },
  {
    key: 'cost_per_task_usd',
    label: '1건당 실측 비용',
    hint: 'Artificial Analysis 평가 문제 1건을 실제로 풀게 하는 데 든 평균 금액입니다. 단가(100만 토큰당 가격)가 같아도 추론을 길게 하는 모델은 토큰을 훨씬 많이 써서 실제 비용이 몇 배 차이 납니다.',
    group: '비용',
    getValue: (m) => m.pricing?.cost_per_task_usd,
    format: fmtUsd,
    cellTitle: (m) => {
      const p = m.pricing ?? {}
      if (p.reasoning_cost_per_task_usd == null) return undefined
      return `입력 ${fmtUsd(p.input_cost_per_task_usd)} + 추론 ${fmtUsd(p.reasoning_cost_per_task_usd)} + 답변 ${fmtUsd(p.answer_cost_per_task_usd)}`
    },
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'reasoning_cost_per_task_usd',
    label: '1건당 추론 비용',
    hint: '1건당 실측 비용 중 모델이 답을 내기 전에 "생각"하는 데(추론 토큰) 쓴 금액입니다. 같은 모델이라도 추론을 길게 할수록 커집니다. 셀에 마우스를 올리면 추론 토큰 수가 보입니다.',
    group: '비용',
    getValue: (m) => m.pricing?.reasoning_cost_per_task_usd,
    format: fmtUsd,
    cellTitle: (m) =>
      m.pricing?.reasoning_tokens_per_task != null
        ? `추론 토큰 ${m.pricing.reasoning_tokens_per_task.toLocaleString()}개/건`
        : undefined,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'input_per_1m',
    label: '입력 $/1M',
    group: '비용',
    getValue: (m) => m.pricing?.input_per_1m,
    format: fmtPrice,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'output_per_1m',
    label: '출력 $/1M',
    group: '비용',
    getValue: (m) => m.pricing?.output_per_1m,
    format: fmtPrice,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'cache_hit_per_1m',
    label: '캐시 히트 $/1M',
    group: '비용',
    getValue: (m) => m.pricing?.cache_hit_per_1m,
    format: fmtPrice,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'cache_write_per_1m',
    label: '캐시 기록 $/1M',
    group: '비용',
    getValue: (m) => m.pricing?.cache_write_per_1m,
    format: fmtPrice,
    sortable: true,
    lowerBetter: true,
  },
  {
    key: 'context_window',
    label: '컨텍스트',
    getValue: (m) => m.context_window,
    sortable: true,
  },
]

export const RADAR_AXES = [
  { key: 'aa_intelligence_index', label: '종합지능지수', get: (m) => m.benchmarks?.aa_intelligence_index },
  { key: 'aa_coding_index', label: '코딩지수', get: (m) => m.benchmarks?.aa_coding_index },
  { key: 'aa_agentic_index', label: '에이전틱지수', get: (m) => m.benchmarks?.aa_agentic_index },
]
