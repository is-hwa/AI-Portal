import { useEffect, useState } from 'react'
import CandidateSection from '../components/CandidateSection'
import AutoAppliedLog from '../components/AutoAppliedLog'

const FIELD_LABELS = {
  'benchmarks.mmlu_pro': 'MMLU-Pro',
  'benchmarks.gpqa': 'GPQA',
  'benchmarks.swebench': 'SWE-bench',
  'benchmarks.livecodebench': 'LiveCodeBench',
  'benchmarks.math': 'MATH',
  'benchmarks.aime': 'AIME',
  'benchmarks.mmmu': 'MMMU',
  'benchmarks.arena_elo': 'Arena Elo',
  'benchmarks.aa_intelligence_index': 'AA 종합지능지수',
  'benchmarks.aa_coding_index': 'AA 코딩지수',
  'benchmarks.aa_agentic_index': 'AA 에이전틱지수',
  'speed.ttft_ms': 'TTFT(ms)',
  'speed.ttfa_ms': 'TTFA(ms)',
  'speed.e2e_response_ms': '전체 응답(ms)',
  'speed.throughput_tps': '처리량(tok/s)',
  'pricing.input_per_1m': '입력 $/1M',
  'pricing.output_per_1m': '출력 $/1M',
  'pricing.cache_hit_per_1m': '캐시 히트 $/1M',
  'pricing.cache_write_per_1m': '캐시 기록 $/1M',
  'pricing.cost_per_task_usd': '1건당 실측 비용',
  'pricing.input_cost_per_task_usd': '1건당 입력 비용',
  'pricing.reasoning_cost_per_task_usd': '1건당 추론 비용',
  'pricing.answer_cost_per_task_usd': '1건당 답변 비용',
  'pricing.reasoning_tokens_per_task': '1건당 추론 토큰',
  context_window: '컨텍스트 윈도우',
  params_b: '파라미터',
}

