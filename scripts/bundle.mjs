// cf push에 필요한 파일만 담은 압축 파일(deploy/ai-portal.tgz)을 만든다.
// Ops Manager VM처럼 cf는 있지만 Node가 없는 곳에서 배포할 때, 여기서 빌드까지 끝낸
// 결과를 복사해 가서 압축을 풀고 `cf push`만 하면 되게 하려는 용도다.
// 담는 기준은 cf push와 같게 .cfignore를 따른다.
import { readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

const ROOT = process.cwd()
const OUT_DIR = path.join(ROOT, 'deploy')
const STAGE = path.join(OUT_DIR, 'ai-portal')
const ARCHIVE = path.join(OUT_DIR, 'ai-portal.tgz')

// .cfignore는 "이름/"(폴더), "이름", "*.확장자" 형태만 쓰고 있어서 그만큼만 해석한다.
const rules = readFileSync(path.join(ROOT, '.cfignore'), 'utf-8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))

function ignored(rel) {
  const posix = rel.split(path.sep).join('/')
  return rules.some((rule) => {
    if (rule.startsWith('*.')) return posix.endsWith(rule.slice(1))
    const r = rule.replace(/\/$/, '')
    return posix === r || posix.startsWith(`${r}/`)
  })
}

function copyTree(dir) {
  let count = 0
  for (const name of readdirSync(dir)) {
    const abs = path.join(dir, name)
    const rel = path.relative(ROOT, abs)
    if (ignored(rel)) continue
    if (statSync(abs).isDirectory()) {
      count += copyTree(abs)
    } else {
      mkdirSync(path.dirname(path.join(STAGE, rel)), { recursive: true })
      copyFileSync(abs, path.join(STAGE, rel))
      count++
    }
  }
  return count
}

rmSync(OUT_DIR, { recursive: true, force: true })
mkdirSync(STAGE, { recursive: true })
const files = copyTree(ROOT)

for (const required of ['dist/index.html', 'server/index.js', 'package.json', 'manifest.yml']) {
  try {
    statSync(path.join(STAGE, required))
  } catch {
    console.error(`[bundle] ${required}가 없습니다. npm run build를 먼저 했는지 확인하세요.`)
    process.exit(1)
  }
}

// Windows 10 이상과 리눅스·맥 모두 tar가 기본으로 있다. 경로는 상대 경로로 넘긴다 —
// Git Bash의 GNU tar는 "C:\..."의 "C:"를 원격 호스트 이름으로 해석해서 실패한다.
execFileSync('tar', ['-czf', path.basename(ARCHIVE), 'ai-portal'], { cwd: OUT_DIR, stdio: 'inherit' })
const kb = Math.round(statSync(ARCHIVE).size / 1024)
console.log(`[bundle] 파일 ${files}개 → deploy/ai-portal.tgz (${kb}KB)`)
