export type Cell = string | number | null | Uint8Array
export interface ResultSet {
  columns: string[]
  rows: Cell[][]
  truncated?: boolean
}
export interface Exercise {
  id: string
  title: string
  subtitle: string
  statement: string
  difficulty: string
  tags: string[]
  schemaSql: string
  seedSql: string
  validationSeeds: string[]
  starter: string
  reference: string
  alternative?: string
  explanation: string
  hints: string[]
  rules: string[]
  noCte?: boolean
  orderMatters?: boolean
  outputColumns: string[]
}
export interface TableInfo {
  name: string
  count: number
  columns: { name: string; type: string; pk: boolean; fk?: string }[]
}
export interface Comparison {
  correct: boolean
  missing: Cell[][]
  extra: Cell[][]
  message: string
}
export interface Validation extends Comparison {
  datasets: number
  failedDataset?: number
}
export interface XRayStage {
  id: string
  label: string
  note: string
  result: ResultSet
  unit: 'rows' | 'groups'
}
export interface XRay {
  stages: XRayStage[]
  unavailable?: string
}
export interface RunResult {
  result: ResultSet
  xray: XRay
  milliseconds: number
}
export interface Progress {
  query: string
  solved: boolean
  attempts: number
  hints: number
}
export interface Preferences {
  selected: string
  exam: boolean
  theme: 'dark' | 'light'
  live: boolean
  progress: Record<string, Progress>
}
