import type { AutoFlowAPI } from '@shared/types'

declare global {
  interface Window {
    autoflow: AutoFlowAPI
  }
}
