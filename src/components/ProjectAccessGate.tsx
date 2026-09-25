import type { ReactNode } from 'react'
import { useProjectAccess } from '../hooks/useProjectAccess'
import type { ProjectRole } from '../types/members'

type ProjectAccessGateProps = {
  projectId: string
  children: (role: ProjectRole) => ReactNode
}

// Wraps the editor: renders `children` (with the caller's role) once the
// current user is a project member, and otherwise shows a request-access
// screen instead of a bare "not found" for a project link the viewer isn't
// yet authorized for.
function ProjectAccessGate({ projectId, children }: ProjectAccessGateProps) {
  const { state, requestAccess, requesting, requestError } = useProjectAccess(projectId)

  if (state.phase === 'loading') {
    return <div className="workspace-status">Checking access…</div>
  }

  if (state.phase === 'not_found') {
    return <div className="workspace-status">Project not found.</div>
  }

  if (state.phase === 'error') {
    return <div className="workspace-status">{state.message}</div>
  }

  if (state.status === 'member' && state.role) {
    return <>{children(state.role)}</>
  }

  return (
    <div className="access-gate">
      <div className="access-gate__card">
        <h2>{state.projectName}</h2>
        {state.status === 'pending' ? (
          <p className="access-gate__message">🟡 Your request to access this project is pending approval.</p>
        ) : (
          <>
            <p className="access-gate__message">You don&apos;t have access to this project yet.</p>
            <button type="button" onClick={requestAccess} disabled={requesting}>
              {requesting ? 'Requesting…' : 'Request Access'}
            </button>
          </>
        )}
        {requestError && <div className="auth-error">{requestError}</div>}
      </div>
    </div>
  )
}

export default ProjectAccessGate
