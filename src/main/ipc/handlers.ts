import { IpcMain, BrowserWindow, dialog, shell } from 'electron'
import { RuleEngine } from '../../automation/ruleEngine'
import { ConfigManager } from '../../core/config'
import { Logger } from '../../core/logger'
import type { Rule, WatcherConfig } from '@shared/types'

let ruleEngine: RuleEngine | null = null

const trashFn = async (filePath: string): Promise<void> => {
  await shell.trashItem(filePath)
}

export function registerIpcHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  const config = new ConfigManager()

  const logger = new Logger((entry) => {
    if (!win.isDestroyed()) {
      win.webContents.send('autoflow:log', entry)
    }
  })

  ipcMain.handle('autoflow:get-rules', async (): Promise<Rule[]> => {
    return config.loadRules()
  })

  ipcMain.handle('autoflow:add-rule', async (_event, rule: Rule): Promise<void> => {
    const rules = await config.loadRules()
    rules.push(rule)
    await config.saveRules(rules)
    ruleEngine?.reloadRules(rules)
  })

  ipcMain.handle('autoflow:remove-rule', async (_event, id: string): Promise<void> => {
    let rules = await config.loadRules()
    rules = rules.filter((r) => r.id !== id)
    await config.saveRules(rules)
    ruleEngine?.reloadRules(rules)
  })

  ipcMain.handle('autoflow:update-rule', async (_event, rule: Rule): Promise<void> => {
    let rules = await config.loadRules()
    const idx = rules.findIndex((r) => r.id === rule.id)
    if (idx !== -1) rules[idx] = rule
    await config.saveRules(rules)
    ruleEngine?.reloadRules(rules)
  })

  ipcMain.handle('autoflow:start-watcher', async (_event, watcherConfig: WatcherConfig): Promise<void> => {
    if (ruleEngine) {
      await ruleEngine.stop()
      ruleEngine = null
    }
    const rules = await config.loadRules()
    ruleEngine = new RuleEngine(rules, logger, trashFn)
    await ruleEngine.start(watcherConfig.watchPath)
    if (!win.isDestroyed()) {
      win.webContents.send('autoflow:status-change', 'running')
    }
  })

  ipcMain.handle('autoflow:stop-watcher', async (): Promise<void> => {
    if (ruleEngine) {
      await ruleEngine.stop()
      ruleEngine = null
    }
    if (!win.isDestroyed()) {
      win.webContents.send('autoflow:status-change', 'idle')
    }
  })

  ipcMain.handle('autoflow:select-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Watch Folder'
    })
    return result.canceled ? null : result.filePaths[0]
  })
}
