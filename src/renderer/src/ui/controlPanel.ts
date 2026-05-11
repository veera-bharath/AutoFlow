import type { Rule, WatcherStatus } from '@shared/types'

export class ControlPanel {
  private container: HTMLElement
  private statusBadge: HTMLElement
  private watchPath: string = ''
  private rules: Rule[] = []
  private startBtn!: HTMLButtonElement
  private stopBtn!: HTMLButtonElement
  private pathInput!: HTMLInputElement

  constructor(container: HTMLElement, statusBadge: HTMLElement) {
    this.container = container
    this.statusBadge = statusBadge
    this.render()
  }

  private render(): void {
    this.container.innerHTML = `
      <h2 class="panel-title">Controls</h2>
      <div class="control-group">
        <label class="control-label">Watch Folder</label>
        <div class="control-row">
          <input
            type="text"
            id="watch-path"
            class="input"
            placeholder="No folder selected"
            readonly
          />
          <button class="btn" id="btn-browse">Browse</button>
        </div>
      </div>
      <div class="control-row control-row--actions">
        <button class="btn btn--primary" id="btn-start">▶ Start</button>
        <button class="btn btn--danger" id="btn-stop" disabled>■ Stop</button>
      </div>
    `

    this.pathInput = this.container.querySelector('#watch-path')!
    this.startBtn = this.container.querySelector('#btn-start')!
    this.stopBtn = this.container.querySelector('#btn-stop')!

    this.container.querySelector('#btn-browse')!.addEventListener('click', () => this.onBrowse())
    this.startBtn.addEventListener('click', () => this.onStart())
    this.stopBtn.addEventListener('click', () => this.onStop())
  }

  private async onBrowse(): Promise<void> {
    const path = await window.autoflow.selectDirectory()
    if (path) {
      this.watchPath = path
      this.pathInput.value = path
    }
  }

  private async onStart(): Promise<void> {
    if (!this.watchPath) {
      alert('Please select a watch folder first.')
      return
    }
    try {
      await window.autoflow.startWatcher({ watchPath: this.watchPath })
    } catch (err) {
      alert(`Failed to start: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  private async onStop(): Promise<void> {
    try {
      await window.autoflow.stopWatcher()
    } catch (err) {
      console.error('Stop error:', err)
    }
  }

  setStatus(status: WatcherStatus): void {
    this.startBtn.disabled = status === 'running'
    this.stopBtn.disabled = status !== 'running'

    const label = status.charAt(0).toUpperCase() + status.slice(1)
    this.statusBadge.textContent = label
    this.statusBadge.className = `badge badge--${status}`
  }

  setRules(rules: Rule[]): void {
    this.rules = rules
  }
}
