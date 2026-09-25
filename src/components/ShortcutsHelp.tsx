import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl'

const APP_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: `${MOD} S`, description: 'Save the active file' },
  { keys: `${MOD} W`, description: 'Close the active tab' },
  { keys: `${MOD} PageDown`, description: 'Next tab' },
  { keys: `${MOD} PageUp`, description: 'Previous tab' },
  { keys: `${MOD} 1–9`, description: 'Go to tab by position' },
  { keys: `${MOD} B`, description: 'Toggle the file explorer' },
]

const EDITOR_SHORTCUTS: { keys: string; description: string }[] = [
  { keys: `${MOD} F`, description: 'Find' },
  { keys: `${MOD} H`, description: 'Find and replace' },
  { keys: `${MOD} /`, description: 'Toggle line comment' },
  { keys: `${MOD} D`, description: 'Select next occurrence' },
  { keys: 'Alt + Click', description: 'Add a cursor' },
  { keys: `${MOD} Z / ${MOD} Shift Z`, description: 'Undo / Redo' },
]

function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  // Stable position captured before the popover mounts — avoids the
  // one-frame jump caused by reading getBoundingClientRect after React
  // has already started re-rendering the tree with open=true.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Capture position synchronously before paint so the popover appears
  // in the right place on the very first frame it's visible.
  useLayoutEffect(() => {
    if (!open) return
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      // Anchor to right edge so the popover doesn't overflow off-screen
      // when the button is near the right side of the viewport.
      setPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 310) })
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: MouseEvent) {
      const t = e.target as Node
      if (popoverRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="shortcuts-help__button"
        aria-label="Keyboard shortcuts"
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={popoverRef}
            className="shortcuts-help__popover"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="shortcuts-help__section-title">Shortcuts</div>
            <ul className="shortcuts-help__list">
              {APP_SHORTCUTS.map((item) => (
                <li key={item.keys}>
                  <kbd>{item.keys}</kbd>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
            <div className="shortcuts-help__section-title">Built into the editor</div>
            <ul className="shortcuts-help__list">
              {EDITOR_SHORTCUTS.map((item) => (
                <li key={item.keys}>
                  <kbd>{item.keys}</kbd>
                  <span>{item.description}</span>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}

export default ShortcutsHelp
