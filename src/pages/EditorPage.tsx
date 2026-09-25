import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Header from '../components/Header'
import MembersPanel from '../components/MembersPanel'
import ProjectAccessGate from '../components/ProjectAccessGate'
import Workspace from '../components/Workspace'

type EditorPageProps = {
  projectId: string
  onBack: () => void
}

function EditorPage({ projectId, onBack }: EditorPageProps) {
  const { user, logout } = useAuth()
  const [membersOpen, setMembersOpen] = useState(false)

  return (
    <>
      <ProjectAccessGate projectId={projectId}>
        {(role) => (
          <>
            <Header
              right={
                <div className="app-header__user">
                  <button type="button" className="link-button" onClick={onBack}>
                    ← Projects
                  </button>
                  <button type="button" className="link-button" onClick={() => setMembersOpen(true)}>
                    👥 Members
                  </button>
                  <span>{user?.name}</span>
                  <button type="button" className="link-button" onClick={logout}>
                    Logout
                  </button>
                </div>
              }
            />
            <Workspace projectId={projectId} role={role} />
            {membersOpen && (
              <MembersPanel projectId={projectId} currentRole={role} onClose={() => setMembersOpen(false)} />
            )}
          </>
        )}
      </ProjectAccessGate>
    </>
  )
}

export default EditorPage
