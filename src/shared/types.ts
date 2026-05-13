export type TriggerType = 'file_added' | 'cron' | 'plugin'

export interface FileTrigger {
  type: 'file_added'
}

export interface CronTrigger {
  type: 'cron'
  expression: string
}

export interface PluginTrigger {
  type: 'plugin'
  pluginType: string
}

export type Trigger = FileTrigger | CronTrigger | PluginTrigger

export interface Conditions {
  watchPath: string
  extension?: string
  filenameContains?: string  // legacy — kept for migration
  filenameRegex?: string
  minSize?: number           // bytes
  maxSize?: number           // bytes
  olderThanDays?: number
  newerThanDays?: number
}

export interface MoveAction {
  type: 'move'
  targetPath: string
}

export interface RenameAction {
  type: 'rename'
  pattern: string            // tokens: {name} {ext} {date} {datetime}
}

export interface DeleteAction {
  type: 'delete'
  permanent?: boolean
}

export interface ShellAction {
  type: 'shell'
  command: string            // tokens: {filePath} {watchPath}
}

export interface PluginAction {
  type: 'plugin'
  pluginType: string
  params?: Record<string, unknown>
}

export type Action = MoveAction | RenameAction | DeleteAction | ShellAction | PluginAction

export interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: Trigger
  conditions: Conditions
  workflow: Action[]
}

export type WatcherStatus = 'idle' | 'running' | 'error'

export interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  ruleId?: string
  filePath?: string
}

export interface WatcherConfig {
  watchPath: string
}

// ── Plugin system ────────────────────────────────────────────────

export interface TriggerPlugin {
  type: string
  name: string
  version: string
  start(emit: (filePath: string) => void): void
  stop(): void
}

export interface ActionPlugin {
  type: string
  name: string
  version: string
  execute(filePath: string, params: Record<string, unknown>): Promise<string | null>
}

export interface PluginMeta {
  name: string
  version: string
  kind: 'trigger' | 'action'
  pluginType: string
  status: 'active' | 'error'
  error?: string
}

// ── Renderer API ─────────────────────────────────────────────────

export interface AutoFlowAPI {
  startWatcher: (config: WatcherConfig) => Promise<void>
  stopWatcher: () => Promise<void>
  addRule: (rule: Rule) => Promise<void>
  removeRule: (id: string) => Promise<void>
  updateRule: (rule: Rule) => Promise<void>
  getRules: () => Promise<Rule[]>
  selectDirectory: () => Promise<string | null>
  getPlugins: () => Promise<PluginMeta[]>
  openPluginsFolder: () => Promise<void>
  onLog: (cb: (entry: LogEntry) => void) => () => void
  onStatusChange: (cb: (status: WatcherStatus) => void) => () => void
  onPluginsChanged: (cb: (plugins: PluginMeta[]) => void) => () => void
}
