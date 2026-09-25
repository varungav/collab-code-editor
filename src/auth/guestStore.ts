// Stores a stable guest identity (random UUID + chosen name) in localStorage
// so the same user is recognised across page refreshes.

const ID_KEY = 'collabcode.guestId'
const NAME_KEY = 'collabcode.guestName'

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getGuestId(): string {
  try {
    let id = localStorage.getItem(ID_KEY)
    if (!id) {
      id = generateId()
      localStorage.setItem(ID_KEY, id)
    }
    return id
  } catch {
    return generateId()
  }
}

export function getGuestName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY)
  } catch {
    return null
  }
}

export function setGuestName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {}
}

export function clearGuest(): void {
  try {
    localStorage.removeItem(NAME_KEY)
  } catch {}
}
