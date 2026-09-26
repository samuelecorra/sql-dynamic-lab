import { useCallback, useEffect, useRef, useState } from 'react'
import { SqlClient } from '../engine/client'
import { isIncomplete } from '../engine/sql-text'
import { getExercise } from '../exercises'
import { readPreferences, savePreferences } from '../lib/persistence'
import type { Progress, RunResult, TableInfo, Validation } from '../types'

export function useLab() {
  const [preferences, setPreferences] = useState(readPreferences)
  const exercise = getExercise(preferences.selected)
  const progress: Progress = preferences.progress[exercise.id] ?? {
    query: exercise.starter,
    solved: false,
    attempts: 0,
    hints: 0,
  }
  const query = progress.query
  const [tables, setTables] = useState<TableInfo[]>([])
  const [run, setRun] = useState<RunResult>()
  const [validation, setValidation] = useState<Validation>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Initializing SQLite…')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  const [resetVersion, setResetVersion] = useState(0)
  const [client] = useState(() => new SqlClient())
  const revision = useRef(0)
  const busyRef = useRef(false)
  const alive = useRef(true)
  const patchProgress = useCallback(
    (patch: Partial<Progress>) => {
      setPreferences((p) => ({
        ...p,
        progress: {
          ...p.progress,
          [exercise.id]: {
            ...(p.progress[exercise.id] ?? {
              query: exercise.starter,
              solved: false,
              attempts: 0,
              hints: 0,
            }),
            ...patch,
          },
        },
      }))
    },
    [exercise],
  )
  useEffect(() => {
    setStorageOk(savePreferences(preferences))
    document.documentElement.dataset.theme = preferences.theme
  }, [preferences])
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      client.stop()
    }
  }, [client])
  useEffect(() => {
    revision.current++
    let cancelled = false
    client.stop()
    busyRef.current = false
    setBusy(false)
    setReady(false)
    setRun(undefined)
    setValidation(undefined)
    setError('')
    setTables([])
    setStatus('Loading exercise…')
    client
      .request<TableInfo[]>({ exerciseId: exercise.id, action: 'init' })
      .then((data) => {
        if (cancelled) return
        setTables(data)
        setReady(true)
        setStatus('Ready')
      })
      .catch((e) => {
        if (!cancelled && alive.current) {
          setError(e.message)
          setStatus('Database unavailable')
        }
      })
    return () => {
      cancelled = true
    }
  }, [client, exercise.id, resetVersion])

  const execute = useCallback(
    async (explicit = true) => {
      if (!ready || busyRef.current) return
      const version = revision.current
      busyRef.current = true
      setBusy(true)
      setError('')
      setStatus('Running…')
      try {
        const data = await client.request<RunResult>({
          action: 'run',
          exerciseId: exercise.id,
          query,
        })
        if (version === revision.current && alive.current) {
          setRun(data)
          setStatus('Up to date')
        }
      } catch (e) {
        if (version !== revision.current || !alive.current) return
        const message = (e as Error).message
        setRun(undefined)
        if (!explicit && isIncomplete(message)) setStatus('Continue writing…')
        else {
          setError(message)
          setStatus('Query needs attention')
        }
      } finally {
        if (version === revision.current && alive.current) {
          busyRef.current = false
          setBusy(false)
        }
      }
    },
    [client, exercise.id, query, ready],
  )

  useEffect(() => {
    if (!preferences.live || !ready || busy) return
    const timer = setTimeout(() => {
      void execute(false)
    }, 550)
    return () => clearTimeout(timer)
    // Busy is intentionally excluded: finishing a run must not schedule another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execute, preferences.live, ready])

  const changeQuery = (value: string) => {
    revision.current++
    patchProgress({ query: value })
    setValidation(undefined)
    setRun(undefined)
    setError('')
    setStatus('Edited')
    if (busyRef.current) {
      client.stop()
      busyRef.current = false
      setBusy(false)
    }
  }
  const check = async () => {
    if (!ready || busyRef.current) return
    const version = revision.current
    busyRef.current = true
    setBusy(true)
    setError('')
    setValidation(undefined)
    setStatus('Checking both datasets…')
    patchProgress({ attempts: progress.attempts + 1 })
    try {
      const preview = await client.request<RunResult>({
        action: 'run',
        exerciseId: exercise.id,
        query,
      })
      if (version !== revision.current) return
      setRun(preview)
      const result = await client.request<Validation>({
        action: 'validate',
        exerciseId: exercise.id,
        query,
      })
      if (version !== revision.current) return
      setValidation(result)
      setStatus(result.correct ? 'Answer verified' : 'Review your result')
      if (result.correct) patchProgress({ solved: true })
    } catch (e) {
      if (version === revision.current) {
        setError((e as Error).message)
        setStatus('Could not validate')
      }
    } finally {
      if (version === revision.current && alive.current) {
        busyRef.current = false
        setBusy(false)
      }
    }
  }
  const inspectTable = async (name: string) =>
    client.request<RunResult>({
      action: 'table',
      exerciseId: exercise.id,
      query: `SELECT * FROM "${name.replaceAll('"', '""')}"`,
    })
  return {
    preferences,
    setPreferences,
    exercise,
    progress,
    query,
    changeQuery,
    tables,
    run,
    validation,
    error,
    status,
    busy,
    ready,
    storageOk,
    execute,
    check,
    inspectTable,
    resetDatabase: () => setResetVersion((v) => v + 1),
    resetQuery: () => changeQuery(exercise.starter),
    revealHint: () => patchProgress({ hints: Math.min(progress.hints + 1, exercise.hints.length) }),
    stop: () => client.stop(),
  }
}
