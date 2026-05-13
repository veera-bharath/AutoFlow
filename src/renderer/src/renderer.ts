import './styles/main.css'
import { LogPanel } from './ui/logPanel'
import { ControlPanel } from './ui/controlPanel'
import { RuleEditor } from './ui/ruleEditor'
import { PluginPanel } from './ui/pluginPanel'

async function bootstrap(): Promise<void> {
  const logPanel = new LogPanel(document.getElementById('log-panel')!)

  const controlPanel = new ControlPanel(
    document.getElementById('control-panel')!,
    document.getElementById('status-badge')!
  )

  const ruleEditor = new RuleEditor(document.getElementById('rule-editor')!, (rules) => {
    controlPanel.setRules(rules)
  })

  const pluginPanel = new PluginPanel(document.getElementById('plugin-panel')!)

  window.autoflow.onLog((entry) => logPanel.append(entry))
  window.autoflow.onStatusChange((status) => controlPanel.setStatus(status))
  window.autoflow.onPluginsChanged((plugins) => {
    pluginPanel.setPlugins(plugins)
    ruleEditor.updatePluginOptions(plugins)
  })

  const [rules, plugins] = await Promise.all([
    window.autoflow.getRules(),
    window.autoflow.getPlugins()
  ])

  ruleEditor.setRules(rules)
  ruleEditor.updatePluginOptions(plugins)
  controlPanel.setRules(rules)
  pluginPanel.setPlugins(plugins)
}

document.addEventListener('DOMContentLoaded', () => {
  bootstrap().catch(console.error)
})
