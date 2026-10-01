import cron from 'node-cron'
import { startCollect, lastCollectedAt } from './collector.js'

const SCHEDULE = '0 3 * * *' // 매일 새벽 3시

// 마지막 수집이 이보다 오래됐으면 서버가 켜지자마자 한 번 따라잡는다.
const STALE_MS = 20 * 60 * 60 * 1000

// 크론은 서버 프로세스 안에서 돌아서, 새벽 3시에 PC가 꺼져 있거나 절전 중이면 그날
// 수집이 통째로 빠진다. 하루치 스냅샷이 빠지면 "이번 주 상승폭"이 덜 정확해지므로
// 서버가 켜질 때 마지막 수집 시각을 보고 하루 가까이 지났으면 바로 돌린다.
async function catchUpIfStale() {
  const updatedAt = await lastCollectedAt()
  const age = updatedAt ? Date.now() - new Date(updatedAt).getTime() : Infinity
  if (age < STALE_MS) return
  const hours = Number.isFinite(age) ? `${Math.round(age / 3600000)}시간 전` : '기록 없음'
  startCollect(`놓친 수집 따라잡기 (마지막 수집: ${hours})`)
}

export function startScheduler() {
  console.log(`[scheduler] 매일 새벽 3시(${SCHEDULE})에 HuggingFace 수집이 실행되도록 등록됨`)
  cron.schedule(SCHEDULE, () => startCollect('야간 수집'))
  catchUpIfStale()
}
