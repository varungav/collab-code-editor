import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import type { ProjectMember, ProjectRole } from '../types/members'

type MembersPanelProps = {
  projectId: string
  onClose: () => void
}

const ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

const ROLE_COLOR: Record<ProjectRole, string> = {
  OWNER: '#f0a500',
  EDITOR: '#4fc1ff',
  VIEWER: '#8a8a8a',
}

function avatar(name: string) {
  return name.trim().charAt(0).toUpperCase()
}

function MembersPanel({ projectId, onClose }: MembersPanelProps) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  // closing drives the slide-out animation; actual unmount happens after it finishes
  const [closing, setClosing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api
      .getProjectMembers(projectId)
      .then(setMembers)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load members'))
      .finally(() => setLoading(false))
  }, [projectId])

  const shareUrl = `${window.location.origin}/projects/${projectId}`

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {})
  }

  function startClose() {
    setClosing(true)
  }

  function handleAnimationEnd() {
    if (closing) onClose()
  }

  return (
    <div
      className={`members-backdrop${closing ? ' members-backdrop--out' : ''}`}
      onClick={startClose}
    >
      <div
        ref={panelRef}
        className={`members-panel${closing ? ' members-panel--out' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={handleAnimationEnd}
      >
        {/* Header */}
        <div className="members-panel__header">
          <span className="members-panel__title">Members</span>
          <button type="button" className="members-panel__close" onClick={startClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Share link */}
        <div className="members-panel__section">
          <div className="members-panel__label">Invite via link</div>
          <div className="members-panel__share-row">
            <span className="members-panel__share-url">{shareUrl}</span>
            <button type="button" className="members-panel__copy-btn" onClick={handleCopy}>
              Copy
            </button>
          </div>
        </div>

        <div className="members-panel__divider" />

        {/* Member list */}
        <div className="members-panel__section">
          <div className="members-panel__label">
            {loading ? 'Loading…' : `${members.length} member${members.length !== 1 ? 's' : ''}`}
          </div>
          {error && <div className="members-panel__error">{error}</div>}
          {!loading && !error && (
            <ul className="members-panel__list">
              {members.map((m) => (
                <li key={m.userId} className="members-panel__item">
                  <div
                    className="members-panel__avatar"
                    style={{ background: ROLE_COLOR[m.role] + '22', color: ROLE_COLOR[m.role] }}
                  >
                    {avatar(m.name)}
                  </div>
                  <div className="members-panel__info">
                    <span className="members-panel__name">{m.name}</span>
                    <span className="members-panel__role-badge" style={{ color: ROLE_COLOR[m.role] }}>
                      {ROLE_LABEL[m.role]}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default MembersPanel
