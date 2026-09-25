import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Header from '../components/Header'
import ChangeNameModal from '../components/ChangeNameModal'
import type { IncomingAccessRequest } from '../types/access'
import type { Project } from '../types/file'

type DashboardProps = {
  onOpenProject: (projectId: string) => void
  pendingRequests: IncomingAccessRequest[]
  onApproveRequest: (requestId: string) => Promise<void>
  onDenyRequest: (requestId: string) => Promise<void>
}

type LoadState = 'loading' | 'ready' | 'error'

function Dashboard({ onOpenProject, pendingRequests, onApproveRequest, onDenyRequest }: DashboardProps) {
  const { user } = useAuth()
  const [changeNameOpen, setChangeNameOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [newProjectName, setNewProjectName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    api
      .getProjects()
      .then((data) => {
        setProjects(data)
        setLoadState('ready')
      })
      .catch(() => setLoadState('error'))
  }, [])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return

    setCreating(true)
    setCreateError('')
    try {
      const project = await api.createProject(name)
      setProjects((prev) => [...prev, project])
      setNewProjectName('')
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Header
        right={
          <div className="header-actions">
            <div className="header-user">
              <div className="header-user__avatar">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span className="header-user__name">{user?.name}</span>
            </div>
            <button type="button" className="header-text-btn" onClick={() => setChangeNameOpen(true)}>
              Change name
            </button>
          </div>
        }
      />
      <div className="dashboard">
        {pendingRequests.length > 0 && (
          <section className="access-requests-section">
            <h2>Access Requests</h2>
            <ul className="access-requests-list">
              {pendingRequests.map((request) => (
                <li key={request.id} className="access-requests-list__item">
                  <span>
                    <strong>{request.requester.name}</strong> wants to open{' '}
                    <strong>{request.project.name}</strong>
                  </span>
                  <span className="access-requests-list__actions">
                    <button type="button" onClick={() => onDenyRequest(request.id)} className="access-popup__deny">
                      Deny
                    </button>
                    <button type="button" onClick={() => onApproveRequest(request.id)} className="access-popup__allow">
                      Allow
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <h2>My Projects</h2>

        {loadState === 'loading' && <p className="dashboard-status">Loading projects…</p>}
        {loadState === 'error' && <p className="dashboard-status">Failed to load projects.</p>}

        {loadState === 'ready' && projects.length === 0 && (
          <p className="dashboard-status">No projects yet — create your first one below.</p>
        )}

        {loadState === 'ready' && projects.length > 0 && (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="project-list__item"
                  onClick={() => onOpenProject(project.id)}
                >
                  <svg className="project-list__icon" width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                    <rect x="1" y="4" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M1 6.5h13M5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  <span className="project-list__name">{project.name}</span>
                  {project.role !== 'OWNER' && (
                    <span className="project-list__badge">
                      {project.role === 'EDITOR' ? 'Editor' : 'Viewer'}
                    </span>
                  )}
                  <svg className="project-list__arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="new-project-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="New project name"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
          />
          <button type="submit" disabled={creating || !newProjectName.trim()}>
            + New Project
          </button>
        </form>
        {createError && <div className="auth-error">{createError}</div>}
      </div>
      {changeNameOpen && <ChangeNameModal onClose={() => setChangeNameOpen(false)} />}
    </>
  )
}

export default Dashboard
