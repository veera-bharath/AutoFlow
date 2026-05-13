import { extname, basename, relative } from 'path'
import { promises as fs } from 'fs'
import cron from 'node-cron'
import type { ScheduledTask } from 'node-cron'
import { AutoFlowWatcher } from './watcher'
import { moveFile, renameFile, deleteFile, runShellCommand } from './actions'
import type { Rule, Action, Conditions, CronTrigger, PluginTrigger } from '@shared/types'
import type { FileEvent } from './types'
import type { Logger } from '../core/logger'
import type { PluginRegistry } from '../core/pluginRegistry'

type TrashFn = (path: string) => Promise<void>

export class RuleEngine {
  private watcher: AutoFlowWatcher
  private rules: Rule[]
  private logger: Logger
  private registry: PluginRegistry
  private trashFn: TrashFn | undefined
  private cronTasks: Map<string, ScheduledTask> = new Map()

  constructor(rules: Rule[], logger: Logger, registry: PluginRegistry, trashFn?: TrashFn) {
    this.rules = rules
    this.logger = logger
    this.registry = registry
    this.trashFn = trashFn
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
    this.startCronJobs()
    this.startTriggerPlugins()
  }

  async stop(): Promise<void> {
    this.stopTriggerPlugins()
    this.stopCronJobs()
    await this.watcher.stop()
    this.logger.info('Watcher stopped')
  }

  reloadRules(rules: Rule[]): void {
    this.rules = rules
    this.stopCronJobs()
    this.startCronJobs()
    this.logger.info(`Rules reloaded: ${rules.length} rule(s) active`)
  }

  reloadPlugins(registry: PluginRegistry): void {
    this.stopTriggerPlugins()
    this.registry = registry
    if (this.watcher.isRunning()) {
      this.startTriggerPlugins()
    }
    this.logger.info(`Plugins reloaded: ${registry.getMeta().length} plugin(s)`)
  }

  // ── Cron ──────────────────────────────────────────────────────

  private startCronJobs(): void {
    for (const rule of this.rules) {
      if (!rule.enabled || rule.trigger.type !== 'cron') continue
      const trigger = rule.trigger as CronTrigger
      if (!cron.validate(trigger.expression)) {
        this.logger.warn(`Rule "${rule.name}": invalid cron expression "${trigger.expression}"`)
        continue
      }
      const task = cron.schedule(trigger.expression, () => {
        this.handleCronRule(rule).catch((err: Error) => {
          this.logger.error(`Cron rule "${rule.name}" error: ${err.message}`)
        })
      })
      this.cronTasks.set(rule.id, task)
      this.logger.info(`Scheduled cron rule "${rule.name}": ${trigger.expression}`)
    }
  }

  private stopCronJobs(): void {
    for (const task of this.cronTasks.values()) task.stop()
    this.cronTasks.clear()
  }

  // ── Trigger plugins ───────────────────────────────────────────

  private startTriggerPlugins(): void {
    for (const plugin of this.registry.getTriggers()) {
      try {
        plugin.start((filePath) => {
          this.handlePluginTrigger(plugin.type, filePath).catch((err: Error) => {
            this.logger.error(`Trigger plugin "${plugin.name}" error: ${err.message}`)
          })
        })
        this.logger.info(`Trigger plugin "${plugin.name}" (${plugin.type}) started`)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        this.logger.error(`Failed to start trigger plugin "${plugin.name}": ${msg}`)
      }
    }
  }

  private stopTriggerPlugins(): void {
    for (const plugin of this.registry.getTriggers()) {
      try {
        plugin.stop()
      } catch {}
    }
  }

  // ── File listing (for cron scans) ─────────────────────────────

