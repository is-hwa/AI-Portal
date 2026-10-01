// "내 PC에서 돌아가나"를 파라미터 수가 아니라 GPU 메모리(VRAM)로 답한다. 사람들은
// "27B"보다 "24GB 그래픽카드면 된다"를 훨씬 쉽게 이해한다.

// 4bit 양자화(파라미터당 0.5바이트) 기준 가중치 용량에 KV 캐시·활성값 몫으로 20%를
// 더한 값. 로컬에선 대부분 4bit(GGUF Q4)부터 시도하기 때문에 이 기준으로 잡는다.
// 컨텍스트 길이·배치에 따라 더 필요할 수 있어 하한 추정치로 봐야 한다.
export function estimateVramGb(paramsB) {
  if (paramsB == null) return null
  return paramsB * 0.5 * 1.2
}

export const VRAM_TIERS = [
  { maxGb: 8, label: '8GB 그래픽카드', hint: 'RTX 4060·노트북 GPU', tone: 'easy' },
  { maxGb: 16, label: '16GB 그래픽카드', hint: 'RTX 4060 Ti 16GB·5070 Ti', tone: 'easy' },
  { maxGb: 24, label: '24GB 그래픽카드', hint: 'RTX 4090·3090', tone: 'mid' },
  { maxGb: 48, label: '48GB급', hint: '24GB 2장·RTX 6000 Ada·Mac 64GB', tone: 'mid' },
  { maxGb: 96, label: '80~96GB급', hint: 'H100 1장·Mac 128GB', tone: 'hard' },
  { maxGb: 200, label: '128~192GB급', hint: 'H100 2장·Mac Studio 192GB', tone: 'hard' },
  { maxGb: Infinity, label: '서버 여러 대', hint: '데이터센터 GPU 여러 장', tone: 'hard' },
]

export function vramTier(paramsB) {
  const gb = estimateVramGb(paramsB)
  if (gb == null) return null
  return VRAM_TIERS.find((t) => gb <= t.maxGb)
}

export function formatParams(paramsB) {
  if (paramsB == null) return '크기 미확인'
  if (paramsB >= 1000) return `${(paramsB / 1000).toFixed(1)}T`
  if (paramsB < 1) return `${Math.round(paramsB * 1000)}M`
  return `${paramsB >= 10 ? Math.round(paramsB) : paramsB.toFixed(1)}B`
}

export function formatVram(paramsB) {
  const gb = estimateVramGb(paramsB)
  if (gb == null) return '—'
  if (gb < 1) return '1GB 미만'
  return gb >= 10 ? `${Math.round(gb)}GB` : `${gb.toFixed(1)}GB`
}

export const TIER_TONE_CLASS = {
  easy: 'bg-emerald-100 text-emerald-700',
  mid: 'bg-amber-100 text-amber-700',
  hard: 'bg-rose-100 text-rose-700',
}
