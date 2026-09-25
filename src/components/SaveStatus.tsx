type SaveStatusProps = {
  state: 'idle' | 'saving' | 'error'
}

// A small floating pill, separate from the editor's own sync badge (which
// is about the collaborative connection, not the save itself) — mixing the
// two into one line of text made neither easy to read at a glance. Shows
// nothing at all once idle again; a fast successful save needs no lingering
// confirmation, only "in progress" and "failed" are worth surfacing.
function SaveStatus({ state }: SaveStatusProps) {
  if (state === 'idle') return null

  return (
    <div className={`save-status-pill${state === 'error' ? ' save-status-pill--error' : ''}`} role="status">
      {state === 'saving' ? (
        <>
          <span className="spinner spinner--inline" aria-hidden="true" />
          Saving…
        </>
      ) : (
        'Save failed'
      )}
    </div>
  )
}

export default SaveStatus
