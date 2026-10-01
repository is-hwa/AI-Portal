// 사내 도입 판단에서 제일 먼저 막히는 게 라이선스라, 원문 표기를 그대로 두되
// "상업적으로 써도 되는가"를 한눈에 보이게 분류한다. 실제 도입 전에는 원문을
// 확인해야 하므로 단정적인 표현 대신 분류만 제공한다.
const FREE = /^(apache-2\.0|mit|bsd(-[\d.]+-clause)?|cc0-1\.0|cc-by-4\.0|cc-by-sa-4\.0|openrail)$/i

// 비상업 조건이 명시된 계열
const NON_COMMERCIAL = /(^|[-_])(nc|non-commercial|noncommercial|research)([-_]|$)/i

// 이름을 알 수 없는 경우. 제공사 자체 라이선스(llama4, glm-5.3, qwen-community-1.0
// 등)는 이름이 있으므로 "조건부"로 본다 — 쓸 수는 있지만 약관을 읽어야 한다는 뜻.
const UNKNOWN = /^(other|unknown|unlicense[d]?)$/i

export function classifyLicense(license) {
  if (!license || UNKNOWN.test(license)) return { label: '확인 필요', tone: 'unknown' }
  if (NON_COMMERCIAL.test(license)) return { label: '상업 사용 불가', tone: 'blocked' }
  if (FREE.test(license)) return { label: '상업 사용 자유', tone: 'free' }
  return { label: '조건부 허용', tone: 'conditional' }
}

export const LICENSE_TONE_CLASS = {
  free: 'bg-emerald-100 text-emerald-700',
  conditional: 'bg-amber-100 text-amber-700',
  blocked: 'bg-rose-100 text-rose-700',
  unknown: 'bg-slate-100 text-slate-500',
}
