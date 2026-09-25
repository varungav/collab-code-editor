import { useCallback, useEffect, useRef, useState } from 'react'
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
  isDirty: boolean
  markSaved: () => void
}

// Opens `fileId`'s collaborative document on the app's shared WebSocket
// connection, tearing it down on unmount or when `fileId` changes (see
// YjsManager). Re-sends join_file whenever the shared connection becomes
// 'connected' — covering both the initial open and any later reconnect,
// the same pattern useProjectSocket uses for join_project.
// `onDirty` (optional) fires exactly once per genuine local-change event on
// whichever document is currently bound — read via a ref so the caller's
// latest closure is always used without needing to resubscribe. This is
// deliberately a direct callback rather than something a caller derives by
// watching `isDirty` across renders: `isDirty` resets to false in the same
// effect that reacts to `fileId` changing, so for one commit after
// switching files, a caller could otherwise still observe the *previous*
// file's stale `true` value alongside the *new* `activeFileId` — a callback
// tied straight to the edit event itself has no such window.
export function useCollaborativeDocument(
  projectId: string,
  fileId: string,
  onDirty?: () => void,
): UseCollaborativeDocumentResult {
  const { user } = useAuth()
  const { connectionState, send, sendBinary, subscribeBinary } = useSocket()
  const [manager] = useState(() => new YjsManager({ sendBinary, subscribeBinary }))
  const [document, setDocument] = useState<CollaborativeDocument | null>(null)
  const [hasSynced, setHasSynced] = useState(false)
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const onDirtyRef = useRef(onDirty)
  useEffect(() => {
    onDirtyRef.current = onDirty
  })

  useEffect(() => {
    setHasSynced(false)
    setIsDirty(false)
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
    if (!document) return
    return document.onLocalChange((dirty) => {
      setIsDirty(dirty)
      // Only on an actual transition into "dirty" — editing back to exactly
      // the saved baseline (dirty === false again) shouldn't itself count
      // as the kind of edit that promotes a preview tab (see Workspace).
      if (dirty) onDirtyRef.current?.()
    })
  }, [document])

  // Called after a successful save — updates the document's own baseline
  // (see CollaborativeDocument.markSaved) so further comparisons are
  // against what was *just* persisted, not the original load, and clears
  // the flag immediately rather than waiting for the next onLocalChange.
  const markSaved = useCallback(() => {
    document?.markSaved()
    setIsDirty(false)
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

  return { document, syncState, presentUsers, isDirty, markSaved }
}
