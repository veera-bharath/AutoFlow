export type RuleTriggerType = 'file_added'

export interface Rule {
  id: string
  name: string
  enabled: boolean
  trigger: { type: RuleTriggerType }
  conditions: {
    watchPath: string
    extension?: string
    filenameContains?: string
  }
  action: {
    type: 'move'
    targetPath: string
  }
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

export interface AutoFlowAPI {
  startWatcher: (config: WatcherConfig) => Promise<void>
  stopWatcher: () => Promise<void>
  addRule: (rule: Rule) => Promise<void>
  removeRule: (id: string) => Promise<void>
  updateRule: (rule: Rule) => Promise<void>
  getRules: () => Promise<Rule[]>
  selectDirectory: () => Promise<string | null>
  onLog: (cb: (entry: LogEntry) => void) => () => void
  onStatusChange: (cb: (status: WatcherStatus) => void) => () => void
}
