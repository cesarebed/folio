// Ad-hoc signature so the unsigned build launches on Apple Silicon.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const release = 'release'
for (const dir of readdirSync(release).filter((d) => d.startsWith('mac'))) {
  const app = join(release, dir, 'Folio.app')
  if (!existsSync(app)) continue
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' })
  console.log(`signed (ad-hoc): ${app}`)
}
