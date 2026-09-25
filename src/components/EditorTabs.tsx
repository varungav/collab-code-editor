import { useSingleOrDoubleClick } from '../hooks/useSingleOrDoubleClick'
import type { FileItem } from '../types/file'
import { badgeForFile } from '../utils/fileIcons'

type EditorTabsProps = {
  openFiles: FileItem[]
  activeFileId: string
  // At most one open tab is the "preview" tab (shown in italics) — clicking
  // another file in the explorer replaces it instead of adding a new tab.
  previewTabId: string | null
  isActiveDirty: boolean
  onSelectTab: (fileId: string, pin?: boolean) => void
  onCloseTab: (fileId: string) => void
}

type TabProps = {
  file: FileItem
  isActive: boolean
  isPreview: boolean
  isDirty: boolean
  onSelectTab: (fileId: string, pin?: boolean) => void
  onCloseTab: (fileId: string) => void
}

// Its own component (rather than inlined in the `.map()` below) because it
// needs its own useSingleOrDoubleClick instance — hooks can't be called
// inside a loop.
function Tab({ file, isActive, isPreview, isDirty, onSelectTab, onCloseTab }: TabProps) {
  const badge = badgeForFile(file.name)
  const clickHandlers = useSingleOrDoubleClick(
    () => onSelectTab(file.id),
    () => onSelectTab(file.id, true),
  )

  return (
    <div
      role="tab"
      aria-selected={isActive}
      className={`editor-tabs__tab${isActive ? ' is-active' : ''}${isPreview ? ' is-preview' : ''}`}
      onMouseDown={(event) => {
        // Middle-click closes the tab, same as VS Code / most browsers.
        if (event.button === 1) {
          event.preventDefault()
          onCloseTab(file.id)
        }
      }}
      {...clickHandlers}
    >
      <span className="editor-tabs__badge" style={{ color: badge.color }}>
        {badge.label}
      </span>
      <span className={`editor-tabs__name${isDirty ? ' is-dirty' : ''}`}>{file.name}</span>
      {/* Persistent, like the explorer's own "M" badge — not swapped with
          the × on hover, the two sit side by side. */}
      {isDirty && (
        <span className="editor-tabs__modified-badge" title="Unsaved changes">
          M
        </span>
      )}
      <button
        type="button"
        className="editor-tabs__close"
        aria-label={`Close ${file.name}`}
        onClick={(event) => {
          event.stopPropagation()
          onCloseTab(file.id)
        }}
      >
        <span className="editor-tabs__close-x" aria-hidden="true">
          ×
        </span>
      </button>
    </div>
  )
}

// Horizontal strip of every currently-open file, VS Code-style — distinct
// from the file explorer's tree (which shows the whole project) and from
// `activeFileId` (which of these open tabs is currently shown in the
// editor). Only the active tab has live dirty-tracking (see Workspace), so
// that's the only one that can show a modified dot; background tabs simply
// don't carry that information without a live Yjs connection to each.
function EditorTabs({ openFiles, activeFileId, previewTabId, isActiveDirty, onSelectTab, onCloseTab }: EditorTabsProps) {
  if (openFiles.length === 0) return null

  return (
    <div className="editor-tabs" role="tablist" aria-label="Open files">
      {openFiles.map((file) => (
        <Tab
          key={file.id}
          file={file}
          isActive={file.id === activeFileId}
          isPreview={file.id === previewTabId}
          isDirty={file.id === activeFileId && isActiveDirty}
          onSelectTab={onSelectTab}
          onCloseTab={onCloseTab}
        />
      ))}
    </div>
  )
}

export default EditorTabs
