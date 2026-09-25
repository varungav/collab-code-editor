import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'

type Props = { onName?: () => void }

function NamePromptPage({ onName }: Props) {
  const { setName } = useAuth()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const name = value.trim()
    if (!name) { setError('Please enter your name'); return }
    onName?.()
    setName(name)
  }

  return (
    <div className="splash">
      <div className="splash__card">
        <div className="splash__logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="6" fill="#0e639c22" stroke="#0e639c" strokeWidth="1.5"/>
            <path d="M10 12l-5 4 5 4M22 12l5 4-5 4M18 9l-4 14"
              stroke="#4fc1ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="splash__title">CollabCode</h1>
        <p className="splash__subtitle">Real-time collaborative code editor</p>

        <form onSubmit={handleSubmit} className="splash__form">
          {error && <p className="splash__error">{error}</p>}
          <input
            className="splash__input"
            type="text"
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            placeholder="Your name"
            autoFocus
            autoComplete="off"
          />
          <button type="submit" className="splash__btn">
            Get started
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}

export default NamePromptPage
