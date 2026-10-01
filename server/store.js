import { readFile, writeFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { candidateKey } from './modelNames.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MODELS_PATH = path.join(__dirname, '..', 'src', 'data', 'models.json')
const PENDING_PATH = path.join(__dirname, 'data', 'pending-updates.json')
const HF_SNAPSHOT_PATH = path.join(__dirname, 'data', 'hf-snapshot.json')
export const AA_CACHE_PATH = path.join(__dirname, 'data', 'aa-catalog-cache.json')
const AUTO_LOG_PATH = path.join(__dirname, 'data', 'auto-applied.json')
const AUTO_LOG_LIMIT = 300

async function readJson(filePath, fallback) {
  try {
    const text = await readFile(filePath, 'utf-8')
    return JSON.parse(text)
  } catch (err) {
    if (err.code === 'ENOENT') return fallback
    throw err
  }
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

export function readModels() {
  return readJson(MODELS_PATH, [])
}

export function writeModels(models) {
  return writeJson(MODELS_PATH, models)
}

export async function readPending() {
  const pending = await readJson(PENDING_PATH, { checkedAt: null, items: [] })
  return { ...pending, dismissed: pending.dismissed ?? [] }
}

// 신규 모델 "후보" 유형. 기존 모델의 지표 갱신(update)은 매일 값이 바뀔 수 있어서
// 무시해도 다음 점검에 다시 올라오는 게 맞으므로 여기 포함하지 않는다.
const CANDIDATE_TYPES = new Set(['new', 'aa-new', 'aa-new-minor', 'aa-new-opensource', 'aa-new-api', 'hf-new'])

export function isCandidate(item) {
  return CANDIDATE_TYPES.has(item.type)
}

// 사람이 무시하거나 비교표에서 지운 모델은 다음 점검 때 후보로 다시 올리지 않는다.
// 이게 없으면 매일 새벽 같은 후보가 되살아나 검토 큐가 계속 쌓인다.
export function dropDismissed(items, dismissed) {
  const blocked = new Set(dismissed)
  return items.filter((i) => !isCandidate(i) || !blocked.has(candidateKey(i.name)))
}

export function writePending(pending) {
  return writeJson(PENDING_PATH, pending)
}

// 사람 확인 없이 자동으로 반영된 내역. 자동 반영이 틀렸을 때 나중에라도 찾아서
// 되돌릴 수 있게 남긴다. 최신이 앞에 오고, 오래된 건 잘라낸다.
export function readAutoLog() {
  return readJson(AUTO_LOG_PATH, [])
}

export async function appendAutoLog(entries) {
  if (entries.length === 0) return
  const log = await readAutoLog()
  await writeJson(AUTO_LOG_PATH, [...entries, ...log].slice(0, AUTO_LOG_LIMIT))
}

export function readHfSnapshot() {
  return readJson(HF_SNAPSHOT_PATH, { llmIds: [], embeddingIds: [] })
}

export function writeHfSnapshot(snapshot) {
  return writeJson(HF_SNAPSHOT_PATH, snapshot)
}
