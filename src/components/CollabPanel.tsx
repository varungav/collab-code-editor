import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { CollabLogEntry } from '../hooks/useProjectSocket'
import type { ConnectionState } from '../types/websocket'
import ShortcutsHelp from './ShortcutsHelp'

type CollabPanelProps = {
  projectId: string
  connectionState: ConnectionState
  messages: CollabLogEntry[]
  onSendTestMessage: (text: string) => void
}

const DOT_COLOR: Record<ConnectionState, string> = {
  connected: '#4ec94e',
  connecting: '#f0a500',
  disconnected: '#6a6a6a',
}

function CollabPanel({ connectionState, messages, onSendTestMessage }: CollabPanelProps) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const isConnected = connectionState === 'connected'

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !isConnected) return
    onSendTestMessage(text)
    setDraft('')
  }

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <span className="chat-panel__title">Chat</span>
        <div className="chat-panel__header-right">
          <span className="chat-panel__status">
            <span className="chat-panel__dot" style={{ background: DOT_COLOR[connectionState] }} />
            {connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting' : 'Offline'}
          </span>
          <ShortcutsHelp />
        </div>
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {messages.length === 0 && (
          <div className="chat-panel__empty">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                stroke="#3a3d41" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>No messages yet</span>
          </div>
        )}
        {messages.map((entry) =>
          entry.system ? (
            <div key={entry.id} className="chat-panel__system">{entry.message}</div>
          ) : (
            <div key={entry.id} className={`chat-panel__msg${entry.self ? ' chat-panel__msg--self' : ''}`}>
              {!entry.self && (
                <div className="chat-panel__bubble-name">{entry.userName}</div>
              )}
              <div className="chat-panel__bubble">{entry.message}</div>
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form className="chat-panel__composer" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-panel__input"
          placeholder={isConnected ? 'Message…' : 'Waiting for connection…'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={!isConnected}
        />
        <button
          type="submit"
          className="chat-panel__send"
          disabled={!isConnected || !draft.trim()}
          aria-label="Send"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M13 1L6 8M13 1L9 13l-3-5-5-3 12-4z"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </form>
    </div>
  )
}

export default CollabPanel
