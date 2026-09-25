import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import { useSocket } from '../realtime/SocketProvider'
import type { IncomingAccessRequest } from '../types/access'

type UseAccessRequestsResult = {
  pendingRequests: IncomingAccessRequest[]
  approve: (requestId: string) => Promise<void>
  deny: (requestId: string) => Promise<void>
}

// Owner-side: the list of pending "someone wants to open your project"
// requests, seeded from REST (so it's correct even if the owner wasn't
// connected when a request came in) and kept live via the shared WebSocket
// connection (so a popup can appear the instant one arrives).
export function useAccessRequests(): UseAccessRequestsResult {
  const { status } = useAuth()
  const { subscribe } = useSocket()
  const [pendingRequests, setPendingRequests] = useState<IncomingAccessRequest[]>([])

  useEffect(() => {
    if (status !== 'authenticated') return

    api
      .listIncomingAccessRequests()
      .then(setPendingRequests)
      .catch(() => {
        // Non-fatal: the live WS feed still works even if this initial fetch fails.
      })
  }, [status])

  useEffect(() => {
    return subscribe((message) => {
      if (message.type !== 'access_requested') return
      setPendingRequests((prev) => {
        if (prev.some((r) => r.id === message.requestId)) return prev
        return [
          ...prev,
          {
            id: message.requestId,
            projectId: message.projectId,
            requesterId: message.requesterId,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            requester: { id: message.requesterId, name: message.requesterName, email: '' },
            project: { id: message.projectId, name: message.projectName },
          },
        ]
      })
    })
  }, [subscribe])

  const approve = useCallback(async (requestId: string) => {
    await api.approveAccessRequest(requestId)
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId))
  }, [])

  const deny = useCallback(async (requestId: string) => {
    await api.denyAccessRequest(requestId)
    setPendingRequests((prev) => prev.filter((r) => r.id !== requestId))
  }, [])

  return { pendingRequests, approve, deny }
}
