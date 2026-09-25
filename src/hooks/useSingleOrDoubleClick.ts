import { useEffect, useRef } from 'react'

// Suppresses the standalone `click` that always fires before a `dblclick`
// (browsers dispatch click → click → dblclick for a real double-click) —
// without this, a naive onClick+onDoubleClick pair on the same element runs
// the single-click action first regardless, before the double-click handler
// ever gets a chance to react. The 220ms hold is the standard OS-level
// disambiguation window; imperceptible as "lag" for opening a file, but
// enough to tell a click from the first half of a double-click.
export function useSingleOrDoubleClick(onSingleClick: () => void, onDoubleClick: () => void) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return {
    onClick: () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        onSingleClick()
      }, 220)
    },
    onDoubleClick: () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      onDoubleClick()
    },
  }
}
