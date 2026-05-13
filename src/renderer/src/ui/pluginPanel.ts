import type { PluginMeta } from '@shared/types'

export class PluginPanel {
  private container: HTMLElement
  private plugins: PluginMeta[] = []

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
  }

  setPlugins(plugins: PluginMeta[]): void {
    this.plugins = plugins
    this.renderList()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="plugin-header">
        <h2 class="panel-title">Plugins</h2>
        <button class="btn btn--small" id="btn-open-plugins-folder">Open Folder</button>
      </div>
      <ul id="plugin-list" class="plugin-list"></ul>
    `

    this.container.querySelector('#btn-open-plugins-folder')!.addEventListener('click', () => {
      window.autoflow.openPluginsFolder().catch(console.error)
    })

    this.renderList()
  }

  private renderList(): void {
    const list = this.container.querySelector('#plugin-list')!

    if (this.plugins.length === 0) {
      list.innerHTML = `
        <li class="plugin-empty">
          No plugins loaded. Drop <code>.js</code> files into the plugins folder.
        </li>
      `
      return
    }

    list.innerHTML = this.plugins
      .map(
        (p) => `
        <li class="plugin-item plugin-item--${p.status}">
          <div class="plugin-item__dot"></div>
          <div class="plugin-item__info">
            <span class="plugin-item__name">${this.escapeHtml(p.name)}</span>
            <span class="plugin-item__meta">
              ${p.status === 'active'
                ? `<code>${this.escapeHtml(p.kind)}: ${this.escapeHtml(p.pluginType)}</code> v${this.escapeHtml(p.version)}`
                : `<span class="plugin-item__error">${this.escapeHtml(p.error ?? 'unknown error')}</span>`
              }
            </span>
          </div>
          <span class="plugin-item__badge plugin-item__badge--${p.status}">${p.status}</span>
        </li>
      `
      )
      .join('')
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
