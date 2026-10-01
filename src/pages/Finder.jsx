import { useMemo, useState } from 'react'
import FamilyCard from '../components/FamilyCard'
import CompareTable from '../components/CompareTable'
import Chips from '../components/Chips'
import { classifyLicense } from '../data/license'
import { estimateVramGb } from '../data/paramTiers'
import { SORTS, rankFamilies } from '../utils/ranking'
import { specLabel } from '../utils/format'

const MAX_COMPARE = 3
const PAGE = 24

const VRAM_OPTIONS = [
  { id: 'any', label: '상관없음' },
  { id: '8', label: '8GB' },
  { id: '12', label: '12GB' },
  { id: '16', label: '16GB' },
  { id: '24', label: '24GB' },
  { id: '48', label: '48GB' },
  { id: '96', label: '96GB' },
]

const LICENSE_OPTIONS = [
  { id: 'any', label: '전체' },
  { id: 'ok', label: '회사에서 사용 가능', hint: '상업 사용 자유 + 조건부 허용(약관 확인 필요)' },
  { id: 'free', label: '조건 없이 자유', hint: 'Apache-2.0 · MIT 등' },
]

function memberMatches(m, f) {
  if (f.vram !== 'any') {
    const gb = estimateVramGb(m.paramsB)
    if (gb == null || gb > Number(f.vram)) return false
  }
  if (f.spec !== 'all' && !m.specialization.includes(f.spec)) return false
  if (f.license !== 'any') {
    const tone = classifyLicense(m.license).tone
    if (f.license === 'free' && tone !== 'free') return false
    if (f.license === 'ok' && tone !== 'free' && tone !== 'conditional') return false
  }
  return true
}

export default function Finder({ data }) {
  const [filters, setFilters] = useState({
    category: 'llm',
    vram: 'any',
    spec: 'all',
    license: 'any',
    korean: false,
    query: '',
  })
  const [sort, setSort] = useState('hot')
  const [limit, setLimit] = useState(PAGE)
  const [compared, setCompared] = useState([])

  const set = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setLimit(PAGE)
  }

  const inCategory = useMemo(
    () => data.families.filter((f) => f.category === filters.category),
    [data, filters.category],
  )

  // 용도 칩은 지금 카테고리에 실제로 있는 특화만 보여준다.
  const specOptions = useMemo(() => {
    const counts = new Map()
    for (const f of inCategory) {
      for (const s of new Set(f.members.flatMap((m) => m.specialization))) {
        counts.set(s, (counts.get(s) ?? 0) + 1)
      }
    }
    return [
      { id: 'all', label: '전체' },
      ...[...counts.entries()]
        .filter(([s]) => s !== '범용')
        .sort((a, b) => b[1] - a[1])
        .map(([s]) => ({ id: s, label: specLabel(s) })),
    ]
  }, [inCategory])

  // 필터는 계열이 아니라 크기별 모델 단위로 건다. "Qwen3.8" 계열 중 24GB에 들어가는
  // 크기만 남기고, 하나도 없으면 계열 자체를 뺀다.
  const results = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    const matched = inCategory
      .filter((f) => !filters.korean || f.korean)
      .filter(
        (f) =>
          !q ||
          f.name.toLowerCase().includes(q) ||
          f.provider.toLowerCase().includes(q) ||
          f.members.some((m) => m.id.toLowerCase().includes(q)),
      )
      .map((f) => ({ family: f, members: f.members.filter((m) => memberMatches(m, filters)) }))
      .filter((r) => r.members.length > 0)
    const order = rankFamilies(
      matched.map((r) => r.family),
      sort,
    )
    const byKey = new Map(matched.map((r) => [r.family.key, r]))
    return order.map((f) => byKey.get(f.key))
  }, [inCategory, filters, sort])

  const compare = {
    max: MAX_COMPARE,
    selectedIds: compared.map((m) => m.id),
    onToggle: (model) =>
      setCompared((list) =>
        list.some((m) => m.id === model.id)
          ? list.filter((m) => m.id !== model.id)
          : list.length < MAX_COMPARE
            ? [...list, model]
            : list,
      ),
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">조건으로 모델 찾기</h1>
        <p className="mt-1 text-sm text-slate-500">
          가진 그래픽카드, 쓰려는 용도, 회사에서 써도 되는지로 좁혀보고 최대 {MAX_COMPARE}개를 골라
          나란히 비교하세요.
        </p>
      </div>

      <div className="mb-6 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
        <Chips
          options={data.categories}
          value={filters.category}
          onChange={(c) => {
            // 용도 칩은 카테고리마다 달라서 같이 초기화한다.
            setFilters((f) => ({ ...f, category: c, spec: 'all' }))
            setLimit(PAGE)
          }}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">내 GPU 메모리 (VRAM)</p>
            <Chips size="sm" options={VRAM_OPTIONS} value={filters.vram} onChange={set('vram')} />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">라이선스</p>
            <Chips size="sm" options={LICENSE_OPTIONS} value={filters.license} onChange={set('license')} />
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-500">용도</p>
          <Chips size="sm" options={specOptions} value={filters.spec} onChange={set('spec')} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set('query')(e.target.value)}
            placeholder="이름·제공사 검색 (예: qwen, gemma, exaone)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:max-w-xs"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={filters.korean}
              onChange={(e) => set('korean')(e.target.checked)}
              className="accent-indigo-600"
            />
            국내 기업 모델만
          </label>
          <div className="sm:ml-auto">
            <Chips size="sm" options={SORTS.filter((s) => s.id !== 'new')} value={sort} onChange={setSort} />
          </div>
        </div>
      </div>

      {compared.length > 0 && <CompareTable models={compared} onRemove={compare.onToggle} />}

      <p className="mb-3 text-sm text-slate-500">
        {results.length}개 계열
        {filters.vram !== 'any' && ' · 4bit 양자화 기준 추정치이며, 긴 문서를 넣으면 더 필요할 수 있습니다'}
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {results.slice(0, limit).map((r) => (
          <FamilyCard key={`${r.family.key}|${r.members.map((m) => m.id).join()}`} family={r.family} members={r.members} compare={compare} />
        ))}
      </div>
      {results.length > limit && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
          >
            더 보기 ({results.length - limit}개 남음)
          </button>
        </div>
      )}
    </div>
  )
}
