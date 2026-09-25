// Kept intentionally small and flat so later phases (cursors, selections)
// can extend these unions without touching existing message handling.
//
// Yjs document updates do NOT go through this JSON protocol — they travel as
// raw binary WebSocket frames on the same connection (see websocketServer.ts,
// which routes by the `isBinary` flag on each incoming message). These
// join_file/leave_file messages only manage which file's collaborative room
// a socket's binary frames are currently relayed through.

export type ClientMessage =
  | { type: 'join_project'; projectId: string }
  | { type: 'ping' }
  | { type: 'test_message'; message: string }
  | { type: 'join_file'; projectId: string; fileId: string }
  | { type: 'leave_file' }

export type ServerMessage =
  | { type: 'connected'; userId: string }
  | { type: 'user_joined'; userId: string; projectId: string }
  | { type: 'user_left'; userId: string; projectId: string }
  | { type: 'test_message'; userId: string; userName: string; message: string }
  | { type: 'pong' }
  | { type: 'error'; message: string }
  | {
      type: 'access_requested'
      requestId: string
      projectId: string
      projectName: string
      requesterId: string
      requesterName: string
    }
  | { type: 'access_request_approved'; projectId: string; projectName: string }
  | { type: 'access_request_denied'; projectId: string; projectName: string }

export type WsUser = {
  id: string
  name: string
  email: string
}
