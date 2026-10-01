import { useState } from 'react'
import { classifyLicense, LICENSE_TONE_CLASS } from '../data/license'
import { formatParams, formatVram, vramTier, nativeBits, MIN_BITS, TIER_TONE_CLASS } from '../data/paramTiers'
import { formatCount, daysAgo, specLabel, RELATION_LABEL } from '../utils/format'

function Badge({ className, children, title }) {
  return (
    <span title={title} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex gap-3 text-sm">
      <dt className="w-16 shrink-0 pt-0.5 text-xs font-medium text-slate-400">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-slate-700">{children}</dd>
    </div>
  )
}

// 최소(4bit)·권장(원본 정밀도) 사양을 같은 모양으로 보여준다.
function SpecRow({ label, paramsB, bits, note }) {
  const tier = vramTier(paramsB, bits)
  return (
    <Row label={label}>
      <Badge className={TIER_TONE_CLASS[tier.tone]} title={tier.hint}>
        {tier.label}
      </Badge>
      <span className="text-xs text-slate-500">
        {note} · 약 {formatVram(paramsB, bits)}
      </span>
    </Row>
  )
}

function pickDefault(members) {
  return [...members].sort((a, b) => b.downloads - a.downloads)[0]
}

function derivativeText(d) {
  if (!d || d.quantized == null) return null
  if (d.quantized === 0) return null
  return d.quantized >= 1000 ? '1000개 이상' : `${d.quantized}개`
}

// 계열 하나를 카드 한 장으로 보여준다. 숫자 지표 대신 모델을 고를 때 실제로 묻는
// 네 가지 — 무엇을 잘하나 / 어떤 장비가 필요한가 / 회사에서 써도 되나 / 왜 인기인가 —
// 에 답하는 게 목표다.
export default function FamilyCard({ family, members = family.members, rank, compare }) {
  const [selectedId, setSelectedId] = useState(() => pickDefault(members).id)
  const model = members.find((m) => m.id === selectedId) ?? pickDefault(members)
  const bits = nativeBits(model)
  const license = classifyLicense(model.license)
  const isNew = daysAgo(model.createdAt) <= 30
  const ggufText = derivativeText(model.derivatives)
  const [showDerivatives, setShowDerivatives] = useState(false)
  const inCompare = compare?.selectedIds.includes(model.id)

  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        {rank != null && (
          <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-bold text-slate-300">{rank}</span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <a
              href={model.url}
              target="_blank"
              rel="noreferrer"
              className="truncate text-base font-semibold text-slate-900 hover:text-indigo-600"
            >
              {family.name}
            </a>
            {isNew && <Badge className="bg-indigo-100 text-indigo-700">신규</Badge>}
            {family.korean && <Badge className="bg-sky-100 text-sky-700">국내</Badge>}
            {model.gated && (
              <Badge className="bg-slate-100 text-slate-500" title="HF에서 약관 동의 후 받을 수 있습니다">
                승인 필요
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-slate-400">
            {family.provider}
            {!family.knownOrg && ' · 개인·커뮤니티'}
            {model.paramsB != null && ` · ${formatParams(model.paramsB)}`}
            {model.activeParamsB != null && ` (MoE·활성 ${model.activeParamsB}B)`}
          </p>
        </div>
        {compare && (
          <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-slate-500">
            <input
              type="checkbox"
              checked={inCompare}
              disabled={!inCompare && compare.selectedIds.length >= compare.max}
              onChange={() => compare.onToggle(model)}
              className="accent-indigo-600"
            />
            비교
          </label>
        )}
      </header>

      {members.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedId(m.id)}
              title={m.id}
              className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                m.id === model.id
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}
            >
              {m.paramsB != null ? formatParams(m.paramsB) : m.name}
            </button>
          ))}
        </div>
      )}

      <dl className="flex flex-1 flex-col gap-2">
        <Row label="잘하는 것">
          {model.specialization.map((s) => (
            <Badge key={s} className="bg-slate-100 text-slate-600">
              {specLabel(s)}
            </Badge>
          ))}
        </Row>
        {model.paramsB != null ? (
          <>
            <SpecRow label="최소 사양" paramsB={model.paramsB} bits={MIN_BITS} note="4bit 양자화" />
            <SpecRow label="권장 사양" paramsB={model.paramsB} bits={bits} note={`원본 ${bits}bit 그대로`} />
          </>
        ) : (
          <Row label="필요 사양">
            <span className="text-xs text-slate-400">모델 크기 정보가 없어 계산할 수 없습니다</span>
          </Row>
        )}
        <Row label="회사 사용">
          <Badge className={LICENSE_TONE_CLASS[license.tone]}>{license.label}</Badge>
          <span className="truncate text-xs text-slate-400">{model.license ?? '라이선스 표기 없음'}</span>
        </Row>
        <Row label="인기">
          <span className="text-xs text-slate-600">
            ♥ {formatCount(model.likes)} · 30일 다운로드 {formatCount(model.downloads)}
          </span>
          {model.trend && model.trend.likes > 0 && (
            <Badge className="bg-emerald-50 text-emerald-700">
              {model.trend.days}일간 ♥ +{formatCount(model.trend.likes)}
            </Badge>
          )}
          {ggufText && (
            <a
              href={model.derivatives.quantizedUrl}
              target="_blank"
              rel="noreferrer"
              title="다른 사람들이 로컬 실행용으로 만든 양자화(GGUF 등) 버전 수 — 실제로 많이 돌린다는 신호"
              className="text-xs text-indigo-600 hover:underline"
            >
              양자화 버전 {ggufText}
            </a>
          )}
        </Row>
      </dl>

      {model.topDerivatives?.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button
            onClick={() => setShowDerivatives((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {showDerivatives ? '▾' : '▸'} 요즘 뜨는 커뮤니티 버전 {model.topDerivatives.length}개
          </button>
          {showDerivatives && (
            <ul className="mt-1.5 space-y-1">
              {model.topDerivatives.map((d) => (
                <li key={d.id} className="flex items-center gap-1.5 text-xs">
                  <Badge className="bg-slate-50 text-slate-500">{RELATION_LABEL[d.relation] ?? '파생'}</Badge>
                  <a href={d.url} target="_blank" rel="noreferrer" className="truncate text-slate-600 hover:text-indigo-600">
                    {d.id}
                  </a>
                  <span className="shrink-0 text-slate-400">♥ {formatCount(d.likes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
