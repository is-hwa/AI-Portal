import { useCallback, useEffect, useState } from 'react'

export function useHfModels() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  const reload = useCallback(() => {
    fetch('/api/hf/models')
      .then(async (res) => {
        if (!res.ok) throw new Error(`모델 목록을 불러오지 못했습니다 (${res.status})`)
        setData(await res.json())
        setError('')
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(reload, [reload])

  return { data, error, reload }
}
