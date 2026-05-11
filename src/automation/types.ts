export * from '@shared/types'

export interface FileEvent {
  eventType: 'add'
  filePath: string
  watchPath: string
  timestamp: string
}
