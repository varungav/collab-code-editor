// Mirrors backend/src/websocket/yjsRoomManager.ts's framing — every binary
// WebSocket frame in the collaboration channel starts with one type byte so
// document sync updates and awareness (cursor/selection) updates can share
// the same connection.
export const MESSAGE_SYNC = 0
export const MESSAGE_AWARENESS = 1

export function frameMessage(type: number, payload: Uint8Array): Uint8Array {
  const framed = new Uint8Array(payload.length + 1)
  framed[0] = type
  framed.set(payload, 1)
  return framed
}
