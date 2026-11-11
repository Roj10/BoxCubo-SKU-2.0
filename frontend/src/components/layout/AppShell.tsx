import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Fecha o drawer ao trocar de rota
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Fecha o drawer ao pressionar Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div>
      <Header onMenuClick={() => setDrawerOpen(true)} />
      <Sidebar isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      {drawerOpen && (
        <div
          className="fixed inset-0 top-14 bg-neutral-950/60 z-30 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <main className="mt-14 lg:ml-60 bg-neutral-100 dark:bg-neutral-900 min-h-[calc(100vh-56px)] overflow-y-auto">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
