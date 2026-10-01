import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'

// 사내망은 외부(huggingface.co·블로그 RSS)로 나갈 때 프록시를 거쳐야 하는 경우가 많다.
// Node 내장 fetch는 HTTPS_PROXY 환경 변수를 스스로 읽지 않아서, 설정돼 있으면 전역
// 디스패처를 프록시용으로 바꾼다. NO_PROXY(사내 주소 예외)도 함께 따른다.
const proxy =
  process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy

if (proxy) {
  setGlobalDispatcher(new EnvHttpProxyAgent())
  console.log(`[proxy] 외부 요청을 프록시로 보냅니다: ${proxy.replace(/\/\/[^@]*@/, '//***@')}`)
}
