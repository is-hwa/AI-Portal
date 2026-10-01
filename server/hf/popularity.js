import { readdir, readFile, writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// HF는 현재 좋아요·다운로드만 주고 과거 추이는 주지 않는다. 매일 스냅샷을 남겨서
// "이번 주 좋아요 +N"과 추이 그래프를 우리가 직접 만든다. 쌓일수록 HF 화면엔 없는
// 정보가 된다.
const HISTORY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'hf-history')
const KEEP_DAYS = 90

function today() {
  return new Date().toISOString().slice(0, 10)
}

async function listSnapshotDates() {
  try {
    const files = await readdir(HISTORY_DIR)
    return files
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
  } catch (err) {
    if (err.code === 'ENOENT') return []
    throw err
  }
}

async function readSnapshot(date) {
  return JSON.parse(await readFile(path.join(HISTORY_DIR, `${date}.json`), 'utf-8'))
}

export async function writeSnapshot(models) {
  await mkdir(HISTORY_DIR, { recursive: true })
  const snapshot = {}
  for (const m of models) snapshot[m.id] = { likes: m.likes, downloads: m.downloads, buzz: m.buzz }
  await writeFile(path.join(HISTORY_DIR, `${today()}.json`), JSON.stringify(snapshot) + '\n', 'utf-8')

  const dates = await listSnapshotDates()
  for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) {
    await unlink(path.join(HISTORY_DIR, `${old}.json`)).catch(() => {})
  }
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

// 7일 전 스냅샷과 비교한다. 아직 7일치가 안 쌓였으면 가장 오래된 것과 비교하고
// 며칠 간의 변화인지(days)를 같이 넘겨 화면이 "3일간 +N"처럼 정직하게 쓰게 한다.
export async function attachTrends(models) {
  const dates = (await listSnapshotDates()).filter((d) => d < today())
  const series = await Promise.all(dates.slice(-30).map(async (d) => [d, await readSnapshot(d)]))

  const baseDate = [...dates].reverse().find((d) => daysBetween(d, today()) >= 7) ?? dates[0]
  const base = baseDate ? series.find(([d]) => d === baseDate)?.[1] ?? (await readSnapshot(baseDate)) : null
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
