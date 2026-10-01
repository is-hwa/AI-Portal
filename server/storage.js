import { readFile, writeFile, mkdir, readdir, unlink } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

// 수집 결과·캐시·일별 기록을 저장하는 곳. 로컬에선 server/data/ 아래 JSON 파일을
// 쓰지만, Cloud Foundry 컨테이너 디스크는 재시작·재배포 때마다 지워져서 추이 기록이
// 날아간다. 그래서 Postgres가 연결돼 있으면(서비스 바인딩 또는 DATABASE_URL) 같은
// 키-값 형태로 DB에 저장한다. 호출하는 쪽은 어느 쪽인지 몰라도 된다.
//
// 키 예: 'hf-models', 'hf-lineage', 'hf-history/2026-10-01'

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data')

// CF에 바인딩된 서비스 중 Postgres 접속 정보를 찾는다. 서비스 브로커마다 자격 증명
// 모양이 달라서 uri 계열 필드를 먼저 보고, 없으면 host/port/user 조각으로 조립한다.
function postgresUrlFromVcap() {
  let services
  try {
    services = JSON.parse(process.env.VCAP_SERVICES ?? '{}')
  } catch {
    return null
  }
  for (const instance of Object.values(services).flat()) {
    const c = instance.credentials ?? {}
    const uri = c.uri ?? c.url ?? c.db_uri
    if (typeof uri === 'string' && /^postgres(ql)?:\/\//.test(uri)) return uri
    const isPostgres = (instance.tags ?? []).some((t) => /postgres/i.test(t)) || /postgres/i.test(instance.label ?? '')
    const host = c.host ?? c.hostname ?? c.db_host
    if (isPostgres && host) {
      const user = encodeURIComponent(c.username ?? c.user ?? c.db_user)
      const pass = encodeURIComponent(c.password ?? c.db_password ?? '')
      return `postgres://${user}:${pass}@${host}:${c.port ?? c.db_port ?? 5432}/${c.name ?? c.database ?? c.db_name}`
    }
  }
  return null
}

function fileBackend() {
  const fileOf = (key) => path.join(DATA_DIR, `${key}.json`)
  return {
    name: 'file',
    async get(key, fallback) {
      try {
        return JSON.parse(await readFile(fileOf(key), 'utf-8'))
      } catch (err) {
        if (err.code === 'ENOENT') return fallback
        throw err
      }
    },
    async put(key, value) {
      await mkdir(path.dirname(fileOf(key)), { recursive: true })
      await writeFile(fileOf(key), JSON.stringify(value) + '\n', 'utf-8')
    },
    async list(prefix) {
      const dir = path.join(DATA_DIR, path.dirname(`${prefix}x`))
      try {
        const files = await readdir(dir)
        const base = path.basename(`${prefix}x`).slice(0, -1)
        return files
          .filter((f) => f.endsWith('.json') && f.startsWith(base))
          .map((f) => `${prefix}${f.slice(base.length, -'.json'.length)}`)
          .sort()
      } catch (err) {
        if (err.code === 'ENOENT') return []
        throw err
      }
    },
    async remove(key) {
      await unlink(fileOf(key)).catch(() => {})
    },
  }
}

async function postgresBackend(connectionString) {
  const { default: pg } = await import('pg')
  // 사내 Postgres는 TLS를 요구하는 경우가 많다. 사설 인증서라 검증은 끈다.
  const ssl = process.env.PGSSL === 'false' ? false : /sslmode=disable/.test(connectionString) ? false : { rejectUnauthorized: false }
  const pool = new pg.Pool({ connectionString, ssl, max: 4 })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_docs (
      key text PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`)
  return {
    name: 'postgres',
    async get(key, fallback) {
      const { rows } = await pool.query('SELECT value FROM app_docs WHERE key = $1', [key])
      return rows[0]?.value ?? fallback
    },
    async put(key, value) {
      await pool.query(
        `INSERT INTO app_docs (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)],
      )
    },
    async list(prefix) {
      const { rows } = await pool.query(
        "SELECT key FROM app_docs WHERE key LIKE $1 || '%' ORDER BY key",
        [prefix],
      )
      return rows.map((r) => r.key)
    },
    async remove(key) {
      await pool.query('DELETE FROM app_docs WHERE key = $1', [key])
    },
  }
}

let backendPromise = null

function backend() {
  if (!backendPromise) {
    const url = process.env.DATABASE_URL || postgresUrlFromVcap()
    backendPromise = url ? postgresBackend(url) : Promise.resolve(fileBackend())
  }
  return backendPromise
}

export async function storageName() {
  return (await backend()).name
}

export async function getDoc(key, fallback) {
  return (await backend()).get(key, fallback)
}

export async function putDoc(key, value) {
  return (await backend()).put(key, value)
}

export async function listDocs(prefix) {
  return (await backend()).list(prefix)
}

export async function removeDoc(key) {
  return (await backend()).remove(key)
}
