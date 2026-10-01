import { daysAgo } from './format'

// 화면의 정렬 기준. 지표 이름 대신 "무엇을 보고 싶은가"로 이름 붙인다.
export const SORTS = [
  {
    id: 'hot',
    label: '지금 뜨는',
    hint: '원본 + 파생 리포의 HF 트렌딩 점수 합 — 최근 좋아요가 몰리는 모델',
    score: (f) => f.buzz,
  },
  {
    id: 'used',
    label: '많이 쓰는',
    hint: '최근 30일 다운로드 — 실제로 가장 많이 받아 쓰는 모델',
    score: (f) => f.downloads,
  },
  {
    id: 'loved',
    label: '좋아요 많은',
    hint: 'HF 누적 좋아요 — 오래 검증된 모델',
    score: (f) => f.likes,
  },
  {
    id: 'new',
    label: '새로 나온',
    hint: '최근 60일 안에 공개된 모델 중 반응이 큰 순서',
    score: (f) => f.buzz + f.likes / 100,
    filter: (f) => daysAgo(f.createdAt) <= 60,
  },
]

export function rankFamilies(families, sortId) {
  const sort = SORTS.find((s) => s.id === sortId) ?? SORTS[0]
  return families
    .filter((f) => !sort.filter || sort.filter(f))
    .sort((a, b) => sort.score(b) - sort.score(a))
}
