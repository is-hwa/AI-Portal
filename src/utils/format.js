const compact = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })

export function formatCount(n) {
  if (n == null) return '—'
  return compact.format(n)
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function daysAgo(iso) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / 86400000
}

export function relativeTime(iso) {
  if (!iso) return '기록 없음'
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.round(hours / 24)}일 전`
}

// 서버 특화 규칙(specialization.js)의 라벨을 로컬 선택 맥락에 맞게 바꾼다.
// "저비용"은 API 가격 기준이던 시절 표현이라 여기선 "경량"으로만 보여준다.
export function specLabel(s) {
  return s === '저비용·경량' ? '경량' : s
}

export const RELATION_LABEL = {
  quantized: '양자화',
  finetune: '파인튜닝',
  adapter: '어댑터',
  merge: '병합',
}
