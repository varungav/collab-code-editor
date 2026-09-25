import { useMemo, useState, type FormEvent } from 'react'
import type { FileItem, FileTreeNode } from '../types/file'

type FileExplorerProps = {
  files: FileItem[]
  activeFileId: string
  onSelectFile: (fileId: string) => void
  onCreateFile: (path: string) => void
  createError?: string
  canCreateFiles: boolean
}

function buildTree(files: FileItem[]): FileTreeNode[] {
  const root: FileTreeNode[] = []

  for (const file of files) {
    const segments = file.path.split('/')
    let currentLevel = root
    let currentPath = ''

    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const isFile = index === segments.length - 1

      if (isFile) {
        currentLevel.push({ type: 'file', name: segment, path: currentPath, file })
        return
      }

      let folder = currentLevel.find(
        (node): node is Extract<FileTreeNode, { type: 'folder' }> =>
          node.type === 'folder' && node.path === currentPath,
      )
      if (!folder) {
        folder = { type: 'folder', name: segment, path: currentPath, children: [] }
        currentLevel.push(folder)
      }
      currentLevel = folder.children
    })
  }

  return root
}

function FileExplorer({ files, activeFileId, onSelectFile, onCreateFile, createError, canCreateFiles }: FileExplorerProps) {
  const tree = useMemo(() => buildTree(files), [files])
  const [newFilePath, setNewFilePath] = useState('')

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault()
    const path = newFilePath.trim()
    if (!path) return
    onCreateFile(path)
    setNewFilePath('')
  }

  return (
    <nav className="file-explorer" aria-label="File explorer">
      <div className="file-explorer__header">Explorer</div>
      <div className="file-explorer__tree">
        {tree.map((node) => (
          <FileTreeEntry
            key={node.path}
            node={node}
            depth={0}
            activeFileId={activeFileId}
            onSelectFile={onSelectFile}
          />
        ))}
      </div>
      {canCreateFiles && (
        <form className="file-explorer__new-file" onSubmit={handleCreateSubmit}>
          <input
            type="text"
            placeholder="New file path…"
            value={newFilePath}
            onChange={(event) => setNewFilePath(event.target.value)}
          />
          <button type="submit" disabled={!newFilePath.trim()}>
            + New File
          </button>
        </form>
      )}
      {createError && <div className="file-explorer__error">{createError}</div>}
    </nav>
  )
}

type FileTreeEntryProps = {
  node: FileTreeNode
  depth: number
  activeFileId: string
  onSelectFile: (fileId: string) => void
}

function FileTreeEntry({ node, depth, activeFileId, onSelectFile }: FileTreeEntryProps) {
  const [expanded, setExpanded] = useState(true)
  const paddingLeft = 12 + depth * 14

  if (node.type === 'folder') {
    return (
      <div>
        <button
          type="button"
          className="file-explorer__row file-explorer__row--folder"
          style={{ paddingLeft }}
          onClick={() => setExpanded((prev) => !prev)}
        >
          <span className="file-explorer__icon">{expanded ? '📂' : '📁'}</span>
          <span className="file-explorer__label">{node.name}</span>
        </button>
        {expanded &&
          node.children.map((child) => (
            <FileTreeEntry
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFileId={activeFileId}
              onSelectFile={onSelectFile}
            />
          ))}
      </div>
    )
  }

  const isActive = node.file.id === activeFileId

  return (
    <button
      type="button"
      className={`file-explorer__row file-explorer__row--file${isActive ? ' is-active' : ''}`}
      style={{ paddingLeft }}
      onClick={() => onSelectFile(node.file.id)}
    >
      <span className="file-explorer__icon">📄</span>
      <span className="file-explorer__label">{node.name}</span>
    </button>
  )
}

export default FileExplorer
