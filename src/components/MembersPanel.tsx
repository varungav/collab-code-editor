import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import type { ProjectMember, ProjectRole } from '../types/members'

type MembersPanelProps = {
  projectId: string
  currentRole: ProjectRole
  onClose: () => void
}

const ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: 'Owner',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
}

// Only the owner sees Add/Change/Remove controls — but that's purely a
// convenience: the backend enforces the same rule independently regardless
// of what this component renders.
function MembersPanel({ projectId, currentRole, onClose }: MembersPanelProps) {
  const isOwner = currentRole === 'OWNER'
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loadError, setLoadError] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR')
  const [addError, setAddError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => {
    api
      .getProjectMembers(projectId)
      .then(setMembers)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Failed to load members'))
  }

  useEffect(load, [projectId])

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    setAddError('')
    try {
      const member = await api.addProjectMember(projectId, email.trim(), role)
      setMembers((prev) => [...prev, member])
      setEmail('')
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Failed to add member')
    } finally {
      setBusy(false)
    }
  }

  const handleChangeRole = async (userId: string, newRole: ProjectRole) => {
    if (newRole === 'OWNER') return
    try {
      const updated = await api.updateMemberRole(projectId, userId, newRole)
      setMembers((prev) => prev.map((m) => (m.userId === userId ? updated : m)))
    } catch {
      // Non-fatal for this simple panel; the member list stays as-is on failure.
    }
  }

  const handleRemove = async (userId: string) => {
    try {
      await api.removeMember(projectId, userId)
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch {
      // Non-fatal; nothing to reconcile beyond leaving them in the list.
    }
  }

  return (
    <div className="members-modal-backdrop" onClick={onClose}>
      <div className="members-modal" onClick={(event) => event.stopPropagation()}>
        <div className="members-modal__header">
          <h2>Project Members</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>

        {loadError && <div className="auth-error">{loadError}</div>}

        <ul className="members-list">
          {members.map((member) => (
            <li key={member.userId} className="members-list__item">
              <div>
                <div className="members-list__name">{member.name}</div>
                <div className="members-list__role">{ROLE_LABEL[member.role]}</div>
              </div>
              {isOwner && member.role !== 'OWNER' && (
                <div className="members-list__actions">
                  <select
                    value={member.role}
                    onChange={(event) => handleChangeRole(member.userId, event.target.value as ProjectRole)}
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <button type="button" className="link-button" onClick={() => handleRemove(member.userId)}>
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form className="members-add-form" onSubmit={handleAdd}>
            <div className="members-add-form__title">Add Member</div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <select value={role} onChange={(event) => setRole(event.target.value as 'EDITOR' | 'VIEWER')}>
              <option value="EDITOR">Editor</option>
              <option value="VIEWER">Viewer</option>
            </select>
            <button type="submit" disabled={busy || !email.trim()}>
              + Add Member
            </button>
            {addError && <div className="auth-error">{addError}</div>}
          </form>
        )}
      </div>
    </div>
  )
}

export default MembersPanel
