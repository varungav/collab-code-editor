import { useEffect, useRef, useState } from 'react'
import { api } from './api/client'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AccessRequestPopup from './components/AccessRequestPopup'
import { useAccessRequests } from './hooks/useAccessRequests'
import Dashboard from './pages/Dashboard'
import EditorPage from './pages/EditorPage'
import NamePromptPage from './pages/NamePromptPage'
import { SocketProvider } from './realtime/SocketProvider'

type View = { name: 'dashboard' } | { name: 'editor'; projectId: string }

function parseView(pathname: string): View {
  const match = pathname.match(/^\/projects\/([^/]+)\/?$/)
  return match ? { name: 'editor', projectId: match[1] } : { name: 'dashboard' }
}

function pathForView(view: View): string {
  return view.name === 'editor' ? `/projects/${view.projectId}` : '/'
}

function AuthenticatedApp() {
  const { status, user } = useAuth()
  const [view, setView] = useState<View>(() => parseView(window.location.pathname))
  const { pendingRequests, approve, deny } = useAccessRequests()
  // true only during the tick right after the user submits their name
  const justNamed = useRef(false)
  const justNamedThisRender = justNamed.current

  useEffect(() => {
    function handlePopState() {
      setView(parseView(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // When the user just entered their name and landed on dashboard (no shared
  // link), auto-create their project and go straight to the editor.
  useEffect(() => {
    if (status !== 'authenticated' || !justNamedThisRender) return
    if (view.name !== 'dashboard') return // shared link — skip auto-create
    justNamed.current = false

    api
      .createProject(`${user!.name}'s project`)
      .then((project) => {
        navigate({ name: 'editor', projectId: project.id })
      })
      .catch(() => {
        // If creation fails just stay on dashboard
      })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  // A fresh visit to the root opens the user's own console instead of the
  // dashboard. The dashboard remains available from the editor's Projects button.
  const openedRootProject = useRef(false)
  const startedAtRoot = useRef(window.location.pathname === '/')

  useEffect(() => {
    if (status !== 'authenticated' || !startedAtRoot.current || openedRootProject.current) return
    if (justNamedThisRender) return // the name-entry flow creates and opens a project above
    openedRootProject.current = true

    api
      .getProjects()
      .then((projects) => {
        const project = projects.find((item) => item.role === 'OWNER') ?? projects[0]
        if (project) {
          navigate({ name: 'editor', projectId: project.id })
          return
        }
        return api.createProject(`${user!.name}'s project`).then((created) => {
          navigate({ name: 'editor', projectId: created.id })
        })
      })
      .catch(() => {
        // Keep the dashboard available if project loading or creation fails.
      })
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(next: View) {
    setView(next)
    const path = pathForView(next)
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
  }

  if (status === 'loading') {
    return <div className="workspace-status">Loading…</div>
  }

  if (status === 'unauthenticated') {
    return (
      <NamePromptPage
        onName={() => {
          justNamed.current = true
        }}
      />
    )
  }

  return (
    <>
      {view.name === 'editor' ? (
        <EditorPage projectId={view.projectId} onBack={() => navigate({ name: 'dashboard' })} />
      ) : (
        <Dashboard
          onOpenProject={(projectId) => navigate({ name: 'editor', projectId })}
          pendingRequests={pendingRequests}
          onApproveRequest={approve}
          onDenyRequest={deny}
        />
      )}
      <AccessRequestPopup requests={pendingRequests} onApprove={approve} onDeny={deny} />
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <div className="app">
          <AuthenticatedApp />
        </div>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
