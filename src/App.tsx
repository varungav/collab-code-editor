import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './auth/AuthContext'
import AccessRequestPopup from './components/AccessRequestPopup'
import { useAccessRequests } from './hooks/useAccessRequests'
import Dashboard from './pages/Dashboard'
import EditorPage from './pages/EditorPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
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
  const { status } = useAuth()
  const [authView, setAuthView] = useState<'login' | 'register'>('login')
  const [view, setView] = useState<View>(() => parseView(window.location.pathname))
  const { pendingRequests, approve, deny } = useAccessRequests()

  useEffect(() => {
    function handlePopState() {
      setView(parseView(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      setView({ name: 'dashboard' })
      setAuthView('login')
      window.history.replaceState(null, '', '/')
    }
  }, [status])

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
    return authView === 'login' ? (
      <LoginPage onSwitchToRegister={() => setAuthView('register')} />
    ) : (
      <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
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
