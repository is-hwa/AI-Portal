import { runHfCollect, readHfModels } from './hf/pipeline.js'

// 수집은 첫 실행 기준 수 분이 걸린다(HF 익명 한도 때문에 중간에 기다림). 버튼과
// 야간 크론이 겹쳐 두 번 돌면 한도만 두 배로 쓰므로 한 번에 하나만 돌게 한다.
const state = { running: false, startedAt: null, log: [], lastError: null }

export function collectStatus() {
  return { ...state, log: state.log.slice(-20) }
}

export function startCollect(label) {
  if (state.running) return false
  state.running = true
  state.startedAt = new Date().toISOString()
  state.log = []
  state.lastError = null

  const onProgress = (msg) => {
    state.log.push({ at: new Date().toISOString(), msg })
    console.log(`[collect] ${msg}`)
  }
  onProgress(`${label} 시작`)
  runHfCollect({ onProgress })
    .catch((err) => {
      state.lastError = err.message
      console.error('[collect] 실패:', err)
    })
    .finally(() => {
      state.running = false
    })
  return true
}

export async function lastCollectedAt() {
  return (await readHfModels()).updatedAt
}
