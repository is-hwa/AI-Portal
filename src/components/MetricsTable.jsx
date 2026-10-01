import { classifyLicense, LICENSE_TONE_CLASS } from '../data/license'

function LicenseCell({ license }) {
  const { label, tone } = classifyLicense(license)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-slate-600">{license ?? '—'}</span>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${LICENSE_TONE_CLASS[tone]}`}>
        {label}
      </span>
    </span>
  )
}

function buildGroupChunks(columns) {
  const chunks = []
  columns.forEach((col) => {
    const group = col.group ?? null
    const last = chunks[chunks.length - 1]
    if (group && last && last.group === group) {
      last.cols.push(col)
    } else {
      chunks.push({ group, cols: [col] })
    }
  })
  return chunks
}

function SortIcon({ active, dir }) {
  return (
    <span className="text-xs text-slate-400">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
  )
}

export default function MetricsTable({
  columns,
  models,
  selected,
  onToggleSelect,
  sortConfig,
  onSort,
  maxReached,
}) {
  const groupChunks = buildGroupChunks(columns)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th rowSpan={2} className="w-10 px-3 py-3 align-bottom" />
            {groupChunks.map((chunk, idx) =>
              chunk.group ? (
                <th
                  key={`group-${idx}`}
                  colSpan={chunk.cols.length}
                  className="border-b border-slate-200 px-3 py-1.5 text-center text-xs font-semibold text-slate-400"
                >
                  {chunk.group}
                </th>
              ) : (
                chunk.cols.map((col) => (
                  <th
                    key={col.key}
                    rowSpan={2}
                    onClick={() => col.sortable && onSort(col.key)}
                    className={`whitespace-nowrap px-3 py-3 text-left align-bottom font-semibold text-slate-600 ${
                      col.sortable ? 'cursor-pointer select-none hover:text-indigo-600' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.hint ? (
                        <span title={col.hint} className="cursor-help border-b border-dotted border-slate-400">
                          {col.label}
                        </span>
                      ) : (
                        col.label
                      )}
                      {col.sortable && (
                        <SortIcon active={sortConfig.key === col.key} dir={sortConfig.dir} />
                      )}
                    </span>
                  </th>
                ))
              ),
            )}
            <th rowSpan={2} className="px-3 py-3 text-left align-bottom font-semibold text-slate-600">
              소개
            </th>
          </tr>
          <tr>
            {groupChunks
              .filter((chunk) => chunk.group)
              .flatMap((chunk) =>
                chunk.cols.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && onSort(col.key)}
                    className={`whitespace-nowrap px-3 py-2 text-left text-xs font-medium text-slate-500 ${
                      col.sortable ? 'cursor-pointer select-none hover:text-indigo-600' : ''
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.hint ? (
                        <span title={col.hint} className="cursor-help border-b border-dotted border-slate-400">
                          {col.label}
                        </span>
                      ) : (
                        col.label
                      )}
                      {col.lowerBetter && <span title="낮을수록 유리">↓</span>}
                      {col.sortable && (
                        <SortIcon active={sortConfig.key === col.key} dir={sortConfig.dir} />
                      )}
                    </span>
                  </th>
                )),
              )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {models.map((model) => {
            const isChecked = selected.includes(model.name)
            const disabled = !isChecked && maxReached
            return (
              <tr
                key={model.name}
                className={`transition-colors ${isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'}`}
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={() => onToggleSelect(model.name)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                  />
                </td>
                {columns.map((col) => {
                  const value = col.getValue(model)
                  return (
                    <td
                      key={col.key}
                      title={col.cellTitle?.(model)}
                      className="whitespace-nowrap px-3 py-3 text-slate-600 first:font-medium first:text-slate-900"
                    >
                      {col.key === 'license' ? (
                        <LicenseCell license={value} />
                      ) : col.format ? (
                        col.format(value)
                      ) : (
                        (value ?? '—')
                      )}
                      {col.key === 'name' && model.weights_verified === false && (
                        <span
                          className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
                          title="HuggingFace에서 공개된 체크포인트를 찾지 못했습니다. 가중치 비공개(API 전용) 모델일 수 있어 로컬 실행이 불가능할 수 있습니다."
                        >
                          가중치 미확인
                        </span>
                      )}
                    </td>
                  )
                })}
                <td className="min-w-[220px] px-3 py-3 text-slate-500">{model.description}</td>
              </tr>
            )
          })}
          {models.length === 0 && (
            <tr>
              <td colSpan={columns.length + 2} className="px-3 py-10 text-center text-slate-400">
                조건에 맞는 모델이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
