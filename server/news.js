import * as cheerio from 'cheerio'
import { googleSearch, isConfigured as googleConfigured } from './googleSearch.js'

// API 모델은 표로 비교하는 대신 소식만 본다. 제공사 공식 블로그 RSS가 기본이고
// (키 불필요), Google Custom Search 키가 있으면 국내 기사도 섞는다.
// Google 뉴스 RSS는 약관상 개인·비상업 용도로만 허용돼 사내 포털에는 쓰지 않는다.
const FEEDS = [
  { source: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { source: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { source: 'Google', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/' },
]

const SEARCH_QUERIES = ['오픈소스 LLM 공개', 'AI 모델 출시']

const CACHE_MS = 60 * 60 * 1000
let cache = null

async function readFeed({ source, url }) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${source} RSS 오류 (${res.status})`)
  const $ = cheerio.load(await res.text(), { xmlMode: true })
  return $('item')
    .slice(0, 10)
    .map((_, el) => {
      const item = $(el)
      const date = new Date(item.find('pubDate').first().text())
      return {
        title: item.find('title').first().text().trim(),
        url: item.find('link').first().text().trim(),
        source,
        kind: 'official',
        publishedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
      }
    })
    .get()
    .filter((n) => n.title && n.url)
}

async function readSearch() {
  if (!googleConfigured()) return []
  const results = await Promise.all(
    SEARCH_QUERIES.map((q) => googleSearch(q, { num: 5 }).catch(() => [])),
  )
  return results.flat().map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
    source: new URL(r.url).hostname.replace(/^www\./, ''),
    kind: 'press',
    publishedAt: null,
  }))
}

export async function getNews({ refresh = false } = {}) {
  if (!refresh && cache && Date.now() - cache.fetchedAt < CACHE_MS) return cache

  const settled = await Promise.allSettled([...FEEDS.map(readFeed), readSearch()])
  const items = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))
  const errors = settled.filter((s) => s.status === 'rejected').map((s) => s.reason.message)

  const seen = new Set()
  const unique = items.filter((n) => !seen.has(n.url) && seen.add(n.url))
  unique.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))

  cache = { fetchedAt: Date.now(), items: unique, errors, searchEnabled: googleConfigured() }
  return cache
}
