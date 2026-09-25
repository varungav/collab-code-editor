import { CollaborativeDocument, type CollabTransport, type CollabUser } from './collaborativeDocument'

// Owns "the currently open collaborative document" for the editor. Opening a
// new file always destroys the previous file's Y.Doc and Monaco binding
// first, so switching files never leaves a stale WebSocket/Yjs subscription
// active (no duplicate updates, no leaked bindings).
export class YjsManager {
  private current: CollaborativeDocument | null = null
  private readonly transport: CollabTransport

  constructor(transport: CollabTransport) {
    this.transport = transport
  }

  open(projectId: string, fileId: string, user: CollabUser, onSynced: () => void): CollaborativeDocument {
    this.current?.destroy()
    const document = new CollaborativeDocument(this.transport, projectId, fileId, user, onSynced)
    this.current = document
    return document
  }

  close(): void {
    this.current?.destroy()
    this.current = null
  }
}