  private async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => `${dirPath}\\${e.name}`)
    } catch {
      return []
    }
  }

  // ── Event handlers ────────────────────────────────────────────

  private async handleCronRule(rule: Rule): Promise<void> {
    const watchPath = rule.conditions.watchPath
    this.logger.info(`Cron rule "${rule.name}" scanning: ${watchPath}`, { ruleId: rule.id })
    const files = await this.listFiles(watchPath)
    for (const filePath of files) {
      const stat = await fs.stat(filePath).catch(() => null)
      if (!stat) continue
      if (await this.matchesConditions(filePath, stat, rule.conditions)) {
        await this.executeWorkflow(filePath, rule)
      }
    }
  }

  private async handlePluginTrigger(pluginType: string, filePath: string): Promise<void> {
    const stat = await fs.stat(filePath).catch(() => null)

    const matchingRules = this.rules.filter(
      (r) =>
        r.enabled &&
        r.trigger.type === 'plugin' &&
        (r.trigger as PluginTrigger).pluginType === pluginType
    )

    for (const rule of matchingRules) {
      const conditionsMatch = stat
        ? await this.matchesConditions(filePath, stat, rule.conditions)
        : true
      if (conditionsMatch) await this.executeWorkflow(filePath, rule)
    }
  }

  private async handleFileEvent(event: FileEvent): Promise<void> {
    this.logger.info(`File detected: ${basename(event.filePath)}`, { filePath: event.filePath })

    const stat = await fs.stat(event.filePath).catch(() => null)
    if (!stat) return

    const enabledRules = this.rules.filter((r) => r.enabled && r.trigger.type === 'file_added')

    for (const rule of enabledRules) {
      const rel = relative(rule.conditions.watchPath, event.filePath)
      if (rel.startsWith('..')) continue
      if (await this.matchesConditions(event.filePath, stat, rule.conditions)) {
        await this.executeWorkflow(event.filePath, rule)
      }
    }
  }

  // ── Condition matching ────────────────────────────────────────

  private async matchesConditions(
    filePath: string,
    stat: { size: number; mtimeMs: number },
    conditions: Conditions
  ): Promise<boolean> {
    const { extension, filenameContains, filenameRegex, minSize, maxSize, olderThanDays, newerThanDays } =
      conditions

    if (extension && extname(filePath).toLowerCase() !== extension.toLowerCase()) return false

    if (filenameRegex) {
      try {
        if (!new RegExp(filenameRegex, 'i').test(basename(filePath))) return false
      } catch {
        return false
      }
    } else if (filenameContains) {
      if (!basename(filePath).toLowerCase().includes(filenameContains.toLowerCase())) return false
    }

    if (minSize !== undefined && stat.size < minSize) return false
    if (maxSize !== undefined && stat.size > maxSize) return false

    const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
    if (olderThanDays !== undefined && ageDays < olderThanDays) return false
    if (newerThanDays !== undefined && ageDays > newerThanDays) return false

    return true
  }

  // ── Workflow execution ────────────────────────────────────────

  private async executeWorkflow(filePath: string, rule: Rule): Promise<void> {
    this.logger.info(`Rule "${rule.name}" matched: ${basename(filePath)}`, {
      ruleId: rule.id,
      filePath
    })

    let currentPath: string | null = filePath
    for (const action of rule.workflow) {
      if (currentPath === null) break
      currentPath = await this.executeAction(currentPath, action, rule)
    }
  }

  private async executeAction(filePath: string, action: Action, rule: Rule): Promise<string | null> {
    try {
      switch (action.type) {
        case 'move': {
          const newPath = await moveFile({ sourcePath: filePath, targetDirectory: action.targetPath })
          this.logger.info(`Moved: ${basename(filePath)} → ${action.targetPath}`, {
            ruleId: rule.id,
            filePath: newPath
          })
          return newPath
        }
        case 'rename': {
          const newPath = await renameFile({ sourcePath: filePath, pattern: action.pattern })
          this.logger.info(`Renamed: ${basename(filePath)} → ${basename(newPath)}`, {
            ruleId: rule.id,
            filePath: newPath
          })
          return newPath
        }
        case 'delete': {
          await deleteFile({ sourcePath: filePath, permanent: action.permanent, trashFn: this.trashFn })
          this.logger.info(`Deleted: ${basename(filePath)}${action.permanent ? '' : ' (trash)'}`, {
            ruleId: rule.id,
            filePath
          })
          return null
        }
        case 'shell': {
          await runShellCommand({
            command: action.command,
            filePath,
            watchPath: rule.conditions.watchPath
          })
          this.logger.info(`Shell command executed for: ${basename(filePath)}`, {
            ruleId: rule.id,
            filePath
          })
          return filePath
        }
        case 'plugin': {
          const plugin = this.registry.getAction(action.pluginType)
          if (!plugin) {
            this.logger.warn(
              `No action plugin registered for type "${action.pluginType}" — skipping`,
              { ruleId: rule.id, filePath }
            )
            return filePath
          }
          const result = await plugin.execute(filePath, action.params ?? {})
          this.logger.info(
            `Plugin "${plugin.name}" executed for: ${basename(filePath)}`,
            { ruleId: rule.id, filePath: result ?? filePath }
          )
          return result
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      this.logger.error(`Rule "${rule.name}" action "${action.type}" failed: ${msg}`, {
        ruleId: rule.id,
        filePath
      })
      return null
    }
  }
}
