const STORAGE_KEY = 'collabcode.token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, token)
  } catch {
    // ignore storage failures (private browsing, disabled storage, etc.)
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}
