import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { useSocket } from '../realtime/SocketProvider'
import type { ProjectAccessStatus } from '../types/access'
import type { ProjectRole } from '../types/members'

type AccessState =
  | { phase: 'loading' }
  | { phase: 'not_found' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; status: ProjectAccessStatus; projectName: string; role: ProjectRole | null }

type UseProjectAccessResult = {
  state: AccessState
  requestAccess: () => Promise<void>
  requesting: boolean
  requestError: string
}

// Requester-side: resolves whether the current user can open `projectId`,
// and — while a request is pending — listens on the shared WebSocket
// connection so approval/denial updates this screen live, with no refresh.
export function useProjectAccess(projectId: string): UseProjectAccessResult {
  const { subscribe } = useSocket()
  const [state, setState] = useState<AccessState>({ phase: 'loading' })
  const [requesting, setRequesting] = useState(false)
  const [requestError, setRequestError] = useState('')

  const load = useCallback(async () => {
    setState({ phase: 'loading' })
    try {
      const access = await api.getProjectAccess(projectId)
      setState({ phase: 'ready', status: access.status, projectName: access.projectName, role: access.role })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ phase: 'not_found' })
      } else {
        setState({ phase: 'error', message: err instanceof Error ? err.message : 'Failed to load project' })
      }
    }
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    return subscribe((message) => {
      // Re-fetch rather than hand-assemble the new state locally, so the
      // role we end up with is always exactly what the backend granted.
      if (
        (message.type === 'access_request_approved' || message.type === 'access_request_denied') &&
        message.projectId === projectId
      ) {
        load()
      }
    })
  }, [subscribe, projectId, load])

  const requestAccess = useCallback(async () => {
    setRequesting(true)
    setRequestError('')
    try {
      await api.requestProjectAccess(projectId)
      setState((prev) => (prev.phase === 'ready' ? { ...prev, status: 'pending' } : prev))
    } catch (err) {
      setRequestError(err instanceof ApiError ? err.message : 'Failed to request access')
    } finally {
      setRequesting(false)
    }
  }, [projectId])

  return { state, requestAccess, requesting, requestError }
}
