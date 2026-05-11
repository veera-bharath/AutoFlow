import type { Rule, Trigger, Action, Conditions, CronTrigger } from '@shared/types'

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
          <input class="input" type="text" id="rule-name" placeholder="e.g. Archive old PDFs" required />
        </div>

        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="rule-trigger">Trigger</label>
            <select class="input" id="rule-trigger">
              <option value="file_added">File Added</option>
              <option value="cron">Schedule (Cron)</option>
            </select>
          </div>
          <div class="form-field" id="cron-field" style="display:none">
            <label class="form-label" for="rule-cron">Cron Expression</label>
            <input class="input" type="text" id="rule-cron" placeholder="0 9 * * *" />
          </div>
        </div>

        <div class="form-field">
          <label class="form-label" for="rule-watch-path">Watch Path *</label>
          <div class="control-row">
            <input class="input" type="text" id="rule-watch-path" placeholder="e.g. C:\\Downloads" required />
            <button type="button" class="btn btn--small" id="btn-browse-watch">Browse</button>
          </div>
        </div>

        <div class="form-section-label">Conditions</div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="rule-extension">Extension</label>
            <input class="input" type="text" id="rule-extension" placeholder=".pdf" />
          </div>
          <div class="form-field">
            <label class="form-label" for="rule-filename-regex">Filename Regex</label>
            <input class="input" type="text" id="rule-filename-regex" placeholder="invoice.*" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="rule-min-size">Min Size (KB)</label>
            <input class="input" type="number" id="rule-min-size" placeholder="0" min="0" />
          </div>
          <div class="form-field">
            <label class="form-label" for="rule-max-size">Max Size (KB)</label>
            <input class="input" type="number" id="rule-max-size" placeholder="any" min="0" />
          </div>
        </div>
        <div class="form-row" id="age-fields" style="display:none">
          <div class="form-field">
            <label class="form-label" for="rule-older-than">Older Than (days)</label>
            <input class="input" type="number" id="rule-older-than" placeholder="" min="0" />
          </div>
          <div class="form-field">
            <label class="form-label" for="rule-newer-than">Newer Than (days)</label>
            <input class="input" type="number" id="rule-newer-than" placeholder="" min="0" />
          </div>
        </div>

        <div class="form-section-label">Action</div>
        <div class="form-field">
          <label class="form-label" for="rule-action-type">Action Type</label>
          <select class="input" id="rule-action-type">
            <option value="move">Move to Folder</option>
            <option value="rename">Rename File</option>
            <option value="delete">Delete</option>
            <option value="shell">Run Command</option>
          </select>
        </div>

        <div id="action-move-fields">
          <div class="form-field">
            <label class="form-label" for="rule-target-path">Target Folder *</label>
            <div class="control-row">
              <input class="input" type="text" id="rule-target-path" placeholder="e.g. C:\\Documents\\PDFs" />
              <button type="button" class="btn btn--small" id="btn-browse-target">Browse</button>
            </div>
          </div>
        </div>

        <div id="action-rename-fields" style="display:none">
          <div class="form-field">
            <label class="form-label" for="rule-rename-pattern">Pattern</label>
            <input class="input" type="text" id="rule-rename-pattern" placeholder="{date}-{name}{ext}" />
          </div>
          <div class="form-hint">Tokens: {name} {ext} {date} {datetime}</div>
        </div>

        <div id="action-delete-fields" style="display:none">
          <label class="form-checkbox">
            <input type="checkbox" id="rule-delete-permanent" />
            <span>Permanent (skip Recycle Bin)</span>
          </label>
        </div>

        <div id="action-shell-fields" style="display:none">
          <div class="form-field">
            <label class="form-label" for="rule-shell-command">Command</label>
            <input class="input" type="text" id="rule-shell-command" placeholder='zip "{filePath}" "{watchPath}"' />
          </div>
          <div class="form-hint">Tokens: {filePath} {watchPath}</div>
        </div>

        <button type="submit" class="btn btn--primary btn--full">+ Add Rule</button>
      </form>
      <ul id="rule-list" class="rule-list"></ul>
    `

    this.bindFormEvents()
    this.renderList()
  }

  private bindFormEvents(): void {
    const form = this.container.querySelector<HTMLFormElement>('#rule-form')!

    form.addEventListener('submit', (e) => {
      e.preventDefault()
      this.onAddRule(form)
    })

    const triggerSelect = form.querySelector<HTMLSelectElement>('#rule-trigger')!
    triggerSelect.addEventListener('change', () => this.updateTriggerVisibility(form))

    const actionSelect = form.querySelector<HTMLSelectElement>('#rule-action-type')!
    actionSelect.addEventListener('change', () => this.updateActionVisibility(form))

    form.querySelector('#btn-browse-watch')!.addEventListener('click', async () => {
      const path = await window.autoflow.selectDirectory()
      if (path) (form.querySelector('#rule-watch-path') as HTMLInputElement).value = path
    })

    form.querySelector('#btn-browse-target')!.addEventListener('click', async () => {
      const path = await window.autoflow.selectDirectory()
      if (path) (form.querySelector('#rule-target-path') as HTMLInputElement).value = path
    })
  }

  private updateTriggerVisibility(form: HTMLElement): void {
    const triggerType = (form.querySelector('#rule-trigger') as HTMLSelectElement).value
    const isCron = triggerType === 'cron'
    ;(form.querySelector('#cron-field') as HTMLElement).style.display = isCron ? '' : 'none'
    ;(form.querySelector('#age-fields') as HTMLElement).style.display = isCron ? '' : 'none'
  }

  private updateActionVisibility(form: HTMLElement): void {
    const actionType = (form.querySelector('#rule-action-type') as HTMLSelectElement).value
    for (const t of ['move', 'rename', 'delete', 'shell']) {
      const el = form.querySelector<HTMLElement>(`#action-${t}-fields`)!
      el.style.display = t === actionType ? '' : 'none'
    }
  }

  private async onAddRule(form: HTMLFormElement): Promise<void> {
    const get = (id: string): string =>
      (form.querySelector(`#${id}`) as HTMLInputElement).value.trim()

    const getNum = (id: string): number | undefined => {
      const raw = get(id)
      if (!raw) return undefined
      const v = parseFloat(raw)
      return isNaN(v) ? undefined : v
    }

    const name = get('rule-name')
    const watchPath = get('rule-watch-path')

    if (!name || !watchPath) {
      alert('Rule Name and Watch Path are required.')
      return
    }

    const triggerType = (form.querySelector('#rule-trigger') as HTMLSelectElement).value as
      | 'file_added'
      | 'cron'
    const actionType = (form.querySelector('#rule-action-type') as HTMLSelectElement).value as
      | 'move'
      | 'rename'
      | 'delete'
      | 'shell'

    const trigger: Trigger =
      triggerType === 'cron'
        ? { type: 'cron', expression: get('rule-cron') }
        : { type: 'file_added' }

    if (trigger.type === 'cron' && !(trigger as CronTrigger).expression) {
      alert('Cron expression is required for scheduled rules.')
      return
    }

    const minSizeKB = getNum('rule-min-size')
    const maxSizeKB = getNum('rule-max-size')

    const conditions: Conditions = {
      watchPath,
      extension: get('rule-extension') || undefined,
      filenameRegex: get('rule-filename-regex') || undefined,
      minSize: minSizeKB !== undefined ? minSizeKB * 1024 : undefined,
      maxSize: maxSizeKB !== undefined ? maxSizeKB * 1024 : undefined,
      olderThanDays: getNum('rule-older-than'),
      newerThanDays: getNum('rule-newer-than')
    }

    let action: Action
    if (actionType === 'move') {
      const targetPath = get('rule-target-path')
      if (!targetPath) {
        alert('Target folder is required for move action.')
        return
      }
      action = { type: 'move', targetPath }
    } else if (actionType === 'rename') {
      const pattern = get('rule-rename-pattern')
      if (!pattern) {
        alert('Pattern is required for rename action.')
        return
      }
      action = { type: 'rename', pattern }
    } else if (actionType === 'delete') {
      const permanent = (form.querySelector('#rule-delete-permanent') as HTMLInputElement).checked
      action = { type: 'delete', permanent }
    } else {
      const command = get('rule-shell-command')
      if (!command) {
        alert('Command is required for shell action.')
        return
      }
      action = { type: 'shell', command }
    }

    const rule: Rule = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      trigger,
      conditions,
      workflow: [action]
    }

    try {
      await window.autoflow.addRule(rule)
      this.rules.push(rule)
      this.onRulesChange([...this.rules])
      this.renderList()
      form.reset()
      this.updateTriggerVisibility(form)
      this.updateActionVisibility(form)
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

  private describeTrigger(rule: Rule): string {
    if (rule.trigger.type === 'cron') return `cron: ${rule.trigger.expression}`
    return 'file added'
  }

  private describeAction(rule: Rule): string {
    const first = rule.workflow[0]
    if (!first) return 'no action'
    switch (first.type) {
      case 'move':   return `→ ${first.targetPath}`
      case 'rename': return `rename: ${first.pattern}`
      case 'delete': return first.permanent ? 'delete (permanent)' : 'delete (trash)'
      case 'shell':  return `shell: ${first.command.length > 28 ? first.command.slice(0, 28) + '…' : first.command}`
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
            <code>${this.escapeHtml(this.describeTrigger(rule))}</code>
            ${this.escapeHtml(this.describeAction(rule))}
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
