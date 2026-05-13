import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { AutoFlowAPI, Rule, WatcherConfig, LogEntry, WatcherStatus, PluginMeta } from '@shared/types'

const api: AutoFlowAPI = {
  startWatcher: (config: WatcherConfig): Promise<void> =>
    ipcRenderer.invoke('autoflow:start-watcher', config),

  stopWatcher: (): Promise<void> =>
    ipcRenderer.invoke('autoflow:stop-watcher'),

  addRule: (rule: Rule): Promise<void> =>
    ipcRenderer.invoke('autoflow:add-rule', rule),

  removeRule: (id: string): Promise<void> =>
    ipcRenderer.invoke('autoflow:remove-rule', id),

  updateRule: (rule: Rule): Promise<void> =>
    ipcRenderer.invoke('autoflow:update-rule', rule),

  getRules: (): Promise<Rule[]> =>
    ipcRenderer.invoke('autoflow:get-rules'),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('autoflow:select-directory'),

  getPlugins: (): Promise<PluginMeta[]> =>
    ipcRenderer.invoke('autoflow:get-plugins'),

  openPluginsFolder: (): Promise<void> =>
    ipcRenderer.invoke('autoflow:open-plugins-folder'),

  onLog: (cb: (entry: LogEntry) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, entry: LogEntry): void => cb(entry)
    ipcRenderer.on('autoflow:log', handler)
    return () => ipcRenderer.off('autoflow:log', handler)
  },

  onStatusChange: (cb: (status: WatcherStatus) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, status: WatcherStatus): void => cb(status)
    ipcRenderer.on('autoflow:status-change', handler)
    return () => ipcRenderer.off('autoflow:status-change', handler)
  },

  onPluginsChanged: (cb: (plugins: PluginMeta[]) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, plugins: PluginMeta[]): void => cb(plugins)
    ipcRenderer.on('autoflow:plugins-changed', handler)
    return () => ipcRenderer.off('autoflow:plugins-changed', handler)
  }
}

contextBridge.exposeInMainWorld('autoflow', api)
