import type { ReactNode } from 'react'

type HeaderProps = {
  right?: ReactNode
}

function Header({ right }: HeaderProps) {
  return (
    <header className="app-header">
      <span className="app-header__title">CollabCode</span>
      {right && <div className="app-header__right">{right}</div>}
    </header>
  )
}

export default Header
