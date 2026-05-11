import { randomUUID } from 'crypto'
import type { LogEntry } from '@shared/types'

type LogCallback = (entry: LogEntry) => void
type LogLevel = LogEntry['level']
type LogMeta = { ruleId?: string; filePath?: string }

export class Logger {
  private onLog: LogCallback

  constructor(onLog: LogCallback) {
    this.onLog = onLog
  }

  info(message: string, meta?: LogMeta): void {
    this.emit('info', message, meta)
  }

  warn(message: string, meta?: LogMeta): void {
    this.emit('warn', message, meta)
  }

  error(message: string, meta?: LogMeta): void {
    this.emit('error', message, meta)
  }

  debug(message: string, meta?: LogMeta): void {
    this.emit('debug', message, meta)
  }

  private emit(level: LogLevel, message: string, meta?: LogMeta): void {
    const entry: LogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta
    }
    const consoleFn = level === 'debug' ? 'log' : level
    console[consoleFn](`[AutoFlow ${level.toUpperCase()}] ${message}`)
    this.onLog(entry)
  }
}
