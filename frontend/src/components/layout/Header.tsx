import { Moon, Sun, Menu } from 'lucide-react'
import GlobalSearch from '../search/GlobalSearch'
import NotificationBell from './NotificationBell'
import { useTheme } from '../../hooks/useTheme'

interface HeaderProps {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { theme, toggle } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-brand-dark flex items-center px-4 sm:px-6 gap-4 no-print">
      <div className="flex items-center gap-2 lg:w-60 flex-shrink-0">
        <button
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="#da8301">
          <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" />
        </svg>
        <span className="text-white font-semibold text-base tracking-[0.1em]">BOXCUBO</span>
      </div>
      <div className="flex-1 flex justify-center">
        <GlobalSearch />
      </div>
      <div className="lg:w-60 flex-shrink-0 flex items-center justify-end gap-1">
        <NotificationBell />
        <button
          onClick={toggle}
          aria-label="Alternar tema claro/escuro"
          title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
          className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
