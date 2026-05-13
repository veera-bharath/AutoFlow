import type { TriggerPlugin, ActionPlugin, PluginMeta } from '@shared/types'

export type LoadedPlugin =
  | { ok: true; plugin: TriggerPlugin | ActionPlugin; meta: PluginMeta }
  | { ok: false; meta: PluginMeta }

export class PluginRegistry {
  private triggers: Map<string, TriggerPlugin> = new Map()
  private actions: Map<string, ActionPlugin> = new Map()
  private metas: PluginMeta[] = []

  reload(loaded: LoadedPlugin[]): void {
    this.triggers.clear()
    this.actions.clear()
    this.metas = []

    for (const item of loaded) {
      this.metas.push(item.meta)
      if (!item.ok) continue
      if (item.meta.kind === 'trigger') {
        this.triggers.set(item.plugin.type, item.plugin as TriggerPlugin)
      } else {
        this.actions.set(item.plugin.type, item.plugin as ActionPlugin)
      }
    }
  }

  getTrigger(type: string): TriggerPlugin | undefined {
    return this.triggers.get(type)
  }

  getAction(type: string): ActionPlugin | undefined {
    return this.actions.get(type)
  }

  getTriggers(): TriggerPlugin[] {
    return [...this.triggers.values()]
  }

  getActions(): ActionPlugin[] {
    return [...this.actions.values()]
  }

  getMeta(): PluginMeta[] {
    return [...this.metas]
  }
}
