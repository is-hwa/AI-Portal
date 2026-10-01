import { useState } from 'react'
import TabNav from './components/TabNav'
import ModelComparison from './pages/ModelComparison'
import OpenSourceModels from './pages/OpenSourceModels'
import TermsGlossary from './pages/TermsGlossary'
import Admin from './pages/Admin'

export default function App() {
  const [tab, setTab] = useState('api')

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-bold text-slate-900">AI 모델 비교</h1>
          <p className="text-xs text-slate-400">
            AI 성능 지표를 자동으로 수집·비교하고, 용어를 찾아보는 포털
          </p>
        </div>
      </header>
      <TabNav active={tab} onChange={setTab} />
      <main>
        {tab === 'api' && (
          <ModelComparison
            deployment="api"
            title="API 모델 비교"
            description="클라우드 API로 호출해서 쓰는 모델입니다. 토큰당 과금, 설치·GPU 없이 바로 최신 성능을 쓸 수 있다는 게 핵심입니다."
          />
        )}
        {tab === 'open_source' && <OpenSourceModels />}
        {tab === 'terms' && <TermsGlossary />}
        {tab === 'admin' && <Admin />}
      </main>
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
        벤치마크 수치는 각 제공사의 공식 발표 자료를 기준으로 하며, 실제 성능은 사용 환경에 따라
        다를 수 있습니다.
      </footer>
    </div>
  )
}
