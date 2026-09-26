import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readPreferences, savePreferences } from '../src/lib/persistence'
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key),
    setItem: (key: string, value: string) => data.set(key, value),
  })
})
afterEach(() => vi.unstubAllGlobals())
it('round-trips query, progress and UI preferences', () => {
  const p = readPreferences()
  p.selected = 'always-credit'
  p.exam = true
  p.theme = 'light'
  p.live = false
  p.progress['always-credit'] = { query: 'SELECT 42', solved: true, attempts: 2, hints: 1 }
  expect(savePreferences(p)).toBe(true)
  expect(readPreferences()).toEqual(p)
})
it('recovers from corrupt or obsolete persisted values', () => {
  localStorage.setItem('sql-dynamic-lab:v1', '{')
  expect(readPreferences().selected).toBe('in-transit')
  localStorage.setItem(
    'sql-dynamic-lab:v1',
    JSON.stringify({
      selected: 'obsolete',
      theme: 'invalid',
      progress: { 'in-transit': { query: 'SELECT 1', attempts: -10, hints: 900, solved: 'true' } },
    }),
  )
  expect(readPreferences().progress['in-transit']).toEqual({
    query: 'SELECT 1',
    attempts: 0,
    hints: 3,
    solved: false,
  })
})
it('survives disabled storage and reports failed saves', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('Denied')
    },
    setItem: () => {
      throw new Error('Quota exceeded')
    },
  })
  expect(readPreferences().selected).toBe('in-transit')
  expect(savePreferences(readPreferences())).toBe(false)
})
