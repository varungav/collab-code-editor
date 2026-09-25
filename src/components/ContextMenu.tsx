import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem =
  | { type: 'action'; label: string; shortcut?: string; onSelect: () => void; danger?: boolean }
  | { type: 'separator' }

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

// VS Code-style right-click menu: a fixed-position panel at the click
// coordinates, portal-rendered (same reasoning as the explorer's tooltips —
// avoids being clipped by an ancestor's overflow), clamped to the viewport
// so it doesn't run off the right/bottom edge for a click near either.
function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: y, left: x })

  useEffect(() => {
    const rect = menuRef.current?.getBoundingClientRect()
    if (!rect) return
    const clampedLeft = Math.min(x, window.innerWidth - rect.width - 8)
    const clampedTop = Math.min(y, window.innerHeight - rect.height - 8)
    setPos({ left: Math.max(8, clampedLeft), top: Math.max(8, clampedTop) })
  }, [x, y])

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    // Capture phase so this also closes on the very click that would
    // otherwise open a *different* row's context menu.
    document.addEventListener('mousedown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div ref={menuRef} className="context-menu" style={{ top: pos.top, left: pos.left }} role="menu">
      {items.map((item, index) =>
        item.type === 'separator' ? (
          <div key={`separator-${index}`} className="context-menu__separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`context-menu__item${item.danger ? ' context-menu__item--danger' : ''}`}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && <span className="context-menu__shortcut">{item.shortcut}</span>}
          </button>
        ),
      )}
    </div>,
    document.body,
  )
}

export default ContextMenu
