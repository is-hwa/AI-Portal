import { getModel, countDerivatives, DERIVATIVE_CAP } from './client.js'
import { KNOWN_ORGS, KOREAN_ORGS, orgOf } from './orgs.js'
import { inferSpecialization } from '../specialization.js'
import { parseParamCount } from '../paramParser.js'

// safetensors.total은 리포 안 모든 텐서의 원소 수 합이다. BF16 원본과 FP8 사본을
// 한 리포에 같이 올린 경우엔 두 배로 부풀어서, 주된 dtype이 전체의 90% 이상일 때만
// 믿는다. FP8 체크포인트의 F32 스케일 텐서처럼 작은 보조 텐서는 이 기준을 통과한다.
function paramsFromSafetensors(safetensors) {
  const total = safetensors?.total
  const byDtype = Object.values(safetensors?.parameters ?? {})
  if (!total || byDtype.length === 0) return null
  if (Math.max(...byDtype) / total < 0.9) return null
  return Math.round((total / 1e9) * 100) / 100
}

// 원본이 어떤 정밀도로 공개됐는지. "권장 사양"(원본 그대로 실행)을 계산할 때 쓴다.
// 대부분 BF16(16bit)이지만 DeepSeek처럼 FP8로 공개하는 곳도 있다. F32로 올라온 오래된
// 모델도 실제로는 16bit로 돌리는 게 보통이라 16으로 본다. 섞여 있으면 판단하지 않는다.
const DTYPE_BITS = { BF16: 16, F16: 16, F32: 16, F8_E4M3: 8, F8_E5M2: 8 }

// 이름 끝에 양자화 표기가 붙은 리포(Qwen3-Coder-30B-A3B-Instruct-FP8 등)는 계보
// 정보가 없어도 따로 16bit 원본이 있다는 뜻이라 원본 정밀도를 16bit로 본다. 처음부터
// FP8로 공개한 모델(DeepSeek·MiniMax 등)은 이름에 표기가 없어 영향받지 않는다.
const QUANT_NAME_SUFFIX = /[-_](fp8|int8|int4|awq|gptq|w8a8|w4a16)$/i

function nativeBits(name, safetensors) {
  if (QUANT_NAME_SUFFIX.test(name)) return 16
  return nativeBitsFromSafetensors(safetensors)
}

function nativeBitsFromSafetensors(safetensors) {
  const entries = Object.entries(safetensors?.parameters ?? {})
  const total = safetensors?.total
  if (!total || entries.length === 0) return null
  const [dtype, count] = entries.sort((a, b) => b[1] - a[1])[0]
  if (count / total < 0.9) return null
  return DTYPE_BITS[dtype] ?? null
}

function repoName(id) {
  return id.split('/').slice(1).join('/')
}

// MoE는 이름에 활성 파라미터를 "35B-A3B"처럼 붙인다. 메모리는 총 파라미터만큼
// 필요하지만 속도는 활성 파라미터에 가깝다는 걸 카드에서 설명하려고 따로 뽑는다.
function activeParamsFromName(name) {
  const m = name.match(/[-_ ]A(\d+(?:\.\d+)?)B(?![a-zA-Z])/i)
  return m ? parseFloat(m[1]) : null
}

function licenseOf(detail) {
  const tag = (detail.tags ?? []).find((t) => t.startsWith('license:'))
  const license = detail.cardData?.license ?? (tag ? tag.slice('license:'.length) : null)
  if (license === 'other') return detail.cardData?.license_name ?? 'other'
  return Array.isArray(license) ? license[0] : license
}

// 상세 응답에서 쓰는 필드만 남겨 캐시한다. 좋아요·다운로드는 매일 바뀌니 목록에서
// 새로 받은 값으로 덮어쓰고, 나머지(파라미터·라이선스·태그)는 리포가 수정됐을 때만
// 다시 부른다. 익명 한도(5분 500건) 때문에 두 번째 실행부터 호출 수를 크게 줄여준다.
function trimDetail(d) {
  return {
    id: d.id,
    tags: d.tags,
    pipeline_tag: d.pipeline_tag,
    library_name: d.library_name,
    likes: d.likes,
    downloads: d.downloads,
    createdAt: d.createdAt,
    lastModified: d.lastModified,
    gated: d.gated,
    safetensors: d.safetensors,
    cardData: { license: d.cardData?.license, license_name: d.cardData?.license_name },
  }
}

