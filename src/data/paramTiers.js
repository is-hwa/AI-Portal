// "돌리려면 어떤 장비가 필요한가"를 파라미터 수가 아니라 GPU 메모리(VRAM)로 답한다.
// 사람들은 "27B"보다 "24GB 그래픽카드면 된다"를 훨씬 쉽게 이해한다.
//
// - 최소 사양: 4bit 양자화(GGUF Q4 등). 로컬에선 대부분 여기서부터 시도한다.
// - 권장 사양: 원본 정밀도 그대로(대부분 16bit, 일부 8bit). 품질 손실 없이 서버에
//   올릴 때 기준이다.
// 둘 다 가중치 용량에 KV 캐시·활성값 몫으로 20%를 더한 값이고, 긴 문서를 넣거나
// 여러 명이 동시에 쓰면 더 필요하다.
export const MIN_BITS = 4
const DEFAULT_NATIVE_BITS = 16

export function nativeBits(model) {
  return model.nativeBits ?? DEFAULT_NATIVE_BITS
}

export function estimateVramGb(paramsB, bits = MIN_BITS) {
  if (paramsB == null) return null
  return paramsB * (bits / 8) * 1.2
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

export function vramTier(paramsB, bits = MIN_BITS) {
  const gb = estimateVramGb(paramsB, bits)
  if (gb == null) return null
  return VRAM_TIERS.find((t) => gb <= t.maxGb)
}

export function formatParams(paramsB) {
  if (paramsB == null) return '크기 미확인'
  if (paramsB >= 1000) return `${(paramsB / 1000).toFixed(1)}T`
  if (paramsB < 1) return `${Math.round(paramsB * 1000)}M`
  return `${paramsB >= 10 ? Math.round(paramsB) : paramsB.toFixed(1)}B`
}

export function formatVram(paramsB, bits = MIN_BITS) {
  const gb = estimateVramGb(paramsB, bits)
  if (gb == null) return '—'
  if (gb < 1) return '1GB 미만'
  return gb >= 10 ? `${Math.round(gb)}GB` : `${gb.toFixed(1)}GB`
}

export const TIER_TONE_CLASS = {
  easy: 'bg-emerald-100 text-emerald-700',
  mid: 'bg-amber-100 text-amber-700',
  hard: 'bg-rose-100 text-rose-700',
}
