import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useSocket } from '../realtime/SocketProvider'
import type { ConnectionState, ServerMessage } from '../types/websocket'

export type CollabLogEntry = {
  id: string
  userId: string
  userName: string
  message: string
  self: boolean
  system: boolean
}

type UseProjectSocketResult = {
  connectionState: ConnectionState
  messages: CollabLogEntry[]
  sendTestMessage: (text: string) => void
}

const MAX_LOG_ENTRIES = 50

function appendEntry(prev: CollabLogEntry[], entry: Omit<CollabLogEntry, 'id'>): CollabLogEntry[] {
  return [...prev, { id: crypto.randomUUID(), ...entry }].slice(-MAX_LOG_ENTRIES)
}

function shortUserLabel(userId: string): string {
  return `User ${userId.slice(0, 8)}`
}

// Joins `projectId`'s room on the app's single shared WebSocket connection
// (see SocketProvider), loads prior chat history over REST so it survives a
// refresh, and appends live activity for the debug/chat panel. Re-joins
// automatically if the shared connection reconnects.
export function useProjectSocket(projectId: string): UseProjectSocketResult {
  const { user } = useAuth()
  const { connectionState, send, subscribe } = useSocket()
  const [messages, setMessages] = useState<CollabLogEntry[]>([])

  useEffect(() => {
    setMessages([])
    api
      .getProjectMessages(projectId)
      .then((history) => {
        setMessages(
          history.map((entry) => ({
            id: entry.id,
            userId: entry.userId,
            userName: entry.userName,
            message: entry.message,
            self: entry.userId === user?.id,
            system: false,
          })),
        )
      })
      .catch(() => {
        // Non-fatal: live messages still arrive over the socket even if history fails to load.
      })
  }, [projectId, user?.id])

  useEffect(() => {
    if (connectionState === 'connected') {
      send({ type: 'join_project', projectId })
    }
  }, [projectId, connectionState, send])

  useEffect(() => {
    return subscribe((message: ServerMessage) => {
      switch (message.type) {
        case 'test_message':
          setMessages((prev) =>
            appendEntry(prev, {
              userId: message.userId,
              userName: message.userName,
              message: message.message,
              self: false,
              system: false,
            }),
          )
          break
        case 'user_joined':
          setMessages((prev) =>
            appendEntry(prev, {
              userId: message.userId,
              userName: shortUserLabel(message.userId),
              message: 'joined the project',
              self: false,
              system: true,
            }),
          )
          break
        case 'user_left':
          setMessages((prev) =>
            appendEntry(prev, {
              userId: message.userId,
              userName: shortUserLabel(message.userId),
              message: 'left the project',
              self: false,
              system: true,
            }),
          )
          break
        default:
          break
      }
    })
  }, [subscribe])

  const sendTestMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      send({ type: 'test_message', message: trimmed })
      setMessages((prev) =>
        appendEntry(prev, {
          userId: user?.id ?? 'me',
          userName: user?.name ?? 'You',
          message: trimmed,
          self: true,
          system: false,
        }),
      )
    },
    [send, user],
  )

  return { connectionState, messages, sendTestMessage }
}
