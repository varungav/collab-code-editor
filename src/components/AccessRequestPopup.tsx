import { useState } from 'react'
import type { IncomingAccessRequest } from '../types/access'

type AccessRequestPopupProps = {
  requests: IncomingAccessRequest[]
  onApprove: (requestId: string) => Promise<void>
  onDeny: (requestId: string) => Promise<void>
}

// App-wide popup: shows one pending "someone wants to open your project"
// request at a time, regardless of which page the owner is currently on.
// Dismissing ("Later") just hides it for this session — it still shows up
// in the Dashboard's own request list until approved or denied.
function AccessRequestPopup({ requests, onApprove, onDeny }: AccessRequestPopupProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [submittingId, setSubmittingId] = useState<string | null>(null)

  const current = requests.find((request) => !dismissedIds.has(request.id))
  if (!current) return null

  const handleDecision = async (decide: (id: string) => Promise<void>) => {
    setSubmittingId(current.id)
    try {
      await decide(current.id)
    } finally {
      setSubmittingId(null)
    }
  }

  return (
    <div className="access-popup-backdrop">
      <div className="access-popup" role="dialog" aria-modal="true">
        <p className="access-popup__title">Access Request</p>
        <p className="access-popup__body">
          <strong>{current.requester.name}</strong> wants to open <strong>{current.project.name}</strong>. Allow
          them access?
        </p>
        <div className="access-popup__actions">
          <button
            type="button"
            className="link-button"
            onClick={() => setDismissedIds((prev) => new Set(prev).add(current.id))}
          >
            Later
          </button>
          <button
            type="button"
            className="access-popup__deny"
            disabled={submittingId === current.id}
            onClick={() => handleDecision(onDeny)}
          >
            Deny
          </button>
          <button
            type="button"
            className="access-popup__allow"
            disabled={submittingId === current.id}
            onClick={() => handleDecision(onApprove)}
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccessRequestPopup
