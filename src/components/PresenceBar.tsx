import type { PresenceUser } from '../collaboration/awareness'

type PresenceBarProps = {
  users: PresenceUser[]
}

// Compact "who else is here" indicator for the currently open file — not a
// chat/social feature, just colored dots + names matching each person's
// cursor color.
function PresenceBar({ users }: PresenceBarProps) {
  const others = users.filter((user) => !user.self)
  if (others.length === 0) return null

  return (
    <div className="presence-bar" aria-label="Other people viewing this file">
      {others.map((user) => (
        <span key={user.clientId} className="presence-bar__user">
          <span className="presence-bar__dot" style={{ backgroundColor: user.color }} />
          {user.name}
        </span>
      ))}
    </div>
  )
}

export default PresenceBar