async function loadDetail(group, cache) {
  const listed = group.official.find((m) => m.id === group.repId)
  const cached = cache[group.repId]?.detail
  if (listed && cached && cached.lastModified === listed.lastModified) {
    return { ...cached, likes: listed.likes, downloads: listed.downloads }
  }
  const fresh = await getModel(group.repId)
  if (!fresh) return null
  const detail = trimDetail(fresh)
  cache[group.repId] = { ...cache[group.repId], detail }
  return detail
}

export async function enrichGroup(group, cache) {
  const detail = await loadDetail(group, cache)
  if (!detail) return null

  const name = repoName(detail.id)
  const tags = detail.tags ?? []
  const paramsB = paramsFromSafetensors(detail.safetensors) ?? parseParamCount(name)
  const org = orgOf(detail.id)

  const specialization = inferSpecialization(
    { name, params_b: paramsB },
    { tags, pipelineTag: detail.pipeline_tag },
  )
  if (KOREAN_ORGS.has(org) && !specialization.includes('한국어 지원')) {
    specialization.push('한국어 지원')
  }

  return {
    id: detail.id,
    name,
    org,
    provider: KNOWN_ORGS[org] ?? org,
    knownOrg: org in KNOWN_ORGS,
    korean: KOREAN_ORGS.has(org),
    pipelineTag: detail.pipeline_tag ?? null,
    library: detail.library_name ?? null,
    likes: detail.likes ?? 0,
    downloads: detail.downloads ?? 0,
    buzz: group.buzz,
    createdAt: detail.createdAt ?? null,
    lastModified: detail.lastModified ?? null,
    gated: Boolean(detail.gated),
    paramsB,
    nativeBits: nativeBits(name, detail.safetensors),
    activeParamsB: activeParamsFromName(name),
    license: licenseOf(detail),
    specialization: specialization.filter((s) => s !== '범용' || specialization.length === 1),
    url: `https://huggingface.co/${detail.id}`,
    topDerivatives: group.derivatives.slice(0, 3).map((d) => ({
      id: d.id,
      relation: d.relation,
      likes: d.likes ?? 0,
      downloads: d.downloads ?? 0,
      url: `https://huggingface.co/${d.id}`,
    })),
    derivatives: null,
  }
}

// 파생 리포 수는 원본마다 두 번씩 불러야 해서, 노출 우선순위가 높은 모델만 센다.
// 하루 이틀 사이엔 크게 안 바뀌므로 3일 동안은 캐시 값을 쓴다.
const DERIVATIVE_TTL_MS = 3 * 24 * 60 * 60 * 1000

export async function addDerivativeCounts(model, cache) {
  const cached = cache[model.id]?.derivatives
  let counts = cached && Date.now() - cached.countedAt < DERIVATIVE_TTL_MS ? cached : null
  if (!counts) {
    const [quantized, finetune] = await Promise.all([
      countDerivatives(model.id, 'quantized').catch(() => null),
      countDerivatives(model.id, 'finetune').catch(() => null),
    ])
    counts = { quantized, finetune, countedAt: Date.now() }
    if (quantized != null && finetune != null) {
      cache[model.id] = { ...cache[model.id], derivatives: counts }
    }
  }
  const { quantized, finetune } = counts
  model.derivatives = {
    quantized,
    finetune,
    capped: quantized === DERIVATIVE_CAP || finetune === DERIVATIVE_CAP,
    quantizedUrl: `https://huggingface.co/models?other=base_model:quantized:${model.id}`,
    finetuneUrl: `https://huggingface.co/models?other=base_model:finetune:${model.id}`,
  }
}
