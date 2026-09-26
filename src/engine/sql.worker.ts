import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import { getExercise } from '../exercises'
import { createDatabase, execute, inspect, validate } from './database'
import { deriveXRay } from '../features/query-xray/xray'
import type { Request, Response } from './protocol'
import type { Database } from 'sql.js'

const ready = initSqlJs({ locateFile: () => wasmUrl })
let db: Database | undefined, activeId: string | undefined
// Serialize messages, including the asynchronous WASM initialization.
let queue = Promise.resolve()
self.onmessage = (event: MessageEvent<Request>) => {
  queue = queue.then(async () => {
    const { id, action, exerciseId, query = '' } = event.data
    const response: Response = { id }
    try {
      const SQL = await ready,
        exercise = getExercise(exerciseId)
      if (!db || activeId !== exerciseId || action === 'init') {
        db?.close()
        db = createDatabase(SQL, exercise)
        activeId = exerciseId
      }
      if (action === 'init') response.data = inspect(db)
      else if (action === 'validate') response.data = validate(SQL, exercise, query)
      else {
        const start = performance.now(),
          result = execute(db, query)
        response.data = {
          result,
          xray:
            action === 'table'
              ? { stages: [] }
              : deriveXRay(query, (sql) => execute(db!, sql), result),
          milliseconds: performance.now() - start,
        }
      }
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error)
    }
    self.postMessage(response)
  })
}
