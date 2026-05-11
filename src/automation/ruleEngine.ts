import { extname, basename } from 'path'
import { AutoFlowWatcher } from './watcher'
import { moveFile } from './actions'
import type { Rule } from '@shared/types'
import type { FileEvent } from './types'
import type { Logger } from '../core/logger'

export class RuleEngine {
  private watcher: AutoFlowWatcher
  private rules: Rule[]
  private logger: Logger

  constructor(rules: Rule[], logger: Logger) {
    this.rules = rules
    this.logger = logger
    this.watcher = new AutoFlowWatcher()
    this.watcher.on('file-event', this.handleFileEvent.bind(this))
    this.watcher.on('watcher-error', (err: Error) => {
      this.logger.error(`Watcher error: ${err.message}`)
    })
  }

  async start(watchPath: string): Promise<void> {
    this.logger.info(`Starting watcher on: ${watchPath}`)
    await this.watcher.start(watchPath)
    this.logger.info('Watcher ready — monitoring for new files')
  }

  async stop(): Promise<void> {
    await this.watcher.stop()
    this.logger.info('Watcher stopped')
  }

  reloadRules(rules: Rule[]): void {
    this.rules = rules
    this.logger.info(`Rules reloaded: ${rules.length} rule(s) active`)
  }

  private async handleFileEvent(event: FileEvent): Promise<void> {
    this.logger.info(`File detected: ${basename(event.filePath)}`, {
      filePath: event.filePath
    })

    const enabledRules = this.rules.filter((r) => r.enabled)

    for (const rule of enabledRules) {
      if (this.matchesRule(event, rule)) {
        await this.executeRule(event, rule)
      }
    }
  }

  private matchesRule(event: FileEvent, rule: Rule): boolean {
    if (rule.trigger.type !== 'file_added' || event.eventType !== 'add') {
      return false
    }

    const { extension, filenameContains } = rule.conditions

    if (extension) {
      const fileExt = extname(event.filePath).toLowerCase()
      if (fileExt !== extension.toLowerCase()) return false
    }

    if (filenameContains) {
      const name = basename(event.filePath).toLowerCase()
      if (!name.includes(filenameContains.toLowerCase())) return false
    }

    return true
  }

  private async executeRule(event: FileEvent, rule: Rule): Promise<void> {
    this.logger.info(`Rule "${rule.name}" matched: ${basename(event.filePath)}`, {
      ruleId: rule.id,
      filePath: event.filePath
    })

    try {
      if (rule.action.type === 'move') {
        const newPath = await moveFile({
          sourcePath: event.filePath,
          targetDirectory: rule.action.targetPath
        })
        this.logger.info(`Moved to: ${newPath}`, {
          ruleId: rule.id,
          filePath: newPath
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Rule "${rule.name}" failed: ${msg}`, {
        ruleId: rule.id,
        filePath: event.filePath
      })
    }
  }
}
