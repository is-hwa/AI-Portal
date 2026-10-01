// 사내 GPU에 올라간 LLM(예: gemma3:27b, gpt-oss-120b)에 붙는 범용 클라이언트.
// VMware Private AI Foundation 등 대부분의 자체 호스팅 서빙 스택은 OpenAI 호환
// /v1/chat/completions 형식을 쓰므로 그 규격으로 맞춤. VPN 연결 시 별도 키 없이
// 열려있다고 들었으므로 PRIVATE_AI_API_KEY는 선택 사항으로 둔다.

function getConfig() {
  const baseUrl = process.env.PRIVATE_AI_BASE_URL
  const model = process.env.PRIVATE_AI_MODEL
  if (!baseUrl) {
    throw new Error(
      'PRIVATE_AI_BASE_URL이 설정되지 않았습니다. 사내 Private AI 엔드포인트 주소를 .env에 넣어주세요 (.env.example 참고). VPN 연결도 확인해주세요.',
    )
  }
  if (!model) {
    throw new Error('PRIVATE_AI_MODEL이 설정되지 않았습니다 (예: gemma3:27b, gpt-oss-120b).')
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ''), model, apiKey: process.env.PRIVATE_AI_API_KEY }
}

export async function chatJson(prompt, { temperature = 0 } = {}) {
  const { baseUrl, model, apiKey } = getConfig()

  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Private AI 호출 실패 (${res.status}): ${body.slice(0, 300)}`)
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content ?? ''
  return extractJson(text)
}

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error(`모델 응답에서 JSON을 찾지 못했습니다: ${text.slice(0, 200)}`)
  }
  return JSON.parse(raw.slice(start, end + 1))
}
