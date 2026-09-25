import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { getToken } from '../auth/tokenStore'
import { WebSocketService } from '../services/websocketService'
import type { ClientMessage, ConnectionState, ServerMessage } from '../types/websocket'

type SocketContextValue = {
  connectionState: ConnectionState
  send: (message: ClientMessage) => void
  sendBinary: (data: Uint8Array) => void
  subscribe: (listener: (message: ServerMessage) => void) => () => void
  subscribeBinary: (listener: (data: Uint8Array) => void) => () => void
}

const SocketContext = createContext<SocketContextValue | null>(null)

// One WebSocket connection for the whole authenticated session, shared by
// every component that needs it (the project editor's room, app-wide
// notifications like incoming access requests, and Yjs document sync — see
// collaboration/CollaborativeDocument.ts for the binary channel's consumer).
// The service instance is created once via useState's lazy initializer, so
// its identity is stable and available from the very first render.
export function SocketProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [service] = useState(() => new WebSocketService(getToken))

  useEffect(() => {
    const unsubscribe = service.onStateChange(setConnectionState)
    return () => {
      unsubscribe()
      service.disconnect()
    }
  }, [service])

  useEffect(() => {
    if (status === 'authenticated') {
      service.connect()
    } else {
      service.disconnect()
    }
  }, [service, status])

  const send = useCallback(
    (message: ClientMessage) => {
      service.send(message)
    },
    [service],
  )

  const sendBinary = useCallback(
    (data: Uint8Array) => {
      service.sendBinary(data)
    },
    [service],
  )

  const subscribe = useCallback(
    (listener: (message: ServerMessage) => void) => {
      return service.onMessage(listener)
    },
    [service],
  )

  const subscribeBinary = useCallback(
    (listener: (data: Uint8Array) => void) => {
      return service.onBinaryMessage(listener)
    },
    [service],
  )

  return (
    <SocketContext.Provider value={{ connectionState, send, sendBinary, subscribe, subscribeBinary }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketContextValue {
  const ctx = useContext(SocketContext)
  if (!ctx) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return ctx
}
