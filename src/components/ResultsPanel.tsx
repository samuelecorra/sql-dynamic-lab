import { useState } from 'react'
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleHelp,
  FlaskConical,
  Layers,
  Table2,
  TriangleAlert,
} from 'lucide-react'
import type { Exercise, RunResult, Validation } from '../types'
import type { ExamWarning } from '../features/exam-mode/lint'
import { DataGrid } from './DataGrid'
interface Props {
  run?: RunResult
  validation?: Validation
  error: string
  tab: string
  setTab: (tab: string) => void
  warnings: ExamWarning[]
  exam: boolean
  exercise: Exercise
}
export function ResultsPanel({
  run,
  validation,
  error,
  tab,
  setTab,
  warnings,
  exam,
  exercise,
}: Props) {
  const [stageId, setStageId] = useState('from'),
    [showDiff, setShowDiff] = useState(false)
  const stage = run?.xray.stages.find((s) => s.id === stageId) ?? run?.xray.stages[0]
  return (
    <section className="results-panel">
      <div className="results-tabs" role="tablist" aria-label="Query output">
        {[
          ['result', 'Final result', Table2],
          ['xray', 'Query X-Ray', Layers],
          ['validation', 'Validation', CheckCircle2],
        ].map(([id, label, Icon]) => {
          const TabIcon = Icon as typeof Table2
          return (
            <button
              key={String(id)}
              id={`tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls="result-content"
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(String(id))}
            >
              <TabIcon size={15} />
              {String(label)}
              {id === 'xray' && <span className="tiny-badge">LAB</span>}
              {id === 'validation' && validation?.correct && (
                <Check size={12} className="success-text" />
              )}
            </button>
          )
        })}
        <span className="result-timing">
          {run ? `${run.milliseconds.toFixed(1)} ms` : 'SQLite · WASM'}
        </span>
      </div>
      <div
        className="result-content"
        id="result-content"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {error && (
          <div className="notice error" role="alert">
            <TriangleAlert size={16} />
            <span>{error}</span>
          </div>
        )}
        {tab === 'result' &&
          (run ? (
            <>
              <div className="result-summary">
                <span className="success-dot" />
                <strong>
                  {run.result.rows.length}
                  {run.result.truncated ? '+' : ''} rows
                </strong>
                <span>{run.result.columns.length} columns</span>
                <span className="summary-right">Local execution</span>
              </div>
              <DataGrid data={run.result} />
            </>
          ) : (
            <div className="empty-state">
              <Table2 size={30} />
              <h3>Your result appears here</h3>
              <p>Write a query or press Run to explore the dataset.</p>
            </div>
          ))}
        {tab === 'xray' &&
          (run ? (
            <>
              <div className="xray-intro">
                <Activity size={16} />
                <div>
                  <strong>Follow the data, one stage at a time.</strong>
                  <span>The logical query pipeline, not SQLite’s physical execution plan.</span>
                </div>
              </div>
              {run.xray.unavailable ? (
                <div className="notice neutral">
                  <CircleHelp size={18} />
                  <span>{run.xray.unavailable}</span>
                </div>
              ) : (
                <>
                  <div className="pipeline">
                    {run.xray.stages.map((s, i) => (
                      <div className="pipeline-item" key={s.id}>
                        <button
                          className={stage?.id === s.id ? 'selected' : ''}
                          onClick={() => setStageId(s.id)}
                        >
                          <span className="stage-number">0{i + 1}</span>
                          <strong>{s.label}</strong>
                          <span className="stage-count">
                            {s.result.rows.length}
                            {s.result.truncated ? '+' : ''} {s.unit}
                          </span>
                        </button>
                        {i < run.xray.stages.length - 1 && (
                          <ArrowRight size={15} className="pipeline-arrow" />
                        )}
                      </div>
                    ))}
                  </div>
                  {stage && (
                    <>
                      <div className="stage-note">
                        <span className="stage-label">{stage.label}</span>
                        {stage.note}
                      </div>
                      <DataGrid data={stage.result} />
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="empty-state">
              <Layers size={30} />
              <h3>Make the invisible steps visible</h3>
              <p>Run a SELECT query to trace rows through its clauses.</p>
            </div>
          ))}
        {tab === 'validation' && (
          <div className="validation-content">
            {validation ? (
              <>
                <div className={`verdict ${validation.correct ? 'correct' : 'incorrect'}`}>
                  {validation.correct ? <CheckCircle2 size={23} /> : <TriangleAlert size={23} />}
                  <div>
                    <h3>
                      {validation.correct
                        ? 'Semantically correct'
                        : 'The result needs another look'}
                    </h3>
                    <p>{validation.message}</p>
                    {validation.failedDataset && (
                      <small>
                        Mismatch on dataset {validation.failedDataset} of {validation.datasets}
                        {validation.failedDataset > 1
                          ? ' — an additional boundary-case dataset, with different customer identities and order counts.'
                          : ' — the visible exercise data.'}
                      </small>
                    )}
                  </div>
                </div>
                {!validation.correct && (
                  <>
                    <button className="secondary" onClick={() => setShowDiff(!showDiff)}>
                      {showDiff ? 'Hide result differences' : 'Show result differences'}
                    </button>
                    {showDiff && (
                      <div className="diff-grid">
                        <section>
                          <h4>
                            Expected but missing <span>{validation.missing.length}</span>
                          </h4>
                          <DataGrid
                            data={{ columns: exercise.outputColumns, rows: validation.missing }}
                            empty="No missing rows."
                          />
                        </section>
                        <section>
                          <h4>
                            Unexpected <span>{validation.extra.length}</span>
                          </h4>
                          <DataGrid
                            data={{
                              columns:
                                validation.extra[0]?.map(
                                  (_, i) => exercise.outputColumns[i] ?? `Column ${i + 1}`,
                                ) ?? exercise.outputColumns,
                              rows: validation.extra,
                            }}
                            empty="No unexpected rows."
                          />
                        </section>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <div className="empty-state small">
                <FlaskConical size={30} />
                <h3>Ready to check your reasoning?</h3>
                <p>
                  Check answer compares values and duplicates on two deliberate datasets.
                  <br />
                  Column aliases may differ; column positions must match the question.
                </p>
              </div>
            )}
            <div className="exam-feedback">
              <h4>
                EXAM STYLE <span>{exam ? 'SAMARATI' : 'OFF'}</span>
              </h4>
              {exam ? (
                warnings.length ? (
                  warnings.map((w) => (
                    <div className="exam-warning" key={w.code}>
                      <TriangleAlert size={15} />
                      <span>{w.message}</span>
                    </div>
                  ))
                ) : (
                  <p className="success-text">No style warnings detected.</p>
                )
              ) : (
                <p className="muted">
                  Enable Exam Mode to check course conventions separately from correctness.
                </p>
              )}
              <p className="muted small-text">Style warnings never change the semantic verdict.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
