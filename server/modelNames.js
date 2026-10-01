// AA와 HuggingFace가 같은 모델을 표기만 다르게 쓰기 때문에 이름을 맞춰보는 일이
// 곳곳에서 생긴다. 규칙이 흩어지면 한쪽만 고쳐져 매칭이 어긋나므로 여기 모아둔다.

// 비교용으로 영숫자만 남긴다. "Llama-3.3-70B" 와 "Llama 3.3 70b"를 같게 본다.
export function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// AA는 같은 모델의 추론 강도 변형을 이름 끝 괄호로 구분한다
// (예: "DeepSeek V4 Flash (Reasoning, Max Effort)"). 변형끼리 묶으려면 이걸 뗀다.
export function stripVariantSuffix(name) {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

// "무시"나 "삭제"를 기억할 때 쓰는 키. 추론 강도 표기만 다른 변형("(max)"/"(high)")은
// 같은 모델이라 하나를 무시하면 나머지도 다시 안 올라오게 한다.
export function candidateKey(name) {
  return normalize(stripVariantSuffix(name))
}
