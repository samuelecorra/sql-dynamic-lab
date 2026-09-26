import { exercises } from '../exercises'
import type { Preferences } from '../types'
const KEY = 'sql-dynamic-lab:v1'
export function readPreferences(): Preferences {
  const defaults: Preferences = {
    selected: exercises[0].id,
    exam: false,
    theme: 'dark',
    live: true,
    progress: {},
  }
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const result = { ...defaults }
    if (exercises.some((e) => e.id === raw.selected)) result.selected = raw.selected
    if (typeof raw.exam === 'boolean') result.exam = raw.exam
    if (typeof raw.live === 'boolean') result.live = raw.live
    if (raw.theme === 'light') result.theme = 'light'
    for (const e of exercises) {
      const p = raw.progress?.[e.id]
      if (p && typeof p.query === 'string')
        result.progress[e.id] = {
          query: p.query,
          solved: p.solved === true,
          attempts: Number.isSafeInteger(p.attempts) && p.attempts >= 0 ? p.attempts : 0,
          hints: Number.isSafeInteger(p.hints) ? Math.min(Math.max(0, p.hints), e.hints.length) : 0,
        }
    }
    return result
  } catch {
    return defaults
  }
}
export function savePreferences(value: Preferences): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}
