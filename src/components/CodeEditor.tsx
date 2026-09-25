import Editor from '@monaco-editor/react'
import type { CollaborativeDocument } from '../collaboration/collaborativeDocument'
import type { SyncState } from '../types/websocket'

type CodeEditorProps = {
  language: string
  document: CollaborativeDocument | null
  syncState: SyncState
  readOnly: boolean
}

const SYNC_LABEL: Record<SyncState, string> = {
  synced: '🟢 Synced',
  connecting: '🟡 Connecting…',
  disconnected: '🔴 Disconnected',
}

// Uncontrolled by design: once a file is open, Yjs (via CollaborativeDocument
// bound in onMount) owns the Monaco model's content, not React. Keying by
// fileId forces a full remount on file switch, which is what guarantees the
// previous file's binding is fully torn down before the next one binds.
//
// `readOnly` is a UI convenience only — a VIEWER's document edits are
// rejected server-side (see backend yjsRoomManager) regardless of whether
// this prop is set correctly, so it can never be relied on for security.
function CodeEditor({ language, document, syncState, readOnly }: CodeEditorProps) {
  return (
    <div className="code-editor">
      <div className="code-editor__sync-badge">
        Collaborative: {SYNC_LABEL[syncState]}
        {readOnly && ' · 👁️ View Only'}
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
