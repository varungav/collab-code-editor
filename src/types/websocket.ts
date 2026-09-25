// Mirrors backend/src/websocket/types.ts — kept in sync by hand since frontend
// and backend are separate TypeScript projects with no shared package.

// Yjs document updates do NOT go through this JSON protocol — they travel as
// raw binary WebSocket frames on the same connection (see websocketService.ts
// / SocketProvider's sendBinary/subscribeBinary). These join_file/leave_file
// messages only manage which file's collaborative room a socket's binary
// frames are currently relayed through.

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

export type ConnectionState = 'connecting' | 'connected' | 'disconnected'

// A file's Yjs collaboration status — distinct from ConnectionState (which is
// about the underlying socket): a file can only be 'synced' once its initial
// document state has actually been received, not merely once the socket is up.
export type SyncState = 'connecting' | 'synced' | 'disconnected'
