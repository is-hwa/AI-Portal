const TABS = [
  { id: 'api', label: 'API 모델' },
  { id: 'open_source', label: '로컬 오픈소스' },
  { id: 'terms', label: '용어 정리' },
  { id: 'admin', label: '업데이트 관리' },
]

export default function TabNav({ active, onChange }) {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl gap-1 px-4 sm:px-6">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`relative px-4 py-4 text-sm font-medium transition-colors sm:text-base ${
                isActive
                  ? 'text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-indigo-600" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
