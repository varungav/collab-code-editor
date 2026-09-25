import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { PresenceUser } from '../collaboration/awareness'
import { CollaborativeDocument } from '../collaboration/collaborativeDocument'
import { YjsManager } from '../collaboration/yjsManager'
import { useSocket } from '../realtime/SocketProvider'
import type { SyncState } from '../types/websocket'

type UseCollaborativeDocumentResult = {
  document: CollaborativeDocument | null
  syncState: SyncState
  presentUsers: PresenceUser[]
}

// Opens `fileId`'s collaborative document on the app's shared WebSocket
// connection, tearing it down on unmount or when `fileId` changes (see
// YjsManager). Re-sends join_file whenever the shared connection becomes
// 'connected' — covering both the initial open and any later reconnect,
// the same pattern useProjectSocket uses for join_project.
export function useCollaborativeDocument(projectId: string, fileId: string): UseCollaborativeDocumentResult {
  const { user } = useAuth()
  const { connectionState, send, sendBinary, subscribeBinary } = useSocket()
  const [manager] = useState(() => new YjsManager({ sendBinary, subscribeBinary }))
  const [document, setDocument] = useState<CollaborativeDocument | null>(null)
  const [hasSynced, setHasSynced] = useState(false)
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])

  useEffect(() => {
    setHasSynced(false)
    if (!fileId || !user) {
      setDocument(null)
      return
    }

    const doc = manager.open(projectId, fileId, user, () => setHasSynced(true))
    setDocument(doc)
    return () => {
      manager.close()
      setDocument(null)
    }
  }, [manager, projectId, fileId, user])

  useEffect(() => {
    if (!document) {
      setPresentUsers([])
      return
    }
    return document.onPresenceChange(setPresentUsers)
  }, [document])

  useEffect(() => {
    if (!fileId) return
    if (connectionState === 'connected') {
      send({ type: 'join_file', projectId, fileId })
      // Also covers the reconnect case: the document isn't recreated then,
      // so nothing else would tell the fresh connection who we are.
      document?.republishLocalState()
    } else {
      setHasSynced(false)
    }
  }, [connectionState, projectId, fileId, send, document])

  const syncState: SyncState = connectionState !== 'connected' ? 'disconnected' : hasSynced ? 'synced' : 'connecting'

  return { document, syncState, presentUsers }
}
