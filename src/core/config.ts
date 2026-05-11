import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { Rule } from '@shared/types'

const RULES_FILE = 'rules.json'

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
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
      return Array.isArray(parsed) ? parsed : []
    } catch (err: unknown) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return []
      }
      console.error('[AutoFlow] Failed to load rules:', err)
      return []
    }
  }

  async saveRules(rules: Rule[]): Promise<void> {
    await fs.mkdir(join(app.getPath('userData')), { recursive: true })
    await fs.writeFile(this.filePath, JSON.stringify(rules, null, 2), 'utf-8')
  }
}