const ACTION_TONES = {
  teal: 'border border-teal-600 text-teal-700 hover:bg-teal-50',
  indigo: 'border border-indigo-600 text-indigo-700 hover:bg-indigo-50',
  emerald: 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50',
  amber: 'border border-amber-600 text-amber-700 hover:bg-amber-50',
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`)
  return data
}

function ChangedFields({ changed }) {
  const entries = Object.entries(changed ?? {})
  if (entries.length === 0) return <p className="text-sm text-slate-400">변경 사항 없음</p>
  return (
    <ul className="space-y-1 text-sm">
      {entries.map(([field, { from, to }]) => (
        <li key={field} className="text-slate-700">
          <span className="font-medium text-slate-900">{FIELD_LABELS[field] ?? field}</span>:{' '}
          <span className="text-slate-400 line-through">{from ?? '—'}</span>
          {' → '}
          <span className="font-semibold text-indigo-600">{to}</span>
        </li>
      ))}
    </ul>
  )
}

export default function Admin() {
  const [pending, setPending] = useState({ checkedAt: null, items: [] })
  const [running, setRunning] = useState(null)
  const [models, setModels] = useState([])
  const [autoLog, setAutoLog] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const [p, m, log] = await Promise.all([
        api('/api/pending'),
        api('/api/models'),
        api('/api/auto-applied'),
      ])
      setPending(p)
      setModels(m)
      setAutoLog(log)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // 수동 실행 버튼들은 "상태 문구 띄우고 → 호출하고 → 결과 반영" 흐름이 같아서
  // 액션 정의만 나열하고 실행은 한 군데서 처리한다. 동시에 두 개를 돌릴 일이 없어
  // 로딩 상태도 "지금 실행 중인 액션 id" 하나로 충분하다.
  const ACTIONS = [
    {
      id: 'research',
      label: '지금 리서치 실행',
      busyLabel: '실행 중…',
      path: '/api/research/run-now',
      status: '리서치 실행 중 — 모델 수에 따라 1~3분 정도 걸릴 수 있습니다',
      reload: true,
      onDone: () => '완료',
    },
    {
      id: 'scan-opensource',
      label: '오픈소스 카탈로그 전체 스캔',
      busyLabel: '스캔 중…',
      tone: 'teal',
      path: '/api/opensource/scan-catalog',
      title:
        'AA 카탈로그 656여개를 오픈소스 규칙으로 직접 훑어서 한 번에 후보를 채워넣습니다. 자동 실행 대상 아님.',
      status: 'AA 카탈로그 전체 스캔 중 — 제공사당 최대 3개까지 후보를 뽑습니다',
      onDone: (result) => {
        setPending(result.pending)
        return `완료 — 신규 후보 ${result.added}건 추가됨`
      },
    },
    {
      id: 'scan-api',
      label: 'API 모델 카탈로그 스캔',
      busyLabel: '스캔 중…',
      tone: 'indigo',
      path: '/api/models/scan-api-catalog',
      title:
        'API 모델 카탈로그에서 제공사별 최고 성능 2개 + 최저가 2개를 후보로 올립니다. 자동 실행 대상 아님.',
      status: 'API 모델 카탈로그 스캔 중 — 제공사당 최고 성능 2개 + 최저가 2개를 뽑습니다',
      onDone: (result) => {
        setPending(result.pending)
        return `완료 — 신규 후보 ${result.added}건 추가됨`
      },
    },
    {
      id: 'backfill-params',
      label: '파라미터 수 보강 (HuggingFace)',
      busyLabel: '조회 중…',
      tone: 'emerald',
      path: '/api/opensource/backfill-params',
      title:
        '파라미터 수가 비어있는 오픈소스 모델을 HuggingFace 공개 API로 조회해 채웁니다. 자동 실행 대상 아님.',
      status: '파라미터 수 보강 중 — HuggingFace에서 모델별로 조회합니다',
      onDone: (result) => `완료 — ${result.checked}건 확인, ${result.filled}건 채워짐`,
    },
    {
      id: 'verify-weights',
      label: '가중치 공개 여부 확인',
      busyLabel: '확인 중…',
      tone: 'amber',
      path: '/api/opensource/verify-weights',
      title:
        '오픈소스로 등록된 모델의 가중치가 HuggingFace에 실제로 공개돼 있는지 전수 확인합니다. 자동 실행 대상 아님.',
      status: '가중치 공개 여부 확인 중 — HuggingFace에서 모델별로 조회합니다',
      reload: true,
      onDone: (result) =>
        `완료 — ${result.checked}건 확인, 가중치 미확인 ${result.unverified.length}건 (아래 목록에서 표시됨)`,
    },
  ]

  async function runAction(action) {
    setRunning(action.id)
    setStatus(action.status)
    setError('')
    try {
      const result = await api(action.path, { method: 'POST' })
      if (action.reload) await load()
      setStatus(action.onDone(result))
    } catch (err) {
      setError(err.message)
      setStatus('')
    } finally {
      setRunning(null)
    }
  }

  async function handleDeleteModel(name) {
    if (!window.confirm(`'${name}' 모델을 비교표에서 삭제할까요?`)) return
    setError('')
    try {
      await api('/api/models/delete', { method: 'POST', body: JSON.stringify({ name }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleApply(name) {
    setError('')
    try {
      await api('/api/pending/apply', { method: 'POST', body: JSON.stringify({ name }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDismiss(name) {
    setError('')
    try {
      await api('/api/pending/dismiss', { method: 'POST', body: JSON.stringify({ name }) })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  const activeItems = pending.items.filter((i) => i.status !== 'applied')
  const aaNew = activeItems.filter((i) => i.type === 'aa-new')
  const aaNewMinor = activeItems.filter((i) => i.type === 'aa-new-minor')
  const aaNewOpenSource = activeItems.filter((i) => i.type === 'aa-new-opensource')
  const aaNewApi = activeItems.filter((i) => i.type === 'aa-new-api')
  const hfNew = activeItems.filter((i) => i.type === 'hf-new')
  const changedUpdates = activeItems.filter((i) => i.type === 'update' && i.status === 'changed')
  const newsSnippets = activeItems.filter((i) => i.type === 'news-snippet')
  const unchanged = activeItems.filter((i) => i.type === 'update' && i.status === 'unchanged')
  const noSource = activeItems.filter((i) => i.type === 'update' && i.status === 'no-source')
  const errored = activeItems.filter((i) => i.status === 'error')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">업데이트 관리</h1>
      <p className="mt-1 text-sm text-slate-500">
        매일 새벽 3시에 자동 점검합니다. 새 주력 모델과 기존 모델의 지표 변경은 확인 없이 바로
        반영되고, 아래 "자동 반영 내역"에서 확인할 수 있습니다. 판단이 필요한 것(하위 변형,
        가중치를 못 찾은 모델, 카탈로그 스캔 결과)만 검토 대기로 남습니다.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        마지막 확인: {pending.checkedAt ? new Date(pending.checkedAt).toLocaleString('ko-KR') : '아직 없음'}
      </p>

      <div className="my-5 flex flex-wrap items-center gap-3">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => runAction(action)}
            disabled={running != null}
            title={action.title}
            className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              action.tone ? ACTION_TONES[action.tone] : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            {running === action.id ? action.busyLabel : action.label}
          </button>
        ))}
        {status && <span className="text-sm text-slate-500">{status}</span>}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <AutoAppliedLog
        entries={autoLog}
        trackedNames={new Set(models.map((m) => m.name))}
        fieldLabels={FIELD_LABELS}
        onDelete={handleDeleteModel}
      />

      <h2 className="mb-3 text-base font-semibold text-slate-800">검토 대기</h2>

      {aaNew.length === 0 &&
        aaNewMinor.length === 0 &&
        aaNewOpenSource.length === 0 &&
        aaNewApi.length === 0 &&
        hfNew.length === 0 &&
        changedUpdates.length === 0 &&
        newsSnippets.length === 0 &&
        errored.length === 0 &&
        noSource.length === 0 && (
          <p className="text-sm text-slate-400">검토 대기 중인 항목이 없습니다.</p>
        )}

      <CandidateSection
        title="API 모델 후보"
        description="제공사별로 성능 최상위와 최저가를 같이 뽑았습니다 — 저가 티어(Haiku·mini·Flash 급)가 비용 비교에 필요해서입니다."
        items={aaNewApi}
        tone="indigo"
        renderMeta={(item) =>
          `종합지능지수 ${item.intelligenceIndex ?? '—'} · 입력 $${item.inputPricePer1m ?? '—'}/1M`
        }
        onApply={handleApply}
        onDismiss={handleDismiss}
      />

      <CandidateSection
        title="오픈소스 신규 모델 감지됨 — AA 순위권"
        description='HuggingFace 트렌딩 중 Artificial Analysis 카탈로그에도 잡히는(=실제 순위권에 있는) 모델인데 아직 로컬 오픈소스 비교표엔 없는 것들입니다. "추가"하면 바로 비교표에 들어갑니다.'
        items={aaNewOpenSource}
        tone="teal"
        renderBadge={(item) =>
          item.weightsVerified === false && (
            <span
              className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700"
              title="HuggingFace에서 공개된 체크포인트를 찾지 못했습니다. 로컬 실행이 불가능한 API 전용 모델일 수 있습니다."
            >
              가중치 미확인
            </span>
          )
        }
        renderMeta={(item) => (
          <>
            종합지능지수 {item.intelligenceIndex ?? '—'} · HF 좋아요 {item.likes?.toLocaleString()}
            {item.hfUrl && (
              <>
                {' · '}
                <a href={item.hfUrl} target="_blank" rel="noreferrer" className="underline">
                  HF 보기
                </a>
              </>
            )}
          </>
        )}
        onApply={handleApply}
        onDismiss={handleDismiss}
      />

      <CandidateSection
        title="추적 중인 제공사의 신규 모델 감지됨"
        description="추적 중인 제공사의 새 모델 중 자동 추가를 보류한 것입니다. 보류 사유를 보고 추가하거나 무시하세요."
        items={aaNew}
        tone="violet"
        renderMeta={(item) =>
          `출시 ${item.releaseDate} · 종합지능지수 ${item.intelligenceIndex ?? '—'}` +
          (item.holdReason ? ` · ${item.holdReason}` : '')
        }
        onApply={handleApply}
        onDismiss={handleDismiss}
      />
      {aaNewMinor.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-500">
            마이너 버전·하위 라인업 ({aaNewMinor.length})
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            같은 제공사에서 나온 하위 등급/변형 모델들입니다. 제공사별로 묶어뒀으니, 필요한
            것만 "추가"해서 성능비교 탭에서 제공사 필터로 서로 비교해보세요.
          </p>
          <div className="space-y-4">
            {Object.entries(
              aaNewMinor.reduce((acc, item) => {
                ;(acc[item.provider] ??= []).push(item)
                return acc
              }, {}),
            ).map(([provider, items2]) => (
              <div key={provider}>
                <h3 className="mb-1.5 text-xs font-semibold text-slate-500">{provider}</h3>
                <div className="space-y-1.5">
                  {items2.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5"
                    >
                      <div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-indigo-600 hover:underline"
                        >
                          {item.name}
                        </a>
                        <span className="ml-2 text-xs text-slate-400">
                          출시 {item.releaseDate} · 지수 {item.intelligenceIndex ?? '—'}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleApply(item.name)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-violet-50"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => handleDismiss(item.name)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-white"
                        >
                          무시
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hfNew.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-500">
            HuggingFace 신규 트렌딩 감지됨 ({hfNew.length})
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            어제 스냅샷에 없던 모델이 새로 트렌딩에 올라왔습니다 (완전 자동·무료).
          </p>
          <div className="space-y-2">
            {hfNew.map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/40 px-4 py-2"
              >
                <div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-indigo-600 hover:underline"
                  >
                    {item.name}
                  </a>
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {item.category === 'embedding' ? '임베딩 모델' : '로컬 LLM'}
                  </span>
                  <p className="text-xs text-slate-400">
                    좋아요 {item.likes?.toLocaleString()} · 다운로드 {item.downloads?.toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDismiss(item.name)}
                  className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  확인함
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {noSource.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">
            소스를 못 가져옴 ({noSource.length})
          </h2>
          <div className="space-y-2">
            {noSource.map((item) => (
              <div
                key={item.name}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800"
              >
                <span className="font-medium">{item.name}</span>: {item.reason}
              </div>
            ))}
          </div>
        </section>
      )}

      {changedUpdates.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">
            기존 모델 값 변경 감지됨 ({changedUpdates.length})
          </h2>
          <div className="space-y-3">
            {changedUpdates.map((item) => (
              <div key={item.name} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApply(item.name)}
                      className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      적용
                    </button>
                    <button
                      onClick={() => handleDismiss(item.name)}
                      className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-white"
                    >
                      무시
                    </button>
                  </div>
                </div>
                <ChangedFields changed={item.changed} />
              </div>
            ))}
          </div>
        </section>
      )}

      {newsSnippets.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-1 text-sm font-semibold text-slate-500">
            제공사별 최신 소식 원문 ({newsSnippets.length})
          </h2>
          <p className="mb-3 text-xs text-slate-400">
            LLM 해석 없이 공식 페이지 텍스트 일부를 그대로 보여줍니다 — 새 모델이 나왔는지는
            직접 읽고 판단해주세요.
          </p>
          <div className="space-y-3">
            {newsSnippets.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{item.name}</h3>
                  <button
                    onClick={() => handleDismiss(item.name)}
                    className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    확인함
                  </button>
                </div>
                {item.preview ? (
                  <p className="text-sm leading-relaxed text-slate-600">{item.preview}…</p>
                ) : (
                  <p className="text-sm text-amber-700">
                    읽을 수 있는 텍스트를 가져오지 못했습니다 (자바스크립트 렌더링 페이지일 수
                    있음)
                  </p>
                )}
                {item.sources?.[0]?.url && (
                  <a
                    href={item.sources[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-indigo-600 hover:underline"
                  >
                    원문 보기 →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {errored.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-500">오류 ({errored.length})</h2>
          <div className="space-y-2">
            {errored.map((item, i) => (
              <div
                key={item.name ?? i}
                className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
              >
                {item.name ? `${item.name}: ` : ''}
                {item.error}
              </div>
            ))}
          </div>
        </section>
      )}

      {unchanged.length > 0 && (
        <p className="text-xs text-slate-400">변경 없음: {unchanged.map((i) => i.name).join(', ')}</p>
      )}

      <section className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="mb-1 text-sm font-semibold text-slate-500">
          추적 중인 모델 ({models.length})
        </h2>
        <p className="mb-3 text-xs text-slate-400">
          비교표에 올라가 있는 모델 목록입니다. "가중치 미확인"은 HuggingFace에서 공개된
          체크포인트를 찾지 못했다는 뜻으로, 로컬에서 못 돌리는 API 전용 모델일 수 있습니다.
        </p>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {models.map((m) => (
            <div key={m.name} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <span className="text-sm font-medium text-slate-800">{m.name}</span>
                <span className="ml-2 text-xs text-slate-400">{m.provider}</span>
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                  {m.deployment === 'open_source' ? '오픈소스' : 'API'}
                </span>
                {m.weights_verified === false && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">
                    가중치 미확인
                  </span>
                )}
                {m.hf_url && (
                  <a
                    href={m.hf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 text-[11px] text-indigo-600 hover:underline"
                  >
                    HF ↗
                  </a>
                )}
              </div>
              <button
                onClick={() => handleDeleteModel(m.name)}
                className="shrink-0 rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
