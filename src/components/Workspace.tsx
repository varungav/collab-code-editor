import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import { useCollaborativeDocument } from '../hooks/useCollaborativeDocument'
import { useProjectSocket } from '../hooks/useProjectSocket'
import type { FileItem } from '../types/file'
import type { ProjectRole } from '../types/members'
import BreadcrumbBar from './BreadcrumbBar'
import CollabPanel from './CollabPanel'
import EditorTabs from './EditorTabs'
import FileExplorer, { type RevealSignal } from './FileExplorer'
import CodeEditor from './CodeEditor'
import PresenceBar from './PresenceBar'
import SaveStatus from './SaveStatus'

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

// Stable reference for the common case (no unsaved changes), so FileExplorer
// doesn't see a new Set identity on every render when nothing is dirty.
const EMPTY_DIRTY_SET = new Set<string>()

type WorkspaceProps = {
  projectId: string
  role: ProjectRole
  projectName: string
}

function Workspace({ projectId, role, projectName }: WorkspaceProps) {
  const canEdit = role === 'OWNER' || role === 'EDITOR'
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [activeFileId, setActiveFileId] = useState<string>('')
  // Every file currently held open as a tab, in tab-strip order — distinct
  // from `activeFileId` (which of these is actually showing) and from
  // `files` (the whole project). Not persisted anywhere; a fresh page load
  // starts back at just the one auto-opened file, same as before tabs.
  const [openTabIds, setOpenTabIds] = useState<string[]>([])
  // VS Code's "preview tab": at most one open tab is a lightweight preview
  // (shown in italics) — clicking another file in the explorer replaces it
  // in place instead of piling up a new tab for every file just glanced at.
  // Editing it, or double-clicking it, "pins" it into a permanent tab (see
  // handleSelectFile and the isDirty-promotion effect below).
  const [previewTabId, setPreviewTabId] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')
  // Shared across create/rename/delete failures — surfaced via the
  // explorer's own toast (see FileExplorer), so one channel covers all
  // three rather than a separate error prop per operation.
  const [explorerError, setExplorerError] = useState('')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [revealSignal, setRevealSignal] = useState<RevealSignal | null>(null)
  const { connectionState, messages, sendTestMessage } = useProjectSocket(projectId)

  // Breadcrumb bar → explorer: reveal + select a folder there, un-hiding
  // the sidebar first if it's currently toggled off (Ctrl/Cmd+B).
  const handleRevealFolder = useCallback((folderPath: string) => {
    setSidebarVisible(true)
    setRevealSignal((prev) => ({ path: folderPath, token: (prev?.token ?? 0) + 1 }))
  }, [])

  // Exposed to the explorer's "Refresh" toolbar button as well as used for
  // the initial load, so both paths stay in sync with the same logic.
  const isFirstLoad = useRef(true)
  const loadFiles = useCallback(async () => {
    setLoadState('loading')
    try {
      const projectFiles = await api.getProjectFiles(projectId)
      setFiles(projectFiles)
      setActiveFileId((prev) => (prev && projectFiles.some((file) => file.id === prev) ? prev : projectFiles[0]?.id ?? ''))
      setOpenTabIds((prev) => {
        const stillValid = prev.filter((id) => projectFiles.some((file) => file.id === id))
        return stillValid.length > 0 ? stillValid : projectFiles[0] ? [projectFiles[0].id] : []
      })
      // Seed the very first tab as a preview only on the first-ever load —
      // a later "Refresh" click shouldn't invent a new preview tab out of
      // nowhere; it should just drop the preview flag if that file is gone,
      // same as anything else about the currently open tabs.
      if (isFirstLoad.current) {
        isFirstLoad.current = false
        setPreviewTabId(projectFiles[0]?.id ?? null)
      } else {
        setPreviewTabId((prev) => (prev && projectFiles.some((file) => file.id === prev) ? prev : null))
      }
      setLoadState('ready')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load project')
      setLoadState('error')
    }
  }, [projectId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const activeFile = files.find((file) => file.id === activeFileId)
  const openFiles = openTabIds.flatMap((id) => {
    const file = files.find((f) => f.id === id)
    return file ? [file] : []
  })
  // Editing the preview tab promotes it to a permanent one, VS Code-style —
  // once you've actually changed something, it shouldn't be eligible to get
  // silently replaced by the next file you glance at in the explorer. Tied
  // directly to the document's own change event (see useCollaborativeDocument)
  // rather than derived from `isDirty` across renders, which has a one-tick
  // staleness window right after switching files.
  const handleDirty = useCallback(() => {
    setPreviewTabId((prev) => (prev === activeFileId ? null : prev))
  }, [activeFileId])

  const {
    document: collabDocument,
    syncState,
    presentUsers,
    isDirty,
    markSaved,
  } = useCollaborativeDocument(projectId, activeFileId, handleDirty)

  // A plain ref, not the `saveState` React state, guards against overlapping
  // saves — `setSaveState('saving')` doesn't take effect in any closure
  // until the next render, so a burst of Ctrl/Cmd+S presses fired faster
  // than React re-renders would otherwise all still read the same stale
  // `saveState === 'idle'` and all pass the check. A ref mutation is
  // immediate, so this actually stops the 2nd+ call in the same burst.
  const isSavingRef = useRef(false)
  const handleSave = useCallback(async () => {
    // `!isDirty` is what actually stops a mashed Ctrl/Cmd+S from spamming
    // requests in practice: on a fast connection, one save can finish (and
    // clear isDirty) before the next keypress even arrives, so the
    // in-flight guard below alone wouldn't catch repeats spaced that far
    // apart — but there's genuinely nothing to save once the content
    // already matches what's persisted, so skip the request entirely.
    if (!activeFile || !collabDocument || !canEdit || syncState !== 'synced' || !isDirty || isSavingRef.current) return
    isSavingRef.current = true
    setSaveState('saving')
    try {
      const content = collabDocument.getContent()
      const saved = await api.updateFileContent(activeFile.id, content)
      setFiles((prevFiles) => prevFiles.map((file) => (file.id === saved.id ? saved : file)))
      markSaved()
      setSaveState('idle')
    } catch {
      setSaveState('error')
    } finally {
      isSavingRef.current = false
    }
  }, [activeFile, collabDocument, canEdit, syncState, isDirty, markSaved])

  const handleCreateFile = async (path: string) => {
    setExplorerError('')
    const name = path.split('/').pop() || path
    try {
      const file = await api.createFile(projectId, { name, path, language: inferLanguage(path), content: '' })
      setFiles((prevFiles) => [...prevFiles, file])
      // A file you just created opens as a permanent tab, not a preview —
      // you created it to work in it, unlike glancing at an existing file.
      setOpenTabIds((prev) => (prev.includes(file.id) ? prev : [...prev, file.id]))
      setActiveFileId(file.id)
    } catch (err) {
      setExplorerError(err instanceof ApiError ? err.message : 'Failed to create file')
    }
  }

  // Removes one file's id from every place Workspace tracks open files —
  // shared by both delete paths below (a single file, or every file under
  // a deleted folder) so the tab/preview/active-file bookkeeping only
  // lives in one place.
  const forgetFile = useCallback(
    (fileId: string, remainingFiles: FileItem[]) => {
      // Closing the last open tab left `activeFileId` as '' with nothing in
      // `openTabIds` to fall back to, which made the workspace mistake "no
      // tab open" for "failed to load" (see the `!activeFile` guard below).
      // Falling back to another file in the project — as a fresh preview
      // tab, VS Code-style — keeps the editor showing something real.
      let fallbackId: string | null = null
      setOpenTabIds((prev) => {
        const closingIndex = prev.indexOf(fileId)
        const next = prev.filter((id) => id !== fileId)
        if (fileId !== activeFileId) return next
        if (next.length > 0) {
          setActiveFileId(next[closingIndex] ?? next[closingIndex - 1] ?? next[0])
          return next
        }
        fallbackId = remainingFiles[0]?.id ?? null
        setActiveFileId(fallbackId ?? '')
        return fallbackId ? [fallbackId] : []
      })
      setPreviewTabId((prev) => (prev === fileId ? fallbackId : prev))
    },
    [activeFileId],
  )

  const handleDeleteFile = useCallback(
    async (fileId: string, fileName: string) => {
      if (!window.confirm(`Delete "${fileName}"? This can't be undone.`)) return
      setExplorerError('')
      try {
        await api.deleteFile(fileId)
        const remaining = files.filter((file) => file.id !== fileId)
        setFiles(remaining)
        forgetFile(fileId, remaining)
      } catch (err) {
        setExplorerError(err instanceof ApiError ? err.message : `Failed to delete "${fileName}"`)
      }
    },
    [files, forgetFile],
  )

  // A folder isn't a real entity (see FileExplorer's own comment on this) —
  // "deleting" one means deleting every file whose path is under it. Best
  // effort: files that fail to delete stay in the list rather than silently
  // vanishing from the UI while still existing on the server.
  const handleDeleteFolder = useCallback(
    async (folderPath: string, folderName: string) => {
      const targets = files.filter(
        (file) => file.path === folderPath || file.path.startsWith(`${folderPath}/`),
      )
      if (targets.length === 0) return
      if (
        !window.confirm(
          `Delete "${folderName}" and its ${targets.length} file${targets.length === 1 ? '' : 's'}? This can't be undone.`,
        )
      ) {
        return
      }
      setExplorerError('')
      const results = await Promise.allSettled(targets.map((file) => api.deleteFile(file.id)))
      const deletedIds = new Set(
        targets.filter((_, index) => results[index]?.status === 'fulfilled').map((file) => file.id),
      )
      const remaining = files.filter((file) => !deletedIds.has(file.id))
      setFiles(remaining)
      for (const id of deletedIds) forgetFile(id, remaining)
      if (deletedIds.size < targets.length) {
        setExplorerError(`Failed to delete ${targets.length - deletedIds.size} file(s) in "${folderName}"`)
      }
    },
    [files, forgetFile],
  )

  const handleRenameFile = useCallback(async (fileId: string, newPath: string) => {
    setExplorerError('')
    try {
      const updated = await api.renameFile(fileId, newPath)
      setFiles((prev) => prev.map((file) => (file.id === fileId ? updated : file)))
    } catch (err) {
      setExplorerError(err instanceof ApiError ? err.message : 'Failed to rename file')
      throw err
    }
  }, [])

  // `pin: true` (a double-click) opens it as a permanent tab straight away;
  // the default (a single click) opens it as the preview tab — replacing
  // whatever the current preview tab is, rather than piling up a new tab
  // for every file just glanced at. Selecting a file that's already open
  // (of either kind) just switches to it, except pinning promotes it if it
  // was the preview.
  const handleSelectFile = useCallback(
    (fileId: string, pin = false) => {
      setActiveFileId(fileId)

      if (openTabIds.includes(fileId)) {
        if (pin && previewTabId === fileId) setPreviewTabId(null)
        return
      }

      if (previewTabId && !pin) {
        setOpenTabIds((prev) => prev.map((id) => (id === previewTabId ? fileId : id)))
      } else {
        setOpenTabIds((prev) => [...prev, fileId])
      }
      setPreviewTabId(pin ? null : fileId)
    },
    [openTabIds, previewTabId],
  )

  // Only the active tab has a live Yjs connection to check for unsaved
  // changes (see useCollaborativeDocument) — background tabs can't be
  // checked the same way, so closing one of those just closes it.
  const handleCloseTab = useCallback(
    (fileId: string) => {
      if (fileId === activeFileId && isDirty) {
        const name = activeFile?.name ?? 'This file'
        const proceed = window.confirm(`${name} has unsaved changes. Close anyway?`)
        if (!proceed) return
      }

      setOpenTabIds((prev) => {
        const closingIndex = prev.indexOf(fileId)
        const next = prev.filter((id) => id !== fileId)
        if (fileId === activeFileId) {
          const nextActive = next[closingIndex] ?? next[closingIndex - 1] ?? ''
          setActiveFileId(nextActive)
        }
        return next
      })
      setPreviewTabId((prev) => (prev === fileId ? null : prev))
    },
    [activeFileId, isDirty, activeFile],
  )

  // Application-level shortcuts that VS Code has but Monaco itself doesn't
  // provide (those are about the surrounding tab/sidebar chrome, not text
  // editing). Monaco already ships VS Code's own in-editor shortcuts for
  // free — find, replace, multi-cursor, comment-toggle, etc. — since it's
  // literally the same editor component, so none of that is reimplemented
  // here. Registered on window with capture so it fires regardless of
  // whether focus is in the editor, the tree, or elsewhere on the page.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey
      if (!mod) return

      const key = event.key.toLowerCase()

      if (key === 's') {
        event.preventDefault()
        handleSave()
        return
      }
      if (key === 'w') {
        event.preventDefault()
        if (activeFileId) handleCloseTab(activeFileId)
        return
      }
      if (event.key === 'PageDown') {
        event.preventDefault()
        if (openFiles.length < 2) return
        const index = openFiles.findIndex((file) => file.id === activeFileId)
        const next = openFiles[(index + 1) % openFiles.length]
        if (next) handleSelectFile(next.id)
        return
      }
      if (event.key === 'PageUp') {
        event.preventDefault()
        if (openFiles.length < 2) return
        const index = openFiles.findIndex((file) => file.id === activeFileId)
        const prev = openFiles[(index - 1 + openFiles.length) % openFiles.length]
        if (prev) handleSelectFile(prev.id)
        return
      }
      if (key === 'b') {
        event.preventDefault()
        setSidebarVisible((prev) => !prev)
        return
      }
      if (/^[1-9]$/.test(event.key)) {
        const target = openFiles[Number(event.key) - 1]
        if (target) {
          event.preventDefault()
          handleSelectFile(target.id)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeFileId, openFiles, handleSave, handleCloseTab, handleSelectFile])

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
      {sidebarVisible && (
        <FileExplorer
          projectName={projectName}
          files={files}
          activeFileId={activeFile.id}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onRefresh={loadFiles}
          onDeleteFile={handleDeleteFile}
          onDeleteFolder={handleDeleteFolder}
          onRenameFile={handleRenameFile}
          createError={explorerError}
          canCreateFiles={canEdit}
          dirtyFileIds={isDirty ? new Set([activeFile.id]) : EMPTY_DIRTY_SET}
          revealSignal={revealSignal}
        />
      )}
      <div className="editor-area">
        <EditorTabs
          openFiles={openFiles}
          activeFileId={activeFile.id}
          previewTabId={previewTabId}
          isActiveDirty={isDirty}
          onSelectTab={handleSelectFile}
          onCloseTab={handleCloseTab}
        />
        <BreadcrumbBar path={activeFile.path} onRevealFolder={handleRevealFolder} />
        {/* Only rendered when there's actually something to show — save
            status is its own floating pill now (see SaveStatus below), not
            a reason for this row to exist. */}
        {(!canEdit || presentUsers.some((user) => !user.self)) && (
          <div className="editor-tab">
            {!canEdit && <span className="editor-tab__readonly">👁️ View Only</span>}
            <PresenceBar users={presentUsers} />
          </div>
        )}
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
      <SaveStatus state={saveState} />
    </div>
  )
}

export default Workspace
