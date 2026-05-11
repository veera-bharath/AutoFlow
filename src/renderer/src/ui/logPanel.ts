import type { LogEntry } from '@shared/types'

const MAX_ENTRIES = 500

export class LogPanel {
  private container: HTMLElement
  private list!: HTMLUListElement
  private entryCount: number = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="log-header">
        <h2 class="panel-title">Activity Log</h2>
        <button class="btn btn--small" id="log-clear">Clear</button>
      </div>
      <ul class="log-list" role="log" aria-live="polite" aria-label="Activity log"></ul>
    `
    this.list = this.container.querySelector('.log-list')!
    this.container.querySelector('#log-clear')!.addEventListener('click', () => this.clear())
  }

  append(entry: LogEntry): void {
    if (this.entryCount >= MAX_ENTRIES) {
      this.list.firstElementChild?.remove()
      this.entryCount--
    }

    const wasAtBottom = this.isScrolledToBottom()

    const li = document.createElement('li')
    li.className = `log-entry log-entry--${entry.level}`
    li.dataset.id = entry.id

    const time = new Date(entry.timestamp).toLocaleTimeString()
    li.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-level">${entry.level.toUpperCase()}</span>
      <span class="log-message">${this.escapeHtml(entry.message)}</span>
    `

    this.list.appendChild(li)
    this.entryCount++

    if (wasAtBottom) {
      li.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }

  clear(): void {
    this.list.innerHTML = ''
    this.entryCount = 0
  }

  private isScrolledToBottom(): boolean {
    const el = this.list
    return el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
