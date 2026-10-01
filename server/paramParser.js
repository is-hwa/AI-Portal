// AA 무료 API엔 파라미터 수 필드가 없다(Pro 전용). 대신 오픈소스 모델은 보통
// 이름에 "12B", "122B A10B"(MoE, 총 122B·활성 10B) 식으로 박혀있어서 거기서 뽑는다.
// 첫 번째로 매칭되는 숫자+단위를 "총 파라미터"로 본다(MoE의 활성치 "A10B"는 보통
// 뒤에 나와서 자연히 무시됨). 이름에 없으면 null — 추측해서 채우지 않는다.
export function parseParamCount(name) {
  const match = name.match(/(\d+(?:\.\d+)?)\s*([TB])(?![a-zA-Z])/)
  if (!match) return null
  const num = parseFloat(match[1])
  const unit = match[2].toUpperCase()
  return unit === 'T' ? num * 1000 : num
}
