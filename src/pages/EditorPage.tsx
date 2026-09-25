import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import Header from '../components/Header'
import MembersPanel from '../components/MembersPanel'
import ChangeNameModal from '../components/ChangeNameModal'
import ProjectAccessGate from '../components/ProjectAccessGate'
import Workspace from '../components/Workspace'

type EditorPageProps = {
  projectId: string
  onBack: () => void
}

function EditorPage({ projectId, onBack }: EditorPageProps) {
  const { user } = useAuth()
  const [changeNameOpen, setChangeNameOpen] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)

  return (
    <>
      <ProjectAccessGate projectId={projectId}>
        {(role, projectName) => (
          <>
            <Header
              left={
                <button type="button" className="header-back-btn" onClick={onBack}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                    <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Projects
                </button>
              }
              center={
                <div className="header-project-name">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <rect x="1" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 3V2.5A1.5 1.5 0 015.5 1h2A1.5 1.5 0 019 2.5V3" stroke="currentColor" strokeWidth="1.3"/>
                  </svg>
                  {projectName}
                </div>
              }
              right={
                <div className="header-actions">
                  <button
                    type="button"
                    className="header-icon-btn"
                    onClick={() => setMembersOpen(true)}
                    aria-label="Members"
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="6" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      <circle cx="12.5" cy="5" r="2" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M14.5 13c0-1.657-1.343-3-2-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    Members
                  </button>

                  <div className="header-divider" />

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
            <Workspace projectId={projectId} role={role} projectName={projectName} />
            {changeNameOpen && <ChangeNameModal onClose={() => setChangeNameOpen(false)} />}
            {membersOpen && (
              <MembersPanel projectId={projectId} onClose={() => setMembersOpen(false)} />
            )}
          </>
        )}
      </ProjectAccessGate>
    </>
  )
}

export default EditorPage
