import { MonacoBinding } from 'y-monaco'
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness'
import * as Y from 'yjs'
import type * as monaco from 'monaco-editor'
import { type PresenceUser, getPresentUsers } from './awareness'
import { MESSAGE_AWARENESS, MESSAGE_SYNC, frameMessage } from './messageFraming'
import { colorForUser, ensureRemoteCursorStyle } from './remoteCursors'

// Tags updates we applied *from* the server so the doc's/awareness' own
// 'update' event handlers can tell them apart from local (Monaco) changes
// and avoid echoing them straight back out — the classic
// Monaco -> Y.Text -> Monaco -> ... loop.
const REMOTE_ORIGIN = Symbol('remote-update')

// Cursor moves fire far more often than a person actually reads them —
// coalescing outgoing awareness updates to this interval keeps the socket
// from being flooded during fast typing/scrolling without making remote
// cursors feel laggy. Document sync updates are never throttled.
const AWARENESS_THROTTLE_MS = 80

export type CollabTransport = {
  sendBinary: (data: Uint8Array) => void
  subscribeBinary: (listener: (data: Uint8Array) => void) => () => void
}

export type CollabUser = {
  id: string
  name: string
}

// One Y.Doc bound to exactly one collaboratively-open file: owns the Yjs
// document, its Awareness instance (cursor/selection presence), the Monaco
// <-> Y.Text/Awareness binding, and the outgoing/incoming halves of the
// WebSocket bridge. Framework-agnostic — React lifecycle is handled by
// YjsManager and the hook that wraps it.
export class CollaborativeDocument {
  readonly doc: Y.Doc
  readonly ytext: Y.Text
  readonly awareness: Awareness
  readonly projectId: string
  readonly fileId: string

  private readonly transport: CollabTransport
  private readonly onSynced: () => void
  private binding: MonacoBinding | null = null
  private readonly unsubscribeBinary: () => void
  private destroyed = false

  private readonly presenceListeners = new Set<(users: PresenceUser[]) => void>()
  private pendingAwarenessIds = new Set<number>()
  private pendingAwarenessTimer: ReturnType<typeof setTimeout> | null = null
  private lastAwarenessSendAt = 0

  constructor(transport: CollabTransport, projectId: string, fileId: string, user: CollabUser, onSynced: () => void) {
    this.transport = transport
    this.projectId = projectId
    this.fileId = fileId
    this.onSynced = onSynced

    this.doc = new Y.Doc()
    this.ytext = this.doc.getText('content')
    this.doc.on('update', this.handleLocalDocUpdate)

    this.awareness = new Awareness(this.doc)
    // Attach listeners before publishing our own identity, so opening the
    // file immediately broadcasts presence — it must not depend on the user
    // happening to move their cursor first.
    this.awareness.on('update', this.handleLocalAwarenessUpdate)
    this.awareness.on('change', this.handleAwarenessChange)
    this.awareness.setLocalStateField('user', { id: user.id, name: user.name, color: colorForUser(user.id) })

    this.unsubscribeBinary = transport.subscribeBinary(this.handleBinaryMessage)
  }

  private handleBinaryMessage = (data: Uint8Array): void => {
    const type = data[0]
    const payload = data.subarray(1)
    if (type === MESSAGE_SYNC) {
      Y.applyUpdate(this.doc, payload, REMOTE_ORIGIN)
      this.onSynced()
    } else if (type === MESSAGE_AWARENESS) {
      applyAwarenessUpdate(this.awareness, payload, REMOTE_ORIGIN)
    }
  }

  private handleLocalDocUpdate = (update: Uint8Array, origin: unknown): void => {
    // Document edits are never throttled — only cursor/selection awareness is.
    if (origin === REMOTE_ORIGIN) return
    this.transport.sendBinary(frameMessage(MESSAGE_SYNC, update))
  }

  private handleLocalAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    if (origin === REMOTE_ORIGIN) return
    const changedIds = [...changes.added, ...changes.updated, ...changes.removed]
    if (changedIds.length === 0) return

