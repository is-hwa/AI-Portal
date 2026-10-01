export default function Chips({ options, value, onChange, size = 'md' }) {
  const pad = size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={o.hint}
          className={`rounded-full border font-medium transition-colors ${pad} ${
            value === o.id
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
