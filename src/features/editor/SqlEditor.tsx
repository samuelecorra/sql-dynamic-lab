import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor/editor/editor.api.js'
import 'monaco-editor/languages/definitions/sql/register.js'
import 'monaco-editor/editor/contrib/find/browser/findController.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'

;(self as typeof self & { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
}
monaco.editor.defineTheme('lab-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'keyword', foreground: 'B7A0F6' },
    { token: 'string', foreground: 'A8CE92' },
    { token: 'comment', foreground: '657389' },
    { token: 'number', foreground: 'E9B881' },
  ],
  colors: {
    'editor.background': '#111720',
    'editorLineNumber.foreground': '#465267',
    'editorLineNumber.activeForeground': '#B7C6DB',
    'editor.lineHighlightBackground': '#19212d',
    'editor.selectionBackground': '#334064',
  },
})

interface Props {
  value: string
  onChange: (value: string) => void
  onRun: () => void
  theme: 'dark' | 'light'
  ready: boolean
  error: string
}
export function SqlEditor({ value, onChange, onRun, theme, ready, error }: Props) {
  const container = useRef<HTMLDivElement>(null),
    editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const callbacks = useRef({ onChange, onRun })
  const settingValue = useRef(false)
  useEffect(() => {
    callbacks.current = { onChange, onRun }
  }, [onChange, onRun])
  useEffect(() => {
    const instance = monaco.editor.create(container.current!, {
      value: '',
      language: 'sql',
      theme: 'lab-dark',
      automaticLayout: true,
      fontSize: 14,
      lineHeight: 25,
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      minimap: { enabled: false },
      padding: { top: 22, bottom: 16 },
      scrollBeyondLastLine: false,
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      folding: false,
      lineNumbersMinChars: 3,
      wordWrap: 'on',
      tabSize: 2,
      ariaLabel: 'SQL query editor',
      fixedOverflowWidgets: true,
    })
    editor.current = instance
    const change = instance.onDidChangeModelContent(() => {
      if (!settingValue.current) callbacks.current.onChange(instance.getValue())
    })
    instance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
      callbacks.current.onRun(),
    )
    return () => {
      change.dispose()
      instance.getModel()?.dispose()
      instance.dispose()
      editor.current = null
    }
  }, [])
  useEffect(() => {
    if (editor.current && editor.current.getValue() !== value) {
      settingValue.current = true
      editor.current.setValue(value)
      settingValue.current = false
    }
  }, [value])
  useEffect(() => {
    monaco.editor.setTheme(theme === 'dark' ? 'lab-dark' : 'vs')
  }, [theme])
  useEffect(() => {
    editor.current?.updateOptions({ readOnly: !ready })
  }, [ready])
  useEffect(() => {
    const model = editor.current?.getModel()
    if (model)
      monaco.editor.setModelMarkers(
        model,
        'sqlite',
        error
          ? [
              {
                message: error,
                severity: monaco.MarkerSeverity.Error,
                startLineNumber: 1,
                startColumn: 1,
                endLineNumber: 1,
                endColumn: Math.max(2, model.getLineMaxColumn(1)),
              },
            ]
          : [],
      )
  }, [error])
  return <div ref={container} className="monaco-host" data-testid="sql-editor" />
}
