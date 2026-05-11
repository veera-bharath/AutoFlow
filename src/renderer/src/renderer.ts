import './styles/main.css'
import { LogPanel } from './ui/logPanel'
import { ControlPanel } from './ui/controlPanel'
import { RuleEditor } from './ui/ruleEditor'

async function bootstrap(): Promise<void> {
  const logPanel = new LogPanel(document.getElementById('log-panel')!)

  const controlPanel = new ControlPanel(
    document.getElementById('control-panel')!,
    document.getElementById('status-badge')!
  )

  const ruleEditor = new RuleEditor(document.getElementById('rule-editor')!, (rules) => {
    controlPanel.setRules(rules)
  })

  window.autoflow.onLog((entry) => logPanel.append(entry))
  window.autoflow.onStatusChange((status) => controlPanel.setStatus(status))

  const rules = await window.autoflow.getRules()
  ruleEditor.setRules(rules)
  controlPanel.setRules(rules)
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(console.error)
})
