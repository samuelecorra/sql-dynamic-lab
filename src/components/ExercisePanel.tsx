import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  KeyRound,
  Lightbulb,
  Link2,
  RotateCcw,
  Table2,
} from 'lucide-react'
import { useState } from 'react'
import type { Exercise, Progress, TableInfo } from '../types'
interface Props {
  exercise: Exercise
  progress: Progress
  tables: TableInfo[]
  onHint: () => void
  onSolution: () => void
  onTable: (name: string) => void
  onReset: () => void
}
export function ExercisePanel({
  exercise,
  progress,
  tables,
  onHint,
  onSolution,
  onTable,
  onReset,
}: Props) {
  const [expanded, setExpanded] = useState('CLIENTE')
  return (
    <aside className="sidebar">
      <section className="exercise-panel">
        <div className="section-eyebrow">
          <BookOpen size={14} /> YOUR CHALLENGE{' '}
          <span className="difficulty">{exercise.difficulty}</span>
        </div>
        <h2>{exercise.title}</h2>
        <p className="statement" lang="it">
          {exercise.statement}
        </p>
        <div className="tags">
          {exercise.tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        <div className="output-contract">
          <span>RETURN</span>
          <code>{exercise.outputColumns.join(' · ')}</code>
        </div>
        <details className="rules">
          <summary>
            Assumptions & constraints <ChevronDown size={14} />
          </summary>
          <ul>
            {exercise.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </details>
        <div className="hint-box">
          <div>
            <Lightbulb size={16} />
            <strong>A little direction?</strong>
            <span>
              {progress.hints}/{exercise.hints.length}
            </span>
          </div>
          {exercise.hints.slice(0, progress.hints).map((hint, i) => (
            <p key={hint}>
              <b>{i + 1}.</b> {hint}
            </p>
          ))}
          <button
            className="hint-button"
            onClick={onHint}
            disabled={progress.hints >= exercise.hints.length}
          >
            {progress.hints ? 'Reveal next hint' : 'Reveal a hint'} <ChevronRight size={14} />
          </button>
        </div>
        <button className="text-button solution-link" onClick={onSolution}>
          Show solution & explanation <ChevronRight size={13} />
        </button>
      </section>
      <section className="explorer-panel">
        <div className="section-eyebrow">
          <Table2 size={14} /> DATABASE EXPLORER{' '}
          <span className="count-badge">{tables.length}</span>
        </div>
        <p className="muted explorer-caption">Explore the data behind the question.</p>
        <div className="table-list">
          {tables.map((table) => (
            <div className="schema-table" key={table.name}>
              <div className="table-heading">
                <button
                  className="table-expand"
                  onClick={() => setExpanded(expanded === table.name ? '' : table.name)}
                  aria-expanded={expanded === table.name}
                >
                  {expanded === table.name ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <Table2 size={14} />
                  <strong>{table.name}</strong>
                </button>
                <button
                  className="row-count"
                  onClick={() => onTable(table.name)}
                  aria-label={`Inspect ${table.name} rows`}
                >
                  {table.count} rows ↗
                </button>
              </div>
              {expanded === table.name && (
                <div className="columns">
                  {table.columns.map((c) => (
                    <div className="schema-column" key={c.name}>
                      <span
                        className={`key-icon ${c.pk ? 'primary' : ''}`}
                        title={c.pk ? 'Primary key' : c.fk ? `Foreign key → ${c.fk}` : ''}
                      >
                        {c.pk ? (
                          <KeyRound size={12} />
                        ) : c.fk ? (
                          <Link2 size={12} />
                        ) : (
                          <span>·</span>
                        )}
                      </span>
                      <span>
                        {c.name}
                        {c.fk && <small> → {c.fk}</small>}
                      </span>
                      <code>{c.type}</code>
                    </div>
                  ))}
                  <button className="inspect-button" onClick={() => onTable(table.name)}>
                    Inspect table data <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="schema-legend">
          <span>
            <KeyRound size={11} /> Primary key
          </span>
          <span>
            <Link2 size={11} /> Foreign key
          </span>
        </div>
        <button className="reset-db" onClick={onReset}>
          <RotateCcw size={13} /> Reset database
        </button>
      </section>
    </aside>
  )
}
