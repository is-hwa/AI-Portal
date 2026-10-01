import { getDoc, putDoc, listDocs, removeDoc } from '../storage.js'

// HF는 현재 좋아요·다운로드만 주고 과거 추이는 주지 않는다. 매일 스냅샷을 남겨서
// "이번 주 좋아요 +N"과 추이 그래프를 우리가 직접 만든다. 쌓일수록 HF 화면엔 없는
// 정보가 된다.
const PREFIX = 'hf-history/'
const KEEP_DAYS = 90

// 날짜는 서버 시간대(TZ, 배포 시 Asia/Seoul) 기준. toISOString()은 UTC라서 한국
// 새벽 3시 수집이 전날 날짜로 저장된다.
function today() {
  return new Date().toLocaleDateString('sv-SE')
}

async function listSnapshotDates() {
  return (await listDocs(PREFIX))
    .map((k) => k.slice(PREFIX.length))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
}

export async function writeSnapshot(models) {
  const snapshot = {}
  for (const m of models) snapshot[m.id] = { likes: m.likes, downloads: m.downloads, buzz: m.buzz }
  await putDoc(`${PREFIX}${today()}`, snapshot)

  const dates = await listSnapshotDates()
  for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) {
    await removeDoc(`${PREFIX}${old}`)
  }
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

// 7일 전 스냅샷과 비교한다. 아직 7일치가 안 쌓였으면 가장 오래된 것과 비교하고
// 며칠 간의 변화인지(days)를 같이 넘겨 화면이 "3일간 +N"처럼 정직하게 쓰게 한다.
export async function attachTrends(models) {
  const dates = (await listSnapshotDates()).filter((d) => d < today())
  const series = await Promise.all(dates.slice(-30).map(async (d) => [d, await getDoc(`${PREFIX}${d}`, {})]))

  const baseDate = [...dates].reverse().find((d) => daysBetween(d, today()) >= 7) ?? dates[0]
  const base = baseDate
    ? series.find(([d]) => d === baseDate)?.[1] ?? (await getDoc(`${PREFIX}${baseDate}`, {}))
    : null
  const days = baseDate ? daysBetween(baseDate, today()) : 0

  for (const m of models) {
    const prev = base?.[m.id]
    m.trend = prev
      ? { days, likes: m.likes - prev.likes, downloads: m.downloads - prev.downloads }
      : null
    m.history = series
      .map(([date, snap]) => (snap[m.id] ? { date, likes: snap[m.id].likes } : null))
      .filter(Boolean)
      .concat({ date: today(), likes: m.likes })
  }
}
