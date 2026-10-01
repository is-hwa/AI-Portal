import { useEffect, useState } from 'react'
import bundledModels from '../data/models.json'

// 백엔드가 매일 밤 갱신하는 models.json을 런타임에 가져온다. 정적 import만 쓰면
// 빌드 시점 스냅샷이 배포본에 굳어버려서 자동 갱신 결과가 사용자에게 영영 도달하지
// 않는다. 번들에 포함된 스냅샷을 초기값으로 두기 때문에 첫 렌더에 빈 화면이 뜨지
// 않고, 백엔드가 꺼져 있어도 그대로 보인다.
export function useModels() {
  const [models, setModels] = useState(bundledModels)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/models')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data) => {
        if (cancelled || !Array.isArray(data) || data.length === 0) return
        setModels(data)
        setLive(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return { models, live }
}
