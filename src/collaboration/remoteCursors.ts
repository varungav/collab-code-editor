// Rendering concerns for other people's cursors/selections inside Monaco.
// y-monaco renders them with CSS classes suffixed by the peer's Yjs
// awareness clientID (a random number per Y.Doc instance — not our own user
// id), e.g. `yRemoteSelection-1234567`. Since that ID isn't known ahead of
// time, the color/name rule for each one is injected on demand into a
// single shared <style> tag rather than written as static CSS.

// Deterministic color per user id, so the same person always shows up as the
// same color across tabs/reconnects instead of a random one each session.
export function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 55%)`
}

const STYLE_ELEMENT_ID = 'yjs-remote-cursor-styles'
const knownClientIds = new Set<number>()

function getStyleElement(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ELEMENT_ID
    document.head.appendChild(el)
  }
  return el
}

// Safe to embed inside a CSS `content: "..."` string literal — escapes
// backslashes/quotes and strips newlines, since this text ultimately comes
// from a user-chosen display name.
function escapeForCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, ' ')
}

export function ensureRemoteCursorStyle(clientId: number, color: string, name: string): void {
  if (knownClientIds.has(clientId)) return
  knownClientIds.add(clientId)

  const label = escapeForCssString(name)
  const style = getStyleElement()
  style.appendChild(
    document.createTextNode(`
.yRemoteSelection-${clientId} {
  background-color: ${color};
  opacity: 0.3;
}
.yRemoteSelectionHead-${clientId} {
  position: absolute;
  border-left: 2px solid ${color};
  height: 100%;
  box-sizing: border-box;
}
.yRemoteSelectionHead-${clientId}::after {
  content: '';
  position: absolute;
  left: -4px;
  top: -2px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${color};
}
.yRemoteSelectionHead-${clientId}::before {
  content: "${label}";
  position: absolute;
  bottom: 100%;
  left: -4px;
  margin-bottom: 4px;
  padding: 2px 6px;
  font-size: 11px;
  font-family: system-ui, -apple-system, sans-serif;
  white-space: nowrap;
  color: #fff;
  background-color: ${color};
  border-radius: 3px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s ease-in-out;
  z-index: 20;
}
.yRemoteSelectionHead-${clientId}:hover::before {
  opacity: 1;
}
`),
  )
}
