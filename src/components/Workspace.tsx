import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import { useCollaborativeDocument } from '../hooks/useCollaborativeDocument'
import { useProjectSocket } from '../hooks/useProjectSocket'
import type { FileItem } from '../types/file'
import type { ProjectRole } from '../types/members'
import CollabPanel from './CollabPanel'
import FileExplorer from './FileExplorer'
import CodeEditor from './CodeEditor'
import PresenceBar from './PresenceBar'

type LoadState = 'loading' | 'ready' | 'error'

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  py: 'python',
}

function inferLanguage(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext'
}

type WorkspaceProps = {
  projectId: string
  role: ProjectRole
}

function Workspace({ projectId, role }: WorkspaceProps) {
  const canEdit = role === 'OWNER' || role === 'EDITOR'
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [activeFileId, setActiveFileId] = useState<string>('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')
  const [createFileError, setCreateFileError] = useState('')
  const { connectionState, messages, sendTestMessage } = useProjectSocket(projectId)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoadState('loading')
      try {
        const projectFiles = await api.getProjectFiles(projectId)
        if (cancelled) return

        setFiles(projectFiles)
        setActiveFileId(projectFiles[0]?.id ?? '')
        setLoadState('ready')
      } catch (err) {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Failed to load project')
        setLoadState('error')
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const activeFile = files.find((file) => file.id === activeFileId)
  const { document: collabDocument, syncState, presentUsers } = useCollaborativeDocument(projectId, activeFileId)

  const handleSave = async () => {
    if (!activeFile || !collabDocument) return
    setSaveState('saving')
    try {
      const content = collabDocument.getContent()
      const saved = await api.updateFileContent(activeFile.id, content)
      setFiles((prevFiles) => prevFiles.map((file) => (file.id === saved.id ? saved : file)))
      setSaveState('idle')
    } catch {
      setSaveState('error')
    }
  }

  const handleCreateFile = async (path: string) => {
    setCreateFileError('')
    const name = path.split('/').pop() || path
    try {
      const file = await api.createFile(projectId, { name, path, language: inferLanguage(path), content: '' })
      setFiles((prevFiles) => [...prevFiles, file])
      setActiveFileId(file.id)
    } catch (err) {
      setCreateFileError(err instanceof ApiError ? err.message : 'Failed to create file')
    }
  }

  if (loadState === 'loading') {
    return <div className="workspace-status">Loading project…</div>
  }

  if (loadState === 'error' || !activeFile) {
    return (
      <div className="workspace-status">
        Failed to load project{errorMessage ? `: ${errorMessage}` : ''}. Is the backend running?
      </div>
    )
  }

  return (
    <div className="workspace">
      <FileExplorer
        files={files}
        activeFileId={activeFile.id}
        onSelectFile={setActiveFileId}
        onCreateFile={handleCreateFile}
        createError={createFileError}
        canCreateFiles={canEdit}
      />
      <div className="editor-area">
        <div className="editor-tab">
          <span>{activeFile.name}</span>
          {canEdit ? (
            <button
              type="button"
              className="save-button"
              onClick={handleSave}
              disabled={syncState !== 'synced' || saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save'}
            </button>
          ) : (
            <span className="editor-tab__readonly">👁️ View Only</span>
          )}
          {saveState === 'error' && <span className="save-error">Save failed</span>}
          <PresenceBar users={presentUsers} />
        </div>
        <div className="editor-surface">
          <CodeEditor
            language={activeFile.language}
            document={collabDocument}
            syncState={syncState}
            readOnly={!canEdit}
          />
        </div>
      </div>
      <CollabPanel
        projectId={projectId}
        connectionState={connectionState}
        messages={messages}
        onSendTestMessage={sendTestMessage}
      />
    </div>
  )
}

export default Workspace
