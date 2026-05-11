import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { Rule, Action } from '@shared/types'

const RULES_FILE = 'rules.json'

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

function migrateRule(raw: Record<string, unknown>): Rule {
  // Phase 1 → Phase 2: { action: { type, targetPath } } → { workflow: [action] }
  if (!raw.workflow && raw.action && typeof raw.action === 'object') {
    const legacy = raw.action as Record<string, unknown>
    const action: Action = { type: 'move', targetPath: String(legacy.targetPath ?? '') }
    raw.workflow = [action]
    delete raw.action
  }
  if (!Array.isArray(raw.workflow)) raw.workflow = []
  if (!raw.trigger || typeof raw.trigger !== 'object') raw.trigger = { type: 'file_added' }
  return raw as unknown as Rule
}

export class ConfigManager {
  private filePath: string

  constructor() {
    this.filePath = join(app.getPath('userData'), RULES_FILE)
  }

  async loadRules(): Promise<Rule[]> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.map((r) => migrateRule(r as Record<string, unknown>))
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') return []
      console.error('[AutoFlow] Failed to load rules:', err)
      return []
    }
  }

  async saveRules(rules: Rule[]): Promise<void> {
    await fs.mkdir(join(app.getPath('userData')), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(rules, null, 2), 'utf-8')
  }
}
