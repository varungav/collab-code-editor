import type { ReactNode } from 'react'

type HeaderProps = {
  left?: ReactNode
  center?: ReactNode
  right?: ReactNode
}

function Header({ left, center, right }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__logo">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="16" height="16" rx="3" stroke="#4fc1ff" strokeWidth="1.5"/>
            <path d="M5 7l-3 2 3 2M13 7l3 2-3 2M10 5l-2 8" stroke="#4fc1ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          CollabCode
        </span>
        {left}
      </div>

      {center && <div className="app-header__center">{center}</div>}

      {right && <div className="app-header__right">{right}</div>}
    </header>
  )
}

export default Header
