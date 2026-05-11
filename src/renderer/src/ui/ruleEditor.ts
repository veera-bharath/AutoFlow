import type { Rule } from '@shared/types'

type OnRulesChange = (rules: Rule[]) => void

export class RuleEditor {
  private container: HTMLElement
  private rules: Rule[] = []
  private onRulesChange: OnRulesChange

  constructor(container: HTMLElement, onRulesChange: OnRulesChange) {
    this.container = container
    this.onRulesChange = onRulesChange
    this.render()
  }

  setRules(rules: Rule[]): void {
    this.rules = rules
    this.renderList()
  }

  private render(): void {
    this.container.innerHTML = `
      <h2 class="panel-title">Rules</h2>
      <form id="rule-form" class="rule-form" novalidate>
        <div class="form-field">
          <label class="form-label" for="rule-name">Rule Name *</label>
          <input class="input" type="text" id="rule-name" placeholder="e.g. Move PDFs" required />
        </div>
        <div class="form-field">
          <label class="form-label" for="rule-watch-path">Watch Path *</label>
          <input class="input" type="text" id="rule-watch-path" placeholder="e.g. C:\\Downloads" required />
        </div>
        <div class="form-field">
          <label class="form-label" for="rule-target-path">Target Folder *</label>
          <input class="input" type="text" id="rule-target-path" placeholder="e.g. C:\\Documents\\PDFs" required />
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="rule-extension">Extension</label>
            <input class="input" type="text" id="rule-extension" placeholder=".pdf" />
          </div>
          <div class="form-field">
            <label class="form-label" for="rule-filename-contains">Name Contains</label>
            <input class="input" type="text" id="rule-filename-contains" placeholder="invoice" />
          </div>
        </div>
        <button type="submit" class="btn btn--primary btn--full">+ Add Rule</button>
      </form>
      <ul id="rule-list" class="rule-list"></ul>
    `

    this.container
      .querySelector('#rule-form')!
      .addEventListener('submit', (e) => {
        e.preventDefault()
        this.onAddRule(e.target as HTMLFormElement)
      })

    this.renderList()
  }

  private async onAddRule(form: HTMLFormElement): Promise<void> {
    const get = (id: string): string =>
      (form.querySelector(`#${id}`) as HTMLInputElement).value.trim()

    const name = get('rule-name')
    const watchPath = get('rule-watch-path')
    const targetPath = get('rule-target-path')

    if (!name || !watchPath || !targetPath) {
      alert('Rule Name, Watch Path, and Target Folder are required.')
      return
    }

    const rule: Rule = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      trigger: { type: 'file_added' },
      conditions: {
        watchPath,
        extension: get('rule-extension') || undefined,
        filenameContains: get('rule-filename-contains') || undefined
      },
      action: {
        type: 'move',
        targetPath
      }
    }

    try {
      await window.autoflow.addRule(rule)
      this.rules.push(rule)
      this.onRulesChange([...this.rules])
      this.renderList()
      form.reset()
    } catch (err) {
      alert(`Failed to add rule: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async onToggle(id: string): Promise<void> {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) return
    const updated: Rule = { ...rule, enabled: !rule.enabled }
    try {
      await window.autoflow.updateRule(updated)
      this.rules = this.rules.map((r) => (r.id === id ? updated : r))
      this.onRulesChange([...this.rules])
      this.renderList()
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  private async onDelete(id: string): Promise<void> {
    try {
      await window.autoflow.removeRule(id)
      this.rules = this.rules.filter((r) => r.id !== id)
      this.onRulesChange([...this.rules])
      this.renderList()
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  private renderList(): void {
    const list = this.container.querySelector('#rule-list')!

    if (this.rules.length === 0) {
      list.innerHTML = '<li class="rule-list__empty">No rules configured yet.</li>'
      return
    }

    list.innerHTML = this.rules
      .map(
        (rule) => `
      <li class="rule-item ${rule.enabled ? 'rule-item--enabled' : 'rule-item--disabled'}"
          data-id="${rule.id}">
        <div class="rule-item__info">
          <span class="rule-item__name">${this.escapeHtml(rule.name)}</span>
          <span class="rule-item__meta">
            ${rule.conditions.extension ? `<code>${this.escapeHtml(rule.conditions.extension)}</code>` : 'any file'}
            → ${this.escapeHtml(rule.action.targetPath)}
          </span>
        </div>
        <div class="rule-item__actions">
          <button class="btn btn--small btn-toggle" data-id="${rule.id}">
            ${rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button class="btn btn--small btn--danger btn-delete" data-id="${rule.id}">
            Delete
          </button>
        </div>
      </li>
    `
      )
      .join('')

    list.querySelectorAll<HTMLElement>('.btn-toggle').forEach((btn) => {
      btn.addEventListener('click', () => this.onToggle(btn.dataset.id!))
    })

    list.querySelectorAll<HTMLElement>('.btn-delete').forEach((btn) => {
      btn.addEventListener('click', () => this.onDelete(btn.dataset.id!))
    })
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
