import Editor from '@monaco-editor/react'
import type { CollaborativeDocument } from '../collaboration/collaborativeDocument'
import type { SyncState } from '../types/websocket'

type CodeEditorProps = {
  language: string
  document: CollaborativeDocument | null
  syncState: SyncState
  readOnly: boolean
}

const SYNC_COLOR: Record<SyncState, string> = {
  synced: '#4ec94e',
  connecting: '#f0a500',
  disconnected: '#6a6a6a',
}

const SYNC_LABEL: Record<SyncState, string> = {
  synced: 'Synced',
  connecting: 'Connecting',
  disconnected: 'Offline',
}

function CodeEditor({ language, document, syncState, readOnly }: CodeEditorProps) {
  return (
    <div className="code-editor">
      <div className="code-editor__sync-badge">
        <span className="code-editor__sync-dot" style={{ background: SYNC_COLOR[syncState] }} />
        {SYNC_LABEL[syncState]}
        {readOnly && <span className="code-editor__readonly-tag">View only</span>}
      </div>
      <Editor
        key={document?.fileId ?? 'none'}
        height="100%"
        width="100%"
        language={language}
        theme="vs-dark"
        onMount={(editor) => document?.bindMonaco(editor)}
        options={{
          fontSize: 14,
          minimap: { enabled: true },
          lineNumbers: 'on',
          automaticLayout: true,
          scrollBeyondLastLine: false,
          readOnly,
        }}
      />
    </div>
  )
}

export default CodeEditor
