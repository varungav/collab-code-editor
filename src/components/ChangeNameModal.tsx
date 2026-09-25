import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

type ChangeNameModalProps = {
  onClose: () => void
}

function ChangeNameModal({ onClose }: ChangeNameModalProps) {
  const { user, setName } = useAuth()
  const [value, setValue] = useState(user?.name ?? '')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const name = value.trim()
    if (!name) {
      setError('Please enter your name')
      return
    }
    setName(name)
    onClose()
  }

  return (
    <div className="change-name-backdrop" onClick={onClose}>
      <form
        className="change-name-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-name-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="change-name-modal__title" id="change-name-title">Change name</h2>
        <label className="change-name-modal__label" htmlFor="change-name-input">Your name</label>
        <input
          id="change-name-input"
          className="change-name-modal__input"
          type="text"
          value={value}
          onChange={(event) => { setValue(event.target.value); setError('') }}
          autoFocus
          autoComplete="off"
        />
        {error && <p className="change-name-modal__error">{error}</p>}
        <div className="change-name-modal__actions">
          <button type="button" className="access-popup__deny" onClick={onClose}>Cancel</button>
          <button type="submit" className="access-popup__allow">Update</button>
        </div>
      </form>
    </div>
  )
}

export default ChangeNameModal
