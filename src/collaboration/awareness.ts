import type { Awareness } from 'y-protocols/awareness'

// User identity/presence data as it appears in awareness state — separate
// from remoteCursors.ts, which only cares about how to *render* it.
export type PresenceUser = {
  clientId: number
  id: string
  name: string
  color: string
  self: boolean
}

// Reads the current set of collaborators present on this document (this
// client included) from raw Yjs awareness state.
export function getPresentUsers(awareness: Awareness): PresenceUser[] {
  const users: PresenceUser[] = []
  for (const [clientId, state] of awareness.getStates()) {
    const user = state?.user
    if (!user || typeof user.id !== 'string' || typeof user.name !== 'string' || typeof user.color !== 'string') {
      continue
    }
    users.push({ clientId, id: user.id, name: user.name, color: user.color, self: clientId === awareness.clientID })
  }
  return users
}
