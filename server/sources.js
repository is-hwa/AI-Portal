// 제공사별 공식 뉴스/블로그 페이지. 전부 원본 HTML을 그대로 가져와 텍스트를
// 추출하는 방식이라, 자바스크립트로 렌더링되는 사이트는 내용이 비어 있을 수 있다
// (실제 확인 결과: Google 블로그는 됨, Anthropic/OpenAI 뉴스 페이지는 SPA라 잘 안 잡힘).
// 안 잡히는 소스는 무시하고 넘어가도록 research.js에서 처리한다.
export const PROVIDER_SOURCES = {
  Anthropic: ['https://www.anthropic.com/news'],
  OpenAI: ['https://openai.com/news/'],
  Google: ['https://blog.google/technology/ai/'],
  Meta: ['https://ai.meta.com/blog/'],
  xAI: ['https://x.ai/news'],
  DeepSeek: ['https://www.deepseek.com/'],
}
