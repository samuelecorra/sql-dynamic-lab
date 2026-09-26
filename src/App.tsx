import { lazy, Suspense, useState } from 'react'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Code2,
  Database,
  FlaskConical,
  GraduationCap,
  LoaderCircle,
  Moon,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Sun,
  Terminal,
} from 'lucide-react'
import { exercises } from './exercises'
import { useLab } from './hooks/useLab'
import { ExercisePanel } from './components/ExercisePanel'
import { ResultsPanel } from './components/ResultsPanel'
import { Modal } from './components/Modal'
import { DataGrid } from './components/DataGrid'
import { lintExam } from './features/exam-mode/lint'
import type { ResultSet } from './types'
import './styles/app.css'

const SqlEditor = lazy(() =>
  import('./features/editor/SqlEditor').then((m) => ({ default: m.SqlEditor })),
)
function App() {
  const lab = useLab(),
    [tab, setTab] = useState('xray'),
    [solution, setSolution] = useState(false)
  const [table, setTable] = useState<{ name: string; data?: ResultSet; error?: string }>()
  const [about, setAbout] = useState(false)
  const solved = Object.values(lab.preferences.progress).filter((p) => p.solved).length
  const warnings = lintExam(lab.query, lab.exercise.noCte)
  const showTable = async (name: string) => {
    setTable({ name })
    try {
      const result = await lab.inspectTable(name)
      setTable((current) => (current?.name === name ? { name, data: result.result } : current))
    } catch (e) {
      setTable((current) =>
        current?.name === name ? { name, error: (e as Error).message } : current,
      )
    }
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault()
            setAbout(true)
          }}
        >
          <span className="brand-icon">
            <Terminal size={21} />
          </span>
          <span>
            SQL Dynamic Lab<span className="brand-version"> / WORKSPACE</span>
          </span>
        </a>
        <div className="top-actions">
          <span className="local-badge">
            <span className="success-dot" /> LOCAL ENGINE
          </span>
          <span className="top-separator" />
          <button
            className={`exam-toggle ${lab.preferences.exam ? 'enabled' : ''}`}
            aria-pressed={lab.preferences.exam}
            onClick={() => lab.setPreferences((p) => ({ ...p, exam: !p.exam }))}
          >
            <GraduationCap size={17} />
            <span>
              Exam Mode <span className="exam-name">— Samarati</span>
            </span>
            <span className="switch">
              <span />
            </span>
          </button>
          <button
            className="icon-button"
            title="Switch color theme"
            aria-label="Switch color theme"
            onClick={() =>
              lab.setPreferences((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))
            }
          >
            {lab.preferences.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <div className="breadcrumb">DATABASES / PRACTICE LAB</div>
          <h1>
            See what your query actually does<span>.</span>
          </h1>
        </div>
        <div className="course-progress">
          <div className="progress-dots">
            {exercises.map((e) => (
              <span key={e.id} className={lab.preferences.progress[e.id]?.solved ? 'done' : ''}>
                {lab.preferences.progress[e.id]?.solved ? <Check size={11} /> : <Circle size={5} />}
              </span>
            ))}
          </div>
          <span>
            <b>{solved}</b> of 3 completed
          </span>
        </div>
      </div>
      <nav className="exercise-nav" aria-label="Choose exercise">
        {exercises.map((exercise, i) => (
          <button
            className={exercise.id === lab.exercise.id ? 'active' : ''}
            key={exercise.id}
            onClick={() => {
              lab.setPreferences((p) => ({ ...p, selected: exercise.id }))
              setSolution(false)
              setTable(undefined)
            }}
          >
            <span className="exercise-number">
              {lab.preferences.progress[exercise.id]?.solved ? (
                <CheckCircle2 size={16} />
              ) : (
                `0${i + 1}`
              )}
            </span>
            <div>
              <strong>{exercise.title}</strong>
              <span>{exercise.subtitle}</span>
            </div>
            <ArrowRight size={16} className="exercise-arrow" />
          </button>
        ))}
      </nav>
      <main className="lab-layout">
        <ExercisePanel
          key={lab.exercise.id}
          exercise={lab.exercise}
          progress={lab.progress}
          tables={lab.tables}
          onHint={lab.revealHint}
          onSolution={() => setSolution(true)}
          onTable={(name) => void showTable(name)}
          onReset={lab.resetDatabase}
        />
        <div className="workbench">
          <section className="editor-panel">
            <div className="editor-toolbar">
              <div className="file-tab">
                <Code2 size={16} />
                <span>query.sql</span>
                <span className="file-dot" />
              </div>
              <div className="editor-controls">
                <label className="live-control">
                  <input
                    type="checkbox"
                    checked={lab.preferences.live}
                    onChange={(e) => lab.setPreferences((p) => ({ ...p, live: e.target.checked }))}
                  />
                  <span className={lab.preferences.live ? 'success-dot' : 'inactive-dot'} /> Live
                </label>
                <button className="text-button" onClick={lab.resetQuery}>
                  <RotateCcw size={13} /> Reset query
                </button>
                <span className="toolbar-separator" />
                <button
                  className="run-button"
                  disabled={!lab.ready || lab.busy}
                  onClick={() => void lab.execute()}
                >
                  <Play size={13} fill="currentColor" /> Run <kbd>Ctrl ↵</kbd>
                </button>
                {lab.busy && (
                  <button className="icon-button" onClick={lab.stop} aria-label="Stop query">
                    <Square size={14} />
                  </button>
                )}
              </div>
            </div>
            <Suspense
              fallback={
                <div className="editor-loading">
                  <LoaderCircle className="spin" /> Loading SQL editor…
                </div>
              }
            >
              <SqlEditor
                value={lab.query}
                onChange={lab.changeQuery}
                onRun={() => void lab.execute()}
                ready={lab.ready}
                theme={lab.preferences.theme}
                error={lab.error}
              />
            </Suspense>
            <div className="editor-status">
              <span>
                <Database size={12} /> SQLite <span className="muted">/</span> exercise.db
              </span>
              <span>
                SQL <ChevronDown size={11} /> UTF-8 <span className="muted">|</span>{' '}
                {lab.query.split('\n').length} lines
              </span>
            </div>
          </section>
          <div className="run-feedback">
            <span role="status">
              {lab.busy ? (
                <LoaderCircle size={14} className="spin" />
              ) : lab.error ? (
                <span className="error-dot" />
              ) : (
                <span className="success-dot" />
              )}
              {lab.status}
            </span>
            <div>
              <span className="attempts">{lab.progress.attempts} attempts</span>
              <button
                className="check-button"
                disabled={!lab.ready || lab.busy}
                onClick={() => {
                  setTab('validation')
                  void lab.check()
                }}
              >
                <FlaskConical size={15} /> Check answer <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <ResultsPanel
            key={lab.exercise.id}
            run={lab.run}
            validation={lab.validation}
            error={lab.error}
            tab={tab}
            setTab={setTab}
            warnings={warnings}
            exam={lab.preferences.exam}
            exercise={lab.exercise}
          />
        </div>
      </main>
      <footer className="footer">
        <span>
          <ShieldCheck size={13} /> Runs on your device. Your queries stay here.
        </span>
        <span>
          {lab.storageOk
            ? 'Progress saved locally'
            : 'Local storage unavailable — progress is not saved'}
          <span className="footer-dot">·</span>
          <button onClick={() => setAbout(true)}>About this lab</button>
        </span>
      </footer>
      {solution && (
        <Modal title="Solution & reasoning" onClose={() => setSolution(false)}>
          <div className="notice neutral">
            Revealing a solution does not mark the exercise as solved.
          </div>
          <h3>Canonical solution</h3>
          <pre>{lab.exercise.reference}</pre>
          <p>{lab.exercise.explanation}</p>
          {lab.exercise.alternative && (
            <>
              <h3>Equivalent alternative</h3>
              <pre>{lab.exercise.alternative}</pre>
              <p className="muted">
                Both approaches are graded by their results. Exam conventions are checked
                separately.
              </p>
            </>
          )}
          <button
            className="secondary"
            onClick={() => {
              lab.changeQuery(lab.exercise.reference)
              setSolution(false)
            }}
          >
            Load canonical query into editor
          </button>
        </Modal>
      )}
      {table && (
        <Modal title={`Table · ${table.name}`} onClose={() => setTable(undefined)}>
          {table.data ? (
            <>
              <p className="muted">
                {table.data.rows.length} rows · NULL means no value is recorded.
              </p>
              <DataGrid data={table.data} />
            </>
          ) : (
            <p>{table.error ?? 'Loading table…'}</p>
          )}
        </Modal>
      )}
      {about && (
        <Modal title="SQL Dynamic Lab" onClose={() => setAbout(false)}>
          <p>
            A local-first SQL laboratory for database exam practice. Write a query, watch its
            logical stages, and check your reasoning against deliberate boundary cases.
          </p>
          <h3>Keyboard & workflow</h3>
          <p>
            Ctrl+Enter (⌘+Enter on macOS) runs the query. Live execution waits 550 ms after typing.
            Check answer grades on two datasets. The editor’s lower edge can be dragged to resize
            it.
          </p>
          <h3>How grading works</h3>
          <p>
            SQLite executes your SELECT and the reference on fresh datasets. Values, column
            positions and duplicate counts must match; aliases and row order can differ. Passing
            finite datasets is evidence of correctness, not a proof for every possible database.
          </p>
          <h3>Private by design</h3>
          <p>
            No account, backend, analytics, AI service or remote database. Monaco and SQLite WASM
            are served by this app. Progress is stored in this browser.
          </p>
        </Modal>
      )}
    </div>
  )
}
export default App
