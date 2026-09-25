import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import ContextMenu, { type ContextMenuItem } from './ContextMenu'
import { useSingleOrDoubleClick } from '../hooks/useSingleOrDoubleClick'
import type { FileItem, FileTreeNode } from '../types/file'
import { badgeForFile, FILE_BADGE } from '../utils/fileIcons'

// A one-time "expand down to this path" command — bumping `token` (even for
// the same `path` clicked twice) is what makes it re-fire, the same way
// `collapseSignal` below is a bump-to-trigger counter rather than a
// persisted "must stay open" state.
export type RevealSignal = { path: string; token: number }

type FileExplorerProps = {
  projectName: string
  files: FileItem[]
  activeFileId: string
  onSelectFile: (fileId: string, pin?: boolean) => void
  onCreateFile: (path: string) => void
  onRefresh: () => void
  createError?: string
  canCreateFiles: boolean
  // File ids with unsaved changes — currently only ever contains the file
  // that's actively open, since that's the only one with a live Yjs
  // connection to detect edits on (see Workspace/useCollaborativeDocument).
  dirtyFileIds: Set<string>
  // Set from the editor's breadcrumb bar when a folder segment is clicked —
  // expands the explorer tree down to and selects that folder.
  revealSignal?: RevealSignal | null
  onDeleteFile: (fileId: string, fileName: string) => void
  onDeleteFolder: (folderPath: string, folderName: string) => void
  onRenameFile: (fileId: string, newPath: string) => Promise<void>
}

// Whether any file nested anywhere under this folder (at any depth) has
// unsaved changes — used to bubble the modified indicator up to ancestor
// folders as a plain dot, VS Code-style, rather than only marking the file
// itself.
function hasDirtyDescendant(children: FileTreeNode[], dirtyFileIds: Set<string>): boolean {
  for (const child of children) {
    if (child.type === 'file') {
      if (dirtyFileIds.has(child.file.id)) return true
    } else if (hasDirtyDescendant(child.children, dirtyFileIds)) {
      return true
    }
  }
  return false
}

// `virtualFolders` are folders the user has created but not yet put a file
// in — since there's no folder entity in the backend (folders are purely
// derived from file paths), an empty one only exists client-side, for this
// session, until a real file lands in it (see FileExplorer's cleanup effect).
function buildTree(files: FileItem[], virtualFolders: string[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  function ensureFolder(segments: string[]): FileTreeNode[] {
    let currentLevel = root
    let currentPath = ''
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      let folder = currentLevel.find(
        (node): node is Extract<FileTreeNode, { type: 'folder' }> =>
          node.type === 'folder' && node.path === currentPath,
      )
      if (!folder) {
        folder = { type: 'folder', name: segment, path: currentPath, children: [] }
        currentLevel.push(folder)
      }
      currentLevel = folder.children
    }
    return currentLevel
  }

  for (const file of files) {
    const segments = file.path.split('/')
    const name = segments.pop() as string
    const level = ensureFolder(segments)
    level.push({ type: 'file', name, path: file.path, file })
  }

  for (const folderPath of virtualFolders) {
    ensureFolder(folderPath.split('/'))
  }

  return root
}