    for (const id of changedIds) this.pendingAwarenessIds.add(id)

    // A departure (someone's cursor going away) should feel instant, not
    // sit in the throttle queue behind a debounced cursor-move flush.
    if (changes.removed.length > 0) {
      this.flushAwarenessUpdate()
      return
    }

    const elapsed = Date.now() - this.lastAwarenessSendAt
    if (elapsed >= AWARENESS_THROTTLE_MS) {
      this.flushAwarenessUpdate()
    } else if (this.pendingAwarenessTimer === null) {
      this.pendingAwarenessTimer = setTimeout(() => this.flushAwarenessUpdate(), AWARENESS_THROTTLE_MS - elapsed)
    }
  }

  private flushAwarenessUpdate(): void {
    if (this.pendingAwarenessTimer !== null) {
      clearTimeout(this.pendingAwarenessTimer)
      this.pendingAwarenessTimer = null
    }
    if (this.pendingAwarenessIds.size === 0) return

    const ids = Array.from(this.pendingAwarenessIds)
    this.pendingAwarenessIds.clear()
    this.lastAwarenessSendAt = Date.now()

    const update = encodeAwarenessUpdate(this.awareness, ids)
    this.transport.sendBinary(frameMessage(MESSAGE_AWARENESS, update))
  }

  private handleAwarenessChange = (): void => {
    for (const [clientId, state] of this.awareness.getStates()) {
      if (clientId === this.doc.clientID) continue
      const color = state?.user?.color
      const name = state?.user?.name
      if (typeof color === 'string' && typeof name === 'string') {
        ensureRemoteCursorStyle(clientId, color, name)
      }
    }

    const users = getPresentUsers(this.awareness)
    for (const listener of this.presenceListeners) listener(users)
  }

  // Subscribes to the live list of everyone present on this document
  // (including the local user), invoking immediately with the current list.
  onPresenceChange(listener: (users: PresenceUser[]) => void): () => void {
    this.presenceListeners.add(listener)
    listener(getPresentUsers(this.awareness))
    return () => this.presenceListeners.delete(listener)
  }

  // Re-broadcasts our current local awareness state. Needed because the
  // very first broadcast (sent from the constructor) can be silently
  // dropped if the shared WebSocket wasn't open yet at that exact moment —
  // and because a reconnect doesn't recreate this document, so nothing else
  // would tell the fresh connection who we are. Called once the caller
  // knows the connection is actually up (see useCollaborativeDocument).
  republishLocalState(): void {
    const current = this.awareness.getLocalState()
    if (current) {
      this.awareness.setLocalState(current)
    }
  }

  bindMonaco(editor: monaco.editor.IStandaloneCodeEditor): void {
    const model = editor.getModel()
    if (!model || this.destroyed) return
    this.binding = new MonacoBinding(this.ytext, model, new Set([editor]), this.awareness)
  }

  getContent(): string {
    return this.ytext.toString()
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.binding?.destroy()
    this.binding = null
    this.unsubscribeBinary()
    this.doc.off('update', this.handleLocalDocUpdate)

    // Drop any pending throttled cursor-move send (stale by now), but keep
    // the awareness 'update' listener attached one moment longer so the
    // setLocalState(null) below can flush an immediate "I'm leaving" signal
    // instead of it being silently dropped.
    if (this.pendingAwarenessTimer !== null) {
      clearTimeout(this.pendingAwarenessTimer)
      this.pendingAwarenessTimer = null
    }
    this.pendingAwarenessIds.clear()
    this.awareness.setLocalState(null)

    this.awareness.off('update', this.handleLocalAwarenessUpdate)
    this.awareness.off('change', this.handleAwarenessChange)
    this.presenceListeners.clear()
    // Stops the awareness instance's internal 30s staleness-check timer.
    this.awareness.destroy()
    this.doc.destroy()
  }
}
