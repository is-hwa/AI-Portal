import 'dotenv/config'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import { readHfModels, readHidden, writeHidden } from './hf/pipeline.js'
import { startCollect, collectStatus } from './collector.js'
import { startScheduler } from './scheduler.js'
import { getNews } from './news.js'

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.PORT || 3001

app.get('/api/hf/models', async (_req, res) => {
  const [data, hiddenList] = await Promise.all([readHfModels(), readHidden()])
  const hidden = new Set(hiddenList)
  const families = data.families
    .map((f) => ({ ...f, members: f.members.filter((m) => !hidden.has(m.id)) }))
    .filter((f) => f.members.length > 0)
  res.json({ ...data, families })
})

app.get('/api/hf/status', (_req, res) => {
  res.json(collectStatus())
})

app.post('/api/hf/refresh', (_req, res) => {
  const started = startCollect('수동 수집')
  res.status(started ? 202 : 409).json({
    started,
    message: started ? '수집을 시작했습니다' : '이미 수집이 진행 중입니다',
  })
})

// 스팸·오분류 리포를 화면에서 빼는 목록. 다음 수집부터 반영되고, 지금 화면에서도
// 바로 빠지도록 응답 단계에서도 거른다.
app.get('/api/hf/hidden', async (_req, res) => {
  res.json(await readHidden())
})

app.post('/api/hf/hidden', async (req, res) => {
  const { id, hidden } = req.body ?? {}
  if (typeof id !== 'string' || !id.includes('/')) {
    return res.status(400).json({ error: 'id는 "조직/리포" 형식이어야 합니다' })
  }
  const current = new Set(await readHidden())
  if (hidden === false) current.delete(id)
  else current.add(id)
  await writeHidden([...current].sort())
  res.json([...current])
})

app.get('/api/news', async (req, res) => {
  try {
    res.json(await getNews({ refresh: req.query.refresh === '1' }))
  } catch (err) {
    res.status(502).json({ error: err.message })
  }
})

// 빌드된 프론트를 같은 서버에서 서빙한다. `npm run build` 후 `node server/index.js`
// 하나로 프론트+API가 함께 뜬다.
const DIST_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(DIST_DIR))

// API가 아닌 경로는 전부 SPA 진입점으로 — 새로고침해도 화면이 뜨게.
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} 에서 실행 중`)
  startScheduler()
})