// Matches VS Code's thin codicon chevron (a simple stroked "v"/">" shape,
// not a solid triangle glyph) — rotates from pointing right to pointing
// down when expanded, animated via CSS rather than swapping icons.
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`file-explorer__chevron${expanded ? ' file-explorer__chevron--open' : ''}`}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NewFileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6l-4-4z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M8 8.5v4M6 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function NewFolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 4.5A1.5 1.5 0 013.5 3h2.6l1.4 1.5h5A1.5 1.5 0 0114 6v5.5A1.5 1.5 0 0112.5 13h-9A1.5 1.5 0 012 11.5v-7z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M8 7.5v4M6 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M12.9 7.5A4.9 4.9 0 104 10.4M12.9 7.5V4M12.9 7.5H9.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CollapseAllIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 9.5l4-4 4 4M4 6l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Custom tooltip (rather than the native `title` attribute) so it can match
// VS Code's dark bordered tooltip styling instead of each browser's own
// system tooltip look/delay. Rendered through a portal into document.body
// and positioned from the button's actual screen coordinates — the sidebar
// itself clips overflow-x (a side effect of `overflow-y: auto`), so a
// tooltip positioned relative to the button, inside the sidebar, gets cut
// off for icons near the panel's edge.
function ToolbarButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleShow = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    showTimer.current = setTimeout(() => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) setTooltipPos({ top: rect.bottom + 6, left: rect.left + rect.width / 2 })
    }, 350)
  }

  const hide = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    setTooltipPos(null)
  }

  useEffect(() => () => hide(), [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        onClick={onClick}
        onMouseEnter={scheduleShow}
        onMouseLeave={hide}
        onFocus={scheduleShow}
        onBlur={hide}
      >
        {children}
      </button>
      {tooltipPos &&
        createPortal(
          <span
            className="file-explorer__tooltip file-explorer__tooltip--portal"
            role="tooltip"
            style={{ top: tooltipPos.top, left: tooltipPos.left }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  )
}

// Inline row with a text input in place of a label, matching VS Code's
// "type the name right in the tree" flow instead of a separate form at the
// bottom. Committing happens on Enter or on blur (so clicking away outside
// the input finalizes a typed name, same as VS Code) — but an empty value
// at either point cancels instead of creating anything ("undo").
function InlineCreateRow({
  mode,
  paddingLeft,
  placeholder,
  initialValue,
  validate,
  onCommit,
  onCancel,
}: {
  mode: 'file' | 'folder'
  paddingLeft: number
  placeholder: string
  // Pre-fills and selects the field — used for rename (the existing name)
  // rather than creating something new (which always starts blank).
  initialValue?: string
  // Re-checked on every keystroke (a duplicate path, say) — while it
  // returns a message, Enter/blur is a no-op rather than a submit, and the
  // message shows right under the input, VS Code-style, instead of only
  // surfacing after a rejected commit.
  validate?: (value: string) => string | null
  // Returning `false` means the name was rejected — kept as a backstop for
  // rejections `validate` can't catch client-side (e.g. the server losing a
  // race with another client), so the row still stays open to retry rather
  // than vanishing. `true`/`undefined` means accepted.
  onCommit: (value: string) => boolean | void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const resolvedRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const trimmedValue = value.trim()
  const validationError = trimmedValue && validate ? validate(trimmedValue) : null

  const resolve = () => {
    if (resolvedRef.current) return
    if (!trimmedValue) {
      resolvedRef.current = true
      onCancel()
      return
    }
    if (validationError) return
    const accepted = onCommit(trimmedValue)
    if (accepted === false) return
    resolvedRef.current = true
  }

  const cancel = () => {
    if (resolvedRef.current) return
    resolvedRef.current = true
    onCancel()
  }

  return (
    <>
      <div className="file-explorer__row file-explorer__row--inline-create" style={{ paddingLeft }}>
        <div className={`file-explorer__inline-create-box${validationError ? ' has-error' : ''}`}>
          <span className="file-explorer__icon">
            {mode === 'folder' ? <Chevron expanded /> : <InlineFileIcon typedName={value} />}
          </span>
          <input
            ref={inputRef}
            className="file-explorer__inline-input"
            value={value}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                resolve()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
              }
            }}
            onBlur={resolve}
          />
        </div>
      </div>
      {validationError && (
        <div className="file-explorer__inline-error" style={{ marginLeft: paddingLeft }}>
          {validationError}
        </div>
      )}
    </>
  )
}

function FileBadge({ name }: { name: string }) {
  const badge = badgeForFile(name)
  return (
    <span className="file-explorer__badge" style={{ color: badge.color }}>
      {badge.label}
    </span>
  )
}

// Default icon for a not-yet-named (or unrecognized-extension) file, shown
// while typing a new filename before it resolves to a known type.
function GenericFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3h9M3.5 6.5h9M3.5 10h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// Re-resolves on every keystroke so the icon updates live as the user types
// an extension, same as VS Code's inline new-file input.
function InlineFileIcon({ typedName }: { typedName: string }) {
  const trimmed = typedName.trim()
  const extension = trimmed.includes('.') ? trimmed.split('.').pop()?.toLowerCase() : undefined
  const badge = extension ? FILE_BADGE[extension] : undefined
  if (!badge) return <GenericFileIcon />
  return (
    <span className="file-explorer__badge" style={{ color: badge.color }}>
      {badge.label}
    </span>
  )
}

// What's currently being created, and where. `targetFolder` is the path of
// the folder it's being created inside (empty string = project root) —
// resolved from whatever the user last clicked (see resolveTargetFolder).
//
// Creating a folder commits immediately as an empty (virtual) folder — it
// doesn't require a file to "count" — and then pivots into a 'file' create
// targeting that new folder, so a file can optionally be added right away.
// Canceling that file step (Escape, or blurring it empty) only cancels the
// file: the folder that was already committed stays exactly as it is.
type CreatingState = { kind: 'file'; targetFolder: string } | { kind: 'folder-name'; targetFolder: string } | null

type SelectedTarget = { type: 'folder'; path: string } | { type: 'root' } | null

// Renders the in-progress create row for one location in the tree — shared
// between the root level and every folder's children, so the same state
// machine works regardless of where creation was triggered from.
function CreateBlock({
  creating,
  targetFolder,
  depth,
  existingPaths,
  onCreateFile,
  onFolderCreated,
  onDuplicate,
  setCreating,
}: {
  creating: CreatingState
  targetFolder: string
  depth: number
  existingPaths: Set<string>
  onCreateFile: (path: string) => void
  onFolderCreated: (path: string) => void
  onDuplicate: (path: string) => void
  setCreating: (state: CreatingState) => void
}) {
  if (!creating || creating.targetFolder !== targetFolder) return null
  const basePadding = 8 + depth * 14

  if (creating.kind === 'file') {
    return (
      <InlineCreateRow
        mode="file"
        paddingLeft={basePadding + 14}
        placeholder="filename"
        validate={(name) => {
          const path = targetFolder ? `${targetFolder}/${name}` : name
          return existingPaths.has(path)
            ? `A file or folder ${name} already exists at this location. Please choose a different name.`
            : null
        }}
        onCommit={(name) => {
          const path = targetFolder ? `${targetFolder}/${name}` : name
          // Backstop for a duplicate `validate` couldn't catch client-side
          // (e.g. the server losing a race with another client creating
          // the same path a moment earlier) — the backend's own unique-path
          // constraint is still there regardless.
          if (existingPaths.has(path)) {
            onDuplicate(path)
            return false
          }
          onCreateFile(path)
          setCreating(null)
        }}
        onCancel={() => setCreating(null)}
      />
    )
  }

  return (
    <InlineCreateRow
      mode="folder"
      paddingLeft={basePadding}
      placeholder="folder name"
      onCommit={(name) => {
        const folderPath = targetFolder ? `${targetFolder}/${name}` : name
        onFolderCreated(folderPath)
        setCreating({ kind: 'file', targetFolder: folderPath })
      }}
      onCancel={() => setCreating(null)}
    />
  )
}

function FileExplorer({
  projectName,
  files,
  activeFileId,
  onSelectFile,
  onCreateFile,
  onRefresh,
  createError,
  canCreateFiles,
  dirtyFileIds,
  revealSignal,
  onDeleteFile,
  onDeleteFolder,
  onRenameFile,
}: FileExplorerProps) {
  const existingPaths = useMemo(() => new Set(files.map((file) => file.path)), [files])

  // The file currently showing an inline rename input in place of its
  // label — at most one at a time, same as `creating` for new files/folders.
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    target: { type: 'file'; file: FileItem } | { type: 'folder'; path: string; name: string }
  } | null>(null)

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }
  // The backend's own rejection (e.g. a race with another client creating
  // the same path) surfaces through this same toast, not just the client-
  // side duplicate check above.
  useEffect(() => {
    if (createError) showToast(createError)
  }, [createError])
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // Folders created but not yet holding a file — client-side only until a
  // real file lands in one (or a page reload, since nothing was ever
  // persisted for an empty folder). Filtered at render time (not via an
  // effect+setState) to drop any that now have a real file at or under
  // them, so this doesn't grow stale as files get added.
  const [virtualEmptyFolders, setVirtualEmptyFolders] = useState<string[]>([])
  const effectiveVirtualFolders = useMemo(
    () =>
      virtualEmptyFolders.filter(
        (folderPath) => !files.some((file) => file.path === folderPath || file.path.startsWith(`${folderPath}/`)),
      ),
    [files, virtualEmptyFolders],
  )

  const tree = useMemo(() => buildTree(files, effectiveVirtualFolders), [files, effectiveVirtualFolders])
  const [treeExpanded, setTreeExpanded] = useState(true)
  // Bumped by "Collapse Folders in Explorer" — each folder row watches this
  // and closes itself, since expand/collapse state otherwise lives locally
  // per folder with no shared parent state to reset in one place.
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [creating, setCreating] = useState<CreatingState>(null)
  // Where "New File"/"New Folder" should land:
  //  - { type: 'folder', path } — an explicitly clicked folder
  //  - { type: 'root' }         — explicitly clicked empty space outside the tree
  //  - null                     — no explicit choice made yet; falls back to
  //                                whichever file is currently open
  // Clicking a file clears this back to null (rather than setting 'root'),
  // so the fallback to that file's own parent folder takes over.
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>(null)
  const selectedFolderPath = selectedTarget?.type === 'folder' ? selectedTarget.path : null

  const handleSelectFile = (fileId: string, pin?: boolean) => {
    setSelectedTarget(null)
    onSelectFile(fileId, pin)
  }

  const handleSelectFolder = (path: string) => {
    setSelectedTarget({ type: 'folder', path })
  }

  // Reacts to the breadcrumb bar revealing a folder: makes sure the panel
  // itself is expanded and that folder is highlighted, same as clicking it
  // directly in the tree. Expanding the actual ancestor chain down to it is
  // handled per-folder in FileTreeEntry (mirrors collapseSignal).
  useEffect(() => {
    if (!revealSignal) return
    setTreeExpanded(true)
    setSelectedTarget({ type: 'folder', path: revealSignal.path })
  }, [revealSignal])

  const handleFolderCreated = (path: string) => {
    setVirtualEmptyFolders((prev) => (prev.includes(path) ? prev : [...prev, path]))
  }

  // Where a new file/folder created from the toolbar should land: an
  // explicitly-selected folder or explicit root if there is one, else the
  // parent folder of whichever file is currently open, else the root.
  const resolveTargetFolder = (): string => {
    if (selectedTarget?.type === 'folder') return selectedTarget.path
    if (selectedTarget?.type === 'root') return ''
    const activeFile = files.find((file) => file.id === activeFileId)
    if (activeFile) {
      const segments = activeFile.path.split('/')
      segments.pop()
      return segments.join('/')
    }
    return ''
  }

  const handleNewFileClick = () => {
    setTreeExpanded(true)
    setCreating({ kind: 'file', targetFolder: resolveTargetFolder() })
  }

  const handleNewFolderClick = () => {
    setTreeExpanded(true)
    setCreating({ kind: 'folder-name', targetFolder: resolveTargetFolder() })
  }

  // Right-clicking a row also selects it (same as a left-click would) so
  // that if "New File..."/"New Folder..." is chosen from the menu that
  // follows, resolveTargetFolder() already lands in the right place —
  // no separate "target" plumbing needed for those two menu items.
  const handleFileContextMenu = (event: ReactMouseEvent, file: FileItem) => {
    event.preventDefault()
    const segments = file.path.split('/')
    segments.pop()
    setSelectedTarget({ type: 'folder', path: segments.join('/') })
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: 'file', file } })
  }

  const handleFolderContextMenu = (event: ReactMouseEvent, path: string, name: string) => {
    event.preventDefault()
    setSelectedTarget({ type: 'folder', path })
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: 'folder', path, name } })
  }

  const contextMenuItems: ContextMenuItem[] = (() => {
    if (!contextMenu) return []
    const { target } = contextMenu
    const path = target.type === 'file' ? target.file.path : target.path
    const items: ContextMenuItem[] = []

    if (canCreateFiles) {
      items.push(
        { type: 'action', label: 'New File...', onSelect: handleNewFileClick },
        { type: 'action', label: 'New Folder...', onSelect: handleNewFolderClick },
        { type: 'separator' },
      )
    }

    items.push({
      type: 'action',
      label: 'Copy Path',
      onSelect: () => {
        navigator.clipboard.writeText(path).catch(() => showToast('Could not copy path'))
      },
    })

    if (canCreateFiles) {
      items.push({ type: 'separator' })
      // Renaming is file-only for now — a folder isn't a real entity here
      // (see buildTree's comment), so "renaming" one would mean bulk-moving
      // every file under it, a bigger operation than this pass covers.
      if (target.type === 'file') {
        items.push({
          type: 'action',
          label: 'Rename...',
          shortcut: 'F2',
          onSelect: () => setRenamingFileId(target.file.id),
        })
      }
      items.push({
        type: 'action',
        label: 'Delete',
        shortcut: 'Del',
        danger: true,
        onSelect: () => {
          if (target.type === 'file') onDeleteFile(target.file.id, target.file.name)
          else onDeleteFolder(target.path, target.name)
        },
      })
    }

    return items
  })()

  return (
    <nav
      className="file-explorer"
      aria-label="File explorer"
      onClick={(event) => {
        // Same "explicit root" reset as the tree's own empty-space handler,
        // for the blank area of the panel below all content.
        if (event.target === event.currentTarget) setSelectedTarget({ type: 'root' })
      }}
    >
      <div className="file-explorer__header">Explorer</div>
      <div className="file-explorer__project-label">
        <button
          type="button"
          className="file-explorer__project-toggle"
          onClick={() => setTreeExpanded((prev) => !prev)}
          aria-expanded={treeExpanded}
        >
          <Chevron expanded={treeExpanded} />
          <span className="file-explorer__project-name" title={projectName}>
            {projectName.toUpperCase()}
          </span>
        </button>
        <div className="file-explorer__toolbar">
          {canCreateFiles && (
            <>
              <ToolbarButton label="New File..." onClick={handleNewFileClick}>
                <NewFileIcon />
              </ToolbarButton>
              <ToolbarButton label="New Folder..." onClick={handleNewFolderClick}>
                <NewFolderIcon />
              </ToolbarButton>
            </>
          )}
          <ToolbarButton label="Refresh Explorer" onClick={onRefresh}>
            <RefreshIcon />
          </ToolbarButton>
          <ToolbarButton label="Collapse Folders in Explorer" onClick={() => setCollapseSignal((prev) => prev + 1)}>
            <CollapseAllIcon />
          </ToolbarButton>
        </div>
      </div>
      <div
        className={`file-explorer__tree-wrapper${treeExpanded ? '' : ' file-explorer__tree-wrapper--collapsed'}`}
      >
        <div
          className="file-explorer__tree"
          onClick={(event) => {
            // Clicking empty space below the last row (not any row itself)
            // explicitly targets the project root — distinct from "no
            // explicit choice", which instead falls back to the active file.
            if (event.target === event.currentTarget) setSelectedTarget({ type: 'root' })
          }}
        >
          <CreateBlock
            creating={creating}
            targetFolder=""
            depth={0}
            existingPaths={existingPaths}
            onCreateFile={onCreateFile}
            onFolderCreated={handleFolderCreated}
            onDuplicate={(path) => showToast(`"${path}" already exists`)}
            setCreating={setCreating}
          />
          {tree.map((node) => (
            <FileTreeEntry
              key={node.path}
              node={node}
              depth={0}
              activeFileId={activeFileId}
              onSelectFile={handleSelectFile}
              collapseSignal={collapseSignal}
              selectedFolderPath={selectedFolderPath}
              onSelectFolder={handleSelectFolder}
              creating={creating}
              existingPaths={existingPaths}
              onCreateFile={onCreateFile}
              onFolderCreated={handleFolderCreated}
              onDuplicate={(path) => showToast(`"${path}" already exists`)}
              setCreating={setCreating}
              dirtyFileIds={dirtyFileIds}
              revealSignal={revealSignal ?? null}
              renamingFileId={renamingFileId}
              onStartRename={setRenamingFileId}
              onRenameFile={onRenameFile}
              onFileContextMenu={handleFileContextMenu}
              onFolderContextMenu={handleFolderContextMenu}
              onDeleteFile={onDeleteFile}
              onDeleteFolder={onDeleteFolder}
              canCreateFiles={canCreateFiles}
            />
          ))}
        </div>
      </div>
      {toast && (
        <div className="file-explorer__toast" role="alert">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </nav>
  )
}

type FileTreeEntryProps = {
  node: FileTreeNode
  depth: number
  activeFileId: string
  onSelectFile: (fileId: string, pin?: boolean) => void
  collapseSignal: number
  selectedFolderPath: string | null
  onSelectFolder: (path: string) => void
  creating: CreatingState
  existingPaths: Set<string>
  onCreateFile: (path: string) => void
  onFolderCreated: (path: string) => void
  onDuplicate: (path: string) => void
  setCreating: (state: CreatingState) => void
  dirtyFileIds: Set<string>
  revealSignal: RevealSignal | null
  renamingFileId: string | null
  onStartRename: (fileId: string | null) => void
  onRenameFile: (fileId: string, newPath: string) => Promise<void>
  onFileContextMenu: (event: ReactMouseEvent, file: FileItem) => void
  onFolderContextMenu: (event: ReactMouseEvent, path: string, name: string) => void
  onDeleteFile: (fileId: string, fileName: string) => void
  onDeleteFolder: (folderPath: string, folderName: string) => void
  canCreateFiles: boolean
}

function FileTreeEntry({
  node,
  depth,
  activeFileId,
  onSelectFile,
  collapseSignal,
  selectedFolderPath,
  onSelectFolder,
  creating,
  existingPaths,
  onCreateFile,
  onFolderCreated,
  onDuplicate,
  revealSignal,
  setCreating,
  dirtyFileIds,
  renamingFileId,
  onStartRename,
  onRenameFile,
  onFileContextMenu,
  onFolderContextMenu,
  onDeleteFile,
  onDeleteFolder,
  canCreateFiles,
}: FileTreeEntryProps) {
  const [expanded, setExpanded] = useState(true)
  const [lastCollapseSignal, setLastCollapseSignal] = useState(collapseSignal)
  const [lastRevealToken, setLastRevealToken] = useState(revealSignal?.token ?? 0)
  const paddingLeft = 8 + depth * 14
  // Called unconditionally (rules of hooks) even though only the file
  // branch below actually renders with it wired up — folders select via
  // their own row handlers, not this.
  const fileClickHandlers = useSingleOrDoubleClick(
    () => {
      if (node.type === 'file') onSelectFile(node.file.id)
    },
    () => {
      if (node.type === 'file') onSelectFile(node.file.id, true)
    },
  )

  // Reacts to "Collapse All" without a `useEffect`: if the signal changed
  // since our last render, this is a new collapse request, so fold this
  // folder and remember the signal we've now handled.
  if (collapseSignal !== lastCollapseSignal) {
    setLastCollapseSignal(collapseSignal)
    if (expanded) setExpanded(false)
  }

  // Same one-time-trigger pattern for the breadcrumb bar's "reveal this
  // folder": expand once if we're an ancestor of (or exactly) the revealed
  // path, then remember the token so we don't re-fire on every render.
  if (revealSignal && revealSignal.token !== lastRevealToken) {
    setLastRevealToken(revealSignal.token)
    const isOnRevealPath = revealSignal.path === node.path || revealSignal.path.startsWith(`${node.path}/`)
    if (isOnRevealPath && !expanded) setExpanded(true)
  }

  if (node.type === 'folder') {
    const isSelected = selectedFolderPath === node.path
    // A pending create targeting this folder — or targeting something
    // further nested inside it — must stay visible even if this folder is
    // currently (or gets) collapsed, without touching the folder's own
    // remembered expand/collapse state. Checking the whole path, not just
    // an exact match, is what lets clicking a folder's name both select
    // *and* toggle it again below without that toggle ever being able to
    // hide a creation still in progress somewhere underneath it.
    const isOnCreatePath =
      creating !== null && (creating.targetFolder === node.path || creating.targetFolder.startsWith(`${node.path}/`))
    const effectiveExpanded = expanded || isOnCreatePath
    const isDirtyDescendant = dirtyFileIds.size > 0 && hasDirtyDescendant(node.children, dirtyFileIds)

    return (
      <div className="file-explorer__folder-wrapper">
        <div
          className={`file-explorer__row file-explorer__row--folder${isSelected ? ' is-selected' : ''}`}
          style={{ paddingLeft }}
        >
          <button
            type="button"
            className="file-explorer__chevron-button"
            onClick={(event) => {
              event.stopPropagation()
              setExpanded((prev) => !prev)
            }}
          >
            <Chevron expanded={effectiveExpanded} />
          </button>
          <button
            type="button"
            className="file-explorer__row-label-button"
            onClick={() => {
              onSelectFolder(node.path)
              setExpanded((prev) => !prev)
            }}
            onContextMenu={(event) => onFolderContextMenu(event, node.path, node.name)}
            onKeyDown={(event) => {
              if (canCreateFiles && (event.key === 'Delete' || event.key === 'Backspace')) {
                event.preventDefault()
                onDeleteFolder(node.path, node.name)
              }
            }}
          >
            <span className={`file-explorer__label${isDirtyDescendant ? ' is-dirty' : ''}`}>{node.name}</span>
            {isDirtyDescendant && (
              <span className="file-explorer__dirty-dot" title="Contains unsaved changes" aria-hidden="true" />
            )}
          </button>
        </div>
        {effectiveExpanded && (
          <div className="file-explorer__folder-children">
            {/* One continuous line for this folder's own column, spanning
                the full height of its children container — rather than a
                segment repeated on every descendant row, and rather than
                guessing a fixed pixel offset for where the header ends —
                so hovering anywhere in this subtree (via the CSS rule
                below) lights up the whole line at once, and nested folders'
                own lines layer independently on top of it. */}
            <span className="file-explorer__indent-guide-line" style={{ left: 16 + depth * 14 }} />
            <CreateBlock
              creating={creating}
              targetFolder={node.path}
              depth={depth + 1}
              existingPaths={existingPaths}
              onCreateFile={onCreateFile}
              onFolderCreated={onFolderCreated}
              onDuplicate={onDuplicate}
              setCreating={setCreating}
            />
            {node.children.map((child) => (
              <FileTreeEntry
                key={child.path}
                node={child}
                depth={depth + 1}
                activeFileId={activeFileId}
                onSelectFile={onSelectFile}
                collapseSignal={collapseSignal}
                selectedFolderPath={selectedFolderPath}
                onSelectFolder={onSelectFolder}
                creating={creating}
                existingPaths={existingPaths}
                onCreateFile={onCreateFile}
                onFolderCreated={onFolderCreated}
                onDuplicate={onDuplicate}
                setCreating={setCreating}
                dirtyFileIds={dirtyFileIds}
                revealSignal={revealSignal}
                renamingFileId={renamingFileId}
                onStartRename={onStartRename}
                onRenameFile={onRenameFile}
                onFileContextMenu={onFileContextMenu}
                onFolderContextMenu={onFolderContextMenu}
                onDeleteFile={onDeleteFile}
                onDeleteFolder={onDeleteFolder}
                canCreateFiles={canCreateFiles}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  const isActive = node.file.id === activeFileId
  const isDirty = dirtyFileIds.has(node.file.id)

  if (renamingFileId === node.file.id) {
    const segments = node.path.split('/')
    segments.pop()
    const parentFolder = segments.join('/')

    return (
      <InlineCreateRow
        mode="file"
        paddingLeft={paddingLeft + 14}
        placeholder="filename"
        initialValue={node.name}
        validate={(name) => {
          const newPath = parentFolder ? `${parentFolder}/${name}` : name
          if (newPath === node.path) return null
          return existingPaths.has(newPath)
            ? `A file or folder ${name} already exists at this location. Please choose a different name.`
            : null
        }}
        onCommit={(name) => {
          const newPath = parentFolder ? `${parentFolder}/${name}` : name
          onStartRename(null)
          // Duplicate paths are already caught by `validate` above before
          // this ever runs; a rejection reaching here is a genuine server
          // error, surfaced through the explorer's toast (see Workspace's
          // onRenameFile) rather than reopening this row to retry.
          if (newPath !== node.path) onRenameFile(node.file.id, newPath).catch(() => {})
        }}
        onCancel={() => onStartRename(null)}
      />
    )
  }

  return (
    <button
      type="button"
      className={`file-explorer__row file-explorer__row--file${isActive ? ' is-active' : ''}`}
      style={{ paddingLeft: paddingLeft + 14 }}
      onContextMenu={(event) => onFileContextMenu(event, node.file)}
      onKeyDown={(event) => {
        if (!canCreateFiles) return
        if (event.key === 'Delete' || event.key === 'Backspace') {
          event.preventDefault()
          onDeleteFile(node.file.id, node.name)
        } else if (event.key === 'F2') {
          event.preventDefault()
          onStartRename(node.file.id)
        }
      }}
      {...fileClickHandlers}
    >
      <FileBadge name={node.name} />
      <span className={`file-explorer__label${isDirty ? ' is-dirty' : ''}`}>{node.name}</span>
      {isDirty && (
        <span className="file-explorer__dirty-badge" title="Unsaved changes">
          M
        </span>
      )}
    </button>
  )
}

export default FileExplorer
