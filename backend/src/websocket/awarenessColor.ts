// Mirrors src/collaboration/remoteCursors.ts's colorForUser on the frontend —
// deterministic per user id, so the color the server enforces is the same
// one the client would have computed for itself.
export function colorForUser(userId: string): string {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 55%)`
}
