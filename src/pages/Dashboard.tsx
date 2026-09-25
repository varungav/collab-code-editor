import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import Header from '../components/Header'
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
  const { user, logout } = useAuth()
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
          <div className="app-header__user">
            <span>{user?.name}</span>
            <button type="button" className="link-button" onClick={logout}>
              Logout
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
                  📁 {project.name}
                  {project.role !== 'OWNER' && (
                    <span className="project-list__badge">
                      {project.role === 'EDITOR' ? 'Editor' : 'Viewer'}
                    </span>
                  )}
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
    </>
  )
}

export default Dashboard
