import type { Request, Response, ResponseData } from './protocol'

export class SqlClient {
  private worker?: Worker
  private nextId = 0
  private pending = new Map<
    number,
    {
      resolve: (data: ResponseData) => void
      reject: (error: Error) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private spawn() {
    if (this.worker) return
    this.worker = new Worker(new URL('./sql.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = ({ data }: MessageEvent<Response>) => {
      const entry = this.pending.get(data.id)
      if (!entry) return
      clearTimeout(entry.timer)
      this.pending.delete(data.id)
      if (data.error) entry.reject(new Error(data.error))
      else entry.resolve(data.data!)
    }
    this.worker.onerror = () =>
      this.stop('SQLite could not start. Reload the page or check the local server.')
  }
  request<T extends ResponseData>(request: Omit<Request, 'id'>): Promise<T> {
    this.spawn()
    const id = ++this.nextId
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          this.stop(
            'Query stopped after the time limit. Simplify joins or recursion, then run again. The database will reload automatically.',
          ),
        request.action === 'init' ? 15000 : 3000,
      )
      this.pending.set(id, { resolve: (data) => resolve(data as T), reject, timer })
      this.worker!.postMessage({ ...request, id })
    })
  }
  stop(message = 'Query cancelled.') {
    this.worker?.terminate()
    this.worker = undefined
    this.pending.forEach((entry) => {
      clearTimeout(entry.timer)
      entry.reject(new Error(message))
    })
    this.pending.clear()
  }
}
