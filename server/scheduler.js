import cron from 'node-cron'
import { runResearch } from './research.js'
import { readPending } from './store.js'

const SCHEDULE = '0 3 * * *' // 매일 새벽 3시

// 마지막 점검이 이보다 오래됐으면 서버가 켜지자마자 한 번 따라잡는다.
const STALE_MS = 20 * 60 * 60 * 1000

async function runNightly(label) {
  console.log(`[scheduler] ${label} 시작`)
  try {
    const result = await runResearch({ onProgress: (msg) => console.log(`[scheduler] ${msg}`) })
    console.log(`[scheduler] 완료 — 항목 ${result.items.length}개, 검토 대기`)
  } catch (err) {
    console.error('[scheduler] 리서치 실패:', err)
  }
}

// 크론은 서버 프로세스 안에서 돌아서, 새벽 3시에 PC가 꺼져 있거나 절전 중이면 그날
// 점검이 통째로 빠진다(실제로 그래서 새로 나온 모델을 놓쳤다). 서버가 켜질 때
// 마지막 점검 시각을 보고 하루 가까이 지났으면 바로 한 번 돌린다.
async function catchUpIfStale() {
  const { checkedAt } = await readPending()
  const age = checkedAt ? Date.now() - new Date(checkedAt).getTime() : Infinity
  if (age < STALE_MS) return
  const hours = Number.isFinite(age) ? `${Math.round(age / 3600000)}시간 전` : '기록 없음'
  await runNightly(`놓친 점검 따라잡기 (마지막 점검: ${hours})`)
}

export function startScheduler() {
  console.log(`[scheduler] 매일 새벽 3시(${SCHEDULE})에 자동 리서치가 실행되도록 등록됨`)
  cron.schedule(SCHEDULE, () => runNightly('야간 리서치'))
  catchUpIfStale()
}
