import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { errText, log } from './log'

const ENTRY = '.agentic-scheduler/'

// Make sure the scheduler's plan + reports never get git-staged in the target repo.
export function ensureAgenticIgnored(repoPath: string): void {
  if (!repoPath || !existsSync(repoPath)) return
  const gitignore = join(repoPath, '.gitignore')

  let content = ''
  try {
    content = readFileSync(gitignore, 'utf-8')
  } catch {
    content = ''
  }

  const present = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .some((l) => l === ENTRY || l === '.agentic-scheduler')
  if (present) return

  const prefix = content && !content.endsWith('\n') ? '\n' : ''
  try {
    writeFileSync(gitignore, `${content}${prefix}${ENTRY}\n`)
    log.info('repo', `added ${ENTRY} to .gitignore`, gitignore)
  } catch (err) {
    log.warn('repo', `could not update ${gitignore}`, errText(err))
  }
}
