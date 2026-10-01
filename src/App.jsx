import { useState } from 'react'
import TabNav from './components/TabNav'
import Trends from './pages/Trends'
import Finder from './pages/Finder'
import News from './pages/News'
import TermsGlossary from './pages/TermsGlossary'
import Admin from './pages/Admin'
import { useHfModels } from './hooks/useHfModels'

// 모델 데이터가 필요한 탭은 데이터가 올 때까지 같은 안내를 보여준다. 서버를 처음
// 켜면 수집 결과가 아직 없어서(수집에 수 분) 빈 화면 대신 이유를 알려준다.
function NeedsData({ data, error, children }) {
  if (error) return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-rose-600">{error}</p>
  if (!data) return <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-slate-400">불러오는 중…</p>
  if (data.families.length === 0) {
    return (
      <p className="mx-auto max-w-6xl px-6 py-16 text-sm text-slate-500">
        아직 수집된 모델이 없습니다. 서버가 처음 켜지면 HuggingFace 수집을 자동으로 시작하며 10분 남짓
        걸립니다. 진행 상황은 <b>관리</b> 탭에서 볼 수 있습니다.
      </p>
    )
  }
  return children
}

export default function App() {
  const [tab, setTab] = useState('trends')
  const { data, error, reload } = useHfModels()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">로컬 AI 모델 포털</h1>
          <p className="text-xs text-slate-400">
            HuggingFace에서 지금 인기 있는 모델을, 무엇을 잘하고 내 PC에서 돌아가는지로 정리합니다
          </p>
        </div>
      </header>
      <TabNav active={tab} onChange={setTab} />
      <main>
        {tab === 'trends' && (
          <NeedsData data={data} error={error}>
            <Trends data={data} />
          </NeedsData>
        )}
        {tab === 'finder' && (
          <NeedsData data={data} error={error}>
            <Finder data={data} />
          </NeedsData>
        )}
        {tab === 'news' && <News />}
        {tab === 'terms' && <TermsGlossary />}
        {tab === 'admin' && <Admin data={data} onCollected={reload} />}
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        데이터 출처: HuggingFace 공개 API. 필요 VRAM은 4bit 양자화 기준 추정치이며, 라이선스는 실제 도입
        전 원문을 꼭 확인하세요.
      </footer>
    </div>
  )
}
