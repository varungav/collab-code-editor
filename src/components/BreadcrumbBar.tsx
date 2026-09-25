import { badgeForFile } from '../utils/fileIcons'

type BreadcrumbBarProps = {
  path: string
  onRevealFolder: (folderPath: string) => void
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// VS Code's breadcrumb bar, path portion only — a symbol-level breadcrumb
// (the enclosing function/class at the cursor) would need real language
// parsing, which is out of scope here. Each folder segment is clickable and
// reveals + selects that folder in the explorer (see FileExplorer's
// revealSignal); the trailing filename segment isn't (it's already the
// active file, nothing to navigate to).
function BreadcrumbBar({ path, onRevealFolder }: BreadcrumbBarProps) {
  const segments = path.split('/')
  const fileName = segments[segments.length - 1]
  const folderSegments = segments.slice(0, -1)
  const badge = badgeForFile(fileName)

  return (
    <div className="breadcrumb-bar" aria-label="Breadcrumb">
      {folderSegments.map((segment, index) => {
        const folderPath = folderSegments.slice(0, index + 1).join('/')
        return (
          <span className="breadcrumb-bar__segment" key={folderPath}>
            <button type="button" className="breadcrumb-bar__item" onClick={() => onRevealFolder(folderPath)}>
              {segment}
            </button>
            <ChevronRight />
          </span>
        )
      })}
      <span className="breadcrumb-bar__segment">
        <span className="breadcrumb-bar__item breadcrumb-bar__item--file">
          <span className="breadcrumb-bar__badge" style={{ color: badge.color }}>
            {badge.label}
          </span>
          {fileName}
        </span>
      </span>
    </div>
  )
}

export default BreadcrumbBar
