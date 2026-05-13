import { join } from 'path'
import { app } from 'electron'
import { promises as fs } from 'fs'
import type { TriggerPlugin, ActionPlugin, PluginMeta } from '@shared/types'
import type { LoadedPlugin } from './pluginRegistry'

export function getPluginsDir(): string {
  return join(app.getPath('userData'), 'plugins')
}

function hasTriggerShape(p: Record<string, unknown>): boolean {
  return typeof p.start === 'function' && typeof p.stop === 'function'
}

function hasActionShape(p: Record<string, unknown>): boolean {
  return typeof p.execute === 'function'
}

function validatePlugin(mod: unknown): { plugin: TriggerPlugin | ActionPlugin; kind: 'trigger' | 'action' } {
  if (typeof mod !== 'object' || mod === null) throw new Error('must export an object')
  const p = mod as Record<string, unknown>
  if (typeof p.type !== 'string' || !p.type) throw new Error('missing string "type"')
  if (typeof p.name !== 'string' || !p.name) throw new Error('missing string "name"')
  if (typeof p.version !== 'string') throw new Error('missing string "version"')

  if (hasTriggerShape(p)) return { plugin: p as unknown as TriggerPlugin, kind: 'trigger' }
  if (hasActionShape(p)) return { plugin: p as unknown as ActionPlugin, kind: 'action' }
  throw new Error('must implement execute() or start() + stop()')
}

export async function loadPlugins(): Promise<LoadedPlugin[]> {
  const pluginsDir = getPluginsDir()
  await fs.mkdir(pluginsDir, { recursive: true })

  let files: string[]
  try {
    const entries = await fs.readdir(pluginsDir)
    files = entries.filter((f) => f.endsWith('.js'))
  } catch {
    return []
  }

  const results: LoadedPlugin[] = []

  for (const file of files) {
    const filePath = join(pluginsDir, file)
    try {
      // clear module cache so hot-reload picks up changes
      delete require.cache[require.resolve(filePath)]
      const mod = require(filePath) as unknown
      const { plugin, kind } = validatePlugin(mod)
      const meta: PluginMeta = {
        name: plugin.name,
        version: plugin.version,
        kind,
        pluginType: plugin.type,
        status: 'active'
      }
      results.push({ ok: true, plugin, meta })
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      results.push({
        ok: false,
        meta: { name: file, version: '?', kind: 'action', pluginType: '', status: 'error', error }
      })
    }
  }

  return results
}
