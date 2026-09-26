import type { RunResult, TableInfo, Validation } from '../types'
export interface Request {
  id: number
  exerciseId: string
  action: 'init' | 'run' | 'validate' | 'table'
  query?: string
}
export type ResponseData = RunResult | TableInfo[] | Validation
export interface Response {
  id: number
  data?: ResponseData
  error?: string
}
