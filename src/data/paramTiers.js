// 로컬 실행 가능 여부를 가늠하는 실용적 기준 — 파라미터 수(가중치 개수)로 급을 나눈다.
export const PARAM_TIERS = [
  { id: 'small', label: '소형 (~13B)', hint: '노트북·일반 GPU에서도 실행 가능', max: 13 },
  { id: 'medium', label: '중형 (13B~70B)', hint: '고사양 GPU 1~2장 필요', max: 70 },
  { id: 'large', label: '대형 (70B~300B)', hint: '서버급 멀티 GPU 필요', max: 300 },
  { id: 'xlarge', label: '초대형 (300B+)', hint: '데이터센터급 인프라 필요', max: Infinity },
]

export function getParamTier(paramsB) {
  if (paramsB == null) return null
  return PARAM_TIERS.find((t) => paramsB <= t.max)?.id ?? null
}

export function formatParams(paramsB) {
  if (paramsB == null) return '—'
  return paramsB >= 1000 ? `${(paramsB / 1000).toFixed(1)}T` : `${paramsB}B`
}

// 4bit 양자화(파라미터당 0.5바이트) 기준 가중치 용량에 KV 캐시·활성값 몫으로 20%를
// 더한 값. 실제로 로컬에 올릴 때 대부분 4bit부터 검토하기 때문에 이 기준으로 잡는다.
// 컨텍스트 길이·배치에 따라 더 필요할 수 있어 하한 추정치로 봐야 한다.
function estimateVramGb(paramsB) {
  if (paramsB == null) return null
  return paramsB * 0.5 * 1.2
}

export function formatVram(paramsB) {
  const gb = estimateVramGb(paramsB)
  if (gb == null) return '—'
  return gb >= 10 ? `${Math.round(gb)}GB` : `${gb.toFixed(1)}GB`
}
