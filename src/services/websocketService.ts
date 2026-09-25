import type { ClientMessage, ConnectionState, ServerMessage } from '../types/websocket'

function resolveWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL
  if (explicit) return explicit

  try {
    const apiUrl = new URL(import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api')
    const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${apiUrl.host}/ws`
  } catch {
    return 'ws://localhost:3000/ws'
  }
}

const WS_URL = resolveWsUrl()
const RECONNECT_BASE_DELAY_MS = 1000
const RECONNECT_MAX_DELAY_MS = 10000

type MessageListener = (message: ServerMessage) => void
type BinaryListener = (data: Uint8Array) => void
type StateListener = (state: ConnectionState) => void

// Low-level WebSocket transport: connect/disconnect/send/receive plus
// automatic reconnect with backoff. Knows nothing about projects, rooms, or
// UI — that lives in the hook/component layer that uses this service.
export class WebSocketService {
  private socket: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private messageListeners = new Set<MessageListener>()
  private binaryListeners = new Set<BinaryListener>()
  private stateListeners = new Set<StateListener>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private shouldReconnect = false
  private getToken: () => string | null

  constructor(getToken: () => string | null) {
    this.getToken = getToken
  }

  connect(): void {
    this.shouldReconnect = true
    this.openSocket()
  }

  disconnect(): void {
    this.shouldReconnect = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.socket?.close()
    this.socket = null
    this.setState('disconnected')
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message))
    }
  }

  // Yjs document updates travel as raw binary frames on this same
  // connection, outside the JSON ClientMessage/ServerMessage protocol.
  sendBinary(data: Uint8Array): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      // Cast: lib.dom's BufferSource excludes SharedArrayBuffer-backed views,
      // but Uint8Array's generic type doesn't distinguish — Yjs updates are
      // always plain ArrayBuffer-backed in practice.
      this.socket.send(data as BufferSource)
    }
  }

  onMessage(listener: MessageListener): () => void {
    this.messageListeners.add(listener)
    return () => this.messageListeners.delete(listener)
  }

  onBinaryMessage(listener: BinaryListener): () => void {
    this.binaryListeners.add(listener)
    return () => this.binaryListeners.delete(listener)
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.add(listener)
    return () => this.stateListeners.delete(listener)
  }

  getState(): ConnectionState {
    return this.state
  }

  private openSocket(): void {
    const token = this.getToken()
    if (!token) {
      this.setState('disconnected')
      return
    }

    this.setState('connecting')
    const socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    socket.onopen = () => {
      this.reconnectAttempts = 0
      this.setState('connected')
    }

    socket.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        const bytes = new Uint8Array(event.data as ArrayBuffer)
        for (const listener of this.binaryListeners) {
          listener(bytes)
        }
        return
      }

      try {
        const message = JSON.parse(event.data) as ServerMessage
        for (const listener of this.messageListeners) {
          listener(message)
        }
      } catch {
        // ignore malformed frames
      }
    }

    socket.onclose = () => {
      this.setState('disconnected')
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }

    socket.onerror = () => {
      // onclose always follows onerror for a browser WebSocket; reconnect is handled there.
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY_MS)
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      if (this.shouldReconnect) {
        this.openSocket()
      }
    }, delay)
  }

  private setState(state: ConnectionState): void {
    this.state = state
    for (const listener of this.stateListeners) {
      listener(state)
    }
  }
}
