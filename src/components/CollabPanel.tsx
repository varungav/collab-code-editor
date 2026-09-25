import { useState, type FormEvent } from 'react'
import type { CollabLogEntry } from '../hooks/useProjectSocket'
import type { ConnectionState } from '../types/websocket'

type CollabPanelProps = {
  projectId: string
  connectionState: ConnectionState
  messages: CollabLogEntry[]
  onSendTestMessage: (text: string) => void
}

const STATE_LABEL: Record<ConnectionState, string> = {
  connected: '🟢 Connected',
  connecting: '🟡 Connecting…',
  disconnected: '🔴 Disconnected',
}

// Temporary debug panel for verifying the WebSocket room/broadcast
// infrastructure (Phase 6). Not meant to survive into the real collaboration UI.
function CollabPanel({ projectId, connectionState, messages, onSendTestMessage }: CollabPanelProps) {
  const [draft, setDraft] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft.trim()) return
    onSendTestMessage(draft)
    setDraft('')
  }

  return (
    <div className="collab-panel">
      <div className="collab-panel__header">Live Collaboration (Debug)</div>
      <div className="collab-panel__status">
        <span>Connection: {STATE_LABEL[connectionState]}</span>
        <span className="collab-panel__project-id">Project: {projectId.slice(0, 8)}</span>
      </div>

      <div className="collab-panel__messages">
        {messages.length === 0 && <p className="collab-panel__empty">No messages yet.</p>}
        {messages.map((entry) => (
          <div
            key={entry.id}
            className={`collab-panel__message${entry.system ? ' collab-panel__message--system' : ''}`}
          >
            <span className="collab-panel__message-author">{entry.self ? 'You' : entry.userName}</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>

      <form className="collab-panel__composer" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Send a test message…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={connectionState !== 'connected'}
        />
        <button type="submit" disabled={connectionState !== 'connected' || !draft.trim()}>
          Send Test Message
        </button>
      </form>
    </div>
  )
}

export default CollabPanel
