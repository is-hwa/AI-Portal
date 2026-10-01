import { useEffect, useState } from 'react'
import { formatDate, relativeTime } from '../utils/format'

async function api(path, options) {
  const res = await fetch(path, options)
  const body = await res.json().catch(() => ({}))
  if (!res.ok && res.status !== 409) throw new Error(body.error ?? `요청 실패 (${res.status})`)
  return body
}

// HF 데이터는 객관적인 수치라 사람이 검토해서 반영할 게 없다. 남은 관리 작업은
// 수집을 지금 돌리는 것과, 스팸·오분류 리포를 화면에서 빼는 것 두 가지뿐이다.
export default function Admin({ data, onCollected }) {
  const [status, setStatus] = useState(null)
  const [hidden, setHidden] = useState([])
  const [newId, setNewId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api('/api/hf/hidden').then(setHidden).catch((err) => setError(err.message))
  }, [])

  // 수집 중일 때만 진행 상황을 3초마다 확인한다.
  useEffect(() => {
    let timer
    let wasRunning = false
    const poll = async () => {
      try {
        const s = await api('/api/hf/status')
        setStatus(s)
        if (wasRunning && !s.running) onCollected()
        wasRunning = s.running
        if (s.running) timer = setTimeout(poll, 3000)
      } catch (err) {
        setError(err.message)
      }
    }
    poll()
    return () => clearTimeout(timer)
  }, [onCollected, status?.startedAt])

  const run = async () => {
    const body = await api('/api/hf/refresh', { method: 'POST' })
    setStatus((s) => ({ ...s, running: true, startedAt: new Date().toISOString(), message: body.message }))
  }

  const toggleHidden = async (id, hide) => {
    try {
      const list = await api('/api/hf/hidden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hidden: hide }),
      })
      setHidden(list)
      setNewId('')
      onCollected()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">관리</h1>
      {error && <p className="mb-4 text-sm text-rose-600">{error}</p>}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">HuggingFace 수집</h2>
        <p className="mb-3 text-xs text-slate-500">
          매일 새벽 3시에 자동으로 돌고, 서버가 꺼져 있었으면 켜질 때 따라잡습니다. 마지막 수집:{' '}
          {data?.updatedAt ? `${formatDate(data.updatedAt)} (${relativeTime(data.updatedAt)}, ${data.durationSec}초 소요)` : '없음'}
        </p>
        <button
          onClick={run}
          disabled={status?.running}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {status?.running ? '수집 중…' : '지금 수집'}
        </button>
        {status?.storage && (
          <p className="mt-2 text-xs text-slate-500">
            저장소: {status.storage === 'postgres' ? 'Postgres (재시작해도 기록 유지)' : 'server/data 파일'}
          </p>
        )}
        <p className="mt-2 text-xs text-slate-400">
          HF 무료 한도(5분에 500건) 때문에 첫 수집은 10분 남짓 걸릴 수 있습니다. 이후엔 캐시로 빨라집니다.
        </p>
        {status?.log?.length > 0 && (
          <ul className="mt-3 space-y-0.5 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
            {status.log.map((l) => (
              <li key={l.at + l.msg}>
                {new Date(l.at).toLocaleTimeString('ko-KR')} {l.msg}
              </li>
            ))}
          </ul>
        )}
        {status?.lastError && <p className="mt-2 text-xs text-rose-600">실패: {status.lastError}</p>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-slate-700">숨긴 모델</h2>
        <p className="mb-3 text-xs text-slate-500">
          스팸이나 잘못 분류된 리포를 목록에서 뺍니다. HF 주소의 "조직/리포" 부분을 넣으세요.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (newId.trim()) toggleHidden(newId.trim(), true)
          }}
          className="mb-3 flex gap-2"
        >
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="예: someone/some-model"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-rose-300 hover:text-rose-600">
            숨기기
          </button>
        </form>
        {hidden.length === 0 ? (
          <p className="text-xs text-slate-400">숨긴 모델이 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {hidden.map((id) => (
              <li key={id} className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-600">{id}</span>
                <button onClick={() => toggleHidden(id, false)} className="text-xs text-indigo-600 hover:underline">
                  다시 보이기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
