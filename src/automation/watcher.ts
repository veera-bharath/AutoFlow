import chokidar, { FSWatcher } from 'chokidar'
import { EventEmitter } from 'events'
import type { FileEvent } from './types'

export class AutoFlowWatcher extends EventEmitter {
  private watcher: FSWatcher | null = null
  private watchPath: string = ''

  async start(watchPath: string): Promise<void> {
    if (this.watcher) {
      await this.stop()
    }

    this.watchPath = watchPath

    this.watcher = chokidar.watch(watchPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      },
      ignored: /(^|[/\\])\../
    })

    this.watcher.on('add', (filePath: string) => {
      const event: FileEvent = {
        eventType: 'add',
        filePath,
        watchPath: this.watchPath,
        timestamp: new Date().toISOString()
      }
      this.emit('file-event', event)
    })

    this.watcher.on('error', (error: Error) => {
      this.emit('watcher-error', error)
    })

    await new Promise<void>((resolve, reject) => {
      this.watcher!.on('ready', resolve)
      this.watcher!.on('error', reject)
    })
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }

  isRunning(): boolean {
    return this.watcher !== null
  }
}
